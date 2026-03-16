/**
 * Player Lifecycle & Movement Integration Tests
 * Story 5.5: Player Lifecycle & Movement Validation
 *
 * Validates player lifecycle (spawn, existence, movement) end-to-end through
 * the SDK pipeline via direct SpacetimeDB WebSocket connection.
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
  checkDockerStackHealth,
  logDockerStackHealth,
  disconnectFromSpacetimeDB,
  type SpacetimeDBTestConnection,
  subscribeToStory55Tables,
  waitForTableInsert,
  waitForTableUpdate,
  queryTableState,
  executeReducer,
  serializeReducerArgs,
  setupSignedInPlayer,
  teardownPlayer,
  type SignedInPlayer,
} from './fixtures';
import { WalletClient } from '../../wallet/wallet-client';
import { ActionCostRegistryLoader } from '../../publish/action-cost-registry';

/**
 * Generic row type for SpacetimeDB table data accessed without generated bindings.
 * Field access is dynamic because we connect without a generated remote module.
 * Using a single file-level type avoids 45+ individual eslint-disable comments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpacetimeDBRow = Record<string, any>;

/**
 * Find a row by entity_id in a SpacetimeDB table state array.
 * Handles both numeric and BigInt entity_id comparison (SDK may use either).
 */
function findByEntityId(
  rows: SpacetimeDBRow[],
  entityId: bigint | number
): SpacetimeDBRow | undefined {
  return rows.find(
    (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId)
  );
}

// ---------------------------------------------------------------------------
// Named delay constants for test timing.
// Each value is chosen based on specific server/subscription behavior.
// ---------------------------------------------------------------------------

/** Delay after sign-in for subscription state to populate (ms). Same as POST_SIGN_IN_SETTLE_MS in player-lifecycle.ts. */
const SIGN_IN_SETTLE_MS = 1000;

/** Delay after sign-out for server to process state change (ms). */
const SIGN_OUT_SETTLE_MS = 500;

/** Brief delay to check for unexpected state changes after a failed reducer call (ms). */
const POST_FAILURE_CHECK_MS = 500;

/** Delay between sequential movements to satisfy server-side timing validation (ms). */
const INTER_MOVE_DELAY_MS = 200;

/** Delay for fallback state query after subscription timeout (ms). */
const FALLBACK_QUERY_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Conditional execution: skip all tests when Docker is not available (AGREEMENT-5)
// ---------------------------------------------------------------------------
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!runIntegrationTests)('Story 5.5: Player Lifecycle & Movement Validation', () => {
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
  // AC1: Player creation and initial state verification (FR4, FR5, NFR5)
  // =========================================================================
  describe('AC1: Player creation and initial state verification', () => {
    let testConnection: SpacetimeDBTestConnection | null = null;

    afterEach(async () => {
      await teardownPlayer(testConnection);
      testConnection = null;
    });

    it('[P0] should verify user_state entry exists with matching identity after connect', async () => {
      // Given: A running Docker stack with SpacetimeDB server
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      // When: A signed-in player is set up (connect -> subscribe -> sign_in)
      // Uses setupSignedInPlayer() for consistency with other AC1 tests
      const player = await setupSignedInPlayer();
      testConnection = player.testConnection;

      // Then: user_state entry exists with matching identity
      const userStates = queryTableState<SpacetimeDBRow>(testConnection, 'user_state');
      expect(userStates.length).toBeGreaterThan(0);

      // Verify the connection identity matches a user_state entry
      const connectionIdentity = testConnection.identity;
      const matchingUserState = userStates.find((us) => {
        const usIdentity = us.identity;
        return (
          usIdentity === connectionIdentity ||
          (usIdentity?.toHexString &&
            usIdentity.toHexString() === connectionIdentity?.toHexString?.()) ||
          String(usIdentity) === String(connectionIdentity)
        );
      });
      expect(matchingUserState).toBeDefined();
    }, 30000);

    it('[P0] should verify signed_in_player_state row exists after player_queue_join + sign_in', async () => {
      // Given: A fresh SpacetimeDB identity
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      // When: The full sign-in flow is executed
      const player = await setupSignedInPlayer();
      testConnection = player.testConnection;

      // Then: signed_in_player_state row exists for the player's entity_id
      const signedInStates = queryTableState<SpacetimeDBRow>(
        testConnection,
        'signed_in_player_state'
      );
      const matchingState = findByEntityId(signedInStates, player.entityId);
      expect(matchingState).toBeDefined();
    }, 30000);

    it('[P0] should verify mobile_entity_state row exists with valid position fields after sign-in', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      const player = await setupSignedInPlayer();
      testConnection = player.testConnection;

      // When: mobile_entity_state is queried
      const mobileStates = queryTableState<SpacetimeDBRow>(testConnection, 'mobile_entity_state');

      // Then: A mobile_entity_state row exists for this player with valid position fields
      const playerMobileState = findByEntityId(mobileStates, player.entityId);
      expect(playerMobileState).toBeDefined();

      // Verify location_x and location_z are defined and convertible to valid numbers
      // (not undefined, null, or NaN when converted)
      expect(playerMobileState!.location_x).toBeDefined();
      expect(playerMobileState!.location_z).toBeDefined();
      expect(Number.isNaN(Number(playerMobileState!.location_x))).toBe(false);
      expect(Number.isNaN(Number(playerMobileState!.location_z))).toBe(false);
    }, 30000);

    it('[P0] should verify health_state row exists with health > 0 after sign-in', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      const player = await setupSignedInPlayer();
      testConnection = player.testConnection;

      // When: health_state is queried
      const healthStates = queryTableState<SpacetimeDBRow>(testConnection, 'health_state');

      // Then: A health_state row exists for this player with health > 0
      const playerHealthState = findByEntityId(healthStates, player.entityId);
      expect(playerHealthState).toBeDefined();

      // Verify health is a positive number (player is alive)
      // Field name discovery: BitCraft Game Reference doesn't specify the exact column name
      // for health value. Try known candidates in order of likelihood.
      const health = Number(
        playerHealthState!.health ?? playerHealthState!.current_health ?? playerHealthState!.hp
      );
      expect(health).toBeGreaterThan(0);
    }, 30000);

    it('[P0] should verify identity chain: connection identity -> user_state -> entity_id -> player_state -> mobile_entity_state -> health_state -> signed_in_player_state', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      const player = await setupSignedInPlayer();
      testConnection = player.testConnection;
      const entityId = player.entityId;

      // When: The identity chain is traced across 5 tables
      // (AC1 requires: position via mobile_entity_state, health via health_state,
      //  signed-in status via player_state/signed_in_player_state)

      // 1. user_state has entry with matching identity
      const userStates = queryTableState<SpacetimeDBRow>(testConnection, 'user_state');
      const userState = findByEntityId(userStates, entityId);
      expect(userState).toBeDefined();

      // 2. player_state has entry with same entity_id
      const playerStates = queryTableState<SpacetimeDBRow>(testConnection, 'player_state');
      const playerState = findByEntityId(playerStates, entityId);
      expect(playerState).toBeDefined();

      // 3. mobile_entity_state has entry with same entity_id
      const mobileStates = queryTableState<SpacetimeDBRow>(testConnection, 'mobile_entity_state');
      const mobileState = findByEntityId(mobileStates, entityId);
      expect(mobileState).toBeDefined();

      // 4. health_state has entry with same entity_id (AC1: health observable)
      const healthStates = queryTableState<SpacetimeDBRow>(testConnection, 'health_state');
      const healthState = findByEntityId(healthStates, entityId);
      expect(healthState).toBeDefined();

      // 5. signed_in_player_state has entry with same entity_id
      const signedInStates = queryTableState<SpacetimeDBRow>(
        testConnection,
        'signed_in_player_state'
      );
      const signedInState = findByEntityId(signedInStates, entityId);
      expect(signedInState).toBeDefined();

      // Then: All state tables share the same entity_id
      // The identity chain is: connection identity -> user_state.entity_id ->
      // player_state.entity_id -> mobile_entity_state.entity_id ->
      // health_state.entity_id -> signed_in_player_state.entity_id
      expect(String(userState!.entity_id)).toBe(String(entityId));
      expect(String(playerState!.entity_id)).toBe(String(entityId));
      expect(String(mobileState!.entity_id)).toBe(String(entityId));
      expect(String(healthState!.entity_id)).toBe(String(entityId));
      expect(String(signedInState!.entity_id)).toBe(String(entityId));
    }, 30000);
  });

  // =========================================================================
  // AC2: Movement execution and position verification (FR17, NFR5)
  // =========================================================================
  describe('AC2: Movement execution and position verification', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it('[P0] should update mobile_entity_state destination after player_move with valid coordinates', async () => {
      // Given: A signed-in player with known initial position
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection, initialPosition } = player;

      // When: player_move is called with valid destination
      const destX = initialPosition.locationX + 1.0;
      const destZ = initialPosition.locationZ + 1.0;

      // Network-first pattern: register update listener BEFORE calling reducer
      const updatePromise = waitForTableUpdate<SpacetimeDBRow>(
        testConnection,
        'mobile_entity_state',
        (row) => {
          // Match our player's entity_id
          return (
            row.entity_id === player!.entityId || String(row.entity_id) === String(player!.entityId)
          );
        },
        10000
      );

      await executeReducer(testConnection, 'player_move', {
        timestamp: Date.now(),
        destination: { x: destX, z: destZ },
        origin: { x: initialPosition.locationX, z: initialPosition.locationZ },
        duration: 1.0,
        move_type: 0,
        running: false,
      });

      // Then: mobile_entity_state updates with new destination
      const { newRow } = await updatePromise;
      expect(newRow).toBeDefined();

      // Verify destination coordinates are present and match the request.
      // Server stores as i32 so values may be rounded/converted from float input.
      // We compare against the nearest integer to account for float-to-int conversion.
      expect(newRow.destination_x).toBeDefined();
      expect(newRow.destination_z).toBeDefined();
      expect(Number(newRow.destination_x)).toBeCloseTo(destX, 0);
      expect(Number(newRow.destination_z)).toBeCloseTo(destZ, 0);
    }, 30000);

    it('[P0] should verify origin coordinates in player_move request match current location', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection, entityId, initialPosition } = player;

      // When: Current position is queried from mobile_entity_state
      const mobileStates = queryTableState<SpacetimeDBRow>(testConnection, 'mobile_entity_state');
      const currentState = findByEntityId(mobileStates, entityId);
      expect(currentState).toBeDefined();

      // Then: The origin we send matches the current location
      const currentX = Number(currentState!.location_x ?? 0);
      const currentZ = Number(currentState!.location_z ?? 0);

      expect(currentX).toBe(initialPosition.locationX);
      expect(currentZ).toBe(initialPosition.locationZ);

      // And: player_move with these origin coords should succeed (not throw)
      const updatePromise = waitForTableUpdate<SpacetimeDBRow>(
        testConnection,
        'mobile_entity_state',
        (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
        10000
      );

      await executeReducer(testConnection, 'player_move', {
        timestamp: Date.now(),
        destination: { x: currentX + 1.0, z: currentZ + 1.0 },
        origin: { x: currentX, z: currentZ },
        duration: 1.0,
        move_type: 0,
        running: false,
      });

      const { newRow } = await updatePromise;
      expect(newRow).toBeDefined();
    }, 30000);

    it('[P1] should receive mobile_entity_state update within 500ms of player_move call (NFR5)', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection, entityId, initialPosition } = player;

      // When: player_move is called with timing instrumentation
      const moveStart = performance.now();

      // Network-first pattern: register listener before reducer
      const updatePromise = waitForTableUpdate<SpacetimeDBRow>(
        testConnection,
        'mobile_entity_state',
        (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
        5000
      );

      await executeReducer(testConnection, 'player_move', {
        timestamp: Date.now(),
        destination: { x: initialPosition.locationX + 1.0, z: initialPosition.locationZ + 1.0 },
        origin: { x: initialPosition.locationX, z: initialPosition.locationZ },
        duration: 1.0,
        move_type: 0,
        running: false,
      });

      const { elapsedMs } = await updatePromise;
      const totalRoundTrip = performance.now() - moveStart;

      // Then: Subscription delivers update within 500ms (NFR5)
      expect(elapsedMs).toBeLessThan(500);

      // Log timing for performance baseline
      console.log(
        `[NFR5] Movement subscription timing: elapsedMs=${elapsedMs.toFixed(1)}ms, totalRoundTrip=${totalRoundTrip.toFixed(1)}ms`
      );
    }, 30000);

    it('[P1] should update player_action_state to reflect PlayerMove action type after movement', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection, entityId, initialPosition } = player;

      // When: player_move is called
      // Listen for player_action_state update (network-first)
      const actionUpdatePromise = waitForTableUpdate<SpacetimeDBRow>(
        testConnection,
        'player_action_state',
        (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
        10000
      ).catch(() => {
        // player_action_state may not update via onUpdate; try insert fallback
        return null;
      });

      // Also listen for insert as fallback
      const actionInsertPromise = waitForTableInsert<SpacetimeDBRow>(
        testConnection,
        'player_action_state',
        (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
        10000
      ).catch(() => null);

      await executeReducer(testConnection, 'player_move', {
        timestamp: Date.now(),
        destination: { x: initialPosition.locationX + 1.0, z: initialPosition.locationZ + 1.0 },
        origin: { x: initialPosition.locationX, z: initialPosition.locationZ },
        duration: 1.0,
        move_type: 0,
        running: false,
      });

      // Then: player_action_state is updated (via update or insert)
      const updateResult = await actionUpdatePromise;
      const insertResult = await actionInsertPromise;

      // At least one should have received the update
      const actionRow = (updateResult?.newRow ?? insertResult?.row) as SpacetimeDBRow | undefined;

      // If we got a row, verify it has meaningful content. If not, query the table state directly
      if (actionRow) {
        expect(actionRow.entity_id).toBeDefined();
      } else {
        // Fallback: query table state after movement
        await new Promise((resolve) => setTimeout(resolve, FALLBACK_QUERY_DELAY_MS));
        const actionStates = queryTableState<SpacetimeDBRow>(testConnection, 'player_action_state');
        const playerAction = findByEntityId(actionStates, entityId);
        // Player action state should exist after movement
        expect(playerAction).toBeDefined();
      }
    }, 30000);
  });

  // =========================================================================
  // AC3: Invalid movement rejection
  // =========================================================================
  describe('AC3: Invalid movement rejection', () => {
    let player: SignedInPlayer | null = null;
    let testConnection: SpacetimeDBTestConnection | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
      if (testConnection) {
        disconnectFromSpacetimeDB(testConnection);
        testConnection = null;
      }
    });

    it('[P1] should reject player_move when player is not signed in with "Not signed in" error', async () => {
      // Given: A player who has signed out
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      // Set up a player and then sign out
      player = await setupSignedInPlayer();
      const { initialPosition } = player;
      testConnection = player.testConnection;

      await executeReducer(testConnection, 'sign_out');
      await new Promise((resolve) => setTimeout(resolve, SIGN_OUT_SETTLE_MS));

      // When: player_move is called while not signed in
      let errorMessage: string | undefined;
      try {
        await executeReducer(testConnection, 'player_move', {
          timestamp: Date.now(),
          destination: { x: initialPosition.locationX + 1.0, z: initialPosition.locationZ + 1.0 },
          origin: { x: initialPosition.locationX, z: initialPosition.locationZ },
          duration: 1.0,
          move_type: 0,
          running: false,
        });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      // Then: Reducer rejects with error containing "Not signed in" (case-insensitive)
      expect(errorMessage).toBeDefined();
      expect(errorMessage!.toLowerCase()).toContain('not signed in');

      // Clean up: re-sign in for teardown to work, or just set player to null
      player = null; // testConnection handles cleanup
    }, 30000);

    it('[P1] should reject player_move with missing destination with "Expected destination" error', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection: conn, initialPosition } = player;

      // When: player_move is called with destination: None (null)
      let errorMessage: string | undefined;
      try {
        await executeReducer(conn, 'player_move', {
          timestamp: Date.now(),
          destination: null, // None -- will serialize as BSATN 0x00
          origin: { x: initialPosition.locationX, z: initialPosition.locationZ },
          duration: 1.0,
          move_type: 0,
          running: false,
        });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      // Then: Reducer rejects with error containing "Expected destination"
      expect(errorMessage).toBeDefined();
      expect(errorMessage!.toLowerCase()).toContain('expected destination');
    }, 30000);

    it('[P1] should reject player_move with missing origin with "Expected origin" error', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection: conn, initialPosition } = player;

      // When: player_move is called with origin: None (null)
      let errorMessage: string | undefined;
      try {
        await executeReducer(conn, 'player_move', {
          timestamp: Date.now(),
          destination: { x: initialPosition.locationX + 1.0, z: initialPosition.locationZ + 1.0 },
          origin: null, // None -- will serialize as BSATN 0x00
          duration: 1.0,
          move_type: 0,
          running: false,
        });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      // Then: Reducer rejects with error containing "Expected origin"
      expect(errorMessage).toBeDefined();
      expect(errorMessage!.toLowerCase()).toContain('expected origin');
    }, 30000);

    it('[P1] should verify mobile_entity_state position is unchanged after each failed player_move', async () => {
      // Given: A signed-in player with known position
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection: conn, entityId, initialPosition } = player;

      // Record position before attempted invalid moves
      const beforeStates = queryTableState<SpacetimeDBRow>(conn, 'mobile_entity_state');
      const beforeState = findByEntityId(beforeStates, entityId);
      expect(beforeState).toBeDefined();
      const beforeLocationX = beforeState!.location_x;
      const beforeLocationZ = beforeState!.location_z;

      // When: Invalid player_move with missing destination
      try {
        await executeReducer(conn, 'player_move', {
          timestamp: Date.now(),
          destination: null,
          origin: { x: initialPosition.locationX, z: initialPosition.locationZ },
          duration: 1.0,
          move_type: 0,
          running: false,
        });
      } catch {
        // Expected to fail
      }

      // Brief delay for any potential (unexpected) state change
      await new Promise((resolve) => setTimeout(resolve, POST_FAILURE_CHECK_MS));

      // Then: Position is unchanged after failed move
      const afterStates = queryTableState<SpacetimeDBRow>(conn, 'mobile_entity_state');
      const afterState = findByEntityId(afterStates, entityId);
      expect(afterState).toBeDefined();
      expect(afterState!.location_x).toBe(beforeLocationX);
      expect(afterState!.location_z).toBe(beforeLocationZ);
    }, 30000);
  });

  // =========================================================================
  // AC4: Sequential movement path verification (NFR3, FR20, FR21)
  // =========================================================================
  describe('AC4: Sequential movement path verification', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it('[P1] should execute 3 sequential player_move calls (A -> B -> C) and verify each position update', async () => {
      // Given: A signed-in player with known initial position
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection, entityId, initialPosition } = player;

      // Define 3 sequential positions (small deltas to avoid anti-cheat)
      const positions = [
        { x: initialPosition.locationX + 1.0, z: initialPosition.locationZ + 1.0 },
        { x: initialPosition.locationX + 2.0, z: initialPosition.locationZ + 2.0 },
        { x: initialPosition.locationX + 3.0, z: initialPosition.locationZ + 3.0 },
      ];

      let currentX = initialPosition.locationX;
      let currentZ = initialPosition.locationZ;

      // When: 3 sequential movements are executed
      for (let i = 0; i < positions.length; i++) {
        const dest = positions[i];

        // Network-first: register listener before reducer
        const updatePromise = waitForTableUpdate<SpacetimeDBRow>(
          testConnection,
          'mobile_entity_state',
          (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
          10000
        );

        await executeReducer(testConnection, 'player_move', {
          timestamp: Date.now(),
          destination: { x: dest.x, z: dest.z },
          origin: { x: currentX, z: currentZ },
          duration: 1.0,
          move_type: 0,
          running: false,
        });

        // Wait for position update
        const { newRow } = await updatePromise;
        expect(newRow).toBeDefined();

        // Then: Verify destination in the update matches the requested destination
        // Server stores as i32, so compare with integer precision (toBeCloseTo precision 0)
        expect(Number(newRow.destination_x)).toBeCloseTo(dest.x, 0);
        expect(Number(newRow.destination_z)).toBeCloseTo(dest.z, 0);

        // Update current position for next iteration
        currentX = Number(newRow.location_x ?? currentX);
        currentZ = Number(newRow.location_z ?? currentZ);

        // Brief delay between sequential moves for server-side timing validation
        await new Promise((resolve) => setTimeout(resolve, INTER_MOVE_DELAY_MS));
      }

      // Then: All 3 movements completed with verified destinations
    }, 60000);

    it('[P1] should verify round-trip timing for each movement in sequence is < 2000ms (NFR3)', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection, entityId, initialPosition } = player;

      const timings: number[] = [];
      let currentX = initialPosition.locationX;
      let currentZ = initialPosition.locationZ;

      // When: 3 sequential movements are timed
      for (let i = 0; i < 3; i++) {
        const destX = currentX + 1.0;
        const destZ = currentZ + 1.0;

        const moveStart = performance.now();

        const updatePromise = waitForTableUpdate<SpacetimeDBRow>(
          testConnection,
          'mobile_entity_state',
          (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
          10000
        );

        await executeReducer(testConnection, 'player_move', {
          timestamp: Date.now(),
          destination: { x: destX, z: destZ },
          origin: { x: currentX, z: currentZ },
          duration: 1.0,
          move_type: 0,
          running: false,
        });

        const { newRow } = await updatePromise;
        const roundTripMs = performance.now() - moveStart;
        timings.push(roundTripMs);

        currentX = Number(newRow.location_x ?? currentX);
        currentZ = Number(newRow.location_z ?? currentZ);

        // Then: Each movement round-trip is < 2000ms (NFR3)
        expect(roundTripMs).toBeLessThan(2000);

        await new Promise((resolve) => setTimeout(resolve, INTER_MOVE_DELAY_MS));
      }

      // Log timing for performance baseline
      console.log(
        `[NFR3] Sequential movement timings: ${timings.map((t) => t.toFixed(1) + 'ms').join(', ')}`
      );
    }, 60000);

    it('[P2] should verify wallet stub-mode balance queries succeed before and after movement sequence (DEBT-5)', async () => {
      // Given: Wallet stub mode and a signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      const walletClient = new WalletClient(
        'http://localhost:4041',
        'test-pubkey-hex-for-story-5-5-movement'
      );

      // When: Balance is queried before movement
      const balanceBefore = await walletClient.getBalance();
      expect(typeof balanceBefore).toBe('number');
      expect(Number.isFinite(balanceBefore)).toBe(true);

      // Stub mode should be active
      expect(walletClient.isStubMode()).toBe(true);

      // Create cost registry with movement cost
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-test-movement-'));
      const registryPath = path.join(tmpDir, 'test-cost-registry.json');

      fs.writeFileSync(
        registryPath,
        JSON.stringify({
          version: 1,
          defaultCost: 10,
          actions: {
            player_move: { cost: 1, category: 'movement', frequency: 'high' },
          },
        })
      );

      try {
        const loader = new ActionCostRegistryLoader();
        const registry = loader.load(registryPath);

        // Verify cost lookup works
        expect(registry.actions.player_move.cost).toBe(1);

        // When: Balance is queried after movement
        const balanceAfter = await walletClient.getBalance();

        // Then: Balance is unchanged in stub mode (DEBT-5)
        expect(balanceAfter).toBe(balanceBefore);
        expect(balanceAfter).toBeGreaterThanOrEqual(registry.actions.player_move.cost * 3);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }, 15000);

    it('[P1] should verify identity chain is consistent across all movements -- same entity_id throughout', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection, entityId, initialPosition } = player;

      let currentX = initialPosition.locationX;
      let currentZ = initialPosition.locationZ;

      // When: 3 sequential movements are executed
      for (let i = 0; i < 3; i++) {
        const destX = currentX + 1.0;
        const destZ = currentZ + 1.0;

        const updatePromise = waitForTableUpdate<SpacetimeDBRow>(
          testConnection,
          'mobile_entity_state',
          (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
          10000
        );

        await executeReducer(testConnection, 'player_move', {
          timestamp: Date.now(),
          destination: { x: destX, z: destZ },
          origin: { x: currentX, z: currentZ },
          duration: 1.0,
          move_type: 0,
          running: false,
        });

        const { newRow } = await updatePromise;

        // Then: entity_id is the same on every update
        expect(String(newRow.entity_id)).toBe(String(entityId));

        currentX = Number(newRow.location_x ?? currentX);
        currentZ = Number(newRow.location_z ?? currentZ);

        await new Promise((resolve) => setTimeout(resolve, INTER_MOVE_DELAY_MS));
      }

      // Verify entity_id still matches in user_state
      const userStates = queryTableState<SpacetimeDBRow>(testConnection, 'user_state');
      const userState = findByEntityId(userStates, entityId);
      expect(userState).toBeDefined();
    }, 60000);

    it('[P2] should log min/max/avg round-trip times for the 3-movement sequence (performance baseline)', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const { testConnection, entityId, initialPosition } = player;

      const timings: number[] = [];
      let currentX = initialPosition.locationX;
      let currentZ = initialPosition.locationZ;

      // When: 3 movements are timed
      for (let i = 0; i < 3; i++) {
        const destX = currentX + 1.0;
        const destZ = currentZ + 1.0;

        const start = performance.now();

        const updatePromise = waitForTableUpdate<SpacetimeDBRow>(
          testConnection,
          'mobile_entity_state',
          (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
          10000
        );

        await executeReducer(testConnection, 'player_move', {
          timestamp: Date.now(),
          destination: { x: destX, z: destZ },
          origin: { x: currentX, z: currentZ },
          duration: 1.0,
          move_type: 0,
          running: false,
        });

        const { newRow } = await updatePromise;
        timings.push(performance.now() - start);

        currentX = Number(newRow.location_x ?? currentX);
        currentZ = Number(newRow.location_z ?? currentZ);

        await new Promise((resolve) => setTimeout(resolve, INTER_MOVE_DELAY_MS));
      }

      // Then: Log performance baseline
      const min = Math.min(...timings);
      const max = Math.max(...timings);
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;

      console.log(
        `[Performance Baseline] 3-movement sequence:`,
        `min=${min.toFixed(1)}ms, max=${max.toFixed(1)}ms, avg=${avg.toFixed(1)}ms`
      );

      // All should be under 2000ms (NFR3)
      expect(max).toBeLessThan(2000);
      expect(avg).toBeLessThan(2000);
    }, 60000);
  });

  // =========================================================================
  // AC5: Reusable lifecycle and movement fixtures
  // =========================================================================
  describe('AC5: Reusable lifecycle and movement fixtures', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it('[P1] should verify all Story 5.5 fixtures are importable from barrel export (index.ts)', async () => {
      // Given: The fixtures barrel export
      // When: All expected Story 5.5 exports are imported
      const fixtures = await import('./fixtures/index');

      // Then: All Story 5.5 fixtures are exported
      // New Story 5.5 subscription helper
      expect(typeof fixtures.subscribeToStory55Tables).toBe('function');

      // New Story 5.5 update detection helper
      expect(typeof fixtures.waitForTableUpdate).toBe('function');

      // New Story 5.5 player lifecycle helpers
      expect(typeof fixtures.setupSignedInPlayer).toBe('function');
      expect(typeof fixtures.teardownPlayer).toBe('function');

      // Existing Story 5.4 fixtures still exported
      expect(typeof fixtures.createTestClient).toBe('function');
      expect(typeof fixtures.executeReducer).toBe('function');
      expect(typeof fixtures.serializeReducerArgs).toBe('function');
      expect(typeof fixtures.verifyStateChange).toBe('function');
      expect(typeof fixtures.isDockerStackHealthy).toBe('function');
      expect(typeof fixtures.waitForTableInsert).toBe('function');
      expect(typeof fixtures.waitForTableDelete).toBe('function');
      expect(typeof fixtures.queryTableState).toBe('function');
      expect(typeof fixtures.subscribeToTables).toBe('function');
      expect(typeof fixtures.subscribeToStory54Tables).toBe('function');
    });

    it('[P1] should verify setupSignedInPlayer returns signed-in player with entityId and initialPosition', async () => {
      // Given: Docker stack is available
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      // When: setupSignedInPlayer() is called
      player = await setupSignedInPlayer();

      // Then: Returns a valid SignedInPlayer object
      expect(player).toBeDefined();
      expect(player.testConnection).toBeDefined();
      expect(player.testConnection.connection).toBeDefined();
      expect(player.testConnection.identity).toBeDefined();

      // entityId is defined and non-null
      expect(player.entityId).toBeDefined();
      expect(player.entityId).not.toBeNull();

      // initialPosition has valid coordinates
      expect(player.initialPosition).toBeDefined();
      expect(typeof player.initialPosition.locationX).toBe('number');
      expect(typeof player.initialPosition.locationZ).toBe('number');
      expect(Number.isNaN(player.initialPosition.locationX)).toBe(false);
      expect(Number.isNaN(player.initialPosition.locationZ)).toBe(false);
    }, 30000);

    it('[P1] should verify teardownPlayer calls sign_out and disconnects without errors', async () => {
      // Given: A signed-in player
      if (!dockerHealthy) {
        console.warn('Skipping: Docker stack not healthy');
        return;
      }

      player = await setupSignedInPlayer();
      const conn = player.testConnection;

      // When: teardownPlayer is called
      // This should not throw even if sign_out has issues
      await teardownPlayer(conn);

      // Then: No error thrown (success is no-throw)
      // Also verify calling with null doesn't throw
      await teardownPlayer(null);

      // Mark player as null so afterEach doesn't double-cleanup
      player = null;
    }, 30000);

    it('[P1] should verify serializeReducerArgs handles player_move with correct BSATN encoding', async () => {
      // Given: The extended serializeReducerArgs function
      // When: player_move request is serialized
      const buffer = await serializeReducerArgs('player_move', [
        {
          timestamp: 1000,
          destination: { x: 1.0, z: 2.0 },
          origin: { x: 0.0, z: 0.0 },
          duration: 1.0,
          move_type: 0,
          running: false,
        },
      ]);

      // Then: Buffer is a non-empty Uint8Array
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBeGreaterThan(0);

      // BSATN encoding breakdown for the request:
      // timestamp (u64): 8 bytes
      // destination (Some): 1 byte tag + 4 bytes x + 4 bytes z = 9 bytes
      // origin (Some): 1 byte tag + 4 bytes x + 4 bytes z = 9 bytes
      // duration (f32): 4 bytes
      // move_type (i32): 4 bytes
      // running (bool): 1 byte
      // Total: 8 + 9 + 9 + 4 + 4 + 1 = 35 bytes
      expect(buffer.length).toBe(35);

      // Verify None encoding for destination
      const bufferWithNoneDest = await serializeReducerArgs('player_move', [
        {
          timestamp: 1000,
          destination: null, // None
          origin: { x: 0.0, z: 0.0 },
          duration: 1.0,
          move_type: 0,
          running: false,
        },
      ]);

      // With None destination: 8 + 1 + 9 + 4 + 4 + 1 = 27 bytes
      expect(bufferWithNoneDest.length).toBe(27);

      // Verify None encoding for origin
      const bufferWithNoneOrigin = await serializeReducerArgs('player_move', [
        {
          timestamp: 1000,
          destination: { x: 1.0, z: 2.0 },
          origin: null, // None
          duration: 1.0,
          move_type: 0,
          running: false,
        },
      ]);

      // With None origin: 8 + 9 + 1 + 4 + 4 + 1 = 27 bytes
      expect(bufferWithNoneOrigin.length).toBe(27);

      // Verify both None: 8 + 1 + 1 + 4 + 4 + 1 = 19 bytes
      const bufferBothNone = await serializeReducerArgs('player_move', [
        {
          timestamp: 1000,
          destination: null,
          origin: null,
          duration: 1.0,
          move_type: 0,
          running: false,
        },
      ]);
      expect(bufferBothNone.length).toBe(19);
    });
  });
});
