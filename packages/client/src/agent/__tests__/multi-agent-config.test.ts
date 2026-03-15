/**
 * Multi-Agent Config Tests (AC: 2)
 * Story 4.7: Swappable Agent Configuration
 *
 * Tests that two Agent.md files with different personalities and skill
 * selections produce independent agent configurations with no shared
 * mutable state.
 *
 * Uses real temp files matching the pattern from config-stateless.test.ts (Story 4.2).
 *
 * Validates: AC2 (Multi-agent independence)
 *
 * Test count: 8
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadAgentConfig } from '../agent-config-loader.js';

/** Helper to create a temp directory with Agent.md and skills */
function createTempAgentDir(
  agentContent: string,
  skillFiles?: Record<string, string>
): { agentPath: string; skillsDir: string; tempDir: string } {
  const tempDir = mkdtempSync(join(tmpdir(), 'multi-agent-test-'));
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
function validSkillContent(name: string): string {
  return [
    '---',
    `name: ${name}`,
    `description: Test skill ${name}`,
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

describe('Multi-Agent Config Independence (Story 4.7, AC2)', () => {
  it('Agent 1 with skills A, B and Agent 2 with skills C, D -> independent configs', async () => {
    // Given two agent directories with different skill selections
    const dir1 = createTempAgentDir(
      ['# Agent: Agent One', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
        'skill-b.skill.md': validSkillContent('skill_b'),
      }
    );

    const dir2 = createTempAgentDir(
      ['# Agent: Agent Two', '', '## Skills', '- skill_c', '- skill_d'].join('\n'),
      {
        'skill-c.skill.md': validSkillContent('skill_c'),
        'skill-d.skill.md': validSkillContent('skill_d'),
      }
    );

    try {
      // When both agents are loaded
      const agent1 = await loadAgentConfig(dir1.agentPath, dir1.skillsDir);
      const agent2 = await loadAgentConfig(dir2.agentPath, dir2.skillsDir);

      // Then they have independent skills
      expect(agent1.skillNames).toEqual(['skill_a', 'skill_b']);
      expect(agent2.skillNames).toEqual(['skill_c', 'skill_d']);
    } finally {
      rmSync(dir1.tempDir, { recursive: true, force: true });
      rmSync(dir2.tempDir, { recursive: true, force: true });
    }
  });

  it('Agent 1 SkillRegistry does not contain Agent 2 skills', async () => {
    const dir1 = createTempAgentDir(
      ['# Agent: Agent One', '', '## Skills', '- skill_a'].join('\n'),
      { 'skill-a.skill.md': validSkillContent('skill_a') }
    );
    const dir2 = createTempAgentDir(
      ['# Agent: Agent Two', '', '## Skills', '- skill_c'].join('\n'),
      { 'skill-c.skill.md': validSkillContent('skill_c') }
    );

    try {
      const agent1 = await loadAgentConfig(dir1.agentPath, dir1.skillsDir);
      const agent2 = await loadAgentConfig(dir2.agentPath, dir2.skillsDir);

      // Agent 1's registry does NOT have Agent 2's skill
      expect(agent1.skillRegistry.get('skill_c')).toBeUndefined();
      // Agent 2's registry DOES have skill_c
      expect(agent2.skillRegistry.get('skill_c')).toBeDefined();
    } finally {
      rmSync(dir1.tempDir, { recursive: true, force: true });
      rmSync(dir2.tempDir, { recursive: true, force: true });
    }
  });

  it('Agent 2 SkillRegistry does not contain Agent 1 skills', async () => {
    const dir1 = createTempAgentDir(
      ['# Agent: Agent One', '', '## Skills', '- skill_a'].join('\n'),
      { 'skill-a.skill.md': validSkillContent('skill_a') }
    );
    const dir2 = createTempAgentDir(
      ['# Agent: Agent Two', '', '## Skills', '- skill_c'].join('\n'),
      { 'skill-c.skill.md': validSkillContent('skill_c') }
    );

    try {
      const agent1 = await loadAgentConfig(dir1.agentPath, dir1.skillsDir);
      const agent2 = await loadAgentConfig(dir2.agentPath, dir2.skillsDir);

      // Agent 2's registry does NOT have Agent 1's skill
      expect(agent2.skillRegistry.get('skill_a')).toBeUndefined();
      // Agent 1's registry DOES have skill_a
      expect(agent1.skillRegistry.get('skill_a')).toBeDefined();
    } finally {
      rmSync(dir1.tempDir, { recursive: true, force: true });
      rmSync(dir2.tempDir, { recursive: true, force: true });
    }
  });

  it('modifying Agent 1 config does not affect Agent 2 loaded config', async () => {
    // Given both agents share the same skills directory (same skill files)
    const sharedDir = mkdtempSync(join(tmpdir(), 'multi-agent-shared-'));
    const skillsDir = join(sharedDir, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, 'skill-a.skill.md'), validSkillContent('skill_a'), 'utf-8');
    writeFileSync(join(skillsDir, 'skill-b.skill.md'), validSkillContent('skill_b'), 'utf-8');

    const agent1Path = join(sharedDir, 'agent1.md');
    const agent2Path = join(sharedDir, 'agent2.md');
    writeFileSync(
      agent1Path,
      ['# Agent: Agent One', '', '## Skills', '- skill_a'].join('\n'),
      'utf-8'
    );
    writeFileSync(
      agent2Path,
      ['# Agent: Agent Two', '', '## Skills', '- skill_b'].join('\n'),
      'utf-8'
    );

    try {
      const agent2 = await loadAgentConfig(agent2Path, skillsDir);
      expect(agent2.skillNames).toEqual(['skill_b']);

      // Modify Agent 1's file
      writeFileSync(
        agent1Path,
        ['# Agent: Agent One Modified', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
        'utf-8'
      );

      // Agent 2's previously loaded config is unaffected (it's a separate object)
      expect(agent2.skillNames).toEqual(['skill_b']);
      expect(agent2.name).toBe('Agent Two');
    } finally {
      rmSync(sharedDir, { recursive: true, force: true });
    }
  });

  it('two agents with same skill name but different Agent.md files -> separate registries', async () => {
    // Both agents use skill_a but from their own skill directories
    const dir1 = createTempAgentDir(
      ['# Agent: Agent One', '', '## Skills', '- skill_a'].join('\n'),
      { 'skill-a.skill.md': validSkillContent('skill_a') }
    );
    const dir2 = createTempAgentDir(
      ['# Agent: Agent Two', '', '## Skills', '- skill_a'].join('\n'),
      { 'skill-a.skill.md': validSkillContent('skill_a') }
    );

    try {
      const agent1 = await loadAgentConfig(dir1.agentPath, dir1.skillsDir);
      const agent2 = await loadAgentConfig(dir2.agentPath, dir2.skillsDir);

      // Same skill name but different registry instances
      expect(agent1.skillRegistry).not.toBe(agent2.skillRegistry);
      expect(agent1.skillRegistry.get('skill_a')).toBeDefined();
      expect(agent2.skillRegistry.get('skill_a')).toBeDefined();
      // The skill objects are distinct instances
      expect(agent1.skillRegistry.get('skill_a')).not.toBe(agent2.skillRegistry.get('skill_a'));
    } finally {
      rmSync(dir1.tempDir, { recursive: true, force: true });
      rmSync(dir2.tempDir, { recursive: true, force: true });
    }
  });

  it('two agents loaded concurrently (Promise.all) -> both resolve independently', async () => {
    const dir1 = createTempAgentDir(
      ['# Agent: Concurrent One', '', '## Skills', '- skill_a'].join('\n'),
      { 'skill-a.skill.md': validSkillContent('skill_a') }
    );
    const dir2 = createTempAgentDir(
      ['# Agent: Concurrent Two', '', '## Skills', '- skill_b'].join('\n'),
      { 'skill-b.skill.md': validSkillContent('skill_b') }
    );

    try {
      // When loaded concurrently
      const [agent1, agent2] = await Promise.all([
        loadAgentConfig(dir1.agentPath, dir1.skillsDir),
        loadAgentConfig(dir2.agentPath, dir2.skillsDir),
      ]);

      // Then both resolved independently
      expect(agent1.name).toBe('Concurrent One');
      expect(agent2.name).toBe('Concurrent Two');
      expect(agent1.skillNames).toEqual(['skill_a']);
      expect(agent2.skillNames).toEqual(['skill_b']);
    } finally {
      rmSync(dir1.tempDir, { recursive: true, force: true });
      rmSync(dir2.tempDir, { recursive: true, force: true });
    }
  });

  it('agent names are different in each config', async () => {
    const dir1 = createTempAgentDir(
      ['# Agent: Explorer Bot', '', '## Skills', '- skill_a'].join('\n'),
      { 'skill-a.skill.md': validSkillContent('skill_a') }
    );
    const dir2 = createTempAgentDir(
      ['# Agent: Harvester Bot', '', '## Skills', '- skill_a'].join('\n'),
      { 'skill-a.skill.md': validSkillContent('skill_a') }
    );

    try {
      const agent1 = await loadAgentConfig(dir1.agentPath, dir1.skillsDir);
      const agent2 = await loadAgentConfig(dir2.agentPath, dir2.skillsDir);

      expect(agent1.name).toBe('Explorer Bot');
      expect(agent2.name).toBe('Harvester Bot');
      expect(agent1.name).not.toBe(agent2.name);
    } finally {
      rmSync(dir1.tempDir, { recursive: true, force: true });
      rmSync(dir2.tempDir, { recursive: true, force: true });
    }
  });

  it('personality descriptions are independent per agent', async () => {
    const dir1 = createTempAgentDir(
      [
        '# Agent: Agent One',
        '',
        '## Personality',
        'Cautious and methodical',
        '',
        '## Skills',
        '- skill_a',
      ].join('\n'),
      { 'skill-a.skill.md': validSkillContent('skill_a') }
    );
    const dir2 = createTempAgentDir(
      [
        '# Agent: Agent Two',
        '',
        '## Personality',
        'Bold and aggressive',
        '',
        '## Skills',
        '- skill_a',
      ].join('\n'),
      { 'skill-a.skill.md': validSkillContent('skill_a') }
    );

    try {
      const agent1 = await loadAgentConfig(dir1.agentPath, dir1.skillsDir);
      const agent2 = await loadAgentConfig(dir2.agentPath, dir2.skillsDir);

      expect(agent1.personality).toBe('Cautious and methodical');
      expect(agent2.personality).toBe('Bold and aggressive');
    } finally {
      rmSync(dir1.tempDir, { recursive: true, force: true });
      rmSync(dir2.tempDir, { recursive: true, force: true });
    }
  });
});
