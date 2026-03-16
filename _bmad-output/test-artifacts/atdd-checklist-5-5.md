---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-16'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/5-5-player-lifecycle-and-movement-validation.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
  - '_bmad/tea/testarch/knowledge/test-priorities-matrix.md'
  - 'packages/client/src/__tests__/integration/fixtures/test-client.ts'
  - 'packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts'
  - 'packages/client/src/__tests__/integration/fixtures/spacetimedb-connection.ts'
  - 'packages/client/src/__tests__/integration/fixtures/docker-health.ts'
  - 'packages/client/src/__tests__/integration/fixtures/index.ts'
  - 'packages/client/src/__tests__/integration/action-round-trip.test.ts'
---

# ATDD Checklist - Epic 5, Story 5: Player Lifecycle & Movement Validation

**Date:** 2026-03-16
**Author:** Jonathan
**Primary Test Level:** Integration

---

## Story Summary

Validate the player lifecycle (spawn, existence, movement) end-to-end through the SDK pipeline, proving the most fundamental gameplay -- a player existing and moving in the world -- works correctly via direct SpacetimeDB WebSocket connection. This is the second validation story in Epic 5, building on Story 5.4's reusable test fixtures.

**As a** developer
**I want** to validate the player lifecycle (spawn, existence, movement) end-to-end through the SDK pipeline
**So that** we prove the most fundamental gameplay -- a player existing and moving in the world -- works correctly

---

## Acceptance Criteria

1. **AC1 - Player creation and initial state verification (FR4, FR5, NFR5):** After connect -> `player_queue_join` -> `sign_in`, verify player entity created with observable initial state (position via `mobile_entity_state`, health via `health_state`, signed-in status via `player_state`), attributed to the SpacetimeDB Identity used for the connection.
2. **AC2 - Movement execution and position verification (FR17, NFR5):** After calling `player_move` with valid `PlayerMoveRequest`, verify `mobile_entity_state` updates with new position within 500ms (NFR5), with old and new positions both verifiable.
3. **AC3 - Invalid movement rejection:** When `player_move` is called with conditions that should fail (not signed in, missing destination, missing origin), the reducer rejects with clear error and position remains unchanged.
4. **AC4 - Sequential movement path verification (NFR3, FR20, FR21):** Execute 3 sequential movements (A -> B -> C), each individually verified for position update and identity correctness, each within 2000ms round-trip (NFR3), with wallet stub-mode accounting verified.
5. **AC5 - Reusable lifecycle and movement fixtures:** Reusable fixtures produced for player lifecycle setup, position query, movement execution, movement verification, and movement error testing, extending (not duplicating) Story 5.4 fixtures.

---

## Failing Tests Created (RED Phase)

### Integration Tests (22 tests)

**File:** `packages/client/src/__tests__/integration/player-lifecycle-movement.test.ts` (~750 lines)

#### AC1: Player creation and initial state verification (5 tests)

- **Test:** `[P0] should verify user_state entry exists with matching identity after connect`
  - **Status:** RED - Requires Docker stack with SpacetimeDB server and Story 5.5 subscription set (7 tables)
  - **Verifies:** Connection identity -> `user_state` entry exists (builds on Story 5.4, uses Story 5.5 subscription set)

- **Test:** `[P0] should verify signed_in_player_state row exists after player_queue_join + sign_in`
  - **Status:** RED - Requires `setupSignedInPlayer()` fixture and Story 5.5 table subscriptions
  - **Verifies:** `signed_in_player_state` row exists for the player's `entity_id` after sign-in

- **Test:** `[P0] should verify mobile_entity_state row exists with valid position fields after sign-in`
  - **Status:** RED - Requires `subscribeToStory55Tables()` with `mobile_entity_state` subscription
  - **Verifies:** `mobile_entity_state` row has valid `location_x`, `location_z` (numbers, not NaN/undefined)

- **Test:** `[P0] should verify health_state row exists with health > 0 after sign-in`
  - **Status:** RED - Requires `health_state` subscription in Story 5.5 table set
  - **Verifies:** `health_state` row exists for entity, `health > 0` (player alive)

- **Test:** `[P0] should verify identity chain: connection identity -> user_state -> entity_id -> player_state -> mobile_entity_state -> signed_in_player_state`
  - **Status:** RED - Requires full identity chain traversal across 5 tables
  - **Verifies:** Same `entity_id` links all state tables for this player

#### AC2: Movement execution and position verification (4 tests)

- **Test:** `[P0] should update mobile_entity_state destination after player_move with valid coordinates`
  - **Status:** RED - Requires `player_move` BSATN serialization in `serializeReducerArgs()` and `waitForTableUpdate()`
  - **Verifies:** `destination_x`/`destination_z` in `mobile_entity_state` match request destination

- **Test:** `[P0] should verify origin coordinates in player_move request match current location`
  - **Status:** RED - Requires querying `mobile_entity_state` for current position before move
  - **Verifies:** Request origin matches actual `location_x`/`location_z` from `mobile_entity_state`

- **Test:** `[P1] should receive mobile_entity_state update within 500ms of player_move call (NFR5)`
  - **Status:** RED - Requires `waitForTableUpdate()` with sub-500ms timing assertion
  - **Verifies:** Subscription delivers `mobile_entity_state` update within 500ms (NFR5)

- **Test:** `[P1] should update player_action_state to reflect PlayerMove action type after movement`
  - **Status:** RED - Requires `player_action_state` subscription and action type verification
  - **Verifies:** `player_action_state` updated to reflect movement action

#### AC3: Invalid movement rejection (4 tests)

- **Test:** `[P1] should reject player_move when player is not signed in with "Not signed in" error`
  - **Status:** RED - Requires calling `player_move` after `sign_out` and expecting reducer error
  - **Verifies:** Reducer error contains "Not signed in"

- **Test:** `[P1] should reject player_move with missing destination with "Expected destination" error`
  - **Status:** RED - Requires `PlayerMoveRequest` BSATN serialization with `destination: None`
  - **Verifies:** Reducer error contains "Expected destination in move request"

- **Test:** `[P1] should reject player_move with missing origin with "Expected origin" error`
  - **Status:** RED - Requires `PlayerMoveRequest` BSATN serialization with `origin: None`
  - **Verifies:** Reducer error contains "Expected origin in move request"

- **Test:** `[P1] should verify mobile_entity_state position is unchanged after each failed player_move`
  - **Status:** RED - Requires position query before and after failed move
  - **Verifies:** `location_x`/`location_z` and `destination_x`/`destination_z` unchanged

#### AC4: Sequential movement path verification (5 tests)

- **Test:** `[P1] should execute 3 sequential player_move calls (A -> B -> C) and verify each position update`
  - **Status:** RED - Requires sequential `player_move` execution with position verification between each
  - **Verifies:** Each `mobile_entity_state` update reflects the correct destination

- **Test:** `[P1] should verify round-trip timing for each movement in sequence is < 2000ms (NFR3)`
  - **Status:** RED - Requires `performance.now()` instrumentation around each movement
  - **Verifies:** Each movement round-trip < 2000ms (NFR3)

- **Test:** `[P2] should verify wallet stub-mode balance queries succeed before and after movement sequence (DEBT-5)`
  - **Status:** RED - Requires `WalletClient` stub mode balance checks
  - **Verifies:** Wallet balance queryable and consistent across movement sequence

- **Test:** `[P1] should verify identity chain is consistent across all movements -- same entity_id throughout`
  - **Status:** RED - Requires `entity_id` verification at each step of sequence
  - **Verifies:** Same `entity_id` maintained across all 3 movements

- **Test:** `[P2] should log min/max/avg round-trip times for the 3-movement sequence (performance baseline)`
  - **Status:** RED - Requires timing collection and logging across 3 movements
  - **Verifies:** Performance baseline documented with timing stats

#### AC5: Reusable fixture production (4 tests)

- **Test:** `[P1] should verify all Story 5.5 fixtures are importable from barrel export (index.ts)`
  - **Status:** RED - Requires updated `fixtures/index.ts` with Story 5.5 exports
  - **Verifies:** `subscribeToStory55Tables`, `setupSignedInPlayer`, `teardownPlayer`, `waitForTableUpdate` all exported

- **Test:** `[P1] should verify setupSignedInPlayer returns signed-in player with entityId and initialPosition`
  - **Status:** RED - Requires `setupSignedInPlayer()` implementation in `player-lifecycle.ts`
  - **Verifies:** Returns `{ testConnection, entityId, initialPosition }` with valid values

- **Test:** `[P1] should verify teardownPlayer calls sign_out and disconnects without errors`
  - **Status:** RED - Requires `teardownPlayer()` implementation
  - **Verifies:** Graceful sign_out and disconnect (no-throw)

- **Test:** `[P1] should verify serializeReducerArgs handles player_move with correct BSATN encoding`
  - **Status:** RED - Requires `player_move` case added to `serializeReducerArgs()` in `test-client.ts`
  - **Verifies:** Correct BSATN byte output for `PlayerMoveRequest` struct

---

## Data Factories Created

### PlayerMoveRequest Factory

**File:** `packages/client/src/__tests__/integration/fixtures/test-client.ts` (extended)

**Exports:**

- `serializeReducerArgs('player_move', [...])` - Serialize `PlayerMoveRequest` with timestamp, destination, origin, duration, move_type, running to BSATN binary format

**Example Usage:**

```typescript
const argsBuffer = await serializeReducerArgs('player_move', [{
  timestamp: Date.now(),
  destination: { x: 1.0, z: 1.0 },
  origin: { x: 0.0, z: 0.0 },
  duration: 1.0,
  move_type: 0,
  running: false,
}]);
```

---

## Fixtures Created

### Player Lifecycle Fixtures

**File:** `packages/client/src/__tests__/integration/fixtures/player-lifecycle.ts`

**Fixtures:**

- `setupSignedInPlayer(options?)` - Complete player lifecycle setup: connect -> subscribe to Story 5.5 tables -> `player_queue_join` -> `sign_in` -> verify state -> return gameplay-ready player
  - **Setup:** SpacetimeDB connection, 7-table subscription, sign-in flow
  - **Provides:** `{ testConnection, entityId, initialPosition }` -- signed-in player with known entity ID and starting position
  - **Cleanup:** Call `teardownPlayer()` or manual `sign_out` + disconnect

- `teardownPlayer(testConnection)` - Graceful player teardown: `sign_out` -> disconnect, handling errors gracefully
  - **Setup:** None
  - **Provides:** void (cleanup only)
  - **Cleanup:** Calls `sign_out` reducer, then `disconnectFromSpacetimeDB()`

### Extended Subscription Helpers

**File:** `packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts` (extended)

**Fixtures:**

- `subscribeToStory55Tables(testConnection)` - Subscribe to 7 tables required for Story 5.5: `user_state`, `player_state`, `signed_in_player_state`, `mobile_entity_state`, `health_state`, `stamina_state`, `player_action_state`
  - **Setup:** SQL subscription queries for all 7 tables
  - **Provides:** void (subscriptions active)
  - **Cleanup:** Auto via connection disconnect

- `waitForTableUpdate(testConnection, tableName, predicate, timeoutMs)` - Wait for a row modification in a table. Handles SpacetimeDB SDK's delete+insert pattern for updates (not just inserts).
  - **Setup:** Registers `onDelete` + `onInsert` listener pair, or `onUpdate` if available
  - **Provides:** `{ oldRow, newRow, elapsedMs }` -- the previous and updated row with timing
  - **Cleanup:** Auto-cleanup via timeout and `settled` flag

### Barrel Export Updates

**File:** `packages/client/src/__tests__/integration/fixtures/index.ts` (extended)

Re-exports all new fixtures:
- `subscribeToStory55Tables` from `subscription-helpers.ts`
- `waitForTableUpdate` from `subscription-helpers.ts`
- `setupSignedInPlayer` from `player-lifecycle.ts`
- `teardownPlayer` from `player-lifecycle.ts`

---

## Mock Requirements

### No External Service Mocking Required

Story 5.5 tests against the **real** Docker stack services (SpacetimeDB, Crosstown, BLS). No service mocking is needed because:

- BLOCKER-1 workaround: Direct WebSocket connection to SpacetimeDB (bypasses BLS)
- Wallet: Uses stub mode (DEBT-5) which self-activates on 404 from Crosstown
- Tests skip gracefully when Docker is not available

---

## Required data-testid Attributes

### N/A

Story 5.5 is a backend/SDK integration story with no UI components. No data-testid attributes are required.

---

## Implementation Checklist

### Test: Extend test fixtures for Story 5.5 subscriptions and movement serialization

**File:** `packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts`, `test-client.ts`, `index.ts`

**Tasks to make this test pass:**

- [ ] Create `subscribeToStory55Tables()` in `subscription-helpers.ts` subscribing to 7 tables: `user_state`, `player_state`, `signed_in_player_state`, `mobile_entity_state`, `health_state`, `stamina_state`, `player_action_state`
- [ ] Add `player_move` case to `serializeReducerArgs()` in `test-client.ts` encoding `PlayerMoveRequest` struct (timestamp: u64, destination: Option<OffsetCoordinatesFloat>, origin: Option<OffsetCoordinatesFloat>, duration: f32, move_type: i32, running: bool)
- [ ] Add `OffsetCoordinatesFloat` BSATN serialization helper: `{ x: f32, z: f32 }` with Option wrapping (0x00 None, 0x01 + value Some)
- [ ] Create `waitForTableUpdate()` in `subscription-helpers.ts` detecting row modifications via `onDelete` + `onInsert` pair (SpacetimeDB updates may emit as delete-then-insert)
- [ ] Update `fixtures/index.ts` barrel with all new exports
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement`

**Estimated Effort:** 2 hours

---

### Test: Player lifecycle setup fixture (setupSignedInPlayer)

**File:** `packages/client/src/__tests__/integration/fixtures/player-lifecycle.ts`

**Tasks to make this test pass:**

- [ ] Create `setupSignedInPlayer()` handling full sign-in flow: connect -> subscribe to Story 5.5 tables -> `player_queue_join` -> `sign_in` -> verify `signed_in_player_state` -> return `{ testConnection, entityId, initialPosition }`
- [ ] Extract `entity_id` from `user_state` for the connection identity
- [ ] Query `mobile_entity_state` after sign-in to capture initial position (`location_x`, `location_z`)
- [ ] Create `teardownPlayer()` that calls `sign_out` and disconnects, handling errors gracefully
- [ ] Export lifecycle helpers from `fixtures/index.ts` barrel
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement`

**Estimated Effort:** 2 hours

---

### Test: Player creation and initial state (AC1 tests)

**File:** `packages/client/src/__tests__/integration/player-lifecycle-movement.test.ts`

**Tasks to make this test pass:**

- [ ] Implement AC1 test: verify `user_state` entry with matching identity using Story 5.5 subscription set
- [ ] Implement AC1 test: verify `signed_in_player_state` row exists after `player_queue_join` + `sign_in`
- [ ] Implement AC1 test: verify `mobile_entity_state` row with valid position fields (`location_x`, `location_z` are numbers)
- [ ] Implement AC1 test: verify `health_state` row with `health > 0`
- [ ] Implement AC1 test: verify identity chain across `user_state` -> `player_state` -> `mobile_entity_state` -> `signed_in_player_state` (same `entity_id`)
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement`

**Estimated Effort:** 2 hours

---

### Test: Movement execution and position verification (AC2 tests)

**File:** `packages/client/src/__tests__/integration/player-lifecycle-movement.test.ts`

**Tasks to make this test pass:**

- [ ] Implement AC2 test: call `player_move` with valid destination, verify `mobile_entity_state` updates with correct `destination_x`/`destination_z`
- [ ] Implement AC2 test: verify origin coordinates match player's current `location_x`/`location_z`
- [ ] Implement AC2 test: verify subscription delivers `mobile_entity_state` update within 500ms (NFR5)
- [ ] Implement AC2 test: verify `player_action_state` updated to reflect movement action
- [ ] Add `performance.now()` instrumentation around movement calls
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement`

**Estimated Effort:** 3 hours

---

### Test: Invalid movement and error handling (AC3 tests)

**File:** `packages/client/src/__tests__/integration/player-lifecycle-movement.test.ts`

**Tasks to make this test pass:**

- [ ] Implement AC3 test: call `player_move` after `sign_out`, expect error containing "Not signed in"
- [ ] Implement AC3 test: call `player_move` with `destination: None` (BSATN 0x00), expect error containing "Expected destination"
- [ ] Implement AC3 test: call `player_move` with `origin: None` (BSATN 0x00), expect error containing "Expected origin"
- [ ] Implement AC3 test: verify `mobile_entity_state` position unchanged after each failed `player_move`
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement`

**Estimated Effort:** 2 hours

---

### Test: Sequential movement path (AC4 tests)

**File:** `packages/client/src/__tests__/integration/player-lifecycle-movement.test.ts`

**Tasks to make this test pass:**

- [ ] Implement AC4 test: execute 3 sequential `player_move` calls (A -> B -> C), verify each `mobile_entity_state` update
- [ ] Implement AC4 test: verify round-trip timing < 2000ms (NFR3) for each movement
- [ ] Implement AC4 test: verify wallet stub-mode balance queries succeed before and after movement sequence
- [ ] Implement AC4 test: verify same `entity_id` across all movements
- [ ] Implement AC4 test: log min/max/avg round-trip times for performance baseline
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement`

**Estimated Effort:** 3 hours

---

### Test: Reusable fixture verification (AC5 tests)

**File:** `packages/client/src/__tests__/integration/player-lifecycle-movement.test.ts`

**Tasks to make this test pass:**

- [ ] Implement AC5 test: verify all Story 5.5 fixtures importable from `fixtures/index.ts`
- [ ] Implement AC5 test: verify `setupSignedInPlayer()` returns valid `entityId` and `initialPosition`
- [ ] Implement AC5 test: verify `teardownPlayer()` calls `sign_out` and disconnects without errors
- [ ] Implement AC5 test: verify `serializeReducerArgs('player_move', [...])` produces correct BSATN encoding
- [ ] Add JSDoc documentation to all new fixtures
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement`

**Estimated Effort:** 1.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story (requires Docker stack)
RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement

# Run specific test file
RUN_INTEGRATION_TESTS=true npx vitest run packages/client/src/__tests__/integration/player-lifecycle-movement.test.ts

# Run tests with verbose output
RUN_INTEGRATION_TESTS=true npx vitest run --reporter=verbose packages/client/src/__tests__/integration/player-lifecycle-movement.test.ts

# Run tests without Docker (all integration tests will skip)
pnpm --filter @sigil/client test -- player-lifecycle-movement

# Debug specific test (node inspector)
RUN_INTEGRATION_TESTS=true node --inspect-brk node_modules/.bin/vitest run packages/client/src/__tests__/integration/player-lifecycle-movement.test.ts

# Run Story 5.4 tests to verify no regressions
RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip
```

---

## Red-Green-Refactor Workflow

### RED Phase (Current)

**TEA Agent Responsibilities:**

- All test files written with real assertions (no placeholder assertions per AGREEMENT-10)
- Fixtures created with connection cleanup in afterEach hooks
- Mock requirements documented (none needed -- uses real Docker stack)
- data-testid requirements: N/A (backend story)
- Implementation checklist created mapping tests to code tasks
- Tests skip gracefully when Docker not available

**Verification:**

- Tests will fail when Docker is running because:
  - `subscribeToStory55Tables()` not yet implemented
  - `player_move` case not yet in `serializeReducerArgs()`
  - `waitForTableUpdate()` not yet implemented
  - `setupSignedInPlayer()` not yet implemented
  - `teardownPlayer()` not yet implemented
  - `player-lifecycle.ts` fixture file does not exist
- Tests will skip when Docker is not running (clean skip, no cryptic errors)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with fixture infrastructure)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Move to next test** and repeat

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Start with fixture infrastructure (Task 1, Task 2), then AC1, AC2, AC3, AC4
- SDK API surface exploration is the main work for `player_move` BSATN serialization
- Use implementation checklist as roadmap
- Extend existing Story 5.4 fixtures -- DO NOT duplicate

**Progress Tracking:**

- Check off tasks as you complete them in this checklist
- Focus on making each test pass before moving to the next

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review fixture code** for reusability by Stories 5.6-5.8
3. **Extract common patterns** (DRY principle)
4. **Document fixture usage** in JSDoc comments
5. **Ensure tests still pass** after each refactor
6. **Verify Story 5.4 tests still pass** (no regressions)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All 22 tests pass
- All Story 5.4 tests still pass (no regressions)
- Code quality meets team standards (AGREEMENT-10: no placeholders)
- Fixtures documented and exported for Stories 5.6-5.8

---

## Next Steps

1. **Start Docker stack:** `docker compose -f docker/docker-compose.yml up -d`
2. **Run failing tests** to confirm RED phase: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement`
3. **Begin implementation** using implementation checklist as guide (start with fixture infrastructure)
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor fixtures for reusability
6. **When refactoring complete**, commit with `feat(5-5): story complete`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Factory patterns for PlayerMoveRequest creation with BSATN serialization overrides
- **test-quality.md** - Deterministic tests, no hard waits, explicit assertions, isolation, cleanup, test length limits
- **test-levels-framework.md** - Integration test level selected as primary (Docker-dependent backend stack)
- **test-healing-patterns.md** - Network-first pattern applied (subscription listener registered before reducer call to prevent race conditions); `settled` flag pattern for stale callback protection
- **test-priorities-matrix.md** - P0/P1/P2 priority assignment based on risk and business impact

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- player-lifecycle-movement`

**Expected Results:**

- Without Docker: All tests skip (`describe.skipIf(!runIntegrationTests)`)
- With Docker: Tests fail due to missing fixture implementations (`subscribeToStory55Tables`, `waitForTableUpdate`, `setupSignedInPlayer`, `teardownPlayer`, `player_move` BSATN serialization)

**Summary:**

- Total tests: 22
- Passing: 0 (expected - RED phase)
- Failing/Skipping: 22 (expected - fixtures need implementation)
- Status: RED phase - test infrastructure designed, awaiting implementation

**Expected Failure Messages:**

- `subscribeToStory55Tables is not a function` (fixture not yet created)
- `setupSignedInPlayer is not a function` (fixture not yet created)
- `waitForTableUpdate is not a function` (fixture not yet created)
- `teardownPlayer is not a function` (fixture not yet created)
- `Unknown reducer 'player_move' in serializeReducerArgs` (case not yet added)

---

## Notes

- **BLOCKER-1:** All tests bypass BLS handler and use direct SpacetimeDB WebSocket. The BLS-based publish pipeline will be validated after BLOCKER-1 is resolved.
- **R5-016:** `mobile_entity_state` update detection is the key risk for Story 5.5. SpacetimeDB SDK may emit delete+insert instead of a direct update. `waitForTableUpdate()` must handle both patterns.
- **R5-017:** `player_move` anti-cheat validation requires realistic values: small position deltas (1-2 units), reasonable duration (1.0s), current timestamp. Use `synchronize_time` first if anti-cheat blocks.
- **R5-018:** `mobile_entity_state` uses `i32` coordinates but `PlayerMoveRequest` uses `f32`. Server converts between float request coords and integer storage coords. Verify actual column types at runtime.
- **DEBT-5:** Wallet stub mode returns fixed balance 10000. AC4 validates the stub accounting path, not real ILP fees.
- **SDK API Surface:** Story 5.4 confirmed: `BinaryWriter` from `@clockworklabs/spacetimedb-sdk` for BSATN serialization, `writeU64()`, `writeF32()`, `writeI32()`, `writeBool()` methods. Story 5.5 extends this with `Option<T>` encoding (0x00 None, 0x01 + value Some).
- **Table/column naming:** All references use Game Reference nomenclature: `mobile_entity_state.location_x` (not `position_x`), `mobile_entity_state.destination_x` (not `target_x`).
- **Network-first pattern:** All subscription listeners registered BEFORE executing reducers (Story 5.4 Code Review #2 learning).
- **Story 5.4 regression:** Story 5.4 tests (`action-round-trip.test.ts`) must continue to pass. Story 5.5 modifications are additive only (new fixture file, extended existing fixtures).

---

## Priority Distribution

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 7 | Critical path: player creation, initial state, movement execution, identity chain |
| P1 | 12 | Important: timing assertions, error handling, sequential movements, fixture verification |
| P2 | 3 | Nice-to-have: wallet stub accounting, performance baseline logging |
| **Total** | **22** | |

---

**Generated by BMAD TEA Agent** - 2026-03-16
