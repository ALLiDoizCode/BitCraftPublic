/**
 * Resource Discovery, Extraction Execution, and Inventory Verification Helpers
 * Story 5.6: Resource Gathering & Inventory Validation (AC1, AC2, AC3, AC4, AC5)
 *
 * Extraction Reducer Sequence:
 * 1. extract_start -- validates preconditions, creates progressive_action_state entry,
 *    sets player_action_state to Extract
 * 2. WAIT -- client must wait for recipe's time_requirement duration
 * 3. extract -- validates action timing, performs extraction: decrements resource health,
 *    adds items to inventory, decrements stamina, awards XP
 *
 * PlayerExtractRequest BSATN Serialization:
 * {
 *   recipe_id: i32,           // 4 bytes, little-endian
 *   target_entity_id: u64,    // 8 bytes, little-endian
 *   timestamp: u64,           // 8 bytes, little-endian
 *   clear_from_claim: bool    // 1 byte (0x00=false, 0x01=true)
 * }
 * Total: 21 bytes per serialized request.
 *
 * Designed for reuse by Stories 5.7-5.8.
 *
 * BLOCKER-1 Workaround: Uses direct SpacetimeDB WebSocket connection.
 *
 * @integration
 */

import type { SpacetimeDBTestConnection } from './spacetimedb-connection';
import { executeReducer } from './test-client';
import { queryTableState, waitForTableUpdate } from './subscription-helpers';

/**
 * Generic row type for SpacetimeDB table data accessed without generated bindings.
 * Same pattern as player-lifecycle.ts to avoid eslint-disable comments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpacetimeDBRow = Record<string, any>;

/** Delay between extract_start and extract calls for progressive action timing (ms).
 * Starting with 1500ms as safe default; retry logic handles timing validation errors.
 * Exported for use by Story 5.6 tests that call extract_start/extract directly
 * (bypassing executeExtraction()) for fine-grained timing control. */
export const EXTRACTION_PROGRESSIVE_ACTION_DELAY_MS = 1500;

/** Maximum number of retries for extract call if timing validation fails.
 * Exported for test-level visibility into retry behavior. */
export const EXTRACTION_TIMING_RETRY_COUNT = 3;

/** Delay between extract retries when timing validation fails (ms).
 * Exported for test-level visibility into retry behavior. */
export const EXTRACTION_RETRY_DELAY_MS = 1000;

/** Timeout for subscription wait operations (generous for reliability) (ms).
 * Exported for use by Story 5.6 tests that register their own subscription listeners. */
export const SUBSCRIPTION_WAIT_TIMEOUT_MS = 5000;

/** Result from findGatherableResource() */
export interface GatherableResource {
  /** entity_id of the resource_state row */
  entityId: bigint | number;
  /** resource_id from resource_state (references resource_desc) */
  resourceId: number;
  /** Current health from resource_health_state */
  health: number;
  /** Position from resource_state or mobile_entity_state if available */
  position: { x: number; z: number } | null;
}

/** Result from findExtractionRecipe() */
export interface ExtractionRecipe {
  /** Recipe ID from extraction_recipe_desc */
  id: number;
  /** Stamina requirement (if known) */
  staminaRequirement?: number;
  /** Time requirement in ms (if known) */
  timeRequirement?: number;
  /** Range requirement (if known) */
  range?: number;
}

/** Parameters for executeExtraction() */
export interface ExecuteExtractionParams {
  /** Active SpacetimeDB test connection */
  testConnection: SpacetimeDBTestConnection;
  /** Player's entity_id */
  entityId: bigint | number;
  /** Recipe ID to use for extraction */
  recipeId: number;
  /** Target resource entity_id */
  targetEntityId: bigint | number;
  /** Optional timestamp override (defaults to Date.now()) */
  timestamp?: number;
}

/** Result from executeExtraction() */
export interface ExtractionResult {
  /** Whether extraction completed successfully */
  success: boolean;
  /** Inventory change details (if successful) */
  inventoryChange?: SpacetimeDBRow;
  /** Resource health change details (if successful) */
  resourceHealthChange?: SpacetimeDBRow;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Find a gatherable resource near the player's current position.
 *
 * Queries resource_state and resource_health_state to find a resource node
 * with health > 0. Returns the first available resource or null.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns GatherableResource or null if no resources found
 */
export function findGatherableResource(
  testConnection: SpacetimeDBTestConnection
): GatherableResource | null {
  // Query resource_health_state for resources with positive health
  const resourceHealthStates = queryTableState<SpacetimeDBRow>(
    testConnection,
    'resource_health_state'
  );

  const healthyResources = resourceHealthStates.filter((r) => Number(r.health ?? 0) > 0);

  if (healthyResources.length === 0) {
    console.warn(
      '[findGatherableResource] No resources with positive health found in resource_health_state'
    );
    return null;
  }

  // Query resource_state to get resource details
  const resourceStates = queryTableState<SpacetimeDBRow>(testConnection, 'resource_state');

  // Find a resource that has both resource_state and resource_health_state entries
  for (const healthState of healthyResources) {
    const entityId = healthState.entity_id;
    const resourceState = resourceStates.find(
      (r) => r.entity_id === entityId || String(r.entity_id) === String(entityId)
    );

    if (resourceState) {
      return {
        entityId,
        resourceId: Number(resourceState.resource_id ?? 0),
        health: Number(healthState.health),
        position:
          resourceState.location_x != null
            ? { x: Number(resourceState.location_x), z: Number(resourceState.location_z ?? 0) }
            : null,
      };
    }
  }

  // If no resource_state match found, return the first healthy resource anyway.
  // resourceId: 0 means findExtractionRecipe will fall back to recipe ID 1 discovery.
  const firstHealthy = healthyResources[0];
  console.warn(
    `[findGatherableResource] No matching resource_state row found for ` +
      `${healthyResources.length} healthy resource(s). Using fallback with entity_id=${String(firstHealthy.entity_id)}, resourceId=0. ` +
      `findExtractionRecipe will fall back to recipe ID discovery.`
  );
  return {
    entityId: firstHealthy.entity_id,
    resourceId: 0,
    health: Number(firstHealthy.health),
    position: null,
  };
}

/**
 * Find a valid extraction recipe for a given resource.
 *
 * Attempts to find a recipe from extraction_recipe_desc static data table.
 * If static data is not accessible, falls back to trying common recipe IDs.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param resourceId - The resource_id to find a recipe for
 * @returns ExtractionRecipe or null if no valid recipe found
 */
export function findExtractionRecipe(
  testConnection: SpacetimeDBTestConnection,
  resourceId: number
): ExtractionRecipe | null {
  try {
    // Try to query extraction_recipe_desc
    const recipeDescs = queryTableState<SpacetimeDBRow>(testConnection, 'extraction_recipe_desc');
    if (recipeDescs.length > 0) {
      // Find a recipe matching the resource type, or use the first available
      const matchingRecipe = recipeDescs.find(
        (r) => Number(r.resource_id ?? r.resource_desc_id ?? 0) === resourceId
      );

      const recipe = matchingRecipe ?? recipeDescs[0];
      return {
        id: Number(recipe.id),
        staminaRequirement:
          recipe.stamina_requirement != null ? Number(recipe.stamina_requirement) : undefined,
        timeRequirement:
          recipe.time_requirement != null ? Number(recipe.time_requirement) : undefined,
        range: recipe.range != null ? Number(recipe.range) : undefined,
      };
    }
  } catch {
    console.warn(
      '[findExtractionRecipe] extraction_recipe_desc not accessible (DEBT-2). Using fallback recipe IDs.'
    );
  }

  // Fallback: return common recipe ID 1 for runtime discovery
  return {
    id: 1,
    staminaRequirement: undefined,
    timeRequirement: undefined,
    range: undefined,
  };
}

/**
 * Move the player near a target resource using Story 5.5 movement fixtures.
 *
 * Uses player_move to position the player within extraction range of the target resource.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param entityId - Player's entity_id
 * @param resource - Target resource to move near
 * @param currentPosition - Player's current position
 */
export async function moveNearResource(
  testConnection: SpacetimeDBTestConnection,
  entityId: bigint | number,
  resource: GatherableResource,
  currentPosition: { locationX: number; locationZ: number }
): Promise<void> {
  if (!resource.position) {
    // If resource position unknown, skip movement (hope we're close enough)
    console.warn('[moveNearResource] Resource position unknown; skipping movement.');
    return;
  }

  // Calculate distance
  const dx = resource.position.x - currentPosition.locationX;
  const dz = resource.position.z - currentPosition.locationZ;
  const distance = Math.sqrt(dx * dx + dz * dz);

  // If already within reasonable range (recipe range + buffer), skip movement.
  // Using a conservative default since the actual recipe range is not passed to this function.
  // Per Game Reference, extraction recipes have a `range` field; the default extraction
  // range is typically 2-5 units. 10.0 provides a generous buffer to avoid unnecessary moves.
  // Story 5.7 may refine this if recipe-specific range checking is needed.
  const requiredRange = 10.0;
  if (distance <= requiredRange) {
    return;
  }

  // Move toward the resource
  const destX = resource.position.x;
  const destZ = resource.position.z;

  // Network-first: register listener before reducer
  const updatePromise = waitForTableUpdate<SpacetimeDBRow>(
    testConnection,
    'mobile_entity_state',
    (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
    SUBSCRIPTION_WAIT_TIMEOUT_MS
  ).catch(() => null);

  await executeReducer(testConnection, 'player_move', {
    timestamp: Date.now(),
    destination: { x: destX, z: destZ },
    origin: { x: currentPosition.locationX, z: currentPosition.locationZ },
    duration: 1.0,
    move_type: 0,
    running: false,
  });

  await updatePromise;
}

/**
 * Execute the full extraction sequence: extract_start -> wait -> extract.
 *
 * Handles the progressive action pattern with configurable delay and retry logic
 * for timing validation failures.
 *
 * @param params - Extraction parameters
 * @returns ExtractionResult with success status and state change details
 */
export async function executeExtraction(
  params: ExecuteExtractionParams
): Promise<ExtractionResult> {
  const { testConnection, entityId, recipeId, targetEntityId, timestamp } = params;
  const ts = timestamp ?? Date.now();

  try {
    // Step 1: extract_start
    await executeReducer(testConnection, 'extract_start', {
      recipe_id: recipeId,
      target_entity_id: targetEntityId,
      timestamp: ts,
      clear_from_claim: false,
    });

    // Step 2: Wait for progressive action timer
    await new Promise((resolve) => setTimeout(resolve, EXTRACTION_PROGRESSIVE_ACTION_DELAY_MS));

    // Step 3: extract with retry logic for timing validation
    let lastError: string | undefined;
    for (let attempt = 0; attempt <= EXTRACTION_TIMING_RETRY_COUNT; attempt++) {
      try {
        // Network-first: register inventory listener before calling extract
        // Filter by owner_entity_id to match the extracting player (inventory_state
        // links via owner_entity_id, not entity_id -- see Story 5.6 Dev Notes).
        const inventoryPromise = waitForTableUpdate<SpacetimeDBRow>(
          testConnection,
          'inventory_state',
          (row) =>
            row.owner_entity_id === entityId || String(row.owner_entity_id) === String(entityId),
          SUBSCRIPTION_WAIT_TIMEOUT_MS
        ).catch(() => null);

        const resourceHealthPromise = waitForTableUpdate<SpacetimeDBRow>(
          testConnection,
          'resource_health_state',
          (row) =>
            row.entity_id === targetEntityId || String(row.entity_id) === String(targetEntityId),
          SUBSCRIPTION_WAIT_TIMEOUT_MS
        ).catch(() => null);

        await executeReducer(testConnection, 'extract', {
          recipe_id: recipeId,
          target_entity_id: targetEntityId,
          timestamp: Date.now(),
          clear_from_claim: false,
        });

        // Wait for state changes
        const [inventoryChange, resourceHealthChange] = await Promise.all([
          inventoryPromise,
          resourceHealthPromise,
        ]);

        return {
          success: true,
          inventoryChange: inventoryChange?.newRow ?? undefined,
          resourceHealthChange: resourceHealthChange?.newRow ?? undefined,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // If timing validation error, retry after additional delay
        if (
          lastError.toLowerCase().includes('timing') ||
          lastError.toLowerCase().includes('action')
        ) {
          await new Promise((resolve) => setTimeout(resolve, EXTRACTION_RETRY_DELAY_MS));
          continue;
        }
        // Non-timing error, don't retry
        break;
      }
    }

    return {
      success: false,
      error: lastError ?? 'Extraction failed after retries',
    };
  } catch (err) {
    // Outer catch: extract_start failed before retry loop was reached
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `extract_start failed: ${msg}`,
    };
  }
}

/**
 * Verify that the player's inventory contains items (after extraction).
 *
 * Queries inventory_state by owner_entity_id and checks if any pockets
 * contain items. Note: inventory_state uses owner_entity_id, NOT entity_id.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param playerEntityId - Player's entity_id (maps to inventory_state.owner_entity_id)
 * @returns true if inventory contains items
 */
export function verifyInventoryContains(
  testConnection: SpacetimeDBTestConnection,
  playerEntityId: bigint | number
): boolean {
  const inventoryStates = queryTableState<SpacetimeDBRow>(testConnection, 'inventory_state');
  const playerInventories = inventoryStates.filter(
    (r) =>
      r.owner_entity_id === playerEntityId || String(r.owner_entity_id) === String(playerEntityId)
  );

  if (playerInventories.length === 0) {
    console.warn(
      `[verifyInventoryContains] No inventory_state rows found for owner_entity_id=${String(playerEntityId)}`
    );
    return false;
  }

  // Check if any inventory has non-empty pockets
  return playerInventories.some((inv) => {
    if (inv.pockets == null) return false;
    if (Array.isArray(inv.pockets)) return inv.pockets.length > 0;
    return true; // Non-null pockets exist
  });
}

/**
 * Verify that a resource's health was decremented after extraction.
 *
 * Queries resource_health_state for the target resource entity_id and
 * asserts the health value is less than the value before extraction.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param resourceEntityId - entity_id of the resource
 * @param healthBefore - Health value before extraction
 * @returns true if health was decremented
 */
export function verifyResourceHealthDecremented(
  testConnection: SpacetimeDBTestConnection,
  resourceEntityId: bigint | number,
  healthBefore: number
): boolean {
  const resourceHealthStates = queryTableState<SpacetimeDBRow>(
    testConnection,
    'resource_health_state'
  );

  const resourceHealth = resourceHealthStates.find(
    (r) => r.entity_id === resourceEntityId || String(r.entity_id) === String(resourceEntityId)
  );

  if (!resourceHealth) {
    console.warn(
      `[verifyResourceHealthDecremented] No resource_health_state found for entity_id=${String(resourceEntityId)}`
    );
    return false;
  }

  const healthAfter = Number(resourceHealth.health ?? 0);
  return healthAfter < healthBefore;
}
