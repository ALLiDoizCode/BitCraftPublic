/**
 * Config Versioning Tests (AC: 4)
 * Story 4.7: Swappable Agent Configuration
 *
 * Tests for configuration version computation: content hashing, skill versioning,
 * config snapshots, and decision log format compatibility.
 *
 * Tests cover:
 * - config-version.ts (computeContentHash, computeSkillVersion, computeConfigVersion,
 *   createConfigSnapshot, formatVersionForDecisionLog)
 * - versioned-config-loader.ts (readSkillContents, loadVersionedAgentConfig, reloadVersionedAgentConfig)
 *
 * IMPORTANT: computeContentHash tests do NOT mock node:crypto -- they use real
 * SHA-256 to verify deterministic hashing behavior.
 *
 * Validates: AC4 (Configuration versioning for reproducibility)
 *
 * Test count: 20
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  computeContentHash,
  computeSkillVersion,
  computeConfigVersion,
  createConfigSnapshot,
  formatVersionForDecisionLog,
} from '../config-version.js';
import {
  readSkillContents,
  loadVersionedAgentConfig,
  reloadVersionedAgentConfig,
} from '../versioned-config-loader.js';
import type { Skill } from '../types.js';
import type { ResolvedAgentConfig } from '../agent-config-types.js';
import type { ConfigVersion, ConfigSnapshot } from '../config-version-types.js';
import { SkillRegistry } from '../skill-registry.js';

/** Helper to create a minimal Skill object for testing */
function createTestSkill(overrides?: Partial<Skill>): Skill {
  return {
    name: 'harvest_wood',
    description: 'Harvest wood from trees',
    reducer: 'harvest_wood',
    params: [{ name: 'target_id', type: 'u64' as const, description: 'Target entity ID' }],
    subscriptions: [{ table: 'player_state', description: 'Current player state' }],
    body: '# Harvest Wood\n\nInstructions for harvesting.',
    evals: [],
    ...overrides,
  };
}

/** Helper to create a minimal ResolvedAgentConfig for testing */
function createTestConfig(overrides?: Partial<ResolvedAgentConfig>): ResolvedAgentConfig {
  const skills = overrides?.skills ?? [createTestSkill()];
  const registry = new SkillRegistry();
  for (const skill of skills) {
    registry.register(skill);
  }
  return {
    name: 'Test Agent',
    skillNames: skills.map((s) => s.name),
    skills,
    skillRegistry: registry,
    ...overrides,
  };
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

/** Helper to create a temp directory with Agent.md and skills */
function createTempAgentDir(
  agentContent: string,
  skillFiles?: Record<string, string>
): { agentPath: string; skillsDir: string; tempDir: string } {
  const tempDir = mkdtempSync(join(tmpdir(), 'config-version-test-'));
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

describe('Content Hashing (Story 4.7, AC4)', () => {
  it('computeContentHash() returns 12-character hex string', () => {
    // Given any string content
    const hash = computeContentHash('test content');

    // Then the hash is exactly 12 hex characters
    expect(hash).toHaveLength(12);
    expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('computeContentHash() returns same hash for same content (deterministic)', () => {
    // Given the same content hashed twice
    const hash1 = computeContentHash('identical content');
    const hash2 = computeContentHash('identical content');

    // Then hashes are identical
    expect(hash1).toBe(hash2);
  });

  it('computeContentHash() returns different hash for different content', () => {
    // Given different content
    const hash1 = computeContentHash('content version 1');
    const hash2 = computeContentHash('content version 2');

    // Then hashes differ
    expect(hash1).not.toBe(hash2);
  });
});

describe('Skill Version Computation (Story 4.7, AC4)', () => {
  it('computeSkillVersion() returns SkillVersion with name, contentHash, reducer', () => {
    // Given a skill and its file content
    const skill = createTestSkill({ name: 'harvest_wood', reducer: 'harvest_wood' });
    const content = 'raw file content';

    // When computing skill version
    const version = computeSkillVersion(skill, content);

    // Then all fields are populated
    expect(version.name).toBe('harvest_wood');
    expect(version.contentHash).toHaveLength(12);
    expect(version.contentHash).toMatch(/^[0-9a-f]{12}$/);
    expect(version.reducer).toBe('harvest_wood');
  });
});

describe('Config Version Computation (Story 4.7, AC4)', () => {
  it('computeConfigVersion() produces ConfigVersion with agent hash and skill hashes', () => {
    // Given Agent.md content and skill contents
    const agentMdContent = '# Agent: Test Bot\n\n## Skills\n- harvest_wood';
    const skills = [createTestSkill({ name: 'harvest_wood' })];
    const skillContents = new Map([['harvest_wood', 'skill file content']]);

    // When computing config version
    const version = computeConfigVersion(agentMdContent, '/test/agent.md', skillContents, skills);

    // Then ConfigVersion has all expected fields
    expect(version.agentMdHash).toHaveLength(12);
    expect(version.agentMdHash).toMatch(/^[0-9a-f]{12}$/);
    expect(version.agentMdPath).toBe('/test/agent.md');
    expect(version.skillVersions).toHaveLength(1);
    expect(version.skillVersions[0].name).toBe('harvest_wood');
    expect(version.skillVersions[0].contentHash).toHaveLength(12);
  });

  it('computeConfigVersion() includes ISO 8601 timestamp', () => {
    // Given any inputs
    const version = computeConfigVersion('content', '/test/agent.md', new Map(), []);

    // Then timestamp is ISO 8601 format
    expect(version.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Verify it's parseable as a date
    expect(new Date(version.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('computeConfigVersion() uses "unknown" fallback when skill content not in map', () => {
    // Given a skill NOT in the skillContents map
    const skills = [createTestSkill({ name: 'missing_skill' })];
    const emptyMap = new Map<string, string>();

    // When computing config version
    const version = computeConfigVersion('agent content', '/test/agent.md', emptyMap, skills);

    // Then the skill hash falls back to "unknown"
    expect(version.skillVersions).toHaveLength(1);
    expect(version.skillVersions[0].contentHash).toBe('unknown');
  });
});

describe('Config Snapshot (Story 4.7, AC4)', () => {
  it('createConfigSnapshot() produces snapshot with agentMdVersion prefixed with "sha256:"', () => {
    // Given a resolved config and computed version
    const config = createTestConfig({ name: 'Snapshot Bot' });
    const version: ConfigVersion = {
      agentMdHash: 'abc123def456',
      agentMdPath: '/test/agent.md',
      skillVersions: [],
      timestamp: new Date().toISOString(),
    };

    // When creating snapshot
    const snapshot = createConfigSnapshot(config, version);

    // Then agentMdVersion starts with "sha256:"
    expect(snapshot.agentMdVersion).toBe('sha256:abc123def456');
    expect(snapshot.agentName).toBe('Snapshot Bot');
  });

  it('createConfigSnapshot() includes correct active skill names', () => {
    // Given a config with two skills
    const skills = [
      createTestSkill({ name: 'harvest_wood' }),
      createTestSkill({ name: 'build_shelter', reducer: 'build_shelter' }),
    ];
    const config = createTestConfig({ skills, skillNames: ['harvest_wood', 'build_shelter'] });
    const version: ConfigVersion = {
      agentMdHash: 'abc123def456',
      agentMdPath: '/test/agent.md',
      skillVersions: [],
      timestamp: new Date().toISOString(),
    };

    // When creating snapshot
    const snapshot = createConfigSnapshot(config, version);

    // Then activeSkills matches skillNames
    expect(snapshot.activeSkills).toEqual(['harvest_wood', 'build_shelter']);
  });
});

describe('Decision Log Format (Story 4.7, AC4)', () => {
  it('formatVersionForDecisionLog() returns { agentMdVersion, activeSkills } matching DecisionLogEntry.agentConfig', () => {
    // Given a config snapshot
    const snapshot: ConfigSnapshot = {
      agentName: 'Test Agent',
      version: {
        agentMdHash: 'abc123def456',
        agentMdPath: '/test/agent.md',
        skillVersions: [],
        timestamp: new Date().toISOString(),
      },
      activeSkills: ['harvest_wood', 'build_shelter'],
      agentMdVersion: 'sha256:abc123def456',
    };

    // When formatting for decision log
    const result = formatVersionForDecisionLog(snapshot);

    // Then it matches the DecisionLogEntry.agentConfig interface
    expect(result).toEqual({
      agentMdVersion: 'sha256:abc123def456',
      activeSkills: ['harvest_wood', 'build_shelter'],
    });
  });
});

describe('readSkillContents (Story 4.7, AC4)', () => {
  it('readSkillContents() returns Map keyed by skill name with raw file content', async () => {
    // Given a directory with skill files
    const { skillsDir, tempDir } = createTempAgentDir('# Agent: Dummy\n\n## Skills\n- skill_a', {
      'skill-a.skill.md': validSkillContent('skill_a'),
      'skill-b.skill.md': validSkillContent('skill_b'),
    });

    try {
      // When reading skill contents
      const contentsMap = await readSkillContents(skillsDir);

      // Then map has entries keyed by skill name (from frontmatter)
      expect(contentsMap.has('skill_a')).toBe(true);
      expect(contentsMap.has('skill_b')).toBe(true);
      // Raw content is a non-empty string
      expect(contentsMap.get('skill_a')!.length).toBeGreaterThan(0);
      expect(contentsMap.get('skill_a')).toContain('name: skill_a');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('readSkillContents() returns empty map for nonexistent directory', async () => {
    // Given a directory path that does not exist
    const nonexistentDir = join(tmpdir(), 'nonexistent-dir-' + Date.now());

    // When reading skill contents from nonexistent directory
    const contentsMap = await readSkillContents(nonexistentDir);

    // Then returns empty map (defensive -- does not throw)
    expect(contentsMap.size).toBe(0);
  });

  it('readSkillContents() skips files that fail to parse and continues', async () => {
    // Given a directory with one valid and one invalid skill file
    const { skillsDir, tempDir } = createTempAgentDir('# Agent: Dummy\n\n## Skills\n- skill_a', {
      'skill-a.skill.md': validSkillContent('skill_a'),
      'invalid.skill.md': 'This is not valid YAML frontmatter -- no --- delimiters',
    });

    try {
      // When reading skill contents
      const contentsMap = await readSkillContents(skillsDir);

      // Then the valid skill is present and the invalid one is skipped
      expect(contentsMap.has('skill_a')).toBe(true);
      // The invalid file should be skipped (not crash)
      // Map should have exactly 1 entry (only the valid one)
      expect(contentsMap.size).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Versioned Agent Config Loader (Story 4.7, AC4)', () => {
  it('loadVersionedAgentConfig() includes configSnapshot in returned config', async () => {
    // Given a valid agent directory
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Version Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      // When loading versioned config
      const config = await loadVersionedAgentConfig(agentPath, skillsDir);

      // Then configSnapshot is present with all expected fields
      expect(config.configSnapshot).toBeDefined();
      expect(config.configSnapshot.agentName).toBe('Version Bot');
      expect(config.configSnapshot.agentMdVersion).toMatch(/^sha256:[0-9a-f]{12}$/);
      expect(config.configSnapshot.activeSkills).toEqual(['skill_a']);
      expect(config.configSnapshot.version.agentMdHash).toHaveLength(12);
      expect(config.configSnapshot.version.skillVersions).toHaveLength(1);
      expect(config.configSnapshot.version.skillVersions[0].name).toBe('skill_a');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('config version changes when Agent.md content changes', async () => {
    // Given an agent loaded once
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Change Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      const first = await loadVersionedAgentConfig(agentPath, skillsDir);
      const firstHash = first.configSnapshot.version.agentMdHash;

      // Modify Agent.md
      writeFileSync(
        agentPath,
        ['# Agent: Change Bot Modified', '', '## Skills', '- skill_a'].join('\n'),
        'utf-8'
      );

      const second = await loadVersionedAgentConfig(agentPath, skillsDir);
      const secondHash = second.configSnapshot.version.agentMdHash;

      // Then the Agent.md hash changed
      expect(firstHash).not.toBe(secondHash);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('config version changes when any SKILL.md content changes', async () => {
    // Given an agent loaded once
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Skill Change Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      const first = await loadVersionedAgentConfig(agentPath, skillsDir);
      const firstSkillHash = first.configSnapshot.version.skillVersions[0].contentHash;

      // Modify the skill file
      const updatedContent = validSkillContent('skill_a').replace(
        'Test skill skill_a',
        'Modified description for skill_a'
      );
      writeFileSync(join(skillsDir, 'skill-a.skill.md'), updatedContent, 'utf-8');

      const second = await loadVersionedAgentConfig(agentPath, skillsDir);
      const secondSkillHash = second.configSnapshot.version.skillVersions[0].contentHash;

      // Then the skill content hash changed
      expect(firstSkillHash).not.toBe(secondSkillHash);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loadVersionedAgentConfig() preserves base ResolvedAgentConfig fields alongside configSnapshot', async () => {
    // Given a valid agent with personality and skill
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      [
        '# Agent: Full Fields Bot',
        '',
        '## Personality',
        'Methodical and cautious',
        '',
        '## Skills',
        '- skill_a',
        '',
        '## Budget',
        '200 ILP/session',
      ].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      // When loading versioned config
      const config = await loadVersionedAgentConfig(agentPath, skillsDir);

      // Then all base ResolvedAgentConfig fields are preserved
      expect(config.name).toBe('Full Fields Bot');
      expect(config.personality).toBe('Methodical and cautious');
      expect(config.skillNames).toEqual(['skill_a']);
      expect(config.skills).toHaveLength(1);
      expect(config.skills[0].name).toBe('skill_a');
      expect(config.skillRegistry.get('skill_a')).toBeDefined();
      expect(config.budget?.limit).toBe(200);
      // And configSnapshot is also present
      expect(config.configSnapshot).toBeDefined();
      expect(config.configSnapshot.agentName).toBe('Full Fields Bot');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reloadVersionedAgentConfig() reads fresh from disk on each call (NFR25 stateless)', async () => {
    // Given a versioned config loaded once
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Reload Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    try {
      const first = await reloadVersionedAgentConfig(agentPath, skillsDir);
      expect(first.name).toBe('Reload Bot');
      const firstHash = first.configSnapshot.version.agentMdHash;

      // Modify Agent.md on disk
      writeFileSync(
        agentPath,
        ['# Agent: Reload Bot Updated', '', '## Skills', '- skill_a'].join('\n'),
        'utf-8'
      );

      // When reloading
      const second = await reloadVersionedAgentConfig(agentPath, skillsDir);

      // Then fresh values from disk are used
      expect(second.name).toBe('Reload Bot Updated');
      expect(second.configSnapshot.version.agentMdHash).not.toBe(firstHash);
      expect(second.configSnapshot.agentName).toBe('Reload Bot Updated');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reloadVersionedAgentConfig() with skill swap produces new skills AND new version hashes (AC1+AC4)', async () => {
    // Given a versioned config with skill_a
    const { agentPath, skillsDir, tempDir } = createTempAgentDir(
      ['# Agent: Swap Version Bot', '', '## Skills', '- skill_a'].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
        'skill-b.skill.md': validSkillContent('skill_b'),
      }
    );

    try {
      const first = await loadVersionedAgentConfig(agentPath, skillsDir);
      expect(first.skillNames).toEqual(['skill_a']);
      expect(first.configSnapshot.activeSkills).toEqual(['skill_a']);
      expect(first.configSnapshot.version.skillVersions).toHaveLength(1);
      expect(first.configSnapshot.version.skillVersions[0].name).toBe('skill_a');

      // Swap to skill_b on disk
      writeFileSync(
        agentPath,
        ['# Agent: Swap Version Bot', '', '## Skills', '- skill_b'].join('\n'),
        'utf-8'
      );

      const second = await reloadVersionedAgentConfig(agentPath, skillsDir);

      // Then skills are swapped
      expect(second.skillNames).toEqual(['skill_b']);
      expect(second.skills[0].name).toBe('skill_b');
      expect(second.skillRegistry.get('skill_a')).toBeUndefined();
      expect(second.skillRegistry.get('skill_b')).toBeDefined();

      // And version info reflects the new configuration
      expect(second.configSnapshot.activeSkills).toEqual(['skill_b']);
      expect(second.configSnapshot.version.skillVersions).toHaveLength(1);
      expect(second.configSnapshot.version.skillVersions[0].name).toBe('skill_b');
      // Agent.md hash changed (different content)
      expect(second.configSnapshot.version.agentMdHash).not.toBe(
        first.configSnapshot.version.agentMdHash
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('two different experiment configs produce distinguishable snapshots (AC4 sufficiency)', async () => {
    // Given two completely different agent configurations representing different experiments
    const dir1 = createTempAgentDir(
      [
        '# Agent: Explorer',
        '',
        '## Personality',
        'Curious and adventurous',
        '',
        '## Skills',
        '- skill_a',
      ].join('\n'),
      {
        'skill-a.skill.md': validSkillContent('skill_a'),
      }
    );

    const dir2 = createTempAgentDir(
      [
        '# Agent: Harvester',
        '',
        '## Personality',
        'Efficient and focused',
        '',
        '## Skills',
        '- skill_b',
      ].join('\n'),
      {
        'skill-b.skill.md': validSkillContent('skill_b'),
      }
    );

    try {
      // When loading both as versioned configs
      const config1 = await loadVersionedAgentConfig(dir1.agentPath, dir1.skillsDir);
      const config2 = await loadVersionedAgentConfig(dir2.agentPath, dir2.skillsDir);

      // Then version information is sufficient to distinguish them
      expect(config1.configSnapshot.agentMdVersion).not.toBe(config2.configSnapshot.agentMdVersion);
      expect(config1.configSnapshot.agentName).not.toBe(config2.configSnapshot.agentName);
      expect(config1.configSnapshot.activeSkills).not.toEqual(config2.configSnapshot.activeSkills);

      // And formatted for decision log, they are also distinguishable
      const logFormat1 = formatVersionForDecisionLog(config1.configSnapshot);
      const logFormat2 = formatVersionForDecisionLog(config2.configSnapshot);
      expect(logFormat1.agentMdVersion).not.toBe(logFormat2.agentMdVersion);
      expect(logFormat1.activeSkills).not.toEqual(logFormat2.activeSkills);
    } finally {
      rmSync(dir1.tempDir, { recursive: true, force: true });
      rmSync(dir2.tempDir, { recursive: true, force: true });
    }
  });
});
