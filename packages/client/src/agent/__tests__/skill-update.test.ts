/**
 * Skill Update Tests (AC: 3)
 * Story 4.7: Swappable Agent Configuration
 *
 * Tests that modifying SKILL.md files on disk and reloading the agent
 * configuration results in updated skill definitions (new descriptions,
 * parameters, evals, reducers, body content).
 *
 * Uses real temp files matching the pattern from config-stateless.test.ts (Story 4.2).
 *
 * Validates: AC3 (Skill file update on restart)
 *
 * Test count: 7
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
  const tempDir = mkdtempSync(join(tmpdir(), 'skill-update-test-'));
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

/** Generate a valid skill file with customizable fields */
function skillContent(options: {
  name: string;
  description: string;
  reducer: string;
  params?: Array<{ name: string; type: string; description: string }>;
  evals?: Array<{ prompt: string; expected: string; criteria: string }>;
  body?: string;
}): string {
  const lines = [
    '---',
    `name: ${options.name}`,
    `description: ${options.description}`,
    `reducer: ${options.reducer}`,
    'params:',
  ];

  const params = options.params ?? [
    { name: 'target_id', type: 'u64', description: 'Target entity ID' },
  ];
  for (const param of params) {
    lines.push(`  - name: ${param.name}`);
    lines.push(`    type: ${param.type}`);
    lines.push(`    description: ${param.description}`);
  }

  lines.push('subscriptions:');
  lines.push('  - table: player_state');
  lines.push('    description: Current player state');

  if (options.evals) {
    lines.push('evals:');
    for (const evalEntry of options.evals) {
      lines.push(`  - prompt: "${evalEntry.prompt}"`);
      lines.push(`    expected: ${evalEntry.expected}`);
      lines.push(`    criteria: "${evalEntry.criteria}"`);
    }
  }

  lines.push('---');
  lines.push('');
  lines.push(options.body ?? `# ${options.name}\n\nDefault body for ${options.name}.`);

  return lines.join('\n');
}

describe('Skill File Update on Restart (Story 4.7, AC3)', () => {
  it('SKILL.md updated with new description -> reload -> new description used', async () => {
    // Given a skill with original description
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Update Bot', '', '## Skills', '- harvest_wood'].join('\n'),
      {
        'harvest-wood.skill.md': skillContent({
          name: 'harvest_wood',
          description: 'Harvest wood from trees',
          reducer: 'harvest_wood',
        }),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skills[0].description).toBe('Harvest wood from trees');

      // Update the skill file description on disk
      writeFileSync(
        join(skillsDir, 'harvest-wood.skill.md'),
        skillContent({
          name: 'harvest_wood',
          description: 'Efficiently harvest wood from nearby oak and pine trees',
          reducer: 'harvest_wood',
        }),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skills[0].description).toBe(
        'Efficiently harvest wood from nearby oak and pine trees'
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('SKILL.md updated with new parameters -> reload -> new params reflected', async () => {
    // Given a skill with one parameter
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Params Bot', '', '## Skills', '- build_shelter'].join('\n'),
      {
        'build-shelter.skill.md': skillContent({
          name: 'build_shelter',
          description: 'Build a shelter',
          reducer: 'build_shelter',
          params: [{ name: 'location_x', type: 'f64', description: 'X coordinate' }],
        }),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skills[0].params).toHaveLength(1);

      // Add a second parameter
      writeFileSync(
        join(skillsDir, 'build-shelter.skill.md'),
        skillContent({
          name: 'build_shelter',
          description: 'Build a shelter',
          reducer: 'build_shelter',
          params: [
            { name: 'location_x', type: 'f64', description: 'X coordinate' },
            { name: 'location_y', type: 'f64', description: 'Y coordinate' },
          ],
        }),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skills[0].params).toHaveLength(2);
      expect(second.skills[0].params[1].name).toBe('location_y');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('SKILL.md updated with added evals -> reload -> evals present', async () => {
    // Given a skill without evals
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Eval Bot', '', '## Skills', '- harvest_wood'].join('\n'),
      {
        'harvest-wood.skill.md': skillContent({
          name: 'harvest_wood',
          description: 'Harvest wood from trees',
          reducer: 'harvest_wood',
        }),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skills[0].evals).toHaveLength(0);

      // Add evals to the skill file
      writeFileSync(
        join(skillsDir, 'harvest-wood.skill.md'),
        skillContent({
          name: 'harvest_wood',
          description: 'Harvest wood from trees',
          reducer: 'harvest_wood',
          evals: [
            {
              prompt: 'There is an oak tree nearby',
              expected: 'skill_not_triggered',
              criteria: 'Should not trigger without explicit harvest request',
            },
          ],
        }),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skills[0].evals).toHaveLength(1);
      expect(second.skills[0].evals[0].prompt).toBe('There is an oak tree nearby');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('SKILL.md updated with changed reducer -> reload -> new reducer in skill', async () => {
    // Given a skill with reducer harvest_wood
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Reducer Bot', '', '## Skills', '- harvest_wood'].join('\n'),
      {
        'harvest-wood.skill.md': skillContent({
          name: 'harvest_wood',
          description: 'Harvest wood from trees',
          reducer: 'harvest_wood',
        }),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skills[0].reducer).toBe('harvest_wood');

      // Change reducer name
      writeFileSync(
        join(skillsDir, 'harvest-wood.skill.md'),
        skillContent({
          name: 'harvest_wood',
          description: 'Harvest wood from trees',
          reducer: 'harvest_resource',
        }),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skills[0].reducer).toBe('harvest_resource');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('SKILL.md body content updated -> reload -> new body content', async () => {
    // Given a skill with original body
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Body Bot', '', '## Skills', '- harvest_wood'].join('\n'),
      {
        'harvest-wood.skill.md': skillContent({
          name: 'harvest_wood',
          description: 'Harvest wood from trees',
          reducer: 'harvest_wood',
          body: '# Harvest Wood\n\nOriginal instructions for harvesting.',
        }),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skills[0].body).toContain('Original instructions');

      // Update body
      writeFileSync(
        join(skillsDir, 'harvest-wood.skill.md'),
        skillContent({
          name: 'harvest_wood',
          description: 'Harvest wood from trees',
          reducer: 'harvest_wood',
          body: '# Harvest Wood\n\nUpdated instructions with better strategy.',
        }),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skills[0].body).toContain('Updated instructions');
      expect(second.skills[0].body).not.toContain('Original instructions');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('multiple skill files updated simultaneously -> reload -> all updates reflected', async () => {
    // Given two skills
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Multi Update Bot', '', '## Skills', '- skill_a', '- skill_b'].join('\n'),
      {
        'skill-a.skill.md': skillContent({
          name: 'skill_a',
          description: 'Original A',
          reducer: 'skill_a',
        }),
        'skill-b.skill.md': skillContent({
          name: 'skill_b',
          description: 'Original B',
          reducer: 'skill_b',
        }),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skills[0].description).toBe('Original A');
      expect(first.skills[1].description).toBe('Original B');

      // Update both skill files
      writeFileSync(
        join(skillsDir, 'skill-a.skill.md'),
        skillContent({
          name: 'skill_a',
          description: 'Updated A with improvements',
          reducer: 'skill_a',
        }),
        'utf-8'
      );
      writeFileSync(
        join(skillsDir, 'skill-b.skill.md'),
        skillContent({
          name: 'skill_b',
          description: 'Updated B with refinements',
          reducer: 'skill_b',
        }),
        'utf-8'
      );

      const second = await reloadAgentConfig(agentPath, skillsDir);
      expect(second.skills[0].description).toBe('Updated A with improvements');
      expect(second.skills[1].description).toBe('Updated B with refinements');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('SKILL.md made invalid after initial load -> reload -> error thrown', async () => {
    // Given a valid skill
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Error Bot', '', '## Skills', '- harvest_wood'].join('\n'),
      {
        'harvest-wood.skill.md': skillContent({
          name: 'harvest_wood',
          description: 'Harvest wood from trees',
          reducer: 'harvest_wood',
        }),
      }
    );

    try {
      const first = await loadAgentConfig(agentPath, skillsDir);
      expect(first.skills[0].name).toBe('harvest_wood');

      // Corrupt the skill file (remove required fields)
      writeFileSync(
        join(skillsDir, 'harvest-wood.skill.md'),
        '---\nname: harvest_wood\n---\n\nNo description, no reducer, no params.',
        'utf-8'
      );

      // Reload should throw because the referenced skill is now invalid
      // loadAgentConfig resolves skill references -- invalid skill means missing skill
      await expect(reloadAgentConfig(agentPath, skillsDir)).rejects.toThrow();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
