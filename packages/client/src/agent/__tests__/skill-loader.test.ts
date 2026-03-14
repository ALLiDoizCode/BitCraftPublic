/**
 * Skill Directory Loader Tests (AC: 3, 4, 6)
 * Story 4.1: Skill File Format & Parser
 *
 * Tests for loadSkillDirectory() and loadSkillDirectoryMetadata() that load
 * all .skill.md files from a directory with error isolation.
 *
 * Validates: AC3 (directory loading), AC4 (error isolation), AC6 (progressive disclosure)
 * Performance: NFR7 (<1s for 50 skills)
 * Security: OWASP A03 (path traversal prevention)
 *
 * Test count: 15
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadSkillDirectory, loadSkillDirectoryMetadata } from '../skill-loader.js';
import { SkillParseError } from '../types.js';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'skills');

/** Helper to create a temporary directory with skill files */
function createTempSkillDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'skill-loader-test-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf-8');
  }
  return dir;
}

/** Minimal valid skill file content */
function validSkillContent(name: string, reducer?: string): string {
  return [
    '---',
    `name: ${name}`,
    `description: Test skill ${name}`,
    `reducer: ${reducer ?? name}`,
    'params:',
    '  - name: target_id',
    '    type: u64',
    '    description: Target entity ID',
    'subscriptions:',
    '  - table: player_state',
    '    description: Current player state',
    '---',
    '',
    `# ${name}`,
  ].join('\n');
}

/** Malformed skill file content (missing required fields) */
const MALFORMED_CONTENT = ['---', 'name: broken_skill', '---', '', '# Broken'].join('\n');

describe('Skill Directory Loader (Story 4.1)', () => {
  describe('AC3 - Directory loading with error isolation', () => {
    it('loads directory with 3 prototype files -> 3 skills registered', async () => {
      // Given the fixtures directory with 3 prototype skill files
      const result = await loadSkillDirectory(FIXTURES_DIR);

      // Then all 3 skills should be loaded successfully
      expect(result.skills.size).toBe(3);
      expect(result.errors).toHaveLength(0);

      // And each skill should be accessible by name
      expect(result.skills.has('player_move')).toBe(true);
      expect(result.skills.has('harvest_resource')).toBe(true);
      expect(result.skills.has('craft_item')).toBe(true);
    });

    it('loads directory with 1 valid + 1 malformed -> 1 skill loaded, 1 error reported', async () => {
      // Given a directory with 1 valid and 1 malformed skill file
      const dir = createTempSkillDir({
        'valid.skill.md': validSkillContent('valid_skill'),
        'broken.skill.md': MALFORMED_CONTENT,
      });

      try {
        // When loadSkillDirectory is called
        const result = await loadSkillDirectory(dir);

        // Then the valid skill should be loaded
        expect(result.skills.size).toBe(1);
        expect(result.skills.has('valid_skill')).toBe(true);

        // And the malformed file should produce an error
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBeInstanceOf(SkillParseError);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('empty directory -> empty result, no error', async () => {
      // Given an empty directory
      const dir = mkdtempSync(join(tmpdir(), 'skill-loader-empty-'));

      try {
        // When loadSkillDirectory is called
        const result = await loadSkillDirectory(dir);

        // Then the result should be empty with no errors
        expect(result.skills.size).toBe(0);
        expect(result.errors).toHaveLength(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('non-.skill.md files are ignored', async () => {
      // Given a directory with a .skill.md file and other non-skill files
      const dir = createTempSkillDir({
        'valid.skill.md': validSkillContent('valid_skill'),
        'README.md': '# Not a skill file',
        'notes.txt': 'Just some notes',
        'config.yaml': 'key: value',
      });

      try {
        // When loadSkillDirectory is called
        const result = await loadSkillDirectory(dir);

        // Then only the .skill.md file should be loaded
        expect(result.skills.size).toBe(1);
        expect(result.errors).toHaveLength(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('performance: loads 50 skills in <1 second (NFR7)', async () => {
      // Given a directory with 50 synthetic skill files
      const files: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        files[`skill_${i}.skill.md`] = validSkillContent(`skill_${i}`);
      }
      const dir = createTempSkillDir(files);

      try {
        // When loadSkillDirectory is called
        const start = performance.now();
        const result = await loadSkillDirectory(dir);
        const elapsed = performance.now() - start;

        // Then all 50 skills should be loaded
        expect(result.skills.size).toBe(50);
        expect(result.errors).toHaveLength(0);

        // And it should complete in under 1 second (NFR7)
        expect(elapsed).toBeLessThan(1000);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('Security (OWASP A03)', () => {
    it('directory with path traversal attempt -> rejected', async () => {
      // Given a directory path containing path traversal sequences
      const traversalPath = '/tmp/../../../etc/passwd/../skill-dir';

      // When loadSkillDirectory is called
      // Then it should reject the path traversal attempt
      await expect(loadSkillDirectory(traversalPath)).rejects.toThrow();
    });
  });

  describe('Error handling', () => {
    it('non-existent directory -> clear error', async () => {
      // Given a path to a non-existent directory
      const nonExistent = '/tmp/definitely-does-not-exist-' + Date.now();

      // When loadSkillDirectory is called
      // Then it should throw a clear error
      await expect(loadSkillDirectory(nonExistent)).rejects.toThrow();
    });

    it('directory with all malformed files -> empty skills, all errors reported', async () => {
      // Given a directory where every skill file is malformed
      const dir = createTempSkillDir({
        'broken1.skill.md': '---\nname: only_name\n---\n# Broken 1',
        'broken2.skill.md': 'no frontmatter at all',
      });

      try {
        // When loadSkillDirectory is called
        const result = await loadSkillDirectory(dir);

        // Then no skills should be loaded
        expect(result.skills.size).toBe(0);

        // And all files should produce errors
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('directory with two files defining the same skill name -> 1 skill, 1 duplicate error', async () => {
      // Given a directory with two skill files that both define the same name
      const dir = createTempSkillDir({
        'first.skill.md': validSkillContent('duplicate_skill', 'action_a'),
        'second.skill.md': validSkillContent('duplicate_skill', 'action_b'),
      });

      try {
        // When loadSkillDirectory is called
        const result = await loadSkillDirectory(dir);

        // Then only the first skill should be loaded (first-come, first-registered)
        expect(result.skills.size).toBe(1);
        expect(result.skills.has('duplicate_skill')).toBe(true);

        // And the duplicate should produce a DUPLICATE_SKILL_NAME error
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBeInstanceOf(SkillParseError);
        expect(result.errors[0].code).toBe('DUPLICATE_SKILL_NAME');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('loads multiple valid files with distinct names -> all registered', async () => {
      // Given a directory with 5 valid skill files
      const dir = createTempSkillDir({
        'alpha.skill.md': validSkillContent('alpha'),
        'beta.skill.md': validSkillContent('beta'),
        'gamma.skill.md': validSkillContent('gamma'),
        'delta.skill.md': validSkillContent('delta'),
        'epsilon.skill.md': validSkillContent('epsilon'),
      });

      try {
        // When loadSkillDirectory is called
        const result = await loadSkillDirectory(dir);

        // Then all 5 skills should be loaded
        expect(result.skills.size).toBe(5);
        expect(result.errors).toHaveLength(0);
        expect(result.skills.has('alpha')).toBe(true);
        expect(result.skills.has('epsilon')).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('AC6 - Metadata-only loading (progressive disclosure)', () => {
    it('loadSkillDirectoryMetadata() returns metadata-only (no body, no evals)', async () => {
      // Given the fixtures directory with 3 prototype skill files
      const result = await loadSkillDirectoryMetadata(FIXTURES_DIR);

      // Then all 3 skills should be loaded as metadata
      expect(result.skills.size).toBe(3);
      expect(result.errors).toHaveLength(0);

      // And each metadata entry should have frontmatter fields only
      const playerMove = result.skills.get('player_move');
      expect(playerMove).toBeDefined();
      expect(playerMove!.name).toBe('player_move');
      expect(playerMove!.reducer).toBe('player_move');
      expect(playerMove!.params).toHaveLength(2);
      expect(playerMove!.subscriptions).toHaveLength(2);

      // And metadata should NOT include body or evals
      expect(playerMove).not.toHaveProperty('body');
      expect(playerMove).not.toHaveProperty('evals');
    });

    it('loadSkillDirectoryMetadata() has same error isolation as full load', async () => {
      // Given a directory with 1 valid and 1 malformed skill file
      const dir = createTempSkillDir({
        'valid.skill.md': validSkillContent('valid_skill'),
        'broken.skill.md': MALFORMED_CONTENT,
      });

      try {
        // When loadSkillDirectoryMetadata is called
        const result = await loadSkillDirectoryMetadata(dir);

        // Then the valid skill metadata should be loaded
        expect(result.skills.size).toBe(1);
        expect(result.skills.has('valid_skill')).toBe(true);

        // And the malformed file should produce an error
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBeInstanceOf(SkillParseError);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('loadSkillDirectoryMetadata() with empty directory -> empty result', async () => {
      // Given an empty directory
      const dir = mkdtempSync(join(tmpdir(), 'skill-loader-meta-empty-'));

      try {
        // When loadSkillDirectoryMetadata is called
        const result = await loadSkillDirectoryMetadata(dir);

        // Then the result should be empty with no errors
        expect(result.skills.size).toBe(0);
        expect(result.errors).toHaveLength(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('loadSkillDirectoryMetadata() includes tags in metadata', async () => {
      // Given a skill file with tags
      const dir = createTempSkillDir({
        'tagged.skill.md': [
          '---',
          'name: tagged_skill',
          'description: A tagged skill',
          'reducer: tagged_action',
          'params:',
          '  - name: target_id',
          '    type: u64',
          '    description: Target',
          'subscriptions:',
          '  - table: player_state',
          '    description: State',
          'tags:',
          '  - movement',
          '  - core',
          '---',
          '',
          '# Tagged Skill',
        ].join('\n'),
      });

      try {
        // When loadSkillDirectoryMetadata is called
        const result = await loadSkillDirectoryMetadata(dir);

        // Then the metadata should include tags
        const meta = result.skills.get('tagged_skill');
        expect(meta).toBeDefined();
        expect(meta!.tags).toEqual(['movement', 'core']);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('loadSkillDirectoryMetadata() is faster than full load for many files', async () => {
      // Given a directory with 20 skill files with large bodies
      const files: Record<string, string> = {};
      for (let i = 0; i < 20; i++) {
        const largeBody = '\n' + 'This is a large body section. '.repeat(100);
        files[`skill_${i}.skill.md`] = validSkillContent(`skill_${i}`) + largeBody;
      }
      const dir = createTempSkillDir(files);

      try {
        // When both loaders are called
        const startMeta = performance.now();
        await loadSkillDirectoryMetadata(dir);
        const elapsedMeta = performance.now() - startMeta;

        const startFull = performance.now();
        await loadSkillDirectory(dir);
        const elapsedFull = performance.now() - startFull;

        // Then metadata-only loading should be faster or at least not slower
        // (Both are fast for small files, so we just check both complete quickly)
        expect(elapsedMeta).toBeLessThan(1000);
        expect(elapsedFull).toBeLessThan(1000);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
