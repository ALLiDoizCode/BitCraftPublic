# Story 5.8: Error Scenarios & Graceful Degradation

Status: pending

<!--
Validation Status: VALIDATED
Review Type: Adversarial Review via /bmad-review-adversarial-general (2026-03-16)
Reviewer: Claude Opus 4.6
BMAD Standards Compliance: VERIFIED (2026-03-16)
- Story structure: Complete (all required sections present, including Change Log, Code Review Record, Verification Steps, Definition of Done, and Dev Agent Record templates)
- Acceptance criteria: 6 ACs with Given/When/Then format, FR/NFR traceability tags on each AC header
- Task breakdown: 9 tasks with detailed subtasks, AC mapping on each task header
- FR traceability: FR17 -> AC1, AC2; FR20, FR21 -> AC3; NFR24 -> AC3, AC4, AC5; NFR27 -> AC1, AC2, AC6
- Dependencies: Documented (4 epics + 7 stories required complete, 3 external, 0 stories blocked)
- Technical design: Comprehensive with BLOCKER-1 bypass rationale, error category taxonomy, reconnection simulation, BSATN serialization for chat_post_message, precondition error catalog, reusable error assertion fixtures
- Security review: OWASP Top 10 coverage complete (all 10 categories assessed)
- Epics.md deviations: 6 documented (BLOCKER-1 direct WebSocket bypass, entity_id chain vs Nostr identity, wallet stub mode, SigilError type unavailable via direct WebSocket, Crosstown connection loss not testable via direct WebSocket, BudgetExceededError vs INSUFFICIENT_BALANCE)
Issues Found & Fixed: 9 (adversarial review, see Change Log 2026-03-16 entry)
Ready for Implementation: YES
-->

## Story

As a developer,
I want to validate that error scenarios (invalid actions, insufficient balance, disconnections) are handled gracefully through the full pipeline,
So that we have confidence the system fails safely and provides actionable error information.

## Dependencies

**Required Complete (all done):**

- **Epic 1** (Project Foundation) -- monorepo structure, SpacetimeDB connection, Docker environment, auto-reconnection (Story 1.6)
- **Epic 2** (Action Execution & Payment Pipeline) -- publish pipeline, BLS handler contract spec, error codes (`SigilError`)
- **Epic 3** (BitCraft BLS Game Action Handler) -- BLS handler, identity propagation analysis, ILP error codes (F06, T00, F04, F00)
- **Epic 4** (Declarative Agent Configuration) -- skill file format, config validation, event interpreter
- **Story 5.1** (Server Source Analysis & Reducer Catalog) -- 669 reducers cataloged, BitCraft Game Reference
- **Story 5.2** (Game State Model & Table Relationships) -- 138 entity tables, 80 FK relationships
- **Story 5.3** (Game Loop Mapping & Precondition Documentation) -- 9 game loops with preconditions, Precondition Quick Reference
- **Story 5.4** (Basic Action Round-Trip Validation) -- reusable test fixtures, Docker health check, SpacetimeDB connection helpers, subscription helpers, `executeReducer()`, `serializeReducerArgs()`, `verifyStateChange()`
- **Story 5.5** (Player Lifecycle & Movement Validation) -- `setupSignedInPlayer()`, `teardownPlayer()`, movement fixtures, `waitForTableUpdate()`, `subscribeToStory55Tables()`, `PlayerMoveRequest` BSATN serialization
- **Story 5.6** (Resource Gathering & Inventory Validation) -- `findGatherableResource()`, `executeExtraction()`, `verifyInventoryContains()`, extraction progressive action pattern
- **Story 5.7** (Multi-Step Crafting Loop Validation) -- `findCraftingBuilding()`, `executeCraftingLoop()`, `verifyMaterialsConsumed()`, `verifyCraftedItemReceived()`, crafting progressive action pattern, crafting error patterns

**External Dependencies:**

- Docker stack: 3 services (bitcraft-server, crosstown-node, bitcraft-bls) running and healthy
- BitCraft Game Reference: `_bmad-output/planning-artifacts/bitcraft-game-reference.md` (authoritative reference, especially Precondition Quick Reference)
- SpacetimeDB WebSocket access: `ws://localhost:3000` (direct connection)

**Blocks:**

- None (final story in Epic 5)

## Acceptance Criteria

1. **Unknown reducer rejection with clear error (AC1)** (FR17, NFR27)
   **Given** a `client.publish()` call with a non-existent reducer name (via direct WebSocket per BLOCKER-1)
   **When** the action is submitted through the pipeline
   **Then** the server rejects the action with a clear error identifying the unknown reducer
   **And** a reducer error is returned to the client with appropriate error information
   **And** no SpacetimeDB state changes occur

2. **Invalid argument rejection with actionable error (AC2)** (FR17, NFR27)
   **Given** a `client.publish()` call with invalid argument types or count (via direct WebSocket per BLOCKER-1)
   **When** the action reaches the server
   **Then** the action is rejected with an error identifying the argument mismatch
   **And** the error message is actionable (expected types vs. provided types)

3. **Insufficient balance pre-flight rejection (AC3)** (FR20, FR21, NFR24)
   **Given** a wallet with insufficient balance for an action (via wallet stub mode per DEBT-5)
   **When** the budget guard is invoked to enforce budget limits
   **Then** the action is rejected with a `BudgetExceededError` (code: `BUDGET_EXCEEDED`) from `BudgetPublishGuard.guard()` -- see Epics.md Deviation #6 for why this is `BudgetExceededError` instead of `INSUFFICIENT_BALANCE` SigilError
   **And** no SpacetimeDB reducer call is made
   **And** the wallet balance remains unchanged

4. **SpacetimeDB reconnection with state recovery (AC4)** (NFR24)
   **Given** a valid action in progress (signed-in player with established subscriptions)
   **When** the SpacetimeDB connection is lost and reconnects (simulated via Docker pause/unpause)
   **Then** the subscription state recovers correctly after reconnection
   **And** the game state is consistent -- either the action completed (state changed) or it didn't (no partial state)

5. **Crosstown connection loss handling (AC5)** (NFR24)
   **Given** a valid action in progress
   **When** the Crosstown connection is lost (simulated)
   **Then** the client receives a `NETWORK_TIMEOUT` or `NETWORK_ERROR` with boundary `crosstown`
   **And** the system does not leave an inconsistent state (NFR24)

6. **Error catalog documentation and reusable fixtures (AC6)** (NFR27)
   **Given** all error scenario tests
   **When** they pass
   **Then** each error case documents: the error code, boundary, message format, and system state after the error
   **And** the error catalog is added to the BitCraft Game Reference as an appendix
   **And** reusable error assertion fixtures are produced for all future integration tests

## Tasks / Subtasks

### Task 1: Extend Test Fixtures for Error Scenario Subscriptions and Reducers (AC: 1, 2, 6)

- [ ] 1.1 Create `subscribeToStory58Tables()` helper in `subscription-helpers.ts` that subscribes to the tables required for Story 5.8: all 7 from Story 5.5 (`user_state`, `player_state`, `signed_in_player_state`, `mobile_entity_state`, `health_state`, `stamina_state`, `player_action_state`) PLUS `inventory_state`, `chat_message_state`
- [ ] 1.2 Add `chat_post_message` case to `serializeReducerArgs()` in `test-client.ts`: `PlayerChatPostMessageRequest { text: String, channel_id: ChatChannel(i32), target_id: u64, language_code: String }` -- BSATN format: 4-byte text length prefix + UTF-8 bytes + 4-byte i32 enum tag + 8-byte u64 + 4-byte language_code length prefix + UTF-8 bytes
- [ ] 1.3 Create `STORY_58_TABLES` constant array in `subscription-helpers.ts` listing the 2 additional tables beyond Story 5.5: `inventory_state`, `chat_message_state`
- [ ] 1.4 Export all new helpers from `fixtures/index.ts` barrel

### Task 2: Create Error Assertion Fixture Helpers (AC: 1, 2, 6)

- [ ] 2.1 Create new file `fixtures/error-helpers.ts` with `assertReducerError()` helper that wraps `executeReducer()` and expects it to produce an error (either thrown exception or error in reducer event). Return structured error info: `{ errorMessage: string, reducerName: string }`.
- [ ] 2.2 Create `assertStateUnchanged()` helper that takes a snapshot of specified table states before an action and verifies they are identical after the action. Accept table names and optional entity_id filter.
- [ ] 2.3 Create `assertNoNewRows()` helper that verifies no new rows were inserted into a specified table during a time window. Uses `waitForTableInsert` with a short timeout (1000ms) and expects the timeout to trigger (no insert).
- [ ] 2.4 Create `ErrorCatalogEntry` interface: `{ reducerName: string, errorCode: string, errorBoundary: string, messageFormat: string, systemStateAfter: string, preconditionViolated: string }`. Create `recordErrorCatalogEntry()` function that collects entries during test runs.
- [ ] 2.5 Export all error helpers from `fixtures/index.ts` barrel

### Task 3: Unknown Reducer Error Tests (AC: 1)

- [ ] 3.1 Write integration test: call `executeReducer()` with `reducer = 'nonexistent_reducer_xyz'` and valid BSATN args (empty buffer), verify the server returns an error (the reducer does not exist)
- [ ] 3.2 Write integration test: call `executeReducer()` with `reducer = 'synchronize_time_typo'` (plausible typo of a real reducer), verify a clear error is returned
- [ ] 3.3 Write integration test: after calling a non-existent reducer, verify `player_state` and `signed_in_player_state` are unchanged using `assertStateUnchanged()`
- [ ] 3.4 Write integration test: call `executeReducer()` with `reducer = ''` (empty string), verify the `executeReducer` input validation rejects it before reaching the server (regex validation in `executeReducer`)
- [ ] 3.5 Write integration test: call `executeReducer()` with `reducer = 'a'.repeat(65)` (65 chars, exceeding 64-char limit), verify the `executeReducer` input validation rejects it
- [ ] 3.6 Write integration test: record error catalog entries for each unknown reducer error scenario using `recordErrorCatalogEntry()`

### Task 4: Invalid Argument Error Tests (AC: 2)

- [ ] 4.1 Write integration test: call `sign_in` reducer with no BSATN args (empty buffer), verify error about missing/invalid arguments
- [ ] 4.2 Write integration test: call `player_move` reducer with malformed BSATN (wrong byte count), verify error about argument deserialization
- [ ] 4.3 Write integration test: call `extract_start` with an invalid `recipe_id` (e.g., -999 or 999999), verify "Recipe not found." error per Game Reference preconditions
- [ ] 4.4 Write integration test: call `craft_initiate_start` with `recipe_id = 0` (non-existent), verify "Invalid recipe" error per Game Reference preconditions
- [ ] 4.5 Write integration test: call `craft_initiate_start` with `building_entity_id = 0` (non-existent), verify "Building doesn't exist" error per Game Reference preconditions
- [ ] 4.6 Write integration test: call `player_move` with the player NOT signed in (connect but skip `sign_in`), verify "Not signed in" error per Game Reference preconditions
- [ ] 4.7 Write integration test: call `chat_post_message` with empty text, verify "Can't send empty chat message" error per Game Reference preconditions
- [ ] 4.8 Write integration test: after each invalid argument test, verify no state changes occurred using `assertStateUnchanged()`
- [ ] 4.9 Write integration test: record error catalog entries for each invalid argument error scenario

### Task 5: Insufficient Balance / Wallet Stub Mode Tests (AC: 3)

- [ ] 5.1 Write unit test: create a `WalletClient` with `enableStubMode(10000)`, call `getBalance()` and verify it returns 10000. Create a `BudgetPublishGuard` with a cost lookup, verify `guard.canAfford('player_move')` returns `true` when remaining budget >= cost
- [ ] 5.2 Write unit test: create a `BudgetPublishGuard` with limit lower than action cost, verify `guard.canAfford('player_move')` returns `false` when remaining budget < cost
- [ ] 5.3 Write unit test: verify `BudgetPublishGuard.guard()` (from Epic 4) throws `BudgetExceededError` (code: `BUDGET_EXCEEDED`) when budget is exhausted, without calling the reducer. Note: `BudgetPublishGuard` throws `BudgetExceededError`, NOT `SigilError` with code `INSUFFICIENT_BALANCE` -- see Epics.md Deviation #6.
- [ ] 5.4 Write unit test: verify wallet stub balance is unchanged after a `BudgetExceededError` rejection (query `getBalance()` before and after `guard.guard()` throws)
- [ ] 5.5 Write unit test: document that real ILP fee collection and `INSUFFICIENT_BALANCE` errors (SigilError with boundary `crosstown`) through the full Crosstown/BLS pipeline are deferred to BLOCKER-1 resolution. This test validates the stub accounting path only. The `client.publish.canAfford()` method (which combines `WalletClient.getBalance()` + `ActionCostRegistry.getCost()`) is the full-pipeline affordability check; `BudgetPublishGuard.canAfford()` is the agent-side budget check.
- [ ] 5.6 Write unit test: record error catalog entries for insufficient balance / budget exceeded scenarios

### Task 6: SpacetimeDB Connection Loss and Reconnection Tests (AC: 4)

- [ ] 6.1 Write integration test: establish a SpacetimeDB WebSocket connection, subscribe to tables, sign in player. Verify initial subscription state is correct.
- [ ] 6.2 Write integration test: simulate SpacetimeDB connection loss by calling `docker pause` on the bitcraft-server container (via `child_process.exec`). Verify the client detects the disconnection (WebSocket close event or timeout).
- [ ] 6.3 Write integration test: after pausing, call `docker unpause` on the bitcraft-server container. Verify the WebSocket client reconnects (either automatically via SDK or manually by re-establishing the connection).
- [ ] 6.4 Write integration test: after reconnection, verify subscription state is recovered -- `signed_in_player_state` still has the player's entry (or the player was auto-logged-out during the pause, which is also consistent behavior).
- [ ] 6.5 Write integration test: verify that no partial state exists after the pause/unpause cycle -- the game state is either fully consistent (player signed in with all expected table rows) or cleanly reset (player signed out, all sign-in-dependent rows removed).
- [ ] 6.6 Write integration test: document the reconnection behavior and any auto-logout behavior in the error catalog. Note: the bitcraft-server's `auto_logout_loop` agent may sign out the player during a pause if the pause exceeds the auto-logout threshold.
- [ ] 6.7 Add guard: if `docker pause`/`docker unpause` commands are not available (CI environment without Docker control), skip these tests gracefully with descriptive messages.

### Task 7: Crosstown Connection Loss Tests (AC: 5)

- [ ] 7.1 Write test: document that Crosstown connection loss testing is DEFERRED per BLOCKER-1. The direct WebSocket path used in Stories 5.4-5.8 does not go through Crosstown, so Crosstown connection loss cannot be tested in this path. Create a descriptive skipped test (with `it.skip` and reason) documenting the deferral.
- [ ] 7.2 Verify (manual/code review): confirm that `NETWORK_TIMEOUT` and `NETWORK_ERROR` error codes are correctly defined in `packages/client/src/errors/error-codes.md` with boundary `crosstown`. This is a documentation verification, not a runtime test. Note findings in the error catalog.
- [ ] 7.3 Verify existing unit tests: confirm that `packages/client/src/crosstown/crosstown-adapter.test.ts` already contains unit tests for `CrosstownAdapter` error mapping (NETWORK_ERROR, NETWORK_TIMEOUT, PUBLISH_FAILED, SIGNING_FAILED, RATE_LIMITED codes with correct boundaries). These tests already exist from Story 2.5 -- do NOT duplicate them. Reference the existing test file in the error catalog to demonstrate coverage. If any error mapping case is missing from the existing tests, add it.
- [ ] 7.4 Record error catalog entries for Crosstown connection loss scenarios (documenting the expected behavior when BLOCKER-1 is resolved), referencing the existing `CrosstownAdapter` unit test coverage

### Task 8: Error Catalog Compilation and Game Reference Update (AC: 6)

- [ ] 8.1 Compile all `ErrorCatalogEntry` entries collected during Task 3-7 test execution into a structured error catalog
- [ ] 8.2 Create error catalog appendix content for the BitCraft Game Reference at `_bmad-output/planning-artifacts/bitcraft-game-reference.md`: document each error scenario with reducer name, error code/message, boundary, system state after error, and recovery guidance
- [ ] 8.3 Cross-reference error catalog with the existing Precondition Quick Reference in the Game Reference -- verify all testable precondition errors are covered
- [ ] 8.4 Create `assertPreconditionError()` reusable fixture helper that validates a reducer returns a specific precondition error message. Accept: `{ testConnection, reducerName, args, expectedErrorSubstring }`. This helper wraps `executeReducer()` + error assertion + state-unchanged assertion into a single call for future test reuse.
- [ ] 8.5 Export `assertPreconditionError()` from `fixtures/index.ts`

### Task 9: Fixture Documentation and Barrel Export Updates (AC: 6)

- [ ] 9.1 Add JSDoc to all new fixtures documenting usage for future epics (especially Epic 6 MCP server error handling)
- [ ] 9.2 Update `fixtures/index.ts` barrel with all new exports: `subscribeToStory58Tables`, `STORY_58_TABLES`, `assertReducerError`, `assertStateUnchanged`, `assertNoNewRows`, `recordErrorCatalogEntry`, `assertPreconditionError`, types
- [ ] 9.3 Document the chat_post_message BSATN serialization format (`PlayerChatPostMessageRequest` with `ChatChannel` i32 enum) in code comments
- [ ] 9.4 Ensure all fixtures support `beforeEach`/`afterEach` lifecycle management (connect before, sign in, disconnect after)
- [ ] 9.5 Verify all Story 5.4-5.7 tests still pass (no regressions from fixture file modifications)

## Dev Notes

### Story Nature: Validation with Docker Integration (Code Delivery)

This is the FIFTH and FINAL validation story in Epic 5. Unlike Stories 5.5-5.7 which tested happy-path gameplay (movement, gathering, crafting), Story 5.8 focuses on ERROR PATHS: what happens when things go wrong. The key deliverables are: (1) integration tests proving error scenarios are handled gracefully, (2) a comprehensive error catalog documenting all tested error cases, (3) reusable error assertion fixtures for future epics.

### CRITICAL: BLOCKER-1 -- Bypass BLS Handler, Use Direct WebSocket

Same as Stories 5.4-5.7: call reducers DIRECTLY via SpacetimeDB WebSocket client. Do NOT use `client.publish()`. The SpacetimeDB SDK connects with a unique identity, and `ctx.sender` correctly identifies the calling player. This bypasses the BLS handler entirely.

**Impact on Story 5.8 specifically:**
- AC1 (unknown reducer): Tests the SpacetimeDB server's error response, NOT the BLS handler's `UNKNOWN_REDUCER` error code. The epics.md AC says "BLS rejects" but since we bypass BLS, we test the SpacetimeDB server's own rejection.
- AC2 (invalid args): Same -- SpacetimeDB server error, not BLS `INVALID_CONTENT` (F06).
- AC3 (insufficient balance): Tested via wallet stub mode (DEBT-5) and BudgetPublishGuard (Epic 4), NOT via real ILP fee enforcement through Crosstown/BLS.
- AC5 (Crosstown loss): Cannot be tested via direct WebSocket path. DEFERRED with documentation.
- AC1/AC2 errors will NOT be `SigilError` instances -- they will be SpacetimeDB reducer error strings.

### Error Category Taxonomy

Story 5.8 tests errors across 4 categories:

| Category | Source | Error Type | Testable? |
|----------|--------|-----------|-----------|
| **Unknown reducer** | SpacetimeDB server | Reducer not found error | YES (direct WebSocket) |
| **Invalid arguments** | SpacetimeDB server / BitCraft reducer preconditions | Deserialization error or precondition violation | YES (direct WebSocket) |
| **Insufficient balance** | Client-side wallet / budget guard | Pre-flight rejection | YES (wallet stub mode + BudgetPublishGuard) |
| **Connection loss (SpacetimeDB)** | WebSocket disconnection | Connection drop / reconnection | YES (Docker pause/unpause) |
| **Connection loss (Crosstown)** | Crosstown adapter | NETWORK_TIMEOUT / NETWORK_ERROR | DEFERRED (BLOCKER-1) |

### Precondition Error Messages (from Game Reference)

The Precondition Quick Reference maps 30+ common preconditions to error messages. Key ones for Story 5.8:

| Precondition Violated | Error Message | Reducer(s) | Test Category |
|----------------------|---------------|-------------|---------------|
| Player not signed in | `"Not signed in"` | All `actor_id(ctx, true)` reducers | AC2 (invalid state) |
| Invalid recipe ID | `"Invalid recipe"` (craft) / `"Recipe not found."` (extract) | `craft_initiate_start`, `extract_start` | AC2 (invalid args) |
| Building doesn't exist | `"Building doesn't exist"` | `craft_initiate_start` | AC2 (invalid args) |
| Empty chat message | `"Can't send empty chat message"` | `chat_post_message` | AC2 (invalid args) |
| Resource depleted | `"Deposit already depleted."` | `extract_start` | AC2 (invalid state) |

### Chat System as Error Scenario Test Vehicle

The Game Reference classifies Chat as "5.8 (simple)" -- a single-reducer system ideal for testing error scenarios because:
1. `chat_post_message` has clear, well-documented preconditions
2. It produces a single table insert (`chat_message_state`)
3. Multiple error paths: empty text, rate limiting, moderation, channel validation
4. No complex state dependencies (unlike crafting's multi-table chain)

**ChatChannel enum values (BSATN i32):**
| Value | Variant | Notes |
|-------|---------|-------|
| 0 | System | System messages |
| 1 | Global | Not used |
| 2 | Local | Local chat |
| 3 | Region | General chat (has restrictions: 2hr play time, username set, rate limit) |
| 4 | Claim | Not used |
| 5 | EmpirePublic | Not used |
| 6 | EmpireInternal | Not used |
| 7 | LookingForGroup | LFG channel |
| 8 | Trade | Trade channel |

**Recommended for testing:** Use `Local` (channel_id = 2) to avoid Region chat restrictions (2hr play time, username, rate limit).

### BSATN Serialization for PlayerChatPostMessageRequest

```
{
  text: String,              // 4-byte length prefix (u32 LE) + UTF-8 bytes
  channel_id: ChatChannel,   // 4-byte i32 LE (enum tag, NOT sum type)
  target_id: u64,            // 8 bytes LE
  language_code: String      // 4-byte length prefix (u32 LE) + UTF-8 bytes
}
```

**IMPORTANT:** `ChatChannel` is `#[repr(i32)]` (not a sum type), so it serializes as a plain i32 (4 bytes), NOT as a BSATN sum type tag. Same serialization pattern as other i32 fields.

### Docker Pause/Unpause for Connection Loss Simulation

Per the Epic 5 test design (Section 4.4), use Docker pause/unpause to simulate network partition:

```bash
docker pause sigil-bitcraft-server    # Simulates network partition
# ... client detects disconnection ...
docker unpause sigil-bitcraft-server  # Restore connectivity
# ... client reconnects, subscription state recovered ...
```

This is preferred over `docker network disconnect` because pause preserves the server process state. The BitCraft server's `auto_logout_loop` agent may sign out the player if the pause exceeds the auto-logout threshold (typically 5-10 minutes), which is acceptable and should be documented.

**Key considerations:**
- Docker pause/unpause requires Docker socket access (may not be available in all CI environments)
- Use `child_process.execSync()` or `child_process.exec()` to execute Docker commands
- Set reasonable pause duration (5-10 seconds) to trigger WebSocket timeout without triggering auto-logout
- Verify container name: check `docker compose -f docker/docker-compose.yml ps` for the actual container name

### Wallet Stub Mode Testing Strategy (AC3)

The wallet stub mode (DEBT-5) returns a fixed balance of 10000. To test "insufficient balance":

1. Create a `WalletClient` and call `enableStubMode(10000)` -- `getBalance()` returns fixed 10000
2. Create a `BudgetTracker` with a known limit and a cost lookup function
3. Create a `BudgetPublishGuard(tracker, costLookup)` -- call `guard.canAfford(reducer)` to check budget
4. Call `guard.guard(reducer)` to test budget enforcement -- throws `BudgetExceededError` (code: `BUDGET_EXCEEDED`) when over budget
5. Verify `getBalance()` is unchanged after `BudgetExceededError` rejection

**API clarification:** There are TWO `canAfford()` methods in the codebase:
- `client.publish.canAfford(reducer)` -- combines `WalletClient.getBalance()` + `ActionCostRegistry.getCost()` for full-pipeline affordability (async)
- `BudgetPublishGuard.canAfford(reducer)` -- checks agent budget remaining vs action cost (synchronous)

`WalletClient` does NOT have a `canAfford()` method. It has `getBalance()`, `enableStubMode()`, `disableStubMode()`, `isStubMode()`.

This is a CLIENT-SIDE test -- it validates the pre-flight rejection path, not the BLS/Crosstown rejection. The `BudgetPublishGuard` throws `BudgetExceededError` (not `SigilError` with `INSUFFICIENT_BALANCE`). Real ILP fee enforcement is deferred to BLOCKER-1.

### Key Tables for Story 5.8

| Table | PK | Purpose in Story 5.8 |
|-------|-----|---------------------|
| `user_state` | `identity` | Identity -> entity_id mapping (reconnection verification) |
| `player_state` | `entity_id: u64` | Player profile, signed_in status (state consistency checks) |
| `signed_in_player_state` | `entity_id: u64` | Sign-in state (reconnection recovery verification) |
| `mobile_entity_state` | `entity_id: u64` | Position (state consistency checks) |
| `health_state` | `entity_id: u64` | Player health (state consistency checks) |
| `stamina_state` | `entity_id: u64` | Stamina (error tests: "Not enough stamina") |
| `player_action_state` | `entity_id: u64` | Current action type (state consistency checks) |
| `inventory_state` | `entity_id: u64` | Inventory (state-unchanged verification after errors). Note: query by `owner_entity_id` for player's inventory, NOT by PK `entity_id` (per Previous Story Intelligence #11). |
| `chat_message_state` | `entity_id: u64` | Chat messages (chat error tests: empty text, etc.) |

### Subscription Requirements for Story 5.8

From the Game Reference Subscription Quick Reference:

| Table | Purpose | SQL |
|-------|---------|-----|
| `user_state` | Identity mapping, reconnection verification | `SELECT * FROM user_state` |
| `player_state` | Player profile, sign-in status | `SELECT * FROM player_state` |
| `signed_in_player_state` | Sign-in state (reconnection recovery) | `SELECT * FROM signed_in_player_state` |
| `mobile_entity_state` | Position (state consistency) | `SELECT * FROM mobile_entity_state` |
| `health_state` | Health (state consistency) | `SELECT * FROM health_state` |
| `stamina_state` | Stamina cost tracking | `SELECT * FROM stamina_state` |
| `player_action_state` | Current action type | `SELECT * FROM player_action_state` |
| `inventory_state` | Inventory (state-unchanged verification) | `SELECT * FROM inventory_state` |
| `chat_message_state` | Chat error testing | `SELECT * FROM chat_message_state` |

### Testing Approach

**Framework:** Vitest (consistent with all existing tests)

**Integration test location:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`

**Fixture additions:**
- `packages/client/src/__tests__/integration/fixtures/error-helpers.ts` -- new file for error assertion helpers, error catalog recording, precondition error assertion
- `packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts` -- extended with `subscribeToStory58Tables()`, `STORY_58_TABLES`
- `packages/client/src/__tests__/integration/fixtures/test-client.ts` -- extended with `chat_post_message` serialization in `serializeReducerArgs()`
- `packages/client/src/__tests__/integration/fixtures/index.ts` -- updated barrel exports

**Conditional execution:** Same pattern as Stories 5.4-5.7 -- `describe.skipIf(!runIntegrationTests)` with inner `dockerHealthy` check.

**Environment variables (same as Stories 5.4-5.7):**

| Variable | Purpose |
|----------|---------|
| `RUN_INTEGRATION_TESTS=true` | Enable integration test suite |
| `SPACETIMEDB_URL=ws://localhost:3000` | SpacetimeDB server URL |
| `SPACETIMEDB_DATABASE=bitcraft` | Database name |

### Known Risks

| Risk ID | Risk | Impact | Mitigation |
|---------|------|--------|------------|
| R5-001 | BLOCKER-1 identity propagation | HIGH | Bypass BLS handler; use direct WebSocket (same as 5.4-5.7) |
| R5-008 | Connection drops during tests | MEDIUM | Docker pause/unpause with configurable duration. Generous timeout for reconnection (30s). |
| R5-015 | Subscription timing non-determinism | MEDIUM | Same as 5.4-5.7 -- use `waitForTableInsert`/`waitForTableUpdate` with configurable timeout (default 5000ms). |
| R5-040 | Docker pause/unpause not available in CI | HIGH | Skip connection loss tests when Docker control commands are not available. Document as CI limitation. |
| R5-041 | Auto-logout during pause duration | MEDIUM | Use short pause (5-10s) to minimize auto-logout risk. Document auto-logout behavior if it occurs. |
| R5-042 | SpacetimeDB SDK reconnection behavior unknown | HIGH | SDK may or may not auto-reconnect. Test must handle both cases: (a) automatic reconnection, (b) manual re-establishment of connection. |
| R5-043 | Container name mismatch | LOW | Verify container name via `docker compose ps` before running pause/unpause commands. |
| R5-044 | Chat restrictions may block chat_post_message | MEDIUM | Use Local channel (channel_id=2) to avoid Region chat restrictions. If Local channel also has restrictions, document and skip chat error tests. |
| R5-045 | Crosstown error path untestable | HIGH | Crosstown errors cannot be tested via direct WebSocket. Document deferral with expected behavior for when BLOCKER-1 is resolved. Test CrosstownAdapter error mapping via unit test instead. |

### Project Structure Notes

- **New integration test file:** `packages/client/src/__tests__/integration/error-scenarios.test.ts`
- **New fixture file:** `packages/client/src/__tests__/integration/fixtures/error-helpers.ts`
- **Modified fixture files:**
  - `fixtures/subscription-helpers.ts` -- add `subscribeToStory58Tables()`, `STORY_58_TABLES`
  - `fixtures/test-client.ts` -- add `chat_post_message` serialization to `serializeReducerArgs()`
  - `fixtures/index.ts` -- add new exports
- **Modified documentation:**
  - `_bmad-output/planning-artifacts/bitcraft-game-reference.md` -- error catalog appendix added
- **No modifications** to existing Epic 1-4 production code
- **No modifications** to Story 5.4-5.7 test files
- **No new npm dependencies** -- uses existing `@clockworklabs/spacetimedb-sdk` (^1.3.3), `vitest`, and `@sigil/client` (for wallet/budget tests)

### Security Considerations (OWASP Top 10)

This is a validation/testing story. OWASP assessment included per AGREEMENT-2.

- **A01 (Broken Access Control):** N/A -- test fixtures connect with auto-generated SpacetimeDB identities. Docker services are localhost-only.
- **A02 (Cryptographic Failures):** N/A -- no crypto in test fixtures.
- **A03 (Injection):** LOW RISK -- reducer names validated by existing `executeReducer()` regex (Story 5.4). Test intentionally sends invalid reducer names but within the validation framework. Chat message text is controlled test data. Docker commands use `execSync` with hardcoded container names (no user input).
- **A04 (Insecure Design):** N/A -- test infrastructure only.
- **A05 (Security Misconfiguration):** LOW RISK -- Docker stack uses localhost-only binding. No admin tokens in test code. Docker pause/unpause commands do not expose sensitive information.
- **A06 (Vulnerable Components):** N/A -- no new dependencies. Pre-existing undici vuln (DEBT-E4-5) unchanged.
- **A07 (Authentication Failures):** N/A -- auto-generated SpacetimeDB identities. No password handling.
- **A08 (Data Integrity Failures):** N/A -- tests verify state consistency after errors; no serialization attacks.
- **A09 (Security Logging):** N/A -- test infrastructure.
- **A10 (SSRF):** LOW RISK -- hardcoded localhost URLs. Docker commands use hardcoded container names. No user-controlled URL inputs.

### FR/NFR Traceability

| Requirement | Coverage | Notes |
|---|---|---|
| FR17 (Execute actions) | AC1, AC2 | AC1: unknown reducer rejection. AC2: invalid argument rejection. Both via direct WebSocket (BLOCKER-1). BLS-routed path deferred. |
| FR20 (Fee collection) | AC3 | Wallet stub mode pre-flight rejection tested via `BudgetPublishGuard`. Real ILP fee enforcement deferred to BLOCKER-1. |
| FR21 (Action cost lookup) | AC3 | Cost registry lookup tested for affordability check via `BudgetPublishGuard.canAfford()`. |
| NFR8 (Invalid signatures rejected by BLS) | N/A (BLOCKER-1) | Test design maps NFR8 to Story 5.8 for "forged identity test." Not testable via direct WebSocket path -- BLS signature validation is bypassed. SpacetimeDB identity is auto-generated per connection. Deferred to BLOCKER-1 resolution. |
| NFR24 (Failed actions leave no inconsistent state) | AC3, AC4, AC5 | AC3: wallet balance unchanged after rejection. AC4: game state consistent after reconnection. AC5: no inconsistent state after Crosstown loss (documented/deferred). |
| NFR27 (Zero silent failures) | AC1, AC2, AC6 | AC1/AC2: all errors produce explicit messages. AC6: error catalog documents all error codes and message formats. |

### Epics.md Deviations

1. **BLOCKER-1 direct WebSocket vs client.publish():** Epics.md AC1 says "BLS rejects the action" and AC1 says "SigilError is returned." Story uses direct WebSocket per BLOCKER-1 bypass, so errors are SpacetimeDB reducer errors (strings), not BLS `BLSErrorCode` or client `SigilError`. Same deviation as Stories 5.4-5.7.
2. **entity_id chain vs Nostr identity:** Epics.md AC4 mentions "signed event pubkey" but Story uses SpacetimeDB native identity (via `ctx.sender`) per BLOCKER-1. Identity is verified via `user_state` -> `entity_id` chain.
3. **Wallet stub mode vs INSUFFICIENT_BALANCE error:** Epics.md AC3 says "rejected before or during ILP routing with a `INSUFFICIENT_BALANCE` error." Story tests stub mode pre-flight rejection via `BudgetPublishGuard.canAfford()` and `BudgetPublishGuard.guard()`, not real ILP routing. `WalletClient` does not have a `canAfford()` method -- affordability is checked via `client.publish.canAfford()` (which combines wallet balance + cost registry) or `BudgetPublishGuard.canAfford()` (which checks agent budget).
4. **SigilError type unavailable via direct WebSocket:** Epics.md AC1 says "a `SigilError` is returned to the client with appropriate code and boundary." Since Story uses direct WebSocket SDK (not `client.publish()`), errors are SpacetimeDB SDK error strings, not `SigilError` objects. The error information (message) is still validated.
5. **Crosstown connection loss deferred:** Epics.md AC5 specifies "the Crosstown connection is lost" but the direct WebSocket path does not use Crosstown. Story documents the expected behavior and tests the `CrosstownAdapter` error mapping via unit test. Full integration test deferred to BLOCKER-1 resolution.
6. **BudgetExceededError vs INSUFFICIENT_BALANCE:** Epics.md AC3 says "rejected with a `INSUFFICIENT_BALANCE` error." In the actual implementation, `BudgetPublishGuard.guard()` throws `BudgetExceededError` (code: `BUDGET_EXCEEDED`, from `packages/client/src/agent/budget-types.ts`), which is a custom Error subclass, NOT a `SigilError` with code `INSUFFICIENT_BALANCE`. The `INSUFFICIENT_BALANCE` SigilError (boundary: `crosstown`) is the full-pipeline error thrown by `client.publish.publish()` when `WalletClient.getBalance()` < action cost. Since Story 5.8 tests the budget guard path (not the publish pipeline), the error type is `BudgetExceededError`.

### Previous Story Intelligence

**From Story 5.7 (Multi-Step Crafting Loop Validation):**

1. **Reusable fixtures established.** Story 5.8 MUST import from `fixtures/index.ts`, NOT recreate connection/subscription/lifecycle/extraction/crafting helpers.
2. **`setupSignedInPlayer()` returns `{ testConnection, entityId, initialPosition }`.** Use this for all error scenario tests.
3. **`waitForTableUpdate()` handles both `onUpdate` callback and delete+insert fallback.** Same pattern for reconnection state verification.
4. **`SpacetimeDBRow` type alias pattern.** Use `Record<string, any>` type alias (1 eslint-disable) instead of inline `any` casts.
5. **Named delay constants.** Extract all `setTimeout` delay values to named constants with JSDoc comments.
6. **Network-first pattern.** Register subscription listeners BEFORE executing reducers.
7. **Identity-matched entity lookup.** Use `testConnection.identity` to match against `user_state` rows.
8. **38 Story 5.7 integration tests + 25 Story 5.6 + 22 Story 5.5 + 22 Story 5.4 = 107 total.** Story 5.8 must not break any existing tests.
9. **Error patterns from Story 5.7:** AC3 (insufficient materials) and AC4 (partial failure recovery) provide error handling patterns. Story 5.8 generalizes these into reusable error assertion fixtures.
10. **Timing constants pattern.** Export constants from helper files and import in test files to avoid duplication.
11. **`inventory_state` uses `owner_entity_id`.** Query by `owner_entity_id` for player inventory, NOT by `entity_id`.

**From Story 5.4 (Basic Action Round-Trip Validation):**

12. **`executeReducer()` error handling.** Already handles reducer callback errors via `ctx.event.tag === 'Failed'` check. Story 5.8 error tests should leverage this existing error detection.
13. **`executeReducer()` input validation.** Regex validates reducer names (alphanumeric + underscore, 1-64 chars). Story 5.8 tests this validation directly.
14. **Docker health check pattern.** `isDockerStackHealthy()` checks all 3 services. Story 5.8 Docker pause/unpause tests must verify health before and after.

### Git Intelligence

Recent commits show Stories 5.1-5.7 completion:
- `3ec9243 feat(5-7): story complete`
- `d8447a1 feat(5-6): story complete`
- `3f5f0dc feat(5-5): story complete`
- `4a468be feat(5-4): story complete`
- `a7634c7 feat(5-3): story complete`
- `453d20b feat(5-2): story complete`
- `fe773a2 feat(5-1): story complete`

Commit convention: `feat(5-8): story complete` expected for story completion.
Branch: `epic-5` (current working branch).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5, Story 5.8] -- Acceptance criteria and story requirements
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md] -- BitCraft Game Reference (authoritative)
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md#Precondition Quick Reference] -- 30+ preconditions with error messages for error catalog
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md#Chat (MVP simple for Story 5.8)] -- Chat system reducer sequence, preconditions, state transitions
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md#Identity Propagation] -- BLOCKER-1 analysis and bypass recommendation
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md#Subscription Quick Reference] -- Tables for Story 5.8
- [Source: _bmad-output/planning-artifacts/test-design-epic-5.md#Story 5.8] -- Test design: ~35 planned tests, error test suites, Docker connection loss simulation
- [Source: _bmad-output/planning-artifacts/test-design-epic-5.md#4.4 Connection Loss Simulation] -- Docker pause/unpause technique recommendation
- [Source: _bmad-output/project-context.md] -- Project context (Epics 1-4 complete, Epic 5 in progress)
- [Source: _bmad-output/project-context.md#Known Issues] -- BLOCKER-1, DEBT-2, DEBT-5
- [Source: _bmad-output/implementation-artifacts/5-7-multi-step-crafting-loop-validation.md] -- Previous story file with crafting error patterns
- [Source: _bmad-output/implementation-artifacts/5-6-resource-gathering-and-inventory-validation.md] -- Resource gathering error patterns
- [Source: _bmad-output/implementation-artifacts/5-5-player-lifecycle-and-movement-validation.md] -- Player lifecycle fixtures
- [Source: _bmad-output/implementation-artifacts/5-4-basic-action-round-trip-validation.md] -- Foundation story with fixture architecture, SDK API patterns
- [Source: packages/client/src/errors/error-codes.md] -- SigilError error code catalog (publish, crosstown, identity boundaries)
- [Source: packages/client/src/bls/types.ts] -- BLS error codes (INVALID_SIGNATURE, UNKNOWN_REDUCER, REDUCER_FAILED, INVALID_CONTENT)
- [Source: packages/client/src/wallet/wallet-client.ts] -- WalletClient stub mode implementation
- [Source: packages/client/src/agent/budget-publish-guard.ts] -- BudgetPublishGuard pre-publish enforcement
- [Source: packages/client/src/agent/budget-tracker.ts] -- BudgetTracker budget tracking
- [Source: packages/client/src/spacetimedb/reconnection-manager.ts] -- ReconnectionManager auto-reconnection implementation
- [Source: packages/client/src/__tests__/integration/fixtures/test-client.ts] -- `executeReducer()`, `serializeReducerArgs()` implementations
- [Source: packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts] -- Subscription helpers, `waitForTableInsert()`, `waitForTableDelete()`, `waitForTableUpdate()`
- [Source: packages/client/src/__tests__/integration/fixtures/player-lifecycle.ts] -- `setupSignedInPlayer()`, `teardownPlayer()` implementations
- [Source: packages/client/src/__tests__/integration/fixtures/index.ts] -- Barrel exports for all Story 5.4-5.7 fixtures
- [Source: packages/client/src/__tests__/integration/fixtures/seed-helpers.ts] -- Cheat/admin reducer wrappers
- [Source: BitCraftServer/packages/game/src/messages/components.rs#ChatChannel] -- ChatChannel enum definition (System=0, Global=1, Local=2, Region=3, ...)
- [Source: docker/docker-compose.yml] -- Docker stack configuration (3 services, health checks, port mappings, container names)

## Implementation Constraints

1. **Direct WebSocket only** -- Do NOT use `client.publish()` or the Crosstown/BLS pipeline. Call reducers directly via SpacetimeDB SDK (BLOCKER-1 workaround).
2. **No new npm dependencies** -- Use existing `@clockworklabs/spacetimedb-sdk` (^1.3.3), `vitest`, and `@sigil/client` (for wallet/budget unit tests).
3. **Docker-dependent tests must be skippable** -- All integration tests must skip gracefully when Docker is not available (AGREEMENT-5).
4. **No modifications to Epic 1-4 production code** -- Test fixtures and integration tests only.
5. **Extend, do not duplicate, Story 5.4-5.7 fixtures** -- Import from `fixtures/index.ts`. Add new helpers to existing fixture files or new fixture files. Do NOT copy-paste earlier story code.
6. **Admin token must NOT appear in test code** -- Use environment variables for sensitive values.
7. **Consistent test patterns** -- Follow Story 5.4-5.7 test patterns: `describe.skipIf(!runIntegrationTests)`, `beforeAll` Docker health check, `afterEach` cleanup, `dockerHealthy` inner checks.
8. **No placeholder assertions** -- Every test must have real assertions (AGREEMENT-10).
9. **Docker pause/unpause must be resilient** -- Always unpause in `afterAll`/`afterEach` to prevent leaving Docker in a broken state. Use try/finally pattern.
10. **Table/column names must match Game Reference** -- All table references must use exact names from the Game Reference.
11. **Network-first pattern** -- Register subscription listeners BEFORE executing reducers.
12. **Named delay constants** -- All `setTimeout` delay values must be extracted to named constants with JSDoc comments.
13. **SpacetimeDBRow type alias** -- Use file-level `type SpacetimeDBRow = Record<string, any>` instead of inline `any` annotations.
14. **Identity-matched entity lookups** -- Match `testConnection.identity` against `user_state` rows for entity_id extraction.
15. **Docker pause/unpause cleanup** -- CRITICAL: always unpause in `afterAll` to prevent test suite from leaving Docker broken. Use `try { test } finally { unpause }` pattern.
16. **Error catalog entries must be structured** -- Use `ErrorCatalogEntry` interface for all error documentation. This ensures consistency across the catalog.

## CRITICAL Anti-Patterns (MUST AVOID)

1. **DO NOT use `client.publish()` for reducer calls.** Use direct SpacetimeDB WebSocket SDK (BLOCKER-1).
2. **DO NOT create placeholder tests with `expect(true).toBe(true)`.** Every assertion must verify real behavior (AGREEMENT-10).
3. **DO NOT duplicate Story 5.4-5.7 fixture code.** Import from `fixtures/index.ts` and extend.
4. **DO NOT hardcode `SPACETIMEDB_ADMIN_TOKEN` or secrets in test code.**
5. **DO NOT skip Docker health checks.** Tests must skip gracefully when Docker is down.
6. **DO NOT leave Docker containers paused after test failure.** Always unpause in `afterAll`/`finally` blocks.
7. **DO NOT use hardcoded timeouts without documentation.** Reference NFR numbers and use named constants.
8. **DO NOT register subscription listeners AFTER executing reducers.** Network-first pattern required.
9. **DO NOT assume `chat_post_message` will work without signed-in player.** Must `setupSignedInPlayer()` first.
10. **DO NOT test Crosstown errors via live Crosstown connection.** Use unit test for `CrosstownAdapter` error mapping. Full integration deferred to BLOCKER-1.
11. **DO NOT use inline `any` type annotations.** Use the `SpacetimeDBRow` type alias pattern.
12. **DO NOT modify existing Story 5.4-5.7 test files.** Story 5.8 tests go in a new file.
13. **DO NOT make tests depend on server-side state from previous test runs.** Each test suite should set up its own state via `setupSignedInPlayer()`.
14. **DO NOT assume Docker pause/unpause commands are available.** Skip connection loss tests if commands fail.
15. **DO NOT use Region chat channel for testing.** Use Local (channel_id=2) to avoid 2hr play time and username restrictions.

## Definition of Done

- [ ] Story 5.8 subscription set (9 tables) helper created and working
- [ ] Chat reducer BSATN serialization added to `serializeReducerArgs()` (chat_post_message)
- [ ] Error assertion fixtures created: `assertReducerError()`, `assertStateUnchanged()`, `assertNoNewRows()`, `assertPreconditionError()`
- [ ] Error catalog recording fixture created: `recordErrorCatalogEntry()`, `ErrorCatalogEntry` interface
- [ ] Unknown reducer error tests pass (AC1): non-existent reducer rejected, state unchanged
- [ ] Invalid argument error tests pass (AC2): malformed args rejected, precondition errors caught, state unchanged
- [ ] Insufficient balance tests pass (AC3): `BudgetPublishGuard.canAfford()` correctly checks budget, `BudgetPublishGuard.guard()` throws `BudgetExceededError` when budget exhausted, `WalletClient.getBalance()` unchanged after rejection
- [ ] SpacetimeDB reconnection tests pass (AC4): Docker pause/unpause simulates connection loss, state recovers consistently
- [ ] Crosstown connection loss documented (AC5): deferred per BLOCKER-1, CrosstownAdapter error mapping verified via unit test
- [ ] Error catalog compiled and appended to BitCraft Game Reference (AC6)
- [ ] Reusable error assertion fixtures produced for future epics
- [ ] All tests skip gracefully when Docker is not available
- [ ] Docker pause/unpause tests skip when Docker control commands are unavailable
- [ ] Docker containers always unpaused in cleanup (try/finally pattern)
- [ ] No placeholder assertions (AGREEMENT-10)
- [ ] No hardcoded secrets in test code
- [ ] OWASP Top 10 review completed (AGREEMENT-2)
- [ ] All table/column references consistent with Game Reference nomenclature
- [ ] Story 5.4-5.7 tests still pass (no regressions)
- [ ] Named delay constants used for all setTimeout values
- [ ] SpacetimeDBRow type alias used instead of inline any

## Verification Steps

1. Subscription helper: `subscribeToStory58Tables()` subscribes to all 9 required tables
2. Chat BSATN serialization: `chat_post_message` serialization produces correct BSATN bytes (String + i32 enum + u64 + String)
3. Error assertion fixtures: `assertReducerError()` returns structured error info, `assertStateUnchanged()` detects state preservation, `assertNoNewRows()` correctly times out with no inserts
4. Unknown reducer tests: non-existent reducer produces clear error, no state changes
5. Invalid argument tests: malformed args, invalid recipe/building IDs, unsigned player -- all produce actionable errors
6. Insufficient balance: `BudgetPublishGuard.canAfford()` returns false when budget remaining < cost, `BudgetPublishGuard.guard()` throws `BudgetExceededError` when budget exhausted, `WalletClient.getBalance()` is unchanged after rejection
7. Connection loss: Docker pause triggers WebSocket disconnection detection, unpause allows reconnection, state is consistent after recovery
8. Crosstown: `CrosstownAdapter` error mapping verified via unit test (NETWORK_TIMEOUT, NETWORK_ERROR codes)
9. Error catalog: appendix added to `bitcraft-game-reference.md` with structured error entries
10. Docker skip: tests skip gracefully when Docker is not available
11. Docker pause skip: connection loss tests skip when Docker control commands are unavailable
12. Docker cleanup: containers always unpaused in `afterAll` (verify no paused containers after test run)
13. Regression: run Story 5.4 tests (`action-round-trip.test.ts`), Story 5.5 tests (`player-lifecycle-movement.test.ts`), Story 5.6 tests (`resource-gathering-inventory.test.ts`), and Story 5.7 tests (`crafting-loop.test.ts`) to verify no breakage
14. No secrets: grep test files for `SPACETIMEDB_ADMIN_TOKEN` -- must only appear in `process.env` references
15. Table names: spot-check all references against Game Reference nomenclature

## Change Log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-03-16 | Initial story creation | Epic 5 Story 5.8 spec via create-story workflow |
| 2026-03-16 | Adversarial review: 9 issues found and fixed | (1) Fixed `WalletClient.canAfford()` references -- method does not exist on WalletClient; corrected to `BudgetPublishGuard.canAfford()` and `BudgetPublishGuard.guard()` in Tasks 5.1-5.6, Verification Step 6, Definition of Done, Wallet Stub Mode Testing Strategy. (2) Added Epics.md Deviation #6: `BudgetExceededError` vs `INSUFFICIENT_BALANCE` SigilError distinction. (3) Fixed AC3 to reference `BudgetExceededError` instead of `INSUFFICIENT_BALANCE`. (4) Fixed Task 7.2 from "integration test" to documentation verification (checking markdown file is not a runtime test). (5) Fixed Task 7.3 to acknowledge existing `CrosstownAdapter` unit tests in `crosstown-adapter.test.ts` (Story 2.5) instead of creating duplicates. (6) Added NFR8 to FR/NFR Traceability as N/A with BLOCKER-1 deferral explanation. (7) Clarified `inventory_state` query pattern in Key Tables (use `owner_entity_id`, not PK `entity_id`). (8) Added API clarification in Wallet Stub Mode Testing Strategy documenting the two different `canAfford()` methods. (9) Changed Task 5 subtasks from "integration test" to "unit test" since wallet/budget tests are client-side and do not require Docker. |

## Code Review Record

| Review Pass | Date | Reviewer | Issues Found | Issues Fixed | Notes |
| --- | --- | --- | --- | --- | --- |
| Pre-implementation adversarial | 2026-03-16 | Claude Opus 4.6 | 9 | 9 | API accuracy (WalletClient.canAfford does not exist), error type mismatch (BudgetExceededError vs INSUFFICIENT_BALANCE), duplicate test prevention (CrosstownAdapter tests exist), task type correction (unit vs integration), NFR8 traceability gap, documentation verification vs runtime test distinction |

## Dev Agent Record

### Agent Model Used

_(To be filled during implementation)_

### Debug Log References

_(To be filled during implementation)_

### Completion Notes List

_(To be filled during implementation)_

### File List

| File | Action | Description |
| --- | --- | --- |
| _(To be filled during implementation)_ | | |
