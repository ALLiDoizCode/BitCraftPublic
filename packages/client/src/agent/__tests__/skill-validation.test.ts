/**
 * Skill Validation Tests (AC: 1, 4)
 * Story 4.1: Skill File Format & Parser
 *
 * Tests for field validation rules: reducer name format, parameter type validation,
 * required fields presence, and actionable error messages.
 *
 * Validates: AC1 (field format validation), AC4 (malformed file error handling)
 * Security: OWASP A03 (reducer name regex matches BLS handler content-parser.ts)
 *
 * Test count: 16
 */

import { describe, it, expect } from 'vitest';
import { parseSkillFile } from '../skill-parser.js';
import { SkillParseError } from '../types.js';

/**
 * Helper to create a valid skill file content with overrides
 */
function createSkillContent(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    name: 'test_skill',
    description: 'A test skill for validation',
    reducer: 'test_action',
    params: [
      '  - name: target_id',
      '    type: u64',
      '    description: Target entity ID',
    ].join('\n'),
    subscriptions: [
      '  - table: player_state',
      '    description: Current player state',
    ].join('\n'),
  };

  const merged = { ...defaults, ...overrides };

  const frontmatterLines: string[] = [];
  for (const [key, value] of Object.entries(merged)) {
    if (key === 'params' || key === 'subscriptions') {
      frontmatterLines.push(`${key}:`);
      frontmatterLines.push(value);
    } else {
      frontmatterLines.push(`${key}: ${value}`);
    }
  }

  return ['---', ...frontmatterLines, '---', '', '# Test Skill', ''].join(
    '\n'
  );
}

describe('Skill Validation (Story 4.1)', () => {
  describe('Reducer name validation', () => {
    it('accepts valid reducer name: 1-64 chars, alphanumeric + underscore', () => {
      // Given a skill file with a valid reducer name
      const content = createSkillContent({ reducer: 'player_move' });

      // When parseSkillFile is called
      const skill = parseSkillFile('valid-reducer.skill.md', content);

      // Then the reducer name should be accepted
      expect(skill.reducer).toBe('player_move');
    });

    it('rejects reducer with spaces -> INVALID_REDUCER_NAME', () => {
      // Given a skill file with a reducer name containing spaces
      const content = createSkillContent({ reducer: '"player move"' });

      // When parseSkillFile is called
      // Then it should throw SkillParseError with INVALID_REDUCER_NAME
      expect(() =>
        parseSkillFile('space-reducer.skill.md', content)
      ).toThrow(SkillParseError);
      try {
        parseSkillFile('space-reducer.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('INVALID_REDUCER_NAME');
        expect(err.filePath).toBe('space-reducer.skill.md');
      }
    });

    it('rejects reducer name >64 chars -> INVALID_REDUCER_NAME', () => {
      // Given a skill file with a reducer name exceeding 64 characters
      const longReducer = 'a'.repeat(65);
      const content = createSkillContent({ reducer: longReducer });

      // When parseSkillFile is called
      // Then it should throw SkillParseError with INVALID_REDUCER_NAME
      expect(() =>
        parseSkillFile('long-reducer.skill.md', content)
      ).toThrow(SkillParseError);
      try {
        parseSkillFile('long-reducer.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('INVALID_REDUCER_NAME');
      }
    });

    it('accepts reducer name with exactly 64 chars (boundary)', () => {
      // Given a skill file with a reducer name at the 64-char boundary
      const reducerName = 'a'.repeat(64);
      const content = createSkillContent({ reducer: reducerName });

      // When parseSkillFile is called
      const skill = parseSkillFile('boundary-reducer.skill.md', content);

      // Then the reducer name should be accepted (exactly 64 chars is valid)
      expect(skill.reducer).toBe(reducerName);
    });

    it('rejects reducer name starting with a digit -> INVALID_REDUCER_NAME', () => {
      // Given a skill file with a reducer name starting with a number
      const content = createSkillContent({ reducer: '1bad_reducer' });

      // When parseSkillFile is called
      // Then it should throw INVALID_REDUCER_NAME (regex requires letter or underscore first)
      try {
        parseSkillFile('digit-reducer.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('INVALID_REDUCER_NAME');
        expect(err.filePath).toBe('digit-reducer.skill.md');
      }
    });
  });

  describe('Parameter type validation', () => {
    it('rejects invalid param type (int instead of i32) -> INVALID_PARAM_TYPE', () => {
      // Given a skill file with an invalid parameter type
      const content = createSkillContent({
        params: [
          '  - name: target_x',
          '    type: int',
          '    description: Target X coordinate',
        ].join('\n'),
      });

      // When parseSkillFile is called
      // Then it should throw SkillParseError with INVALID_PARAM_TYPE
      expect(() =>
        parseSkillFile('bad-param-type.skill.md', content)
      ).toThrow(SkillParseError);
      try {
        parseSkillFile('bad-param-type.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('INVALID_PARAM_TYPE');
        expect(err.filePath).toBe('bad-param-type.skill.md');
      }
    });
  });

  describe('Required field validation', () => {
    it('rejects missing params array -> MISSING_REQUIRED_FIELD', () => {
      // Given a skill file without the params array
      const content = [
        '---',
        'name: no_params',
        'description: Skill without params',
        'reducer: test_action',
        'subscriptions:',
        '  - table: player_state',
        '    description: Current player state',
        '---',
        '',
        '# No Params',
      ].join('\n');

      // When parseSkillFile is called
      // Then it should throw SkillParseError with MISSING_REQUIRED_FIELD
      expect(() =>
        parseSkillFile('no-params.skill.md', content)
      ).toThrow(SkillParseError);
      try {
        parseSkillFile('no-params.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.fields).toContain('params');
      }
    });

    it('rejects missing subscriptions array -> MISSING_REQUIRED_FIELD', () => {
      // Given a skill file without the subscriptions array
      const content = [
        '---',
        'name: no_subs',
        'description: Skill without subscriptions',
        'reducer: test_action',
        'params:',
        '  - name: target_id',
        '    type: u64',
        '    description: Target entity',
        '---',
        '',
        '# No Subscriptions',
      ].join('\n');

      // When parseSkillFile is called
      // Then it should throw SkillParseError with MISSING_REQUIRED_FIELD
      expect(() =>
        parseSkillFile('no-subs.skill.md', content)
      ).toThrow(SkillParseError);
      try {
        parseSkillFile('no-subs.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.fields).toContain('subscriptions');
      }
    });

    it('rejects param entry missing name -> error', () => {
      // Given a skill file with a param entry missing the name field
      const content = createSkillContent({
        params: [
          '  - type: i32',
          '    description: Missing name parameter',
        ].join('\n'),
      });

      // When parseSkillFile is called
      // Then it should throw SkillParseError
      expect(() =>
        parseSkillFile('no-param-name.skill.md', content)
      ).toThrow(SkillParseError);
    });

    it('rejects subscription entry missing table -> error', () => {
      // Given a skill file with a subscription entry missing the table field
      const content = createSkillContent({
        subscriptions: [
          '  - description: Subscription without table name',
        ].join('\n'),
      });

      // When parseSkillFile is called
      // Then it should throw SkillParseError
      expect(() =>
        parseSkillFile('no-sub-table.skill.md', content)
      ).toThrow(SkillParseError);
    });

    it('rejects param entry missing type -> MISSING_REQUIRED_FIELD', () => {
      // Given a skill file with a param entry missing the type field
      const content = createSkillContent({
        params: [
          '  - name: target_id',
          '    description: Target entity with no type',
        ].join('\n'),
      });

      // When parseSkillFile is called
      // Then it should throw SkillParseError with MISSING_REQUIRED_FIELD
      try {
        parseSkillFile('no-param-type.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('no-param-type.skill.md');
      }
    });

    it('rejects param entry missing description -> MISSING_REQUIRED_FIELD', () => {
      // Given a skill file with a param entry missing the description field
      const content = createSkillContent({
        params: [
          '  - name: target_id',
          '    type: u64',
        ].join('\n'),
      });

      // When parseSkillFile is called
      // Then it should throw SkillParseError with MISSING_REQUIRED_FIELD
      try {
        parseSkillFile('no-param-desc.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('no-param-desc.skill.md');
      }
    });

    it('rejects subscription entry missing description -> error', () => {
      // Given a skill file with a subscription entry missing the description field
      const content = createSkillContent({
        subscriptions: [
          '  - table: player_state',
        ].join('\n'),
      });

      // When parseSkillFile is called
      // Then it should throw SkillParseError with MISSING_REQUIRED_FIELD
      try {
        parseSkillFile('no-sub-desc.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('no-sub-desc.skill.md');
      }
    });

    it('rejects missing description field -> MISSING_REQUIRED_FIELD', () => {
      // Given a skill file without the description field
      const content = [
        '---',
        'name: no_desc',
        'reducer: test_action',
        'params:',
        '  - name: target_id',
        '    type: u64',
        '    description: Target entity',
        'subscriptions:',
        '  - table: player_state',
        '    description: Current player state',
        '---',
        '',
        '# No Description Skill',
      ].join('\n');

      // When parseSkillFile is called
      // Then it should throw SkillParseError with MISSING_REQUIRED_FIELD
      expect(() =>
        parseSkillFile('no-desc.skill.md', content)
      ).toThrow(SkillParseError);
      try {
        parseSkillFile('no-desc.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('no-desc.skill.md');
        expect(err.fields).toContain('description');
      }
    });
  });

  describe('AC4 - Error message quality', () => {
    it('error message includes file path and field names for missing fields', () => {
      // Given a skill file missing multiple required fields (name and reducer)
      const content = [
        '---',
        'description: A skill missing name and reducer',
        'params:',
        '  - name: x',
        '    type: i32',
        '    description: X coordinate',
        'subscriptions:',
        '  - table: player_state',
        '    description: Player state',
        '---',
        '',
        '# Missing Fields',
      ].join('\n');

      // When parseSkillFile is called
      // Then the error message should be clear and actionable
      try {
        parseSkillFile('multi-missing.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        // Error message should identify the file
        expect(err.message).toContain('multi-missing.skill.md');
        // Error message should list the missing fields
        expect(err.message).toContain('name');
        expect(err.message).toContain('reducer');
        // filePath and fields should also be set for programmatic access
        expect(err.filePath).toBe('multi-missing.skill.md');
        expect(err.fields).toContain('name');
        expect(err.fields).toContain('reducer');
      }
    });

    it('error message for invalid reducer includes the invalid name', () => {
      // Given a skill file with an invalid reducer name
      const content = createSkillContent({ reducer: '"bad reducer!"' });

      // When parseSkillFile is called
      // Then the error message should include the invalid reducer name
      try {
        parseSkillFile('bad-reducer-msg.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('INVALID_REDUCER_NAME');
        // Error message should include the file path
        expect(err.message).toContain('bad-reducer-msg.skill.md');
        // Error message should include the invalid reducer name
        expect(err.message).toContain('bad reducer!');
      }
    });
  });
});
