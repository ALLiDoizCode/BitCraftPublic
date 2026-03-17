---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-16'
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/5-8-error-scenarios-and-graceful-degradation.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - packages/client/src/__tests__/integration/fixtures/index.ts
  - packages/client/src/__tests__/integration/fixtures/test-client.ts
  - packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts
  - packages/client/src/__tests__/integration/fixtures/player-lifecycle.ts
  - packages/client/src/__tests__/integration/fixtures/crafting-helpers.ts
  - packages/client/src/__tests__/integration/crafting-loop.test.ts
  - packages/client/src/agent/budget-publish-guard.ts
  - packages/client/src/agent/budget-tracker.ts
  - packages/client/src/agent/budget-types.ts
  - packages/client/src/wallet/wallet-client.ts
  - packages/client/src/crosstown/crosstown-adapter.test.ts
  - packages/client/src/errors/error-codes.md
  - packages/client/vitest.config.ts
---

# ATDD Checklist - Epic 5, Story 5.8: Error Scenarios & Graceful Degradation

**Date:** 2026-03-16
**Author:** Jonathan
**Primary Test Levels:** Integration (Vitest + SpacetimeDB WebSocket) + Unit (Vitest, wallet/budget)

---

## Story Summary

Validates that error scenarios (invalid actions, insufficient balance, disconnections) are handled gracefully through the full pipeline, proving the system fails safely and provides actionable error information.

**As a** developer
**I want** to validate that error scenarios (invalid actions, insufficient balance, disconnections) are handled gracefully through the full pipeline
**So that** we have confidence the system fails safely and provides actionable error information

---

## Acceptance Criteria

1. **AC1 (FR17, NFR27):** Unknown reducer rejection with clear error -- non-existent reducer submitted, server rejects with clear error, no state changes occur.
2. **AC2 (FR17, NFR27):** Invalid argument rejection with actionable error -- invalid argument types/count/values submitted, server rejects with actionable error identifying the argument mismatch.
3. **AC3 (FR20, FR21, NFR24):** Insufficient balance pre-flight rejection -- `BudgetPublishGuard.guard()` throws `BudgetExceededError` when budget exhausted. No reducer call made. Wallet balance unchanged.
4. **AC4 (NFR24):** SpacetimeDB reconnection with state recovery -- connection loss simulated via Docker pause/unpause. Subscription state recovers after reconnection. Game state is consistent (action completed or not, no partial state).
5. **AC5 (NFR24):** Crosstown connection loss handling -- deferred per BLOCKER-1. `CrosstownAdapter` error mapping verified via existing unit tests. Documented with expected behavior.
6. **AC6 (NFR27):** Error catalog documentation and reusable fixtures -- error catalog appendix in BitCraft Game Reference. Reusable error assertion fixtures produced for all future integration tests.

---

## Preflight & Context (Step 1)

### Stack Detection

- **Detected Stack:** `backend` (TypeScript pnpm workspace + Rust cargo workspace; Vitest for testing)
- **Test Framework:** Vitest (not Playwright/Cypress -- no browser-based testing)
- **Test Stack Type:** Backend integration tests (direct SpacetimeDB WebSocket) + unit tests (wallet/budget client-side)

### Prerequisites Verified

- Story approved with 6 clear acceptance criteria (Given/When/Then format)
- Test framework configured: `vitest.config.ts` present in `packages/client/`
- Development environment available: Docker stack required for AC1, AC2, AC4 integration tests
- Story has BMAD validation status: VALIDATED (adversarial review 2026-03-16)
- All dependency stories (5.1-5.7) complete

### Existing Patterns Loaded

- **Story 5.4 fixtures:** `docker-health.ts`, `spacetimedb-connection.ts`, `subscription-helpers.ts`, `test-client.ts`
- **Story 5.5 fixtures:** `player-lifecycle.ts` with `setupSignedInPlayer()`, `teardownPlayer()`
- **Story 5.6 fixtures:** `resource-helpers.ts` with `findGatherableResource()`, `executeExtraction()`, `verifyInventoryContains()`
- **Story 5.7 fixtures:** `crafting-helpers.ts` with `findCraftingBuilding()`, `executeCraftingLoop()`, `verifyMaterialsConsumed()`
- **Existing tests:** `action-round-trip.test.ts` (22 tests), `player-lifecycle-movement.test.ts` (22 tests), `resource-gathering-inventory.test.ts` (25 tests), `crafting-loop.test.ts` (33 tests)
- **Wallet/Budget source:** `wallet-client.ts` (WalletClient with stub mode), `budget-tracker.ts` (BudgetTracker), `budget-publish-guard.ts` (BudgetPublishGuard), `budget-types.ts` (BudgetExceededError)
- **CrosstownAdapter tests:** `crosstown-adapter.test.ts` (existing unit tests for error mapping)
- **Patterns:** `describe.skipIf(!runIntegrationTests)`, `dockerHealthy` inner checks, named delay constants, `SpacetimeDBRow` type alias, `findByEntityId()` helper, `findByOwnerEntityId()` helper, network-first pattern, identity-matched entity lookup

### Knowledge Fragments Applied

- `test-quality.md` -- deterministic tests, isolation, explicit assertions, no hard waits
- `data-factories.md` -- factory patterns (adapted for SpacetimeDB row data)
- `test-levels-framework.md` -- integration + unit test level selection for service interactions and client-side logic
- `test-priorities-matrix.md` -- P0-P3 priority assignment based on risk and impact
- `test-healing-patterns.md` -- timing failure detection, retry patterns, Docker pause/unpause resilience

---

## Generation Mode (Step 2)

**Mode:** AI Generation (backend stack, no browser recording needed)

**Rationale:** This is a backend test story combining integration tests (direct SpacetimeDB WebSocket, Docker pause/unpause) and unit tests (wallet/budget client-side logic). No browser, no UI, no Playwright. AI generation from story acceptance criteria, existing fixture patterns from Stories 5.4-5.7, BitCraft Game Reference precondition documentation, and existing wallet/budget source code analysis.

---

## Test Strategy (Step 3)

### Test Level Selection

| Acceptance Criterion | Test Level | Priority | Justification |
|---|---|---|---|
| AC1: Non-existent reducer rejected with clear error | Integration | P0 | Server-side error handling; requires live SpacetimeDB |
| AC1: Plausible typo reducer rejected | Integration | P1 | Variant of unknown reducer pattern |
| AC1: State unchanged after unknown reducer error | Integration | P0 | NFR24 state consistency verification |
| AC1: Empty string reducer rejected by client validation | Unit (in integration file) | P0 | Client-side input validation (no Docker needed but tested inline) |
| AC1: Oversized reducer name rejected by client validation | Unit (in integration file) | P0 | Client-side input validation |
| AC1: Error catalog entries recorded | Integration | P2 | Documentation/fixture verification |
| AC2: sign_in with no BSATN args | Integration | P0 | Server-side deserialization error |
| AC2: player_move with malformed BSATN | Integration | P0 | Server-side argument validation |
| AC2: extract_start with invalid recipe_id | Integration | P0 | Game precondition error (Game Reference) |
| AC2: craft_initiate_start with recipe_id=0 | Integration | P0 | Game precondition error (Game Reference) |
| AC2: craft_initiate_start with building_entity_id=0 | Integration | P0 | Game precondition error (Game Reference) |
| AC2: player_move without sign_in ("Not signed in") | Integration | P0 | Game precondition error (Game Reference) |
| AC2: chat_post_message with empty text | Integration | P0 | Game precondition error (Game Reference) |
| AC2: State unchanged after each invalid argument test | Integration | P0 | NFR24 state consistency |
| AC2: Error catalog entries recorded | Integration | P2 | Documentation/fixture verification |
| AC3: WalletClient stub mode returns fixed balance | Unit | P0 | Client-side balance query |
| AC3: BudgetPublishGuard.canAfford() returns true when budget sufficient | Unit | P0 | Budget check logic |
| AC3: BudgetPublishGuard.canAfford() returns false when budget insufficient | Unit | P0 | Budget check logic |
| AC3: BudgetPublishGuard.guard() throws BudgetExceededError | Unit | P0 | Budget enforcement error path |
| AC3: Wallet balance unchanged after BudgetExceededError | Unit | P0 | NFR24 state consistency |
| AC3: Document ILP fee deferral (BLOCKER-1) | Unit | P2 | Documentation test |
| AC3: Error catalog entries recorded | Unit | P2 | Documentation/fixture verification |
| AC4: Establish connection and sign in | Integration | P0 | Baseline for reconnection test |
| AC4: Docker pause triggers disconnection detection | Integration | P0 | Connection loss detection |
| AC4: Docker unpause allows reconnection | Integration | P0 | Reconnection capability |
| AC4: Subscription state recovered after reconnection | Integration | P0 | State recovery |
| AC4: No partial state after pause/unpause | Integration | P0 | NFR24 consistency |
| AC4: Document reconnection/auto-logout behavior | Integration | P1 | Behavioral documentation |
| AC4: Docker control unavailable -- graceful skip | Integration | P1 | CI resilience |
| AC5: Document Crosstown loss deferral (BLOCKER-1) | Unit | P1 | Documentation with skip |
| AC5: Verify CrosstownAdapter error mapping in existing tests | Unit | P1 | Existing coverage verification |
| AC5: Verify error codes in error-codes.md | Unit | P1 | Documentation verification |
| AC5: Error catalog entries recorded | Unit | P2 | Documentation/fixture verification |
| AC6: chat_post_message BSATN serialization | Unit (in integration file) | P1 | Serialization correctness |
| AC6: Barrel exports verification | Unit (in integration file) | P1 | API contract verification |
| AC6: Error assertion fixtures functional | Unit (in integration file) | P0 | Fixture infrastructure |
| AC6: assertPreconditionError helper functional | Unit (in integration file) | P0 | Reusable fixture |

### Test Level Rationale

**Two test levels** are used in this story:

1. **Integration tests** (AC1, AC2, AC4, AC6 partial): Require live SpacetimeDB server in Docker to test reducer error responses, precondition violations, and connection loss simulation. File: `error-scenarios.test.ts`

2. **Unit tests** (AC3, AC5, AC6 partial): Test client-side wallet/budget logic (`WalletClient`, `BudgetTracker`, `BudgetPublishGuard`) and CrosstownAdapter error mapping without Docker. File: `error-scenarios.test.ts` (unit-level describe blocks within the same file, following Story 5.8 spec which specifies a single test file)

### Error Category Taxonomy

| Category | Source | Error Type | Test Level | Testable? |
|----------|--------|------------|------------|-----------|
| Unknown reducer | SpacetimeDB server | Reducer not found | Integration | YES |
| Invalid arguments | SpacetimeDB server / BitCraft reducers | Deserialization / precondition | Integration | YES |
| Insufficient balance | Client-side wallet / budget guard | Pre-flight rejection | Unit | YES |
| Connection loss (SpacetimeDB) | WebSocket disconnection | Connection drop / reconnection | Integration | YES (Docker pause/unpause) |
| Connection loss (Crosstown) | Crosstown adapter | NETWORK_TIMEOUT / NETWORK_ERROR | Unit (existing) | DEFERRED (BLOCKER-1) |

---

## Failing Tests Created (RED Phase)

### Integration Tests (AC1: Unknown Reducer Error -- 6 tests)

**File:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`

**describe: Unknown Reducer Error Tests (AC1)**

- **Test:** `[P0] should reject non-existent reducer 'nonexistent_reducer_xyz' with clear server error`
  - **Status:** RED - error-helpers.ts not created yet
  - **Verifies:** Call `executeReducer()` with `'nonexistent_reducer_xyz'` and empty BSATN args. Server returns error. `assertReducerError()` returns structured error info with `errorMessage` containing reducer identification.

- **Test:** `[P1] should reject plausible typo reducer 'synchronize_time_typo' with clear error`
  - **Status:** RED - assertReducerError() not created
  - **Verifies:** Plausible typo produces the same clear error pattern as completely unknown reducer.

- **Test:** `[P0] should verify player_state and signed_in_player_state unchanged after non-existent reducer call`
  - **Status:** RED - assertStateUnchanged() not created
  - **Verifies:** `assertStateUnchanged()` confirms no mutations to player tables. Uses snapshot comparison before/after error.

- **Test:** `[P0] should reject empty string reducer name before reaching server (client-side validation)`
  - **Status:** RED - executeReducer() already has this validation but test not written
  - **Verifies:** `executeReducer()` with `''` throws error with message about invalid reducer name (regex validation). Does not require Docker but tested inline for grouping.

- **Test:** `[P0] should reject oversized reducer name (65 chars) before reaching server (client-side validation)`
  - **Status:** RED - test not written
  - **Verifies:** `executeReducer()` with `'a'.repeat(65)` throws error about exceeding 64-char limit.

- **Test:** `[P2] should record error catalog entries for each unknown reducer error scenario`
  - **Status:** RED - recordErrorCatalogEntry() not created
  - **Verifies:** `recordErrorCatalogEntry()` collects structured entries for error catalog compilation.

### Integration Tests (AC2: Invalid Argument Error -- 9 tests)

**describe: Invalid Argument Error Tests (AC2)**

- **Test:** `[P0] should reject sign_in with empty BSATN args (missing arguments)`
  - **Status:** RED - error assertion helpers not created
  - **Verifies:** `sign_in` reducer called with empty buffer. Server error about missing/invalid arguments.

- **Test:** `[P0] should reject player_move with malformed BSATN (wrong byte count)`
  - **Status:** RED - test not written
  - **Verifies:** `player_move` called with 3-byte buffer (insufficient for PlayerMoveRequest). Server error about deserialization failure.

- **Test:** `[P0] should reject extract_start with invalid recipe_id (-999) with 'Recipe not found' error`
  - **Status:** RED - test not written
  - **Verifies:** Game Reference precondition: invalid recipe_id -> "Recipe not found." error.

- **Test:** `[P0] should reject craft_initiate_start with recipe_id=0 (non-existent) with 'Invalid recipe' error`
  - **Status:** RED - test not written
  - **Verifies:** Game Reference precondition: recipe_id=0 -> "Invalid recipe" error.

- **Test:** `[P0] should reject craft_initiate_start with building_entity_id=0 (non-existent) with 'Building doesn't exist' error`
  - **Status:** RED - test not written
  - **Verifies:** Game Reference precondition: building_entity_id=0 -> "Building doesn't exist" error.

- **Test:** `[P0] should reject player_move when player is NOT signed in with 'Not signed in' error`
  - **Status:** RED - test not written
  - **Verifies:** Game Reference precondition: `actor_id(ctx, true)` reducers fail with "Not signed in" when called without sign_in. Connects but skips sign_in step.

- **Test:** `[P0] should reject chat_post_message with empty text with 'Can't send empty chat message' error`
  - **Status:** RED - chat_post_message serialization not added to serializeReducerArgs()
  - **Verifies:** Game Reference precondition: empty text -> "Can't send empty chat message" error. Uses Local channel (channel_id=2) to avoid Region restrictions.

- **Test:** `[P0] should verify no state changes occurred after each invalid argument test via assertStateUnchanged()`
  - **Status:** RED - assertStateUnchanged() not created
  - **Verifies:** Composite assertion: player_state, signed_in_player_state, inventory_state, chat_message_state all unchanged after invalid argument errors.

- **Test:** `[P2] should record error catalog entries for each invalid argument error scenario`
  - **Status:** RED - recordErrorCatalogEntry() not created
  - **Verifies:** Error catalog entries collected for all invalid argument scenarios.

### Unit Tests (AC3: Insufficient Balance / Budget Guard -- 6 tests)

**describe: Insufficient Balance / Budget Guard Tests (AC3)**

- **Test:** `[P0] should create WalletClient with enableStubMode(10000) and verify getBalance() returns 10000`
  - **Status:** RED - test not written for this specific flow
  - **Verifies:** WalletClient stub mode: `enableStubMode(10000)` -> `getBalance()` returns 10000. `BudgetPublishGuard.canAfford('player_move')` returns true when budget >= cost.

- **Test:** `[P0] should return canAfford()=false when BudgetPublishGuard budget limit is lower than action cost`
  - **Status:** RED - test not written
  - **Verifies:** Create BudgetTracker with limit=5, cost lookup returns 10 for 'player_move'. `guard.canAfford('player_move')` returns false.

- **Test:** `[P0] should throw BudgetExceededError with code BUDGET_EXCEEDED when budget exhausted`
  - **Status:** RED - test not written
  - **Verifies:** `BudgetPublishGuard.guard()` throws `BudgetExceededError` with `code === 'BUDGET_EXCEEDED'` when budget is exhausted. Error has `reducer`, `actionCost`, `remaining`, `limit` properties.

- **Test:** `[P0] should verify wallet stub balance unchanged after BudgetExceededError rejection`
  - **Status:** RED - test not written
  - **Verifies:** `getBalance()` before === `getBalance()` after `guard.guard()` throws.

- **Test:** `[P2] should document that real ILP fee collection is deferred to BLOCKER-1 resolution`
  - **Status:** RED - test not written
  - **Verifies:** Documentation test: asserts `BudgetExceededError` code is `'BUDGET_EXCEEDED'` (not `'INSUFFICIENT_BALANCE'`), confirming the stub path is tested, not the real ILP path. Non-placeholder assertion per AGREEMENT-10.

- **Test:** `[P2] should record error catalog entries for insufficient balance / budget exceeded scenarios`
  - **Status:** RED - recordErrorCatalogEntry() not created
  - **Verifies:** Error catalog entries collected for budget guard scenarios.

### Integration Tests (AC4: SpacetimeDB Reconnection -- 7 tests)

**describe: SpacetimeDB Connection Loss and Reconnection Tests (AC4)**

- **Test:** `[P0] should establish connection, subscribe to tables, and sign in player`
  - **Status:** RED - test not written
  - **Verifies:** Baseline: connection established, subscriptions active, player signed in. Prerequisite for pause/unpause tests.

- **Test:** `[P0] should detect disconnection when bitcraft-server container is paused`
  - **Status:** RED - Docker pause integration not implemented
  - **Verifies:** `docker pause sigil-bitcraft-server` triggers WebSocket close event or timeout detection within 15 seconds.

- **Test:** `[P0] should reconnect after bitcraft-server container is unpaused`
  - **Status:** RED - Docker unpause integration not implemented
  - **Verifies:** `docker unpause sigil-bitcraft-server` followed by re-establishing connection. WebSocket client reconnects successfully.

- **Test:** `[P0] should recover subscription state after reconnection`
  - **Status:** RED - reconnection state verification not implemented
  - **Verifies:** After reconnection, `signed_in_player_state` either still has player's entry OR player was auto-logged-out during pause (both are consistent states).

- **Test:** `[P0] should verify no partial state exists after pause/unpause cycle`
  - **Status:** RED - partial state detection not implemented
  - **Verifies:** Game state is either fully consistent (player signed in with all expected table rows) or cleanly reset (player signed out, all sign-in-dependent rows removed). No partial/mixed state.

- **Test:** `[P1] should document reconnection and auto-logout behavior in error catalog`
  - **Status:** RED - error catalog recording not done
  - **Verifies:** Records observed behavior (reconnection time, auto-logout presence/absence) as error catalog entries.

- **Test:** `[P1] should skip connection loss tests gracefully when Docker control commands are unavailable`
  - **Status:** RED - Docker availability guard not implemented
  - **Verifies:** If `docker pause` command fails (CI without Docker control), tests skip with descriptive `it.skip` messages.

### Unit/Documentation Tests (AC5: Crosstown Connection Loss -- 4 tests)

**describe: Crosstown Connection Loss Tests (AC5)**

- **Test:** `[P1] should document Crosstown connection loss testing is DEFERRED per BLOCKER-1 (it.skip)`
  - **Status:** RED - descriptive skipped test not written
  - **Verifies:** Skipped test (with `it.skip` and detailed reason) documenting that Crosstown connection loss cannot be tested via direct WebSocket path.

- **Test:** `[P1] should verify NETWORK_TIMEOUT and NETWORK_ERROR error codes are defined in error-codes.md`
  - **Status:** RED - documentation verification not done
  - **Verifies:** Both `NETWORK_TIMEOUT` and `NETWORK_ERROR` codes exist in `error-codes.md` with boundary `crosstown`.

- **Test:** `[P1] should verify CrosstownAdapter unit tests already cover error mapping (NETWORK_ERROR, NETWORK_TIMEOUT, PUBLISH_FAILED, SIGNING_FAILED, RATE_LIMITED)`
  - **Status:** RED - existing test verification not done
  - **Verifies:** References `crosstown-adapter.test.ts` (Story 2.5). Asserts that error mapping test functions exist (dynamic import verification). Does NOT duplicate tests.

- **Test:** `[P2] should record error catalog entries for Crosstown connection loss scenarios`
  - **Status:** RED - error catalog entries not created
  - **Verifies:** Error catalog entries document expected behavior when BLOCKER-1 is resolved, referencing existing `CrosstownAdapter` test coverage.

### Unit/Infrastructure Tests (AC6: Error Catalog & Reusable Fixtures -- 8 tests)

**describe: Error Catalog and Reusable Fixtures (AC6)**

- **Test:** `[P1] should verify serializeReducerArgs handles chat_post_message with correct BSATN encoding`
  - **Status:** RED - chat_post_message serialization not added
  - **Verifies:** BSATN encoding: 4-byte text length prefix + UTF-8 bytes + 4-byte i32 channel_id + 8-byte u64 target_id + 4-byte language_code length prefix + UTF-8 bytes. Tests with text="hello", channel_id=2 (Local), target_id=0, language_code="en".

- **Test:** `[P1] should verify serializeReducerArgs handles chat_post_message with empty text (0-length string)`
  - **Status:** RED - chat_post_message serialization not added
  - **Verifies:** Empty text serializes correctly: 4-byte length prefix (0x00000000) + no bytes + remaining fields.

- **Test:** `[P0] should verify assertReducerError() returns structured error info`
  - **Status:** RED - assertReducerError() not created
  - **Verifies:** `assertReducerError()` wraps `executeReducer()`, expects failure, returns `{ errorMessage, reducerName }`.

- **Test:** `[P0] should verify assertStateUnchanged() detects state preservation`
  - **Status:** RED - assertStateUnchanged() not created
  - **Verifies:** `assertStateUnchanged()` snapshots table state before action, compares after, confirms identical.

- **Test:** `[P0] should verify assertNoNewRows() correctly times out with no inserts`
  - **Status:** RED - assertNoNewRows() not created
  - **Verifies:** `assertNoNewRows()` uses `waitForTableInsert` with 1000ms timeout. Expects timeout (no insert). Returns success.

- **Test:** `[P0] should verify assertPreconditionError() validates reducer returns specific error message`
  - **Status:** RED - assertPreconditionError() not created
  - **Verifies:** `assertPreconditionError({ testConnection, reducerName, args, expectedErrorSubstring })` wraps executeReducer + error assertion + state-unchanged assertion.

- **Test:** `[P1] should verify all Story 5.8 fixtures are importable from barrel export (index.ts)`
  - **Status:** RED - barrel exports not updated
  - **Verifies:** Dynamic import of `fixtures/index` verifies: `subscribeToStory58Tables`, `STORY_58_TABLES`, `assertReducerError`, `assertStateUnchanged`, `assertNoNewRows`, `assertPreconditionError`, `recordErrorCatalogEntry`, `ErrorCatalogEntry` type. Plus all Story 5.4-5.7 exports still present.

- **Test:** `[P1] should verify subscribeToStory58Tables subscribes to all 9 required tables`
  - **Status:** RED - subscribeToStory58Tables() not created
  - **Verifies:** Creates signed-in player, calls `subscribeToStory58Tables()`, verifies all 9 tables (7 from Story 5.5 + `inventory_state` + `chat_message_state`) are accessible on `connection.db`. Docker-dependent test with proper cleanup.

---

## Data Factories Created

### SpacetimeDB Row Data Factories

This project uses direct SpacetimeDB WebSocket connections without generated bindings. Data is created through reducer calls (server-side), not client-side factories. However, test parameter factories are needed for error scenario setup.

**File:** `packages/client/src/__tests__/integration/fixtures/error-helpers.ts`

**Exports:**

- `ErrorCatalogEntry` interface -- structured type for error catalog entries
- `recordErrorCatalogEntry(entry)` -- collects error catalog entries during test runs
- `getErrorCatalog()` -- retrieves all collected entries
- `assertReducerError(testConnection, reducerName, args)` -- execute reducer expecting failure, return structured error
- `assertStateUnchanged(testConnection, tableNames, entityId?)` -- snapshot comparison before/after
- `assertNoNewRows(testConnection, tableName, timeoutMs?)` -- verify no inserts during time window
- `assertPreconditionError(params)` -- high-level helper combining executeReducer + error assertion + state-unchanged

### Budget Guard Test Factories

No new factories needed -- tests directly instantiate `WalletClient`, `BudgetTracker`, and `BudgetPublishGuard` from `@sigil/client` source.

---

## Fixtures Created

### Error Helpers Fixture (NEW)

**File:** `packages/client/src/__tests__/integration/fixtures/error-helpers.ts`

**Fixtures:**

- `assertReducerError(testConnection, reducerName, ...args)` - Wraps `executeReducer()` and expects it to produce an error. Returns `{ errorMessage: string, reducerName: string }`.
  - **Setup:** Calls executeReducer() which connects to live SpacetimeDB
  - **Provides:** Structured error info from reducer failure
  - **Cleanup:** None (read-only assertion)

- `assertStateUnchanged(testConnection, tableNames, entityId?)` - Snapshots specified table states, executes callback, verifies tables identical after.
  - **Setup:** Queries table states via `queryTableState()`
  - **Provides:** Boolean confirmation that state was preserved
  - **Cleanup:** None (read-only assertion)

- `assertNoNewRows(testConnection, tableName, timeoutMs?)` - Verifies no new rows inserted into a table during a time window.
  - **Setup:** Registers `waitForTableInsert` with short timeout (default 1000ms)
  - **Provides:** Resolves successfully if timeout fires (no insert), rejects if insert detected
  - **Cleanup:** Timeout cleanup

- `assertPreconditionError(params)` - High-level helper combining executeReducer + error assertion + state-unchanged.
  - **Setup:** Takes `{ testConnection, reducerName, args, expectedErrorSubstring }`
  - **Provides:** `{ errorMessage, reducerName, stateUnchanged }` -- error matched and state verified
  - **Cleanup:** None

- `ErrorCatalogEntry` interface - `{ reducerName, errorCode, errorBoundary, messageFormat, systemStateAfter, preconditionViolated }`

- `recordErrorCatalogEntry(entry)` / `getErrorCatalog()` - Collect entries during test runs for error catalog compilation.

### Subscription Helpers Extension

**File:** `packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts` (extended)

**New Exports:**

- `subscribeToStory58Tables(testConnection)` - Subscribe to all 9 tables for Story 5.8 (7 from Story 5.5 + `inventory_state` + `chat_message_state`)
- `STORY_58_TABLES` - Constant array of 2 additional tables beyond Story 5.5

### Test Client Extension

**File:** `packages/client/src/__tests__/integration/fixtures/test-client.ts` (extended)

**New Cases in `serializeReducerArgs()`:**

- `chat_post_message` - PlayerChatPostMessageRequest: `{ text: String, channel_id: ChatChannel(i32), target_id: u64, language_code: String }`. BSATN format: 4-byte text length prefix (u32 LE) + UTF-8 bytes + 4-byte i32 (enum tag, NOT sum type) + 8-byte u64 LE + 4-byte language_code length prefix + UTF-8 bytes.

### Barrel Export Extension

**File:** `packages/client/src/__tests__/integration/fixtures/index.ts` (extended)

**New Exports:**
- `subscribeToStory58Tables`, `STORY_58_TABLES`
- `assertReducerError`, `assertStateUnchanged`, `assertNoNewRows`, `assertPreconditionError`
- `recordErrorCatalogEntry`, `getErrorCatalog`, `ErrorCatalogEntry` type

---

## Mock Requirements

**Integration tests (AC1, AC2, AC4):** No mocks. All tests use real SpacetimeDB server running in Docker.

**Unit tests (AC3):** No mocks needed. Tests directly instantiate `WalletClient`, `BudgetTracker`, `BudgetPublishGuard` from source. `WalletClient.enableStubMode()` provides the test double.

**Unit tests (AC5):** No mocks. References existing `CrosstownAdapter` tests (Story 2.5).

---

## Required data-testid Attributes

**N/A.** This is a backend test story. No UI components, no data-testid attributes.

---

## Implementation Checklist

### Task 1: Error Assertion Fixture Infrastructure (AC: 1, 2, 6)

**File:** `packages/client/src/__tests__/integration/fixtures/error-helpers.ts` (NEW)
**File:** `packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts` (extended)
**File:** `packages/client/src/__tests__/integration/fixtures/test-client.ts` (extended)
**File:** `packages/client/src/__tests__/integration/fixtures/index.ts` (extended)

**Tasks to create fixture infrastructure:**

- [ ] Create `error-helpers.ts` with `ErrorCatalogEntry` interface
- [ ] Create `assertReducerError()` helper wrapping `executeReducer()` expecting error
- [ ] Create `assertStateUnchanged()` helper using `queryTableState()` snapshots
- [ ] Create `assertNoNewRows()` helper using `waitForTableInsert` with short timeout
- [ ] Create `recordErrorCatalogEntry()` and `getErrorCatalog()` collection functions
- [ ] Create `assertPreconditionError()` combining executeReducer + error + state assertions
- [ ] Add `chat_post_message` case to `serializeReducerArgs()` in test-client.ts
- [ ] Create `subscribeToStory58Tables()` in subscription-helpers.ts (9 tables)
- [ ] Create `STORY_58_TABLES` constant in subscription-helpers.ts (2 additional tables)
- [ ] Update `fixtures/index.ts` barrel with all new exports
- [ ] Add JSDoc to all new fixtures

**Estimated Effort:** 3-4 hours

---

### Task 2: Unknown Reducer Error Tests (AC: 1)

**File:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`

**Tasks to make tests pass:**

- [ ] Write test calling executeReducer() with 'nonexistent_reducer_xyz' and verify error
- [ ] Write test calling executeReducer() with 'synchronize_time_typo' and verify error
- [ ] Write test verifying player_state and signed_in_player_state unchanged using assertStateUnchanged()
- [ ] Write test verifying empty string reducer rejected by executeReducer() regex
- [ ] Write test verifying 65-char reducer name rejected by executeReducer() regex
- [ ] Write test recording error catalog entries for unknown reducer scenarios
- [ ] Run tests: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- error-scenarios`

**Estimated Effort:** 2-3 hours

---

### Task 3: Invalid Argument Error Tests (AC: 2)

**File:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`

**Tasks to make tests pass:**

- [ ] Write test: sign_in with empty BSATN args -> error about missing/invalid arguments
- [ ] Write test: player_move with 3-byte buffer -> error about argument deserialization
- [ ] Write test: extract_start with recipe_id=-999 -> "Recipe not found." error
- [ ] Write test: craft_initiate_start with recipe_id=0 -> "Invalid recipe" error
- [ ] Write test: craft_initiate_start with building_entity_id=0 -> "Building doesn't exist" error
- [ ] Write test: player_move without sign_in -> "Not signed in" error
- [ ] Write test: chat_post_message with empty text -> "Can't send empty chat message" error
- [ ] Write test: verify no state changes after each invalid argument test using assertStateUnchanged()
- [ ] Write test: record error catalog entries for invalid argument scenarios
- [ ] Run tests: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- error-scenarios`

**Estimated Effort:** 3-4 hours

---

### Task 4: Insufficient Balance / Budget Guard Unit Tests (AC: 3)

**File:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`

**Tasks to make tests pass:**

- [ ] Write unit test: WalletClient with enableStubMode(10000), getBalance() returns 10000
- [ ] Write unit test: BudgetPublishGuard.canAfford() returns false when budget limit < cost
- [ ] Write unit test: BudgetPublishGuard.guard() throws BudgetExceededError with code BUDGET_EXCEEDED
- [ ] Write unit test: wallet.getBalance() unchanged after BudgetExceededError rejection
- [ ] Write unit test: document real ILP fee deferral (BLOCKER-1) with non-placeholder assertion
- [ ] Write unit test: record error catalog entries for budget exceeded scenarios
- [ ] Run tests: `pnpm --filter @sigil/client test -- error-scenarios`

**Estimated Effort:** 1-2 hours

---

### Task 5: SpacetimeDB Connection Loss and Reconnection Tests (AC: 4)

**File:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`

**Tasks to make tests pass:**

- [ ] Write test: establish connection, subscribe, sign in (baseline)
- [ ] Write test: docker pause sigil-bitcraft-server -> detect disconnection
- [ ] Write test: docker unpause sigil-bitcraft-server -> reconnect
- [ ] Write test: verify subscription state recovered after reconnection
- [ ] Write test: verify no partial state after pause/unpause cycle
- [ ] Write test: document reconnection and auto-logout behavior
- [ ] Write test: skip gracefully when Docker control commands unavailable
- [ ] Implement try/finally pattern for Docker unpause cleanup in afterAll
- [ ] Run tests: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- error-scenarios`

**Critical:** Always unpause in afterAll to prevent leaving Docker broken.

**Estimated Effort:** 3-4 hours

---

### Task 6: Crosstown Connection Loss Documentation Tests (AC: 5)

**File:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`

**Tasks to make tests pass:**

- [ ] Write it.skip test documenting Crosstown loss deferral per BLOCKER-1
- [ ] Write test verifying NETWORK_TIMEOUT and NETWORK_ERROR in error-codes.md
- [ ] Write test verifying CrosstownAdapter unit tests exist (dynamic import verification)
- [ ] Write test recording error catalog entries for Crosstown scenarios
- [ ] Run tests: `pnpm --filter @sigil/client test -- error-scenarios`

**Estimated Effort:** 1 hour

---

### Task 7: Error Catalog Compilation and Game Reference Update (AC: 6)

**File:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`
**File:** `_bmad-output/planning-artifacts/bitcraft-game-reference.md` (appendix)

**Tasks:**

- [ ] Compile all ErrorCatalogEntry entries from Tasks 2-6
- [ ] Create error catalog appendix content for BitCraft Game Reference
- [ ] Cross-reference with Precondition Quick Reference
- [ ] Verify assertPreconditionError() helper works as documented
- [ ] Run all tests to verify complete error catalog coverage

**Estimated Effort:** 2-3 hours

---

### Task 8: Fixture Verification and Infrastructure Tests (AC: 6)

**File:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`

**Tasks:**

- [ ] Write test: chat_post_message BSATN serialization correctness
- [ ] Write test: chat_post_message with empty text BSATN correctness
- [ ] Write test: assertReducerError() returns structured error info
- [ ] Write test: assertStateUnchanged() detects state preservation
- [ ] Write test: assertNoNewRows() times out correctly
- [ ] Write test: assertPreconditionError() validates error message
- [ ] Write test: barrel export verification (all Story 5.8 exports present)
- [ ] Write test: subscribeToStory58Tables subscribes to all 9 tables
- [ ] Run tests: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- error-scenarios`

**Estimated Effort:** 2-3 hours

---

### Task 9: Regression Verification and Cleanup (AC: All)

**Tasks:**

- [ ] Run Story 5.4 tests: `pnpm --filter @sigil/client test -- action-round-trip`
- [ ] Run Story 5.5 tests: `pnpm --filter @sigil/client test -- player-lifecycle-movement`
- [ ] Run Story 5.6 tests: `pnpm --filter @sigil/client test -- resource-gathering-inventory`
- [ ] Run Story 5.7 tests: `pnpm --filter @sigil/client test -- crafting-loop`
- [ ] Verify no hardcoded secrets in test files
- [ ] Verify all table/column references match Game Reference nomenclature
- [ ] Verify named delay constants used for all setTimeout values
- [ ] Verify SpacetimeDBRow type alias used instead of inline any
- [ ] Verify Docker containers always unpaused in cleanup
- [ ] Run full unit test suite: `pnpm --filter @sigil/client test:unit`

**Estimated Effort:** 1-2 hours

---

## Running Tests

```bash
# Run all Story 5.8 tests (integration tests require Docker)
RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- error-scenarios

# Run specific test file
RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- src/__tests__/integration/error-scenarios.test.ts

# Run tests with verbose output
RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- error-scenarios --reporter=verbose

# Run unit-only tests (AC3, AC5 -- no Docker needed)
pnpm --filter @sigil/client test -- error-scenarios

# Run all integration tests (Stories 5.4-5.8)
RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- src/__tests__/integration/

# Run tests with coverage
RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- error-scenarios --coverage

# Regression: run all prior story tests
RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip player-lifecycle-movement resource-gathering-inventory crafting-loop
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 40 tests designed and documented with real assertions
- Fixture architecture designed (error-helpers.ts, subscription extension, serialization extension)
- BSATN serialization format documented (chat_post_message: String + i32 enum + u64 + String)
- Error category taxonomy defined (5 categories, 3 testable immediately, 1 via Docker, 1 deferred)
- Implementation checklist created with 9 task breakdowns
- Two test levels documented (integration + unit) with rationale

**Verification:**

- All tests will fail because error fixtures (error-helpers.ts) do not exist yet
- All tests will fail because chat_post_message serialization not added to serializeReducerArgs()
- All tests will fail because subscribeToStory58Tables() not created yet
- Unit tests (AC3) will fail because specific wallet/budget test assertions not written
- Docker pause/unpause tests (AC4) will fail because Docker control integration not implemented
- Failure messages will be clear: missing imports, undefined functions, missing serialization cases

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with Task 1 (fixture infrastructure):** Create error-helpers.ts, extend subscription-helpers.ts, extend test-client.ts, update barrel
2. **Then Task 2 (unknown reducer):** Write AC1 integration tests
3. **Then Task 3 (invalid arguments):** Write AC2 integration tests
4. **Then Task 4 (budget guard):** Write AC3 unit tests
5. **Then Task 5 (reconnection):** Write AC4 integration tests with Docker pause/unpause
6. **Then Task 6 (Crosstown):** Write AC5 documentation tests
7. **Then Task 7 (error catalog):** Compile catalog and update Game Reference
8. **Then Task 8 (fixture verification):** Write AC6 infrastructure tests
9. **Finally Task 9 (regression):** Verify no breakage

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap
- Follow existing Story 5.4-5.7 patterns exactly
- CRITICAL: Docker pause/unpause must always unpause in afterAll (try/finally)

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all tests pass (green phase complete)
2. Review code for quality (readability, maintainability)
3. Extract duplications (DRY principle)
4. Ensure tests still pass after each refactor
5. Update documentation if needed

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Don't change test behavior (only implementation)

---

## BSATN Serialization Reference

### PlayerChatPostMessageRequest

| Field | Type | Size | Encoding | Notes |
|---|---|---|---|---|
| text | String | 4 + len bytes | u32 LE length prefix + UTF-8 bytes | Message text |
| channel_id | ChatChannel (i32) | 4 bytes | i32 LE (plain enum, NOT sum type) | Use Local=2 for testing |
| target_id | u64 | 8 bytes | u64 LE | Target entity (0 for broadcast) |
| language_code | String | 4 + len bytes | u32 LE length prefix + UTF-8 bytes | Use "en" for testing |

**IMPORTANT:** `ChatChannel` is `#[repr(i32)]` -- serializes as plain i32, NOT BSATN sum type tag.

**ChatChannel enum values (BSATN i32):**
| Value | Variant | Recommended for Testing |
|-------|---------|------------------------|
| 0 | System | No |
| 1 | Global | No |
| 2 | Local | YES (avoids Region restrictions) |
| 3 | Region | No (2hr play time, username, rate limit) |

**Example encoding for text="hello", channel_id=2, target_id=0, language_code="en":**
```
05 00 00 00   -- text length: 5 (u32 LE)
68 65 6C 6C 6F -- "hello" UTF-8
02 00 00 00   -- channel_id: 2 (i32 LE, Local)
00 00 00 00 00 00 00 00 -- target_id: 0 (u64 LE)
02 00 00 00   -- language_code length: 2 (u32 LE)
65 6E         -- "en" UTF-8
```
Total: 4+5+4+8+4+2 = 27 bytes for this example.

---

## Subscription Requirements (9 Tables)

| # | Table | Purpose | From Story |
|---|---|---|---|
| 1 | `user_state` | Identity -> entity_id mapping, reconnection verification | 5.4 |
| 2 | `player_state` | Player profile, signed_in status | 5.4 |
| 3 | `signed_in_player_state` | Sign-in state, reconnection recovery | 5.4 |
| 4 | `mobile_entity_state` | Position, state consistency checks | 5.5 |
| 5 | `health_state` | Player health, state consistency | 5.5 |
| 6 | `stamina_state` | Stamina, state consistency | 5.5 |
| 7 | `player_action_state` | Current action type | 5.5 |
| 8 | `inventory_state` | State-unchanged verification after errors | **5.8 NEW** |
| 9 | `chat_message_state` | Chat error tests (empty text) | **5.8 NEW** |

---

## Timing Constants

| Constant | Value | Purpose |
|---|---|---|
| `DOCKER_PAUSE_DURATION_MS` | 5000 | Duration to keep bitcraft-server paused (5s; short to avoid auto-logout) |
| `DOCKER_UNPAUSE_RECONNECT_TIMEOUT_MS` | 30000 | Maximum time to wait for reconnection after unpause |
| `POST_ERROR_STATE_CHECK_DELAY_MS` | 500 | Delay after error before checking state unchanged |
| `ASSERT_NO_NEW_ROWS_TIMEOUT_MS` | 1000 | Short timeout for assertNoNewRows (expect no insert) |
| `ERROR_SCENARIO_SUBSCRIPTION_TIMEOUT_MS` | 5000 | Timeout for subscription wait operations in error tests |
| `DOCKER_PAUSE_DETECTION_TIMEOUT_MS` | 15000 | Maximum time to detect WebSocket disconnection after docker pause |

---

## Risk Register

| Risk ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R5-001 | BLOCKER-1 identity propagation | HIGH | Bypass BLS handler; use direct WebSocket (same as 5.4-5.7) |
| R5-008 | Connection drops during tests | MEDIUM | Docker pause/unpause with configurable duration. Generous timeout (30s) for reconnection. |
| R5-015 | Subscription timing non-determinism | MEDIUM | Same as 5.4-5.7 -- use waitForTableInsert/waitForTableUpdate with configurable timeout. |
| R5-040 | Docker pause/unpause not available in CI | HIGH | Skip connection loss tests when Docker control commands not available. Document as CI limitation. |
| R5-041 | Auto-logout during pause duration | MEDIUM | Use short pause (5s) to minimize auto-logout risk. Document auto-logout behavior if it occurs. |
| R5-042 | SpacetimeDB SDK reconnection behavior unknown | HIGH | Test must handle both cases: (a) automatic reconnection, (b) manual re-establishment. |
| R5-043 | Container name mismatch | LOW | Verify container name via docker compose ps. Use `sigil-bitcraft-server` per docker-compose.yml. |
| R5-044 | Chat restrictions may block chat_post_message | MEDIUM | Use Local channel (channel_id=2) to avoid Region restrictions. Skip if Local also restricted. |
| R5-045 | Crosstown error path untestable | HIGH | Crosstown errors deferred to BLOCKER-1. Test CrosstownAdapter error mapping via existing unit tests. |

---

## Docker Pause/Unpause Pattern

```typescript
// CRITICAL: Always unpause in afterAll to prevent leaving Docker broken
const CONTAINER_NAME = 'sigil-bitcraft-server';

async function dockerPause(): Promise<boolean> {
  try {
    execSync(`docker pause ${CONTAINER_NAME}`, { timeout: 5000 });
    return true;
  } catch {
    return false; // Docker control not available
  }
}

async function dockerUnpause(): Promise<boolean> {
  try {
    execSync(`docker unpause ${CONTAINER_NAME}`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// In test suite:
afterAll(async () => {
  // ALWAYS unpause regardless of test outcome
  try {
    await dockerUnpause();
  } catch {
    console.warn('Failed to unpause Docker container in cleanup');
  }
});
```

---

## Wallet/Budget Test Strategy

```typescript
// AC3 unit test pattern (no Docker needed):
import { WalletClient } from '../../wallet/wallet-client';
import { BudgetTracker } from '../../agent/budget-tracker';
import { BudgetPublishGuard } from '../../agent/budget-publish-guard';
import { BudgetExceededError } from '../../agent/budget-types';

// Test 1: Stub mode balance
const wallet = new WalletClient('http://localhost:4041', '0'.repeat(64));
wallet.enableStubMode(10000);
const balance = await wallet.getBalance(); // 10000

// Test 2: Budget guard canAfford
const tracker = new BudgetTracker({ limit: 5, unit: 'ILP', period: 'session', warningThresholds: [0.8] });
const guard = new BudgetPublishGuard(tracker, () => 10); // cost=10 > limit=5
guard.canAfford('player_move'); // false

// Test 3: Budget guard throws
expect(() => guard.guard('player_move')).toThrow(BudgetExceededError);

// Test 4: Balance unchanged
const balanceBefore = await wallet.getBalance();
try { guard.guard('player_move'); } catch {}
const balanceAfter = await wallet.getBalance();
expect(balanceAfter).toBe(balanceBefore);
```

---

## Error Catalog Appendix Structure

The error catalog appendix for `bitcraft-game-reference.md` will follow this structure:

```markdown
## Appendix: Error Catalog

### Unknown Reducer Errors (AC1)
| Reducer Name | Error Message | Boundary | System State After | Recovery |
|---|---|---|---|---|

### Precondition Violation Errors (AC2)
| Reducer Name | Precondition Violated | Error Message | System State After | Recovery |
|---|---|---|---|---|

### Budget/Wallet Errors (AC3)
| Error Code | Error Type | Message Format | System State After | Recovery |
|---|---|---|---|---|

### Connection Loss Errors (AC4)
| Scenario | Behavior | State After | Recovery |
|---|---|---|---|

### Crosstown Errors (AC5 -- DEFERRED)
| Error Code | Boundary | Expected Message | Expected State After | Notes |
|---|---|---|---|---|
```

---

## Cross-Cutting Concerns

| Concern | Tests | Notes |
|---|---|---|
| Docker graceful skip | 22 integration tests | `describe.skipIf(!runIntegrationTests)` + inner `if (!dockerHealthy)` guard |
| Docker pause/unpause cleanup | AC4 tests | `afterAll` always unpause (try/finally pattern) |
| Docker control availability | AC4 tests | `dockerPause()` returns false if Docker control unavailable -> skip |
| Network-first pattern | AC2 tests | Register subscription listeners before executing reducers for state verification |
| Cleanup/teardown | All describe blocks | Every describe block has `afterEach` calling `teardownPlayer()` or explicit disconnect |
| Named delay constants | All tests | 6 named timing constants with JSDoc |
| SpacetimeDBRow type alias | Integration tests | Single eslint-disable at file level |
| Identity-matched lookups | AC1, AC2 tests | `findByEntityId()` for entity_id-based tables |
| No placeholder assertions | All 40 tests | Real assertions on every test (AGREEMENT-10) |
| No hardcoded secrets | All tests | No SPACETIMEDB_ADMIN_TOKEN in test code |
| Error message verification | AC1, AC2 tests | Case-insensitive substring/regex match for error messages |
| State immutability on failure | AC1, AC2, AC3 tests | assertStateUnchanged() and inventory comparison |
| Table names match Game Reference | All tests | Exact names from Game Reference |

---

## Test Count Summary

| AC | Test Category | Test Level | Count | Priority |
|----|---|---|---|---|
| AC1 | Unknown reducer errors | Integration | 6 | 3x P0, 1x P1, 2x P2 |
| AC2 | Invalid argument errors | Integration | 9 | 7x P0, 0x P1, 2x P2 |
| AC3 | Budget/wallet errors | Unit | 6 | 4x P0, 0x P1, 2x P2 |
| AC4 | Reconnection tests | Integration | 7 | 5x P0, 2x P1 |
| AC5 | Crosstown loss (deferred) | Unit | 4 | 0x P0, 3x P1, 1x P2 |
| AC6 | Fixtures & catalog | Mixed | 8 | 4x P0, 4x P1 |
| **Total** | | | **40** | **23x P0, 10x P1, 7x P2** |

---

## Validation Checklist (Step 5)

- [x] Story approved with clear acceptance criteria (6 ACs in Given/When/Then)
- [x] Test framework configured (vitest.config.ts)
- [x] All acceptance criteria mapped to test scenarios (40 tests across 6 ACs)
- [x] Test level selection: Integration (AC1, AC2, AC4) + Unit (AC3, AC5) + Mixed (AC6)
- [x] Priority assignment: 23x P0, 10x P1, 7x P2
- [x] Tests designed to fail before implementation (RED phase)
- [x] Fixture architecture designed (1 new file + 3 extensions)
- [x] BSATN serialization format documented (chat_post_message)
- [x] Error category taxonomy documented (5 categories)
- [x] Docker pause/unpause pattern documented with cleanup requirements
- [x] Wallet/budget unit test pattern documented
- [x] Error catalog appendix structure defined
- [x] Implementation checklist created with 9 task breakdowns
- [x] Execution commands provided and documented
- [x] Red-green-refactor workflow documented
- [x] No placeholder assertions (AGREEMENT-10)
- [x] No duplicate coverage across test levels
- [x] Risk register populated with 9 risks
- [x] Timing constants defined with rationale (6 constants)
- [x] Knowledge base references documented
- [x] Cross-cutting concerns documented (13 concerns)
- [x] Regression verification plan included (Task 9)

---

## Notes

- This is the FINAL validation story in Epic 5, focusing on ERROR PATHS rather than happy paths.
- Two test levels are used: integration (AC1, AC2, AC4 requiring Docker) and unit (AC3, AC5 client-side logic).
- AC5 (Crosstown connection loss) is DEFERRED per BLOCKER-1 with documentation and existing test reference.
- Docker pause/unpause (AC4) requires Docker socket access. CI environments without Docker control skip gracefully.
- CRITICAL: Docker containers must ALWAYS be unpaused in afterAll cleanup (try/finally pattern) to prevent test suite from leaving Docker broken.
- Error catalog entries are collected during test runs and compiled into a BitCraft Game Reference appendix.
- Reusable error assertion fixtures (`assertReducerError`, `assertStateUnchanged`, `assertNoNewRows`, `assertPreconditionError`) are the key deliverables for future epics.
- BLOCKER-1 bypass: all integration tests use direct SpacetimeDB WebSocket connection, NOT `client.publish()`.
- Wallet/budget tests use `BudgetPublishGuard.guard()` and `BudgetExceededError`, NOT `SigilError` with `INSUFFICIENT_BALANCE`.
- Chat error tests use Local channel (channel_id=2) to avoid Region chat restrictions.
- The "Not signed in" test (AC2) requires connecting WITHOUT calling sign_in -- this tests from a different connection state than all other tests.
- The `assertPreconditionError()` fixture is the most reusable deliverable: it combines executeReducer + error assertion + state-unchanged into a single call for future test reuse across Epics 6-13.
- Total planned tests (40) exceeds the test design document estimate (~35) due to additional fixture verification and BSATN serialization tests, consistent with the Story 5.6 and 5.7 pattern of adding infrastructure verification tests.

---

**Generated by BMad TEA Agent** - 2026-03-16
