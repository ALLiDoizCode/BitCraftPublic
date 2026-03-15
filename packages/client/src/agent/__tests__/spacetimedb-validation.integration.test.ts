/**
 * SpacetimeDB Validation Integration Tests (AC: 1, 3, 4)
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Tests against the live Docker stack SpacetimeDB instance.
 * Requires: docker compose up (bitcraft-server at http://localhost:3000)
 * Conditional execution: describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)
 *
 * NOTE: Reducer and table names used below are based on prototype skill files.
 * The actual BitCraft module may use different names. The first integration test
 * run MUST verify these names against the live module and update expectations.
 *
 * Validates: AC1 (reducer existence), AC3 (table existence), AC4 (full validation pipeline)
 *
 * Test count: 10
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SpacetimeDBModuleInfoFetcher } from '../module-info-fetcher.js';
import { validateAgentConfig } from '../config-validator.js';
import type { Skill } from '../types.js';
import type { ModuleInfo } from '../config-validation-types.js';
import type { ResolvedAgentConfig } from '../agent-config-types.js';
import { SkillRegistry } from '../skill-registry.js';

const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

const SPACETIMEDB_URL = process.env.SPACETIMEDB_URL || 'http://localhost:3000';
const SPACETIMEDB_DATABASE = process.env.SPACETIMEDB_DATABASE || 'bitcraft';

/**
 * Helper to create a minimal Skill object for testing.
 */
function createSkill(overrides: Partial<Skill> & { name: string; reducer: string }): Skill {
  return {
    description: `Test skill ${overrides.name}`,
    params: [],
    subscriptions: [],
    body: '',
    evals: [],
    ...overrides,
  };
}

/**
 * Helper to create a ResolvedAgentConfig from skills.
 */
function createResolvedConfig(skills: Skill[]): ResolvedAgentConfig {
  const registry = new SkillRegistry();
  for (const skill of skills) {
    registry.register(skill);
  }
  return {
    name: 'integration-test-agent',
    skillNames: skills.map((s) => s.name),
    skills,
    skillRegistry: registry,
  };
}

describe.skipIf(!runIntegrationTests)(
  'SpacetimeDB Validation Integration Tests (Story 4.3)',
  () => {
    let fetcher: SpacetimeDBModuleInfoFetcher;
    let moduleInfo: ModuleInfo;

    beforeAll(async () => {
      fetcher = new SpacetimeDBModuleInfoFetcher({
        url: SPACETIMEDB_URL,
        database: SPACETIMEDB_DATABASE,
      });
      moduleInfo = await fetcher.getModuleInfo();
    });

    it('module info fetch succeeds and returns non-empty reducer and table lists', () => {
      // Given the live Docker stack
      // When module info was fetched in beforeAll
      // Then it should have reducers and tables
      expect(moduleInfo.reducers.length).toBeGreaterThan(0);
      expect(moduleInfo.tables.length).toBeGreaterThan(0);
    });

    it('player_move reducer exists in live BitCraft module', () => {
      // Given the live module info
      // When checking for player_move
      const found = moduleInfo.reducers.find((r) => r.name === 'player_move');

      // Then it should exist
      expect(found).toBeDefined();
    });

    it('harvest_start reducer exists in live module', () => {
      // Given the live module info
      // When checking for harvest_start
      const found = moduleInfo.reducers.find((r) => r.name === 'harvest_start');

      // Then it should exist
      expect(found).toBeDefined();
    });

    it('craft_item reducer exists in live module', () => {
      // Given the live module info
      // When checking for craft_item
      const found = moduleInfo.reducers.find((r) => r.name === 'craft_item');

      // Then it should exist
      expect(found).toBeDefined();
    });

    it('player_state table exists in live module', () => {
      // Given the live module info
      // When checking for player_state
      const found = moduleInfo.tables.includes('player_state');

      // Then it should exist
      expect(found).toBe(true);
    });

    it('terrain table exists in live module', () => {
      // Given the live module info
      const found = moduleInfo.tables.includes('terrain');
      expect(found).toBe(true);
    });

    it('inventory table exists in live module', () => {
      // Given the live module info
      const found = moduleInfo.tables.includes('inventory');
      expect(found).toBe(true);
    });

    it('module info includes expected reducer parameter signatures', () => {
      // Given the live module info
      // When checking player_move reducer params
      const playerMove = moduleInfo.reducers.find((r) => r.name === 'player_move');

      // Then it should have params
      expect(playerMove).toBeDefined();
      expect(playerMove!.params.length).toBeGreaterThan(0);
      // First param should be identity (String)
      expect(playerMove!.params[0].type).toBe('String');
    });

    it('full validation pipeline: load 3 prototype skills, validate against live module', async () => {
      // Given 3 prototype skills
      const skills: Skill[] = [
        createSkill({
          name: 'player_move',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X' },
            { name: 'target_y', type: 'i32', description: 'Y' },
          ],
          subscriptions: [
            { table: 'player_state', description: 'State' },
            { table: 'terrain', description: 'Terrain' },
          ],
        }),
        createSkill({
          name: 'harvest_resource',
          reducer: 'harvest_start',
          params: [{ name: 'resource_id', type: 'u64', description: 'Resource node ID' }],
          subscriptions: [
            { table: 'player_state', description: 'State' },
            { table: 'resource_node', description: 'Resources' },
          ],
        }),
        createSkill({
          name: 'craft_item',
          reducer: 'craft_item',
          params: [
            { name: 'recipe_id', type: 'u64', description: 'Recipe ID' },
            { name: 'quantity', type: 'u32', description: 'Quantity' },
          ],
          subscriptions: [
            { table: 'player_state', description: 'State' },
            { table: 'inventory', description: 'Inventory' },
          ],
        }),
      ];
      const config = createResolvedConfig(skills);

      // When full validation pipeline runs
      const report = await validateAgentConfig(config, fetcher);

      // Then report should be produced with all skills
      expect(report.skillCount).toBe(3);
      expect(report.checks.length).toBeGreaterThan(0);
      expect(report.timestamp).toBeDefined();
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('performance: validation of 3 skills completes in < 1 second', async () => {
      // Given 3 skills
      const skills: Skill[] = [
        createSkill({
          name: 'skill_a',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X' },
            { name: 'target_y', type: 'i32', description: 'Y' },
          ],
        }),
        createSkill({
          name: 'skill_b',
          reducer: 'harvest_start',
          params: [{ name: 'resource_id', type: 'u64', description: 'ID' }],
        }),
        createSkill({
          name: 'skill_c',
          reducer: 'craft_item',
          params: [
            { name: 'recipe_id', type: 'u64', description: 'ID' },
            { name: 'quantity', type: 'u32', description: 'Qty' },
          ],
        }),
      ];
      const config = createResolvedConfig(skills);

      // When validation runs
      const startTime = performance.now();
      const report = await validateAgentConfig(config, fetcher);
      const elapsed = performance.now() - startTime;

      // Then it should complete in < 1 second
      expect(elapsed).toBeLessThan(1000);
      expect(report.skillCount).toBe(3);
    });
  }
);
