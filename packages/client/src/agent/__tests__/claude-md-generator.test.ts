/**
 * CLAUDE.md / AGENTS.md Generator Tests (AC: 4)
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Tests for generateClaudeMd(), generateAgentsMd(), and generateAgentFiles()
 * that produce agent configuration files from a ResolvedAgentConfig.
 *
 * Validates: AC4 (CLAUDE.md / AGENTS.md generation, NFR21 uniform format)
 *
 * Test count: 15 (8 original + 7 gap-filling)
 */

import { describe, it, expect } from 'vitest';
import { generateClaudeMd, generateAgentsMd, generateAgentFiles } from '../agent-file-generator.js';
import type { ResolvedAgentConfig } from '../agent-config-types.js';
import { SkillRegistry } from '../skill-registry.js';
import type { Skill } from '../types.js';

/**
 * Factory to create a test Skill object for generator tests
 */
function createTestSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'test_skill',
    description: 'A test skill for unit testing',
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

/**
 * Factory to create a ResolvedAgentConfig for generator tests
 */
function createResolvedConfig(overrides: Partial<ResolvedAgentConfig> = {}): ResolvedAgentConfig {
  const skills = overrides.skills ?? [
    createTestSkill({
      name: 'player_move',
      description: 'Move the player character to a target hex coordinate.',
      reducer: 'player_move',
    }),
    createTestSkill({
      name: 'harvest_resource',
      description: 'Begin harvesting a resource node.',
      reducer: 'harvest_start',
    }),
  ];

  const registry = new SkillRegistry();
  for (const skill of skills) {
    registry.register(skill);
  }

  return {
    name: 'Test Agent',
    personality: 'A helpful agent for testing purposes.',
    skillNames: skills.map((s) => s.name),
    budget: { limit: 100, unit: 'ILP', period: 'session', raw: '100 ILP/session' },
    logging: { path: './logs/test.jsonl', level: 'debug' },
    skills,
    skillRegistry: registry,
    ...overrides,
  };
}

describe('CLAUDE.md / AGENTS.md Generator (Story 4.2)', () => {
  describe('AC4 - CLAUDE.md generation', () => {
    it('valid config -> CLAUDE.md contains agent name in H1', () => {
      // Given a resolved agent config
      const config = createResolvedConfig({ name: 'Forager Bot' });

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then the output should contain the agent name in an H1 heading
      expect(claudeMd).toContain('# Agent: Forager Bot');
    });

    it('valid config -> CLAUDE.md contains personality section', () => {
      // Given a resolved agent config with personality
      const config = createResolvedConfig({
        personality: 'A careful resource-gathering agent.',
      });

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then the output should contain the personality text
      expect(claudeMd).toContain('A careful resource-gathering agent.');
    });

    it('valid config -> CLAUDE.md contains skill descriptions for each resolved skill', () => {
      // Given a resolved agent config with 2 skills
      const config = createResolvedConfig();

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then the output should contain descriptions for each skill
      expect(claudeMd).toContain('player_move');
      expect(claudeMd).toContain('Move the player character to a target hex coordinate.');
      expect(claudeMd).toContain('harvest_resource');
      expect(claudeMd).toContain('Begin harvesting a resource node.');
    });

    it('valid config -> CLAUDE.md contains budget info when configured', () => {
      // Given a resolved agent config with budget
      const config = createResolvedConfig({
        budget: { limit: 100, unit: 'ILP', period: 'session', raw: '100 ILP/session' },
      });

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then the output should contain budget information
      expect(claudeMd).toContain('100 ILP/session');
    });

    it('valid config with no budget -> CLAUDE.md omits budget constraints', () => {
      // Given a resolved agent config without budget
      const config = createResolvedConfig({ budget: undefined });

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then the output should NOT contain budget section content
      // (It may contain a "Constraints" heading, but no specific budget line)
      expect(claudeMd).not.toContain('ILP/session');
      expect(claudeMd).not.toContain('Budget:');
    });

    it('generated CLAUDE.md includes MCP tool references in snake_case', () => {
      // Given a resolved agent config with skills
      const config = createResolvedConfig();

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then MCP tool references should use snake_case naming convention
      expect(claudeMd).toContain('player_move');
      expect(claudeMd).toContain('harvest_resource');
      // Skills are already in snake_case, so they should appear as MCP tool names
    });
  });

  describe('AC4 - CLAUDE.md structural sections (gap-filling)', () => {
    it('valid config -> CLAUDE.md contains Identity, Constraints, Goals, Available Skills, and MCP Tools sections', () => {
      // Given a resolved agent config with all fields
      const config = createResolvedConfig();

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then all required structural sections should be present
      expect(claudeMd).toContain('## Identity');
      expect(claudeMd).toContain('## Constraints');
      expect(claudeMd).toContain('## Goals');
      expect(claudeMd).toContain('## Available Skills');
      expect(claudeMd).toContain('## MCP Tools');
    });

    it('valid config without personality -> CLAUDE.md uses default identity text', () => {
      // Given a resolved agent config without a personality section
      const config = createResolvedConfig({
        name: 'Default Bot',
        personality: undefined,
      });

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then the Identity section should contain a default message mentioning the agent name
      expect(claudeMd).toContain('## Identity');
      expect(claudeMd).toContain('You are Default Bot');
      expect(claudeMd).toContain('SpacetimeDB game world');
    });

    it('valid config -> CLAUDE.md Available Skills section includes reducer and parameter details', () => {
      // Given a resolved agent config with skills that have params
      const config = createResolvedConfig();

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then the Available Skills section should include reducer names and parameter info
      expect(claudeMd).toContain('**Reducer:** `player_move`');
      expect(claudeMd).toContain('**Reducer:** `harvest_start`');
      expect(claudeMd).toContain('**Parameters:**');
      expect(claudeMd).toContain('`target_id`');
    });

    it('valid config -> CLAUDE.md MCP Tools section lists tools with descriptions', () => {
      // Given a resolved agent config
      const config = createResolvedConfig();

      // When generateClaudeMd is called
      const claudeMd = generateClaudeMd(config);

      // Then MCP Tools section should list each tool with its description
      expect(claudeMd).toContain('## MCP Tools');
      expect(claudeMd).toContain(
        '`player_move`: Move the player character to a target hex coordinate.'
      );
      expect(claudeMd).toContain('`harvest_resource`: Begin harvesting a resource node.');
    });
  });

  describe('AC4 - AGENTS.md generation', () => {
    it('valid config -> AGENTS.md generated with same information', () => {
      // Given a resolved agent config
      const config = createResolvedConfig({ name: 'Forager Bot' });

      // When generateAgentsMd is called
      const agentsMd = generateAgentsMd(config);

      // Then the output should contain the same core information as CLAUDE.md
      expect(agentsMd).toContain('Forager Bot');
      expect(agentsMd).toContain('player_move');
      expect(agentsMd).toContain('harvest_resource');
    });

    it('valid config -> AGENTS.md includes skill descriptions for LLM reference (gap-filling)', () => {
      // Given a resolved agent config with skills
      const config = createResolvedConfig();

      // When generateAgentsMd is called
      const agentsMd = generateAgentsMd(config);

      // Then AGENTS.md should include actual skill descriptions (not just names)
      expect(agentsMd).toContain('Move the player character to a target hex coordinate.');
      expect(agentsMd).toContain('Begin harvesting a resource node.');
    });

    it('valid config -> AGENTS.md includes personality and budget when configured (gap-filling)', () => {
      // Given a resolved agent config with personality and budget
      const config = createResolvedConfig({
        personality: 'A strategic agent that plans ahead.',
        budget: { limit: 50, unit: 'USD', period: 'hour', raw: '50 USD/hour' },
      });

      // When generateAgentsMd is called
      const agentsMd = generateAgentsMd(config);

      // Then AGENTS.md should include the personality and budget info
      expect(agentsMd).toContain('A strategic agent that plans ahead.');
      expect(agentsMd).toContain('50 USD/hour');
    });

    it('valid config -> AGENTS.md contains Tool Mapping section (gap-filling)', () => {
      // Given a resolved agent config
      const config = createResolvedConfig();

      // When generateAgentsMd is called
      const agentsMd = generateAgentsMd(config);

      // Then AGENTS.md should have a Tool Mapping section mapping skills to reducers
      expect(agentsMd).toContain('## Tool Mapping');
      expect(agentsMd).toContain('`player_move` -> reducer `player_move`');
      expect(agentsMd).toContain('`harvest_resource` -> reducer `harvest_start`');
    });
  });

  describe('AC4 - generateAgentFiles() convenience function', () => {
    it('generateAgentFiles() returns both CLAUDE.md and AGENTS.md', () => {
      // Given a resolved agent config
      const config = createResolvedConfig();

      // When generateAgentFiles is called
      const output = generateAgentFiles(config);

      // Then both files should be returned
      expect(output.claudeMd).toBeDefined();
      expect(output.agentsMd).toBeDefined();
      expect(typeof output.claudeMd).toBe('string');
      expect(typeof output.agentsMd).toBe('string');

      // And both should contain the agent name
      expect(output.claudeMd).toContain('Test Agent');
      expect(output.agentsMd).toContain('Test Agent');
    });
  });
});
