/**
 * Skill Parser Tests (AC: 1, 4)
 * Story 4.1: Skill File Format & Parser
 *
 * Tests for parseSkillFile() function that extracts all fields from
 * SKILL.md files with YAML frontmatter and markdown body.
 *
 * Validates: AC1 (YAML frontmatter extraction), AC4 (malformed file error handling)
 * Security: OWASP A03 (injection prevention via YAML safe parsing, file size limits)
 *
 * Test count: 15
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSkillFile } from '../skill-parser.js';
import { SkillParseError } from '../types.js';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'skills');

/**
 * Helper to read a fixture file
 */
function readFixture(filename: string): string {
  return readFileSync(join(FIXTURES_DIR, filename), 'utf-8');
}

describe('Skill Parser (Story 4.1)', () => {
  describe('AC1 - YAML frontmatter field extraction', () => {
    it('parses player-move.skill.md prototype -> extracts all fields correctly', () => {
      // Given the player-move.skill.md prototype file
      const content = readFixture('player-move.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('player-move.skill.md', content);

      // Then all fields should be extracted correctly
      expect(skill.name).toBe('player_move');
      expect(skill.description).toBe(
        'Move the player character to a target hex coordinate on the game map.'
      );
      expect(skill.reducer).toBe('player_move');
      expect(skill.params).toHaveLength(2);
      expect(skill.params[0]).toEqual({
        name: 'target_x',
        type: 'i32',
        description: 'Target X coordinate on the hex grid',
      });
      expect(skill.params[1]).toEqual({
        name: 'target_y',
        type: 'i32',
        description: 'Target Y coordinate on the hex grid',
      });
      expect(skill.subscriptions).toHaveLength(2);
      expect(skill.subscriptions[0]).toEqual({
        table: 'player_state',
        description: 'Current player position and status',
      });
      expect(skill.subscriptions[1]).toEqual({
        table: 'terrain',
        description: 'Terrain data for pathfinding and obstacle detection',
      });
      expect(skill.tags).toEqual(['movement', 'core']);
      expect(skill.evals).toHaveLength(3);
      // Markdown body should be present
      expect(skill.body).toContain('# Player Move');
      expect(skill.body).toContain('## When to Use');
    });

    it('parses harvest-resource.skill.md -> extracts all fields including tags', () => {
      // Given the harvest-resource.skill.md prototype file
      const content = readFixture('harvest-resource.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('harvest-resource.skill.md', content);

      // Then all fields should be extracted
      expect(skill.name).toBe('harvest_resource');
      expect(skill.reducer).toBe('harvest_start');
      expect(skill.params).toHaveLength(1);
      expect(skill.params[0]).toEqual({
        name: 'resource_id',
        type: 'u64',
        description: 'The unique identifier of the resource node to harvest',
      });
      expect(skill.subscriptions).toHaveLength(3);
      expect(skill.tags).toEqual(['gathering', 'resource', 'economy']);
      expect(skill.evals).toHaveLength(4);
      expect(skill.body).toContain('# Harvest Resource');
    });

    it('parses craft-item.skill.md -> extracts default value for quantity param', () => {
      // Given the craft-item.skill.md prototype file
      const content = readFixture('craft-item.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('craft-item.skill.md', content);

      // Then the default value should be extracted
      expect(skill.name).toBe('craft_item');
      expect(skill.reducer).toBe('craft_item');
      expect(skill.params).toHaveLength(2);
      expect(skill.params[0]).toEqual({
        name: 'recipe_id',
        type: 'u64',
        description: 'The unique identifier of the crafting recipe to execute',
      });
      expect(skill.params[1]).toEqual({
        name: 'quantity',
        type: 'u32',
        description: 'Number of items to craft (default 1)',
        default: 1,
      });
      expect(skill.subscriptions).toHaveLength(4);
      expect(skill.tags).toEqual(['crafting', 'economy', 'production']);
    });

    it('ILP cost is NOT present in parsed output (verify absence)', () => {
      // Given a valid skill file
      const content = readFixture('player-move.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('player-move.skill.md', content);

      // Then no cost-related fields should be present
      // (ILP costs come from ActionCostRegistry, not skill files)
      expect(skill).not.toHaveProperty('cost');
      expect(skill).not.toHaveProperty('price');
      expect(skill).not.toHaveProperty('fee');
      expect(skill).not.toHaveProperty('ilpCost');
    });

    it('parses skill file with no tags -> tags is undefined', () => {
      // Given a valid skill file without optional tags field
      const content = [
        '---',
        'name: simple_skill',
        'description: A simple skill without tags',
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
        '# Simple Skill',
        '',
        'A simple skill for testing.',
      ].join('\n');

      // When parseSkillFile is called
      const skill = parseSkillFile('simple.skill.md', content);

      // Then tags should be undefined (optional field not present)
      expect(skill.tags).toBeUndefined();
      expect(skill.name).toBe('simple_skill');
    });
  });

  describe('AC4 - Malformed file error handling', () => {
    it('throws MISSING_FRONTMATTER for file without --- delimiters', () => {
      // Given content without frontmatter delimiters
      const content = 'This is just plain markdown with no frontmatter.';

      // When parseSkillFile is called
      // Then it should throw SkillParseError with MISSING_FRONTMATTER
      expect(() => parseSkillFile('no-front.skill.md', content)).toThrow(
        SkillParseError
      );
      try {
        parseSkillFile('no-front.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_FRONTMATTER');
        expect(err.filePath).toBe('no-front.skill.md');
      }
    });

    it('throws MISSING_REQUIRED_FIELD for empty frontmatter (---\\n---)', () => {
      // Given content with empty frontmatter
      const content = '---\n---\n\n# Empty Frontmatter';

      // When parseSkillFile is called
      // Then it should throw SkillParseError with MISSING_REQUIRED_FIELD
      expect(() => parseSkillFile('empty-front.skill.md', content)).toThrow(
        SkillParseError
      );
      try {
        parseSkillFile('empty-front.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('empty-front.skill.md');
      }
    });

    it('throws SkillParseError identifying file and missing name field', () => {
      // Given frontmatter missing the name field
      const content = [
        '---',
        'description: A skill without a name',
        'reducer: some_action',
        'params:',
        '  - name: x',
        '    type: i32',
        '    description: X coordinate',
        'subscriptions:',
        '  - table: player_state',
        '    description: Player state',
        '---',
        '',
        '# Nameless Skill',
      ].join('\n');

      // When parseSkillFile is called
      // Then it should throw identifying the file and missing field
      expect(() => parseSkillFile('nameless.skill.md', content)).toThrow(
        SkillParseError
      );
      try {
        parseSkillFile('nameless.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('nameless.skill.md');
        expect(err.fields).toContain('name');
      }
    });

    it('throws SkillParseError identifying file and missing reducer field', () => {
      // Given frontmatter missing the reducer field
      const content = [
        '---',
        'name: no_reducer_skill',
        'description: A skill without a reducer',
        'params:',
        '  - name: x',
        '    type: i32',
        '    description: X coordinate',
        'subscriptions:',
        '  - table: player_state',
        '    description: Player state',
        '---',
        '',
        '# No Reducer Skill',
      ].join('\n');

      // When parseSkillFile is called
      // Then it should throw identifying the missing reducer field
      expect(() =>
        parseSkillFile('no-reducer.skill.md', content)
      ).toThrow(SkillParseError);
      try {
        parseSkillFile('no-reducer.skill.md', content);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_REQUIRED_FIELD');
        expect(err.filePath).toBe('no-reducer.skill.md');
        expect(err.fields).toContain('reducer');
      }
    });

    it('rejects file >10MB with PARSE_ERROR (OWASP A03 DoS prevention)', () => {
      // Given content exceeding the 10MB limit
      const oversizedContent = '---\nname: big\n---\n' + 'x'.repeat(10 * 1024 * 1024 + 1);

      // When parseSkillFile is called
      // Then it should throw SkillParseError with PARSE_ERROR
      expect(() =>
        parseSkillFile('oversized.skill.md', oversizedContent)
      ).toThrow(SkillParseError);
      try {
        parseSkillFile('oversized.skill.md', oversizedContent);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('PARSE_ERROR');
        expect(err.filePath).toBe('oversized.skill.md');
      }
    });

    it('rejects YAML with custom tags (!!js/function) -- js-yaml DEFAULT_SCHEMA blocks code execution', () => {
      // Given YAML content with a dangerous custom tag
      // gray-matter uses js-yaml DEFAULT_SCHEMA which rejects !!js/function, !!python/object, etc.
      const content = [
        '---',
        'name: dangerous_skill',
        'description: !!js/function "function() { return process.exit(1); }"',
        'reducer: player_move',
        'params:',
        '  - name: x',
        '    type: i32',
        '    description: X coordinate',
        'subscriptions:',
        '  - table: player_state',
        '    description: Player state',
        '---',
        '',
        '# Dangerous Skill',
      ].join('\n');

      // When parseSkillFile is called
      // Then it should throw SkillParseError with INVALID_YAML
      // (js-yaml rejects custom tags in default schema, gray-matter propagates the error)
      try {
        parseSkillFile('dangerous.skill.md', content);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SkillParseError);
        const err = e as SkillParseError;
        expect(err.code).toBe('INVALID_YAML');
        expect(err.filePath).toBe('dangerous.skill.md');
      }
    });

    it('rejects content with text before frontmatter delimiters', () => {
      // Given content with non-YAML text before the --- delimiter
      const content = 'Some text before the frontmatter\n---\nname: test\n---\n# Body';

      // When parseSkillFile is called
      // Then it should throw MISSING_FRONTMATTER since content doesn't start with ---
      try {
        parseSkillFile('text-before.skill.md', content);
        expect.fail('Should have thrown SkillParseError');
      } catch (e) {
        expect(e).toBeInstanceOf(SkillParseError);
        const err = e as SkillParseError;
        expect(err.code).toBe('MISSING_FRONTMATTER');
        expect(err.filePath).toBe('text-before.skill.md');
      }
    });

    it('parses skill file with empty params array -> valid', () => {
      // Given a valid skill file with an empty params array (reducer takes no args besides identity)
      const content = [
        '---',
        'name: no_args_skill',
        'description: A skill with no parameters',
        'reducer: get_status',
        'params: []',
        'subscriptions:',
        '  - table: player_state',
        '    description: Current player state',
        '---',
        '',
        '# No Args Skill',
      ].join('\n');

      // When parseSkillFile is called
      const skill = parseSkillFile('no-args.skill.md', content);

      // Then the skill should parse with empty params
      expect(skill.name).toBe('no_args_skill');
      expect(skill.params).toEqual([]);
      expect(skill.reducer).toBe('get_status');
    });

    it('rejects YAML with !!python/object/apply tag (OWASP A03 code execution prevention)', () => {
      // Given YAML content with a Python code execution tag
      const content = [
        '---',
        'name: python_inject',
        'description: !!python/object/apply:os.system ["rm -rf /"]',
        'reducer: player_move',
        'params: []',
        'subscriptions: []',
        '---',
        '',
        '# Python Inject',
      ].join('\n');

      // When parseSkillFile is called
      // Then it should throw INVALID_YAML (js-yaml DEFAULT_SCHEMA rejects custom tags)
      try {
        parseSkillFile('python-inject.skill.md', content);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SkillParseError);
        const err = e as SkillParseError;
        expect(err.code).toBe('INVALID_YAML');
        expect(err.filePath).toBe('python-inject.skill.md');
      }
    });

    it('throws INVALID_YAML for malformed YAML content', () => {
      // Given content with invalid YAML (@ at start of value is always invalid YAML)
      const content = [
        '---',
        'name: bad_yaml',
        'description: @invalid_at_start_of_value',
        '---',
        '',
        '# Bad YAML',
      ].join('\n');

      // When parseSkillFile is called
      // Then it should throw SkillParseError with INVALID_YAML
      let caught: SkillParseError | undefined;
      try {
        parseSkillFile('bad-yaml.skill.md', content);
      } catch (e) {
        expect(e).toBeInstanceOf(SkillParseError);
        caught = e as SkillParseError;
      }
      expect(caught).toBeDefined();
      expect(caught!.code).toBe('INVALID_YAML');
      expect(caught!.filePath).toBe('bad-yaml.skill.md');
    });
  });
});
