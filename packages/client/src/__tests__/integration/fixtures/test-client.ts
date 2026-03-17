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
    case 'extract_start':
    case 'extract': {
      // extract_start(request: PlayerExtractRequest) / extract(request: PlayerExtractRequest)
      // BSATN: struct fields in declaration order:
      //   recipe_id: i32            (4 bytes, little-endian)
      //   target_entity_id: u64     (8 bytes, little-endian)
      //   timestamp: u64            (8 bytes, little-endian)
      //   clear_from_claim: bool    (1 byte, 0x00=false, 0x01=true)
      //
      // Total: 21 bytes per serialized PlayerExtractRequest.
      //
      // See Story 5.6 Dev Notes for field descriptions and recommended values.
      const request = args[0];
      if (!request || typeof request !== 'object') {
        throw new Error(
          `serializeReducerArgs('${reducerName}'): first argument must be a PlayerExtractRequest object`
        );
      }

      // recipe_id: i32
      const recipeId = typeof request.recipe_id === 'number' ? request.recipe_id : 1;
      writer.writeI32(recipeId);

      // target_entity_id: u64
      const targetEntityId = BigInt(request.target_entity_id ?? 0);
      writer.writeU64(targetEntityId);

      // timestamp: u64
      const extractTimestamp = BigInt(request.timestamp ?? Date.now());
      writer.writeU64(extractTimestamp);

      // clear_from_claim: bool
      writer.writeBool(request.clear_from_claim === true);
      break;
    }
    case 'craft_initiate_start':
    case 'craft_initiate': {
      // craft_initiate_start(request: PlayerCraftInitiateRequest)
      // craft_initiate(request: PlayerCraftInitiateRequest)
      // BSATN: struct fields in declaration order:
      //   recipe_id: i32              (4 bytes, little-endian)
      //   building_entity_id: u64     (8 bytes, little-endian)
      //   count: i32                  (4 bytes, little-endian)
      //   timestamp: u64              (8 bytes, little-endian)
      //   is_public: bool             (1 byte, 0x00=false, 0x01=true)
      //
      // Total: 25 bytes per serialized PlayerCraftInitiateRequest.
      const craftInitReq = args[0];
      if (!craftInitReq || typeof craftInitReq !== 'object') {
        throw new Error(
          `serializeReducerArgs('${reducerName}'): first argument must be a PlayerCraftInitiateRequest object`
        );
      }

      // recipe_id: i32
      const craftRecipeId = typeof craftInitReq.recipe_id === 'number' ? craftInitReq.recipe_id : 1;
      writer.writeI32(craftRecipeId);

      // building_entity_id: u64
      const buildingEntityId = BigInt(craftInitReq.building_entity_id ?? 0);
      writer.writeU64(buildingEntityId);

      // count: i32
      const craftCount = typeof craftInitReq.count === 'number' ? craftInitReq.count : 1;
      writer.writeI32(craftCount);

      // timestamp: u64
      const craftInitTimestamp = BigInt(craftInitReq.timestamp ?? Date.now());
      writer.writeU64(craftInitTimestamp);

      // is_public: bool
      writer.writeBool(craftInitReq.is_public === true);
      break;
    }
    case 'craft_continue_start':
    case 'craft_continue': {
      // craft_continue_start(request: PlayerCraftContinueRequest)
      // craft_continue(request: PlayerCraftContinueRequest)
      // BSATN: struct fields in declaration order:
      //   progressive_action_entity_id: u64   (8 bytes, little-endian)
      //   timestamp: u64                      (8 bytes, little-endian)
      //
      // Total: 16 bytes per serialized PlayerCraftContinueRequest.
      const craftContReq = args[0];
      if (!craftContReq || typeof craftContReq !== 'object') {
        throw new Error(
          `serializeReducerArgs('${reducerName}'): first argument must be a PlayerCraftContinueRequest object`
        );
      }

      // progressive_action_entity_id: u64
      const progressiveActionEntityId = BigInt(craftContReq.progressive_action_entity_id ?? 0);
      writer.writeU64(progressiveActionEntityId);

      // timestamp: u64
      const craftContTimestamp = BigInt(craftContReq.timestamp ?? Date.now());
      writer.writeU64(craftContTimestamp);
      break;
    }
    case 'craft_collect': {
      // craft_collect(request: PlayerCraftCollectRequest)
      // BSATN: struct fields in declaration order:
      //   pocket_id: u64              (8 bytes, little-endian)
      //   recipe_id: i32              (4 bytes, little-endian)
      //
      // Total: 12 bytes per serialized PlayerCraftCollectRequest.
      const craftCollectReq = args[0];
      if (!craftCollectReq || typeof craftCollectReq !== 'object') {
        throw new Error(
          `serializeReducerArgs('${reducerName}'): first argument must be a PlayerCraftCollectRequest object`
        );
      }

      // pocket_id: u64
      const pocketId = BigInt(craftCollectReq.pocket_id ?? 0);
      writer.writeU64(pocketId);

      // recipe_id: i32
      const collectRecipeId =
        typeof craftCollectReq.recipe_id === 'number' ? craftCollectReq.recipe_id : 1;
      writer.writeI32(collectRecipeId);
      break;
    }
    case 'craft_collect_all': {
      // craft_collect_all(request: PlayerCraftCollectAllRequest)
      // BSATN: struct fields in declaration order:
      //   building_entity_id: u64     (8 bytes, little-endian)
      //
      // Total: 8 bytes per serialized PlayerCraftCollectAllRequest.
      const craftCollectAllReq = args[0];
      if (!craftCollectAllReq || typeof craftCollectAllReq !== 'object') {
        throw new Error(
          `serializeReducerArgs('${reducerName}'): first argument must be a PlayerCraftCollectAllRequest object`
        );
      }

      // building_entity_id: u64
      const collectAllBuildingId = BigInt(craftCollectAllReq.building_entity_id ?? 0);
      writer.writeU64(collectAllBuildingId);
      break;
    }
    case 'craft_cancel': {
      // craft_cancel(request: PlayerCraftCancelRequest)
      // BSATN: struct fields in declaration order:
      //   pocket_id: u64              (8 bytes, little-endian)
      //
      // Total: 8 bytes per serialized PlayerCraftCancelRequest.
      // Note: PlayerCraftCancelRequest is a separate struct from PlayerCraftCollectRequest
      // with only pocket_id (server source: action_request.rs).
      const craftCancelReq = args[0];
      if (!craftCancelReq || typeof craftCancelReq !== 'object') {
        throw new Error(
          `serializeReducerArgs('${reducerName}'): first argument must be a PlayerCraftCancelRequest object`
        );
      }

      // pocket_id: u64
      const cancelPocketId = BigInt(craftCancelReq.pocket_id ?? 0);
      writer.writeU64(cancelPocketId);
      break;
    }
    // --- Cheat/Admin reducers for seed helpers ---
    case 'start_agents':
    case 'stop_agents':
    case 'admin_despawn_overworld_enemies':
      // No arguments
      break;
    case 'cheat_item_stack_grant': {
      // cheat_item_stack_grant(player_entity_id: u64, item_id: i32, quantity: i32, is_cargo: bool)
      // BSATN: u64 + i32 + i32 + bool = 17 bytes
      const playerEntityId = BigInt(args[0] ?? 0);
      const itemId = typeof args[1] === 'number' ? args[1] : 0;
      const quantity = typeof args[2] === 'number' ? args[2] : 1;
      const isCargo = args[3] === true;
      writer.writeU64(playerEntityId);
      writer.writeI32(itemId);
      writer.writeI32(quantity);
      writer.writeBool(isCargo);
      break;
    }
    case 'cheat_kill': {
      // cheat_kill(entity_id: u64)
      // BSATN: u64 = 8 bytes
      const killEntityId = BigInt(args[0] ?? 0);
      writer.writeU64(killEntityId);
      break;
    }
    case 'admin_resource_force_regen': {
      // admin_resource_force_regen(resource_id: i32, iterations: i32, ignore_target_count: bool)
      // BSATN: i32 + i32 + bool = 9 bytes
      const resourceId = typeof args[0] === 'number' ? args[0] : 0;
      const iterations = typeof args[1] === 'number' ? args[1] : 1;
      const ignoreTargetCount = args[2] === true;
      writer.writeI32(resourceId);
      writer.writeI32(iterations);
      writer.writeBool(ignoreTargetCount);
      break;
    }
    case 'cheat_experience_grant': {
      // cheat_experience_grant(request: CheatExperienceGrantRequest)
      // BSATN: u64 + i32 + i32 = 16 bytes
      const xpReq = args[0];
      if (!xpReq || typeof xpReq !== 'object') {
        throw new Error(
          "serializeReducerArgs('cheat_experience_grant'): first argument must be a CheatExperienceGrantRequest object"
        );
      }
      writer.writeU64(BigInt(xpReq.owner_entity_id ?? 0));
      writer.writeI32(typeof xpReq.skill_id === 'number' ? xpReq.skill_id : 0);
      writer.writeI32(typeof xpReq.amount === 'number' ? xpReq.amount : 0);
      break;
    }
    case 'cheat_grant_knowledge': {
      // cheat_grant_knowledge(request: CheatGrantKnowledgeRequest)
      // BSATN: u64 + bool = 9 bytes
      const knowledgeReq = args[0];
      if (!knowledgeReq || typeof knowledgeReq !== 'object') {
        throw new Error(
          "serializeReducerArgs('cheat_grant_knowledge'): first argument must be a CheatGrantKnowledgeRequest object"
        );
      }
      writer.writeU64(BigInt(knowledgeReq.target_entity_id ?? 0));
      writer.writeBool(knowledgeReq.also_learn === true);
      break;
    }
    case 'cheat_teleport_float': {
      // cheat_teleport_float(request: CheatTeleportFloatRequest)
      // BSATN: u64 + Option<OffsetCoordinatesFloat> (3-field: i32 x, i32 z, u32 dimension)
      const teleportReq = args[0];
      if (!teleportReq || typeof teleportReq !== 'object') {
        throw new Error(
          "serializeReducerArgs('cheat_teleport_float'): first argument must be a CheatTeleportFloatRequest object"
        );
      }
      writer.writeU64(BigInt(teleportReq.player_entity_id ?? 0));
      writeOptionOffsetCoordinatesFloatFull(writer, teleportReq.destination);
      break;
    }
    case 'cheat_discover_map': {
      // cheat_discover_map(request: CheatDiscoverMapRequest)
      // BSATN: u64 = 8 bytes
      const discoverReq = args[0];
      if (!discoverReq || typeof discoverReq !== 'object') {
        throw new Error(
          "serializeReducerArgs('cheat_discover_map'): first argument must be a CheatDiscoverMapRequest object"
        );
      }
      writer.writeU64(BigInt(discoverReq.target_entity_id ?? 0));
      break;
    }
    case 'cheat_compendium_place_enemy': {
      // cheat_compendium_place_enemy(request: CheatCompendiumEnemyPlaceRequest)
      // BSATN: OffsetCoordinatesSmallMessage(i32+i32+u32) + u8 enemy_type = 13 bytes
      const enemyReq = args[0];
      if (!enemyReq || typeof enemyReq !== 'object') {
        throw new Error(
          "serializeReducerArgs('cheat_compendium_place_enemy'): first argument must be a CheatCompendiumEnemyPlaceRequest object"
        );
      }
      writeOffsetCoordinatesSmallMessage(writer, enemyReq.coordinates);
      // CRITICAL: BSATN encodes EnemyType as u8 variant tag, NOT i32
      writer.writeByte(typeof enemyReq.enemy_type === 'number' ? enemyReq.enemy_type : 0);
      break;
    }
    case 'cheat_building_place': {
      // cheat_building_place(request: PlayerProjectSitePlaceRequest)
      // BSATN: OffsetCoordinatesSmallMessage(i32+i32+u32) + i32 + i32 + i32 = 24 bytes
      const buildReq = args[0];
      if (!buildReq || typeof buildReq !== 'object') {
        throw new Error(
          "serializeReducerArgs('cheat_building_place'): first argument must be a PlayerProjectSitePlaceRequest object"
        );
      }
      writeOffsetCoordinatesSmallMessage(writer, buildReq.coordinates);
      writer.writeI32(
        typeof buildReq.construction_recipe_id === 'number' ? buildReq.construction_recipe_id : 0
      );
      writer.writeI32(
        typeof buildReq.resource_placement_recipe_id === 'number'
          ? buildReq.resource_placement_recipe_id
          : 0
      );
      writer.writeI32(
        typeof buildReq.facing_direction === 'number' ? buildReq.facing_direction : 0
      );
      break;
    }
    default:
      // For unknown reducers, attempt to serialize as empty (no args)
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
function writeOptionOffsetCoordinatesFloat(
  writer: any,
  coord: { x: number; z: number } | null | undefined
): void {
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
 * Write an Option<OffsetCoordinatesFloat> value with the full 3-field format
 *
 * OffsetCoordinatesFloat { x: i32, z: i32, dimension: u32 }
 *
 * This is the correct 3-field format per server source. The existing
 * writeOptionOffsetCoordinatesFloat uses 2-field f32 format for player_move
 * compatibility — do NOT modify that. This helper is for cheat reducers.
 *
 * Note: cheat_teleport_float server code hardcodes dimension = 1 regardless
 * of client input.
 *
 * IMPORTANT: x, z, and dimension are written as i32/u32. Float values passed
 * as TypeScript `number` will be truncated to integer by writeI32/writeU32.
 * Pass integer coordinates to avoid silent truncation.
 *
 * @param writer - BinaryWriter instance from SpacetimeDB SDK
 * @param coord - Coordinate object { x: number, z: number, dimension?: number } or null/undefined for None
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeOptionOffsetCoordinatesFloatFull(
  writer: any,
  coord: { x: number; z: number; dimension?: number } | null | undefined
): void {
  if (coord == null) {
    writer.writeBool(false); // None tag 0x00
  } else {
    writer.writeBool(true); // Some tag 0x01
    writer.writeI32(typeof coord.x === 'number' ? coord.x : 0);
    writer.writeI32(typeof coord.z === 'number' ? coord.z : 0);
    writer.writeU32(typeof coord.dimension === 'number' ? coord.dimension : 0);
  }
}

/**
 * Write an OffsetCoordinatesSmallMessage value to a BSATN BinaryWriter
 *
 * OffsetCoordinatesSmallMessage { x: i32, z: i32, dimension: u32 }
 * BSATN: i32 + i32 + u32 = 12 bytes
 *
 * @param writer - BinaryWriter instance from SpacetimeDB SDK
 * @param coord - Coordinate object { x: number, z: number, dimension?: number }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeOffsetCoordinatesSmallMessage(
  writer: any,
  coord: { x: number; z: number; dimension?: number }
): void {
  if (coord == null) {
    throw new Error(
      'writeOffsetCoordinatesSmallMessage: coord must not be null/undefined'
    );
  }
  writer.writeI32(typeof coord.x === 'number' ? coord.x : 0);
  writer.writeI32(typeof coord.z === 'number' ? coord.z : 0);
  writer.writeU32(typeof coord.dimension === 'number' ? coord.dimension : 0);
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
