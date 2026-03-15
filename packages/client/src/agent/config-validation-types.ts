/**
 * Configuration Validation Types
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Type definitions for validating agent configuration and skill files
 * against a live SpacetimeDB module's available reducers and tables.
 *
 * @module agent/config-validation-types
 */

/**
 * A single parameter of a SpacetimeDB module reducer.
 */
export interface ModuleReducerParam {
  /** Parameter name */
  name: string;
  /** SpacetimeDB type (e.g., 'i32', 'u64', 'String') */
  type: string;
}

/**
 * A reducer exposed by a SpacetimeDB module.
 */
export interface ModuleReducerInfo {
  /** Reducer name */
  name: string;
  /** Parameter definitions */
  params: ModuleReducerParam[];
}

/**
 * Metadata about a SpacetimeDB module's available reducers and tables.
 * Fetched from the SpacetimeDB HTTP API or constructed offline for testing.
 */
export interface ModuleInfo {
  /** Available reducers with parameter signatures */
  reducers: ModuleReducerInfo[];
  /** Available table names */
  tables: string[];
}

/**
 * The type of validation check performed.
 */
export type ValidationCheckType = 'reducer_exists' | 'param_compatibility' | 'table_exists';

/**
 * Result of a single validation check.
 */
export interface ValidationCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Name of the skill being validated */
  skillName: string;
  /** Type of check performed */
  checkType: ValidationCheckType;
  /** Human-readable result message */
  message: string;
  /** Optional additional details */
  details?: string;
}

/**
 * Full validation report aggregating all check results.
 */
export interface ValidationReport {
  /** Whether ALL checks passed */
  passed: boolean;
  /** Individual check results */
  checks: ValidationCheckResult[];
  /** Warning messages (e.g., skills with zero subscriptions) */
  warnings: string[];
  /** ISO 8601 timestamp of when validation ran */
  timestamp: string;
  /** Elapsed time in milliseconds */
  durationMs: number;
  /** Number of skills validated */
  skillCount: number;
}

/**
 * Error codes for configuration validation failures.
 */
export type ConfigValidationErrorCode =
  | 'MODULE_FETCH_FAILED'
  | 'REDUCER_NOT_FOUND'
  | 'PARAM_TYPE_MISMATCH'
  | 'TABLE_NOT_FOUND'
  | 'VALIDATION_TIMEOUT';

/**
 * Error thrown when configuration validation fails.
 * Follows the same pattern as SkillParseError (Story 4.1) and AgentConfigError (Story 4.2)
 * with a typed code field for programmatic error handling.
 *
 * Uses optional `skillFile` instead of required `filePath` because:
 * 1. Validation operates on parsed Skill objects, not raw files
 * 2. Network-level errors (MODULE_FETCH_FAILED, VALIDATION_TIMEOUT) have no associated skill
 * 3. The optional field preserves traceability when a specific skill causes a failure
 */
export class ConfigValidationError extends Error {
  /** Error code for programmatic error handling */
  readonly code: ConfigValidationErrorCode;
  /** Optional skill name associated with this error */
  readonly skillFile?: string;
  /** Optional additional details */
  readonly details?: string;

  constructor(
    message: string,
    code: ConfigValidationErrorCode,
    skillFile?: string,
    details?: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
    this.code = code;
    this.skillFile = skillFile;
    this.details = details;
  }
}

/**
 * Abstraction for fetching SpacetimeDB module metadata.
 * Enables mocking in unit tests and alternative metadata sources.
 */
export interface ModuleInfoProvider {
  /** Fetch module metadata (reducers and tables) */
  getModuleInfo(): Promise<ModuleInfo>;
}
