/**
 * Integration Test Fixtures - Public API
 * Stories 5.4-5.5: Action Round-Trip and Player Lifecycle Validation
 *
 * Barrel export for all reusable test fixtures.
 * Import from this index for Stories 5.5-5.8.
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
