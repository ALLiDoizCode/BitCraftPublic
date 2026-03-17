/**
 * Integration Test Fixtures - Public API
 * Stories 5.4-5.8: Action Round-Trip, Player Lifecycle, Resource Gathering,
 * Multi-Step Crafting Loop Validation, and Error Scenarios & Graceful Degradation
 *
 * Barrel export for all reusable test fixtures.
 * Import from this index for all Epic 5 stories and future epics.
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
 *   subscribeToStory57Tables,
 *   subscribeToStory58Tables,
 *   findGatherableResource,
 *   findExtractionRecipe,
 *   moveNearResource,
 *   executeExtraction,
 *   verifyInventoryContains,
 *   verifyResourceHealthDecremented,
 *   findCraftingBuilding,
 *   findCraftingRecipe,
 *   moveNearBuilding,
 *   executeCraftingLoop,
 *   verifyMaterialsConsumed,
 *   verifyCraftedItemReceived,
 *   assertReducerError,
 *   assertStateUnchanged,
 *   assertNoNewRows,
 *   assertPreconditionError,
 *   recordErrorCatalogEntry,
 *   getErrorCatalog,
 *   clearErrorCatalog,
 *   STORY_56_TABLES,
 *   STORY_57_TABLES,
 *   STORY_58_TABLES,
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
  subscribeToStory57Tables,
  subscribeToStory58Tables,
  STORY_56_TABLES,
  STORY_57_TABLES,
  STORY_58_TABLES,
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

// Crafting discovery, execution, verification (Story 5.7)
export {
  findCraftingBuilding,
  findCraftingRecipe,
  moveNearBuilding,
  executeCraftingLoop,
  verifyMaterialsConsumed,
  verifyCraftedItemReceived,
  CRAFTING_PROGRESSIVE_ACTION_DELAY_MS,
  CRAFTING_CONTINUE_DELAY_MS,
  CRAFTING_TIMING_RETRY_COUNT,
  CRAFTING_RETRY_DELAY_MS,
  CRAFTING_MAX_CONTINUE_ITERATIONS,
  CRAFTING_SUBSCRIPTION_WAIT_TIMEOUT_MS,
  CRAFTING_BUILDING_RANGE,
  CRAFTING_MOVEMENT_BUFFER,
  type CraftingBuilding,
  type CraftingRecipe,
  type ExecuteCraftingLoopParams,
  type CraftingLoopResult,
} from './crafting-helpers';

// Error assertion and catalog helpers (Story 5.8)
export {
  assertReducerError,
  assertStateUnchanged,
  assertNoNewRows,
  assertPreconditionError,
  recordErrorCatalogEntry,
  getErrorCatalog,
  clearErrorCatalog,
  type ReducerErrorResult,
  type ErrorCatalogEntry,
} from './error-helpers';

// Seed helpers — cheat/admin reducer wrappers for test scenario composition
export {
  grantItems,
  grantExperience,
  grantKnowledge,
  teleportPlayer,
  spawnEnemy,
  placeBuilding,
  discoverMap,
  killEntity,
  forceResourceRegen,
  despawnOverworldEnemies,
  startServerAgents,
  stopServerAgents,
  EnemyTypeId,
  type EnemyTypeIdValue,
  type GrantItemsParams,
  type GrantExperienceParams,
  type GrantKnowledgeParams,
  type TeleportPlayerParams,
  type SpawnEnemyParams,
  type PlaceBuildingParams,
  type DiscoverMapParams,
  type KillEntityParams,
  type ForceResourceRegenParams,
} from './seed-helpers';
