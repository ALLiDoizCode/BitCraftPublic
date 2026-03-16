# Story 5.5: Player Lifecycle & Movement Validation -- Test Architecture Traceability Report

**Generated:** 2026-03-16
**Story:** 5.5 -- Player Lifecycle & Movement Validation
**Status:** COMPLETE
**Test Result:** 22/22 integration tests (all skip without Docker; 22 pass with Docker per verification)
**Overall Traceability:** 5/5 ACs fully covered (100%)

---

## Acceptance Criteria Summary

| AC# | Title | FR/NFR | Test Coverage | Status |
| --- | ----- | ------ | ------------- | ------ |
| AC1 | Player creation and initial state verification | FR4, FR5, NFR5 | 5 tests | COVERED |
| AC2 | Movement execution and position verification | FR17, NFR5 | 4 tests | COVERED |
| AC3 | Invalid movement rejection | -- | 4 tests | COVERED |
| AC4 | Sequential movement path verification | NFR3, FR20, FR21 | 5 tests | COVERED |
| AC5 | Reusable lifecycle and movement fixtures | -- | 4 tests | COVERED |

---

## Detailed Traceability Matrix

### AC1: Player creation and initial state verification (FR4, FR5, NFR5)

> **Given** a fresh SpacetimeDB identity with no existing player in the game world
> **When** the player creation flow is executed (connect -> `player_queue_join` -> `sign_in`)
> **Then** a new player entity is created in SpacetimeDB
> **And** the player's initial state (position via `mobile_entity_state`, health via `health_state`, signed-in status via `player_state`) is observable via subscriptions
> **And** the player entity is attributed to the SpacetimeDB Identity used for the connection (via `user_state` -> `entity_id` chain)

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `player-lifecycle-movement.test.ts` | `[P0] should verify user_state entry exists with matching identity after connect` | After `setupSignedInPlayer()`, `user_state` contains an entry whose identity matches the connection identity (string comparison, hex comparison, and `toHexString()` fallback). |
| `player-lifecycle-movement.test.ts` | `[P0] should verify signed_in_player_state row exists after player_queue_join + sign_in` | After `setupSignedInPlayer()`, `signed_in_player_state` table contains a row with the player's `entity_id`. |
| `player-lifecycle-movement.test.ts` | `[P0] should verify mobile_entity_state row exists with valid position fields after sign-in` | After sign-in, `mobile_entity_state` row exists for entity_id with `location_x` and `location_z` that are defined and not NaN. |
| `player-lifecycle-movement.test.ts` | `[P0] should verify health_state row exists with health > 0 after sign-in` | After sign-in, `health_state` row exists for entity_id with health value > 0 (tries `health`, `current_health`, `hp` field names). |
| `player-lifecycle-movement.test.ts` | `[P0] should verify identity chain: connection identity -> user_state -> entity_id -> player_state -> mobile_entity_state -> health_state -> signed_in_player_state` | Full 5-table identity chain: `user_state`, `player_state`, `mobile_entity_state`, `health_state`, and `signed_in_player_state` all share the same `entity_id`. String equality asserted for each. |

**Coverage assessment:** COMPLETE. All three Then clauses are verified: (1) player entity creation confirmed via `signed_in_player_state` presence (test 2) and `user_state` entry (test 1); (2) initial state observable -- position via `mobile_entity_state` (test 3), health via `health_state` (test 4), signed-in status via `signed_in_player_state` (test 2); (3) identity attribution verified across 5 tables with same `entity_id` (test 5).

**Canonical epics.md deviation (documented):** Canonical AC1 says "player creation reducer is called via `client.publish()`" and "attributed to the Nostr public key." Story uses direct WebSocket with SpacetimeDB Identity per BLOCKER-1 bypass. Well-documented in story spec.

---

### AC2: Movement execution and position verification (FR17, NFR5)

> **Given** an existing signed-in player entity
> **When** `player_move` reducer is called with a valid `PlayerMoveRequest` containing destination coordinates
> **Then** the player's position updates in `mobile_entity_state`
> **And** the subscription delivers the position change within 500ms (NFR5)
> **And** the old position (origin) and new position (destination) are both verifiable

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `player-lifecycle-movement.test.ts` | `[P0] should update mobile_entity_state destination after player_move with valid coordinates` | After `player_move`, `mobile_entity_state` row updates with `destination_x` and `destination_z` matching the request (via `toBeCloseTo(destX, 0)` and `toBeCloseTo(destZ, 0)` for f32-to-i32 conversion tolerance). |
| `player-lifecycle-movement.test.ts` | `[P0] should verify origin coordinates in player_move request match current location` | Before movement, verifies `mobile_entity_state.location_x` and `location_z` match `initialPosition`. Then calls `player_move` with those as origin and verifies movement succeeds (no rejection). |
| `player-lifecycle-movement.test.ts` | `[P1] should receive mobile_entity_state update within 500ms of player_move call (NFR5)` | Measures `elapsedMs` from `waitForTableUpdate` and asserts `elapsedMs < 500`. Also logs total round-trip timing for performance baseline. |
| `player-lifecycle-movement.test.ts` | `[P1] should update player_action_state to reflect PlayerMove action type after movement` | After `player_move`, checks `player_action_state` for the entity_id via both `waitForTableUpdate` and `waitForTableInsert` (with fallback to direct query). Verifies the row has meaningful content (`entity_id` defined). |

**Coverage assessment:** COMPLETE. All three Then clauses verified: (1) position updates in `mobile_entity_state` with correct destination values (test 1, with value-level assertions); (2) subscription delivers within 500ms (test 3, explicit `elapsedMs < 500` assertion); (3) old position (origin) and new position (destination) both verifiable -- origin verified via pre-move query (test 2), destination verified via post-move `toBeCloseTo` assertions (test 1).

---

### AC3: Invalid movement rejection

> **Given** a movement action
> **When** the `player_move` reducer is called with conditions that should fail (e.g., player not signed in, missing destination)
> **Then** the reducer rejects the action with a clear error
> **And** the player's position in `mobile_entity_state` remains unchanged (verified via subscription/query)

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `player-lifecycle-movement.test.ts` | `[P1] should reject player_move when player is not signed in with "Not signed in" error` | After `sign_out`, calls `player_move` and catches error. Asserts error message contains "not signed in" (case-insensitive). |
| `player-lifecycle-movement.test.ts` | `[P1] should reject player_move with missing destination with "Expected destination" error` | Calls `player_move` with `destination: null` (BSATN `None`). Asserts error message contains "expected destination". |
| `player-lifecycle-movement.test.ts` | `[P1] should reject player_move with missing origin with "Expected origin" error` | Calls `player_move` with `origin: null` (BSATN `None`). Asserts error message contains "expected origin". |
| `player-lifecycle-movement.test.ts` | `[P1] should verify mobile_entity_state position is unchanged after each failed player_move` | Records `location_x`/`location_z` before an invalid move (missing destination), attempts the move (catches error), then queries `mobile_entity_state` after a delay and asserts `location_x` and `location_z` are unchanged. |

**Coverage assessment:** COMPLETE. Both Then clauses verified: (1) clear error messages tested for 3 failure conditions (not-signed-in, missing destination, missing origin) -- tests 1-3; (2) position unchanged verified via before/after `mobile_entity_state` query (test 4). Note: position-unchanged test covers only the missing-destination failure mode. This was reviewed in Code Review #1 (finding #6, accepted) -- testing a representative failure mode is sufficient since the position-unchanged assertion pattern is identical for all failure modes.

**Canonical epics.md deviation (documented):** Canonical AC3 says "the BLS returns a clear error through the Crosstown confirmation." Story tests direct WebSocket reducer errors per BLOCKER-1.

---

### AC4: Sequential movement path verification (NFR3, FR20, FR21)

> **Given** a sequence of movements
> **When** the player moves through multiple positions in sequence (A -> B -> C)
> **Then** each movement is individually verified: position updated in `mobile_entity_state`, identity correct
> **And** the round-trip for each movement completes within 2 seconds (NFR3)
> **And** wallet balance accounting is verified across the movement sequence (stub mode per DEBT-5)

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `player-lifecycle-movement.test.ts` | `[P1] should execute 3 sequential player_move calls (A -> B -> C) and verify each position update` | Executes 3 sequential moves with increasing deltas. After each move, verifies `mobile_entity_state` row exists and `destination_x`/`destination_z` match the requested values via `toBeCloseTo(dest.x, 0)` and `toBeCloseTo(dest.z, 0)`. |
| `player-lifecycle-movement.test.ts` | `[P1] should verify round-trip timing for each movement in sequence is < 2000ms (NFR3)` | Times each of 3 sequential moves with `performance.now()`. Asserts each `roundTripMs < 2000`. Logs all 3 timings. |
| `player-lifecycle-movement.test.ts` | `[P2] should verify wallet stub-mode balance queries succeed before and after movement sequence (DEBT-5)` | Creates `WalletClient` in stub mode, queries balance before and after. Asserts balance is a finite number, stub mode is active, balance is unchanged in stub mode, and balance >= movement cost * 3. Also verifies `ActionCostRegistryLoader` can look up `player_move` cost. |
| `player-lifecycle-movement.test.ts` | `[P1] should verify identity chain is consistent across all movements -- same entity_id throughout` | Executes 3 sequential moves, asserting `String(newRow.entity_id) === String(entityId)` after each. After all moves, verifies `user_state` still has the entity. |
| `player-lifecycle-movement.test.ts` | `[P2] should log min/max/avg round-trip times for the 3-movement sequence (performance baseline)` | Executes 3 sequential moves, collects timings, computes min/max/avg, logs to console. Asserts `max < 2000` and `avg < 2000` (NFR3). |

**Coverage assessment:** COMPLETE. All three Then clauses verified: (1) each movement individually verified with destination value assertions (test 1) and identity consistency (test 4); (2) round-trip < 2000ms per movement (test 2) and baseline logging (test 5); (3) wallet stub-mode accounting verified (test 3) with balance queries, stub mode detection, cost registry lookup, and balance sufficiency check.

**Canonical epics.md deviation (documented):** Canonical AC4 says "cost deducted" and "total wallet balance change equals the sum of individual movement costs." Story validates stub-mode accounting (DEBT-5) rather than real ILP fees, which is consistent with Story 5.4.

---

### AC5: Reusable lifecycle and movement fixtures

> **Given** the player lifecycle and movement validation tests pass
> **When** the test infrastructure is reviewed
> **Then** reusable test fixtures are produced for: player lifecycle setup (sign-in to gameplay-ready state), position query, movement execution, movement verification, and movement error scenario testing
> **And** the fixtures extend the Story 5.4 fixtures (not duplicate them)
> **And** the `serializeReducerArgs()` function in `test-client.ts` is extended with `player_move` argument serialization
> **And** the fixtures document the actual reducer names, argument formats, and expected state transitions

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `player-lifecycle-movement.test.ts` | `[P1] should verify all Story 5.5 fixtures are importable from barrel export (index.ts)` | Dynamically imports `fixtures/index` and verifies all Story 5.5 exports exist (`subscribeToStory55Tables`, `waitForTableUpdate`, `setupSignedInPlayer`, `teardownPlayer`) AND all Story 5.4 exports still exist (`createTestClient`, `executeReducer`, `serializeReducerArgs`, `verifyStateChange`, `isDockerStackHealthy`, `waitForTableInsert`, `waitForTableDelete`, `queryTableState`, `subscribeToTables`, `subscribeToStory54Tables`). |
| `player-lifecycle-movement.test.ts` | `[P1] should verify setupSignedInPlayer returns signed-in player with entityId and initialPosition` | Calls `setupSignedInPlayer()` and verifies returned object has: `testConnection` with `connection` and `identity`, non-null `entityId`, and `initialPosition` with `locationX` and `locationZ` that are numbers and not NaN. |
| `player-lifecycle-movement.test.ts` | `[P1] should verify teardownPlayer calls sign_out and disconnects without errors` | Calls `teardownPlayer(conn)` on an active connection -- asserts no error thrown. Then calls `teardownPlayer(null)` -- asserts no error thrown for null input. |
| `player-lifecycle-movement.test.ts` | `[P1] should verify serializeReducerArgs handles player_move with correct BSATN encoding` | Serializes `player_move` with all-Some options and asserts buffer is 35 bytes. Serializes with `destination: null` and asserts 27 bytes. Serializes with `origin: null` and asserts 27 bytes. Serializes with both null and asserts 19 bytes. Validates `Uint8Array` type. |

**Coverage assessment:** COMPLETE. All four Then clauses verified: (1) reusable fixtures produced and importable -- barrel export test covers 14 function exports (test 1), lifecycle fixture returns valid state (test 2), teardown handles gracefully (test 3); (2) fixtures extend Story 5.4 -- barrel export test explicitly checks both 5.4 and 5.5 exports coexist (test 1); (3) `serializeReducerArgs()` extended with `player_move` -- BSATN encoding byte-level verification for 4 Option combinations (test 4); (4) reducer names, argument formats, and state transitions documented via JSDoc in all fixture files.

**Fixture inventory produced by AC5:**

| Fixture | File | Purpose |
| ------- | ---- | ------- |
| `setupSignedInPlayer()` | `player-lifecycle.ts` | Full lifecycle: connect -> subscribe 7 tables -> queue_join -> sign_in -> entity_id -> position |
| `teardownPlayer()` | `player-lifecycle.ts` | Graceful sign_out + disconnect (no-throw) |
| `subscribeToStory55Tables()` | `subscription-helpers.ts` | Subscribe to 7 tables for player lifecycle/movement |
| `waitForTableUpdate()` | `subscription-helpers.ts` | Detect row modifications (onUpdate or delete+insert fallback) |
| `player_move` serialization | `test-client.ts` | BSATN encoding of `PlayerMoveRequest` with `Option<OffsetCoordinatesFloat>` |

---

## Test File Summary

| Test File | Tests | Primary ACs | Description |
| --------- | ----- | ----------- | ----------- |
| `player-lifecycle-movement.test.ts` | 22 | AC1-AC5 | Integration tests: player creation, movement, errors, sequential path, fixtures |
| **Total** | **22** | **AC1-AC5** | **All integration tests, Docker-dependent** |

---

## Source/Fixture File to Test File Mapping

| Source/Fixture File | Test File(s) | Coverage Notes |
| ------------------- | ------------ | -------------- |
| `fixtures/player-lifecycle.ts` | `player-lifecycle-movement.test.ts` (AC1, AC2, AC3, AC4, AC5) | `setupSignedInPlayer()` used in 19/22 tests; `teardownPlayer()` used in all afterEach hooks |
| `fixtures/subscription-helpers.ts` | `player-lifecycle-movement.test.ts` (AC1, AC2, AC4) | `subscribeToStory55Tables()` via setupSignedInPlayer; `waitForTableUpdate()` in AC2/AC4; `queryTableState()` in AC1/AC3 |
| `fixtures/test-client.ts` | `player-lifecycle-movement.test.ts` (AC2, AC3, AC4, AC5) | `executeReducer()` in all movement/error tests; `serializeReducerArgs('player_move', ...)` verified in AC5 BSATN test |
| `fixtures/index.ts` | `player-lifecycle-movement.test.ts` (AC5) | Barrel import verified in AC5 test 1 |

---

## FR/NFR Traceability

| Requirement | ACs Covered | Tests | Verified |
| ----------- | ----------- | ----- | -------- |
| FR4 (Identity via Nostr keypair) | AC1 | 5 tests | YES -- identity chain verified via SpacetimeDB `ctx.sender` -> `user_state` -> `entity_id` |
| FR5 (Identity persistence) | AC1 | 5 tests | YES -- SpacetimeDB identity maps to persistent `user_state` entry |
| NFR5 (Subscription update < 500ms) | AC1, AC2 | 4 tests | YES -- AC2 test 3 explicitly asserts `elapsedMs < 500` |
| FR17 (Execute actions) | AC2, AC4 | 9 tests | YES -- `player_move` executed via direct WebSocket; BLS path deferred to BLOCKER-1 |
| FR20 (Fee collection) | AC4 | 1 test | YES -- wallet stub-mode accounting validated (DEBT-5) |
| FR21 (Action cost lookup) | AC4 | 1 test | YES -- `ActionCostRegistryLoader` lookup for `player_move` cost verified |
| NFR3 (Round-trip < 2 seconds) | AC4 | 2 tests | YES -- each movement asserted `< 2000ms`; performance baseline logged |

---

## Uncovered ACs

None. All 5 acceptance criteria (AC1-AC5) have full test coverage.

---

## Cross-Cutting Concerns Tested

| Concern | Tests | Notes |
| ------- | ----- | ----- |
| Docker graceful skip | 22 tests | `describe.skipIf(!runIntegrationTests)` + inner `if (!dockerHealthy)` guard on every test |
| Network-first pattern | 8 tests | All AC2/AC4 tests register subscription listener before calling reducer |
| Cleanup/teardown | 5 describe blocks | Every describe block has `afterEach` calling `teardownPlayer()` or explicit disconnect |
| BSATN serialization correctness | 1 test | Byte-level verification: 35, 27, 27, 19 bytes for 4 Option combinations |
| Identity consistency | 2 tests | AC1 full chain (5 tables), AC4 cross-movement chain (3 movements + user_state) |
| Performance timing instrumentation | 3 tests | `performance.now()` + NFR assertions + console logging |
| Error message verification | 3 tests | Case-insensitive substring match for 3 error conditions |
| Position state immutability on failure | 1 test | Before/after `location_x`/`location_z` comparison |

---

## Risk Assessment

- **Docker dependency:** All 22 tests require Docker stack. Tests skip cleanly without Docker (AGREEMENT-5). No unit test equivalent is possible since these validate end-to-end through live SpacetimeDB.
- **Timing sensitivity:** NFR5 (500ms) and NFR3 (2000ms) assertions could be flaky under CI load. Generous wait timeouts (5000-10000ms) mitigate this while asserting strict thresholds separately.
- **Update detection (R5-016):** `waitForTableUpdate()` handles both `onUpdate` callback and `onDelete+onInsert` fallback patterns. Both strategies are guarded by `settled` flag and timeout.
- **Anti-cheat (R5-017):** Tests use conservative movement parameters (1-2 unit deltas, 1.0s duration, walk mode) to avoid server-side anti-cheat triggers.
- **BLOCKER-1:** All tests bypass BLS handler. The canonical `client.publish()` path is documented as deferred. This is consistent across all Epic 5 validation stories.

---

## Conclusion

Story 5.5 has **100% AC coverage** (5/5 ACs fully covered) with **22 integration tests** in a single test file. The implementation correctly validates: player lifecycle (creation, sign-in, initial state across 5 tables) per AC1, movement execution with value-level destination assertions and sub-500ms subscription timing per AC2, invalid movement rejection with 3 error conditions and position-unchanged verification per AC3, sequential 3-movement path with per-movement NFR3 timing and wallet stub accounting per AC4, and reusable fixture production with barrel export and BSATN encoding verification per AC5. No gaps were found.
