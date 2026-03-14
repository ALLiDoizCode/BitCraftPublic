---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-13'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/3-3-pricing-configuration-and-fee-schedule.md'
  - '_bmad-output/project-context.md'
  - 'packages/bitcraft-bls/src/config.ts'
  - 'packages/bitcraft-bls/src/handler.ts'
  - 'packages/bitcraft-bls/src/health.ts'
  - 'packages/bitcraft-bls/src/index.ts'
  - 'packages/bitcraft-bls/src/node.ts'
  - 'packages/bitcraft-bls/src/content-parser.ts'
  - 'packages/bitcraft-bls/src/spacetimedb-caller.ts'
  - 'packages/bitcraft-bls/src/__tests__/factories/bls-config.factory.ts'
  - 'packages/bitcraft-bls/src/__tests__/factories/handler-context.factory.ts'
  - 'packages/bitcraft-bls/src/__tests__/factories/identity.factory.ts'
  - 'packages/crosstown-sdk/src/index.ts'
  - 'packages/client/config/default-action-costs.json'
  - 'packages/client/src/publish/action-cost-registry.ts'
---

# ATDD Checklist - Epic 3, Story 3.3: Pricing Configuration & Fee Schedule

**Date:** 2026-03-13
**Author:** TEA Agent (ATDD workflow)
**Primary Test Level:** Unit (backend, vitest)
**Total Tests Generated:** 51 (12 + 11 + 8 + 5 + 5 + 6 + 4)
**RED Phase Status:** All 51 tests skipped with `it.skip()` -- stub module created

---

## Story Summary

Story 3.3 adds pricing configuration to the BLS node. It introduces a fee schedule loader that reads per-action-type costs from a JSON file, integrates pricing into the BLS config and SDK kindPricing, adds per-reducer pricing enforcement in the handler, and exposes a public fee schedule HTTP endpoint.

**As an** operator,
**I want** to configure per-action-type pricing for the BLS so the system collects ILP fees on every game action,
**So that** the platform generates revenue from game activity.

---

## Acceptance Criteria

1. **AC1 - Kind pricing configuration in createNode()** (FR20): kindPricing configured with price for kind 30078 events; SDK createPricingValidator rejects insufficient payment.

2. **AC2 - Per-action-type fee schedule loading** (FR45): JSON fee schedule loaded at startup with per-reducer costs; exposed via action cost registry format.

3. **AC3 - SDK pricing enforcement** (FR20): Payment validated against configured price; insufficient payment rejected with F04; self-write bypass for node's own pubkey.

4. **AC4 - Client registry consistency** (NFR12): Fee schedule publicly verifiable; costs match between BLS and client registries.

5. **AC5 - Concurrent fee accounting** (NFR17): Fee accounting accurate under concurrent load; SDK handles validation atomically per packet.

---

## Preflight Summary

**Stack detected:** backend (Node.js + TypeScript + vitest)
**Test framework:** vitest (configured in packages/bitcraft-bls/vitest.config.ts)
**Existing patterns:** 15 test files in packages/bitcraft-bls/src/**tests**/, 3 test factories (bls-config, handler-context, identity)
**Knowledge loaded:** data-factories, test-quality, test-levels-framework, test-priorities-matrix
**E2E/Playwright:** Not applicable (backend-only story, no UI impact)

---

## Test Strategy - AC to Test Level Mapping

| AC       | Test Level  | Test File                        | Test Count | Priority |
| -------- | ----------- | -------------------------------- | ---------- | -------- |
| AC1      | Unit        | pricing-config.test.ts           | 11         | P0       |
| AC2      | Unit        | fee-schedule.test.ts             | 12         | P0       |
| AC2, AC3 | Unit        | pricing-enforcement.test.ts      | 8          | P0       |
| AC3      | Unit        | self-write-bypass.test.ts        | 5          | P0       |
| AC4      | Unit        | fee-schedule-endpoint.test.ts    | 5          | P1       |
| AC4      | Integration | fee-schedule-consistency.test.ts | 4          | P1       |
| AC1-5    | Integration | pricing-integration.test.ts      | 6          | P2       |

---

## Test Files Created

### 1. `packages/bitcraft-bls/src/__tests__/fee-schedule.test.ts` (12 tests)

**Covers:** AC2, AC4
**Tests:**

- `parses valid fee schedule JSON successfully`
- `loads fee schedule with per-reducer costs -- each reducer has different cost`
- `returns action cost for known reducer`
- `returns defaultCost for unknown reducer`
- `throws FeeScheduleError for missing version field`
- `throws FeeScheduleError for invalid version (not 1)`
- `throws FeeScheduleError for missing defaultCost`
- `throws FeeScheduleError for negative defaultCost`
- `throws FeeScheduleError for missing actions field`
- `throws FeeScheduleError for non-object actions field (array)`
- `throws FeeScheduleError for action entry with negative cost`
- `throws FeeScheduleError for file content exceeding 1MB` (OWASP A03)

### 2. `packages/bitcraft-bls/src/__tests__/pricing-config.test.ts` (11 tests)

**Covers:** AC1, AC2, AC3
**Tests:**

- `kindPricing includes kind 30078 with configured price`
- `uses default kindPricing { 30078: 100n } when no fee schedule path provided`
- `loads fee schedule from BLS_FEE_SCHEDULE_PATH when set`
- `throws error for invalid fee schedule path (startup failure)`
- `kindPricing[30078] derived as minimum of defaultCost and all action costs`
- `fee schedule with cheapest action cost 1 and defaultCost 10 produces kindPricing { 30078: 1n }`
- `createPricingValidator rejects amount below configured price (F04)`
- `createPricingValidator accepts amount at or above configured price`
- `createPricingValidator allows unpriced kinds (no rule = free)`
- `config includes fee schedule object when loaded`
- `config defaults when no fee schedule provided`

### 3. `packages/bitcraft-bls/src/__tests__/pricing-enforcement.test.ts` (8 tests)

**Covers:** AC2, AC3
**Tests:**

- `rejects when payment < reducer cost with F04`
- `accepts when payment >= reducer cost`
- `uses defaultCost for reducer not in fee schedule`
- `falls back to SDK-level kindPricing only when no fee schedule`
- `rejection message includes reducer name, paid amount, and required amount`
- `rejection is logged with eventId, pubkey, reducer, and amounts`
- `per-reducer pricing: cheap action player_move (cost 1) passes with small payment`
- `per-reducer pricing: expensive action empire_form (cost 100) fails with small payment`

### 4. `packages/bitcraft-bls/src/__tests__/self-write-bypass.test.ts` (5 tests)

**Covers:** AC3
**Tests:**

- `per-reducer pricing bypassed for node own pubkey`
- `non-node pubkeys are subject to both SDK and per-reducer pricing`
- `self-write bypass works with zero-amount packets`
- `self-write bypass logged at debug level`
- `SDK createPricingValidator allows free access for node own pubkey (SDK default)`

### 5. `packages/bitcraft-bls/src/__tests__/fee-schedule-endpoint.test.ts` (5 tests)

**Covers:** AC4
**Tests:**

- `GET /fee-schedule returns JSON fee schedule`
- `response includes all reducer costs`
- `response includes default cost`
- `endpoint returns default when no fee schedule loaded`
- `endpoint NEVER includes tokens or keys in response (OWASP A02)`

### 6. `packages/bitcraft-bls/src/__tests__/pricing-integration.test.ts` (6 tests, Docker-dependent)

**Covers:** AC1-5
**Tests:**

- `full handler flow with sufficient payment -- handler invoked, action succeeds`
- `handler with insufficient payment for specific reducer -- F04 rejection before handler`
- `SDK-level pricing: packet below kindPricing minimum -- F04 before handler`
- `per-reducer pricing: cheap action (player_move, cost 1) passes with small payment`
- `per-reducer pricing: expensive action (empire_form, cost 100) fails with small payment`
- `self-write bypass: node own pubkey processes action with zero payment`

### 7. `packages/bitcraft-bls/src/__tests__/fee-schedule-consistency.test.ts` (4 tests, Docker-dependent)

**Covers:** AC4
**Tests:**

- `BLS fee schedule format matches client ActionCostRegistry format`
- `cost lookup for player_move returns same value from BLS and client registries`
- `cost lookup for unknown reducer returns defaultCost from both sources`
- `GET /fee-schedule endpoint returns data compatible with client registry loader`

---

## Stub Module Created

### `packages/bitcraft-bls/src/fee-schedule.ts`

**Purpose:** TDD red phase stub -- provides type definitions and function signatures for test imports.
**Contents:**

- `FeeScheduleEntry` interface (cost, category?, frequency?)
- `FeeSchedule` interface (version, defaultCost, actions)
- `FeeScheduleError` class (extends Error, has code property)
- `loadFeeSchedule()` function -- throws `NOT_IMPLEMENTED`
- `getFeeForReducer()` function -- throws `NOT_IMPLEMENTED`

This stub ensures tests can import the module without compilation errors while maintaining the TDD red phase (all tests skipped with `it.skip()`).

---

## Implementation Checklist for DEV Team

### RED Phase (TEA -- COMPLETE)

- [x] All 51 acceptance tests generated with `it.skip()`
- [x] Stub module created with interfaces and throw-not-implemented functions
- [x] Full regression suite passes (124 existing tests pass, 86 skipped including 51 new)
- [x] No test interdependencies (all tests independent)

### GREEN Phase (DEV -- TODO)

For each item below, remove the `it.skip()` from related tests, implement the feature, and verify tests pass.

1. **Task 1: Implement `loadFeeSchedule()` and `getFeeForReducer()`**
   - Remove `it.skip()` from fee-schedule.test.ts (12 tests)
   - Implement JSON parsing, schema validation, file size limit check
   - Implement getFeeForReducer with defaultCost fallback
   - Tests: `pnpm --filter bitcraft-bls vitest run src/__tests__/fee-schedule.test.ts`

2. **Task 2: Extend BLSConfig with fee schedule fields**
   - Remove `it.skip()` from pricing-config.test.ts (11 tests)
   - Add `feeSchedulePath?: string` and `feeSchedule?: FeeSchedule` to BLSConfig
   - Read `BLS_FEE_SCHEDULE_PATH` env var in `loadConfig()`
   - Derive `kindPricing[30078]` as minimum of all action costs and defaultCost
   - Tests: `pnpm --filter bitcraft-bls vitest run src/__tests__/pricing-config.test.ts`

3. **Task 3: Add per-reducer pricing to handler**
   - Remove `it.skip()` from pricing-enforcement.test.ts (8 tests)
   - Extend `createGameActionHandler(config, identityPubkey?)` signature
   - After SDK gate passes, check `ctx.amount >= reducerCost` from fee schedule
   - Reject with F04 if insufficient, include reducer name and amounts in message
   - Tests: `pnpm --filter bitcraft-bls vitest run src/__tests__/pricing-enforcement.test.ts`

4. **Task 4: Implement self-write bypass**
   - Remove `it.skip()` from self-write-bypass.test.ts (5 tests)
   - Skip per-reducer pricing when `event.pubkey === identityPubkey`
   - Log bypass at debug level
   - Tests: `pnpm --filter bitcraft-bls vitest run src/__tests__/self-write-bypass.test.ts`

5. **Task 5: Add GET /fee-schedule endpoint**
   - Remove `it.skip()` from fee-schedule-endpoint.test.ts (5 tests)
   - Add `/fee-schedule` route to health server
   - Return JSON with version, defaultCost, actions (only these fields -- OWASP A02)
   - Return default `{ version: 1, defaultCost: 100, actions: {} }` when no fee schedule loaded
   - Tests: `pnpm --filter bitcraft-bls vitest run src/__tests__/fee-schedule-endpoint.test.ts`

6. **Task 6: Wire up in index.ts and verify integration**
   - Remove `it.skip()` from integration tests (pricing-integration, fee-schedule-consistency)
   - Update `main()` to pass `identity.pubkey` to handler
   - Export fee-schedule module from index.ts
   - Integration tests require Docker: `pnpm --filter bitcraft-bls test:integration`

### REFACTOR Phase (DEV -- after GREEN)

- Remove stub comments from fee-schedule.ts
- Extract shared test constants (pubkeys, event factories) if duplication emerges
- Review error messages for consistency with existing handler error patterns

---

## Running Tests

```bash
# Run all BLS unit tests
pnpm --filter bitcraft-bls test:unit

# Run a specific test file
pnpm --filter bitcraft-bls vitest run src/__tests__/fee-schedule.test.ts

# Run tests in watch mode (TDD)
pnpm --filter bitcraft-bls vitest src/__tests__/fee-schedule.test.ts

# Run integration tests (requires Docker)
pnpm --filter bitcraft-bls test:integration

# Run full regression
pnpm test:unit
```

---

## Validation Checklist

- [x] Story acceptance criteria analyzed and mapped to test levels
- [x] 51 failing tests created at unit level (all `it.skip()` for TDD red phase)
- [x] 10 integration tests created for Docker-dependent scenarios (skipped via `describe.skipIf`)
- [x] Given-When-Then format used consistently across all tests
- [x] RED phase verified by local test run (all 51 new tests skipped, 124 existing pass)
- [x] Test factories reused from existing patterns (createBLSConfig, createHandlerContext)
- [x] No hardcoded test data (factories with overrides used throughout)
- [x] No test interdependencies (all tests independent, can run in any order)
- [x] No flaky patterns (deterministic tests, mocked fs and console)
- [x] Security tests included (OWASP A02 endpoint safety, A03 file size limit)
- [x] Implementation checklist created with red-green-refactor guidance
- [x] Execution commands provided and verified

---

## Test Verification Results

```
Test Files  11 passed | 11 skipped (22)
     Tests  124 passed | 86 skipped (210)
  Duration  1.83s
```

- 51 new Story 3.3 tests: all properly skipped with `it.skip()`
- 124 existing tests: all passing (no regression)
- 10 Docker-dependent tests: skipped via `describe.skipIf(!shouldRun)`

Full regression across all packages: 767 tests passing (641 client + 124 BLS + 1 MCP + 1 TUI).
