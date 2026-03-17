/**
 * Seed Helpers — Typed wrappers for cheat/admin reducers
 *
 * Provides ergonomic test helpers for composing game world state in integration tests.
 * Each helper wraps a cheat or admin reducer via executeReducer() with typed parameters.
 *
 * These helpers ONLY work against the Docker dev stack where all roles are auto-granted
 * via the has_role() dev-mode bypass in authentication.rs. They will NOT work against
 * a production server.
 *
 * Designed for extension by SDK validation Epics 9-13.
 *
 * @integration
 */

import type { SpacetimeDBTestConnection } from './spacetimedb-connection';
import { executeReducer } from './test-client';

// ---------------------------------------------------------------------------
// Enemy Type Constants
// ---------------------------------------------------------------------------

/**
 * EnemyType variant indices matching BSATN u8 tag encoding.
 * These are BSATN sum type variant tags (u8), NOT Rust #[repr(i32)] discriminants.
 * Source: BitCraftServer/packages/game/src/messages/static_data.rs
 */
export const EnemyTypeId = {
  None: 0,
  PracticeDummy: 1,
  // Huntable Animals
  GrassBird: 2,
  DesertBird: 3,
  SwampBird: 4,
  Goat: 5,
  MountainGoat: 6,
  DeerFemale: 7,
  DeerMale: 8,
  Elk: 9,
  BoarFemale: 10,
  BoarMale: 11,
  BoarElder: 12,
  PlainsOx: 13,
  TundraOx: 14,
  JungleLargeBird: 15,
  DesertLargeBird: 16,
  // Monsters
  Jakyl: 17,
  AlphaJakyl: 18,
  KingJakyl: 19,
  RockCrab: 20,
  DesertCrab: 21,
  FrostCrab: 22,
  ForestToad: 23,
  SwampToad: 24,
  FrostToad: 25,
  Umbura: 26,
  AlphaUmbura: 27,
  KingUmbura: 28,
} as const;

/** Type for EnemyTypeId values */
export type EnemyTypeIdValue = (typeof EnemyTypeId)[keyof typeof EnemyTypeId];

// ---------------------------------------------------------------------------
// Parameter Interfaces
// ---------------------------------------------------------------------------

/** Parameters for grantItems() */
export interface GrantItemsParams {
  /** Player's entity_id */
  playerEntityId: bigint | number;
  /** Item descriptor ID */
  itemId: number;
  /** Number of items to grant */
  quantity: number;
  /** Whether to place in cargo inventory (default: false) */
  isCargo?: boolean;
}

/** Parameters for grantExperience() */
export interface GrantExperienceParams {
  /** Entity that owns the experience (player entity_id) */
  ownerEntityId: bigint | number;
  /** Skill descriptor ID */
  skillId: number;
  /** Amount of XP to grant */
  amount: number;
}

/** Parameters for grantKnowledge() */
export interface GrantKnowledgeParams {
  /** Target entity_id to receive knowledge */
  targetEntityId: bigint | number;
  /** Whether to also learn dependent knowledge (default: false) */
  alsoLearn?: boolean;
}

/** Parameters for teleportPlayer() */
export interface TeleportPlayerParams {
  /** Player's entity_id */
  playerEntityId: bigint | number;
  /** Destination coordinates. Note: server hardcodes dimension = 1. */
  destination: {
    x: number;
    z: number;
    /** Dimension (default: 0). Server overrides to 1 for cheat_teleport_float. */
    dimension?: number;
  };
}

/** Parameters for spawnEnemy() */
export interface SpawnEnemyParams {
  /** World coordinates where the enemy will spawn */
  coordinates: {
    x: number;
    z: number;
    /** Dimension (default: 0) */
    dimension?: number;
  };
  /** Enemy type variant index (use EnemyTypeId constants) */
  enemyType: EnemyTypeIdValue;
}

/** Parameters for placeBuilding() */
export interface PlaceBuildingParams {
  /** World coordinates for the building */
  coordinates: {
    x: number;
    z: number;
    /** Dimension (default: 0) */
    dimension?: number;
  };
  /** Construction recipe descriptor ID */
  constructionRecipeId: number;
  /** Resource placement recipe ID (default: 0) */
  resourcePlacementRecipeId?: number;
  /** Facing direction (default: 0) */
  facingDirection?: number;
}

/** Parameters for discoverMap() */
export interface DiscoverMapParams {
  /** Target entity_id whose map is being discovered */
  targetEntityId: bigint | number;
}

/** Parameters for killEntity() */
export interface KillEntityParams {
  /** Entity ID to kill */
  entityId: bigint | number;
}

/** Parameters for forceResourceRegen() */
export interface ForceResourceRegenParams {
  /** Resource descriptor ID */
  resourceId: number;
  /** Number of regen iterations (default: 1) */
  iterations?: number;
  /** Whether to ignore target count limits (default: false) */
  ignoreTargetCount?: boolean;
}

// ---------------------------------------------------------------------------
// Seed Helper Functions
// ---------------------------------------------------------------------------

/**
 * Grant items to a player's inventory via cheat_item_stack_grant.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param params - Item grant parameters
 * @returns Reducer call timing
 */
export async function grantItems(
  testConnection: SpacetimeDBTestConnection,
  params: GrantItemsParams
): Promise<{ callTimeMs: number }> {
  return executeReducer(
    testConnection,
    'cheat_item_stack_grant',
    BigInt(params.playerEntityId),
    params.itemId,
    params.quantity,
    params.isCargo ?? false
  );
}

/**
 * Grant experience points to a player via cheat_experience_grant.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param params - Experience grant parameters
 * @returns Reducer call timing
 */
export async function grantExperience(
  testConnection: SpacetimeDBTestConnection,
  params: GrantExperienceParams
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'cheat_experience_grant', {
    owner_entity_id: BigInt(params.ownerEntityId),
    skill_id: params.skillId,
    amount: params.amount,
  });
}

/**
 * Grant knowledge to a player via cheat_grant_knowledge.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param params - Knowledge grant parameters
 * @returns Reducer call timing
 */
export async function grantKnowledge(
  testConnection: SpacetimeDBTestConnection,
  params: GrantKnowledgeParams
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'cheat_grant_knowledge', {
    target_entity_id: BigInt(params.targetEntityId),
    also_learn: params.alsoLearn ?? false,
  });
}

/**
 * Teleport a player to specific coordinates via cheat_teleport_float.
 *
 * Note: The server hardcodes dimension = 1 regardless of client input.
 * WARNING: The server does `destination.unwrap()` — sending None (null destination)
 * will panic the server. Always provide a valid destination.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param params - Teleport parameters
 * @returns Reducer call timing
 */
export async function teleportPlayer(
  testConnection: SpacetimeDBTestConnection,
  params: TeleportPlayerParams
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'cheat_teleport_float', {
    player_entity_id: BigInt(params.playerEntityId),
    destination: {
      x: params.destination.x,
      z: params.destination.z,
      dimension: params.destination.dimension ?? 0,
    },
  });
}

/**
 * Spawn an enemy at specific coordinates via cheat_compendium_place_enemy.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param params - Enemy spawn parameters (use EnemyTypeId constants for enemyType)
 * @returns Reducer call timing
 */
export async function spawnEnemy(
  testConnection: SpacetimeDBTestConnection,
  params: SpawnEnemyParams
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'cheat_compendium_place_enemy', {
    coordinates: {
      x: params.coordinates.x,
      z: params.coordinates.z,
      dimension: params.coordinates.dimension ?? 0,
    },
    enemy_type: params.enemyType,
  });
}

/**
 * Place a building at specific coordinates via cheat_building_place.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param params - Building placement parameters
 * @returns Reducer call timing
 */
export async function placeBuilding(
  testConnection: SpacetimeDBTestConnection,
  params: PlaceBuildingParams
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'cheat_building_place', {
    coordinates: {
      x: params.coordinates.x,
      z: params.coordinates.z,
      dimension: params.coordinates.dimension ?? 0,
    },
    construction_recipe_id: params.constructionRecipeId,
    resource_placement_recipe_id: params.resourcePlacementRecipeId ?? 0,
    facing_direction: params.facingDirection ?? 0,
  });
}

/**
 * Discover the map for a player via cheat_discover_map.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param params - Map discovery parameters
 * @returns Reducer call timing
 */
export async function discoverMap(
  testConnection: SpacetimeDBTestConnection,
  params: DiscoverMapParams
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'cheat_discover_map', {
    target_entity_id: BigInt(params.targetEntityId),
  });
}

/**
 * Kill an entity via cheat_kill.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param params - Kill parameters
 * @returns Reducer call timing
 */
export async function killEntity(
  testConnection: SpacetimeDBTestConnection,
  params: KillEntityParams
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'cheat_kill', BigInt(params.entityId));
}

/**
 * Force regeneration of a resource type via admin_resource_force_regen.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param params - Resource regen parameters
 * @returns Reducer call timing
 */
export async function forceResourceRegen(
  testConnection: SpacetimeDBTestConnection,
  params: ForceResourceRegenParams
): Promise<{ callTimeMs: number }> {
  return executeReducer(
    testConnection,
    'admin_resource_force_regen',
    params.resourceId,
    params.iterations ?? 1,
    params.ignoreTargetCount ?? false
  );
}

/**
 * Despawn all overworld enemies via admin_despawn_overworld_enemies.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns Reducer call timing
 */
export async function despawnOverworldEnemies(
  testConnection: SpacetimeDBTestConnection
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'admin_despawn_overworld_enemies');
}

/**
 * Start all server-side scheduled agents via start_agents.
 *
 * Enables 19+ server-side scheduled loops (enemy regen, resource regen, etc.).
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns Reducer call timing
 */
export async function startServerAgents(
  testConnection: SpacetimeDBTestConnection
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'start_agents');
}

/**
 * Stop all server-side scheduled agents via stop_agents.
 *
 * Sets config.agents_enabled = false. Running agents continue their current
 * cycle but skip work on subsequent ticks. A brief settle delay may be needed
 * after calling this before asserting deterministic state.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns Reducer call timing
 */
export async function stopServerAgents(
  testConnection: SpacetimeDBTestConnection
): Promise<{ callTimeMs: number }> {
  return executeReducer(testConnection, 'stop_agents');
}
