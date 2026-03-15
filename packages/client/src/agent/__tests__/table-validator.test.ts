/**
 * Table Validator Tests (AC: 3)
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Tests for validateTables() function that checks skill files reference
 * tables existing in the SpacetimeDB module.
 *
 * Validates: AC3 (table subscription validation)
 *
 * Test count: 8
 */

import { describe, it, expect } from 'vitest';
import { validateTables } from '../table-validator.js';
import type { Skill } from '../types.js';
import type { ModuleInfo } from '../config-validation-types.js';
import { createMockModuleInfo } from './mocks/module-info-mock.js';

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

describe('Table Validator (Story 4.3)', () => {
  describe('AC3 - Table subscription validation', () => {
    it('skill requires player_state table present in module -> passes', () => {
      // Given a skill requiring player_state and a module with player_state
      const skills: Skill[] = [
        createSkill({
          name: 'player_move',
          reducer: 'player_move',
          subscriptions: [{ table: 'player_state', description: 'Player position' }],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateTables is called
      const results = validateTables(skills, moduleInfo);

      // Then the check should pass
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].checkType).toBe('table_exists');
      expect(results[0].skillName).toBe('player_move');
    });

    it('skill requires nonexistent_table -> fails with actionable message', () => {
      // Given a skill requiring a non-existent table
      const skills: Skill[] = [
        createSkill({
          name: 'bad_skill',
          reducer: 'some_reducer',
          subscriptions: [{ table: 'nonexistent_table', description: 'Does not exist' }],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateTables is called
      const results = validateTables(skills, moduleInfo);

      // Then the check should fail with an actionable message
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].checkType).toBe('table_exists');
      expect(results[0].message).toBe(
        "Skill 'bad_skill' requires table 'nonexistent_table' but SpacetimeDB module does not expose this table"
      );
    });

    it('skill requires multiple tables, all present -> all pass', () => {
      // Given a skill requiring multiple tables all present in the module
      const skills: Skill[] = [
        createSkill({
          name: 'harvest_resource',
          reducer: 'harvest_start',
          subscriptions: [
            { table: 'player_state', description: 'Player state' },
            { table: 'resource_node', description: 'Resource nodes' },
            { table: 'item_desc', description: 'Item descriptions' },
          ],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateTables is called
      const results = validateTables(skills, moduleInfo);

      // Then all 3 checks should pass
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('skill requires multiple tables, one missing -> one fail, rest pass', () => {
      // Given a skill requiring 3 tables, one missing
      const skills: Skill[] = [
        createSkill({
          name: 'mixed_skill',
          reducer: 'some_reducer',
          subscriptions: [
            { table: 'player_state', description: 'Present' },
            { table: 'missing_table', description: 'Missing' },
            { table: 'terrain', description: 'Present' },
          ],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateTables is called
      const results = validateTables(skills, moduleInfo);

      // Then 2 should pass, 1 should fail
      expect(results).toHaveLength(3);
      const passed = results.filter((r) => r.passed);
      const failed = results.filter((r) => !r.passed);
      expect(passed).toHaveLength(2);
      expect(failed).toHaveLength(1);
      expect(failed[0].message).toContain('missing_table');
    });

    it('skill with zero subscriptions -> no table checks (valid)', () => {
      // Given a skill with no subscriptions
      const skills: Skill[] = [
        createSkill({
          name: 'no_subs',
          reducer: 'some_reducer',
          subscriptions: [],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateTables is called
      const results = validateTables(skills, moduleInfo);

      // Then no checks should be generated (valid)
      expect(results).toEqual([]);
    });

    it('multiple skills with overlapping table requirements -> each checked independently', () => {
      // Given two skills both requiring player_state
      const skills: Skill[] = [
        createSkill({
          name: 'skill_a',
          reducer: 'reducer_a',
          subscriptions: [{ table: 'player_state', description: 'State' }],
        }),
        createSkill({
          name: 'skill_b',
          reducer: 'reducer_b',
          subscriptions: [{ table: 'player_state', description: 'State' }],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateTables is called
      const results = validateTables(skills, moduleInfo);

      // Then both skills should have independent passing checks
      expect(results).toHaveLength(2);
      expect(results[0].skillName).toBe('skill_a');
      expect(results[0].passed).toBe(true);
      expect(results[1].skillName).toBe('skill_b');
      expect(results[1].passed).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('empty skills array -> empty results array', () => {
      // Given an empty skills array
      const skills: Skill[] = [];
      const moduleInfo = createMockModuleInfo();

      // When validateTables is called
      const results = validateTables(skills, moduleInfo);

      // Then results should be empty
      expect(results).toEqual([]);
    });

    it('module with zero tables -> all table checks fail', () => {
      // Given a module with no tables
      const skills: Skill[] = [
        createSkill({
          name: 'any_skill',
          reducer: 'some_reducer',
          subscriptions: [{ table: 'player_state', description: 'State' }],
        }),
      ];
      const moduleInfo: ModuleInfo = { reducers: [], tables: [] };

      // When validateTables is called
      const results = validateTables(skills, moduleInfo);

      // Then the check should fail
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toContain('player_state');
    });
  });
});
