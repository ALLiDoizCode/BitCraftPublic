/**
 * Structured Logging Interface
 * ACTION-E3-3: Define structured logging pattern for BLS handler
 *
 * Defines the structured logging interface for server-side components.
 * Current implementation wraps console.log/console.error with structured
 * JSON output. Epic 8 will replace this with a production logging library
 * (e.g., pino, winston) while preserving the same interface.
 *
 * Design decisions:
 * - JSON output format for machine-parseable logs
 * - Log levels: debug, info, warn, error
 * - Structured context fields (component, eventId, pubkey, reducer, duration)
 * - Pubkey always truncated in logs (OWASP A02)
 * - No private keys or tokens in log output (OWASP A02)
 * - Correlation via eventId field
 *
 * @module logger
 */

import { truncatePubkey } from './utils.js';

/**
 * Log levels in order of severity.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry fields.
 * All fields are optional except level and message.
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Human-readable message */
  message: string;
  /** Component that generated the log (e.g., 'bls', 'handler', 'health') */
  component?: string;
  /** Nostr event ID for correlation */
  eventId?: string;
  /** Truncated pubkey (NEVER the full pubkey) */
  pubkey?: string;
  /** Reducer name */
  reducer?: string;
  /** Operation duration in milliseconds */
  durationMs?: number;
  /** ILP error code */
  errorCode?: string;
  /** Error message */
  error?: string;
  /** ISO 8601 timestamp */
  timestamp?: string;
  /** Additional structured data */
  [key: string]: unknown;
}

/**
 * Structured logger interface.
 * Server-side components use this interface for all logging.
 * Epic 8 will provide alternative implementations (pino, etc.)
 */
export interface Logger {
  debug(message: string, context?: Partial<LogEntry>): void;
  info(message: string, context?: Partial<LogEntry>): void;
  warn(message: string, context?: Partial<LogEntry>): void;
  error(message: string, context?: Partial<LogEntry>): void;
}

/**
 * Create a structured logger that outputs JSON to console.
 *
 * This is the default implementation for MVP. Each log line is a single
 * JSON object with a consistent schema, enabling log aggregation tools
 * (CloudWatch, Datadog, etc.) to parse and index fields automatically.
 *
 * @param component - Default component name for all log entries
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger('handler');
 * logger.info('Action succeeded', {
 *   eventId: event.id,
 *   pubkey: ctx.pubkey,  // Will be auto-truncated
 *   reducer: 'player_move',
 *   durationMs: 42,
 * });
 * // Output: {"level":"info","message":"Action succeeded","component":"handler",
 * //          "eventId":"...","pubkey":"32e18276...e245","reducer":"player_move",
 * //          "durationMs":42,"timestamp":"2026-03-14T...Z"}
 * ```
 */
export function createLogger(component: string): Logger {
  const writeLog = (level: LogLevel, message: string, context?: Partial<LogEntry>): void => {
    const entry: LogEntry = {
      level,
      message,
      component,
      timestamp: new Date().toISOString(),
      ...context,
    };

    // Auto-truncate pubkey if present (OWASP A02: never log full pubkeys)
    if (entry.pubkey && typeof entry.pubkey === 'string' && entry.pubkey.length > 12) {
      entry.pubkey = truncatePubkey(entry.pubkey);
    }

    const line = JSON.stringify(entry);

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (message, context) => writeLog('debug', message, context),
    info: (message, context) => writeLog('info', message, context),
    warn: (message, context) => writeLog('warn', message, context),
    error: (message, context) => writeLog('error', message, context),
  };
}
