---
title: 'Docker World Seeding & Integration Test Seed Utilities'
slug: 'docker-world-seeding'
created: '2026-03-16'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['shell/sh', 'typescript', 'vitest', 'spacetimedb-sdk ^1.3.3', 'spacetimedb-cli']
files_to_modify:
  - 'docker/bitcraft/init.sh'
  - 'packages/client/src/__tests__/integration/fixtures/seed-helpers.ts'
  - 'packages/client/src/__tests__/integration/fixtures/index.ts'
  - 'packages/client/src/__tests__/integration/fixtures/test-client.ts'
code_patterns:
  - 'BSATN binary serialization via BinaryWriter'
  - 'executeReducer() for WebSocket reducer calls'
  - 'serializeReducerArgs() switch-case extensibility'
  - 'typed fixture helpers with barrel export'
  - 'spacetime call CLI for shell-level reducer invocation'
test_patterns:
  - 'docker-health-check gate in beforeAll'
  - 'setupSignedInPlayer/teardownPlayer lifecycle'
  - 'waitForTableInsert/Update/Delete subscription waits'
  - 'queryTableState for snapshot assertions'
---

# Tech-Spec: Docker World Seeding & Integration Test Seed Utilities

**Created:** 2026-03-16

## Overview

### Problem Statement

The current Docker `init.sh` publishes the BitCraft WASM module but does NOT generate a game world. Tests have no deterministic baseline world, and there are no typed helpers for the ~85 admin/cheat reducers that could compose arbitrary test scenarios. Each SDK validation epic (9-13) will need repeatable world state setup.

### Solution

Hybrid approach — modify `init.sh` to call `generate_dev_island()` after module publish (deterministic 10x10 chunk baseline), then build a shared seed utility module with typed TS helpers wrapping cheat/admin reducers for per-test scenario composition.

### Scope

**In Scope:**
- Modify `docker/bitcraft/init.sh` to call `generate_dev_island()` post-publish
- Create `seed-helpers.ts` fixture module with typed wrappers for key cheat/admin reducers
- Extend `serializeReducerArgs()` in `test-client.ts` with BSATN serialization for cheat/admin reducers
- Foundation helpers covering: item granting, XP granting, knowledge granting, teleportation, enemy spawning, resource regen, map discovery, server agent control
- Barrel-export new helpers from `fixtures/index.ts`
- Verify existing Epic 5 integration tests still pass with seeded world

**Out of Scope:**
- Epic-specific seed helpers (added by each epic as needed)
- New Docker images or Dockerfile changes
- CI pipeline changes (existing pipeline already runs integration tests)
- Full coverage of all 85 reducers (foundation only, extend incrementally)

## Context for Development

### Codebase Patterns

- Integration tests use direct WebSocket connection to SpacetimeDB (BLOCKER-1 bypass of BLS)
- Existing fixture pattern: typed helper modules in `packages/client/src/__tests__/integration/fixtures/`
- Barrel export via `fixtures/index.ts`
- Reducer calls use `executeReducer()` from `test-client.ts` which calls `serializeReducerArgs()` for BSATN encoding
- BSATN serialization uses `BinaryWriter` from `@clockworklabs/spacetimedb-sdk` with manual field-by-field writing
- `serializeReducerArgs()` uses a switch-case pattern — new reducers are added as new cases
- State verification uses `waitForTableInsert/Update/Delete` from `subscription-helpers.ts`
- Player lifecycle uses `setupSignedInPlayer()` → `teardownPlayer()` pattern from `player-lifecycle.ts`
- Server-side agents (enemy regen, resource regen, etc.) run as scheduled reducers controlled by `start_agents()`/`stop_agents()`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `docker/bitcraft/init.sh` | Docker init script — publish module, needs world gen call |
| `packages/client/src/__tests__/integration/fixtures/test-client.ts` | `executeReducer()`, `serializeReducerArgs()` — extend with new reducer serialization |
| `packages/client/src/__tests__/integration/fixtures/seed-helpers.ts` | NEW — typed seed helper functions |
| `packages/client/src/__tests__/integration/fixtures/player-lifecycle.ts` | `setupSignedInPlayer()` — pattern to follow, seeds need signed-in player |
| `packages/client/src/__tests__/integration/fixtures/resource-helpers.ts` | Existing helper pattern to follow (typed params, doc comments, constants) |
| `packages/client/src/__tests__/integration/fixtures/index.ts` | Barrel export — add new seed-helpers exports |

### Technical Decisions

- **Hybrid seeding**: Docker init creates baseline world via `generate_dev_island()`, test fixtures fine-tune per scenario via cheat reducers
- **`generate_dev_island()` over `generate_world()`**: Deterministic 10x10 chunks with all entity types vs. non-deterministic procedural generation
- **`start_agents()`/`stop_agents()` toggle**: Tests should control whether server-side scheduled agents run (determinism vs. full-loop testing)
- **Shell-level world gen**: `spacetime call bitcraft generate_dev_island` in init.sh — runs once per container start, before any test connects
- **Foundation-first**: Ship core helpers now, each SDK validation epic extends the seed library
- **Extend serializeReducerArgs**: Add BSATN cases to the existing switch-case rather than creating a separate serializer

### Reducer Signatures (Server Source)

**Shell-level (init.sh):**

| Reducer | Signature | Notes |
| ------- | --------- | ----- |
| `generate_dev_island` | `(ctx)` → `Result<(), String>` | No args. Creates 10x10 chunk world with all entity types |

**No-arg reducers (TS — no BSATN payload):**

| Reducer | Signature | Notes |
| ------- | --------- | ----- |
| `start_agents` | `(ctx)` | Starts 19+ server-side scheduled loops |
| `stop_agents` | `(ctx)` | Stops all scheduled loops |
| `admin_despawn_overworld_enemies` | `(ctx)` | Removes all overworld enemies |

**Plain-param reducers (TS — sequential BSATN fields):**

| Reducer | Params | BSATN Layout |
| ------- | ------ | ------------ |
| `cheat_item_stack_grant` | `player_entity_id: u64, item_id: i32, quantity: i32, is_cargo: bool` | u64 + i32 + i32 + bool = 17 bytes |
| `cheat_kill` | `entity_id: u64` | u64 = 8 bytes |
| `admin_resource_force_regen` | `resource_id: i32, iterations: i32, ignore_target_count: bool` | i32 + i32 + bool = 9 bytes |

**Struct-param reducers (TS — struct field serialization):**

| Reducer | Request Struct | Fields (BSATN order) |
| ------- | -------------- | -------------------- |
| `cheat_experience_grant` | `CheatExperienceGrantRequest` | `owner_entity_id: u64, skill_id: i32, amount: i32` |
| `cheat_grant_knowledge` | `CheatGrantKnowledgeRequest` | `target_entity_id: u64, also_learn: bool` |
| `cheat_teleport_float` | `CheatTeleportFloatRequest` | `player_entity_id: u64, destination: Option<OffsetCoordinatesFloat>` |
| `cheat_discover_map` | `CheatDiscoverMapRequest` | `target_entity_id: u64` |
| `cheat_compendium_place_enemy` | `CheatCompendiumEnemyPlaceRequest` | `coordinates: OffsetCoordinatesSmallMessage, enemy_type: EnemyType(u8 variant tag)` |
| `cheat_building_place` | `PlayerProjectSitePlaceRequest` | `coordinates: OffsetCoordinatesSmallMessage, construction_recipe_id: i32, resource_placement_recipe_id: i32, facing_direction: i32` |

**Nested types:**

| Type | Fields | BSATN Layout |
| ---- | ------ | ------------ |
| `OffsetCoordinatesSmallMessage` | `x: i32, z: i32, dimension: u32` | i32 + i32 + u32 = 12 bytes |
| `OffsetCoordinatesFloat` | `x: i32, z: i32, dimension: u32` | i32 + i32 + u32 = 12 bytes |
| `EnemyType` | BSATN sum type: **u8 variant tag** (NOT repr(i32)) | None=0, PracticeDummy=1, GrassBird=2, ..., Jakyl=17. BSATN encodes SpacetimeDB enums as a single u8 tag byte for the variant index, not the 4-byte i32 discriminant. Use `writeByte(tag)` not `writeI32()`. |

## Implementation Plan

### Tasks

- [x] Task 1: Add `generate_dev_island` call to Docker init script
  - File: `docker/bitcraft/init.sh`
  - Action: After the `spacetime publish` block (line 80: "BitCraft module published successfully"), add a `spacetime call` to invoke `generate_dev_island`. This must run inside the `if ! spacetime describe` block, only when the module is freshly published (not when "BitCraft database already exists").
  - Implementation:
    ```sh
    # Generate deterministic dev island world (10x10 chunks, all entity types)
    # Requires Admin role — auto-granted in dev environment via has_role() bypass
    echo "Generating dev island world..."
    if spacetime call bitcraft generate_dev_island --server localhost; then
        echo "Dev island world generated successfully"
    else
        echo "WARNING: generate_dev_island failed (non-fatal, world may already exist)"
    fi
    ```
  - Notes: Use non-fatal error handling because `generate_dev_island` returns `Err("World already loaded")` if called twice. Success echo is inside the success branch only. The `--server localhost` flag ensures it targets the local instance. Place after "published successfully" echo, before the `else` branch. The reducer requires Admin role but the Docker dev environment auto-grants all roles via the `has_role()` dev-mode bypass in `authentication.rs`.

- [x] Task 2: Add BSATN serialization cases for cheat/admin reducers
  - File: `packages/client/src/__tests__/integration/fixtures/test-client.ts`
  - Action: Add new `case` entries to the `serializeReducerArgs()` switch statement for each cheat/admin reducer. Follow the existing pattern (see `extract_start`, `craft_initiate_start` cases for reference).
  - Reducers to add:
    - `start_agents`, `stop_agents`, `admin_despawn_overworld_enemies`: No-arg — empty case (like `sign_out`)
    - `cheat_item_stack_grant`: Sequential params — `writeU64(player_entity_id)`, `writeI32(item_id)`, `writeI32(quantity)`, `writeBool(is_cargo)`
    - `cheat_kill`: Single param — `writeU64(entity_id)`
    - `admin_resource_force_regen`: Sequential params — `writeI32(resource_id)`, `writeI32(iterations)`, `writeBool(ignore_target_count)`
    - `cheat_experience_grant`: Struct — `writeU64(owner_entity_id)`, `writeI32(skill_id)`, `writeI32(amount)`
    - `cheat_grant_knowledge`: Struct — `writeU64(target_entity_id)`, `writeBool(also_learn)`
    - `cheat_teleport_float`: Struct — `writeU64(player_entity_id)`, `writeOptionOffsetCoords(destination)` (reuse existing `writeOptionOffsetCoordinatesFloat` helper but note server type uses i32 fields — see Notes)
    - `cheat_discover_map`: Struct — `writeU64(target_entity_id)`
    - `cheat_compendium_place_enemy`: Struct — `writeOffsetCoordinatesSmall(coordinates)`, `writeByte(enemy_type)` (**CRITICAL: BSATN encodes SpacetimeDB enums as u8 variant tag, NOT i32. Use a single byte, not writeI32.**)
    - `cheat_building_place`: Struct — `writeOffsetCoordinatesSmall(coordinates)`, `writeI32(construction_recipe_id)`, `writeI32(resource_placement_recipe_id)`, `writeI32(facing_direction)`
  - Notes:
    - Add a `writeOffsetCoordinatesSmallMessage()` helper function that writes `i32 x, i32 z, u32 dimension` (12 bytes).
    - **CRITICAL: OffsetCoordinatesFloat has 3 fields (`x: i32, z: i32, dimension: u32` = 12 bytes), NOT 2 fields.** The existing `writeOptionOffsetCoordinatesFloat` in test-client.ts writes only `f32 x, f32 z` (8 bytes) for `player_move` — this works in practice but is technically wrong per server source. For `cheat_teleport_float`, create a NEW `writeOptionOffsetCoordinatesFloatFull()` helper that writes the correct 3-field format: `Option tag (u8)` + `i32 x` + `i32 z` + `u32 dimension` = 13 bytes for Some. Do NOT reuse the existing 2-field helper.
    - **Note:** `cheat_teleport_float` server code hardcodes `dimension = 1` regardless of client input. Default dimension to 0 in the helper, but document that the server overrides it.
    - For `cheat_compendium_place_enemy`: BSATN encodes `EnemyType` as a **u8 variant tag byte**, NOT a 4-byte i32. Use `writer.writeByte(enemyType)` or equivalent single-byte write. The `#[repr(i32)]` is for Rust memory layout only — BSATN uses u8 tags for sum types.

- [x] Task 3: Create `seed-helpers.ts` with typed helper functions
  - File: `packages/client/src/__tests__/integration/fixtures/seed-helpers.ts` (NEW)
  - Action: Create typed wrapper functions that compose `executeReducer()` calls into ergonomic test helpers. Follow the pattern established in `resource-helpers.ts` (typed params interfaces, JSDoc comments, exported constants).
  - Functions to create:
    - `grantItems(conn, params: { playerEntityId: bigint|number, itemId: number, quantity: number, isCargo?: boolean })` — wraps `cheat_item_stack_grant`
    - `grantExperience(conn, params: { ownerEntityId: bigint|number, skillId: number, amount: number })` — wraps `cheat_experience_grant`
    - `grantKnowledge(conn, params: { targetEntityId: bigint|number, alsoLearn?: boolean })` — wraps `cheat_grant_knowledge`
    - `teleportPlayer(conn, params: { playerEntityId: bigint|number, destination: { x: number, z: number, dimension?: number } })` — wraps `cheat_teleport_float`
    - `spawnEnemy(conn, params: { coordinates: { x: number, z: number, dimension?: number }, enemyType: number })` — wraps `cheat_compendium_place_enemy`
    - `placeBuilding(conn, params: { coordinates: { x: number, z: number, dimension?: number }, constructionRecipeId: number, resourcePlacementRecipeId?: number, facingDirection?: number })` — wraps `cheat_building_place`
    - `discoverMap(conn, params: { targetEntityId: bigint|number })` — wraps `cheat_discover_map`
    - `killEntity(conn, params: { entityId: bigint|number })` — wraps `cheat_kill`
    - `forceResourceRegen(conn, params: { resourceId: number, iterations?: number, ignoreTargetCount?: boolean })` — wraps `admin_resource_force_regen`
    - `despawnOverworldEnemies(conn)` — wraps `admin_despawn_overworld_enemies`
    - `startServerAgents(conn)` — wraps `start_agents`
    - `stopServerAgents(conn)` — wraps `stop_agents`
  - Notes: Each function takes a `SpacetimeDBTestConnection` as first param (same pattern as `executeReducer`). Use sensible defaults (e.g., `dimension: 0`, `isCargo: false`, `iterations: 1`). Export an `EnemyTypeId` const object with common enemy type IDs (PracticeDummy=1, Jakyl=17, etc.) for ergonomic test authoring. **Each helper's params must be a named exported interface** (e.g., `GrantItemsParams`, `TeleportPlayerParams`) following the pattern in `resource-helpers.ts` (`ExecuteExtractionParams`, `GatherableResource`). This enables callers to construct param objects in advance and provides better IDE autocompletion.

- [x] Task 4: Add barrel exports to `fixtures/index.ts`
  - File: `packages/client/src/__tests__/integration/fixtures/index.ts`
  - Action: Add export block for seed-helpers at the end of the file, following the existing pattern (comment header, named exports).
  - Exports: All functions and types from `seed-helpers.ts`, plus the `EnemyTypeId` constants object.

- [x] Task 5: Create `seed-helpers.test.ts` integration test file
  - File: `packages/client/src/__tests__/integration/seed-helpers.test.ts` (NEW)
  - Action: Create an integration test file that validates each seed helper against the live Docker stack. Follow the pattern established in `resource-gathering-inventory.test.ts` (Docker health gate in beforeAll, setupSignedInPlayer, teardownPlayer in afterAll).
  - Tests to include:
    - `grantItems` — grant items and verify via `inventory_state` subscription (AC3)
    - `grantExperience` — grant XP and verify via `experience_state` subscription (AC4)
    - `teleportPlayer` — teleport and verify via `mobile_entity_state` position (AC5)
    - `spawnEnemy` — spawn enemy and verify entity exists in world (AC6)
    - `stopServerAgents` / `startServerAgents` — toggle and verify config state (AC7)
    - `killEntity` — kill a spawned enemy and verify removal (AC9)
    - `despawnOverworldEnemies` — despawn all and verify (AC10)
  - Notes: Some helpers (`grantKnowledge`, `discoverMap`, `forceResourceRegen`, `placeBuilding`) may need additional subscription tables not yet loaded. Test what's feasible; mark others as `.todo()` with a note about which subscription tables are needed. Each test should be independent — use `beforeEach`/`afterEach` for cleanup where entities are created.

- [x] Task 6: Verify existing integration tests pass with seeded world
  - Action: Run the full integration test suite (`pnpm test:integration`) against a Docker stack that includes the `generate_dev_island()` call. The dev island creates resources, enemies, buildings, and terrain that weren't previously present — verify that existing tests (action-round-trip, player-lifecycle-movement, resource-gathering-inventory, crafting-loop) still pass.
  - Notes: The dev island world has entities at known coordinates. Existing tests that rely on an empty world (if any) may need adjustment. The `generate_dev_island()` pre-populates: resource nodes, NPCs, enemies, buildings, and terrain across 10x10 chunks. Tests that `findGatherableResource()` or `findCraftingBuilding()` may find more results now, which should be fine (they use `find` not exact-match).

### Acceptance Criteria

- [x] AC1: Given a fresh Docker container start, when `init.sh` runs to completion, then `generate_dev_island` is called after module publish and the world contains terrain, resources, enemies, NPCs, and buildings across 10x10 chunks.
- [x] AC2: Given a Docker container where the database already exists (restart without volume wipe), when `init.sh` runs, then `generate_dev_island` is NOT called again (only runs on fresh publish).
- [x] AC3: Given a connected test client, when `grantItems()` is called with a valid player entity ID, item ID, and quantity, then the player's `inventory_state` contains the specified item stack.
- [x] AC4: Given a connected test client, when `grantExperience()` is called with a valid entity ID, skill ID, and XP amount, then the player's `experience_state` reflects the granted XP.
- [x] AC5: Given a connected test client, when `teleportPlayer()` is called with target coordinates, then the player's `mobile_entity_state` position updates to the specified location.
- [x] AC6: Given a connected test client, when `spawnEnemy()` is called with coordinates and enemy type, then an enemy entity appears in the world at the specified location.
- [x] AC7: Given a connected test client, when `stopServerAgents()` is called, then server-side scheduled agents set `config.agents_enabled = false` (agents continue running but skip their work), and when `startServerAgents()` is called, agents resume processing. Note: `stop_agents` does NOT cancel running agents — it sets a config flag that agents check before doing work. A brief settle delay may be needed after calling stop before asserting deterministic state.
- [x] AC8: Given the seeded dev island world, when existing Epic 5 integration tests run (action-round-trip, player-lifecycle-movement, resource-gathering-inventory, crafting-loop), then all previously passing tests still pass.
- [x] AC9: Given a connected test client, when `killEntity()` is called with a valid entity ID, then the entity is removed from the world state.
- [x] AC10: Given a connected test client, when `despawnOverworldEnemies()` is called, then all overworld enemies are removed.

## Additional Context

### Dependencies

- **Docker stack running**: All seed helpers require the 3-service Docker stack (bitcraft-server, crosstown-node, bitcraft-bls)
- **`@clockworklabs/spacetimedb-sdk` ^1.3.3**: BinaryWriter for BSATN serialization (already a dependency)
- **Existing fixtures**: `executeReducer()`, `SpacetimeDBTestConnection`, `setupSignedInPlayer()` from Epic 5
- **`spacetime` CLI**: Available inside the Docker container for `spacetime call` in init.sh

### Testing Strategy

- **No new unit tests**: Seed helpers are thin wrappers around `executeReducer()` which is already tested. BSATN serialization cases follow the proven pattern.
- **Integration tests**: A new integration test file `seed-helpers.test.ts` that validates each seed helper against the live Docker stack. This covers ACs 3-7, 9-10.
- **Regression**: Run full `pnpm test:integration` to verify AC8 (existing tests unbroken by dev island world).
- **Manual verification**: After modifying init.sh, run `docker compose down -v && rm -rf docker/volumes/* && docker compose up -d` and check logs for "Dev island world generated" message. Query `spacetime sql bitcraft "SELECT COUNT(*) FROM resource_state"` to confirm resources exist.

### Notes

- **Risk: `generate_dev_island` timeout**: The dev island generator creates entities across 100 chunks. If this takes longer than the Docker healthcheck `start_period` (90s), the healthcheck may report unhealthy before world gen completes. Monitor init logs — if needed, increase `start_period` in docker-compose.yml.
- **Risk: Healthcheck race condition (F6)**: The Docker healthcheck (`spacetime describe bitcraft`) succeeds after module publish but BEFORE `generate_dev_island` completes. Tests that depend on the seeded world could run against a partially-generated world. Mitigation: the healthcheck's `start_period: 90s` provides a buffer, and integration tests should verify expected entities exist before proceeding. If world gen exceeds 90s, consider changing the healthcheck to verify world state (e.g., `spacetime sql bitcraft "SELECT COUNT(*) FROM terrain_chunk_state"` > 0).
- **Risk: BSATN field type mismatch for OffsetCoordinatesFloat**: The server source shows `OffsetCoordinatesFloat` with `i32` fields and a `dimension: u32` field, but the existing `player_move` serialization in test-client.ts uses `f32` and omits `dimension`. The existing `player_move` tests pass despite this — possible explanations: (a) the WASM module has a different version of OffsetCoordinatesFloat, (b) BSATN tolerates the mismatch because f32 and i32 are both 4 bytes. For new cheat reducers, use the 3-field i32 format per server source. Do NOT modify the existing `player_move` serializer — it works and is out of scope.
- **Auth model assumption**: All cheat/admin reducers require Admin role via `has_role(ctx, &ctx.sender, Role::Admin)`. The Docker dev environment auto-grants all roles via the dev-mode bypass in `authentication.rs`. This means these helpers will ONLY work against the Docker dev stack, never against a production server. Document this in seed-helpers.ts JSDoc.
- **Crash recovery edge case (F14)**: If the container crashes DURING `generate_dev_island` (after publish but before gen completes), on restart the database exists but the world is partially generated. The init script will skip generation. Fix: `docker compose down -v && rm -rf docker/volumes/* && docker compose up -d` for a clean slate. This is acceptable for dev/CI — not a production concern.
- **Future: Epic-specific extensions**: Each SDK validation epic (9-13) will add domain-specific seed helpers to this module. The pattern is established here — future epics just add functions and BSATN cases.
- **Future: Seed composition functions**: Higher-level helpers like `setupCombatScenario()` or `setupTradingPair()` that compose multiple seed calls. These belong to their respective epics, not this foundation spec.

## Adversarial Review Findings (2026-03-16)

15 findings from adversarial review. Critical and High findings have been incorporated into the spec above. Medium and Low findings are documented here for implementer awareness.

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| F1 | Critical | **FIXED** | `EnemyType` BSATN encoding: must use u8 variant tag byte, not i32. Fixed in Task 2 notes and Nested Types table. |
| F2 | Critical | **FIXED** | `OffsetCoordinatesFloat` has 3 fields (x:i32, z:i32, dimension:u32), not 2 fields (x:f32, z:f32). Fixed in Task 2 notes — new helper for 3-field format. |
| F3 | High | **FIXED** | Missing `dimension` field causes 4-byte buffer corruption. Addressed by F2 fix. |
| F4 | High | **FIXED** | Auth model undocumented. Added auth notes to Task 1 and Notes section. |
| F5 | High | **FIXED** | init.sh "world generated" echo was outside success path. Fixed in Task 1 implementation snippet. |
| F6 | High | **DOCUMENTED** | Healthcheck race condition — healthcheck passes before world gen completes. Documented in Notes with mitigation. |
| F7 | Medium | **NOTED** | Server source path is `BitCraftServer/` not `rebels-in-the-sky/server/`. Implementer should use `BitCraftServer/packages/game/src/` for source verification. |
| F8 | Medium | **FIXED** | `stop_agents` sets config flag, doesn't kill running agents. AC7 reworded. |
| F9 | Medium | **FIXED** | Missing test task. Added Task 5 (`seed-helpers.test.ts`), renumbered old Task 5 to Task 6. |
| F10 | Medium | **NOTED** | AC1 verification only checks one entity type. For initial implementation, verifying `resource_state` count > 0 is sufficient. Full entity type verification is future work. |
| F11 | Medium | **FIXED** | `cheat_teleport_float` ignores client `dimension`, hardcodes to 1. Documented in Task 2 notes. |
| F12 | Low | **NOTED** | "~85 reducers" is approximate. Actual: ~42 cheats + admin handlers. Does not affect implementation scope. |
| F13 | Low | **NOTED** | `EnemyTypeId` constants should document they are u8 variant indices matching BSATN encoding. |
| F14 | Low | **DOCUMENTED** | Crash during world gen leaves partial state. Documented in Notes with clean-slate fix. |
| F15 | Medium | **FIXED** | Param types must be named exported interfaces, not inline anonymous objects. Fixed in Task 3 notes. |

## Implementation Review Notes

- Adversarial code review completed (2026-03-16)
- Findings: 12 total, 10 fixed (auto-fix), 2 skipped (noise/undecided)
- Resolution approach: auto-fix for all "real" findings

| ID | Severity | Resolution | Description |
|----|----------|------------|-------------|
| F1 | Critical | **FIXED** | `EnemyTypeId` constants had fabricated names — replaced with actual server `EnemyType` enum values from `static_data.rs`. Extended from 18 to 28 entries. |
| F2 | Medium | **FIXED** | `writeOffsetCoordinatesSmallMessage` null guard added. |
| F3 | Medium | **FIXED** | Test assertions strengthened — removed `.catch(() => null)` swallowing, added before/after count comparisons. |
| F4 | Medium | **FIXED** | AC7 config assertions made unconditional — `expect().toBeDefined()` on config rows. |
| F5 | Medium | **FIXED** | Documented i32/u32 truncation behavior in `writeOptionOffsetCoordinatesFloatFull` JSDoc. |
| F6 | Low | **FIXED** | Documented server `unwrap()` panic risk in `teleportPlayer` JSDoc. |
| F7 | Low | **FIXED** | Changed inner health guards from `return` to `it.skipIf()` for proper skip reporting. |
| F8 | Low | **FIXED** | `SpawnEnemyParams.enemyType` typed as `EnemyTypeIdValue` instead of `number`. |
| F9 | Low | **ACKNOWLEDGED** | BSATN unit tests out of scope per tech spec ("No new unit tests"). Pattern follows existing codebase. |
| F10 | Low | **FIXED** | AC10 test uses `waitForTableDelete` event-driven wait instead of hardcoded 2s delay. |
| F11 | Low | **SKIPPED** | Noise — local constant intentional per existing test file pattern. |
| F12 | Low | **SKIPPED** | Undecided — `spacetime call` CLI arg format is version-dependent. Non-fatal handling mitigates. |
