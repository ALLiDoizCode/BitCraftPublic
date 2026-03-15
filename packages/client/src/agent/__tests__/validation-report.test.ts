/**
 * Validation Report Tests (AC: 4)
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Tests for validateAgentConfig() orchestrator and formatValidationReport() formatter.
 * Validates report structure, timing, and human-readable output.
 *
 * Validates: AC4 (full validation report)
 * NFR: NFR7 (50 skills validated in < 1 second)
 *
 * Test count: 11 (7 AC4 report structure + 3 formatValidationReport + 1 NFR7 performance)
 */

import { describe, it, expect } from 'vitest';
import {
  validateAgentConfig,
  validateAgentConfigOffline,
  formatValidationReport,
} from '../config-validator.js';
import type { ResolvedAgentConfig } from '../agent-config-types.js';
import type { Skill } from '../types.js';
import { SkillRegistry } from '../skill-registry.js';
import { ConfigValidationError } from '../config-validation-types.js';
import {
  createMockModuleInfo,
  createMockModuleInfoProvider,
  createFailingModuleInfoProvider,
} from './mocks/module-info-mock.js';

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

describe('Validation Report (Story 4.3)', () => {
  describe('AC4 - Full validation report', () => {
    it('all checks pass -> report passed: true, all results listed', async () => {
      // Given an agent config with valid skills
      const skills: Skill[] = [
        createSkill({
          name: 'player_move',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X' },
            { name: 'target_y', type: 'i32', description: 'Y' },
          ],
          subscriptions: [{ table: 'player_state', description: 'State' }],
        }),
      ];
      const config = createResolvedConfig(skills);
      const provider = createMockModuleInfoProvider();

      // When validateAgentConfig is called
      const report = await validateAgentConfig(config, provider);

      // Then the report should pass
      expect(report.passed).toBe(true);
      expect(report.checks.length).toBeGreaterThan(0);
      expect(report.checks.every((c) => c.passed)).toBe(true);
    });

    it('one check fails -> report passed: false, failure identified', async () => {
      // Given an agent config with an invalid reducer
      const skills: Skill[] = [
        createSkill({
          name: 'bad_skill',
          reducer: 'nonexistent_reducer',
          subscriptions: [{ table: 'player_state', description: 'State' }],
        }),
      ];
      const config = createResolvedConfig(skills);
      const provider = createMockModuleInfoProvider();

      // When validateAgentConfig is called
      const report = await validateAgentConfig(config, provider);

      // Then the report should fail
      expect(report.passed).toBe(false);
      const failedCheck = report.checks.find((c) => !c.passed);
      expect(failedCheck).toBeDefined();
      expect(failedCheck!.skillName).toBe('bad_skill');
    });

    it('report includes timestamp in ISO 8601 format', async () => {
      // Given any valid config
      const config = createResolvedConfig([]);
      const provider = createMockModuleInfoProvider();

      // When validateAgentConfig is called
      const report = await validateAgentConfig(config, provider);

      // Then timestamp should be valid ISO 8601
      expect(report.timestamp).toBeDefined();
      const parsed = new Date(report.timestamp);
      expect(parsed.toISOString()).toBe(report.timestamp);
    });

    it('report includes durationMs >= 0', async () => {
      // Given any valid config
      const config = createResolvedConfig([]);
      const provider = createMockModuleInfoProvider();

      // When validateAgentConfig is called
      const report = await validateAgentConfig(config, provider);

      // Then durationMs should be a non-negative number
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof report.durationMs).toBe('number');
    });

    it('report includes correct skillCount', async () => {
      // Given an agent config with 3 skills
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
      const provider = createMockModuleInfoProvider();

      // When validateAgentConfig is called
      const report = await validateAgentConfig(config, provider);

      // Then skillCount should be 3
      expect(report.skillCount).toBe(3);
    });

    it('module info provider failure -> ConfigValidationError propagates from validateAgentConfig', async () => {
      // Given a provider that throws MODULE_FETCH_FAILED
      const fetchError = new ConfigValidationError(
        'Connection refused',
        'MODULE_FETCH_FAILED',
        undefined,
        'ECONNREFUSED'
      );
      const config = createResolvedConfig([
        createSkill({
          name: 'any_skill',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X' },
            { name: 'target_y', type: 'i32', description: 'Y' },
          ],
        }),
      ]);
      const provider = createFailingModuleInfoProvider(fetchError);

      // When validateAgentConfig is called
      // Then the error should propagate as ConfigValidationError
      await expect(validateAgentConfig(config, provider)).rejects.toThrow(ConfigValidationError);
      await expect(validateAgentConfig(config, provider)).rejects.toThrow('Connection refused');
    });

    it('report includes warnings for skills with zero subscriptions', () => {
      // Given a config with one skill that has subscriptions and one without
      const skills: Skill[] = [
        createSkill({
          name: 'has_subs',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X' },
            { name: 'target_y', type: 'i32', description: 'Y' },
          ],
          subscriptions: [{ table: 'player_state', description: 'State' }],
        }),
        createSkill({
          name: 'no_subs',
          reducer: 'harvest_start',
          params: [{ name: 'resource_id', type: 'u64', description: 'ID' }],
          // no subscriptions (defaults to [])
        }),
      ];
      const config = createResolvedConfig(skills);
      const moduleInfo = createMockModuleInfo();

      // When validateAgentConfigOffline is called
      const report = validateAgentConfigOffline(config, moduleInfo);

      // Then the report should include a warning for the skill with zero subscriptions
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]).toContain('no_subs');
      expect(report.warnings[0]).toContain('zero subscriptions');
      // The skill with subscriptions should NOT generate a warning
      expect(report.warnings.some((w) => w.includes('has_subs'))).toBe(false);
    });
  });

  describe('formatValidationReport', () => {
    it('produces human-readable output with pass/fail counts', () => {
      // Given a report with mixed results
      const moduleInfo = createMockModuleInfo();
      const skills: Skill[] = [
        createSkill({
          name: 'valid_skill',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X' },
            { name: 'target_y', type: 'i32', description: 'Y' },
          ],
          subscriptions: [{ table: 'player_state', description: 'State' }],
        }),
        createSkill({
          name: 'bad_skill',
          reducer: 'nonexistent',
        }),
      ];
      const config = createResolvedConfig(skills);
      const report = validateAgentConfigOffline(config, moduleInfo);

      // When formatValidationReport is called
      const output = formatValidationReport(report);

      // Then it should contain key information
      expect(output).toContain('FAILED');
      expect(output).toContain('passed');
      expect(output).toContain('failed');
      expect(output).toContain('Skills validated: 2');
      expect(output).toContain('bad_skill');
      expect(output).toContain('nonexistent');
    });

    it('formatValidationReport renders warnings for skills with zero subscriptions', () => {
      // Given a report with a skill that has zero subscriptions (generates a warning)
      const moduleInfo = createMockModuleInfo();
      const skills: Skill[] = [
        createSkill({
          name: 'valid_with_subs',
          reducer: 'player_move',
          params: [
            { name: 'target_x', type: 'i32', description: 'X' },
            { name: 'target_y', type: 'i32', description: 'Y' },
          ],
          subscriptions: [{ table: 'player_state', description: 'State' }],
        }),
        createSkill({
          name: 'valid_no_subs',
          reducer: 'harvest_start',
          params: [{ name: 'resource_id', type: 'u64', description: 'ID' }],
          // no subscriptions -> generates warning
        }),
      ];
      const config = createResolvedConfig(skills);
      const report = validateAgentConfigOffline(config, moduleInfo);

      // When formatValidationReport is called
      const output = formatValidationReport(report);

      // Then the formatted output should include warnings section
      expect(output).toContain('Warnings:');
      expect(output).toContain('valid_no_subs');
      expect(output).toContain('zero subscriptions');
    });

    it('formatValidationReport on empty report (no checks) -> valid output', () => {
      // Given an empty config (no skills)
      const moduleInfo = createMockModuleInfo();
      const config = createResolvedConfig([]);
      const report = validateAgentConfigOffline(config, moduleInfo);

      // When formatValidationReport is called
      const output = formatValidationReport(report);

      // Then it should produce valid output
      expect(output).toContain('PASSED');
      expect(output).toContain('Skills validated: 0');
      expect(output).toContain('0 passed, 0 failed');
    });
  });

  describe('NFR7 - Performance', () => {
    it('50 skills validated in < 1 second using offline validation with mock ModuleInfo', () => {
      // Given 50 skills
      const skills: Skill[] = [];
      for (let i = 0; i < 50; i++) {
        skills.push(
          createSkill({
            name: `skill_${i}`,
            reducer: 'player_move',
            params: [
              { name: 'target_x', type: 'i32', description: 'X' },
              { name: 'target_y', type: 'i32', description: 'Y' },
            ],
            subscriptions: [
              { table: 'player_state', description: 'State' },
              { table: 'terrain', description: 'Terrain' },
            ],
          })
        );
      }
      const config = createResolvedConfig(skills);
      const moduleInfo = createMockModuleInfo();

      // When validateAgentConfigOffline is called
      const startTime = performance.now();
      const report = validateAgentConfigOffline(config, moduleInfo);
      const elapsed = performance.now() - startTime;

      // Then it should complete within 1 second
      expect(elapsed).toBeLessThan(1000);
      expect(report.skillCount).toBe(50);
      expect(report.durationMs).toBeLessThan(1000);
      // All skills should pass since they match the mock module
      expect(report.passed).toBe(true);
    });
  });
});
