/**
 * Integration Test Fixtures - Public API
 * Stories 5.4-5.6: Action Round-Trip, Player Lifecycle, and Resource Gathering Validation
 *
 * Barrel export for all reusable test fixtures.
 * Import from this index for Stories 5.6-5.8.
 *
 * @example
 * ```typescript
 * import {
 *   createTestClient,
 *   executeReducer,
 *   verifyStateChange,
 *   isDockerStackHealthy,
 *   waitForTableInsert,
 *   waitForTableDelete,
 *   waitForTableUpdate,
 *   setupSignedInPlayer,
 *   teardownPlayer,
 *   subscribeToStory55Tables,
 *   subscribeToStory56Tables,
 *   findGatherableResource,
 *   findExtractionRecipe,
 *   moveNearResource,
 *   executeExtraction,
 *   verifyInventoryContains,
 *   verifyResourceHealthDecremented,
 *   STORY_56_TABLES,
 * } from './fixtures';
 * ```
 *
 * @integration
 */

// Docker health check
export {
  isDockerStackHealthy,
  checkDockerStackHealth,
  checkServiceHealth,
  logDockerStackHealth,
  type ServiceHealthResult,
  type DockerStackHealthResult,
} from './docker-health';

// SpacetimeDB direct WebSocket connection
export {
  connectToSpacetimeDB,
  disconnectFromSpacetimeDB,
  type SpacetimeDBTestConnection,
  type SpacetimeDBTestConnectionOptions,
} from './spacetimedb-connection';

// Subscription and state verification helpers
export {
  waitForTableInsert,
  waitForTableDelete,
  waitForTableUpdate,
  queryTableState,
  subscribeToTables,
  subscribeToStory54Tables,
  subscribeToStory55Tables,
  subscribeToStory56Tables,
  STORY_56_TABLES,
} from './subscription-helpers';

// Composite test client factory
export {
  createTestClient,
  executeReducer,
  serializeReducerArgs,
  verifyStateChange,
  type TestClient,
  type TestClientOptions,
} from './test-client';

// Player lifecycle setup and teardown (Story 5.5)
export {
  setupSignedInPlayer,
  teardownPlayer,
  type SignedInPlayer,
  type SetupSignedInPlayerOptions,
} from './player-lifecycle';

// Resource discovery, extraction execution, inventory verification (Story 5.6)
export {
  findGatherableResource,
  findExtractionRecipe,
  moveNearResource,
  executeExtraction,
  verifyInventoryContains,
  verifyResourceHealthDecremented,
  EXTRACTION_PROGRESSIVE_ACTION_DELAY_MS,
  EXTRACTION_TIMING_RETRY_COUNT,
  EXTRACTION_RETRY_DELAY_MS,
  SUBSCRIPTION_WAIT_TIMEOUT_MS,
  type GatherableResource,
  type ExtractionRecipe,
  type ExecuteExtractionParams,
  type ExtractionResult,
} from './resource-helpers';
