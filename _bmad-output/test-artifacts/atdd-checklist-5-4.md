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
  - '_bmad-output/implementation-artifacts/5-4-basic-action-round-trip-validation.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
  - 'packages/client/vitest.config.ts'
  - 'packages/client/src/__tests__/integration/wallet-balance.test.ts'
  - 'packages/client/src/integration-tests/bls-handler.integration.test.ts'
  - 'packages/client/src/spacetimedb/connection.ts'
  - 'packages/client/src/wallet/wallet-client.ts'
  - 'packages/client/src/publish/action-cost-registry.ts'
---

# ATDD Checklist - Epic 5, Story 4: Basic Action Round-Trip Validation

**Date:** 2026-03-16
**Author:** Jonathan
**Primary Test Level:** Integration

---

## Story Summary

Validate the fundamental SDK pipeline by executing a single game action through direct SpacetimeDB WebSocket connection, verifying state changes via subscriptions, measuring round-trip timing, and producing reusable test fixtures for Stories 5.5-5.8.

**As a** developer
**I want** to execute a single game action through the full SDK pipeline and verify the state change is observable via SpacetimeDB subscriptions
**So that** we have confidence the fundamental plumbing works before testing complex gameplay sequences

---

## Acceptance Criteria

1. **AC1 - Pipeline round-trip execution (FR17, NFR5):** Execute a game action via SpacetimeDB WebSocket, verify reducer succeeds, state change observable via subscription within 500ms
2. **AC2 - State change verification via subscription (FR4, FR5):** After sign_in, verify signed_in_player_state insert and player_state.signed_in toggle; after sign_out, verify deletion
3. **AC3 - Round-trip timing measurement (NFR3):** Round-trip < 2000ms, subscription update < 500ms, timing breakdown logged
4. **AC4 - Identity chain verification (FR4, FR5):** Connection identity matches user_state entry, entity_id maps to player_state and signed_in_player_state
5. **AC5 - Wallet/cost accounting (FR20, FR21, FR22):** Wallet stub mode balance query succeeds, cost registry lookup works
6. **AC6 - Reusable test fixture production:** Docker health check, SpacetimeDB connection, subscription helpers, test client factory all reusable

---

## Failing Tests Created (RED Phase)

### Integration Tests (22 tests)

**File:** `packages/client/src/__tests__/integration/action-round-trip.test.ts` (~850 lines)

#### AC1: Pipeline round-trip execution

- **Test:** `[P0] should connect to SpacetimeDB via WebSocket with a fresh identity`
  - **Status:** RED - Requires Docker stack and direct SpacetimeDB WebSocket connection
  - **Verifies:** WebSocket connection establishment, identity assignment

- **Test:** `[P0] should call synchronize_time reducer and receive success`
  - **Status:** RED - Requires live SpacetimeDB server with bitcraft module
  - **Verifies:** Simplest possible reducer round-trip (no side effects)

- **Test:** `[P0] should call sign_in reducer and observe signed_in_player_state via subscription within 500ms (NFR5)`
  - **Status:** RED - Requires live SpacetimeDB + subscription infrastructure
  - **Verifies:** Reducer execution + subscription state change + NFR5 timing

#### AC2: State change verification via subscription

- **Test:** `[P0] should receive signed_in_player_state insert after sign_in`
  - **Status:** RED - Requires live subscription infrastructure
  - **Verifies:** Table insert event received via subscription callback

- **Test:** `[P0] should verify player_state.signed_in is true after sign_in`
  - **Status:** RED - Requires client-side table state cache
  - **Verifies:** Player state field toggled correctly

- **Test:** `[P0] should receive signed_in_player_state delete after sign_out`
  - **Status:** RED - Requires live subscription with delete events
  - **Verifies:** Table delete event received after sign_out

- **Test:** `[P1] should verify player_state.signed_in is false after sign_out`
  - **Status:** RED - Requires full sign_in/sign_out lifecycle
  - **Verifies:** Player state field toggled back to false

#### AC3: Round-trip timing measurement

- **Test:** `[P1] should complete reducer round-trip within 2000ms (NFR3)`
  - **Status:** RED - Requires live SpacetimeDB performance measurement
  - **Verifies:** NFR3 performance requirement (< 2 seconds)

- **Test:** `[P1] should receive subscription update within 500ms of reducer completion (NFR5)`
  - **Status:** RED - Requires live subscription timing measurement
  - **Verifies:** NFR5 latency requirement (< 500ms), timing breakdown

#### AC4: Identity chain verification

- **Test:** `[P0] should verify connection identity matches user_state entry`
  - **Status:** RED - Requires live SpacetimeDB identity resolution
  - **Verifies:** Identity chain: connection -> user_state

- **Test:** `[P1] should verify entity_id from user_state maps to player_state and signed_in_player_state`
  - **Status:** RED - Requires full identity chain traversal
  - **Verifies:** Identity chain: user_state.entity_id -> player_state + signed_in_player_state

#### AC5: Wallet/cost accounting

- **Test:** `[P2] should query wallet balance in stub mode without errors (DEBT-5)`
  - **Status:** RED - Requires Crosstown health check (activates stub mode)
  - **Verifies:** Wallet stub mode accounting path works

- **Test:** `[P2] should look up action cost in cost registry without errors`
  - **Status:** RED - Requires cost registry + wallet client integration
  - **Verifies:** Cost registry lookup and wallet affordability check

#### AC6: Reusable test fixture production

- **Test:** `[P0] should verify Docker health check utility exists and returns boolean`
  - **Status:** RED - Requires docker-health fixture module
  - **Verifies:** Fixture exists and returns correct type

- **Test:** `[P1] should verify SpacetimeDB connection helper connects and disconnects`
  - **Status:** RED - Requires Docker stack + connection fixture
  - **Verifies:** Connection lifecycle management

- **Test:** `[P1] should verify createTestClient factory produces usable client`
  - **Status:** RED - Requires all fixture modules
  - **Verifies:** Composite factory creates complete test client

- **Test:** `[P1] should verify waitForTableInsert resolves on matching update`
  - **Status:** RED - Requires live subscription infrastructure
  - **Verifies:** Subscription helper resolves correctly

---

## Data Factories Created

### TestClient Factory

**File:** `packages/client/src/__tests__/integration/fixtures/test-client.ts`

**Exports:**

- `createTestClient(options?)` - Create composite test client with Docker health check, SpacetimeDB connection, and subscription setup
- `executeReducer(testConnection, reducerName, ...args)` - Execute reducer with timing measurement
- `verifyStateChange(testConnection, tableName, predicate, timeoutMs)` - Combined reducer + subscription verification

**Example Usage:**

```typescript
const client = await createTestClient();
const { callTimeMs } = await executeReducer(client.testConnection, 'synchronize_time', 1.0);
client.cleanup();
```

---

## Fixtures Created

### Docker Health Check

**File:** `packages/client/src/__tests__/integration/fixtures/docker-health.ts`

**Fixtures:**

- `isDockerStackHealthy()` - Returns boolean: are all 3 Docker services responding OK?
  - **Setup:** HTTP GET to each service health endpoint (parallel)
  - **Provides:** Boolean result
  - **Cleanup:** None (stateless)

- `checkDockerStackHealth()` - Detailed health check with per-service results
  - **Setup:** HTTP GET to each service health endpoint (parallel)
  - **Provides:** DockerStackHealthResult with individual service results and timing
  - **Cleanup:** None (stateless)

### SpacetimeDB Connection

**File:** `packages/client/src/__tests__/integration/fixtures/spacetimedb-connection.ts`

**Fixtures:**

- `connectToSpacetimeDB(options?)` - Create direct WebSocket connection with fresh identity
  - **Setup:** WebSocket connection to SpacetimeDB with configurable URL and database
  - **Provides:** SpacetimeDBTestConnection with connection, identity, token, disconnect
  - **Cleanup:** Call disconnect() method or disconnectFromSpacetimeDB()

### Subscription Helpers

**File:** `packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts`

**Fixtures:**

- `waitForTableInsert(testConnection, tableName, predicate, timeoutMs)` - Wait for row insert
  - **Setup:** Registers onInsert callback on specified table
  - **Provides:** Matching row + elapsed time in ms
  - **Cleanup:** Auto-cleanup via timeout

- `waitForTableDelete(testConnection, tableName, predicate, timeoutMs)` - Wait for row delete
  - **Setup:** Registers onDelete callback on specified table
  - **Provides:** Deleted row + elapsed time in ms
  - **Cleanup:** Auto-cleanup via timeout

- `queryTableState(testConnection, tableName, predicate?)` - Query current table state
  - **Setup:** None (reads cached client-side state)
  - **Provides:** Array of matching rows
  - **Cleanup:** None (read-only)

- `subscribeToStory54Tables(testConnection)` - Subscribe to minimum 3 tables for Story 5.4
  - **Setup:** Subscribes to user_state, player_state, signed_in_player_state
  - **Provides:** void (subscriptions are set up)
  - **Cleanup:** Auto via connection disconnect

### Barrel Export

**File:** `packages/client/src/__tests__/integration/fixtures/index.ts`

Re-exports all fixtures for convenient importing by Stories 5.5-5.8.

---

## Mock Requirements

### No External Service Mocking Required

Story 5.4 tests against the **real** Docker stack services (SpacetimeDB, Crosstown, BLS). No service mocking is needed because:

- BLOCKER-1 workaround: Direct WebSocket connection to SpacetimeDB (bypasses BLS)
- Wallet: Uses stub mode (DEBT-5) which self-activates on 404 from Crosstown
- Tests skip gracefully when Docker is not available

---

## Required data-testid Attributes

### N/A

Story 5.4 is a backend/SDK integration story with no UI components. No data-testid attributes are required.

---

## Implementation Checklist

### Test: Connect to SpacetimeDB via WebSocket

**File:** `packages/client/src/__tests__/integration/action-round-trip.test.ts`

**Tasks to make this test pass:**

- [x] Create `docker-health.ts` fixture with `isDockerStackHealthy()`
- [x] Create `spacetimedb-connection.ts` fixture with `connectToSpacetimeDB()`
- [ ] Start Docker stack: `docker compose -f docker/docker-compose.yml up -d`
- [ ] Verify SpacetimeDB WebSocket accepts connections on `ws://localhost:3000`
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip`

**Estimated Effort:** 0.5 hours (Docker startup + SDK connection debugging)

---

### Test: Reducer round-trip (synchronize_time, sign_in, sign_out)

**File:** `packages/client/src/__tests__/integration/action-round-trip.test.ts`

**Tasks to make this test pass:**

- [x] Create `test-client.ts` fixture with `executeReducer()` helper
- [ ] Investigate SpacetimeDB SDK reducer call API surface (connection.reducers.*)
- [ ] Investigate whether new identities auto-create user_state entries
- [ ] Handle player_queue_join precondition for sign_in
- [ ] Verify reducer argument serialization format (SpacetimeType structs as JSON arrays)
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip`

**Estimated Effort:** 2 hours (SDK API surface exploration + reducer argument format)

---

### Test: Subscription state change verification

**File:** `packages/client/src/__tests__/integration/action-round-trip.test.ts`

**Tasks to make this test pass:**

- [x] Create `subscription-helpers.ts` with `waitForTableInsert()` and `waitForTableDelete()`
- [ ] Verify SpacetimeDB subscription API (conn.subscribe or conn.subscriptionBuilder)
- [ ] Verify table callback API (db.tableName.onInsert/onDelete)
- [ ] Verify client-side table state query API (db.tableName.iter or getAll)
- [ ] Tune subscription wait timeouts for reliability
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip`

**Estimated Effort:** 2 hours (subscription API exploration + timing tuning)

---

### Test: Identity chain verification

**File:** `packages/client/src/__tests__/integration/action-round-trip.test.ts`

**Tasks to make this test pass:**

- [ ] Verify SpacetimeDB Identity comparison method (toHexString, equality)
- [ ] Verify user_state.identity field type and format
- [ ] Verify user_state.entity_id maps to player_state.entity_id
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip`

**Estimated Effort:** 1 hour

---

### Test: Wallet/cost accounting stub path

**File:** `packages/client/src/__tests__/integration/action-round-trip.test.ts`

**Tasks to make this test pass:**

- [ ] Verify WalletClient activates stub mode on Crosstown 404
- [ ] Verify ActionCostRegistryLoader loads and validates registry
- [ ] Run test: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip`

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story (requires Docker stack)
RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip

# Run specific test file
RUN_INTEGRATION_TESTS=true npx vitest run packages/client/src/__tests__/integration/action-round-trip.test.ts

# Run tests with verbose output
RUN_INTEGRATION_TESTS=true npx vitest run --reporter=verbose packages/client/src/__tests__/integration/action-round-trip.test.ts

# Run tests without Docker (all integration tests will skip)
pnpm --filter @sigil/client test -- action-round-trip

# Debug specific test (node inspector)
RUN_INTEGRATION_TESTS=true node --inspect-brk node_modules/.bin/vitest run packages/client/src/__tests__/integration/action-round-trip.test.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Current - TEA Responsibility)

**TEA Agent Responsibilities:**

- All test files written with real assertions (no placeholder assertions per AGREEMENT-10)
- Fixtures created with connection cleanup in afterEach hooks
- Mock requirements documented (none needed -- uses real Docker stack)
- data-testid requirements: N/A (backend story)
- Implementation checklist created mapping tests to code tasks
- Tests skip gracefully when Docker not available

**Verification:**

- Tests will fail when Docker is running because:
  - SpacetimeDB SDK API surface may differ from documented patterns
  - Reducer argument format needs investigation
  - Subscription API needs verification
  - Player creation flow for new identities is unknown (R5-012)
- Tests will skip when Docker is not running (clean skip, no cryptic errors)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start Docker stack:** `docker compose -f docker/docker-compose.yml up -d`
2. **Pick one failing test** from implementation checklist (start with simplest: connection test)
3. **Read the test** to understand expected behavior
4. **Fix fixture code** to match actual SpacetimeDB SDK API surface
5. **Run the test** to verify it now passes (green)
6. **Move to next test** and repeat (connection -> reducer -> subscription -> identity -> wallet)

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Start with the simplest test (connection, then synchronize_time)
- SDK API surface exploration is the main work (not the assertions)
- Use implementation checklist as roadmap

**Progress Tracking:**

- Check off tasks as you complete them in this checklist
- Focus on making each test pass before moving to the next

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review fixture code** for reusability by Stories 5.5-5.8
3. **Extract common patterns** (DRY principle)
4. **Document fixture usage** in JSDoc comments
5. **Ensure tests still pass** after each refactor

---

## Next Steps

1. **Start Docker stack:** `docker compose -f docker/docker-compose.yml up -d`
2. **Run failing tests** to confirm RED phase: `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor fixtures for reusability
6. **When refactoring complete**, commit with `feat(5-4): story complete`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Factory patterns for test client creation (createTestClient with overrides)
- **test-quality.md** - Deterministic tests, no hard waits, explicit assertions, isolation, cleanup, test length limits
- **test-levels-framework.md** - Integration test level selected as primary (backend stack, Docker-dependent)
- **test-healing-patterns.md** - Network-first pattern applied (subscription listener registered before reducer call to prevent race conditions)

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `RUN_INTEGRATION_TESTS=true pnpm --filter @sigil/client test -- action-round-trip`

**Expected Results:**

- Without Docker: All tests skip (describe.skipIf)
- With Docker: Tests fail due to SpacetimeDB SDK API surface differences (fixture code needs tuning)

**Summary:**

- Total tests: 22
- Passing: 0 (expected - RED phase)
- Failing/Skipping: 22 (expected - fixtures need SDK API tuning)
- Status: RED phase - test infrastructure created, awaiting implementation

---

## Notes

- **BLOCKER-1:** All tests bypass BLS handler and use direct SpacetimeDB WebSocket. The BLS-based publish pipeline will be validated after BLOCKER-1 is resolved.
- **R5-012:** Whether new SpacetimeDB identities auto-create user_state entries is unknown. Tests include try/catch around player_queue_join as a precaution. This is the highest-risk unknown for Story 5.4.
- **DEBT-5:** Wallet stub mode returns fixed balance 10000. AC5 validates the stub accounting path, not real ILP fees.
- **SDK API Surface (R5-013):** The SpacetimeDB SDK ^1.3.3 API surface for reducers, subscriptions, and table queries may differ from the patterns used in fixture code. SDK exploration during GREEN phase will resolve this.
- **Table/column naming:** All references use Game Reference nomenclature: `signed_in_player_state` (not `signed_in_state`), `player_state.signed_in` (not `is_signed_in`).

---

## Priority Distribution

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 7 | Critical path: connection, round-trip, state changes, identity, Docker health |
| P1 | 9 | Important: timing, extended verification, fixture validation |
| P2 | 6 | Nice-to-have: wallet/cost stub mode validation, barrel export |
| **Total** | **22** | |

---

**Generated by BMAD TEA Agent** - 2026-03-16
