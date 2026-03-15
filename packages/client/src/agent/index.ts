/**
 * Agent Module - Barrel Exports
 * Stories 4.1-4.6: Skill File Format & Parser, Agent.md Configuration,
 * Config Validation, Budget Tracking & Limits, Event Interpretation,
 * Structured Decision Logging
 *
 * Re-exports all public types and functions from the agent module.
 * Will be extended as more agent modules are added in Story 4.7.
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

// Config Validation Types (Story 4.3)
export type {
  ModuleInfo,
  ModuleReducerInfo,
  ModuleReducerParam,
  ValidationCheckResult,
  ValidationCheckType,
  ValidationReport,
  ConfigValidationErrorCode,
  ModuleInfoProvider,
} from './config-validation-types.js';

export { ConfigValidationError } from './config-validation-types.js';

// Module Info Fetcher (Story 4.3)
export { SpacetimeDBModuleInfoFetcher, createOfflineModuleInfo } from './module-info-fetcher.js';
export type { ModuleInfoFetcherConfig } from './module-info-fetcher.js';

// Reducer Validator (Story 4.3)
export { validateReducers } from './reducer-validator.js';

// Table Validator (Story 4.3)
export { validateTables } from './table-validator.js';

// Config Validator (Story 4.3)
export {
  validateAgentConfig,
  validateAgentConfigOffline,
  formatValidationReport,
} from './config-validator.js';

// Budget Types (Story 4.4)
export type {
  BudgetTrackerConfig,
  BudgetStatus,
  BudgetMetrics,
  BudgetWarningEvent,
} from './budget-types.js';

export { BudgetExceededError } from './budget-types.js';

// Budget Tracker (Story 4.4)
export { BudgetTracker, createBudgetTrackerFromConfig } from './budget-tracker.js';

// Budget Publish Guard (Story 4.4)
export { BudgetPublishGuard } from './budget-publish-guard.js';

// Event Interpreter Types (Story 4.5)
export type {
  TableUpdateEvent,
  EventCategory,
  SemanticNarrative,
  CorrelatedNarrative,
  TableInterpreter,
  NameResolver,
  EventInterpreterConfig,
} from './event-interpreter-types.js';

// Table Interpreters (Story 4.5)
export {
  createPlayerPositionInterpreter,
  createInventoryInterpreter,
  createResourceInterpreter,
  createGenericInterpreter,
  DEFAULT_TABLE_INTERPRETERS,
} from './table-interpreters.js';

// Event Interpreter (Story 4.5)
export { EventInterpreter, createEventInterpreterWithStaticData } from './event-interpreter.js';

// Decision Log Types (Story 4.6)
export type {
  DecisionLogEntry,
  DecisionLoggerConfig,
  DecisionLogResult,
  DecisionContext,
  SkillMetrics,
  AggregateMetrics,
  EvalResult,
} from './decision-log-types.js';

// Decision Logger (Story 4.6)
export { DecisionLogger, createDecisionLogger } from './decision-logger.js';

// Decision Log Metrics (Story 4.6)
export { computeMetrics, parseJsonlFile } from './decision-log-metrics.js';
