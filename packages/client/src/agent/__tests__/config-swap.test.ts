/**
 * Config Swap Tests (AC: 1)
 * Story 4.7: Swappable Agent Configuration
 *
 * Tests that modifying Agent.md to reference different skill files
 * results in a completely new configuration after reload. Old skills
 * are removed, new skills take effect.
 *
 * Uses real temp files (not vi.mock) to simulate file changes between calls,
 * matching the pattern from config-stateless.test.ts (Story 4.2).
 *
 * Validates: AC1 (Skill set swap on restart)
 *
 * Test count: 10
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadAgentConfig, reloadAgentConfig } from '../agent-config-loader.js';

/** Helper to create a temp directory with Agent.md and skills */
function createTempAgentDir(
  agentContent: string,
  skillFiles?: Record<string, string>
): { agentPath: string; skillsDir: string; tempDir: string } {
  const tempDir = mkdtempSync(join(tmpdir(), 'config-swap-test-'));
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

/** Minimal valid skill file content */
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
    `Body for ${name}.`,
  ].join('\n');
}

describe('Config Swap on Restart (Story 4.7, AC1)', () => {
  it('reload with different Agent.md skill references -> only new skills active', async () => {
    // Given an agent with skills A, B
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Swap Bot', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
        'skill-b.skill.md': validSkillContent('skill_b'),
        'skill-c.skill.md': validSkillContent('skill_c'),
        'skill-d.skill.md': validSkillContent('skill_d'),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skillNames).toEqual(['skill_a', 'skill_b']);
      expect(first.skills).toHaveLength(2);

      // When Agent.md is modified to reference skills C, D
      writeFileSync(
        agentPath,
        ['# Agent: Swap Bot', '', '## Skills', '- skill_c', '- skill_d'].join('\n'),
        'utf-8'
      );

      // Then reload returns only C, D
      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skillNames).toEqual(['skill_c', 'skill_d']);
      expect(second.skills).toHaveLength(2);
      expect(second.skills.map((s) => s.name)).toEqual(['skill_c', 'skill_d']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('old skills A, B no longer in SkillRegistry after swap to C, D', async () => {
    // Given agent with skills A, B
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Registry Bot', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
        'skill-b.skill.md': validSkillContent('skill_b'),
        'skill-c.skill.md': validSkillContent('skill_c'),
        'skill-d.skill.md': validSkillContent('skill_d'),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skillRegistry.get('skill_a')).toBeDefined();
      expect(first.skillRegistry.get('skill_b')).toBeDefined();

      // Swap to C, D
      writeFileSync(
        agentPath,
        ['# Agent: Registry Bot', '', '## Skills', '- skill_c', '- skill_d'].join('\n'),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);

      // Then old skills are NOT in new registry
      expect(second.skillRegistry.get('skill_a')).toBeUndefined();
      expect(second.skillRegistry.get('skill_b')).toBeUndefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('new skills C, D are in SkillRegistry after swap', async () => {
    // Given agent with skills A, B
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: New Skills Bot', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
        'skill-b.skill.md': validSkillContent('skill_b'),
        'skill-c.skill.md': validSkillContent('skill_c'),
        'skill-d.skill.md': validSkillContent('skill_d'),
      }
    );

    try {
      // Swap to C, D
      writeFileSync(
        agentPath,
        ['# Agent: New Skills Bot', '', '## Skills', '- skill_c', '- skill_d'].join('\n'),
        'utf-8'
      );

      const config = await reloadAgentConfig(agentPath, skillsDir);

      // Then new skills ARE in registry
      expect(config.skillRegistry.get('skill_c')).toBeDefined();
      expect(config.skillRegistry.get('skill_d')).toBeDefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reload produces a new ResolvedAgentConfig instance (not mutated original)', async () => {
    // Given agent loaded once
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Instance Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      const second = await reloadAgentConfig(agentPath, skillsDir);

      // Then they are different object references
      expect(first).not.toBe(second);
      expect(first.skills).not.toBe(second.skills);
      expect(first.skillRegistry).not.toBe(second.skillRegistry);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reloadAgentConfig() reads fresh from disk (mocked-equivalent via real files)', async () => {
    // Given an agent loaded, then file changed
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Fresh Read Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
        'skill-b.skill.md': validSkillContent('skill_b'),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skillNames).toEqual(['skill_a']);

      // Modify on disk
      writeFileSync(
        agentPath,
        ['# Agent: Fresh Read Bot', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skillNames).toEqual(['skill_a', 'skill_b']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Agent.md personality change reflected after reload', async () => {
    // Given agent with personality
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      [
        '# Agent: Personality Bot',
        '',
        '## Personality',
        'Cautious and defensive',
        '',
        '## Skills',
        '- skill_a',
      ].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.personality).toBe('Cautious and defensive');

      // Update personality
      writeFileSync(
        agentPath,
        [
          '# Agent: Personality Bot',
          '',
          '## Personality',
          'Aggressive and exploratory',
          '',
          '## Skills',
          '- skill_a',
        ].join('\n'),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.personality).toBe('Aggressive and exploratory');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Agent.md budget change reflected after reload', async () => {
    // Given agent with budget of 100 ILP/session
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      [
        '# Agent: Budget Swap Bot',
        '',
        '## Skills',
        '- skill_a',
        '',
        '## Budget',
        '100 ILP/session',
      ].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.budget?.limit).toBe(100);

      // Update budget
      writeFileSync(
        agentPath,
        [
          '# Agent: Budget Swap Bot',
          '',
          '## Skills',
          '- skill_a',
          '',
          '## Budget',
          '500 ILP/session',
        ].join('\n'),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.budget?.limit).toBe(500);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Agent.md removes budget section -> reload -> budget is undefined', async () => {
    // Given agent with budget
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      [
        '# Agent: Budget Remove Bot',
        '',
        '## Skills',
        '- skill_a',
        '',
        '## Budget',
        '100 ILP/session',
      ].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.budget).toBeDefined();

      // Remove budget section
      writeFileSync(
        agentPath,
        ['# Agent: Budget Remove Bot', '', '## Skills', '- skill_a'].join('\n'),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.budget).toBeUndefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Agent.md adds new skill -> reload -> new skill available', async () => {
    // Given agent with skill_a only
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Add Skill Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
        'skill-b.skill.md': validSkillContent('skill_b'),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skillNames).toEqual(['skill_a']);

      // Add skill_b
      writeFileSync(
        agentPath,
        ['# Agent: Add Skill Bot', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skillNames).toEqual(['skill_a', 'skill_b']);
      expect(second.skillRegistry.get('skill_b')).toBeDefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Agent.md removes a skill -> reload -> removed skill no longer available', async () => {
    // Given agent with skills A and B
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Remove Skill Bot', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
        'skill-b.skill.md': validSkillContent('skill_b'),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skillNames).toEqual(['skill_a', 'skill_b']);

      // Remove skill_b
      writeFileSync(
        agentPath,
        ['# Agent: Remove Skill Bot', '', '## Skills', '- skill_a'].join('\n'),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skillNames).toEqual(['skill_a']);
      expect(second.skillRegistry.get('skill_b')).toBeUndefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
