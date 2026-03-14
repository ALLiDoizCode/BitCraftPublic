/**
 * Skill File Parser
 * Story 4.1: Skill File Format & Parser
 *
 * Parses SKILL.md files with YAML frontmatter and markdown body.
 * Uses gray-matter for frontmatter extraction and js-yaml DEFAULT_SCHEMA
 * for safe YAML parsing (rejects custom tags like !!js/function).
 *
 * @module agent/skill-parser
 */

import matter from 'gray-matter';
import type {
  Skill,
  SkillMetadata,
  SkillParam,
  SkillParamType,
  SkillSubscription,
  SkillEval,
  SkillExpected,
} from './types.js';
import { SkillParseError } from './types.js';

/** Maximum file size in bytes (10MB) -- OWASP A03 DoS prevention */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Valid SpacetimeDB parameter types */
const VALID_PARAM_TYPES: ReadonlySet<string> = new Set([
  'i32',
  'u32',
  'u64',
  'i64',
  'f32',
  'f64',
  'bool',
  'String',
  'Identity',
]);

/**
 * Reducer name regex -- matches BLS handler content-parser.ts (Story 3.2)
 * 1-64 chars, starts with letter or underscore, alphanumeric + underscore only
 */
const REDUCER_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

/**
 * Extract and validate YAML frontmatter from raw content using gray-matter.
 * gray-matter uses js-yaml DEFAULT_SCHEMA which rejects custom YAML tags
 * (e.g., !!js/function, !!python/object/apply) preventing code execution.
 *
 * @param filePath - File path for error messages
 * @param content - Raw file content
 * @returns gray-matter parsed result with data and content
 */
function extractFrontmatter(
  filePath: string,
  content: string
): { data: Record<string, unknown>; body: string } {
  // Check file size limit (OWASP A03)
  if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE_BYTES) {
    throw new SkillParseError(
      `File exceeds maximum size of 10MB: ${filePath}`,
      'PARSE_ERROR',
      filePath
    );
  }

  // Check for frontmatter delimiters (manual check, not matter.test() which
  // can conflict with vitest globals when globals: true is enabled)
  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) {
    throw new SkillParseError(
      `No YAML frontmatter found (missing --- delimiters): ${filePath}`,
      'MISSING_FRONTMATTER',
      filePath
    );
  }

  try {
    const result = matter(content);

    // gray-matter returns empty data object when frontmatter exists but is empty
    // or when content starts with --- but has no valid YAML.
    // If data is empty but we had frontmatter, that's handled by field validation later.
    return {
      data: result.data as Record<string, unknown>,
      body: result.content,
    };
  } catch (err: unknown) {
    // gray-matter / js-yaml parse errors (including custom tag rejection)
    const message = err instanceof Error ? err.message : 'Unknown YAML parsing error';
    throw new SkillParseError(
      `Invalid YAML in frontmatter: ${message} (${filePath})`,
      'INVALID_YAML',
      filePath
    );
  }
}

/**
 * Validate and extract required string fields from frontmatter data.
 *
 * @param data - Parsed frontmatter data
 * @param filePath - File path for error messages
 * @returns Object with validated name, description, reducer
 */
function validateRequiredFields(
  data: Record<string, unknown>,
  filePath: string
): { name: string; description: string; reducer: string } {
  const missingFields: string[] = [];

  if (!data.name || typeof data.name !== 'string') {
    missingFields.push('name');
  }
  if (!data.description || typeof data.description !== 'string') {
    missingFields.push('description');
  }
  if (!data.reducer || typeof data.reducer !== 'string') {
    missingFields.push('reducer');
  }
  if (!Array.isArray(data.params)) {
    missingFields.push('params');
  }
  if (!Array.isArray(data.subscriptions)) {
    missingFields.push('subscriptions');
  }

  if (missingFields.length > 0) {
    throw new SkillParseError(
      `Missing required fields in ${filePath}: ${missingFields.join(', ')}`,
      'MISSING_REQUIRED_FIELD',
      filePath,
      missingFields
    );
  }

  return {
    name: data.name as string,
    description: data.description as string,
    reducer: data.reducer as string,
  };
}

/**
 * Validate reducer name format.
 * Must match: /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/
 * Same regex as BLS handler content-parser.ts (Story 3.2)
 */
function validateReducerName(reducer: string, filePath: string): void {
  if (!REDUCER_NAME_REGEX.test(reducer)) {
    throw new SkillParseError(
      `Invalid reducer name "${reducer}" in ${filePath}: must be 1-64 chars, alphanumeric + underscore, starting with letter or underscore`,
      'INVALID_REDUCER_NAME',
      filePath
    );
  }
}

/**
 * Validate and parse parameters array from frontmatter data.
 */
function validateParams(rawParams: unknown[], filePath: string): SkillParam[] {
  return rawParams.map((rawParam, index) => {
    if (typeof rawParam !== 'object' || rawParam === null) {
      throw new SkillParseError(
        `Invalid param at index ${index} in ${filePath}: must be an object`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`params[${index}]`]
      );
    }

    const param = rawParam as Record<string, unknown>;

    if (!param.name || typeof param.name !== 'string') {
      throw new SkillParseError(
        `Param at index ${index} missing required field "name" in ${filePath}`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`params[${index}].name`]
      );
    }

    if (!param.type || typeof param.type !== 'string') {
      throw new SkillParseError(
        `Param "${param.name}" missing required field "type" in ${filePath}`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`params[${index}].type`]
      );
    }

    if (!VALID_PARAM_TYPES.has(param.type)) {
      throw new SkillParseError(
        `Invalid param type "${param.type}" for param "${param.name}" in ${filePath}. Valid types: ${[...VALID_PARAM_TYPES].join(', ')}`,
        'INVALID_PARAM_TYPE',
        filePath,
        [`params[${index}].type`]
      );
    }

    if (!param.description || typeof param.description !== 'string') {
      throw new SkillParseError(
        `Param "${param.name}" missing required field "description" in ${filePath}`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`params[${index}].description`]
      );
    }

    const result: SkillParam = {
      name: param.name,
      type: param.type as SkillParamType,
      description: param.description,
    };

    // Include optional default value if present
    if (param.default !== undefined) {
      result.default = param.default;
    }

    return result;
  });
}

/**
 * Validate and parse subscriptions array from frontmatter data.
 */
function validateSubscriptions(rawSubscriptions: unknown[], filePath: string): SkillSubscription[] {
  return rawSubscriptions.map((rawSub, index) => {
    if (typeof rawSub !== 'object' || rawSub === null) {
      throw new SkillParseError(
        `Invalid subscription at index ${index} in ${filePath}: must be an object`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`subscriptions[${index}]`]
      );
    }

    const sub = rawSub as Record<string, unknown>;

    if (!sub.table || typeof sub.table !== 'string') {
      throw new SkillParseError(
        `Subscription at index ${index} missing required field "table" in ${filePath}`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`subscriptions[${index}].table`]
      );
    }

    if (!sub.description || typeof sub.description !== 'string') {
      throw new SkillParseError(
        `Subscription "${sub.table}" missing required field "description" in ${filePath}`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`subscriptions[${index}].description`]
      );
    }

    return {
      table: sub.table,
      description: sub.description,
    };
  });
}

/**
 * Validate and parse evals array from frontmatter data.
 */
function validateEvals(rawEvals: unknown[], filePath: string): SkillEval[] {
  return rawEvals.map((rawEval, index) => {
    if (typeof rawEval !== 'object' || rawEval === null) {
      throw new SkillParseError(
        `Invalid eval at index ${index} in ${filePath}: must be an object`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`evals[${index}]`]
      );
    }

    const evalEntry = rawEval as Record<string, unknown>;

    if (!evalEntry.prompt || typeof evalEntry.prompt !== 'string') {
      throw new SkillParseError(
        `Eval at index ${index} missing required field "prompt" in ${filePath}`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`evals[${index}].prompt`]
      );
    }

    if (!evalEntry.criteria || typeof evalEntry.criteria !== 'string') {
      throw new SkillParseError(
        `Eval at index ${index} missing required field "criteria" in ${filePath}`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`evals[${index}].criteria`]
      );
    }

    // Parse expected: either 'skill_not_triggered' string or { reducer, args } object
    let expected: SkillExpected | 'skill_not_triggered';

    if (evalEntry.expected === 'skill_not_triggered') {
      expected = 'skill_not_triggered';
    } else if (typeof evalEntry.expected === 'object' && evalEntry.expected !== null) {
      const expectedObj = evalEntry.expected as Record<string, unknown>;

      // Validate expected.reducer is a non-empty string
      if (!expectedObj.reducer || typeof expectedObj.reducer !== 'string') {
        throw new SkillParseError(
          `Eval at index ${index} has invalid "expected.reducer" field in ${filePath}: must be a non-empty string`,
          'MISSING_REQUIRED_FIELD',
          filePath,
          [`evals[${index}].expected.reducer`]
        );
      }

      // Validate expected.args is null or an array (reject other types)
      if (
        expectedObj.args !== null &&
        expectedObj.args !== undefined &&
        !Array.isArray(expectedObj.args)
      ) {
        throw new SkillParseError(
          `Eval at index ${index} has invalid "expected.args" field in ${filePath}: must be an array or null`,
          'MISSING_REQUIRED_FIELD',
          filePath,
          [`evals[${index}].expected.args`]
        );
      }

      expected = {
        reducer: expectedObj.reducer,
        args:
          expectedObj.args === null || expectedObj.args === undefined
            ? null
            : (expectedObj.args as unknown[]),
      };
    } else {
      throw new SkillParseError(
        `Eval at index ${index} has invalid "expected" field in ${filePath}: must be "skill_not_triggered" or { reducer, args }`,
        'MISSING_REQUIRED_FIELD',
        filePath,
        [`evals[${index}].expected`]
      );
    }

    return {
      prompt: evalEntry.prompt,
      expected,
      criteria: evalEntry.criteria,
    };
  });
}

/**
 * Parse optional tags array from frontmatter data.
 * Accepts an array of strings, or wraps a single string value in an array.
 * Returns undefined if tags is not present.
 * Non-string array elements are coerced to strings (forward-compatible behavior).
 */
function parseTags(data: Record<string, unknown>): string[] | undefined {
  if (data.tags === undefined || data.tags === null) {
    return undefined;
  }
  if (Array.isArray(data.tags)) {
    return data.tags.map(String);
  }
  if (typeof data.tags === 'string') {
    return [data.tags];
  }
  // Non-string, non-array tags (e.g., number, boolean) -- coerce to string array
  return [String(data.tags)];
}

/**
 * Parse a full skill file from raw content.
 * Extracts YAML frontmatter, markdown body, and evals.
 *
 * @param filePath - Path to the skill file (for error messages)
 * @param content - Raw file content string
 * @returns Parsed Skill object with all fields
 * @throws {SkillParseError} If content is invalid, missing fields, or too large
 */
export function parseSkillFile(filePath: string, content: string): Skill {
  const { data, body } = extractFrontmatter(filePath, content);

  const { name, description, reducer } = validateRequiredFields(data, filePath);
  validateReducerName(reducer, filePath);

  const params = validateParams(data.params as unknown[], filePath);
  const subscriptions = validateSubscriptions(data.subscriptions as unknown[], filePath);

  // Parse optional evals
  const evals = Array.isArray(data.evals) ? validateEvals(data.evals, filePath) : [];

  // Parse optional tags
  const tags = parseTags(data);

  const skill: Skill = {
    name,
    description,
    reducer,
    params,
    subscriptions,
    body: body.trim(),
    evals,
  };

  if (tags !== undefined) {
    skill.tags = tags;
  }

  return skill;
}

/**
 * Parse only skill metadata from raw content (AC6 progressive disclosure).
 * Extracts YAML frontmatter fields only, skipping markdown body and evals.
 *
 * @param filePath - Path to the skill file (for error messages)
 * @param content - Raw file content string
 * @returns Parsed SkillMetadata object (frontmatter only)
 * @throws {SkillParseError} If content is invalid or missing required fields
 */
export function parseSkillMetadata(filePath: string, content: string): SkillMetadata {
  const { data } = extractFrontmatter(filePath, content);

  const { name, description, reducer } = validateRequiredFields(data, filePath);
  validateReducerName(reducer, filePath);

  const params = validateParams(data.params as unknown[], filePath);
  const subscriptions = validateSubscriptions(data.subscriptions as unknown[], filePath);

  const tags = parseTags(data);

  const metadata: SkillMetadata = {
    name,
    description,
    reducer,
    params,
    subscriptions,
  };

  if (tags !== undefined) {
    metadata.tags = tags;
  }

  return metadata;
}
