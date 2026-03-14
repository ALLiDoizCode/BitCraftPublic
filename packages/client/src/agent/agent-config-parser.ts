/**
 * Agent.md Configuration Parser
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Parses Agent.md files using heading-based section splitting.
 * Agent.md uses standard markdown (NOT YAML frontmatter).
 *
 * Security: OWASP A03 -- file size limit (1MB), no code execution from parsed content.
 *
 * @module agent/agent-config-parser
 */

import type { AgentConfig, AgentBudgetConfig, AgentLoggingConfig } from './agent-config-types.js';
import { AgentConfigError } from './agent-config-types.js';

/** Maximum file size in bytes (1MB) -- OWASP A03 DoS prevention */
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;

/** Budget format regex: <amount> <unit>/<period> */
const BUDGET_REGEX = /^(\d+(?:\.\d+)?)\s+(\w+)\/(\w+)$/;

/** Valid logging levels */
const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

/**
 * Represents a parsed markdown section with heading and body content.
 */
interface MarkdownSection {
  /** Section heading text (without ## prefix) */
  heading: string;
  /** Section body content (everything between this heading and the next) */
  body: string;
}

/**
 * Split markdown content into sections based on H2 headings.
 * Returns an array of sections, each with heading text and body content.
 *
 * @param content - Raw markdown content (after H1 extraction)
 * @returns Array of parsed sections
 */
function splitSections(content: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const lines = content.split('\n');

  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    // Match H2 headings (## Something)
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      // Save previous section if any
      if (currentHeading !== null) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join('\n').trim(),
        });
      }
      currentHeading = h2Match[1].trim();
      currentBody = [];
    } else if (currentHeading !== null) {
      currentBody.push(line);
    }
  }

  // Save last section
  if (currentHeading !== null) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join('\n').trim(),
    });
  }

  return sections;
}

/**
 * Extract agent name from H1 heading.
 * Expected format: `# Agent: <name>`
 *
 * @param content - Raw markdown content
 * @param filePath - File path for error messages
 * @returns Agent name string
 * @throws {AgentConfigError} If no H1 heading with `Agent:` prefix found
 */
function extractAgentName(content: string, filePath: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^#\s+Agent:\s*(.+)$/);
    if (match) {
      const name = match[1].trim();
      if (name.length === 0) {
        throw new AgentConfigError(
          `Agent name is empty in ${filePath}: expected "# Agent: <name>"`,
          'MISSING_AGENT_NAME',
          filePath
        );
      }
      return name;
    }
  }

  throw new AgentConfigError(
    `Missing agent name heading in ${filePath}: expected "# Agent: <name>"`,
    'MISSING_AGENT_NAME',
    filePath
  );
}

/**
 * Extract skill names from the ## Skills section body.
 * Each line starting with `- ` is a skill reference.
 *
 * @param body - Skills section body content
 * @param filePath - File path for error messages
 * @returns Array of skill name strings
 * @throws {AgentConfigError} If no valid skill names found or duplicates exist
 */
function extractSkillNames(body: string, filePath: string): string[] {
  const lines = body.split('\n');
  const names: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      const name = trimmed.slice(2).trim();
      if (name.length > 0) {
        names.push(name);
      }
    } else if (trimmed === '-') {
      // Empty bullet item, skip
    }
  }

  if (names.length === 0) {
    throw new AgentConfigError(
      `No skill references found in ## Skills section of ${filePath}: expected bullet list (- skill_name)`,
      'MISSING_SKILLS_SECTION',
      filePath
    );
  }

  // Check for duplicates
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const name of names) {
    if (seen.has(name)) {
      duplicates.push(name);
    }
    seen.add(name);
  }

  if (duplicates.length > 0) {
    throw new AgentConfigError(
      `Duplicate skill references in ${filePath}: ${duplicates.join(', ')}`,
      'DUPLICATE_SKILL_REFERENCE',
      filePath,
      duplicates
    );
  }

  return names;
}

/**
 * Parse budget from the ## Budget section body.
 * Expected format: `<amount> <unit>/<period>`
 *
 * @param body - Budget section body content
 * @param filePath - File path for error messages
 * @returns Parsed budget config
 * @throws {AgentConfigError} If format is invalid
 */
function parseBudget(body: string, filePath: string): AgentBudgetConfig {
  // Strip leading/trailing whitespace and blank lines, extract first non-empty line
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new AgentConfigError(
      `Empty budget section in ${filePath}: expected format "<amount> <unit>/<period>"`,
      'INVALID_BUDGET_FORMAT',
      filePath
    );
  }

  const budgetLine = lines[0];
  const match = BUDGET_REGEX.exec(budgetLine);
  if (!match) {
    throw new AgentConfigError(
      `Invalid budget format "${budgetLine}" in ${filePath}: expected format "<amount> <unit>/<period>" (e.g., "100 ILP/session")`,
      'INVALID_BUDGET_FORMAT',
      filePath
    );
  }

  return {
    limit: parseFloat(match[1]),
    unit: match[2],
    period: match[3],
    raw: budgetLine,
  };
}

/**
 * Parse logging config from the ## Logging section body.
 * Expected format: key-value pairs as `- key: value`
 *
 * @param body - Logging section body content
 * @param filePath - File path for error messages
 * @returns Parsed logging config
 * @throws {AgentConfigError} If required keys are missing or values are invalid
 */
function parseLogging(body: string, filePath: string): AgentLoggingConfig {
  const lines = body.split('\n');
  const kvPairs = new Map<string, string>();

  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines like "- key: value"
    const match = trimmed.match(/^-\s+(\w+):\s*(.+)$/);
    if (match) {
      kvPairs.set(match[1], match[2].trim());
    }
  }

  const path = kvPairs.get('path');
  if (!path) {
    throw new AgentConfigError(
      `Missing required "path" in ## Logging section of ${filePath}`,
      'INVALID_LOGGING_CONFIG',
      filePath
    );
  }

  const level = kvPairs.get('level') ?? 'info';
  if (!VALID_LOG_LEVELS.has(level)) {
    throw new AgentConfigError(
      `Invalid logging level "${level}" in ${filePath}: must be one of debug, info, warn, error`,
      'INVALID_LOGGING_CONFIG',
      filePath
    );
  }

  return {
    path,
    level: level as 'debug' | 'info' | 'warn' | 'error',
  };
}

/**
 * Parse an Agent.md file from raw content.
 *
 * @param filePath - Path to the Agent.md file (for error messages)
 * @param content - Raw file content string
 * @returns Parsed AgentConfig object
 * @throws {AgentConfigError} If content is invalid, missing required sections, or too large
 */
export function parseAgentConfig(filePath: string, content: string): AgentConfig {
  // Check file size limit (OWASP A03 DoS prevention)
  if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE_BYTES) {
    throw new AgentConfigError(
      `File exceeds maximum size of 1MB: ${filePath}`,
      'PARSE_ERROR',
      filePath
    );
  }

  // Normalize line endings: convert CRLF (\r\n) to LF (\n) for cross-platform compatibility
  const normalized = content.replace(/\r\n/g, '\n');

  // Extract agent name from H1 heading
  const name = extractAgentName(normalized, filePath);

  // Split into sections
  const sections = splitSections(normalized);
  const sectionMap = new Map<string, string>();
  for (const section of sections) {
    sectionMap.set(section.heading, section.body);
  }

  // Extract required Skills section
  const skillsBody = sectionMap.get('Skills');
  if (skillsBody === undefined) {
    throw new AgentConfigError(
      `Missing ## Skills section in ${filePath}`,
      'MISSING_SKILLS_SECTION',
      filePath
    );
  }
  const skillNames = extractSkillNames(skillsBody, filePath);

  // Extract optional Personality section
  const personalityBody = sectionMap.get('Personality');
  const personality = personalityBody && personalityBody.length > 0 ? personalityBody : undefined;

  // Extract optional Budget section
  const budgetBody = sectionMap.get('Budget');
  const budget = budgetBody !== undefined ? parseBudget(budgetBody, filePath) : undefined;

  // Extract optional Logging section
  const loggingBody = sectionMap.get('Logging');
  const logging = loggingBody !== undefined ? parseLogging(loggingBody, filePath) : undefined;

  const config: AgentConfig = {
    name,
    skillNames,
  };

  if (personality !== undefined) {
    config.personality = personality;
  }
  if (budget !== undefined) {
    config.budget = budget;
  }
  if (logging !== undefined) {
    config.logging = logging;
  }

  return config;
}
