/**
 * Stateless Configuration Tests (AC: 6)
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Tests that Agent.md is re-read from disk on every call (no caching).
 * Uses real temp files (not vi.mock) to simulate file changes between calls.
 *
 * Validates: AC6 (stateless configuration, NFR25)
 *
 * Test count: 5
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
  const tempDir = mkdtempSync(join(tmpdir(), 'config-stateless-test-'));
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

describe('Stateless Configuration (Story 4.2, AC6)', () => {
  it('loadAgentConfig() reads file from disk each time (no cache)', async () => {
    // Given a valid Agent.md on disk
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Original Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      // When loadAgentConfig is called twice
      const first = await loadAgentConfig(agentPath, skillsDir);
      const second = await loadAgentConfig(agentPath, skillsDir);

      // Then both calls should return valid configs (no stale cache issues)
      expect(first.name).toBe('Original Bot');
      expect(second.name).toBe('Original Bot');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('modify Agent.md between calls -> second call returns updated config', async () => {
    // Given an Agent.md on disk
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Version One', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
        'skill-b.skill.md': validSkillContent('skill_b'),
      }
    );

    try {
      // Load first version
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.name).toBe('Version One');
      expect(first.skillNames).toEqual(['skill_a']);

      // Modify Agent.md on disk
      writeFileSync(
        agentPath,
        ['# Agent: Version Two', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
        'utf-8'
      );

      // When loadAgentConfig is called again
      const second = await loadAgentConfig(agentPath, skillsDir);

      // Then it should return the updated config
      expect(second.name).toBe('Version Two');
      expect(second.skillNames).toEqual(['skill_a', 'skill_b']);
      expect(second.skills).toHaveLength(2);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('modify skill file between calls -> second call returns updated skill', async () => {
    // Given an Agent.md and a skill file on disk
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Skill Change Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      // Load first version
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skills[0].description).toBe('Test skill skill_a');

      // Modify skill file on disk
      writeFileSync(
        join(skillsDir, 'skill-a.skill.md'),
        [
          '---',
          'name: skill_a',
          'description: Updated description for skill_a',
          'reducer: skill_a',
          'params:',
          '  - name: target_id',
          '    type: u64',
          '    description: Target entity ID',
          'subscriptions:',
          '  - table: player_state',
          '    description: Current player state',
          '---',
          '',
          '# Updated Skill A',
        ].join('\n'),
        'utf-8'
      );

      // When loadAgentConfig is called again
      const second = await loadAgentConfig(agentPath, skillsDir);

      // Then it should return the updated skill description
      expect(second.skills[0].description).toBe('Updated description for skill_a');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reloadAgentConfig() is functionally identical to loadAgentConfig() (same result for same inputs)', async () => {
    // Given a valid Agent.md and skills
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Identity Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      // When both loadAgentConfig and reloadAgentConfig are called
      const loaded = await loadAgentConfig(agentPath, skillsDir);
      const reloaded = await reloadAgentConfig(agentPath, skillsDir);

      // Then both should return equivalent configs
      expect(reloaded.name).toBe(loaded.name);
      expect(reloaded.skillNames).toEqual(loaded.skillNames);
      expect(reloaded.skills).toHaveLength(loaded.skills.length);
      expect(reloaded.skills[0].name).toBe(loaded.skills[0].name);
      expect(reloaded.skills[0].description).toBe(loaded.skills[0].description);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('config does not persist state between load calls', async () => {
    // Given an Agent.md loaded with budget, then modified to remove budget
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      [
        '# Agent: Budget Bot',
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
      // Load first version (with budget)
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.budget).toBeDefined();
      expect(first.budget!.limit).toBe(100);

      // Modify Agent.md to remove budget
      writeFileSync(
        agentPath,
        ['# Agent: Budget Bot', '', '## Skills', '- skill_a'].join('\n'),
        'utf-8'
      );

      // When loadAgentConfig is called again
      const second = await loadAgentConfig(agentPath, skillsDir);

      // Then the budget should be undefined (no state persisted from first call)
      expect(second.budget).toBeUndefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
