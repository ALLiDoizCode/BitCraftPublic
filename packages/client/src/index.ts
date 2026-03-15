export const SIGIL_VERSION = '0.1.0';

// Nostr identity management
export {
  generateKeypair,
  importPrivateKey,
  importFromSeedPhrase,
  exportKeypair,
  type NostrKeypair,
  type ExportedKeypair,
} from './nostr/keypair';

export { saveKeypair, loadKeypair } from './nostr/storage';

// Nostr relay client (Story 2.1)
export { NostrClient, SigilError } from './nostr/nostr-client';
export type {
  NostrEvent,
  Filter,
  Subscription,
  ILPPacket,
  ActionConfirmation,
  NostrRelayOptions,
  NostrConnectionState,
  NostrConnectionChangeEvent,
} from './nostr/types';

// SpacetimeDB integration
export {
  type SpacetimeDBSurface,
  type SpacetimeDBConnectionOptions,
  type ConnectionState,
  type ConnectionChangeEvent,
  type TableQuery,
  type SubscriptionHandle,
  type TableAccessors,
  type LatencyStats,
} from './spacetimedb';

// Action cost registry (Story 2.2)
export {
  type ActionCostRegistry,
  type ActionCostEntry,
  type ActionCostRegistryOptions,
  type CategoryEnum,
  type FrequencyEnum,
} from './publish/action-cost-registry';

// ILP packet construction (Story 2.3, simplified in Story 2.5)
export {
  type ILPPacketOptions,
  type ILPPacketResult,
  constructILPPacket,
  parseILPPacket,
  extractFeeFromEvent,
} from './publish/ilp-packet';

// Crosstown adapter (Story 2.5 - replaces CrosstownConnector from Story 2.3)
export {
  CrosstownAdapter,
  type CrosstownAdapterConfig,
  type UnsignedEventTemplate,
  type CrosstownStartResult,
} from './crosstown/crosstown-adapter';

// Wallet client (Story 2.2)
export { WalletClient } from './wallet/wallet-client';

// BLS handler types (Story 2.4)
export {
  BLSErrorCode,
  type BLSErrorResponse,
  type BLSSuccessResponse,
  type BLSResponse,
  isBLSError,
  isBLSSuccess,
} from './bls/types';

// Sigil Client
export {
  SigilClient,
  type ClientIdentity,
  type SigilClientConfig,
  type PublishAPI,
} from './client';

// Agent module - Skill file parsing and registry (Story 4.1)
export {
  // Types
  type Skill,
  type SkillMetadata,
  type SkillParam,
  type SkillParamType,
  type SkillSubscription,
  type SkillEval,
  type SkillExpected,
  type SkillParseErrorCode,
  SkillParseError,
  // Parser
  parseSkillFile,
  parseSkillMetadata,
  // Loader
  type SkillLoadResult,
  type SkillMetadataLoadResult,
  loadSkillDirectory,
  loadSkillDirectoryMetadata,
  // Registry
  SkillRegistry,
  createSkillRegistryFromDirectory,
} from './agent';

// Agent module - Agent.md configuration and skill selection (Story 4.2)
export {
  // Agent Config Types
  type AgentBudgetConfig,
  type AgentLoggingConfig,
  type AgentConfig,
  type ResolvedAgentConfig,
  type AgentConfigErrorCode,
  AgentConfigError,
  // Agent Config Parser
  parseAgentConfig,
  // Agent Config Loader
  loadAgentConfig,
  reloadAgentConfig,
  // Agent File Generator
  type AgentFileOutput,
  generateClaudeMd,
  generateAgentsMd,
  generateAgentFiles,
  // Triggering Precision Validator
  type TriggeringPrecisionWarning,
  type TriggeringPrecisionReport,
  validateTriggeringPrecision,
} from './agent';

// Agent module - Configuration validation against SpacetimeDB (Story 4.3)
export {
  // Config Validation Types
  type ModuleInfo,
  type ModuleReducerInfo,
  type ModuleReducerParam,
  type ValidationCheckResult,
  type ValidationCheckType,
  type ValidationReport,
  type ConfigValidationErrorCode,
  type ModuleInfoProvider,
  ConfigValidationError,
  // Module Info Fetcher
  SpacetimeDBModuleInfoFetcher,
  type ModuleInfoFetcherConfig,
  createOfflineModuleInfo,
  // Reducer Validator
  validateReducers,
  // Table Validator
  validateTables,
  // Config Validator
  validateAgentConfig,
  validateAgentConfigOffline,
  formatValidationReport,
} from './agent';

// Agent module - Budget tracking and limits (Story 4.4)
export {
  // Budget Types
  type BudgetTrackerConfig,
  type BudgetStatus,
  type BudgetMetrics,
  type BudgetWarningEvent,
  BudgetExceededError,
  // Budget Tracker
  BudgetTracker,
  createBudgetTrackerFromConfig,
  // Budget Publish Guard
  BudgetPublishGuard,
} from './agent';

// Agent module - Event interpretation as semantic narratives (Story 4.5)
export {
  // Event Interpreter Types
  type TableUpdateEvent,
  type EventCategory,
  type SemanticNarrative,
  type CorrelatedNarrative,
  type TableInterpreter,
  type NameResolver,
  type EventInterpreterConfig,
  // Table Interpreters
  createPlayerPositionInterpreter,
  createInventoryInterpreter,
  createResourceInterpreter,
  createGenericInterpreter,
  DEFAULT_TABLE_INTERPRETERS,
  // Event Interpreter
  EventInterpreter,
  createEventInterpreterWithStaticData,
} from './agent';

// Agent module - Structured decision logging (Story 4.6)
export {
  // Decision Log Types
  type DecisionLogEntry,
  type DecisionLoggerConfig,
  type DecisionLogResult,
  type DecisionContext,
  type SkillMetrics,
  type AggregateMetrics,
  type EvalResult,
  // Decision Logger
  DecisionLogger,
  createDecisionLogger,
  // Decision Log Metrics
  computeMetrics,
  parseJsonlFile,
} from './agent';
