/**
 * Decision Log Schema Tests (AC: 2, 5)
 * Story 4.6: Structured Decision Logging
 *
 * Tests that decision log entries conform to the expected schema:
 * required fields present, correct types, optional fields handled,
 * and each line is independently parseable JSON.
 *
 * Test count: 14
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
 * Creates a valid DecisionContext for testing.
 */
function createTestContext(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    observation: 'Player at hex (100,200)',
    semanticEvents: [
      {
        timestamp: 1710500000000,
        category: 'movement',
        narrative: 'Player moved to hex (100,200)',
        tableName: 'player_state',
        operationType: 'update',
        rawEvent: {
          table: 'player_state',
          type: 'update',
          timestamp: 1710500000000,
          oldRow: { x: 90, y: 200 },
          newRow: { x: 100, y: 200 },
        },
      },
    ],
    skillTriggered: {
      name: 'explore_area',
      description: 'Explore the surrounding area',
      matchContext: 'Player in unexplored region',
    },
    action: {
      reducer: 'player_move',
      args: [110, 200],
    },
    cost: 2,
    result: 'success',
    outcome: 'Moved to hex (110,200)',
    agentConfig: {
      agentMdVersion: 'v2.1-def456',
      activeSkills: ['explore_area', 'gather_resources'],
    },
    decisionLatencyMs: 120,
    actionLatencyMs: 30,
    ...overrides,
  };
}

function createTestConfig(): DecisionLoggerConfig {
  return {
    filePath: '/tmp/schema-test.jsonl',
    maxFileSizeBytes: 100 * 1024 * 1024,
    rotationEnabled: true,
  };
}

/**
 * Helper to extract the parsed entry from the last appendFile call.
 */
function getLastWrittenEntry(): DecisionLogEntry {
  const calls = vi.mocked(appendFile).mock.calls;
  const lastContent = calls[calls.length - 1][1] as string;
  return JSON.parse(lastContent.trim());
}

describe('Decision Log Schema (Story 4.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stat).mockResolvedValue({ size: 0 } as any);
  });

  describe('AC2 - JSONL format and required fields', () => {
    it('each log line is independently parseable as JSON', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When a decision is logged
      await logger.logDecision(createTestContext());

      // Then the written content is parseable JSON
      const content = vi.mocked(appendFile).mock.calls[0][1] as string;
      expect(() => JSON.parse(content.trim())).not.toThrow();
    });

    it('required fields are present: timestamp, observation, semanticEvents, skillTriggered, action, cost, result, outcome, agentConfig, metrics', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext());

      // Then all required fields are present
      const entry = getLastWrittenEntry();
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('observation');
      expect(entry).toHaveProperty('semanticEvents');
      expect(entry).toHaveProperty('skillTriggered');
      expect(entry).toHaveProperty('action');
      expect(entry).toHaveProperty('cost');
      expect(entry).toHaveProperty('result');
      expect(entry).toHaveProperty('outcome');
      expect(entry).toHaveProperty('agentConfig');
      expect(entry).toHaveProperty('metrics');
    });

    it('timestamp is ISO 8601 format', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext());

      // Then timestamp matches ISO 8601 pattern
      const entry = getLastWrittenEntry();
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(entry.timestamp).toMatch(isoRegex);
    });

    it('result is one of success, failure, skipped', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When logged with each result type
      await logger.logDecision(createTestContext({ result: 'success' }));
      await logger.logDecision(createTestContext({ result: 'failure' }));
      await logger.logDecision(createTestContext({ result: 'skipped' }));

      // Then each entry has the correct result
      const calls = vi.mocked(appendFile).mock.calls;
      expect(JSON.parse((calls[0][1] as string).trim()).result).toBe('success');
      expect(JSON.parse((calls[1][1] as string).trim()).result).toBe('failure');
      expect(JSON.parse((calls[2][1] as string).trim()).result).toBe('skipped');
    });

    it('agentConfig.activeSkills is string array', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext());

      // Then activeSkills is a string array
      const entry = getLastWrittenEntry();
      expect(Array.isArray(entry.agentConfig.activeSkills)).toBe(true);
      entry.agentConfig.activeSkills.forEach((skill) => {
        expect(typeof skill).toBe('string');
      });
    });

    it('metrics.decisionLatencyMs is non-negative number', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When logged
      await logger.logDecision(createTestContext({ decisionLatencyMs: 250 }));

      // Then decisionLatencyMs is a non-negative number
      const entry = getLastWrittenEntry();
      expect(typeof entry.metrics.decisionLatencyMs).toBe('number');
      expect(entry.metrics.decisionLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AC2/AC5 - Optional fields', () => {
    it('optional fields (error, worldState, metrics.actionLatencyMs) omitted when not applicable', async () => {
      // Given a context without error, worldState, or actionLatencyMs
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext();
      delete (context as any).actionLatencyMs;

      // When logged
      await logger.logDecision(context);

      // Then optional fields are absent
      const entry = getLastWrittenEntry();
      expect(entry.error).toBeUndefined();
      expect(entry.worldState).toBeUndefined();
      expect(entry.metrics.actionLatencyMs).toBeUndefined();
    });

    it('entry with error includes code, boundary, message', async () => {
      // Given a context with error details
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext({
        result: 'failure',
        error: {
          code: 'REDUCER_NOT_FOUND',
          boundary: 'bls',
          message: 'Reducer harvest_resource not found in module',
        },
      });

      // When logged
      await logger.logDecision(context);

      // Then error fields are present
      const entry = getLastWrittenEntry();
      expect(entry.error).toBeDefined();
      expect(entry.error!.code).toBe('REDUCER_NOT_FOUND');
      expect(entry.error!.boundary).toBe('bls');
      expect(entry.error!.message).toBe('Reducer harvest_resource not found in module');
    });

    it('entry with worldState includes Record<string, unknown>', async () => {
      // Given a context with world state
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext({
        result: 'failure',
        worldState: {
          playerPosition: { x: 100, y: 200 },
          nearbyResources: ['oak1', 'oak2'],
          inventoryCount: 15,
        },
      });

      // When logged
      await logger.logDecision(context);

      // Then worldState is preserved
      const entry = getLastWrittenEntry();
      expect(entry.worldState).toBeDefined();
      expect(entry.worldState!.playerPosition).toEqual({ x: 100, y: 200 });
      expect(entry.worldState!.nearbyResources).toEqual(['oak1', 'oak2']);
      expect(entry.worldState!.inventoryCount).toBe(15);
    });

    it('multiple sequential entries form valid JSONL (each line valid JSON)', async () => {
      // Given a logger
      const logger = new DecisionLogger(createTestConfig());

      // When multiple entries are logged
      await logger.logDecision(createTestContext({ observation: 'Entry 1' }));
      await logger.logDecision(createTestContext({ observation: 'Entry 2' }));
      await logger.logDecision(createTestContext({ observation: 'Entry 3' }));

      // Then each call produces independently parseable JSON
      const calls = vi.mocked(appendFile).mock.calls;
      expect(calls).toHaveLength(3);
      calls.forEach((call, index) => {
        const content = call[1] as string;
        const parsed = JSON.parse(content.trim());
        expect(parsed.observation).toBe(`Entry ${index + 1}`);
      });
    });
  });

  describe('AC5 - Reproducibility', () => {
    it('entry contains full input state for decision reproduction (observation + semanticEvents)', async () => {
      // Given a context with detailed observation and semantic events
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext({
        observation: 'Player at hex (100,200) with 3 nearby oak trees',
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
          {
            timestamp: 1710500001000,
            category: 'resource',
            narrative: 'Oak tree appeared at hex (101,200)',
            tableName: 'resource_state',
            operationType: 'insert',
            rawEvent: {
              table: 'resource_state',
              type: 'insert',
              timestamp: 1710500001000,
              newRow: { resource_id: 'oak2', x: 101, y: 200 },
            },
          },
        ],
      });

      // When logged
      await logger.logDecision(context);

      // Then the entry preserves the full input state for reproduction
      const entry = getLastWrittenEntry();
      expect(entry.observation).toBe('Player at hex (100,200) with 3 nearby oak trees');
      expect(entry.semanticEvents).toHaveLength(2);
      expect(entry.semanticEvents[0].narrative).toContain('Oak tree appeared');
      expect(entry.semanticEvents[1].narrative).toContain('Oak tree appeared');
      expect(entry.semanticEvents[0].rawEvent.newRow).toEqual({
        resource_id: 'oak1',
        x: 100,
        y: 200,
      });
    });

    it('entry contains skill invocation details and parameters for reproduction', async () => {
      // Given a context with complete skill and action details
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext({
        skillTriggered: {
          name: 'craft_item',
          description: 'Craft an item using gathered resources',
          matchContext: 'Player has 5 wood and 2 stone, crafting bench nearby',
        },
        action: {
          reducer: 'craft_item',
          args: ['wooden_sword', 3, true],
        },
      });

      // When logged
      await logger.logDecision(context);

      // Then the entry preserves skill invocation and parameters exactly
      const entry = getLastWrittenEntry();
      expect(entry.skillTriggered!.name).toBe('craft_item');
      expect(entry.skillTriggered!.description).toBe('Craft an item using gathered resources');
      expect(entry.skillTriggered!.matchContext).toBe(
        'Player has 5 wood and 2 stone, crafting bench nearby'
      );
      expect(entry.action!.reducer).toBe('craft_item');
      expect(entry.action!.args).toEqual(['wooden_sword', 3, true]);
    });

    it('entry contains agentConfig snapshot for experiment reproducibility', async () => {
      // Given a context with a specific agent config version and skill set
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext({
        agentConfig: {
          agentMdVersion: 'sha256-a1b2c3d4e5f6',
          activeSkills: ['harvest_wood', 'craft_item', 'build_shelter', 'explore_area'],
        },
      });

      // When logged
      await logger.logDecision(context);

      // Then the entry preserves the full agent config for reproducibility
      const entry = getLastWrittenEntry();
      expect(entry.agentConfig.agentMdVersion).toBe('sha256-a1b2c3d4e5f6');
      expect(entry.agentConfig.activeSkills).toEqual([
        'harvest_wood',
        'craft_item',
        'build_shelter',
        'explore_area',
      ]);
    });

    it('entry contains complete decision cycle for end-to-end reproduction', async () => {
      // Given a complete decision context with all reproducibility fields
      const logger = new DecisionLogger(createTestConfig());
      const context = createTestContext({
        observation: 'Player at (50,75) with low health',
        semanticEvents: [
          {
            timestamp: 1710500000000,
            category: 'combat',
            narrative: 'Player health dropped to 20',
            tableName: 'player_state',
            operationType: 'update',
            rawEvent: {
              table: 'player_state',
              type: 'update',
              timestamp: 1710500000000,
              oldRow: { health: 50 },
              newRow: { health: 20 },
            },
          },
        ],
        skillTriggered: {
          name: 'heal_self',
          description: 'Use healing item to restore health',
          matchContext: 'Health below 25%, healing potion in inventory',
        },
        action: { reducer: 'use_item', args: ['healing_potion', 1] },
        cost: 3,
        result: 'success',
        outcome: 'Healed 30 HP, health now 50',
        agentConfig: {
          agentMdVersion: 'v2.0-experiment-42',
          activeSkills: ['heal_self', 'flee_combat'],
        },
        decisionLatencyMs: 85,
        actionLatencyMs: 22,
      });

      // When logged
      await logger.logDecision(context);

      // Then all fields needed for reproduction are present and correct
      const entry = getLastWrittenEntry();
      // Input state
      expect(entry.observation).toBe('Player at (50,75) with low health');
      expect(entry.semanticEvents).toHaveLength(1);
      // Skill invocation
      expect(entry.skillTriggered!.name).toBe('heal_self');
      expect(entry.skillTriggered!.matchContext).toContain('Health below 25%');
      // Parameters chosen
      expect(entry.action!.reducer).toBe('use_item');
      expect(entry.action!.args).toEqual(['healing_potion', 1]);
      // Outcome
      expect(entry.result).toBe('success');
      expect(entry.outcome).toBe('Healed 30 HP, health now 50');
      // Config snapshot
      expect(entry.agentConfig.agentMdVersion).toBe('v2.0-experiment-42');
      expect(entry.agentConfig.activeSkills).toEqual(['heal_self', 'flee_combat']);
      // Timing for benchmarks
      expect(entry.metrics.decisionLatencyMs).toBe(85);
      expect(entry.metrics.actionLatencyMs).toBe(22);
    });
  });
});
