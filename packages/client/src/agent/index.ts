/**
 * Agent Module - Barrel Exports
 * Story 4.1: Skill File Format & Parser
 *
 * Re-exports all public types and functions from the agent module.
 * Will be extended as more agent modules are added in Stories 4.2-4.7.
 *
 * @module agent
 */

// Types
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

// Parser
export { parseSkillFile, parseSkillMetadata } from './skill-parser.js';

// Loader
export type {
  SkillLoadResult,
  SkillMetadataLoadResult,
} from './skill-loader.js';

export {
  loadSkillDirectory,
  loadSkillDirectoryMetadata,
} from './skill-loader.js';

// Registry
export {
  SkillRegistry,
  createSkillRegistryFromDirectory,
} from './skill-registry.js';
