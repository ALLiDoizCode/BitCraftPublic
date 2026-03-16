/**
 * Composite Test Client Factory
 * Story 5.4: Basic Action Round-Trip Validation (AC6)
 *
 * Combines Docker health check, SpacetimeDB connection, and subscription
 * setup into a single reusable factory for integration tests.
 *
 * Designed for reuse by Stories 5.5-5.8.
 *
 * @integration
 */

import { isDockerStackHealthy } from './docker-health';
import {
  connectToSpacetimeDB,
  disconnectFromSpacetimeDB,
  type SpacetimeDBTestConnection,
  type SpacetimeDBTestConnectionOptions,
} from './spacetimedb-connection';

/** Test client configuration */
export interface TestClientOptions extends SpacetimeDBTestConnectionOptions {
  /** Whether to check Docker health before connecting (default: true) */
  checkDockerHealth?: boolean;
  /** Tables to subscribe to (default: Story 5.4 minimum tables) */
  subscriptionQueries?: string[];
}

/** Result from createTestClient */
export interface TestClient {
  /** The underlying SpacetimeDB test connection */
  testConnection: SpacetimeDBTestConnection;
  /** Whether Docker stack was healthy at creation time */
  dockerHealthy: boolean;
  /** Clean up: disconnect and release resources */
  cleanup: () => void;
}

/** Default subscription queries for Story 5.4 */
const DEFAULT_SUBSCRIPTION_QUERIES = [
  'SELECT * FROM user_state',
  'SELECT * FROM player_state',
  'SELECT * FROM signed_in_player_state',
];

/**
 * Create a fully-configured test client for integration tests
 *
 * Handles:
 * 1. Docker stack health check (optional)
 * 2. SpacetimeDB WebSocket connection with fresh identity
 * 3. Table subscription setup
 * 4. Cleanup/disconnect
 *
 * @param options - Test client configuration
 * @returns Promise resolving to TestClient
 * @throws Error if Docker stack is not healthy (when checkDockerHealth is true)
 * @throws Error if SpacetimeDB connection fails
 */
export async function createTestClient(options?: TestClientOptions): Promise<TestClient> {
  const checkHealth = options?.checkDockerHealth ?? true;
  const subscriptionQueries = options?.subscriptionQueries ?? DEFAULT_SUBSCRIPTION_QUERIES;

  // Step 1: Check Docker health (optional)
  let dockerHealthy = true;
  if (checkHealth) {
    dockerHealthy = await isDockerStackHealthy();
    if (!dockerHealthy) {
      throw new Error(
        'Docker stack is not healthy. Cannot create test client. ' +
          'Start services: docker compose -f docker/docker-compose.yml up -d'
      );
    }
  }

  // Step 2: Connect to SpacetimeDB
  const testConnection = await connectToSpacetimeDB({
    uri: options?.uri,
    moduleName: options?.moduleName,
    timeoutMs: options?.timeoutMs,
  });

  // Step 3: Subscribe to tables using SubscriptionBuilderImpl
  if (subscriptionQueries.length > 0) {
    const { subscribeToTables } = await import('./subscription-helpers');
    await subscribeToTables(testConnection, subscriptionQueries);
  }

  return {
    testConnection,
    dockerHealthy,
    cleanup: () => {
      disconnectFromSpacetimeDB(testConnection);
    },
  };
}

/**
 * Serialize reducer arguments to BSATN binary format for SpacetimeDB callReducer
 *
 * SpacetimeDB ^1.3.3 SDK callReducer expects a Uint8Array of BSATN-encoded arguments.
 * Each reducer has a specific argument format (documented in BitCraft Game Reference).
 *
 * Known reducer argument formats for Story 5.4:
 * - synchronize_time: (f64) -- a single f64 timestamp
 * - sign_in: (PlayerSignInRequest { owner_entity_id: u64 }) -- a single u64
 * - sign_out: () -- no arguments
 * - player_queue_join: () -- no arguments
 *
 * @param reducerName - Name of the reducer
 * @param args - Arguments matching the reducer's parameter types
 * @returns Uint8Array of BSATN-encoded arguments
 */
export async function serializeReducerArgs(
  reducerName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[]
): Promise<Uint8Array> {
  const { BinaryWriter } = await import('@clockworklabs/spacetimedb-sdk');
  const writer = new BinaryWriter(256);

  switch (reducerName) {
    case 'synchronize_time': {
      // synchronize_time(client_time: f64)
      const time = typeof args[0] === 'number' ? args[0] : Date.now() / 1000;
      writer.writeF64(time);
      break;
    }
    case 'sign_in': {
      // sign_in(request: PlayerSignInRequest { owner_entity_id: u64 })
      // BSATN: struct fields in declaration order -> just a u64
      const entityId =
        typeof args[0] === 'object' && args[0] !== null
          ? BigInt(args[0].owner_entity_id ?? 0)
          : BigInt(args[0] ?? 0);
      writer.writeU64(entityId);
      break;
    }
    case 'sign_out':
    case 'player_queue_join':
      // No arguments
      break;
    case 'player_move': {
      // player_move(request: PlayerMoveRequest)
      // BSATN: struct fields in declaration order:
      //   timestamp: u64 (8 bytes, little-endian)
      //   destination: Option<OffsetCoordinatesFloat> (1 byte tag + optional struct)
      //   origin: Option<OffsetCoordinatesFloat> (1 byte tag + optional struct)
      //   duration: f32 (4 bytes, little-endian IEEE 754)
      //   move_type: i32 (4 bytes, little-endian)
      //   running: bool (1 byte)
      //
      // OffsetCoordinatesFloat { x: f32, z: f32 }
      //
      // Option<T> encoding:
      //   None  = 0x00
      //   Some  = 0x01 + serialized T
      const request = args[0];
      if (!request || typeof request !== 'object') {
        throw new Error(
          "serializeReducerArgs('player_move'): first argument must be a PlayerMoveRequest object"
        );
      }

      // timestamp: u64
      const timestamp = BigInt(request.timestamp ?? Date.now());
      writer.writeU64(timestamp);

      // destination: Option<OffsetCoordinatesFloat>
      writeOptionOffsetCoordinatesFloat(writer, request.destination);

      // origin: Option<OffsetCoordinatesFloat>
      writeOptionOffsetCoordinatesFloat(writer, request.origin);

      // duration: f32
      const duration = typeof request.duration === 'number' ? request.duration : 1.0;
      writer.writeF32(duration);

      // move_type: i32
      const moveType = typeof request.move_type === 'number' ? request.move_type : 0;
      writer.writeI32(moveType);

      // running: bool
      writer.writeBool(request.running === true);
      break;
    }
    default:
      // For unknown reducers, attempt to serialize as empty (no args)
      // Stories 5.6-5.8 will extend this serializer for additional reducers
      break;
  }

  return writer.getBuffer();
}

/**
 * Write an Option<OffsetCoordinatesFloat> value to a BSATN BinaryWriter
 *
 * OffsetCoordinatesFloat { x: f32, z: f32 }
 *
 * BSATN Option<T> encoding:
 * - None:    single byte 0x00
 * - Some(v): byte 0x01 followed by serialized value
 *
 * @param writer - BinaryWriter instance from SpacetimeDB SDK
 * @param coord - Coordinate object { x: number, z: number } or null/undefined for None
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeOptionOffsetCoordinatesFloat(writer: any, coord: { x: number; z: number } | null | undefined): void {
  if (coord == null) {
    // None: BSATN Option discriminant 0x00
    // writeBool(false) emits a single 0x00 byte, which matches the BSATN None tag.
    // BSATN bool and Option discriminant share the same single-byte encoding.
    writer.writeBool(false);
  } else {
    // Some(OffsetCoordinatesFloat { x, z }): BSATN Option discriminant 0x01 + value
    // writeBool(true) emits a single 0x01 byte, which matches the BSATN Some tag.
    writer.writeBool(true);
    writer.writeF32(coord.x);
    writer.writeF32(coord.z);
  }
}

/**
 * Execute a reducer and measure timing
 *
 * Uses SpacetimeDB SDK ^1.3.3 callReducer() with BSATN-serialized arguments.
 * Since we connect with a null remote module (no generated bindings), we
 * call reducers directly via the DbConnectionImpl.callReducer() API.
 *
 * Records timing for NFR3 (round-trip < 2000ms) and NFR5 (subscription < 500ms).
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param reducerName - Name of the reducer to call
 * @param args - Arguments to pass to the reducer (types depend on reducer)
 * @returns Promise resolving to timing information
 * @throws Error if reducer call fails
 */
export async function executeReducer(
  testConnection: SpacetimeDBTestConnection,
  reducerName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
): Promise<{ callTimeMs: number }> {
  const conn = testConnection.connection;
  if (!conn) {
    throw new Error('No active SpacetimeDB connection');
  }

  // Validate reducer name (consistent with ilp-packet.ts: alphanumeric + underscore, 1-64 chars)
  // Prevents debugging headaches from typos in Stories 5.5-5.8.
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(reducerName)) {
    throw new Error(
      `Invalid reducer name '${reducerName}': must be 1-64 alphanumeric/underscore characters. ` +
        'Check for typos or unsupported characters.'
    );
  }

  // Serialize arguments to BSATN binary format
  const argsBuffer = await serializeReducerArgs(reducerName, args);

  // callReducer sends the message over WebSocket. The server responds with
  // a TransactionUpdate message that triggers the onReducer callback.
  // We listen for the response to get proper round-trip timing.
  const start = performance.now();

  return new Promise<{ callTimeMs: number }>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (typeof conn.offReducer === 'function') {
        conn.offReducer(reducerName, reducerCallback);
      }
      // Reject on timeout so callers are aware the reducer callback was never received.
      // If the reducer executed but the callback was missed (e.g., no remote module),
      // callers should use verifyStateChange() to confirm via subscription updates.
      reject(
        new Error(
          `executeReducer('${reducerName}') timed out after 5000ms waiting for reducer callback. ` +
            'The reducer may have executed -- verify via subscription updates if needed.'
        )
      );
    }, 5000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reducerCallback = (ctx: any, ...rest: any[]) => {
      clearTimeout(timeoutId);
      if (typeof conn.offReducer === 'function') {
        conn.offReducer(reducerName, reducerCallback);
      }
      const callTimeMs = performance.now() - start;

      // Check for reducer error via SDK ReducerEventContextInterface.event
      // The ctx.event property contains the ReducerEvent with status information.
      // Also check rest args as fallback for SDK version compatibility.
      const ctxEvent = ctx?.event;
      const isError =
        ctxEvent instanceof Error ||
        (typeof ctxEvent === 'object' && ctxEvent !== null && ctxEvent?.tag === 'Failed');
      const restError = rest.find(
        (arg) => arg instanceof Error || (typeof arg === 'object' && arg?.message)
      );
      const error = isError ? ctxEvent : restError;

      if (error) {
        const errorMsg =
          error instanceof Error ? error.message : error?.message || JSON.stringify(error);
        reject(new Error(`Reducer '${reducerName}' failed: ${errorMsg}`));
        return;
      }

      resolve({ callTimeMs });
    };

    // Register reducer response listener
    if (typeof conn.onReducer === 'function') {
      conn.onReducer(reducerName, reducerCallback);
    }

    // Send the reducer call
    // callReducer requires 3 args: (reducerName, argsBuffer, flags: CallReducerFlags)
    // 'FullUpdate' ensures we receive TransactionUpdate with subscription changes
    conn.callReducer(reducerName, argsBuffer, 'FullUpdate');

    // If no onReducer support, resolve after a brief delay
    if (typeof conn.onReducer !== 'function') {
      clearTimeout(timeoutId);
      setTimeout(() => {
        resolve({ callTimeMs: performance.now() - start });
      }, 200);
    }
  });
}

/**
 * Wait for a state change on a table and measure elapsed time
 *
 * Listens for an insert on the specified table matching the predicate.
 * Call this BEFORE triggering the reducer that produces the state change,
 * so the listener is in place before the event arrives.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param tableName - Table to watch for changes
 * @param predicate - Predicate to match the expected state change
 * @param timeoutMs - Maximum time to wait for state change (default: 5000ms)
 * @returns Promise resolving to the matching row and elapsed time from call to receipt
 */
export async function verifyStateChange<T = unknown>(
  testConnection: SpacetimeDBTestConnection,
  tableName: string,
  predicate: (row: T) => boolean,
  timeoutMs: number = 5000
): Promise<{ row: T; totalRoundTripMs: number }> {
  // Import dynamically to avoid circular dependency
  const { waitForTableInsert } = await import('./subscription-helpers');

  const start = performance.now();
  const { row } = await waitForTableInsert<T>(testConnection, tableName, predicate, timeoutMs);
  const totalRoundTripMs = performance.now() - start;

  return { row, totalRoundTripMs };
}
