/**
 * Agent Configuration Parser Tests (AC: 1)
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Tests for parseAgentConfig() function that extracts configuration
 * from Agent.md files using heading-based section splitting.
 *
 * Validates: AC1 (Agent.md section extraction)
 * Security: OWASP A03 (file size limit, no code execution)
 *
 * Test count: 18
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAgentConfig } from '../agent-config-parser.js';
import { AgentConfigError } from '../agent-config-types.js';

const AGENTS_FIXTURES_DIR = join(__dirname, 'fixtures', 'agents');

/**
 * Helper to read an Agent.md fixture file
 */
function readAgentFixture(filename: string): string {
  return readFileSync(join(AGENTS_FIXTURES_DIR, filename), 'utf-8');
}

/**
 * Helper to assert that parseAgentConfig throws an AgentConfigError with the expected code and filePath.
 * Replaces the anti-pattern of expect().toThrow() + try/catch with a single call
 * that verifies both the error type and error properties in one assertion block.
 */
function expectConfigError(
  filePath: string,
  content: string,
  expectedCode: string,
  expectedFilePath?: string
): void {
  let thrownError: unknown;
  try {
    parseAgentConfig(filePath, content);
  } catch (e) {
    thrownError = e;
  }
  expect(thrownError).toBeInstanceOf(AgentConfigError);
  const err = thrownError as AgentConfigError;
  expect(err.code).toBe(expectedCode);
  expect(err.filePath).toBe(expectedFilePath ?? filePath);
}

describe('Agent Config Parser (Story 4.2)', () => {
  describe('AC1 - Agent.md section extraction', () => {
    it('parses full Agent.md fixture -> extracts name, personality, skills, budget, logging', () => {
      // Given the forager-bot.agent.md fixture with all sections
      const content = readAgentFixture('forager-bot.agent.md');

      // When parseAgentConfig is called
      const config = parseAgentConfig('forager-bot.agent.md', content);

      // Then all fields should be extracted correctly
      expect(config.name).toBe('Forager Bot');
      expect(config.personality).toContain('careful resource-gathering agent');
      expect(config.skillNames).toEqual(['player_move', 'harvest_resource', 'craft_item']);
      expect(config.budget).toBeDefined();
      expect(config.budget!.limit).toBe(100);
      expect(config.budget!.unit).toBe('ILP');
      expect(config.budget!.period).toBe('session');
      expect(config.budget!.raw).toBe('100 ILP/session');
      expect(config.logging).toBeDefined();
      expect(config.logging!.path).toBe('./logs/forager-decisions.jsonl');
      expect(config.logging!.level).toBe('debug');
    });

    it('parses minimal Agent.md (name + skills only) -> partial config valid, optional fields undefined', () => {
      // Given the minimal.agent.md fixture with only name and skills
      const content = readAgentFixture('minimal.agent.md');

      // When parseAgentConfig is called
      const config = parseAgentConfig('minimal.agent.md', content);

      // Then required fields should be present
      expect(config.name).toBe('Minimal Bot');
      expect(config.skillNames).toEqual(['player_move']);

      // And optional fields should be undefined
      expect(config.personality).toBeUndefined();
      expect(config.budget).toBeUndefined();
      expect(config.logging).toBeUndefined();
    });

    it('parses Agent.md with only # Agent: heading and ## Skills -> valid minimal config', () => {
      // Given a minimal Agent.md with just name and skills
      const content = [
        '# Agent: Test Bot',
        '',
        '## Skills',
        '- player_move',
        '- harvest_resource',
      ].join('\n');

      // When parseAgentConfig is called
      const config = parseAgentConfig('test.agent.md', content);

      // Then the minimal config should be valid
      expect(config.name).toBe('Test Bot');
      expect(config.skillNames).toEqual(['player_move', 'harvest_resource']);
      expect(config.personality).toBeUndefined();
      expect(config.budget).toBeUndefined();
      expect(config.logging).toBeUndefined();
    });

    it('unknown sections (e.g., ## Notes) -> ignored, no error', () => {
      // Given an Agent.md with an unknown section
      const content = [
        '# Agent: Custom Bot',
        '',
        '## Skills',
        '- player_move',
        '',
        '## Notes',
        'These are custom notes that should be ignored.',
        '',
        '## Custom Section',
        'This is also ignored.',
      ].join('\n');

      // When parseAgentConfig is called
      const config = parseAgentConfig('custom.agent.md', content);

      // Then the config should be valid with unknown sections ignored
      expect(config.name).toBe('Custom Bot');
      expect(config.skillNames).toEqual(['player_move']);
    });
  });

  describe('AC1 - Error handling', () => {
    it('missing H1 heading -> AgentConfigError with MISSING_AGENT_NAME', () => {
      // Given content without the # Agent: heading
      const content = ['## Skills', '- player_move'].join('\n');

      // When/Then it should throw AgentConfigError with MISSING_AGENT_NAME
      expectConfigError('no-name.agent.md', content, 'MISSING_AGENT_NAME');
    });

    it('empty agent name (whitespace only after "Agent:") -> AgentConfigError with MISSING_AGENT_NAME', () => {
      // Given content with an empty name after the Agent: prefix
      const content = ['# Agent:   ', '', '## Skills', '- player_move'].join('\n');

      // When/Then it should throw AgentConfigError with MISSING_AGENT_NAME
      expectConfigError('empty-name.agent.md', content, 'MISSING_AGENT_NAME');
    });

    it('missing ## Skills section -> AgentConfigError with MISSING_SKILLS_SECTION', () => {
      // Given content without the ## Skills section
      const content = [
        '# Agent: No Skills Bot',
        '',
        '## Personality',
        'A bot with no skills.',
      ].join('\n');

      // When/Then it should throw AgentConfigError with MISSING_SKILLS_SECTION
      expectConfigError('no-skills.agent.md', content, 'MISSING_SKILLS_SECTION');
    });

    it('empty ## Skills section (no bullet items) -> AgentConfigError with MISSING_SKILLS_SECTION', () => {
      // Given content with an empty Skills section
      const content = [
        '# Agent: Empty Skills Bot',
        '',
        '## Skills',
        '',
        '## Personality',
        'A bot with an empty skills section.',
      ].join('\n');

      // When/Then it should throw AgentConfigError with MISSING_SKILLS_SECTION
      expectConfigError('empty-skills.agent.md', content, 'MISSING_SKILLS_SECTION');
    });

    it('duplicate skill references -> AgentConfigError with DUPLICATE_SKILL_REFERENCE', () => {
      // Given content with duplicate skill names in the Skills section
      const content = [
        '# Agent: Duplicate Bot',
        '',
        '## Skills',
        '- player_move',
        '- harvest_resource',
        '- player_move',
      ].join('\n');

      // When/Then it should throw AgentConfigError with DUPLICATE_SKILL_REFERENCE
      expectConfigError('dup-skills.agent.md', content, 'DUPLICATE_SKILL_REFERENCE');
    });
  });

  describe('AC1 - Budget parsing', () => {
    it('budget format 100 ILP/session -> parsed correctly (limit=100, unit=ILP, period=session)', () => {
      // Given an Agent.md with budget 100 ILP/session
      const content = [
        '# Agent: Budget Bot',
        '',
        '## Skills',
        '- player_move',
        '',
        '## Budget',
        '100 ILP/session',
      ].join('\n');

      // When parseAgentConfig is called
      const config = parseAgentConfig('budget.agent.md', content);

      // Then the budget should be parsed correctly
      expect(config.budget).toBeDefined();
      expect(config.budget!.limit).toBe(100);
      expect(config.budget!.unit).toBe('ILP');
      expect(config.budget!.period).toBe('session');
      expect(config.budget!.raw).toBe('100 ILP/session');
    });

    it('budget format 0.05 USD/hour -> parsed correctly (limit=0.05, unit=USD, period=hour)', () => {
      // Given an Agent.md with budget 0.05 USD/hour
      const content = [
        '# Agent: Cheap Bot',
        '',
        '## Skills',
        '- player_move',
        '',
        '## Budget',
        '0.05 USD/hour',
      ].join('\n');

      // When parseAgentConfig is called
      const config = parseAgentConfig('cheap.agent.md', content);

      // Then the budget should be parsed correctly
      expect(config.budget).toBeDefined();
      expect(config.budget!.limit).toBe(0.05);
      expect(config.budget!.unit).toBe('USD');
      expect(config.budget!.period).toBe('hour');
      expect(config.budget!.raw).toBe('0.05 USD/hour');
    });

    it('invalid budget format "lots of money" -> AgentConfigError with INVALID_BUDGET_FORMAT', () => {
      // Given an Agent.md with an invalid budget format
      const content = [
        '# Agent: Bad Budget Bot',
        '',
        '## Skills',
        '- player_move',
        '',
        '## Budget',
        'lots of money',
      ].join('\n');

      // When/Then it should throw AgentConfigError with INVALID_BUDGET_FORMAT
      expectConfigError('bad-budget.agent.md', content, 'INVALID_BUDGET_FORMAT');
    });
  });

  describe('AC1 - Logging parsing', () => {
    it('logging with path and level -> parsed correctly', () => {
      // Given an Agent.md with full logging config
      const content = [
        '# Agent: Logger Bot',
        '',
        '## Skills',
        '- player_move',
        '',
        '## Logging',
        '- path: ./logs/decisions.jsonl',
        '- level: warn',
      ].join('\n');

      // When parseAgentConfig is called
      const config = parseAgentConfig('logger.agent.md', content);

      // Then the logging config should be parsed correctly
      expect(config.logging).toBeDefined();
      expect(config.logging!.path).toBe('./logs/decisions.jsonl');
      expect(config.logging!.level).toBe('warn');
    });

    it('logging with path only (no level) -> defaults to info', () => {
      // Given an Agent.md with logging config without level
      const content = [
        '# Agent: Default Level Bot',
        '',
        '## Skills',
        '- player_move',
        '',
        '## Logging',
        '- path: ./logs/agent.jsonl',
      ].join('\n');

      // When parseAgentConfig is called
      const config = parseAgentConfig('default-level.agent.md', content);

      // Then the logging level should default to 'info'
      expect(config.logging).toBeDefined();
      expect(config.logging!.path).toBe('./logs/agent.jsonl');
      expect(config.logging!.level).toBe('info');
    });

    it('invalid logging level -> AgentConfigError with INVALID_LOGGING_CONFIG', () => {
      // Given an Agent.md with an invalid logging level
      const content = [
        '# Agent: Bad Logger Bot',
        '',
        '## Skills',
        '- player_move',
        '',
        '## Logging',
        '- path: ./logs/agent.jsonl',
        '- level: verbose',
      ].join('\n');

      // When/Then it should throw AgentConfigError with INVALID_LOGGING_CONFIG
      expectConfigError('bad-logger.agent.md', content, 'INVALID_LOGGING_CONFIG');
    });

    it('logging section without required path key -> AgentConfigError with INVALID_LOGGING_CONFIG', () => {
      // Given an Agent.md with a Logging section that has level but no path
      const content = [
        '# Agent: No Path Logger Bot',
        '',
        '## Skills',
        '- player_move',
        '',
        '## Logging',
        '- level: debug',
      ].join('\n');

      // When/Then it should throw AgentConfigError with INVALID_LOGGING_CONFIG
      expectConfigError('no-path-logger.agent.md', content, 'INVALID_LOGGING_CONFIG');
    });
  });

  describe('Cross-platform compatibility', () => {
    it('CRLF line endings (Windows-style) -> parsed correctly', () => {
      // Given an Agent.md with CRLF line endings (Windows-style)
      const content = [
        '# Agent: Windows Bot',
        '',
        '## Skills',
        '- player_move',
        '- harvest_resource',
        '',
        '## Budget',
        '50 ILP/session',
      ].join('\r\n');

      // When parseAgentConfig is called
      const config = parseAgentConfig('windows.agent.md', content);

      // Then all sections should be parsed correctly despite CRLF
      expect(config.name).toBe('Windows Bot');
      expect(config.skillNames).toEqual(['player_move', 'harvest_resource']);
      expect(config.budget).toBeDefined();
      expect(config.budget!.limit).toBe(50);
      expect(config.budget!.unit).toBe('ILP');
      expect(config.budget!.period).toBe('session');
    });
  });

  describe('Security (OWASP A03)', () => {
    it('file >1MB -> rejected with PARSE_ERROR', () => {
      // Given content exceeding the 1MB limit
      const oversizedContent =
        '# Agent: Big Bot\n\n## Skills\n- player_move\n' + 'x'.repeat(1024 * 1024 + 1);

      // When/Then it should throw AgentConfigError with PARSE_ERROR
      expectConfigError('oversized.agent.md', oversizedContent, 'PARSE_ERROR');
    });
  });
});
