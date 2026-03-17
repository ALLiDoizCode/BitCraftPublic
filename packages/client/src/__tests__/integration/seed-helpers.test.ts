/**
 * Seed Helpers Integration Tests
 * Validates cheat/admin reducer wrappers against the live Docker stack.
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
  queryTableState,
  waitForTableInsert,
  waitForTableUpdate,
  waitForTableDelete,
  setupSignedInPlayer,
  teardownPlayer,
  type SignedInPlayer,
  subscribeToTables,
  grantItems,
  grantExperience,
  teleportPlayer,
  spawnEnemy,
  killEntity,
  despawnOverworldEnemies,
  stopServerAgents,
  startServerAgents,
  EnemyTypeId,
  SUBSCRIPTION_WAIT_TIMEOUT_MS,
} from './fixtures';

/**
 * Generic row type for SpacetimeDB table data accessed without generated bindings.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpacetimeDBRow = Record<string, any>;

/** Delay after subscribing to additional tables to allow initial state to populate (ms). */
const POST_SUBSCRIPTION_SETTLE_MS = 1000;

/** Delay after stopping agents to allow running cycles to complete (ms). */
const AGENT_SETTLE_DELAY_MS = 2000;

/**
 * Seed helper-specific subscription tables.
 * Covers tables needed to verify seed helper effects beyond the basic Story 5.4 tables.
 */
const SEED_HELPER_TABLES = [
  'SELECT * FROM user_state',
  'SELECT * FROM player_state',
  'SELECT * FROM signed_in_player_state',
  'SELECT * FROM mobile_entity_state',
  'SELECT * FROM inventory_state',
  'SELECT * FROM experience_state',
  'SELECT * FROM overworld_enemy_state',
  'SELECT * FROM config',
];

// ---------------------------------------------------------------------------
// Conditional execution: skip all tests when Docker is not available (AGREEMENT-5)
// ---------------------------------------------------------------------------
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!runIntegrationTests)('Seed Helpers: Cheat/Admin Reducer Validation', () => {
  let dockerHealthy = false;

  beforeAll(async () => {
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
  // AC3: grantItems — grant items and verify via inventory_state
  // =========================================================================
  describe('AC3: grantItems — item stack grant verification', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it.skipIf(!runIntegrationTests)(
      '[P0] should grant items to a player and verify inventory_state contains the item',
      async () => {
        if (!dockerHealthy) return;

        player = await setupSignedInPlayer();
        const { testConnection, entityId } = player;

        await subscribeToTables(testConnection, SEED_HELPER_TABLES);
        await new Promise((resolve) => setTimeout(resolve, POST_SUBSCRIPTION_SETTLE_MS));

        // Record inventory count BEFORE grant for strict before/after comparison
        const inventoryBefore = queryTableState<SpacetimeDBRow>(testConnection, 'inventory_state');
        const countBefore = inventoryBefore.filter(
          (r) => r.owner_entity_id === entityId || String(r.owner_entity_id) === String(entityId)
        ).length;

        // Register listener before calling reducer (network-first pattern)
        const inventoryPromise = waitForTableUpdate<SpacetimeDBRow>(
          testConnection,
          'inventory_state',
          (row) =>
            row.owner_entity_id === entityId || String(row.owner_entity_id) === String(entityId),
          SUBSCRIPTION_WAIT_TIMEOUT_MS
        );

        // Grant items: item_id=1 (common item), quantity=5
        const result = await grantItems(testConnection, {
          playerEntityId: entityId,
          itemId: 1,
          quantity: 5,
        });

        expect(result.callTimeMs).toBeGreaterThan(0);

        // Wait for inventory update — do NOT swallow timeout
        const inventoryChange = await inventoryPromise;
        expect(inventoryChange.newRow).toBeDefined();

        // Verify inventory count increased or stayed same (update may modify existing row)
        const inventoryAfter = queryTableState<SpacetimeDBRow>(testConnection, 'inventory_state');
        const countAfter = inventoryAfter.filter(
          (r) => r.owner_entity_id === entityId || String(r.owner_entity_id) === String(entityId)
        ).length;
        expect(countAfter).toBeGreaterThanOrEqual(countBefore);
      }
    );
  });

  // =========================================================================
  // AC4: grantExperience — grant XP and verify via experience_state
  // =========================================================================
  describe('AC4: grantExperience — XP grant verification', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it.skipIf(!runIntegrationTests)(
      '[P0] should grant experience to a player and verify experience_state reflects XP',
      async () => {
        if (!dockerHealthy) return;

        player = await setupSignedInPlayer();
        const { testConnection, entityId } = player;

        await subscribeToTables(testConnection, SEED_HELPER_TABLES);
        await new Promise((resolve) => setTimeout(resolve, POST_SUBSCRIPTION_SETTLE_MS));

        // Record XP count before grant
        const xpBefore = queryTableState<SpacetimeDBRow>(testConnection, 'experience_state');
        const xpCountBefore = xpBefore.filter(
          (r) => r.owner_entity_id === entityId || String(r.owner_entity_id) === String(entityId)
        ).length;

        // Register listener before calling reducer
        const xpPromise = waitForTableInsert<SpacetimeDBRow>(
          testConnection,
          'experience_state',
          (row) =>
            row.owner_entity_id === entityId || String(row.owner_entity_id) === String(entityId),
          SUBSCRIPTION_WAIT_TIMEOUT_MS
        );

        // Grant 100 XP to skill_id=1
        const result = await grantExperience(testConnection, {
          ownerEntityId: entityId,
          skillId: 1,
          amount: 100,
        });

        expect(result.callTimeMs).toBeGreaterThan(0);

        // Wait for experience state — do NOT swallow timeout
        const xpChange = await xpPromise;
        expect(xpChange.row).toBeDefined();

        // Verify XP count increased
        const xpAfter = queryTableState<SpacetimeDBRow>(testConnection, 'experience_state');
        const xpCountAfter = xpAfter.filter(
          (r) => r.owner_entity_id === entityId || String(r.owner_entity_id) === String(entityId)
        ).length;
        expect(xpCountAfter).toBeGreaterThan(xpCountBefore);
      }
    );
  });

  // =========================================================================
  // AC5: teleportPlayer — teleport and verify via mobile_entity_state
  // =========================================================================
  describe('AC5: teleportPlayer — teleport verification', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it.skipIf(!runIntegrationTests)(
      '[P0] should teleport a player and verify mobile_entity_state position updates',
      async () => {
        if (!dockerHealthy) return;

        player = await setupSignedInPlayer();
        const { testConnection, entityId } = player;

        await subscribeToTables(testConnection, SEED_HELPER_TABLES);
        await new Promise((resolve) => setTimeout(resolve, POST_SUBSCRIPTION_SETTLE_MS));

        // Target coordinates for teleport (integers — writeI32 truncates floats)
        const destX = 50;
        const destZ = 50;

        // Register listener before calling reducer
        const movePromise = waitForTableUpdate<SpacetimeDBRow>(
          testConnection,
          'mobile_entity_state',
          (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
          SUBSCRIPTION_WAIT_TIMEOUT_MS
        );

        const result = await teleportPlayer(testConnection, {
          playerEntityId: entityId,
          destination: { x: destX, z: destZ },
        });

        expect(result.callTimeMs).toBeGreaterThan(0);

        // Wait for position update — do NOT swallow timeout
        const positionChange = await movePromise;
        expect(positionChange.newRow).toBeDefined();

        // Verify updated position
        const mobileStates = queryTableState<SpacetimeDBRow>(testConnection, 'mobile_entity_state');
        const playerState = mobileStates.find(
          (r) => r.entity_id === entityId || String(r.entity_id) === String(entityId)
        );
        expect(playerState).toBeDefined();
        const locationX = Number(playerState!.location_x ?? playerState!.locationX ?? 0);
        const locationZ = Number(playerState!.location_z ?? playerState!.locationZ ?? 0);
        // Verify we're near the destination (server may adjust slightly)
        expect(Math.abs(locationX - destX)).toBeLessThan(10);
        expect(Math.abs(locationZ - destZ)).toBeLessThan(10);
      }
    );
  });

  // =========================================================================
  // AC6: spawnEnemy — spawn enemy and verify entity exists
  // =========================================================================
  describe('AC6: spawnEnemy — enemy spawn verification', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it.skipIf(!runIntegrationTests)(
      '[P0] should spawn a practice dummy enemy and verify it exists in the world',
      async () => {
        if (!dockerHealthy) return;

        player = await setupSignedInPlayer();
        const { testConnection } = player;

        await subscribeToTables(testConnection, SEED_HELPER_TABLES);
        await new Promise((resolve) => setTimeout(resolve, POST_SUBSCRIPTION_SETTLE_MS));

        // Count enemies BEFORE spawning for strict before/after comparison
        const enemiesBefore = queryTableState<SpacetimeDBRow>(
          testConnection,
          'overworld_enemy_state'
        );
        const countBefore = enemiesBefore.length;

        // Register listener before calling reducer
        const enemyPromise = waitForTableInsert<SpacetimeDBRow>(
          testConnection,
          'overworld_enemy_state',
          () => true, // Accept any new enemy
          SUBSCRIPTION_WAIT_TIMEOUT_MS
        );

        // Spawn a PracticeDummy at coordinates (10, 10)
        const result = await spawnEnemy(testConnection, {
          coordinates: { x: 10, z: 10 },
          enemyType: EnemyTypeId.PracticeDummy,
        });

        expect(result.callTimeMs).toBeGreaterThan(0);

        // Wait for enemy to appear — do NOT swallow timeout
        const newEnemy = await enemyPromise;
        expect(newEnemy.row).toBeDefined();

        // Verify enemy count strictly increased
        const enemiesAfter = queryTableState<SpacetimeDBRow>(
          testConnection,
          'overworld_enemy_state'
        );
        expect(enemiesAfter.length).toBeGreaterThan(countBefore);
      }
    );
  });

  // =========================================================================
  // AC7: stopServerAgents / startServerAgents — toggle verification
  // =========================================================================
  describe('AC7: stopServerAgents/startServerAgents — agent toggle verification', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      // Always restart agents to leave clean state
      if (player) {
        try {
          await startServerAgents(player.testConnection);
        } catch {
          // Best effort cleanup
        }
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it.skipIf(!runIntegrationTests)(
      '[P0] should stop and start server agents, verifying config state changes',
      async () => {
        if (!dockerHealthy) return;

        player = await setupSignedInPlayer();
        const { testConnection } = player;

        await subscribeToTables(testConnection, SEED_HELPER_TABLES);
        await new Promise((resolve) => setTimeout(resolve, POST_SUBSCRIPTION_SETTLE_MS));

        // Stop agents
        const stopResult = await stopServerAgents(testConnection);
        expect(stopResult.callTimeMs).toBeGreaterThan(0);

        // Brief settle delay for running agent cycles to complete
        await new Promise((resolve) => setTimeout(resolve, AGENT_SETTLE_DELAY_MS));

        // Verify agents are stopped via config table — assert unconditionally
        const configAfterStop = queryTableState<SpacetimeDBRow>(testConnection, 'config');
        expect(configAfterStop.length).toBeGreaterThan(0);
        const agentConfigStop = configAfterStop.find((r) => r.agents_enabled !== undefined);
        expect(agentConfigStop).toBeDefined();
        expect(agentConfigStop!.agents_enabled).toBe(false);

        // Start agents again
        const startResult = await startServerAgents(testConnection);
        expect(startResult.callTimeMs).toBeGreaterThan(0);

        // Brief settle
        await new Promise((resolve) => setTimeout(resolve, AGENT_SETTLE_DELAY_MS));

        // Verify agents are started — assert unconditionally
        const configAfterStart = queryTableState<SpacetimeDBRow>(testConnection, 'config');
        expect(configAfterStart.length).toBeGreaterThan(0);
        const agentConfigStart = configAfterStart.find((r) => r.agents_enabled !== undefined);
        expect(agentConfigStart).toBeDefined();
        expect(agentConfigStart!.agents_enabled).toBe(true);
      }
    );
  });

  // =========================================================================
  // AC9: killEntity — kill a spawned enemy and verify removal
  // =========================================================================
  describe('AC9: killEntity — entity kill verification', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it.skipIf(!runIntegrationTests)(
      '[P0] should spawn an enemy, kill it, and verify removal from world state',
      async () => {
        if (!dockerHealthy) return;

        player = await setupSignedInPlayer();
        const { testConnection } = player;

        await subscribeToTables(testConnection, SEED_HELPER_TABLES);
        await new Promise((resolve) => setTimeout(resolve, POST_SUBSCRIPTION_SETTLE_MS));

        // Spawn an enemy first
        const spawnPromise = waitForTableInsert<SpacetimeDBRow>(
          testConnection,
          'overworld_enemy_state',
          () => true,
          SUBSCRIPTION_WAIT_TIMEOUT_MS
        );

        await spawnEnemy(testConnection, {
          coordinates: { x: 20, z: 20 },
          enemyType: EnemyTypeId.PracticeDummy,
        });

        const spawnedEnemy = await spawnPromise;
        expect(spawnedEnemy.row).toBeDefined();

        const enemyEntityId = spawnedEnemy.row.entity_id;
        expect(enemyEntityId).toBeDefined();

        // Kill the enemy — register delete listener before calling reducer
        const deletePromise = waitForTableDelete<SpacetimeDBRow>(
          testConnection,
          'overworld_enemy_state',
          (row) =>
            row.entity_id === enemyEntityId || String(row.entity_id) === String(enemyEntityId),
          SUBSCRIPTION_WAIT_TIMEOUT_MS
        );

        const killResult = await killEntity(testConnection, {
          entityId: enemyEntityId,
        });

        expect(killResult.callTimeMs).toBeGreaterThan(0);

        // Wait for deletion — do NOT swallow timeout
        await deletePromise;

        // Verify enemy is gone
        const enemiesAfterKill = queryTableState<SpacetimeDBRow>(
          testConnection,
          'overworld_enemy_state'
        );
        const killedEnemy = enemiesAfterKill.find(
          (r) => r.entity_id === enemyEntityId || String(r.entity_id) === String(enemyEntityId)
        );
        expect(killedEnemy).toBeUndefined();
      }
    );
  });

  // =========================================================================
  // AC10: despawnOverworldEnemies — despawn all and verify
  // =========================================================================
  describe('AC10: despawnOverworldEnemies — mass despawn verification', () => {
    let player: SignedInPlayer | null = null;

    afterEach(async () => {
      if (player) {
        await teardownPlayer(player.testConnection);
        player = null;
      }
    });

    it.skipIf(!runIntegrationTests)('[P0] should despawn all overworld enemies', async () => {
      if (!dockerHealthy) return;

      player = await setupSignedInPlayer();
      const { testConnection } = player;

      await subscribeToTables(testConnection, SEED_HELPER_TABLES);
      await new Promise((resolve) => setTimeout(resolve, POST_SUBSCRIPTION_SETTLE_MS));

      // Spawn an enemy so we know there's at least one
      const spawnPromise = waitForTableInsert<SpacetimeDBRow>(
        testConnection,
        'overworld_enemy_state',
        () => true,
        SUBSCRIPTION_WAIT_TIMEOUT_MS
      );

      await spawnEnemy(testConnection, {
        coordinates: { x: 30, z: 30 },
        enemyType: EnemyTypeId.PracticeDummy,
      });

      const spawned = await spawnPromise;
      const spawnedEntityId = spawned.row.entity_id;

      // Register delete listener for the known spawned enemy before despawn
      const deletePromise = waitForTableDelete<SpacetimeDBRow>(
        testConnection,
        'overworld_enemy_state',
        (row) =>
          row.entity_id === spawnedEntityId || String(row.entity_id) === String(spawnedEntityId),
        SUBSCRIPTION_WAIT_TIMEOUT_MS
      );

      // Despawn all enemies
      const result = await despawnOverworldEnemies(testConnection);
      expect(result.callTimeMs).toBeGreaterThan(0);

      // Wait for at least the known enemy to be deleted (event-driven, not timer)
      await deletePromise;

      // Verify no overworld enemies remain
      const enemiesAfter = queryTableState<SpacetimeDBRow>(testConnection, 'overworld_enemy_state');
      expect(enemiesAfter.length).toBe(0);
    });
  });

  // =========================================================================
  // Additional helpers — todo tests for helpers requiring missing subscriptions
  // =========================================================================
  describe('Deferred seed helper tests', () => {
    it.todo('grantKnowledge — requires knowledge_state subscription table (Epic 9)');

    it.todo('discoverMap — requires map_discovery_state subscription table (Epic 10)');

    it.todo(
      'forceResourceRegen — requires resource_state subscription and regen verification (Epic 11)'
    );

    it.todo(
      'placeBuilding — requires building_state subscription table and construction verification (Epic 12)'
    );
  });
});
