/**
 * Skill Resolution Tests (AC: 2, 3, 6)
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Tests for loadAgentConfig() and reloadAgentConfig() that resolve
 * skill references from Agent.md against the skills directory.
 *
 * Validates: AC2 (skill reference resolution), AC3 (missing skill fail-fast),
 *            AC6 (stateless configuration)
 *
 * Test count: 12
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadAgentConfig, reloadAgentConfig } from '../agent-config-loader.js';
import { AgentConfigError } from '../agent-config-types.js';

const SKILLS_FIXTURES_DIR = join(__dirname, 'fixtures', 'skills');
const AGENTS_FIXTURES_DIR = join(__dirname, 'fixtures', 'agents');

/** Helper to create a temp directory with Agent.md and skills subdirectory */
function createTempAgentDir(
  agentContent: string,
  skillFiles?: Record<string, string>
): { agentPath: string; skillsDir: string; tempDir: string } {
  const tempDir = mkdtempSync(join(tmpdir(), 'agent-resolution-test-'));
  const agentPath = join(tempDir, 'agent.md');
  const skillsDir = join(tempDir, 'skills');
  mkdirSync(skillsDir, { recursive: true });

  writeFileSync(agentPath, agentContent, 'utf-8');

  if (skillFiles) {
    for (const [name, content] of Object.entries(skillFiles)) {
      writeFileSync(join(skillsDir, name), content, 'utf-8');
    }
  }

  return { agentPath, skillsDir, tempDir };
}

/** Minimal valid skill file content for test factories */
function validSkillContent(name: string, description?: string): string {
  return [
    '---',
    `name: ${name}`,
    `description: ${description ?? `Test skill ${name}`}`,
    `reducer: ${name}`,
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
    '',
    `Test body for ${name}.`,
  ].join('\n');
}

/**
 * Helper to assert that loadAgentConfig throws an AgentConfigError with the expected code.
 * Replaces the anti-pattern of expect().rejects.toThrow() + try/catch.
 */
async function expectLoadError(
  agentPath: string,
  skillsDir: string,
  expectedCode: string,
  expectedFields?: string[]
): Promise<void> {
  let thrownError: unknown;
  try {
    await loadAgentConfig(agentPath, skillsDir);
  } catch (e) {
    thrownError = e;
  }
  expect(thrownError).toBeInstanceOf(AgentConfigError);
  const err = thrownError as AgentConfigError;
  expect(err.code).toBe(expectedCode);
  if (expectedFields) {
    for (const field of expectedFields) {
      expect(err.fields).toContain(field);
    }
  }
}

describe('Skill Resolution (Story 4.2)', () => {
  describe('AC2 - Skill reference resolution', () => {
    it('Agent.md references 3 skills present in directory -> all resolved, ResolvedAgentConfig returned', async () => {
      // Given an Agent.md referencing 3 skills that exist in the skills directory
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        ['# Agent: Test Bot', '', '## Skills', '- skill_a', '- skill_b', '- skill_c'].join('\n'),
        {
          'skill-a.skill.md': validSkillContent('skill_a'),
          'skill-b.skill.md': validSkillContent('skill_b'),
          'skill-c.skill.md': validSkillContent('skill_c'),
        }
      );

      try {
        // When loadAgentConfig is called
        const resolved = await loadAgentConfig(agentPath, skillsDir);

        // Then all 3 skills should be resolved
        expect(resolved.skills).toHaveLength(3);
        expect(resolved.skillNames).toEqual(['skill_a', 'skill_b', 'skill_c']);
        expect(resolved.name).toBe('Test Bot');

        // And each skill should be a full Skill object
        const names = resolved.skills.map((s) => s.name).sort();
        expect(names).toEqual(['skill_a', 'skill_b', 'skill_c']);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('only referenced skills are active in returned SkillRegistry (non-referenced skills excluded)', async () => {
      // Given an Agent.md referencing 2 of 4 available skills
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        ['# Agent: Selective Bot', '', '## Skills', '- skill_a', '- skill_c'].join('\n'),
        {
          'skill-a.skill.md': validSkillContent('skill_a'),
          'skill-b.skill.md': validSkillContent('skill_b'),
          'skill-c.skill.md': validSkillContent('skill_c'),
          'skill-d.skill.md': validSkillContent('skill_d'),
        }
      );

      try {
        // When loadAgentConfig is called
        const resolved = await loadAgentConfig(agentPath, skillsDir);

        // Then only the 2 referenced skills should be in the registry
        expect(resolved.skillRegistry.size).toBe(2);
        expect(resolved.skillRegistry.has('skill_a')).toBe(true);
        expect(resolved.skillRegistry.has('skill_c')).toBe(true);

        // And non-referenced skills should NOT be in the registry
        expect(resolved.skillRegistry.has('skill_b')).toBe(false);
        expect(resolved.skillRegistry.has('skill_d')).toBe(false);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('SkillRegistry.size matches number of referenced skills', async () => {
      // Given an Agent.md referencing 2 skills
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        ['# Agent: Two Skill Bot', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
        {
          'skill-a.skill.md': validSkillContent('skill_a'),
          'skill-b.skill.md': validSkillContent('skill_b'),
        }
      );

      try {
        // When loadAgentConfig is called
        const resolved = await loadAgentConfig(agentPath, skillsDir);

        // Then the registry size should match the number of referenced skills
        expect(resolved.skillRegistry.size).toBe(2);
        expect(resolved.skills).toHaveLength(2);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('AC3 - Missing skill fail-fast', () => {
    it('Agent.md references skill not in directory -> AgentConfigError with SKILL_NOT_FOUND, skill name in fields', async () => {
      // Given an Agent.md referencing a skill that does not exist
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        ['# Agent: Missing Skill Bot', '', '## Skills', '- skill_a', '- nonexistent_skill'].join(
          '\n'
        ),
        {
          'skill-a.skill.md': validSkillContent('skill_a'),
        }
      );

      try {
        // When/Then it should throw AgentConfigError with SKILL_NOT_FOUND
        await expectLoadError(agentPath, skillsDir, 'SKILL_NOT_FOUND', ['nonexistent_skill']);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('multiple missing skills -> all listed in error fields array', async () => {
      // Given an Agent.md referencing 3 missing skills
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        [
          '# Agent: All Missing Bot',
          '',
          '## Skills',
          '- missing_a',
          '- missing_b',
          '- missing_c',
        ].join('\n'),
        {} // No skill files
      );

      try {
        // When/Then it should throw with all missing skill names in fields
        await expectLoadError(agentPath, skillsDir, 'SKILL_NOT_FOUND', [
          'missing_a',
          'missing_b',
          'missing_c',
        ]);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('agent does NOT start with partial skill set (fail-fast)', async () => {
      // Given an Agent.md with 3 skills, 1 missing
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        ['# Agent: Partial Bot', '', '## Skills', '- skill_a', '- skill_b', '- missing_skill'].join(
          '\n'
        ),
        {
          'skill-a.skill.md': validSkillContent('skill_a'),
          'skill-b.skill.md': validSkillContent('skill_b'),
        }
      );

      try {
        // When loadAgentConfig is called
        // Then it should throw (fail-fast, no partial skill set)
        await expect(loadAgentConfig(agentPath, skillsDir)).rejects.toThrow(AgentConfigError);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('skills directory with parse errors for non-referenced files -> resolved config succeeds', async () => {
      // Given a skills directory with a broken file that is NOT referenced
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        ['# Agent: Ignore Errors Bot', '', '## Skills', '- skill_a'].join('\n'),
        {
          'skill-a.skill.md': validSkillContent('skill_a'),
          'broken.skill.md': '---\nname: broken\n---\n# Broken (missing required fields)',
        }
      );

      try {
        // When loadAgentConfig is called
        // Then it should succeed because the broken file is not referenced
        const resolved = await loadAgentConfig(agentPath, skillsDir);
        expect(resolved.skills).toHaveLength(1);
        expect(resolved.skills[0].name).toBe('skill_a');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('skills directory with parse error for a referenced skill -> resolution fails with SKILL_NOT_FOUND', async () => {
      // Given a skills directory with a broken file that IS referenced
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        ['# Agent: Broken Ref Bot', '', '## Skills', '- skill_a', '- broken'].join('\n'),
        {
          'skill-a.skill.md': validSkillContent('skill_a'),
          'broken.skill.md': '---\nname: broken\n---\n# Broken (missing required fields)',
        }
      );

      try {
        // When/Then it should fail because the referenced skill failed to parse (treated as missing)
        await expectLoadError(agentPath, skillsDir, 'SKILL_NOT_FOUND', ['broken']);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('AC6 - Stateless configuration', () => {
    it('reloadAgentConfig() re-reads from disk (fresh parse)', async () => {
      // Given an Agent.md that is loaded then modified on disk
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        ['# Agent: First Name', '', '## Skills', '- skill_a'].join('\n'),
        {
          'skill-a.skill.md': validSkillContent('skill_a'),
          'skill-b.skill.md': validSkillContent('skill_b'),
        }
      );

      try {
        // Load the first version
        const first = await loadAgentConfig(agentPath, skillsDir);
        expect(first.name).toBe('First Name');
        expect(first.skillNames).toEqual(['skill_a']);

        // Modify Agent.md on disk
        writeFileSync(
          agentPath,
          ['# Agent: Updated Name', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
          'utf-8'
        );

        // When reloadAgentConfig is called
        const reloaded = await reloadAgentConfig(agentPath, skillsDir);

        // Then it should reflect the updated content
        expect(reloaded.name).toBe('Updated Name');
        expect(reloaded.skillNames).toEqual(['skill_a', 'skill_b']);
        expect(reloaded.skills).toHaveLength(2);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Error handling', () => {
    it('Agent.md file not found -> AgentConfigError with PARSE_ERROR', async () => {
      // Given a path to a non-existent Agent.md
      const nonExistent = '/tmp/definitely-does-not-exist-' + Date.now() + '/agent.md';
      const skillsDir = join(__dirname, 'fixtures', 'skills');

      // When/Then it should throw AgentConfigError with PARSE_ERROR
      let thrownError: unknown;
      try {
        await loadAgentConfig(nonExistent, skillsDir);
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toBeInstanceOf(AgentConfigError);
      expect((thrownError as AgentConfigError).code).toBe('PARSE_ERROR');
    });

    it('skills directory not found -> propagated error', async () => {
      // Given a valid Agent.md but non-existent skills directory
      const { agentPath, tempDir } = createTempAgentDir(
        ['# Agent: No Dir Bot', '', '## Skills', '- player_move'].join('\n')
      );
      const nonExistentDir = '/tmp/definitely-does-not-exist-skills-' + Date.now();

      try {
        // When loadAgentConfig is called
        // Then it should throw (skills directory not found)
        await expect(loadAgentConfig(agentPath, nonExistentDir)).rejects.toThrow();
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('empty skill references (filtered) -> MISSING_SKILLS_SECTION error', async () => {
      // Given an Agent.md with empty bullet items in Skills section
      const { agentPath, skillsDir, tempDir } = createTempAgentDir(
        ['# Agent: Empty Refs Bot', '', '## Skills', '- ', '-'].join('\n'),
        {
          'skill-a.skill.md': validSkillContent('skill_a'),
        }
      );

      try {
        // When loadAgentConfig is called
        // Then it should throw because no valid skill names were extracted
        await expect(loadAgentConfig(agentPath, skillsDir)).rejects.toThrow();
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
