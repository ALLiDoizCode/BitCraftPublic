/**
 * Decision Logger Unit Tests (AC: 1, 2)
 * Story 4.6: Structured Decision Logging
 *
 * Tests for DecisionLogger class: logDecision() creates valid JSONL entries
 * with all required fields, append-only semantics, and proper serialization.
 * All file I/O is mocked via vitest.
 *
 * Test count: 21
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecisionLogger, createDecisionLogger } from '../decision-logger.js';
import type {
  DecisionContext,
  DecisionLogEntry,
  DecisionLoggerConfig,
} from '../decision-log-types.js';

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
  rename: vi.fn().mockResolvedValue(undefined),
}));

import { appendFile, stat } from 'node:fs/promises';

/**
 * Creates a valid DecisionContext for testing.
 */
function createTestContext(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    observation: 'Player is near an oak tree',
    semanticEvents: [
      {
        timestamp: 1710500000000,
        category: 'resource',
        narrative: 'Oak tree appeared at hex (100,200)',
        tableName: 'resource_state',
        operationType: 'insert',
        rawEvent: {
          table: 'resource_state',
          type: 'insert',
          timestamp: 1710500000000,
          newRow: { resource_id: 'oak1', x: 100, y: 200 },
        },
      },
    ],
    skillTriggered: {
      name: 'harvest_wood',
      description: 'Harvest wood from nearby trees',
      matchContext: 'Player near oak tree with axe equipped',
    },
    action: {
      reducer: 'harvest_resource',
      args: ['oak1', 'wood'],
    },
    cost: 5,
    result: 'success',
    outcome: 'Successfully harvested 3 wood from oak tree',
    agentConfig: {
      agentMdVersion: 'v1.0-abc123',
      activeSkills: ['harvest_wood', 'build_shelter', 'explore'],
    },
    decisionLatencyMs: 150,
    actionLatencyMs: 45,
    ...overrides,
  };
}

/**
 * Creates a default DecisionLoggerConfig for testing.
 */
function createTestConfig(overrides?: Partial<DecisionLoggerConfig>): DecisionLoggerConfig {
  return {
    filePath: '/tmp/test-decisions.jsonl',
    maxFileSizeBytes: 100 * 1024 * 1024,
    rotationEnabled: true,
    ...overrides,
  };
}

describe('DecisionLogger (Story 4.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stat).mockResolvedValue({ size: 0 } as any);
  });

  describe('AC1 - Decision log entry structure', () => {
    it('logDecision() creates valid JSONL entry with all required fields', async () => {
      // Given a DecisionLogger with a valid config
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext();

      // When a decision is logged
      await logger.logDecision(context);

      // Then appendFile is called with valid JSON containing all required fields
      expect(appendFile).toHaveBeenCalledOnce();
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());

      expect(entry.timestamp).toBeDefined();
      expect(entry.observation).toBe('Player is near an oak tree');
      expect(entry.semanticEvents).toHaveLength(1);
      expect(entry.skillTriggered).toBeDefined();
      expect(entry.action).toBeDefined();
      expect(entry.cost).toBe(5);
      expect(entry.result).toBe('success');
      expect(entry.outcome).toBe('Successfully harvested 3 wood from oak tree');
      expect(entry.agentConfig).toBeDefined();
      expect(entry.metrics).toBeDefined();
    });

    it('logDecision() sets ISO 8601 timestamp', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When a decision is logged
      await logger.logDecision(createTestContext());

      // Then the timestamp is valid ISO 8601
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      const parsed = new Date(entry.timestamp);
      expect(parsed.toISOString()).toBe(entry.timestamp);
    });

    it('logDecision() includes observation summary', async () => {
      // Given a context with a specific observation
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext({ observation: 'Enemy approaching from the north' });

      // When logged
      await logger.logDecision(context);

      // Then the observation is preserved
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.observation).toBe('Enemy approaching from the north');
    });

    it('logDecision() includes semantic events array', async () => {
      // Given a context with semantic events
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext();

      // When logged
      await logger.logDecision(context);

      // Then semanticEvents is included as array
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(Array.isArray(entry.semanticEvents)).toBe(true);
      expect(entry.semanticEvents[0].narrative).toContain('Oak tree');
    });

    it('logDecision() includes skillTriggered with name, description, matchContext', async () => {
      // Given a context with a triggered skill
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext());

      // Then skillTriggered contains name, description, and matchContext
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.skillTriggered).not.toBeNull();
      expect(entry.skillTriggered!.name).toBe('harvest_wood');
      expect(entry.skillTriggered!.description).toBe('Harvest wood from nearby trees');
      expect(entry.skillTriggered!.matchContext).toBe('Player near oak tree with axe equipped');
    });

    it('logDecision() includes action with reducer and args', async () => {
      // Given a context with an action
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext());

      // Then action contains reducer and args
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.action).not.toBeNull();
      expect(entry.action!.reducer).toBe('harvest_resource');
      expect(entry.action!.args).toEqual(['oak1', 'wood']);
    });

    it('logDecision() includes cost from action cost registry', async () => {
      // Given a context with a cost
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext({ cost: 42 }));

      // Then cost is preserved
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.cost).toBe(42);
    });

    it('logDecision() includes result (success | failure | skipped)', async () => {
      // Given a context with result
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext({ result: 'failure' }));

      // Then result is preserved
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.result).toBe('failure');
    });

    it('logDecision() includes outcome string', async () => {
      // Given a context with outcome
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext({ outcome: 'Harvest completed' }));

      // Then outcome is preserved
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.outcome).toBe('Harvest completed');
    });

    it('logDecision() includes agentConfig with version and active skills', async () => {
      // Given a context with agent config
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext());

      // Then agentConfig is preserved
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.agentConfig.agentMdVersion).toBe('v1.0-abc123');
      expect(entry.agentConfig.activeSkills).toEqual(['harvest_wood', 'build_shelter', 'explore']);
    });

    it('logDecision() includes metrics with decisionLatencyMs', async () => {
      // Given a context with timing metrics
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext({ decisionLatencyMs: 200, actionLatencyMs: 50 }));

      // Then metrics are preserved
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.metrics.decisionLatencyMs).toBe(200);
      expect(entry.metrics.actionLatencyMs).toBe(50);
    });
  });

  describe('AC1 - Null field handling', () => {
    it('logDecision() with null skillTriggered (no skill matched)', async () => {
      // Given a context where no skill matched
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext({ skillTriggered: null }));

      // Then skillTriggered is null in the entry
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.skillTriggered).toBeNull();
    });

    it('logDecision() with null action (decision skipped)', async () => {
      // Given a context where no action was taken
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext({ action: null, result: 'skipped' }));

      // Then action is null in the entry
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.action).toBeNull();
      expect(entry.result).toBe('skipped');
    });

    it('logDecision() with null cost (action skipped)', async () => {
      // Given a context where cost is null
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext({ cost: null }));

      // Then cost is null in the entry
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      const entry: DecisionLogEntry = JSON.parse(writtenContent.trim());
      expect(entry.cost).toBeNull();
    });
  });

  describe('AC2 - Append-only JSONL format', () => {
    it('logDecision() serializes each entry as single-line JSON (no newlines within entry)', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When a decision is logged
      await logger.logDecision(createTestContext());

      // Then the written content is single-line JSON followed by newline
      const writtenContent = vi.mocked(appendFile).mock.calls[0][1] as string;
      expect(writtenContent.endsWith('\n')).toBe(true);
      const jsonLine = writtenContent.trim();
      expect(jsonLine.includes('\n')).toBe(false);
      // Verify it is valid JSON
      expect(() => JSON.parse(jsonLine)).not.toThrow();
    });

    it('multiple logDecision() calls append multiple lines to same file', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When multiple decisions are logged
      await logger.logDecision(createTestContext({ observation: 'Event 1' }));
      await logger.logDecision(createTestContext({ observation: 'Event 2' }));
      await logger.logDecision(createTestContext({ observation: 'Event 3' }));

      // Then appendFile is called 3 times with the same file path
      expect(appendFile).toHaveBeenCalledTimes(3);
      const calls = vi.mocked(appendFile).mock.calls;
      expect(calls[0][0]).toBe('/tmp/test-decisions.jsonl');
      expect(calls[1][0]).toBe('/tmp/test-decisions.jsonl');
      expect(calls[2][0]).toBe('/tmp/test-decisions.jsonl');

      // And each call writes a separate valid JSON line
      for (const call of calls) {
        const content = call[1] as string;
        expect(() => JSON.parse(content.trim())).not.toThrow();
      }
    });

    it('logDecision() silently swallows file I/O errors (agent must not crash)', async () => {
      // Given a logger where appendFile throws
      vi.mocked(appendFile).mockRejectedValueOnce(new Error('ENOSPC: no space left'));
      const logger = new DecisionLogger(createTestConfig());

      // When a decision is logged
      // Then it does NOT throw
      await expect(logger.logDecision(createTestContext())).resolves.toBeUndefined();
    });
  });

  describe('createDecisionLogger factory', () => {
    it('createDecisionLogger() applies default config values', () => {
      // Given only a filePath
      const logger = createDecisionLogger({ filePath: '/tmp/decisions.jsonl' });

      // Then the logger is created successfully (defaults applied)
      expect(logger).toBeInstanceOf(DecisionLogger);
    });

    it('DecisionLogger constructor rejects empty filePath', () => {
      // Given an empty filePath
      // When creating a logger -> throws
      expect(() => new DecisionLogger(createTestConfig({ filePath: '' }))).toThrow(
        'DecisionLogger filePath cannot be empty'
      );
    });
  });

  describe('Write serialization (_writeQueue)', () => {
    it('concurrent logDecision() calls are serialized and all complete without error', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When multiple decisions are fired concurrently (not awaited sequentially)
      const promises = [
        logger.logDecision(createTestContext({ observation: 'Concurrent 1' })),
        logger.logDecision(createTestContext({ observation: 'Concurrent 2' })),
        logger.logDecision(createTestContext({ observation: 'Concurrent 3' })),
      ];

      // Then all resolve without error
      await expect(Promise.all(promises)).resolves.toBeDefined();

      // And all 3 entries are written (serialized via _writeQueue)
      expect(appendFile).toHaveBeenCalledTimes(3);
    });

    it('write queue continues functioning after a failed write', async () => {
      // Given a logger where the first write fails
      vi.mocked(appendFile)
        .mockRejectedValueOnce(new Error('disk full'))
        .mockResolvedValue(undefined);
      const logger = new DecisionLogger(createTestConfig());

      // When multiple decisions are logged sequentially
      await logger.logDecision(createTestContext({ observation: 'Will fail' }));
      await logger.logDecision(createTestContext({ observation: 'Should succeed' }));

      // Then the second write still succeeds (queue chain is not broken)
      expect(appendFile).toHaveBeenCalledTimes(2);
      const secondContent = vi.mocked(appendFile).mock.calls[1][1] as string;
      const entry: DecisionLogEntry = JSON.parse(secondContent.trim());
      expect(entry.observation).toBe('Should succeed');
    });
  });
});
