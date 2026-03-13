/**
 * Content Parser for Game Action Events
 *
 * Parses Nostr event content JSON to extract reducer name and arguments.
 * Applies strict validation to prevent injection attacks (OWASP A03):
 * - Reducer name: alphanumeric + underscore, 1-64 chars
 * - Args: must be an array
 * - Content size: max 1MB
 *
 * @module content-parser
 */

/**
 * Maximum content size in characters (1MB equivalent).
 * Protects against oversized payload attacks.
 * Uses string length (characters) as a fast approximation.
 * For game action JSON payloads (ASCII), characters === bytes.
 */
const MAX_CONTENT_SIZE = 1024 * 1024; // 1MB

/**
 * Regex for valid reducer names: starts with a letter or underscore,
 * followed by 0-63 alphanumeric or underscore characters.
 * Prevents path traversal, SQL injection, and command injection (OWASP A03).
 */
const REDUCER_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

/**
 * Parsed content from a Nostr game action event.
 */
export interface ParsedContent {
  /** The SpacetimeDB reducer name to call */
  reducer: string;
  /** The arguments to pass to the reducer */
  args: unknown[];
}

/**
 * Error thrown when event content parsing fails.
 * Includes an error code for ILP error mapping.
 */
export class ContentParseError extends Error {
  /** Error code for ILP mapping (always 'CONTENT_PARSE_ERROR') */
  readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = 'ContentParseError';
    this.code = 'CONTENT_PARSE_ERROR';
  }
}

/**
 * Parse event content JSON to extract reducer name and arguments.
 *
 * @param content - The raw content string from a Nostr event
 * @returns Parsed content with reducer name and args array
 * @throws {ContentParseError} If content is invalid, too large, or contains invalid reducer name
 */
export function parseEventContent(content: string): ParsedContent {
  // Check content size limit (OWASP A03: oversized payload protection)
  if (content.length > MAX_CONTENT_SIZE) {
    throw new ContentParseError(
      `Content exceeds maximum size of ${MAX_CONTENT_SIZE} characters (got ${content.length})`
    );
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ContentParseError('Invalid event content: malformed JSON');
  }

  // Validate parsed value is an object
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ContentParseError('Invalid event content: expected JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  // Validate reducer field
  if (!('reducer' in obj)) {
    throw new ContentParseError('Invalid event content: missing reducer or args');
  }

  if (typeof obj.reducer !== 'string') {
    throw new ContentParseError('Invalid event content: reducer must be a string');
  }

  if (obj.reducer === '') {
    throw new ContentParseError('Invalid event content: reducer must not be empty');
  }

  // Validate reducer name against strict regex (OWASP A03: injection prevention)
  if (!REDUCER_NAME_REGEX.test(obj.reducer)) {
    // Truncate echoed reducer name to prevent verbose error messages from long inputs
    const displayName = obj.reducer.length > 64 ? obj.reducer.slice(0, 64) + '...' : obj.reducer;
    throw new ContentParseError(
      `Invalid event content: reducer name contains invalid characters: ${displayName}`
    );
  }

  // Validate args field
  if (!('args' in obj)) {
    throw new ContentParseError('Invalid event content: missing reducer or args');
  }

  if (!Array.isArray(obj.args)) {
    throw new ContentParseError('Invalid event content: args must be an array');
  }

  return {
    reducer: obj.reducer,
    args: obj.args as unknown[],
  };
}
