/**
 * Agent Skill Types
 * Story 4.1: Skill File Format & Parser
 *
 * Type definitions for SKILL.md file parsing, skill metadata, and skill registry.
 * These types define the uniform consumption format (AC5, NFR21) consumed by
 * MCP server, TUI backend, and direct import.
 *
 * @module agent/types
 */

/**
 * Supported SpacetimeDB parameter types for skill reducer arguments.
 * Matches the type system used in SpacetimeDB module definitions.
 */
export type SkillParamType =
  | 'i32'
  | 'u32'
  | 'u64'
  | 'i64'
  | 'f32'
  | 'f64'
  | 'bool'
  | 'String'
  | 'Identity';

/**
 * A single parameter definition for a skill's reducer.
 * Excludes the identity parameter, which is auto-prepended by the BLS handler.
 */
export interface SkillParam {
  /** Parameter name */
  name: string;
  /** SpacetimeDB type */
  type: SkillParamType;
  /** Human-readable description */
  description: string;
  /** Optional default value */
  default?: unknown;
}

/**
 * A SpacetimeDB table subscription required by a skill.
 */
export interface SkillSubscription {
  /** SpacetimeDB table name */
  table: string;
  /** Why this subscription is needed */
  description: string;
}

/**
 * Expected output for a positive behavioral eval.
 */
export interface SkillExpected {
  /** Target reducer name */
  reducer: string;
  /** Expected arguments, or null if args depend on game state */
  args: unknown[] | null;
}

/**
 * A behavioral eval test case for a skill.
 */
export interface SkillEval {
  /** Natural language input prompt */
  prompt: string;
  /** Expected output: { reducer, args } for positive, 'skill_not_triggered' for negative */
  expected: SkillExpected | 'skill_not_triggered';
  /** Human-readable success/failure criteria */
  criteria: string;
}

/**
 * Skill metadata loaded eagerly from YAML frontmatter only (AC6 progressive disclosure).
 * Contains everything needed for skill selection and registry indexing.
 */
export interface SkillMetadata {
  /** Unique skill identifier */
  name: string;
  /** One-line description for LLM skill selection */
  description: string;
  /** Target SpacetimeDB reducer name */
  reducer: string;
  /** Reducer parameters (excluding auto-prepended identity) */
  params: SkillParam[];
  /** SpacetimeDB tables needed for this skill */
  subscriptions: SkillSubscription[];
  /** Optional categorization tags */
  tags?: string[];
}

/**
 * Full skill representation including markdown body and evals (AC6 full load).
 * Extends SkillMetadata with the on-demand content.
 */
export interface Skill extends SkillMetadata {
  /** Markdown body content (human-readable instructions) */
  body: string;
  /** Behavioral eval test cases */
  evals: SkillEval[];
}

/**
 * Error codes for skill parsing failures.
 */
export type SkillParseErrorCode =
  | 'MISSING_FRONTMATTER'
  | 'INVALID_YAML'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_REDUCER_NAME'
  | 'INVALID_PARAM_TYPE'
  | 'PARSE_ERROR'
  | 'DUPLICATE_SKILL_NAME';

/**
 * Error thrown when skill file parsing fails.
 * Follows the pattern from ContentParseError (Story 3.2) and FeeScheduleError (Story 3.3)
 * with additional filePath and fields properties for actionable error messages.
 */
export class SkillParseError extends Error {
  /** Error code for programmatic error handling */
  readonly code: SkillParseErrorCode;
  /** Path to the file that failed to parse */
  readonly filePath: string;
  /** List of missing or invalid fields (for MISSING_REQUIRED_FIELD, INVALID_PARAM_TYPE) */
  readonly fields?: string[];

  constructor(message: string, code: SkillParseErrorCode, filePath: string, fields?: string[]) {
    super(message);
    this.name = 'SkillParseError';
    this.code = code;
    this.filePath = filePath;
    this.fields = fields;
  }
}
