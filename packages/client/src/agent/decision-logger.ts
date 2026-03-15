/**
 * Decision Logger
 * Story 4.6: Structured Decision Logging
 *
 * Standalone DecisionLogger class that captures the full agent decision cycle
 * (perceive -> interpret -> decide -> act) as append-only JSONL log entries.
 * The logger receives a complete DecisionContext after each decision cycle
 * and appends a structured entry to the configured JSONL file.
 *
 * The DecisionLogger is NOT an EventEmitter. It is a simple append-only writer.
 * File I/O errors are caught and silently swallowed -- the agent must not crash
 * because logging failed.
 *
 * Concurrent writes are serialized via a promise queue (_writeQueue) to prevent
 * interleaving from concurrent fs.appendFile() calls.
 *
 * @module agent/decision-logger
 */

import { appendFile, stat, rename } from 'node:fs/promises';
import type {
  DecisionContext,
  DecisionLogEntry,
  DecisionLoggerConfig,
} from './decision-log-types.js';

/**
 * DecisionLogger appends structured JSONL decision log entries to a file.
 *
 * Each `logDecision()` call writes immediately (no buffering/batching).
 * Concurrent writes are serialized via promise chaining.
 * Log rotation is triggered when the file exceeds `maxFileSizeBytes`.
 *
 * @example
 * ```typescript
 * const logger = createDecisionLogger({ filePath: './decisions.jsonl' });
 * await logger.logDecision({
 *   observation: 'Player near oak tree',
 *   semanticEvents: [...],
 *   skillTriggered: { name: 'harvest_wood', description: '...', matchContext: '...' },
 *   action: { reducer: 'harvest_resource', args: ['oak1'] },
 *   cost: 5,
 *   result: 'success',
 *   outcome: 'Harvested 3 wood',
 *   agentConfig: { agentMdVersion: 'v1.0', activeSkills: ['harvest_wood'] },
 *   decisionLatencyMs: 150,
 *   actionLatencyMs: 45,
 * });
 * ```
 */
export class DecisionLogger {
  private readonly config: DecisionLoggerConfig;
  /** Promise chain for serializing concurrent writes */
  private _writeQueue: Promise<void> = Promise.resolve();

  /**
   * Creates a new DecisionLogger.
   *
   * @param config - Logger configuration
   * @throws Error if filePath is empty
   */
  constructor(config: DecisionLoggerConfig) {
    if (!config.filePath) {
      throw new Error('DecisionLogger filePath cannot be empty');
    }
    this.config = config;
  }

  /**
   * Logs a decision by appending a structured JSONL entry to the log file.
   *
   * Each call chains onto the _writeQueue to serialize concurrent writes.
   * File I/O errors are caught and silently swallowed -- the agent must
   * not crash due to logging failure.
   *
   * @param context - The decision context to log
   */
  async logDecision(context: DecisionContext): Promise<void> {
    const writePromise = this._writeQueue.then(() => this._doWrite(context));
    // Chain onto the queue, catching errors so the chain never breaks
    this._writeQueue = writePromise.catch(() => {
      // Silently swallow -- errors are handled inside _doWrite
    });
    // Await this specific write, catching errors defensively so logDecision() never throws
    await writePromise.catch(() => {
      // Silently swallow -- agent must not crash due to logging failure
    });
  }

  /**
   * Rotates the current log file by renaming it with an ISO timestamp suffix.
   *
   * The rotated file name replaces `.jsonl` with `-{ISO timestamp}.jsonl`
   * where colons are replaced with hyphens for filesystem safety.
   * The old file is preserved (never deleted).
   */
  async rotateLog(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
      const rotatedPath = this.config.filePath.replace(/\.jsonl$/, `-${timestamp}.jsonl`);
      await rename(this.config.filePath, rotatedPath);
    } catch {
      // Catch and log a warning. Continue writing to the current file.
      // istanbul ignore next -- defensive logging, not testable via unit tests
    }
  }

  /**
   * Returns the current file size in bytes.
   *
   * @returns File size in bytes, or 0 if the file does not exist (ENOENT)
   */
  async getFileSize(): Promise<number> {
    try {
      const stats = await stat(this.config.filePath);
      return stats.size;
    } catch (error: unknown) {
      // ENOENT: file does not exist -> return 0
      if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return 0;
      }
      // For other errors, return 0 defensively
      return 0;
    }
  }

  /**
   * Internal write implementation. Builds the DecisionLogEntry from context,
   * checks file size for rotation, and appends the serialized entry.
   */
  private async _doWrite(context: DecisionContext): Promise<void> {
    try {
      // Build DecisionLogEntry from context
      const entry: DecisionLogEntry = {
        timestamp: new Date().toISOString(),
        observation: context.observation,
        semanticEvents: context.semanticEvents,
        skillTriggered: context.skillTriggered,
        action: context.action,
        cost: context.cost,
        result: context.result,
        outcome: context.outcome,
        agentConfig: context.agentConfig,
        metrics: {
          decisionLatencyMs: context.decisionLatencyMs,
          ...(context.actionLatencyMs !== undefined && {
            actionLatencyMs: context.actionLatencyMs,
          }),
        },
      };

      // Include optional fields only when present
      if (context.error) {
        entry.error = context.error;
      }
      if (context.worldState) {
        entry.worldState = context.worldState;
      }

      // Check file size for rotation (if enabled)
      if (this.config.rotationEnabled) {
        const fileSize = await this.getFileSize();
        if (fileSize > this.config.maxFileSizeBytes) {
          await this.rotateLog();
        }
      }

      // Serialize as single-line JSON and append
      const line = JSON.stringify(entry) + '\n';
      await appendFile(this.config.filePath, line, 'utf-8');
    } catch {
      // Silently swallow file I/O errors -- agent must not crash due to logging failure
    }
  }
}

/**
 * Factory function that creates a DecisionLogger with config defaults.
 *
 * @param config - Partial config (filePath required, others have defaults)
 * @returns A configured DecisionLogger instance
 */
export function createDecisionLogger(
  config: Partial<DecisionLoggerConfig> & { filePath: string }
): DecisionLogger {
  const resolvedConfig: DecisionLoggerConfig = {
    filePath: config.filePath,
    maxFileSizeBytes: config.maxFileSizeBytes ?? 100 * 1024 * 1024,
    rotationEnabled: config.rotationEnabled ?? true,
  };
  return new DecisionLogger(resolvedConfig);
}
