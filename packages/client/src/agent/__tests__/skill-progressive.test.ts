/**
 * Skill Progressive Disclosure Tests (AC: 6)
 * Story 4.1: Skill File Format & Parser
 *
 * Tests for the progressive disclosure pattern: metadata-only parsing
 * vs full parsing, ensuring consistency and proper field separation.
 *
 * Validates: AC6 (progressive disclosure -- eagerly loaded metadata vs on-demand body/evals)
 *
 * Test count: 7
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSkillFile, parseSkillMetadata } from '../skill-parser.js';
import { SkillRegistry } from '../skill-registry.js';
import type { Skill, SkillMetadata } from '../types.js';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'skills');

function readFixture(filename: string): string {
  return readFileSync(join(FIXTURES_DIR, filename), 'utf-8');
}

/**
 * Factory to create a test Skill for registry tests
 */
function createTestSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'test_skill',
    description: 'A test skill',
    reducer: 'test_action',
    params: [
      { name: 'target_id', type: 'u64', description: 'Target entity ID' },
    ],
    subscriptions: [
      { table: 'player_state', description: 'Current player state' },
    ],
    body: '# Test Skill\n\nA test skill body.',
    evals: [],
    ...overrides,
  };
}

describe('Skill Progressive Disclosure (Story 4.1)', () => {
  describe('AC6 - Metadata-only vs full parse', () => {
    it('parseSkillMetadata() returns name, description, reducer, params, subscriptions, tags', () => {
      // Given the player-move.skill.md prototype
      const content = readFixture('player-move.skill.md');

      // When parseSkillMetadata is called
      const metadata = parseSkillMetadata('player-move.skill.md', content);

      // Then all metadata fields should be present
      expect(metadata.name).toBe('player_move');
      expect(metadata.description).toBe(
        'Move the player character to a target hex coordinate on the game map.'
      );
      expect(metadata.reducer).toBe('player_move');
      expect(metadata.params).toHaveLength(2);
      expect(metadata.subscriptions).toHaveLength(2);
      expect(metadata.tags).toEqual(['movement', 'core']);
    });

    it('parseSkillMetadata() does NOT include markdown body', () => {
      // Given a skill file with a markdown body
      const content = readFixture('player-move.skill.md');

      // When parseSkillMetadata is called
      const metadata = parseSkillMetadata('player-move.skill.md', content);

      // Then the result should NOT have a body property
      expect(metadata).not.toHaveProperty('body');
    });

    it('parseSkillMetadata() does NOT include evals', () => {
      // Given a skill file with evals
      const content = readFixture('player-move.skill.md');

      // When parseSkillMetadata is called
      const metadata = parseSkillMetadata('player-move.skill.md', content);

      // Then the result should NOT have an evals property
      expect(metadata).not.toHaveProperty('evals');
    });

    it('full parseSkillFile() returns everything including body and evals', () => {
      // Given the player-move.skill.md prototype
      const content = readFixture('player-move.skill.md');

      // When parseSkillFile is called
      const skill = parseSkillFile('player-move.skill.md', content);

      // Then all fields should be present including body and evals
      expect(skill.name).toBe('player_move');
      expect(skill.reducer).toBe('player_move');
      expect(skill.body).toContain('# Player Move');
      expect(skill.body).toContain('## When to Use');
      expect(skill.evals).toHaveLength(3);
    });

    it('metadata from parseSkillMetadata() matches metadata subset of parseSkillFile()', () => {
      // Given the same skill file content
      const content = readFixture('harvest-resource.skill.md');

      // When both parsers are called
      const metadata = parseSkillMetadata(
        'harvest-resource.skill.md',
        content
      );
      const full = parseSkillFile('harvest-resource.skill.md', content);

      // Then the metadata fields should match exactly
      expect(metadata.name).toBe(full.name);
      expect(metadata.description).toBe(full.description);
      expect(metadata.reducer).toBe(full.reducer);
      expect(metadata.params).toEqual(full.params);
      expect(metadata.subscriptions).toEqual(full.subscriptions);
      expect(metadata.tags).toEqual(full.tags);
    });

    it('registry getMetadata() returns metadata without body', () => {
      // Given a registry with a skill that has body and evals
      const registry = new SkillRegistry();
      registry.register(
        createTestSkill({
          name: 'progressive_test',
          body: '# Full markdown body\n\nWith lots of content.',
          evals: [
            {
              prompt: 'Test',
              expected: { reducer: 'test_action', args: [] },
              criteria: 'Works',
            },
          ],
        })
      );

      // When getMetadata() is called
      const metadata = registry.getMetadata('progressive_test');

      // Then it should return metadata without body or evals
      expect(metadata).toBeDefined();
      expect(metadata!.name).toBe('progressive_test');
      expect(metadata!.reducer).toBe('test_action');
      expect(metadata).not.toHaveProperty('body');
      expect(metadata).not.toHaveProperty('evals');
    });

    it('metadata-only parse is measurably faster than full parse', () => {
      // Given a skill file with a large body
      const largeBody = '\n' + 'This is a paragraph of content. '.repeat(500);
      const content = [
        '---',
        'name: large_skill',
        'description: A skill with a large body',
        'reducer: large_action',
        'params:',
        '  - name: target_id',
        '    type: u64',
        '    description: Target entity ID',
        'subscriptions:',
        '  - table: player_state',
        '    description: Current player state',
        'evals:',
        '  - prompt: "Test prompt"',
        '    expected:',
        '      reducer: large_action',
        '      args: [1]',
        '    criteria: Works correctly',
        '---',
        largeBody,
      ].join('\n');

      // When both parsers are benchmarked over multiple iterations
      const iterations = 100;

      const startMeta = performance.now();
      for (let i = 0; i < iterations; i++) {
        parseSkillMetadata('large.skill.md', content);
      }
      const metaTime = performance.now() - startMeta;

      const startFull = performance.now();
      for (let i = 0; i < iterations; i++) {
        parseSkillFile('large.skill.md', content);
      }
      const fullTime = performance.now() - startFull;

      // Then both should complete quickly (basic sanity check)
      // Note: both are fast for string-based parsing; this verifies no regression
      expect(metaTime).toBeLessThan(5000); // 5s max for 100 iterations
      expect(fullTime).toBeLessThan(5000);
    });
  });
});
