/**
 * Agent Module - Barrel Exports
 * Stories 4.1-4.2: Skill File Format & Parser, Agent.md Configuration & Skill Selection
 *
 * Re-exports all public types and functions from the agent module.
 * Will be extended as more agent modules are added in Stories 4.3-4.7.
 *
 * @module agent
 */

// Skill Types (Story 4.1)
export type {
  Skill,
  SkillMetadata,
  SkillParam,
  SkillParamType,
  SkillSubscription,
  SkillEval,
  SkillExpected,
  SkillParseErrorCode,
} from './types.js';

export { SkillParseError } from './types.js';

// Skill Parser (Story 4.1)
export { parseSkillFile, parseSkillMetadata } from './skill-parser.js';

// Skill Loader (Story 4.1)
export type { SkillLoadResult, SkillMetadataLoadResult } from './skill-loader.js';

export { loadSkillDirectory, loadSkillDirectoryMetadata } from './skill-loader.js';

// Skill Registry (Story 4.1)
export { SkillRegistry, createSkillRegistryFromDirectory } from './skill-registry.js';

// Agent Config Types (Story 4.2)
export type {
  AgentBudgetConfig,
  AgentLoggingConfig,
  AgentConfig,
  ResolvedAgentConfig,
  AgentConfigErrorCode,
} from './agent-config-types.js';

export { AgentConfigError } from './agent-config-types.js';

// Agent Config Parser (Story 4.2)
export { parseAgentConfig } from './agent-config-parser.js';

// Agent Config Loader (Story 4.2)
export { loadAgentConfig, reloadAgentConfig } from './agent-config-loader.js';

// Agent File Generator (Story 4.2)
export type { AgentFileOutput } from './agent-file-generator.js';

export { generateClaudeMd, generateAgentsMd, generateAgentFiles } from './agent-file-generator.js';

// Triggering Precision Validator (Story 4.2)
export type {
  TriggeringPrecisionWarning,
  TriggeringPrecisionReport,
} from './triggering-precision.js';

export { validateTriggeringPrecision } from './triggering-precision.js';
