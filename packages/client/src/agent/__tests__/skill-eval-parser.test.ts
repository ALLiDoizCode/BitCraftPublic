/**
 * Skill Eval Parser Tests (AC: 2)
 * Story 4.1: Skill File Format & Parser
 *
 * Tests for behavioral eval parsing from SKILL.md files.
 * Validates positive evals, negative evals (skill_not_triggered),
 * null args, mixed evals, and error handling for malformed evals.
 *
 * Validates: AC2 (behavioral eval parsing)
 *
 * Test count: 13
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSkillFile } from '../skill-parser.js';
import { SkillParseError } from '../types.js';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'skills');

function readFixture(filename: string): string {
  return readFileSync(join(FIXTURES_DIR, filename), 'utf-8');
}

/**
 * Helper to create a skill file content with custom evals
 */
function createSkillWithEvals(evalsYaml: string): string {
  return [
    '---',
    'name: eval_test_skill',
    'description: A skill for testing eval parsing',
    'reducer: test_action',
    'params:',
    '  - name: target_id',
    '    type: u64',
    '    description: Target entity ID',
    'subscriptions:',
    '  - table: player_state',
    '    description: Current player state',
    evalsYaml,
    '---',
    '',
    '# Eval Test Skill',
  ].join('\n');
}

describe('Skill Eval Parser (Story 4.1)', () => {
  describe('AC2 - Behavioral eval parsing', () => {
    it('parses positive eval: { prompt, expected: { reducer, args }, criteria } extracted correctly', () => {
      // Given a skill file with a positive eval (from player-move.skill.md)
      const content = readFixture('player-move.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('player-move.skill.md', content);

      // Then the first eval should be a positive eval with reducer and args
      expect(skill.evals[0]).toEqual({
        prompt: 'Move to coordinates (150, 200)',
        expected: {
          reducer: 'player_move',
          args: [150, 200],
        },
        criteria: 'Correctly extracts numeric coordinates from natural language',
      });
    });

    it('parses negative eval: { prompt, expected: skill_not_triggered, criteria }', () => {
      // Given a skill file with a negative eval (from player-move.skill.md)
      const content = readFixture('player-move.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('player-move.skill.md', content);

      // Then the third eval should be a negative eval
      expect(skill.evals[2]).toEqual({
        prompt: 'Attack the nearest enemy',
        expected: 'skill_not_triggered',
        criteria: 'Does NOT trigger movement skill for combat intent',
      });
    });

    it('parses eval with args: null (runtime-dependent) -> parsed with null args', () => {
      // Given a skill file with an eval that has null args (from player-move.skill.md)
      const content = readFixture('player-move.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('player-move.skill.md', content);

      // Then the second eval should have null args (direction depends on runtime state)
      expect(skill.evals[1].expected).toEqual({
        reducer: 'player_move',
        args: null,
      });
      expect(skill.evals[1].criteria).toBe(
        'Translates cardinal direction to coordinate delta relative to current position'
      );
    });

    it('parses mixed positive and negative evals in same file -> all extracted', () => {
      // Given the harvest-resource.skill.md with 4 evals (2 positive, 2 negative)
      const content = readFixture('harvest-resource.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('harvest-resource.skill.md', content);

      // Then all 4 evals should be extracted
      expect(skill.evals).toHaveLength(4);

      // First two are positive evals (with null args)
      expect(skill.evals[0].expected).toEqual({
        reducer: 'harvest_start',
        args: null,
      });
      expect(skill.evals[1].expected).toEqual({
        reducer: 'harvest_start',
        args: null,
      });

      // Last two are negative evals
      expect(skill.evals[2].expected).toBe('skill_not_triggered');
      expect(skill.evals[3].expected).toBe('skill_not_triggered');
    });

    it('missing evals section -> empty array (optional field)', () => {
      // Given a valid skill file without an evals section
      const content = [
        '---',
        'name: no_evals_skill',
        'description: A skill without behavioral evals',
        'reducer: simple_action',
        'params:',
        '  - name: target_id',
        '    type: u64',
        '    description: Target entity ID',
        'subscriptions:',
        '  - table: player_state',
        '    description: Current player state',
        '---',
        '',
        '# No Evals Skill',
      ].join('\n');

      // When parseSkillFile is called
      const skill = parseSkillFile('no-evals.skill.md', content);

      // Then evals should be an empty array
      expect(skill.evals).toEqual([]);
      expect(skill.name).toBe('no_evals_skill');
    });

    it('parses craft-item evals with mixed positive (null args) and negative evals', () => {
      // Given the craft-item.skill.md with 4 evals (2 positive, 2 negative)
      const content = readFixture('craft-item.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('craft-item.skill.md', content);

      // Then all 4 evals should be extracted
      expect(skill.evals).toHaveLength(4);

      // Verify positive eval structure
      expect(skill.evals[0]).toEqual({
        prompt: 'Craft a wooden sword',
        expected: {
          reducer: 'craft_item',
          args: null,
        },
        criteria:
          "Looks up 'wooden sword' in recipe_desc, resolves recipe_id, verifies materials in inventory",
      });

      // Verify negative eval structure
      expect(skill.evals[2]).toEqual({
        prompt: 'Gather some wood',
        expected: 'skill_not_triggered',
        criteria: 'Gathering intent should trigger harvest_resource, not crafting',
      });
    });

    it('eval missing prompt -> error', () => {
      // Given a skill file with an eval missing the prompt field
      const evalsYaml = [
        'evals:',
        '  - expected:',
        '      reducer: test_action',
        '      args: [1, 2]',
        '    criteria: Should have a prompt',
      ].join('\n');
      const content = createSkillWithEvals(evalsYaml);

      // When parseSkillFile is called
      // Then it should throw SkillParseError
      expect(() => parseSkillFile('eval-no-prompt.skill.md', content)).toThrow(SkillParseError);
    });

    it('eval missing expected field -> error', () => {
      // Given a skill file with an eval missing the expected field
      const evalsYaml = [
        'evals:',
        '  - prompt: "Do something"',
        '    criteria: Should have an expected field',
      ].join('\n');
      const content = createSkillWithEvals(evalsYaml);

      // When parseSkillFile is called
      // Then it should throw SkillParseError for missing expected
      try {
        parseSkillFile('eval-no-expected.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        expect(e).toBeInstanceOf(SkillParseError);
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('eval-no-expected.skill.md');
      }
    });

    it('eval missing criteria -> error', () => {
      // Given a skill file with an eval missing the criteria field
      const evalsYaml = [
        'evals:',
        '  - prompt: "Do something"',
        '    expected:',
        '      reducer: test_action',
        '      args: [1, 2]',
      ].join('\n');
      const content = createSkillWithEvals(evalsYaml);

      // When parseSkillFile is called
      // Then it should throw SkillParseError
      expect(() => parseSkillFile('eval-no-criteria.skill.md', content)).toThrow(SkillParseError);
    });

    it('eval with expected as string skill_not_triggered (YAML unquoted) parses correctly', () => {
      // Given a skill file with an unquoted skill_not_triggered value
      const evalsYaml = [
        'evals:',
        '  - prompt: "Do something unrelated"',
        '    expected: skill_not_triggered',
        '    criteria: Should not trigger this skill',
      ].join('\n');
      const content = createSkillWithEvals(evalsYaml);

      // When parseSkillFile is called
      const skill = parseSkillFile('unquoted-neg.skill.md', content);

      // Then it should parse as a negative eval
      expect(skill.evals).toHaveLength(1);
      expect(skill.evals[0].expected).toBe('skill_not_triggered');
    });

    it('eval with expected object containing both reducer and args fields parses correctly', () => {
      // Given a skill file with an explicit expected object
      const evalsYaml = [
        'evals:',
        '  - prompt: "Move to 10, 20"',
        '    expected:',
        '      reducer: player_move',
        '      args: [10, 20]',
        '    criteria: Extracts coordinates',
      ].join('\n');
      const content = createSkillWithEvals(evalsYaml);

      // When parseSkillFile is called
      const skill = parseSkillFile('explicit-expected.skill.md', content);

      // Then the expected field should be a proper object
      expect(skill.evals).toHaveLength(1);
      expect(skill.evals[0].expected).toEqual({
        reducer: 'player_move',
        args: [10, 20],
      });
    });

    it('eval with non-array args (scalar value) -> error', () => {
      // Given a skill file with an eval where args is a number instead of array
      const evalsYaml = [
        'evals:',
        '  - prompt: "Do something"',
        '    expected:',
        '      reducer: test_action',
        '      args: 42',
        '    criteria: Should reject scalar args',
      ].join('\n');
      const content = createSkillWithEvals(evalsYaml);

      // When parseSkillFile is called
      // Then it should throw SkillParseError for invalid args type
      try {
        parseSkillFile('scalar-args.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        expect(e).toBeInstanceOf(SkillParseError);
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('scalar-args.skill.md');
      }
    });

    it('eval with missing expected.reducer field -> error', () => {
      // Given a skill file with an eval where expected object has no reducer
      const evalsYaml = [
        'evals:',
        '  - prompt: "Do something"',
        '    expected:',
        '      args: [1, 2]',
        '    criteria: Should reject missing reducer',
      ].join('\n');
      const content = createSkillWithEvals(evalsYaml);

      // When parseSkillFile is called
      // Then it should throw SkillParseError for missing expected.reducer
      try {
        parseSkillFile('no-expected-reducer.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        expect(e).toBeInstanceOf(SkillParseError);
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('no-expected-reducer.skill.md');
      }
    });
  });
});
