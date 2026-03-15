/**
 * Reducer Validator Tests (AC: 1, 2)
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Tests for validateReducers() function that checks skill files reference
 * reducers existing in the SpacetimeDB module and that parameter types match.
 *
 * Validates: AC1 (reducer existence + param compatibility), AC2 (actionable error messages)
 *
 * Test count: 14
 */

import { describe, it, expect } from 'vitest';
import { validateReducers } from '../reducer-validator.js';
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

describe('Reducer Validator (Story 4.3)', () => {
  describe('AC1 - Reducer existence validation', () => {
    it('skill references player_move reducer present in module -> passes', () => {
      // Given a skill referencing player_move and a module with player_move
      const skills: Skill[] = [
        createSkill({
          name: 'player_move',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X coordinate' },
            { name: 'target_y', type: 'i32', description: 'Y coordinate' },
          ],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then the reducer_exists check should pass
      const existsCheck = results.find((r) => r.checkType === 'reducer_exists');
      expect(existsCheck).toBeDefined();
      expect(existsCheck!.passed).toBe(true);
      expect(existsCheck!.skillName).toBe('player_move');
    });

    it('reducer params match skill params (offset by 1 for identity) -> passes', () => {
      // Given a skill with params matching module reducer (after identity offset)
      const skills: Skill[] = [
        createSkill({
          name: 'player_move',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X coordinate' },
            { name: 'target_y', type: 'i32', description: 'Y coordinate' },
          ],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then the param_compatibility check should pass
      const paramCheck = results.find((r) => r.checkType === 'param_compatibility');
      expect(paramCheck).toBeDefined();
      expect(paramCheck!.passed).toBe(true);
    });

    it('skill with zero params, reducer with only identity param -> passes', () => {
      // Given a skill with no params and a reducer with only identity
      const skills: Skill[] = [
        createSkill({
          name: 'get_status',
          reducer: 'get_status',
        }),
      ];
      const moduleInfo: ModuleInfo = {
        reducers: [
          {
            name: 'get_status',
            params: [{ name: 'identity', type: 'String' }],
          },
        ],
        tables: [],
      };

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then both checks should pass
      expect(results.every((r) => r.passed)).toBe(true);
      const paramCheck = results.find((r) => r.checkType === 'param_compatibility');
      expect(paramCheck).toBeDefined();
      expect(paramCheck!.passed).toBe(true);
    });

    it('skill with params matching module after identity offset -> detailed param-by-param validation', () => {
      // Given craft_item skill matching module's craft_item reducer
      const skills: Skill[] = [
        createSkill({
          name: 'craft_item',
          reducer: 'craft_item',
          params: [
            { name: 'recipe_id', type: 'u64', description: 'Recipe ID' },
            { name: 'quantity', type: 'u32', description: 'Quantity' },
          ],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then all checks should pass
      expect(results.filter((r) => r.passed).length).toBeGreaterThanOrEqual(2);
      const paramCheck = results.find((r) => r.checkType === 'param_compatibility');
      expect(paramCheck).toBeDefined();
      expect(paramCheck!.passed).toBe(true);
    });

    it('all 3 prototype skill reducers validated against mock module -> all pass', () => {
      // Given the 3 prototype skills
      const skills: Skill[] = [
        createSkill({
          name: 'player_move',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X coordinate' },
            { name: 'target_y', type: 'i32', description: 'Y coordinate' },
          ],
        }),
        createSkill({
          name: 'harvest_resource',
          reducer: 'harvest_start',
          params: [{ name: 'resource_id', type: 'u64', description: 'Resource node ID' }],
        }),
        createSkill({
          name: 'craft_item',
          reducer: 'craft_item',
          params: [
            { name: 'recipe_id', type: 'u64', description: 'Recipe ID' },
            { name: 'quantity', type: 'u32', description: 'Quantity' },
          ],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then all checks should pass
      const failedChecks = results.filter((r) => !r.passed);
      expect(failedChecks).toHaveLength(0);
      // Each skill should have reducer_exists + param_compatibility checks
      expect(results.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('AC2 - Non-existent reducer error', () => {
    it('skill references nonexistent_reducer -> fails with actionable message matching AC2 format', () => {
      // Given a skill referencing a non-existent reducer
      const skills: Skill[] = [
        createSkill({
          name: 'harvest_resource',
          reducer: 'nonexistent_reducer',
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then it should produce a failed check with AC2-format message
      const failedCheck = results.find((r) => !r.passed);
      expect(failedCheck).toBeDefined();
      expect(failedCheck!.checkType).toBe('reducer_exists');
      expect(failedCheck!.message).toBe(
        "Skill 'harvest_resource' references reducer 'nonexistent_reducer' but SpacetimeDB module does not expose this reducer"
      );
    });

    it('reducer params type mismatch (skill says i32, module says u32) -> fails with param_compatibility check', () => {
      // Given a skill with mismatched param types
      const skills: Skill[] = [
        createSkill({
          name: 'bad_types',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'u32', description: 'X coordinate' }, // u32 instead of i32
            { name: 'target_y', type: 'i32', description: 'Y coordinate' },
          ],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then param_compatibility should fail
      const paramCheck = results.find((r) => r.checkType === 'param_compatibility' && !r.passed);
      expect(paramCheck).toBeDefined();
      expect(paramCheck!.message).toContain("type 'u32'");
      expect(paramCheck!.message).toContain("type 'i32'");
    });

    it('reducer has fewer params than skill expects -> fails', () => {
      // Given a skill with more params than the reducer expects
      const skills: Skill[] = [
        createSkill({
          name: 'extra_params',
          reducer: 'harvest_start',
          params: [
            { name: 'resource_id', type: 'u64', description: 'Resource ID' },
            { name: 'extra_param', type: 'i32', description: 'Extra' },
          ],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then param_compatibility should fail with count mismatch
      const paramCheck = results.find((r) => r.checkType === 'param_compatibility' && !r.passed);
      expect(paramCheck).toBeDefined();
      expect(paramCheck!.message).toContain('2 params');
      expect(paramCheck!.message).toContain('1 params');
    });

    it('reducer has more params than skill expects -> fails (extra params not provided)', () => {
      // Given a skill with fewer params than the reducer expects
      const skills: Skill[] = [
        createSkill({
          name: 'missing_params',
          reducer: 'craft_item',
          params: [
            { name: 'recipe_id', type: 'u64', description: 'Recipe ID' },
            // Missing quantity param
          ],
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then param_compatibility should fail
      const paramCheck = results.find((r) => r.checkType === 'param_compatibility' && !r.passed);
      expect(paramCheck).toBeDefined();
      expect(paramCheck!.message).toContain('1 params');
      expect(paramCheck!.message).toContain('2 params');
    });

    it('multiple skills: one valid, one invalid reducer -> two results, one pass, one fail', () => {
      // Given two skills: one valid, one invalid
      const skills: Skill[] = [
        createSkill({
          name: 'valid_skill',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X' },
            { name: 'target_y', type: 'i32', description: 'Y' },
          ],
        }),
        createSkill({
          name: 'invalid_skill',
          reducer: 'does_not_exist',
        }),
      ];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then valid_skill should pass, invalid_skill should fail
      const validResults = results.filter((r) => r.skillName === 'valid_skill');
      const invalidResults = results.filter((r) => r.skillName === 'invalid_skill');
      expect(validResults.every((r) => r.passed)).toBe(true);
      expect(invalidResults.some((r) => !r.passed)).toBe(true);
    });
  });

  describe('Non-BitCraft module (no identity param)', () => {
    it('reducer without identity param -> compares params 1:1 from index 0', () => {
      // Given a non-BitCraft module where reducers do NOT have identity as first param
      const skills: Skill[] = [
        createSkill({
          name: 'custom_action',
          reducer: 'custom_action',
          params: [
            { name: 'x', type: 'i32', description: 'X value' },
            { name: 'y', type: 'i32', description: 'Y value' },
          ],
        }),
      ];
      const moduleInfo: ModuleInfo = {
        reducers: [
          {
            name: 'custom_action',
            params: [
              { name: 'x', type: 'i32' },
              { name: 'y', type: 'i32' },
            ],
          },
        ],
        tables: [],
      };

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then both checks should pass (no identity offset applied)
      expect(results.every((r) => r.passed)).toBe(true);
      const paramCheck = results.find((r) => r.checkType === 'param_compatibility');
      expect(paramCheck).toBeDefined();
      expect(paramCheck!.passed).toBe(true);
    });

    it('reducer without identity param and param count mismatch -> fails correctly', () => {
      // Given a non-BitCraft module where skill has wrong param count (no identity offset)
      const skills: Skill[] = [
        createSkill({
          name: 'custom_action',
          reducer: 'custom_action',
          params: [{ name: 'x', type: 'i32', description: 'X value' }],
        }),
      ];
      const moduleInfo: ModuleInfo = {
        reducers: [
          {
            name: 'custom_action',
            params: [
              { name: 'x', type: 'i32' },
              { name: 'y', type: 'i32' },
            ],
          },
        ],
        tables: [],
      };

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then param_compatibility should fail (1 vs 2 params, no identity offset)
      const paramCheck = results.find((r) => r.checkType === 'param_compatibility' && !r.passed);
      expect(paramCheck).toBeDefined();
      expect(paramCheck!.message).toContain('1 params');
      expect(paramCheck!.message).toContain('2 params');
    });
  });

  describe('Edge cases', () => {
    it('empty skills array -> empty results array', () => {
      // Given an empty skills array
      const skills: Skill[] = [];
      const moduleInfo = createMockModuleInfo();

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then results should be empty
      expect(results).toEqual([]);
    });

    it('module with zero reducers -> all skills fail', () => {
      // Given a module with no reducers
      const skills: Skill[] = [
        createSkill({
          name: 'any_skill',
          reducer: 'player_move',
        }),
      ];
      const moduleInfo: ModuleInfo = { reducers: [], tables: [] };

      // When validateReducers is called
      const results = validateReducers(skills, moduleInfo);

      // Then the skill should fail
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].checkType).toBe('reducer_exists');
    });
  });
});
