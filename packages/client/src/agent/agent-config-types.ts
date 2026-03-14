/**
 * Agent Configuration Types
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Type definitions for Agent.md parsing, configuration resolution,
 * and agent file generation.
 *
 * @module agent/agent-config-types
 */

import type { Skill } from './types.js';
import type { SkillRegistry } from './skill-registry.js';

/**
 * Budget configuration parsed from Agent.md `## Budget` section.
 * Format: `<amount> <unit>/<period>` (e.g., `100 ILP/session`)
 */
export interface AgentBudgetConfig {
  /** Numeric budget limit */
  limit: number;
  /** Currency unit (e.g., 'ILP', 'USD') */
  unit: string;
  /** Time period (e.g., 'session', 'hour') */
  period: string;
  /** Original string from Agent.md */
  raw: string;
}

/**
 * Logging configuration parsed from Agent.md `## Logging` section.
 */
export interface AgentLoggingConfig {
  /** Log file path */
  path: string;
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Agent configuration parsed from Agent.md file.
 * Contains raw parsed values before skill resolution.
 */
export interface AgentConfig {
  /** Agent name from `# Agent: <name>` heading (REQUIRED) */
  name: string;
  /** Personality description from `## Personality` section (OPTIONAL) */
  personality?: string;
  /** Skill references from `## Skills` section (REQUIRED) */
  skillNames: string[];
  /** Budget from `## Budget` section (OPTIONAL) */
  budget?: AgentBudgetConfig;
  /** Logging config from `## Logging` section (OPTIONAL) */
  logging?: AgentLoggingConfig;
}

/**
 * Resolved agent configuration with skill objects loaded from directory.
 * Extends AgentConfig with resolved Skill objects and a filtered SkillRegistry.
 */
export interface ResolvedAgentConfig extends AgentConfig {
  /** Resolved Skill objects (from SkillRegistry) */
  skills: Skill[];
  /** SkillRegistry populated with only the selected skills */
  skillRegistry: SkillRegistry;
}

/**
 * Error codes for agent configuration failures.
 */
export type AgentConfigErrorCode =
  | 'MISSING_AGENT_NAME'
  | 'MISSING_SKILLS_SECTION'
  | 'INVALID_BUDGET_FORMAT'
  | 'INVALID_LOGGING_CONFIG'
  | 'SKILL_NOT_FOUND'
  | 'PARSE_ERROR'
  | 'DUPLICATE_SKILL_REFERENCE';

/**
 * Error thrown when agent configuration parsing or resolution fails.
 * Follows the same pattern as SkillParseError (Story 4.1).
 */
export class AgentConfigError extends Error {
  /** Error code for programmatic error handling */
  readonly code: AgentConfigErrorCode;
  /** Path to the file that failed to parse */
  readonly filePath: string;
  /** List of missing or invalid fields */
  readonly fields?: string[];

  constructor(message: string, code: AgentConfigErrorCode, filePath: string, fields?: string[]) {
    super(message);
    this.name = 'AgentConfigError';
    this.code = code;
    this.filePath = filePath;
    this.fields = fields;
  }
}
