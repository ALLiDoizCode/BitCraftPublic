/**
 * Decision Log Failure Tests (AC: 4)
 * Story 4.6: Structured Decision Logging
 *
 * Tests for failure logging: error code, boundary, message,
 * world state capture, and BudgetExceededError handling.
 * All file I/O is mocked via vitest.
 *
 * Test count: 7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecisionLogger } from '../decision-logger.js';
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
 * Creates a failure DecisionContext for testing.
 */
function createFailureContext(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    observation: 'Player attempted to harvest but failed',
    semanticEvents: [],
    skillTriggered: {
      name: 'harvest_wood',
      description: 'Harvest wood from nearby trees',
      matchContext: 'Player near oak tree',
    },
    action: {
      reducer: 'harvest_resource',
      args: ['oak1', 'wood'],
    },
    cost: 5,
    result: 'failure',
    outcome: 'Harvest failed: resource node depleted',
    error: {
      code: 'RESOURCE_DEPLETED',
      boundary: 'bls',
      message: 'Resource node oak1 has been fully depleted',
    },
    worldState: {
      playerPosition: { x: 100, y: 200 },
      nearbyResources: [],
      playerHealth: 85,
    },
    agentConfig: {
      agentMdVersion: 'v1.0-abc123',
      activeSkills: ['harvest_wood'],
    },
    decisionLatencyMs: 150,
    actionLatencyMs: 45,
    ...overrides,
  };
}

function createTestConfig(): DecisionLoggerConfig {
  return {
    filePath: '/tmp/failure-test.jsonl',
    maxFileSizeBytes: 100 * 1024 * 1024,
    rotationEnabled: true,
  };
}

/**
 * Helper to extract parsed entry from the last appendFile call.
 */
function getLastWrittenEntry(): DecisionLogEntry {
  const calls = vi.mocked(appendFile).mock.calls;
  const lastContent = calls[calls.length - 1][1] as string;
  return JSON.parse(lastContent.trim());
}

describe('Decision Log Failure Logging (Story 4.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stat).mockResolvedValue({ size: 0 } as any);
  });

  describe('AC4 - Failure logging', () => {
    it('failed action logged with error.code', async () => {
      // Given a failure context with error code
      const logger = new DecisionLogger(createTestConfig());

      // When the failure is logged
      await logger.logDecision(createFailureContext());

      // Then the entry includes the error code
      const entry = getLastWrittenEntry();
      expect(entry.error).toBeDefined();
      expect(entry.error!.code).toBe('RESOURCE_DEPLETED');
    });

    it('failed action logged with error.boundary', async () => {
      // Given a failure context with error boundary
      const logger = new DecisionLogger(createTestConfig());

      // When the failure is logged
      await logger.logDecision(createFailureContext());

      // Then the entry includes the error boundary
      const entry = getLastWrittenEntry();
      expect(entry.error!.boundary).toBe('bls');
    });

    it('failed action logged with error.message', async () => {
      // Given a failure context with error message
      const logger = new DecisionLogger(createTestConfig());

      // When the failure is logged
      await logger.logDecision(createFailureContext());

      // Then the entry includes the error message
      const entry = getLastWrittenEntry();
      expect(entry.error!.message).toBe('Resource node oak1 has been fully depleted');
    });

    it('failed action includes worldState capture', async () => {
      // Given a failure context with world state
      const logger = new DecisionLogger(createTestConfig());

      // When the failure is logged
      await logger.logDecision(createFailureContext());

      // Then the entry includes the world state
      const entry = getLastWrittenEntry();
      expect(entry.worldState).toBeDefined();
      expect(entry.worldState!.playerPosition).toEqual({ x: 100, y: 200 });
      expect(entry.worldState!.nearbyResources).toEqual([]);
      expect(entry.worldState!.playerHealth).toBe(85);
    });

    it('failed action result is failure', async () => {
      // Given a failure context
      const logger = new DecisionLogger(createTestConfig());

      // When the failure is logged
      await logger.logDecision(createFailureContext());

      // Then result is 'failure'
      const entry = getLastWrittenEntry();
      expect(entry.result).toBe('failure');
    });

    it('failed action entry is valid JSONL (parseable JSON)', async () => {
      // Given a failure context
      const logger = new DecisionLogger(createTestConfig());

      // When the failure is logged
      await logger.logDecision(createFailureContext());

      // Then the entire line is valid JSON
      const content = vi.mocked(appendFile).mock.calls[0][1] as string;
      expect(content.endsWith('\n')).toBe(true);
      expect(() => JSON.parse(content.trim())).not.toThrow();
    });

    it('BudgetExceededError logged with BUDGET_EXCEEDED code and boundary client', async () => {
      // Given a budget exceeded failure
      const logger = new DecisionLogger(createTestConfig());
      const context = createFailureContext({
        error: {
          code: 'BUDGET_EXCEEDED',
          boundary: 'client',
          message: 'Budget exhausted: 5 ILP exceeds remaining 2 ILP',
        },
        worldState: {
          budgetRemaining: 2,
          budgetLimit: 100,
          totalSpend: 98,
        },
      });

      // When the failure is logged
      await logger.logDecision(context);

      // Then the entry has BUDGET_EXCEEDED code and client boundary
      const entry = getLastWrittenEntry();
      expect(entry.error!.code).toBe('BUDGET_EXCEEDED');
      expect(entry.error!.boundary).toBe('client');
      expect(entry.error!.message).toContain('Budget exhausted');
      expect(entry.worldState!.budgetRemaining).toBe(2);
    });
  });
});
