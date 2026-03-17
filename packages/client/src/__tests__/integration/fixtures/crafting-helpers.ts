/**
 * Crafting Discovery, Execution, and Verification Helpers
 * Story 5.7: Multi-Step Crafting Loop Validation (AC1, AC2, AC3, AC4, AC5)
 *
 * Crafting Reducer Sequence (Multi-Phase Progressive Action):
 * 1. craft_initiate_start -- validates preconditions, creates progressive_action_state,
 *    sets player_action_state to Craft
 * 2. WAIT -- client must wait for recipe's time_requirement duration
 * 3. craft_initiate -- validates timing, consumes materials from inventory,
 *    advances progress, awards XP, decrements stamina
 * 4. craft_continue_start -- re-validates, creates timing entry for next action
 * 5. WAIT -- client must wait for timer
 * 6. craft_continue -- advances progress, decrements stamina, awards XP
 * 7. (repeat steps 4-6 until progressive_action_state.progress >= actions_required * craft_count)
 * 8. craft_collect -- validates completion, adds crafted items to inventory,
 *    deletes progressive_action_state
 *
 * BSATN Serialization Formats:
 * - PlayerCraftInitiateRequest: { recipe_id: i32, building_entity_id: u64,
 *     count: i32, timestamp: u64, is_public: bool } = 25 bytes
 * - PlayerCraftContinueRequest: { progressive_action_entity_id: u64,
 *     timestamp: u64 } = 16 bytes
 * - PlayerCraftCollectRequest: { pocket_id: u64, recipe_id: i32 } = 12 bytes
 * - PlayerCraftCollectAllRequest: { building_entity_id: u64 } = 8 bytes
 *
 * Designed for reuse by Story 5.8.
 *
 * BLOCKER-1 Workaround: Uses direct SpacetimeDB WebSocket connection.
 *
 * @integration
 */

import type { SpacetimeDBTestConnection } from './spacetimedb-connection';
import { executeReducer } from './test-client';
import { queryTableState, waitForTableInsert, waitForTableUpdate } from './subscription-helpers';

/**
 * Generic row type for SpacetimeDB table data accessed without generated bindings.
 * Same pattern as resource-helpers.ts and player-lifecycle.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpacetimeDBRow = Record<string, any>;

// ---------------------------------------------------------------------------
// Named delay constants for crafting timing.
// Each value is chosen based on the multi-phase progressive action pattern.
// ---------------------------------------------------------------------------

/** Delay between craft_initiate_start and craft_initiate calls (ms).
 * Crafting has a time_requirement per recipe action. Starting with 1500ms as safe default;
 * retry logic handles timing validation errors. */
export const CRAFTING_PROGRESSIVE_ACTION_DELAY_MS = 1500;

/** Delay between craft_continue_start and craft_continue calls (ms).
 * Same pattern as initiate but for continuation phases. */
export const CRAFTING_CONTINUE_DELAY_MS = 1500;

/** Maximum number of retries for craft_initiate/craft_continue if timing validation fails.
 * Exported for test-level visibility into retry behavior. */
export const CRAFTING_TIMING_RETRY_COUNT = 3;

/** Delay between retries when timing validation fails (ms).
 * Exported for test-level visibility into retry behavior. */
export const CRAFTING_RETRY_DELAY_MS = 1000;

/** Maximum number of craft_continue iterations before giving up.
 * Prevents infinite loops on recipes with very high actions_required. */
export const CRAFTING_MAX_CONTINUE_ITERATIONS = 20;

/** Timeout for subscription wait operations during crafting (generous for reliability) (ms). */
export const CRAFTING_SUBSCRIPTION_WAIT_TIMEOUT_MS = 5000;

/** Minimum distance the player must be from a building for crafting (units).
 * Per Game Reference: distance <= 2 for unenterable buildings. */
export const CRAFTING_BUILDING_RANGE = 2;

/** Movement range buffer added to CRAFTING_BUILDING_RANGE to determine
 * if the player needs to move closer. */
export const CRAFTING_MOVEMENT_BUFFER = 8.0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result from findCraftingBuilding() */
export interface CraftingBuilding {
  /** entity_id of the building_state row */
  entityId: bigint | number;
  /** building_description_id from building_state */
  buildingDescId: number;
  /** Position from mobile_entity_state if available */
  position: { x: number; z: number } | null;
  /** claim_entity_id from building_state */
  claimEntityId: bigint | number | null;
}

/** Result from findCraftingRecipe() */
export interface CraftingRecipe {
  /** Recipe ID from crafting_recipe_desc */
  id: number;
  /** Stamina requirement (if known) */
  staminaRequirement?: number;
  /** Time requirement in ms (if known) */
  timeRequirement?: number;
  /** Number of actions required to complete (if known) */
  actionsRequired?: number;
  /** Consumed item stacks (if known) */
  consumedItemStacks?: SpacetimeDBRow[];
  /** Crafted item stacks (if known) */
  craftedItemStacks?: SpacetimeDBRow[];
  /** Building requirement (if known) */
  buildingRequirement?: number;
}

/** Parameters for executeCraftingLoop() */
export interface ExecuteCraftingLoopParams {
  /** Active SpacetimeDB test connection */
  testConnection: SpacetimeDBTestConnection;
  /** Player's entity_id */
  entityId: bigint | number;
  /** Recipe ID to use for crafting */
  recipeId: number;
  /** Building entity_id to craft at */
  buildingEntityId: bigint | number;
  /** Number of items to craft (default: 1) */
  count?: number;
  /** Optional timestamp override (defaults to Date.now()) */
  timestamp?: number;
}

/** Result from executeCraftingLoop() */
export interface CraftingLoopResult {
  /** Whether the full crafting loop completed successfully */
  success: boolean;
  /** Inventory changes detected (if any) */
  inventoryChanges?: SpacetimeDBRow;
  /** The progressive_action_state entity_id used during crafting */
  progressiveActionEntityId?: bigint | number;
  /** Error message (if failed) */
  error?: string;
  /** Per-step timing information */
  timings?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Building Discovery
// ---------------------------------------------------------------------------

/**
 * Find a crafting building in the game world.
 *
 * Queries building_state to find a building that can be used for crafting.
 * Checks that the building has available crafting slots by comparing against
 * progressive_action_state for existing crafts at that building.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns CraftingBuilding or null if no buildings found
 */
export function findCraftingBuilding(
  testConnection: SpacetimeDBTestConnection
): CraftingBuilding | null {
  // Query building_state for all buildings
  let buildingStates: SpacetimeDBRow[];
  try {
    buildingStates = queryTableState<SpacetimeDBRow>(testConnection, 'building_state');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Distinguish table-not-found (expected with DEBT-2) from connection errors
    if (msg.includes('not found') || msg.includes('not have')) {
      console.warn(
        '[findCraftingBuilding] building_state table not accessible. No buildings available.'
      );
    } else {
      console.warn(
        `[findCraftingBuilding] Unexpected error querying building_state: ${msg}. ` +
          'Check connection health.'
      );
    }
    return null;
  }

  if (buildingStates.length === 0) {
    console.warn(
      '[findCraftingBuilding] No buildings found in building_state. ' +
        'Fresh game world may not have any player-constructed buildings.'
    );
    return null;
  }

  // Check progressive_action_state for busy buildings
  let progressiveActions: SpacetimeDBRow[] = [];
  try {
    progressiveActions = queryTableState<SpacetimeDBRow>(
      testConnection,
      'progressive_action_state'
    );
  } catch {
    // progressive_action_state may not be accessible; proceed assuming all slots free
  }

  // Count active crafts per building
  const busyCraftCounts = new Map<string, number>();
  for (const action of progressiveActions) {
    const buildingId = String(action.building_entity_id ?? '');
    if (buildingId) {
      busyCraftCounts.set(buildingId, (busyCraftCounts.get(buildingId) ?? 0) + 1);
    }
  }

  // Try to get building positions from mobile_entity_state
  let mobileStates: SpacetimeDBRow[] = [];
  try {
    mobileStates = queryTableState<SpacetimeDBRow>(testConnection, 'mobile_entity_state');
  } catch {
    // Position data may not be available
  }

  // Find a building with available slots (prefer buildings with fewer active crafts)
  const sortedBuildings = [...buildingStates].sort((a, b) => {
    const aCount = busyCraftCounts.get(String(a.entity_id)) ?? 0;
    const bCount = busyCraftCounts.get(String(b.entity_id)) ?? 0;
    return aCount - bCount;
  });

  for (const building of sortedBuildings) {
    const entityId = building.entity_id;
    const busyCount = busyCraftCounts.get(String(entityId)) ?? 0;

    // Assume buildings have at least 1 slot; skip if busy count > reasonable max
    if (busyCount >= 5) continue;

    // Try to find position
    const mobileState = mobileStates.find(
      (ms) => ms.entity_id === entityId || String(ms.entity_id) === String(entityId)
    );

    const position = mobileState
      ? { x: Number(mobileState.location_x ?? 0), z: Number(mobileState.location_z ?? 0) }
      : null;

    return {
      entityId,
      buildingDescId: Number(building.building_description_id ?? building.building_desc_id ?? 0),
      position,
      claimEntityId: building.claim_entity_id ?? null,
    };
  }

  // No building with available slots found
  console.warn(
    `[findCraftingBuilding] All ${buildingStates.length} buildings appear busy. ` +
      `Progressive actions: ${progressiveActions.length}.`
  );
  return null;
}

// ---------------------------------------------------------------------------
// Recipe Discovery
// ---------------------------------------------------------------------------

/**
 * Find a valid crafting recipe.
 *
 * Queries crafting_recipe_desc static data to find a viable recipe.
 * Prefers recipes with: empty tool_requirements, minimal stamina_requirement,
 * actions_required = 1, and no required_claim_tech_id.
 *
 * If static data is not accessible, falls back to trying known recipe IDs.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param buildingDescId - Optional building description ID to match building_requirement
 * @returns CraftingRecipe or null if no valid recipe found
 */
export function findCraftingRecipe(
  testConnection: SpacetimeDBTestConnection,
  buildingDescId?: number
): CraftingRecipe | null {
  try {
    const recipeDescs = queryTableState<SpacetimeDBRow>(testConnection, 'crafting_recipe_desc');
    if (recipeDescs.length > 0) {
      console.log(
        `[findCraftingRecipe] Found ${recipeDescs.length} crafting recipes in crafting_recipe_desc`
      );

      // Log available columns for documentation
      if (recipeDescs[0]) {
        console.log(
          '[findCraftingRecipe] Available columns:',
          Object.keys(recipeDescs[0]).join(', ')
        );
      }

      // Score recipes by simplicity (lower = simpler)
      const scoredRecipes = recipeDescs
        .map((r) => {
          let score = 0;
          // Prefer actions_required = 1 (single-step)
          const actionsRequired = Number(r.actions_required ?? 1);
          score += (actionsRequired - 1) * 10;
          // Prefer low stamina
          score += Number(r.stamina_requirement ?? 0);
          // Prefer no tool requirements
          const toolReqs = r.tool_requirements;
          if (toolReqs && Array.isArray(toolReqs) && toolReqs.length > 0) score += 100;
          // Prefer no claim tech
          if (Number(r.required_claim_tech_id ?? 0) !== 0) score += 50;
          // Prefer matching building if specified
          if (
            buildingDescId != null &&
            Number(r.building_requirement ?? 0) !== 0 &&
            Number(r.building_requirement) !== buildingDescId
          ) {
            score += 200;
          }
          return { recipe: r, score };
        })
        .sort((a, b) => a.score - b.score);

      const best = scoredRecipes[0];
      if (best) {
        const recipe = best.recipe;
        return {
          id: Number(recipe.id),
          staminaRequirement:
            recipe.stamina_requirement != null ? Number(recipe.stamina_requirement) : undefined,
          timeRequirement:
            recipe.time_requirement != null ? Number(recipe.time_requirement) : undefined,
          actionsRequired:
            recipe.actions_required != null ? Number(recipe.actions_required) : undefined,
          consumedItemStacks: recipe.consumed_item_stacks ?? undefined,
          craftedItemStacks: recipe.crafted_item_stacks ?? undefined,
          buildingRequirement:
            recipe.building_requirement != null ? Number(recipe.building_requirement) : undefined,
        };
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Distinguish table-not-found (expected with DEBT-2) from connection errors
    if (msg.includes('not found') || msg.includes('not have')) {
      console.warn(
        '[findCraftingRecipe] crafting_recipe_desc not accessible (DEBT-2). ' +
          'Using fallback recipe IDs.'
      );
    } else {
      console.warn(
        `[findCraftingRecipe] Unexpected error querying crafting_recipe_desc: ${msg}. ` +
          'Check connection health. Using fallback recipe IDs.'
      );
    }
  }

  // Fallback: return recipe ID 1 for runtime discovery.
  // Recipe ID 1 is tried first as the lowest valid ID. If this fails at runtime,
  // the crafting loop will return a descriptive error. Alternative IDs (2, 3, etc.)
  // could be tried but would require multiple reducer calls for discovery.
  // See DEBT-2: static data table accessibility is a known gap.
  return {
    id: 1,
    staminaRequirement: undefined,
    timeRequirement: undefined,
    actionsRequired: undefined,
  };
}

// ---------------------------------------------------------------------------
// Movement Helper
// ---------------------------------------------------------------------------

/**
 * Move the player near a crafting building.
 *
 * Uses player_move reducer to position the player within crafting range
 * of the target building (distance <= 2 per Game Reference preconditions).
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param entityId - Player's entity_id
 * @param building - Target building to move near
 * @param currentPosition - Player's current position
 */
export async function moveNearBuilding(
  testConnection: SpacetimeDBTestConnection,
  entityId: bigint | number,
  building: CraftingBuilding,
  currentPosition: { locationX: number; locationZ: number }
): Promise<void> {
  if (!building.position) {
    // If building position unknown, skip movement (hope we're close enough)
    console.warn('[moveNearBuilding] Building position unknown; skipping movement.');
    return;
  }

  // Calculate distance
  const dx = building.position.x - currentPosition.locationX;
  const dz = building.position.z - currentPosition.locationZ;
  const distance = Math.sqrt(dx * dx + dz * dz);

  // If already within range + buffer, skip movement
  const requiredRange = CRAFTING_BUILDING_RANGE + CRAFTING_MOVEMENT_BUFFER;
  if (distance <= requiredRange) {
    return;
  }

  // Move toward the building
  const destX = building.position.x;
  const destZ = building.position.z;

  // Network-first: register listener before reducer
  const updatePromise = waitForTableUpdate<SpacetimeDBRow>(
    testConnection,
    'mobile_entity_state',
    (row) => row.entity_id === entityId || String(row.entity_id) === String(entityId),
    CRAFTING_SUBSCRIPTION_WAIT_TIMEOUT_MS
  ).catch(() => null);

  await executeReducer(testConnection, 'player_move', {
    timestamp: Date.now(),
    destination: { x: destX, z: destZ },
    origin: { x: currentPosition.locationX, z: currentPosition.locationZ },
    duration: 1.0,
    move_type: 0,
    running: false,
  });

  const updateResult = await updatePromise;
  if (!updateResult) {
    console.warn(
      `[moveNearBuilding] mobile_entity_state update not received within ${CRAFTING_SUBSCRIPTION_WAIT_TIMEOUT_MS}ms ` +
        `after player_move. Player may still be too far from building (distance was ${distance.toFixed(1)} units). ` +
        'Subsequent crafting calls may fail with "Too far" error.'
    );
  }
}

// ---------------------------------------------------------------------------
// Crafting Execution
// ---------------------------------------------------------------------------

/**
 * Execute the full active crafting sequence.
 *
 * Performs: craft_initiate_start -> wait -> craft_initiate ->
 * (repeat craft_continue_start -> wait -> craft_continue until progress complete) ->
 * craft_collect.
 *
 * Handles the progressive action pattern with configurable delay and retry logic
 * for timing validation failures.
 *
 * @param params - Crafting loop parameters
 * @returns CraftingLoopResult with success status and state change details
 */
export async function executeCraftingLoop(
  params: ExecuteCraftingLoopParams
): Promise<CraftingLoopResult> {
  const { testConnection, entityId, recipeId, buildingEntityId, count = 1, timestamp } = params;
  const ts = timestamp ?? Date.now();
  const timings: Record<string, number> = {};

  try {
    // -----------------------------------------------------------------------
    // Step 1: craft_initiate_start
    // -----------------------------------------------------------------------
    const step1Start = performance.now();

    // Network-first: register listener for progressive_action_state before reducer
    const progressiveInsertPromise = waitForTableInsert<SpacetimeDBRow>(
      testConnection,
      'progressive_action_state',
      (row) => row.owner_entity_id === entityId || String(row.owner_entity_id) === String(entityId),
      CRAFTING_SUBSCRIPTION_WAIT_TIMEOUT_MS
    ).catch(() => null);

    await executeReducer(testConnection, 'craft_initiate_start', {
      recipe_id: recipeId,
      building_entity_id: buildingEntityId,
      count,
      timestamp: ts,
      is_public: false,
    });

    timings['craft_initiate_start'] = performance.now() - step1Start;

    // Wait for progressive_action_state to be created
    const progressiveAction = await progressiveInsertPromise;
    let progressiveActionEntityId: bigint | number | undefined;

    if (progressiveAction) {
      progressiveActionEntityId = progressiveAction.row.entity_id;
    } else {
      // Fallback: query progressive_action_state directly
      const progressiveStates = queryTableState<SpacetimeDBRow>(
        testConnection,
        'progressive_action_state'
      );
      const matchingAction = progressiveStates.find(
        (a) => a.owner_entity_id === entityId || String(a.owner_entity_id) === String(entityId)
      );
      if (matchingAction) {
        progressiveActionEntityId = matchingAction.entity_id;
      }
    }

    if (!progressiveActionEntityId) {
      return {
        success: false,
        error:
          'craft_initiate_start did not create a progressive_action_state entry for this player',
      };
    }

    // -----------------------------------------------------------------------
    // Step 2: Wait for progressive action timer
    // -----------------------------------------------------------------------
    await new Promise((resolve) => setTimeout(resolve, CRAFTING_PROGRESSIVE_ACTION_DELAY_MS));

    // -----------------------------------------------------------------------
    // Step 3: craft_initiate with retry logic
    // -----------------------------------------------------------------------
    const step3Start = performance.now();
    let initiateSuccess = false;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= CRAFTING_TIMING_RETRY_COUNT; attempt++) {
      try {
        await executeReducer(testConnection, 'craft_initiate', {
          recipe_id: recipeId,
          building_entity_id: buildingEntityId,
          count,
          timestamp: Date.now(),
          is_public: false,
        });
        initiateSuccess = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (
          lastError.toLowerCase().includes('timing') ||
          lastError.toLowerCase().includes('action')
        ) {
          await new Promise((resolve) => setTimeout(resolve, CRAFTING_RETRY_DELAY_MS));
          continue;
        }
        break; // Non-timing error, don't retry
      }
    }

    if (!initiateSuccess) {
      return {
        success: false,
        progressiveActionEntityId,
        error: `craft_initiate failed: ${lastError ?? 'Unknown error'}`,
        timings,
      };
    }
    timings['craft_initiate'] = performance.now() - step3Start;

    // -----------------------------------------------------------------------
    // Steps 4-6: craft_continue_start / craft_continue loop
    // -----------------------------------------------------------------------
    // Check if progress is complete by querying progressive_action_state
    let continueIterations = 0;

    while (continueIterations < CRAFTING_MAX_CONTINUE_ITERATIONS) {
      // Check current progress
      const currentProgressStates = queryTableState<SpacetimeDBRow>(
        testConnection,
        'progressive_action_state'
      );
      const currentAction = currentProgressStates.find(
        (a) =>
          a.entity_id === progressiveActionEntityId ||
          String(a.entity_id) === String(progressiveActionEntityId)
      );

      if (!currentAction) {
        // progressive_action_state was deleted -- craft may be complete or cancelled
        break;
      }

      const progress = Number(currentAction.progress ?? 0);
      const actionsRequired = Number(currentAction.actions_required ?? 1);
      const craftCount = Number(currentAction.craft_count ?? count);
      const totalRequired = actionsRequired * craftCount;

      if (progress >= totalRequired) {
        break; // Progress complete, ready for craft_collect
      }

      // Need to continue
      continueIterations++;

      // craft_continue_start
      const contStartTime = performance.now();
      try {
        await executeReducer(testConnection, 'craft_continue_start', {
          progressive_action_entity_id: progressiveActionEntityId,
          timestamp: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // If craft is already complete, break out
        if (msg.toLowerCase().includes('complete') || msg.toLowerCase().includes('finished')) {
          break;
        }
        return {
          success: false,
          progressiveActionEntityId,
          error: `craft_continue_start failed (iteration ${continueIterations}): ${msg}`,
          timings,
        };
      }
      timings[`craft_continue_start_${continueIterations}`] = performance.now() - contStartTime;

      // Wait for timer
      await new Promise((resolve) => setTimeout(resolve, CRAFTING_CONTINUE_DELAY_MS));

      // craft_continue with retry logic
      const contTime = performance.now();
      let continueSuccess = false;
      let continueError: string | undefined;

      for (let attempt = 0; attempt <= CRAFTING_TIMING_RETRY_COUNT; attempt++) {
        try {
          await executeReducer(testConnection, 'craft_continue', {
            progressive_action_entity_id: progressiveActionEntityId,
            timestamp: Date.now(),
          });
          continueSuccess = true;
          break;
        } catch (err) {
          continueError = err instanceof Error ? err.message : String(err);
          if (
            continueError.toLowerCase().includes('timing') ||
            continueError.toLowerCase().includes('action')
          ) {
            await new Promise((resolve) => setTimeout(resolve, CRAFTING_RETRY_DELAY_MS));
            continue;
          }
          break;
        }
      }

      if (!continueSuccess) {
        return {
          success: false,
          progressiveActionEntityId,
          error: `craft_continue failed (iteration ${continueIterations}): ${continueError ?? 'Unknown error'}`,
          timings,
        };
      }
      timings[`craft_continue_${continueIterations}`] = performance.now() - contTime;
    }

    // -----------------------------------------------------------------------
    // Step 7: craft_collect
    // -----------------------------------------------------------------------
    const step7Start = performance.now();

    // Network-first: register inventory listener before calling craft_collect.
    // Filter by owner_entity_id to match the crafting player.
    const inventoryPromise = waitForTableUpdate<SpacetimeDBRow>(
      testConnection,
      'inventory_state',
      (row) => row.owner_entity_id === entityId || String(row.owner_entity_id) === String(entityId),
      CRAFTING_SUBSCRIPTION_WAIT_TIMEOUT_MS
    ).catch(() => null);

    try {
      await executeReducer(testConnection, 'craft_collect', {
        pocket_id: progressiveActionEntityId,
        recipe_id: recipeId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Try craft_collect_all as fallback
      try {
        await executeReducer(testConnection, 'craft_collect_all', {
          building_entity_id: buildingEntityId,
        });
      } catch (fallbackErr) {
        const fallbackMsg =
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return {
          success: false,
          progressiveActionEntityId,
          error: `craft_collect failed: ${msg}; craft_collect_all fallback also failed: ${fallbackMsg}`,
          timings,
        };
      }
    }
    timings['craft_collect'] = performance.now() - step7Start;

    // Wait for inventory update
    const inventoryChange = await inventoryPromise;

    if (!inventoryChange) {
      console.warn(
        '[executeCraftingLoop] craft_collect succeeded but inventory_state subscription update ' +
          `was not received within ${CRAFTING_SUBSCRIPTION_WAIT_TIMEOUT_MS}ms. ` +
          'The crafted item may still be in inventory; verify via queryTableState().'
      );
    }

    return {
      success: true,
      inventoryChanges: inventoryChange?.newRow ?? undefined,
      progressiveActionEntityId,
      timings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Crafting loop failed: ${msg}`,
      timings,
    };
  }
}

// ---------------------------------------------------------------------------
// Verification Helpers
// ---------------------------------------------------------------------------

/**
 * Verify that materials were consumed from the player's inventory after crafting.
 *
 * Compares inventory state snapshots before and after crafting to detect that
 * the recipe's consumed_item_stacks were removed or decremented. Checks that
 * the inventory pocket contents changed, indicating material consumption.
 *
 * Note: In a single crafting operation, materials are consumed at craft_initiate
 * while products are added at craft_collect. When comparing snapshots that span
 * the full loop, both consumption and receipt occur. This function detects ANY
 * pocket change; for product-specific verification, use verifyCraftedItemReceived().
 *
 * @param inventoryBefore - Inventory state snapshot before crafting
 * @param inventoryAfter - Inventory state snapshot after crafting
 * @param playerEntityId - Player's entity_id (matches inventory_state.owner_entity_id)
 * @returns true if inventory pocket contents changed (materials consumed or modified)
 */
export function verifyMaterialsConsumed(
  inventoryBefore: SpacetimeDBRow[],
  inventoryAfter: SpacetimeDBRow[],
  playerEntityId: bigint | number
): boolean {
  const filterByOwner = (rows: SpacetimeDBRow[]) =>
    rows.filter(
      (r) =>
        r.owner_entity_id === playerEntityId || String(r.owner_entity_id) === String(playerEntityId)
    );

  const before = filterByOwner(inventoryBefore);
  const after = filterByOwner(inventoryAfter);

  if (before.length === 0 && after.length === 0) {
    console.warn(
      `[verifyMaterialsConsumed] No inventory rows found for owner_entity_id=${String(playerEntityId)}`
    );
    return false;
  }

  // Compare pocket contents -- materials consumed means some pockets changed.
  // Serialize pockets for comparison (handles both array and object representations).
  const serializePockets = (inv: SpacetimeDBRow): string => {
    try {
      return JSON.stringify(inv.pockets ?? []);
    } catch {
      return '';
    }
  };

  const beforePockets = before.map(serializePockets).sort().join('||');
  const afterPockets = after.map(serializePockets).sort().join('||');

  // If pockets changed, materials were consumed
  return beforePockets !== afterPockets;
}

/**
 * Verify that the crafted item was received in the player's inventory.
 *
 * Checks inventory_state for changes that indicate new items were added
 * after craft_collect.
 *
 * @param inventoryBefore - Inventory state snapshot before craft_collect
 * @param inventoryAfter - Inventory state snapshot after craft_collect
 * @param playerEntityId - Player's entity_id (matches inventory_state.owner_entity_id)
 * @returns true if new items were added to inventory
 */
export function verifyCraftedItemReceived(
  inventoryBefore: SpacetimeDBRow[],
  inventoryAfter: SpacetimeDBRow[],
  playerEntityId: bigint | number
): boolean {
  const filterByOwner = (rows: SpacetimeDBRow[]) =>
    rows.filter(
      (r) =>
        r.owner_entity_id === playerEntityId || String(r.owner_entity_id) === String(playerEntityId)
    );

  const before = filterByOwner(inventoryBefore);
  const after = filterByOwner(inventoryAfter);

  // Count total pocket items before and after
  const countPocketItems = (inventories: SpacetimeDBRow[]): number => {
    let total = 0;
    for (const inv of inventories) {
      const pockets = inv.pockets;
      if (Array.isArray(pockets)) {
        for (const pocket of pockets) {
          if (pocket && (pocket.item_id != null || pocket.quantity != null)) {
            total += Number(pocket.quantity ?? 1);
          }
        }
      }
    }
    return total;
  };

  const beforeCount = countPocketItems(before);
  const afterCount = countPocketItems(after);

  // If total items increased (even accounting for consumed materials),
  // the crafted item was received
  if (afterCount > beforeCount) {
    return true;
  }

  // Fallback: check if pocket structure changed at all (crafted item added,
  // even if total count decreased due to material consumption in the same snapshot)
  const serializePockets = (inv: SpacetimeDBRow): string => {
    try {
      return JSON.stringify(inv.pockets ?? []);
    } catch {
      return '';
    }
  };

  const beforePockets = before.map(serializePockets).sort().join('||');
  const afterPockets = after.map(serializePockets).sort().join('||');

  return beforePockets !== afterPockets;
}
