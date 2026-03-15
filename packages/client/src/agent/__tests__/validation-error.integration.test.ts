/**
 * Validation Error Integration Tests (AC: 1, 2, 3)
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Tests error handling against the live Docker stack SpacetimeDB instance.
 * Requires: docker compose up (bitcraft-server at http://localhost:3000)
 * Conditional execution: describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)
 *
 * Validates: AC2 (actionable error messages), error handling for invalid configurations
 *
 * Test count: 5
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SpacetimeDBModuleInfoFetcher } from '../module-info-fetcher.js';
import { validateReducers } from '../reducer-validator.js';
import { validateTables } from '../table-validator.js';
import { ConfigValidationError } from '../config-validation-types.js';
import type { Skill } from '../types.js';
import type { ModuleInfo } from '../config-validation-types.js';

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

describe.skipIf(!runIntegrationTests)('Validation Error Integration Tests (Story 4.3)', () => {
  let moduleInfo: ModuleInfo;

  beforeAll(async () => {
    const fetcher = new SpacetimeDBModuleInfoFetcher({
      url: SPACETIMEDB_URL,
      database: SPACETIMEDB_DATABASE,
    });
    moduleInfo = await fetcher.getModuleInfo();
  });

  it('non-existent reducer does_not_exist -> validation fails with actionable error', () => {
    // Given a skill referencing a non-existent reducer
    const skills: Skill[] = [
      createSkill({
        name: 'bad_skill',
        reducer: 'does_not_exist',
      }),
    ];

    // When validateReducers is called with live module info
    const results = validateReducers(skills, moduleInfo);

    // Then it should fail with an actionable message
    const failedCheck = results.find((r) => !r.passed);
    expect(failedCheck).toBeDefined();
    expect(failedCheck!.message).toContain('does_not_exist');
    expect(failedCheck!.message).toContain('does not expose this reducer');
  });

  it('non-existent table does_not_exist_table -> validation fails', () => {
    // Given a skill requiring a non-existent table
    const skills: Skill[] = [
      createSkill({
        name: 'bad_table_skill',
        reducer: 'player_move',
        subscriptions: [{ table: 'does_not_exist_table', description: 'Missing' }],
      }),
    ];

    // When validateTables is called with live module info
    const results = validateTables(skills, moduleInfo);

    // Then it should fail
    const failedCheck = results.find((r) => !r.passed);
    expect(failedCheck).toBeDefined();
    expect(failedCheck!.message).toContain('does_not_exist_table');
  });

  it('skill with wrong param count vs live module -> param compatibility failure', () => {
    // Given a skill with too many params for player_move
    const skills: Skill[] = [
      createSkill({
        name: 'wrong_count',
        reducer: 'player_move',
        params: [
          { name: 'target_x', type: 'i32', description: 'X' },
          { name: 'target_y', type: 'i32', description: 'Y' },
          { name: 'extra', type: 'i32', description: 'Extra' },
        ],
      }),
    ];

    // When validateReducers is called with live module info
    const results = validateReducers(skills, moduleInfo);

    // Then param_compatibility should fail
    const paramCheck = results.find((r) => r.checkType === 'param_compatibility' && !r.passed);
    expect(paramCheck).toBeDefined();
  });

  it('skill with wrong param types vs live module -> param type mismatch', () => {
    // Given player_move with wrong types (String instead of i32)
    const skills: Skill[] = [
      createSkill({
        name: 'wrong_types',
        reducer: 'player_move',
        params: [
          { name: 'target_x', type: 'String', description: 'X as string' },
          { name: 'target_y', type: 'String', description: 'Y as string' },
        ],
      }),
    ];

    // When validateReducers is called with live module info
    const results = validateReducers(skills, moduleInfo);

    // Then param_compatibility should fail
    const paramCheck = results.find((r) => r.checkType === 'param_compatibility' && !r.passed);
    expect(paramCheck).toBeDefined();
  });

  it('module info fetch to wrong URL -> MODULE_FETCH_FAILED error', async () => {
    // Given a fetcher pointing to a non-existent server
    const badFetcher = new SpacetimeDBModuleInfoFetcher({
      url: 'http://localhost:59999',
      database: 'nonexistent',
      timeoutMs: 2000,
    });

    // When getModuleInfo is called
    // Then it should throw ConfigValidationError with MODULE_FETCH_FAILED
    try {
      await badFetcher.getModuleInfo();
      expect.fail('Should have thrown ConfigValidationError');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      const err = e as ConfigValidationError;
      expect(err.code).toBe('MODULE_FETCH_FAILED');
    }
  });
});
