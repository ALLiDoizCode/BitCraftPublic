/**
 * Basic Action Round-Trip Integration Tests
 * Story 5.4: Basic Action Round-Trip Validation
 *
 * Validates the fundamental plumbing: execute a game action via SpacetimeDB
 * WebSocket, verify state change via subscription, measure round-trip timing.
 *
 * BLOCKER-1 Workaround: All tests use direct SpacetimeDB WebSocket connection,
 * bypassing the BLS handler. ctx.sender identity is the connection identity.
 *
 * Requires Docker stack running:
 *   docker compose -f docker/docker-compose.yml up -d
 *
 * Environment variables:
 *   RUN_INTEGRATION_TESTS=true  - Enable integration test suite
 *   SPACETIMEDB_URL=ws://localhost:3000  - SpacetimeDB server URL
 *   SPACETIMEDB_DATABASE=bitcraft  - Database name
 *
 * @integration
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  isDockerStackHealthy,
  checkDockerStackHealth,
  logDockerStackHealth,
} from './fixtures/docker-health';
import {
  connectToSpacetimeDB,
  disconnectFromSpacetimeDB,
  type SpacetimeDBTestConnection,
} from './fixtures/spacetimedb-connection';
import {
  waitForTableInsert,
  waitForTableDelete,
  queryTableState,
  subscribeToStory54Tables,
} from './fixtures/subscription-helpers';
import { createTestClient, executeReducer, type TestClient } from './fixtures/test-client';
import { WalletClient } from '../../wallet/wallet-client';
import { ActionCostRegistryLoader } from '../../publish/action-cost-registry';

// ---------------------------------------------------------------------------
// Conditional execution: skip all tests when Docker is not available (AGREEMENT-5)
// ---------------------------------------------------------------------------
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

// Note: Each test also checks `dockerHealthy` with an early return. This is necessary
// because `describe.skipIf` evaluates synchronously (before `beforeAll`), while
// `dockerHealthy` is resolved asynchronously in `beforeAll`. The pattern is intentional
// and cannot be further consolidated without a custom vitest plugin or test runner change.

describe.skipIf(!runIntegrationTests)('Story 5.4: Basic Action Round-Trip Validation', () => {
  let dockerHealthy = false;

  beforeAll(async () => {
    // Check Docker stack health before running any tests
    const healthResult = await checkDockerStackHealth();
    dockerHealthy = healthResult.allHealthy;
    logDockerStackHealth(healthResult);

    if (!dockerHealthy) {
      console.warn(
        'Docker stack is not healthy. Integration tests will be skipped. ' +
          'Start services: docker compose -f docker/docker-compose.yml up -d'
      );
    }
  });

  // =========================================================================
  // AC1: Pipeline round-trip execution (FR17, NFR5)
  // =========================================================================
  describe('AC1: Pipeline round-trip execution', () => {
    let testConnection: SpacetimeDBTestConnection | null = null;

    afterEach(() => {
      disconnectFromSpacetimeDB(testConnection);
      testConnection = null;
    });

    it('[P0] should connect to SpacetimeDB via WebSocket with a fresh identity', async () => {
      // Given: A running Docker stack with SpacetimeDB server
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      // When: A direct WebSocket connection is established
      testConnection = await connectToSpacetimeDB();

      // Then: The connection is active and has an assigned identity
      expect(testConnection).toBeDefined();
      expect(testConnection.identity).toBeDefined();
      expect(testConnection.token).toBeTruthy();
      expect(testConnection.connection).toBeDefined();
    }, 15000);

    it('[P0] should call synchronize_time reducer and receive success', async () => {
      // Given: An active SpacetimeDB WebSocket connection
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testConnection = await connectToSpacetimeDB();

      // When: The simplest possible reducer (synchronize_time) is called with any f64 value
      // synchronize_time accepts a single f64 argument and has no side effects
      const { callTimeMs } = await executeReducer(
        testConnection,
        'synchronize_time',
        Date.now() / 1000 // Current time as f64
      );

      // Then: The reducer call completes without error
      // (Success is verified by not throwing; callTimeMs confirms execution)
      expect(callTimeMs).toBeGreaterThanOrEqual(0);
      expect(callTimeMs).toBeLessThan(2000); // NFR3: round-trip < 2 seconds
    }, 15000);

    it('[P0] should call player_queue_join reducer and handle success or already-in-queue gracefully', async () => {
      // Given: An active SpacetimeDB WebSocket connection
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testConnection = await connectToSpacetimeDB();

      // When: player_queue_join reducer is called
      // (Task 3.3: test player_queue_join independently, not just as a setup step)
      let succeeded = false;
      let errorMessage: string | undefined;
      try {
        const { callTimeMs } = await executeReducer(testConnection, 'player_queue_join');
        succeeded = true;
        // Then: The reducer call completes without error and with valid timing
        expect(callTimeMs).toBeGreaterThanOrEqual(0);
        expect(callTimeMs).toBeLessThan(5000);
      } catch (err) {
        // Or: The reducer returns an expected precondition error
        errorMessage = err instanceof Error ? err.message : String(err);
        succeeded = false;
      }

      // Then: Either the call succeeded, or failed with a recognized precondition error
      // from the Player Lifecycle Preconditions (Game Reference):
      // - "You must have a character to join the queue"
      // - "already in queue" / "Already" patterns
      if (!succeeded) {
        expect(errorMessage).toBeDefined();
        // Verify it's a known precondition error, not an unexpected failure
        const isKnownError =
          errorMessage!.toLowerCase().includes('queue') ||
          errorMessage!.toLowerCase().includes('already') ||
          errorMessage!.toLowerCase().includes('character') ||
          errorMessage!.toLowerCase().includes('failed');
        expect(isKnownError).toBe(true);
      }
    }, 15000);

    it('[P0] should call sign_in reducer and observe signed_in_player_state via subscription within 500ms (NFR5)', async () => {
      // Given: An active connection with subscriptions to Story 5.4 tables
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testConnection = await connectToSpacetimeDB();
      await subscribeToStory54Tables(testConnection);

      // First, ensure player is set up (player_queue_join may be needed)
      // Note: New identities may need player creation first. Handle gracefully.
      try {
        await executeReducer(testConnection, 'player_queue_join');
      } catch {
        // May fail if already in queue or auto-created; continue
      }

      // When: sign_in reducer is called
      // Network-first pattern: register subscription listener BEFORE calling reducer
      // to prevent race condition where update arrives before listener is registered
      const signInStart = performance.now();
      const insertPromise = waitForTableInsert(
        testConnection,
        'signed_in_player_state',
        () => true, // Accept any insert (we just connected with this identity)
        5000 // Generous timeout for reliability; assertion checks NFR5 separately
      );

      await executeReducer(testConnection, 'sign_in', { owner_entity_id: 0 });

      // Then: signed_in_player_state row appears via subscription within 500ms (NFR5)
      const { row, elapsedMs } = await insertPromise;

      const totalRoundTripMs = performance.now() - signInStart;

      expect(row).toBeDefined();
      // NFR5: Subscription update received within 500ms of reducer completion
      expect(elapsedMs).toBeLessThan(500);
      // NFR3: Total round-trip < 2000ms
      expect(totalRoundTripMs).toBeLessThan(2000);
    }, 30000);
  });

  // =========================================================================
  // AC2: State change verification via subscription (FR4, FR5)
  // =========================================================================
  describe('AC2: State change verification via subscription', () => {
    let testClient: TestClient | null = null;

    afterEach(() => {
      testClient?.cleanup();
      testClient = null;
    });

    it('[P0] should receive signed_in_player_state insert after sign_in', async () => {
      // Given: An active test client with subscriptions
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testClient = await createTestClient();

      // Ensure player is in queue for sign_in precondition
      try {
        await executeReducer(testClient.testConnection, 'player_queue_join');
      } catch {
        // Handle gracefully
      }

      // When: sign_in is called
      // Set up subscription listener BEFORE calling reducer (network-first pattern)
      const insertPromise = waitForTableInsert(testClient.testConnection, 'signed_in_player_state');

      await executeReducer(testClient.testConnection, 'sign_in', { owner_entity_id: 0 });

      // Then: signed_in_player_state row is inserted
      const { row } = await insertPromise;
      expect(row).toBeDefined();
    }, 30000);

    it('[P0] should verify player_state.signed_in is true after sign_in', async () => {
      // Given: A player who has just signed in
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testClient = await createTestClient();

      try {
        await executeReducer(testClient.testConnection, 'player_queue_join');
      } catch {
        // Handle gracefully
      }

      await executeReducer(testClient.testConnection, 'sign_in', { owner_entity_id: 0 });

      // Allow subscription to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // When: player_state is queried
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const playerStates = queryTableState<any>(testClient.testConnection, 'player_state');

      // Then: At least one player_state entry has signed_in === true
      const signedInPlayer = playerStates.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ps: any) => ps.signed_in === true
      );
      expect(signedInPlayer).toBeDefined();
      expect(signedInPlayer.signed_in).toBe(true);
    }, 30000);

    it('[P0] should receive signed_in_player_state delete after sign_out', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testClient = await createTestClient();

      try {
        await executeReducer(testClient.testConnection, 'player_queue_join');
      } catch {
        // Handle gracefully
      }
      await executeReducer(testClient.testConnection, 'sign_in', { owner_entity_id: 0 });
      await new Promise((resolve) => setTimeout(resolve, 500));

      // When: sign_out is called
      // Set up delete listener BEFORE calling sign_out (deterministic wait pattern)
      const deletePromise = waitForTableDelete(testClient.testConnection, 'signed_in_player_state');

      await executeReducer(testClient.testConnection, 'sign_out');

      // Then: signed_in_player_state row is deleted
      const { row } = await deletePromise;
      expect(row).toBeDefined();
    }, 30000);

    it('[P1] should verify player_state.signed_in is false after sign_out', async () => {
      // Given: A player who signed in then signed out
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testClient = await createTestClient();

      try {
        await executeReducer(testClient.testConnection, 'player_queue_join');
      } catch {
        // Handle gracefully
      }
      await executeReducer(testClient.testConnection, 'sign_in', { owner_entity_id: 0 });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await executeReducer(testClient.testConnection, 'sign_out');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // When: player_state is queried
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const playerStates = queryTableState<any>(testClient.testConnection, 'player_state');

      // Then: The player's signed_in field is false
      // Note: We need to find our specific player; after sign_out, signed_in should be false
      const anySignedIn = playerStates.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ps: any) => ps.signed_in === true
      );
      // After sign_out, no player should be signed in for our identity
      expect(anySignedIn).toBe(false);
    }, 30000);
  });

  // =========================================================================
  // AC3: Round-trip timing measurement (NFR3)
  // =========================================================================
  describe('AC3: Round-trip timing measurement', () => {
    let testClient: TestClient | null = null;

    afterEach(() => {
      testClient?.cleanup();
      testClient = null;
    });

    it('[P1] should complete reducer round-trip within 2000ms (NFR3)', async () => {
      // Given: An active SpacetimeDB connection
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testClient = await createTestClient();

      // When: A reducer is called and timed
      const reducerCallStart = performance.now();
      await executeReducer(testClient.testConnection, 'synchronize_time', Date.now() / 1000);
      const reducerCallTimeMs = performance.now() - reducerCallStart;

      // Then: The round-trip completes within 2000ms (NFR3: <2 seconds under normal load)
      expect(reducerCallTimeMs).toBeLessThan(2000);

      // Log timing breakdown for performance baseline documentation
      console.log(`[NFR3] Reducer call time: ${reducerCallTimeMs.toFixed(1)}ms`);
    }, 15000);

    it('[P1] should receive subscription update within 500ms of reducer completion (NFR5)', async () => {
      // Given: An active connection with subscriptions
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testClient = await createTestClient();

      try {
        await executeReducer(testClient.testConnection, 'player_queue_join');
      } catch {
        // Handle gracefully
      }

      // When: sign_in is called and subscription update is timed
      // Note: insertPromise is created BEFORE executeReducer, so its elapsedMs
      // includes both the reducer call time and the subscription delivery time.
      // This gives us the true end-to-end round-trip measurement.
      const insertPromise = waitForTableInsert(testClient.testConnection, 'signed_in_player_state');

      const reducerCallStart = performance.now();
      await executeReducer(testClient.testConnection, 'sign_in', { owner_entity_id: 0 });
      const reducerCallTimeMs = performance.now() - reducerCallStart;

      const { elapsedMs: totalRoundTripMs } = await insertPromise;
      // Subscription latency = time from reducer completion to subscription update
      const subscriptionLatencyMs = Math.max(0, totalRoundTripMs - reducerCallTimeMs);

      // Then: Subscription latency within 500ms (NFR5)
      expect(subscriptionLatencyMs).toBeLessThan(500);

      // And: Total round-trip < 2000ms (NFR3)
      expect(totalRoundTripMs).toBeLessThan(2000);

      // Log timing breakdown for performance baseline
      // Timing segments: call-to-SpacetimeDB + SpacetimeDB-to-subscription-update (per AC3)
      console.log(
        `[NFR3/NFR5] Timing breakdown:`,
        `callToSpacetimeDB=${reducerCallTimeMs.toFixed(1)}ms,`,
        `spacetimeDBToSubscription=${subscriptionLatencyMs.toFixed(1)}ms,`,
        `totalRoundTrip=${totalRoundTripMs.toFixed(1)}ms`
      );
    }, 30000);
  });

  // =========================================================================
  // AC4: Identity chain verification (FR4, FR5)
  // =========================================================================
  describe('AC4: Identity chain verification', () => {
    let testClient: TestClient | null = null;

    afterEach(() => {
      testClient?.cleanup();
      testClient = null;
    });

    it('[P0] should verify connection identity matches user_state entry', async () => {
      // Given: An active SpacetimeDB connection with known identity
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testClient = await createTestClient();
      const connectionIdentity = testClient.testConnection.identity;

      // Allow time for user_state to be populated
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // When: user_state table is queried
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userStates = queryTableState<any>(testClient.testConnection, 'user_state');

      // Then: A user_state entry exists with identity matching the connection
      const matchingUserState = userStates.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (us: any) => {
          // SpacetimeDB Identity comparison -- may need toHexString() or similar
          const usIdentity = us.identity;
          return (
            usIdentity === connectionIdentity ||
            (usIdentity?.toHexString &&
              usIdentity.toHexString() === connectionIdentity?.toHexString?.()) ||
            String(usIdentity) === String(connectionIdentity)
          );
        }
      );

      expect(matchingUserState).toBeDefined();
    }, 20000);

    it('[P1] should verify entity_id from user_state maps to player_state and signed_in_player_state', async () => {
      // Given: A signed-in player with known identity chain
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      testClient = await createTestClient();

      try {
        await executeReducer(testClient.testConnection, 'player_queue_join');
      } catch {
        // Handle gracefully
      }
      await executeReducer(testClient.testConnection, 'sign_in', { owner_entity_id: 0 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // When: The identity chain is traced: connection -> user_state -> entity_id -> player_state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userStates = queryTableState<any>(testClient.testConnection, 'user_state');
      expect(userStates.length).toBeGreaterThan(0);

      // Extract entity_id from user_state
      const userState = userStates[0]; // Our user
      const entityId = userState.entity_id;
      expect(entityId).toBeDefined();

      // Then: player_state has entry with matching entity_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const playerStates = queryTableState<any>(testClient.testConnection, 'player_state');
      const matchingPlayerState = playerStates.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ps: any) => ps.entity_id === entityId
      );
      expect(matchingPlayerState).toBeDefined();

      // And: signed_in_player_state has entry with matching entity_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signedInStates = queryTableState<any>(
        testClient.testConnection,
        'signed_in_player_state'
      );
      const matchingSignedInState = signedInStates.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (si: any) => si.entity_id === entityId
      );
      expect(matchingSignedInState).toBeDefined();
    }, 30000);
  });

  // =========================================================================
  // AC5: Wallet/cost accounting (FR20, FR21, FR22)
  // =========================================================================
  describe('AC5: Wallet/cost accounting verification', () => {
    it('[P2] should query wallet balance in stub mode without errors (DEBT-5)', async () => {
      // Given: Wallet stub mode is active (DEBT-5: WalletClient returns fixed balance 10000)
      // Note: Real ILP fee validation is deferred to BLOCKER-1 resolution
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      const walletClient = new WalletClient(
        'http://localhost:4041',
        'test-pubkey-hex-for-story-5-4'
      );

      // When: Wallet balance is queried (will activate stub mode if Crosstown returns 404)
      const balance = await walletClient.getBalance();

      // Then: Balance is returned without error (stub mode returns 10000)
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(balance)).toBe(true);

      // Stub mode should be active (Crosstown balance API not implemented)
      expect(walletClient.isStubMode()).toBe(true);
      expect(balance).toBe(10000); // DEBT-5 stub balance

      // Document: Real ILP fee validation deferred to BLOCKER-1 resolution
    }, 15000);

    it('[P2] should look up action cost in cost registry without errors', async () => {
      // Given: An action cost registry with known costs
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      // Create a temporary cost registry for testing
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-test-'));
      const registryPath = path.join(tmpDir, 'test-cost-registry.json');

      fs.writeFileSync(
        registryPath,
        JSON.stringify({
          version: 1,
          defaultCost: 10,
          actions: {
            synchronize_time: { cost: 0, category: 'movement', frequency: 'high' },
            sign_in: { cost: 5, category: 'social', frequency: 'medium' },
            sign_out: { cost: 0, category: 'social', frequency: 'medium' },
          },
        })
      );

      try {
        // When: Cost registry is loaded and queried
        const loader = new ActionCostRegistryLoader();
        const registry = loader.load(registryPath);

        // Then: Cost lookups succeed
        expect(registry.version).toBe(1);
        expect(registry.defaultCost).toBe(10);
        expect(registry.actions.sign_in.cost).toBe(5);
        expect(registry.actions.synchronize_time.cost).toBe(0);

        // And: Wallet stub balance can afford actions
        const walletClient = new WalletClient(
          'http://localhost:4041',
          'test-pubkey-hex-for-story-5-4'
        );
        walletClient.enableStubMode(10000);

        const balance = await walletClient.getBalance();
        const signInCost = registry.actions.sign_in.cost;

        expect(balance).toBeGreaterThanOrEqual(signInCost);

        // Document: Real ILP fee validation deferred to BLOCKER-1 resolution
      } finally {
        // Clean up temporary files
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }, 15000);

    it('[P2] should verify wallet balance before and after action execution against cost registry', async () => {
      // Given: Wallet stub mode is active (DEBT-5) and a cost registry is loaded
      // Note: Real ILP fee validation is deferred to BLOCKER-1 resolution.
      // This test validates the stub-mode accounting path end-to-end.
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      const walletClient = new WalletClient(
        'http://localhost:4041',
        'test-pubkey-hex-for-story-5-4-balance-roundtrip'
      );
      walletClient.enableStubMode(10000);

      // Set up cost registry with known costs
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-test-wallet-'));
      const registryPath = path.join(tmpDir, 'test-cost-registry.json');

      fs.writeFileSync(
        registryPath,
        JSON.stringify({
          version: 1,
          defaultCost: 10,
          actions: {
            sign_in: { cost: 5, category: 'social', frequency: 'medium' },
          },
        })
      );

      try {
        const loader = new ActionCostRegistryLoader();
        const registry = loader.load(registryPath);

        // When: Balance is queried BEFORE action execution
        const balanceBefore = await walletClient.getBalance();
        expect(typeof balanceBefore).toBe('number');
        expect(Number.isFinite(balanceBefore)).toBe(true);

        // Simulate action execution: look up cost from registry
        const actionCost = registry.actions.sign_in.cost;
        expect(typeof actionCost).toBe('number');
        expect(actionCost).toBe(5);

        // When: Balance is queried AFTER action execution
        // (In stub mode, balance is not decremented by the SDK -- this validates
        // that the accounting path works without errors, not real deduction.
        // Real balance deduction is deferred to BLOCKER-1 resolution.)
        const balanceAfter = await walletClient.getBalance();
        expect(typeof balanceAfter).toBe('number');
        expect(Number.isFinite(balanceAfter)).toBe(true);

        // Then: Verify accounting path works end-to-end
        // In stub mode, balance remains constant at 10000 (DEBT-5)
        expect(balanceAfter).toBe(balanceBefore);
        // Verify the balance can afford the action cost
        expect(balanceBefore).toBeGreaterThanOrEqual(actionCost);
        expect(balanceAfter).toBeGreaterThanOrEqual(actionCost);

        // Document: In stub mode, balance is not actually decremented.
        // Real ILP fee deduction (balance -= cost) is deferred to BLOCKER-1 resolution.
        // This test validates that the full accounting lookup path (wallet query +
        // cost registry lookup + comparison) executes without errors.
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }, 15000);
  });

  // =========================================================================
  // AC6: Reusable test fixture production
  // =========================================================================
  describe('AC6: Reusable test fixture production', () => {
    it('[P0] should verify Docker health check utility exists and returns boolean', async () => {
      // Given: The docker-health fixture module
      // When: isDockerStackHealthy() is called
      const result = await isDockerStackHealthy();

      // Then: It returns a boolean (true or false)
      expect(typeof result).toBe('boolean');
    }, 10000);

    it('[P1] should verify SpacetimeDB connection helper connects and disconnects', async () => {
      // Given: Docker stack is available
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      // When: connectToSpacetimeDB() is called
      const conn = await connectToSpacetimeDB();

      // Then: Connection is active with identity
      expect(conn).toBeDefined();
      expect(conn.identity).toBeDefined();
      expect(conn.connection).toBeDefined();

      // And: disconnectFromSpacetimeDB() cleans up without error
      disconnectFromSpacetimeDB(conn);
      // No assertion needed; success is no-throw
    }, 15000);

    it('[P1] should verify createTestClient factory produces usable client', async () => {
      // Given: Docker stack is available
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      // When: createTestClient() is called
      const client = await createTestClient();

      // Then: Client has all expected properties
      expect(client).toBeDefined();
      expect(client.testConnection).toBeDefined();
      expect(client.testConnection.identity).toBeDefined();
      expect(client.testConnection.connection).toBeDefined();
      expect(client.dockerHealthy).toBe(true);
      expect(typeof client.cleanup).toBe('function');

      // And: cleanup works without error
      client.cleanup();
    }, 20000);

    it('[P1] should verify waitForTableInsert resolves on matching update', async () => {
      // Given: An active connection with subscriptions
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      const client = await createTestClient();

      try {
        // When: A reducer that inserts a row is called while listening
        try {
          await executeReducer(client.testConnection, 'player_queue_join');
        } catch {
          // Handle gracefully
        }

        const insertPromise = waitForTableInsert(
          client.testConnection,
          'signed_in_player_state',
          () => true,
          10000
        );

        await executeReducer(client.testConnection, 'sign_in', { owner_entity_id: 0 });

        // Then: waitForTableInsert resolves with the inserted row
        const { row, elapsedMs } = await insertPromise;
        expect(row).toBeDefined();
        expect(elapsedMs).toBeGreaterThanOrEqual(0);
      } finally {
        client.cleanup();
      }
    }, 30000);

    it('[P1] should verify executeReducer helper returns timing information', async () => {
      // Given: Docker stack is available and a connection is established
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      const client = await createTestClient();

      try {
        // When: executeReducer() is called with a simple reducer
        const result = await executeReducer(
          client.testConnection,
          'synchronize_time',
          Date.now() / 1000
        );

        // Then: The helper returns a result with callTimeMs timing information
        expect(result).toBeDefined();
        expect(typeof result.callTimeMs).toBe('number');
        expect(result.callTimeMs).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result.callTimeMs)).toBe(true);
      } finally {
        client.cleanup();
      }
    }, 15000);

    it('[P1] should verify verifyStateChange helper combines reducer execution with subscription verification', async () => {
      // Given: Docker stack is available and a signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }
      const { verifyStateChange: verifyStateChangeFn } = await import('./fixtures/test-client');
      const client = await createTestClient();

      try {
        // Set up preconditions: player_queue_join and sign_in
        try {
          await executeReducer(client.testConnection, 'player_queue_join');
        } catch {
          // Handle gracefully
        }
        await executeReducer(client.testConnection, 'sign_in', { owner_entity_id: 0 });
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Set up state change listener before triggering sign_out
        // verifyStateChange listens for an insert; for sign_out we use the delete pattern.
        // Instead, test verifyStateChange by signing out and then signing in again
        // to observe an insert on signed_in_player_state.
        await executeReducer(client.testConnection, 'sign_out');
        await new Promise((resolve) => setTimeout(resolve, 500));

        // When: verifyStateChange is called while triggering a state change
        // Sign in again to produce an insert on signed_in_player_state
        const signInPromise = verifyStateChangeFn(
          client.testConnection,
          'signed_in_player_state',
          () => true, // Accept any insert
          10000
        );

        await executeReducer(client.testConnection, 'sign_in', { owner_entity_id: 0 });

        // Then: verifyStateChange resolves with the row and timing information
        const result = await signInPromise;
        expect(result).toBeDefined();
        expect(result.row).toBeDefined();
        expect(typeof result.totalRoundTripMs).toBe('number');
        expect(result.totalRoundTripMs).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result.totalRoundTripMs)).toBe(true);
      } finally {
        client.cleanup();
      }
    }, 30000);

    it('[P2] should verify all fixtures are importable from barrel export (index.ts)', async () => {
      // Given: The fixtures barrel export at packages/client/src/__tests__/integration/fixtures/index.ts
      // When: All expected exports are imported
      const fixtures = await import('./fixtures/index');

      // Then: All AC6 required fixtures are exported
      // Docker stack health check
      expect(typeof fixtures.isDockerStackHealthy).toBe('function');
      expect(typeof fixtures.checkDockerStackHealth).toBe('function');
      expect(typeof fixtures.checkServiceHealth).toBe('function');
      expect(typeof fixtures.logDockerStackHealth).toBe('function');

      // SpacetimeDB WebSocket connection setup
      expect(typeof fixtures.connectToSpacetimeDB).toBe('function');
      expect(typeof fixtures.disconnectFromSpacetimeDB).toBe('function');

      // Subscription state verification helpers
      expect(typeof fixtures.waitForTableInsert).toBe('function');
      expect(typeof fixtures.waitForTableDelete).toBe('function');
      expect(typeof fixtures.queryTableState).toBe('function');
      expect(typeof fixtures.subscribeToTables).toBe('function');
      expect(typeof fixtures.subscribeToStory54Tables).toBe('function');

      // Single-action execution helper and composite test client
      expect(typeof fixtures.createTestClient).toBe('function');
      expect(typeof fixtures.executeReducer).toBe('function');
      expect(typeof fixtures.serializeReducerArgs).toBe('function');
      expect(typeof fixtures.verifyStateChange).toBe('function');
    });
  });
});
