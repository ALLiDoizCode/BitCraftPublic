/**
 * Skill Registry Tests (AC: 3, 5)
 * Story 4.1: Skill File Format & Parser
 *
 * Tests for SkillRegistry class and createSkillRegistryFromDirectory() factory.
 * Validates uniform consumption format (AC5, NFR21) and registry operations.
 *
 * Validates: AC3 (action registry), AC5 (uniform consumption format)
 *
 * Test count: 10
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SkillRegistry,
  createSkillRegistryFromDirectory,
} from '../skill-registry.js';
import { parseSkillFile } from '../skill-parser.js';
import { SkillParseError } from '../types.js';
import type { Skill } from '../types.js';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'skills');

/**
 * Factory to create a test Skill object
 */
function createTestSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'test_skill',
    description: 'A test skill',
    reducer: 'test_action',
    params: [
      {
        name: 'target_id',
        type: 'u64',
        description: 'Target entity ID',
      },
    ],
    subscriptions: [
      {
        table: 'player_state',
        description: 'Current player state',
      },
    ],
    body: '# Test Skill\n\nA test skill body.',
    evals: [],
    ...overrides,
  };
}

describe('Skill Registry (Story 4.1)', () => {
  describe('AC3 & AC5 - Registry operations', () => {
    it('register and retrieve skill by name', () => {
      // Given a new registry
      const registry = new SkillRegistry();
      const skill = createTestSkill({ name: 'player_move' });

      // When a skill is registered
      registry.register(skill);

      // Then it should be retrievable by name
      const retrieved = registry.get('player_move');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('player_move');
      expect(retrieved!.reducer).toBe('test_action');
      expect(retrieved!.body).toBe('# Test Skill\n\nA test skill body.');
    });

    it('duplicate name registration -> SkillParseError with DUPLICATE_SKILL_NAME', () => {
      // Given a registry with a registered skill
      const registry = new SkillRegistry();
      const skill1 = createTestSkill({ name: 'player_move' });
      const skill2 = createTestSkill({
        name: 'player_move',
        reducer: 'different_action',
      });
      registry.register(skill1);

      // When registering a skill with the same name
      // Then it should throw SkillParseError with DUPLICATE_SKILL_NAME
      expect(() => registry.register(skill2)).toThrow(SkillParseError);
      try {
        registry.register(skill2);
      } catch (e) {
        const err = e as SkillParseError;
        expect(err.code).toBe('DUPLICATE_SKILL_NAME');
        // filePath should be the sentinel '<registry>' since no file path is available
        expect(err.filePath).toBe('<registry>');
      }
    });

    it('get non-existent skill -> undefined', () => {
      // Given an empty registry
      const registry = new SkillRegistry();

      // When getting a non-existent skill
      const result = registry.get('nonexistent');

      // Then it should return undefined
      expect(result).toBeUndefined();
    });

    it('getAll() returns all registered skills', () => {
      // Given a registry with 3 skills
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ name: 'skill_a' }));
      registry.register(createTestSkill({ name: 'skill_b' }));
      registry.register(createTestSkill({ name: 'skill_c' }));

      // When getAll() is called
      const all = registry.getAll();

      // Then all 3 skills should be returned
      expect(all).toHaveLength(3);
      const names = all.map((s) => s.name).sort();
      expect(names).toEqual(['skill_a', 'skill_b', 'skill_c']);
    });

    it('getAllMetadata() returns metadata only (no body, no evals)', () => {
      // Given a registry with a skill that has body and evals
      const registry = new SkillRegistry();
      registry.register(
        createTestSkill({
          name: 'skill_with_body',
          body: '# Full body content here',
          evals: [
            {
              prompt: 'Test prompt',
              expected: { reducer: 'test_action', args: [1] },
              criteria: 'Test criteria',
            },
          ],
        })
      );

      // When getAllMetadata() is called
      const metadata = registry.getAllMetadata();

      // Then metadata should NOT include body or evals
      expect(metadata).toHaveLength(1);
      expect(metadata[0].name).toBe('skill_with_body');
      expect(metadata[0]).not.toHaveProperty('body');
      expect(metadata[0]).not.toHaveProperty('evals');
      // But should include all metadata fields
      expect(metadata[0].reducer).toBe('test_action');
      expect(metadata[0].params).toHaveLength(1);
      expect(metadata[0].subscriptions).toHaveLength(1);
    });

    it('has() returns true for registered skill, false for unregistered', () => {
      // Given a registry with one skill
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ name: 'existing_skill' }));

      // When has() is called
      // Then it should return true for existing and false for non-existing
      expect(registry.has('existing_skill')).toBe(true);
      expect(registry.has('nonexistent_skill')).toBe(false);
    });

    it('size getter accurate after add/clear', () => {
      // Given a registry
      const registry = new SkillRegistry();

      // Then initial size should be 0
      expect(registry.size).toBe(0);

      // When skills are added
      registry.register(createTestSkill({ name: 'skill_a' }));
      registry.register(createTestSkill({ name: 'skill_b' }));

      // Then size should reflect additions
      expect(registry.size).toBe(2);

      // When clear() is called
      registry.clear();

      // Then size should be 0 again
      expect(registry.size).toBe(0);
    });
  });

  describe('createSkillRegistryFromDirectory()', () => {
    it('integrates loader + registry from fixture directory', async () => {
      // Given the fixtures directory with 3 prototype skill files
      const { registry, errors } =
        await createSkillRegistryFromDirectory(FIXTURES_DIR);

      // Then all 3 skills should be registered
      expect(registry.size).toBe(3);
      expect(errors).toHaveLength(0);

      // And skills should be retrievable by name
      expect(registry.has('player_move')).toBe(true);
      expect(registry.has('harvest_resource')).toBe(true);
      expect(registry.has('craft_item')).toBe(true);

      // And the full skill data should be available
      const playerMove = registry.get('player_move');
      expect(playerMove).toBeDefined();
      expect(playerMove!.reducer).toBe('player_move');
      expect(playerMove!.body).toContain('# Player Move');
    });
  });

  describe('AC5 - Uniform consumption format (NFR21)', () => {
    it('registry preserves all fields from parseSkillFile() output (round-trip integrity)', () => {
      // Given a skill parsed directly from file content
      const content = readFileSync(
        join(FIXTURES_DIR, 'harvest-resource.skill.md'),
        'utf-8'
      );
      const parsedSkill = parseSkillFile(
        'harvest-resource.skill.md',
        content
      );

      // When the parsed skill is registered and then retrieved
      const registry = new SkillRegistry();
      registry.register(parsedSkill);
      const retrieved = registry.get('harvest_resource');

      // Then the retrieved skill should be structurally identical to the parsed skill
      // This proves uniform consumption: direct parse and registry access produce the same format
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe(parsedSkill.name);
      expect(retrieved!.description).toBe(parsedSkill.description);
      expect(retrieved!.reducer).toBe(parsedSkill.reducer);
      expect(retrieved!.params).toEqual(parsedSkill.params);
      expect(retrieved!.subscriptions).toEqual(parsedSkill.subscriptions);
      expect(retrieved!.tags).toEqual(parsedSkill.tags);
      expect(retrieved!.body).toBe(parsedSkill.body);
      expect(retrieved!.evals).toEqual(parsedSkill.evals);
    });

    it('createSkillRegistryFromDirectory() output matches direct parseSkillFile() for each skill', async () => {
      // Given the fixtures directory loaded via the convenience factory
      const { registry } =
        await createSkillRegistryFromDirectory(FIXTURES_DIR);

      // And the same file parsed directly
      const craftContent = readFileSync(
        join(FIXTURES_DIR, 'craft-item.skill.md'),
        'utf-8'
      );
      const directParsed = parseSkillFile(
        join(FIXTURES_DIR, 'craft-item.skill.md'),
        craftContent
      );

      // When retrieving from the registry
      const registrySkill = registry.get('craft_item');

      // Then both access paths should yield the same skill data
      // proving NFR21 uniform consumption across all frontends
      expect(registrySkill).toBeDefined();
      expect(registrySkill!.name).toBe(directParsed.name);
      expect(registrySkill!.description).toBe(directParsed.description);
      expect(registrySkill!.reducer).toBe(directParsed.reducer);
      expect(registrySkill!.params).toEqual(directParsed.params);
      expect(registrySkill!.subscriptions).toEqual(directParsed.subscriptions);
      expect(registrySkill!.tags).toEqual(directParsed.tags);
      expect(registrySkill!.evals).toEqual(directParsed.evals);
      // Body comparison: registry stores using filePath from loader (absolute),
      // direct parse uses the filePath we provide -- bodies should still match
      // since body is file content, not filePath-dependent
      expect(registrySkill!.body).toBe(directParsed.body);
    });
  });
});
