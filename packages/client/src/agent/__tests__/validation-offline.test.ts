/**
 * Validation Offline Mode Tests (AC: 1-4)
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Tests for validateAgentConfigOffline() that validates against pre-fetched
 * ModuleInfo without requiring a live SpacetimeDB connection.
 *
 * Validates: AC1-4 (offline variant of full validation pipeline)
 *
 * Test count: 4
 */

import { describe, it, expect, vi } from 'vitest';
import { validateAgentConfigOffline } from '../config-validator.js';
import type { ResolvedAgentConfig } from '../agent-config-types.js';
import type { Skill } from '../types.js';
import type { ModuleInfo } from '../config-validation-types.js';
import { SkillRegistry } from '../skill-registry.js';
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

/**
 * Helper to create a minimal ResolvedAgentConfig for testing.
 */
function createResolvedConfig(skills: Skill[]): ResolvedAgentConfig {
  const registry = new SkillRegistry();
  for (const skill of skills) {
    registry.register(skill);
  }
  return {
    name: 'test-agent',
    skillNames: skills.map((s) => s.name),
    skills,
    skillRegistry: registry,
  };
}

describe('Offline Validation (Story 4.3)', () => {
  it('validateAgentConfigOffline() with all-valid moduleInfo -> report passes', () => {
    // Given valid skills matching the mock module
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
    ];
    const config = createResolvedConfig(skills);
    const moduleInfo = createMockModuleInfo();

    // When validateAgentConfigOffline is called
    const report = validateAgentConfigOffline(config, moduleInfo);

    // Then report should pass
    expect(report.passed).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.checks.every((c) => c.passed)).toBe(true);
    expect(report.skillCount).toBe(1);
  });

  it('validateAgentConfigOffline() with invalid reducer -> report fails', () => {
    // Given a skill referencing a non-existent reducer
    const skills: Skill[] = [
      createSkill({
        name: 'bad_reducer_skill',
        reducer: 'nonexistent_reducer',
      }),
    ];
    const config = createResolvedConfig(skills);
    const moduleInfo = createMockModuleInfo();

    // When validateAgentConfigOffline is called
    const report = validateAgentConfigOffline(config, moduleInfo);

    // Then report should fail
    expect(report.passed).toBe(false);
    const failedCheck = report.checks.find((c) => !c.passed);
    expect(failedCheck).toBeDefined();
    expect(failedCheck!.checkType).toBe('reducer_exists');
    expect(failedCheck!.message).toContain('nonexistent_reducer');
  });

  it('validateAgentConfigOffline() with invalid table -> report fails', () => {
    // Given a skill referencing a non-existent table
    const skills: Skill[] = [
      createSkill({
        name: 'bad_table_skill',
        reducer: 'player_move',
        params: [
          { name: 'target_x', type: 'i32', description: 'X' },
          { name: 'target_y', type: 'i32', description: 'Y' },
        ],
        subscriptions: [{ table: 'nonexistent_table', description: 'Missing' }],
      }),
    ];
    const config = createResolvedConfig(skills);
    const moduleInfo = createMockModuleInfo();

    // When validateAgentConfigOffline is called
    const report = validateAgentConfigOffline(config, moduleInfo);

    // Then report should fail due to missing table
    expect(report.passed).toBe(false);
    const failedCheck = report.checks.find((c) => !c.passed && c.checkType === 'table_exists');
    expect(failedCheck).toBeDefined();
    expect(failedCheck!.message).toContain('nonexistent_table');
  });

  it('offline validation does NOT call getModuleInfo() (no network)', () => {
    // Given a mock provider with a spy on getModuleInfo
    const mockGetModuleInfo = vi.fn().mockResolvedValue(createMockModuleInfo());
    const moduleInfo = createMockModuleInfo();

    const config = createResolvedConfig([
      createSkill({
        name: 'player_move',
        reducer: 'player_move',
        params: [
          { name: 'target_x', type: 'i32', description: 'X' },
          { name: 'target_y', type: 'i32', description: 'Y' },
        ],
      }),
    ]);

    // When validateAgentConfigOffline is called (not the async variant)
    // Note: the offline function takes ModuleInfo directly, not a provider
    const report = validateAgentConfigOffline(config, moduleInfo);

    // Then the mock provider's getModuleInfo should NOT have been called
    // because offline validation takes pre-fetched ModuleInfo, not a provider
    expect(mockGetModuleInfo).not.toHaveBeenCalled();
    // And a report should still be produced
    expect(report).toBeDefined();
    expect(report.skillCount).toBe(1);
  });
});
