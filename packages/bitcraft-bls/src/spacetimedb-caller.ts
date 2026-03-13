/**
 * SpacetimeDB HTTP Caller
 *
 * Makes HTTP POST requests to SpacetimeDB to execute game reducers.
 * Uses Node.js built-in fetch (Node 20+) with AbortController timeout.
 *
 * SECURITY (OWASP A02): The SpacetimeDB token is NEVER logged or included
 * in error messages. It is only used in the Authorization header.
 *
 * @module spacetimedb-caller
 */

/**
 * Default timeout for SpacetimeDB HTTP calls (30 seconds).
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Configuration for the SpacetimeDB HTTP caller.
 */
export interface SpacetimeDBCallerConfig {
  /** SpacetimeDB HTTP endpoint URL (e.g., 'http://localhost:3000') */
  url: string;
  /** SpacetimeDB database name (e.g., 'bitcraft') */
  database: string;
  /** SpacetimeDB admin authentication token (NEVER logged -- OWASP A02) */
  token: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

/**
 * Result of a reducer call.
 */
export interface ReducerResult {
  /** Whether the reducer call succeeded */
  success: boolean;
  /** Error message if the call failed */
  error?: string;
  /** HTTP status code */
  statusCode: number;
}

/**
 * Error thrown when a SpacetimeDB reducer call fails.
 */
export class ReducerCallError extends Error {
  /** Error code: 'UNKNOWN_REDUCER' or 'REDUCER_FAILED' */
  readonly code: string;
  /** HTTP status code (0 for network errors/timeouts) */
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'ReducerCallError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Call a SpacetimeDB reducer via HTTP POST.
 *
 * The caller is responsible for prepending the pubkey to the args array
 * before calling this function.
 *
 * @param config - SpacetimeDB caller configuration
 * @param reducer - The reducer name to call
 * @param args - The arguments to pass (already includes prepended pubkey)
 * @returns Reducer result on success
 * @throws {ReducerCallError} On HTTP errors, timeouts, or network failures
 */
export async function callReducer(
  config: SpacetimeDBCallerConfig,
  reducer: string,
  args: unknown[]
): Promise<ReducerResult> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${config.url}/database/${config.database}/call/${reducer}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });

    // MUST clearTimeout on successful fetch to prevent timer leak
    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, statusCode: response.status };
    }

    // Read response body for error details (if available)
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      // Ignore body read errors
    }

    if (response.status === 404) {
      throw new ReducerCallError(`Unknown reducer: ${reducer}`, 'UNKNOWN_REDUCER', 404);
    }

    // 400, 500, and other error status codes
    // Truncate error body to prevent verbose/sensitive info leakage (max 256 chars)
    const truncatedBody = errorBody.length > 256 ? errorBody.slice(0, 256) + '...' : errorBody;
    const errorDetail = truncatedBody ? `: ${truncatedBody}` : '';
    throw new ReducerCallError(
      `Reducer ${reducer} failed${errorDetail}`,
      'REDUCER_FAILED',
      response.status
    );
  } catch (err: unknown) {
    // Always clear the timeout to prevent leaks
    clearTimeout(timeoutId);

    // Re-throw ReducerCallError as-is
    if (err instanceof ReducerCallError) {
      throw err;
    }

    // Handle AbortError (timeout)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ReducerCallError(
        `Reducer ${reducer} timed out after ${timeoutMs}ms`,
        'REDUCER_FAILED',
        0
      );
    }

    // Handle network errors and other unexpected failures
    const message = err instanceof Error ? err.message : String(err);
    throw new ReducerCallError(`Reducer ${reducer} failed: ${message}`, 'REDUCER_FAILED', 0);
  }
}
