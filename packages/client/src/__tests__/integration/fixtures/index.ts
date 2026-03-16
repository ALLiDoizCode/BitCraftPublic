/**
 * Integration Test Fixtures - Public API
 * Story 5.4: Basic Action Round-Trip Validation (AC6)
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
  queryTableState,
  subscribeToTables,
  subscribeToStory54Tables,
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
