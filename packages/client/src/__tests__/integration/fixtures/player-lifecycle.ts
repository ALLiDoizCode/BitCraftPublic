/**
 * Player Lifecycle Setup and Teardown Fixtures
 * Story 5.5: Player Lifecycle & Movement Validation (AC1, AC2, AC5)
 *
 * Provides reusable helpers for getting a player into a gameplay-ready state:
 * connect -> subscribe -> player_queue_join -> sign_in -> verify state.
 *
 * Designed for reuse by Stories 5.6-5.8 which need signed-in players
 * for resource gathering, crafting, and error scenario testing.
 *
 * BLOCKER-1 Workaround: Uses direct SpacetimeDB WebSocket connection.
 * The SpacetimeDB connection identity IS the player identity via ctx.sender.
 *
 * @integration
 */

import {
  connectToSpacetimeDB,
  disconnectFromSpacetimeDB,
  type SpacetimeDBTestConnection,
  type SpacetimeDBTestConnectionOptions,
} from './spacetimedb-connection';
import {
  subscribeToStory55Tables,
  queryTableState,
  waitForTableInsert,
} from './subscription-helpers';
import { executeReducer } from './test-client';

/**
 * Generic row type for SpacetimeDB table data accessed without generated bindings.
 * Same pattern as in player-lifecycle-movement.test.ts to avoid eslint-disable comments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpacetimeDBRow = Record<string, any>;

/** Delay after sign-in to allow subscription state to populate (ms) */
const POST_SIGN_IN_SETTLE_MS = 1000;

/** Result from setupSignedInPlayer() */
export interface SignedInPlayer {
  /** The underlying SpacetimeDB test connection */
  testConnection: SpacetimeDBTestConnection;
  /** The player's entity_id from user_state (used for position queries) */
  entityId: bigint | number;
  /** The player's initial position from mobile_entity_state after sign-in */
  initialPosition: { locationX: number; locationZ: number };
}

/** Options for setupSignedInPlayer() */
export interface SetupSignedInPlayerOptions extends SpacetimeDBTestConnectionOptions {
  /** Timeout for the sign-in flow in milliseconds (default: 20000) */
  signInTimeoutMs?: number;
}

/**
 * Set up a fully signed-in player ready for gameplay
 *
 * Handles the complete player lifecycle setup sequence:
 * 1. Connect to SpacetimeDB (fresh identity)
 * 2. Subscribe to Story 5.5 tables (7 tables)
 * 3. Call player_queue_join (handle already-queued gracefully)
 * 4. Call sign_in and verify signed_in_player_state exists
 * 5. Extract entity_id from user_state
 * 6. Query initial position from mobile_entity_state
 *
 * @param options - Connection and timeout configuration
 * @returns Promise resolving to SignedInPlayer with connection, entityId, initialPosition
 * @throws Error if any step of the sign-in flow fails
 */
export async function setupSignedInPlayer(
  options?: SetupSignedInPlayerOptions
): Promise<SignedInPlayer> {
  // Step 1: Connect to SpacetimeDB
  const testConnection = await connectToSpacetimeDB({
    uri: options?.uri,
    moduleName: options?.moduleName,
    timeoutMs: options?.timeoutMs,
  });

  try {
    // Step 2: Subscribe to Story 5.5 tables (7 tables)
    await subscribeToStory55Tables(testConnection);

    // Step 3: player_queue_join (may fail if already queued -- that's OK)
    try {
      await executeReducer(testConnection, 'player_queue_join');
    } catch {
      // Expected: player may already be in queue or auto-created
    }

    // Step 4: sign_in with network-first pattern (listener before reducer)
    const signInPromise = waitForTableInsert(
      testConnection,
      'signed_in_player_state',
      () => true,
      options?.signInTimeoutMs ?? 20000
    );

    await executeReducer(testConnection, 'sign_in', { owner_entity_id: 0 });

    // Wait for signed_in_player_state to confirm sign-in
    await signInPromise;

    // Step 5: Extract entity_id from user_state matching this connection's identity.
    // Allow brief delay for subscription state to populate (POST_SIGN_IN_SETTLE_MS).
    await new Promise((resolve) => setTimeout(resolve, POST_SIGN_IN_SETTLE_MS));

    const userStates = queryTableState<SpacetimeDBRow>(testConnection, 'user_state');
    if (userStates.length === 0) {
      throw new Error(
        'No user_state rows found after sign-in. Subscription may not include user_state.'
      );
    }

    // Match by connection identity to avoid grabbing another player's entity_id
    // when multiple clients are connected to the same server. This mirrors the
    // identity-matching pattern used in the AC1 test (test file line 119-130).
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

    // Fall back to first row if identity matching fails (e.g., SDK version difference)
    const userStateRow = matchingUserState ?? userStates[0];
    const entityId = userStateRow.entity_id;
    if (entityId == null) {
      throw new Error('user_state entry has no entity_id. Check user_state table schema.');
    }

    // Step 6: Query initial position from mobile_entity_state
    const mobileStates = queryTableState<SpacetimeDBRow>(testConnection, 'mobile_entity_state');
    const playerMobileState = mobileStates.find((ms: SpacetimeDBRow) => {
      // Compare entity_id -- may be BigInt or number depending on SDK
      return ms.entity_id === entityId || String(ms.entity_id) === String(entityId);
    });

    let initialPosition = { locationX: 0, locationZ: 0 };
    if (playerMobileState) {
      initialPosition = {
        locationX: Number(playerMobileState.location_x ?? 0),
        locationZ: Number(playerMobileState.location_z ?? 0),
      };
    }

    return {
      testConnection,
      entityId,
      initialPosition,
    };
  } catch (error) {
    // Clean up on failure
    disconnectFromSpacetimeDB(testConnection);
    throw error;
  }
}

/**
 * Gracefully tear down a signed-in player
 *
 * Calls sign_out reducer and disconnects from SpacetimeDB.
 * Handles errors gracefully -- teardown should never throw in afterEach hooks.
 *
 * @param testConnection - Active SpacetimeDB test connection to tear down
 */
export async function teardownPlayer(
  testConnection: SpacetimeDBTestConnection | null
): Promise<void> {
  if (!testConnection) return;

  try {
    // Attempt to sign out first
    await executeReducer(testConnection, 'sign_out');
  } catch {
    // Sign-out may fail if already signed out or connection lost -- that's OK
  }

  // Always disconnect, even if sign_out failed
  disconnectFromSpacetimeDB(testConnection);
}
