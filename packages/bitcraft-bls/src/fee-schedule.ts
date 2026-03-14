/**
 * Fee Schedule Loader
 * Story 3.3: Pricing Configuration & Fee Schedule
 *
 * Loads and validates JSON fee schedule files for per-reducer pricing.
 * The BLS fee schedule format is superset-compatible with @sigil/client's
 * ActionCostRegistry: the BLS reads only `cost` from each action entry,
 * while `category` and `frequency` are optional metadata.
 *
 * SECURITY (OWASP A03):
 * - Path traversal prevention: rejects paths containing `..` segments
 * - File size limit: 1MB maximum
 * - JSON.parse only (no eval, no dynamic code)
 * - Reducer name validation via regex
 *
 * @module fee-schedule
 */

import { readFileSync } from 'node:fs';

/** Maximum file size in bytes (1MB). Compared against Buffer.byteLength(). */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Regex for valid reducer names: starts with a letter or underscore,
 * followed by 0-63 alphanumeric or underscore characters.
 * Same regex as content-parser.ts (OWASP A03: injection prevention).
 */
const REDUCER_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

/**
 * Fee schedule entry for a single action (reducer).
 * BLS only reads `cost`; `category` and `frequency` are optional metadata
 * consumed by @sigil/client but not by the BLS.
 */
export interface FeeScheduleEntry {
  /** ILP cost for this action (non-negative number) */
  cost: number;
  /** Action category (optional, client-side metadata) */
  category?: string;
  /** Expected execution frequency (optional, client-side metadata) */
  frequency?: string;
}

/**
 * Fee schedule configuration.
 * Compatible with @sigil/client's ActionCostRegistry format.
 */
export interface FeeSchedule {
  /** Schema version (must be 1) */
  version: number;
  /** Default cost for unmapped actions */
  defaultCost: number;
  /** Map of reducer names to fee entries */
  actions: Record<string, FeeScheduleEntry>;
}

/**
 * Error thrown when fee schedule loading or validation fails.
 */
export class FeeScheduleError extends Error {
  /** Error code for categorization */
  readonly code: string;

  constructor(message: string, code = 'FEE_SCHEDULE_ERROR') {
    super(message);
    this.name = 'FeeScheduleError';
    this.code = code;
  }
}

/**
 * Validate parsed fee schedule data against the schema.
 *
 * @param data - Parsed JSON data (unknown type)
 * @returns Validated FeeSchedule
 * @throws {FeeScheduleError} If validation fails
 */
function validateFeeSchedule(data: unknown): FeeSchedule {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new FeeScheduleError('Fee schedule must be a JSON object', 'INVALID_FORMAT');
  }

  const obj = data as Record<string, unknown>;

  // Validate version field
  if (!('version' in obj)) {
    throw new FeeScheduleError('Fee schedule missing required field: version', 'MISSING_FIELD');
  }
  if (typeof obj.version !== 'number' || obj.version !== 1) {
    throw new FeeScheduleError(
      `Fee schedule version must be 1, got: ${String(obj.version)}`,
      'INVALID_VERSION'
    );
  }

  // Validate defaultCost field
  if (!('defaultCost' in obj)) {
    throw new FeeScheduleError('Fee schedule missing required field: defaultCost', 'MISSING_FIELD');
  }
  if (
    typeof obj.defaultCost !== 'number' ||
    obj.defaultCost < 0 ||
    !Number.isFinite(obj.defaultCost)
  ) {
    throw new FeeScheduleError(
      `Fee schedule defaultCost must be a non-negative finite number, got: ${String(obj.defaultCost)}`,
      'INVALID_FIELD'
    );
  }

  // Validate actions field
  if (!('actions' in obj)) {
    throw new FeeScheduleError('Fee schedule missing required field: actions', 'MISSING_FIELD');
  }
  if (typeof obj.actions !== 'object' || obj.actions === null || Array.isArray(obj.actions)) {
    throw new FeeScheduleError(
      'Fee schedule actions must be an object (not array)',
      'INVALID_FIELD'
    );
  }

  const actions = obj.actions as Record<string, unknown>;

  // Validate each action entry
  for (const [actionName, entry] of Object.entries(actions)) {
    // Validate action name matches reducer name pattern (OWASP A03: prevents
    // injection via malformed keys). Same regex as content-parser.ts.
    if (!REDUCER_NAME_REGEX.test(actionName)) {
      throw new FeeScheduleError(
        `Fee schedule action name "${actionName}" contains invalid characters (must match reducer name pattern)`,
        'INVALID_ENTRY'
      );
    }

    if (typeof entry !== 'object' || entry === null) {
      throw new FeeScheduleError(
        `Fee schedule action "${actionName}" must be an object`,
        'INVALID_ENTRY'
      );
    }

    const entryObj = entry as Record<string, unknown>;

    // Validate cost field (required)
    if (!('cost' in entryObj)) {
      throw new FeeScheduleError(
        `Fee schedule action "${actionName}" missing required field: cost`,
        'MISSING_FIELD'
      );
    }
    if (typeof entryObj.cost !== 'number' || entryObj.cost < 0 || !Number.isFinite(entryObj.cost)) {
      throw new FeeScheduleError(
        `Fee schedule action "${actionName}" cost must be a non-negative finite number, got: ${String(entryObj.cost)}`,
        'INVALID_FIELD'
      );
    }

    // category and frequency are optional metadata (not validated strictly on BLS side)
  }

  return data as FeeSchedule;
}

/**
 * Load and validate a fee schedule from a JSON file.
 *
 * @param filePath - Path to the fee schedule JSON file
 * @returns Validated FeeSchedule
 * @throws {FeeScheduleError} If path traversal detected, file too large, or validation fails
 */
export function loadFeeSchedule(filePath: string): FeeSchedule {
  // Path traversal prevention (OWASP A03)
  if (filePath.includes('..')) {
    throw new FeeScheduleError(
      'Fee schedule path must not contain ".." segments (path traversal)',
      'PATH_TRAVERSAL'
    );
  }

  // Read file
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new FeeScheduleError(`Failed to read fee schedule file: ${message}`, 'FILE_READ_ERROR');
  }

  // File size check (OWASP A03)
  // Use Buffer.byteLength for accurate byte count (handles multi-byte UTF-8)
  const byteLength = Buffer.byteLength(content, 'utf-8');
  if (byteLength > MAX_FILE_SIZE) {
    throw new FeeScheduleError(
      `Fee schedule file exceeds maximum size of ${MAX_FILE_SIZE} bytes (got ${byteLength})`,
      'FILE_TOO_LARGE'
    );
  }

  // Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new FeeScheduleError('Fee schedule file contains invalid JSON', 'INVALID_JSON');
  }

  // Validate schema
  return validateFeeSchedule(data);
}

/**
 * Get the fee for a specific reducer from the fee schedule.
 *
 * @param schedule - The loaded fee schedule
 * @param reducerName - The reducer to look up (validated against regex)
 * @returns The cost for the reducer (or defaultCost if not found)
 */
export function getFeeForReducer(schedule: FeeSchedule, reducerName: string): number {
  // Validate reducer name
  if (!REDUCER_NAME_REGEX.test(reducerName)) {
    return schedule.defaultCost;
  }

  const entry = schedule.actions[reducerName];
  if (entry) {
    return entry.cost;
  }

  return schedule.defaultCost;
}
