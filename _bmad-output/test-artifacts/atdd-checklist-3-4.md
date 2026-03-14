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
  - '_bmad-output/implementation-artifacts/3-4-identity-propagation-and-end-to-end-verification.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/test-design-epic-3.md'
  - 'packages/bitcraft-bls/src/handler.ts'
  - 'packages/bitcraft-bls/src/index.ts'
  - 'packages/bitcraft-bls/src/content-parser.ts'
  - 'packages/bitcraft-bls/src/spacetimedb-caller.ts'
  - 'packages/bitcraft-bls/src/fee-schedule.ts'
  - 'packages/bitcraft-bls/src/config.ts'
  - 'packages/bitcraft-bls/src/__tests__/factories/bls-config.factory.ts'
  - 'packages/bitcraft-bls/src/__tests__/factories/handler-context.factory.ts'
  - 'packages/bitcraft-bls/src/__tests__/factories/identity.factory.ts'
  - 'packages/bitcraft-bls/src/__tests__/identity-prepend.test.ts'
  - 'packages/crosstown-sdk/src/index.ts'
---

# ATDD Checklist - Epic 3, Story 3.4: Identity Propagation & End-to-End Verification

**Date:** 2026-03-13
**Author:** TEA Agent (ATDD workflow)
**Primary Test Level:** Unit (backend, vitest)
**Total Tests Generated:** 60 (10 + 10 + 15 + 10 + 15)
**RED Phase Status:** All unit tests skipped with `it.skip()` -- stub modules created; integration tests skipped via `describe.skipIf`

---

## Story Summary

Story 3.4 is the final story in Epic 3 and the most important validation story in the BLS epic. It verifies that the full cryptographic identity chain works end-to-end: from client signing through BLS validation to SpacetimeDB reducer attribution. It adds explicit pubkey format validation (defense-in-depth), identity chain verification module, verification logging, and comprehensive tests for failure modes and the full pipeline.

**As a** researcher,
**I want** to verify that the full cryptographic chain works end-to-end -- from client signing through BLS validation to SpacetimeDB reducer attribution,
**So that** I can trust every game action is correctly attributed to the authoring player.

---

## Acceptance Criteria

1. **AC1 - Client signing through BLS verification** (FR4): Game action flows through Crosstown, SDK verifies Nostr signature via `createVerificationPipeline`, handler receives `ctx.pubkey`, SpacetimeDB reducer executes with verified identity.

2. **AC2 - Cryptographic chain integrity** (FR5): Signed event (client) -> signature verified (SDK) -> pubkey propagated to reducer (handler) -> game state attributed to player (SpacetimeDB). Chain intact end-to-end.

3. **AC3 - Invalid signature rejection** (NFR8, NFR13): Invalid Nostr signature rejected by SDK before handler invocation. No SpacetimeDB call. No game action attributed. Explicit error returned.

4. **AC4 - Zero silent failures for identity** (NFR27, NFR10): Identity propagation either succeeds with verified pubkey attribution or fails with explicit error. Zero silent failures.

5. **AC5 - Full pipeline integration test**: Full pipeline tested: `@crosstown/client` -> embedded connector -> BLS handler -> SpacetimeDB reducer with correct identity -> confirmation. Game state change attributed to correct Nostr pubkey.

---

## Preflight Summary

**Stack detected:** backend (Node.js + TypeScript + vitest)
**Test framework:** vitest (configured in packages/bitcraft-bls/vitest.config.ts)
**Existing patterns:** 23 test files in packages/bitcraft-bls/src/**tests**/, 3 test factories (bls-config, handler-context, identity)
**Knowledge loaded:** data-factories, test-quality, test-levels-framework, test-priorities-matrix
**E2E/Playwright:** Not applicable (backend-only story, no UI impact)
**Existing identity tests:** 6 tests in identity-prepend.test.ts (Story 3.2) -- DO NOT duplicate

---

## Test Strategy - AC to Test Level Mapping

| AC       | Test Level  | Test File                        | Test Count | Priority |
| -------- | ----------- | -------------------------------- | ---------- | -------- |
| AC1, AC2 | Unit        | identity-chain.test.ts           | 10         | P0       |
| AC1-4    | Unit        | identity-failure-modes.test.ts   | 10         | P0       |
| AC5      | Integration | e2e-identity-propagation.test.ts | 15         | P0       |
| AC3      | Integration | e2e-identity-rejection.test.ts   | 10         | P0       |
| AC1-5    | Integration | pipeline-integration.test.ts     | 15         | P1       |

---

## Test Files Created

### 1. `packages/bitcraft-bls/src/__tests__/identity-chain.test.ts` (10 tests)

**Covers:** AC1, AC2
**Tests:**

- `verifyIdentityChain() with valid ctx.pubkey and matching first arg returns chainIntact: true`
- `verifyIdentityChain() with mismatched pubkey and first arg throws IdentityChainError (IDENTITY_MISMATCH)`
- `verifyIdentityChain() with invalid pubkey format (too short) throws IdentityChainError (IDENTITY_INVALID)`
- `verifyIdentityChain() with invalid pubkey format (non-hex chars) throws IdentityChainError (IDENTITY_INVALID)`
- `verifyIdentityChain() with uppercase hex pubkey throws IdentityChainError (IDENTITY_INVALID)`
- `verifyIdentityChain() with empty pubkey throws IdentityChainError (IDENTITY_INVALID)`
- `handler receives ctx.pubkey and prepends it as first arg -- identity propagation verified`
- `handler with valid ctx.pubkey logs identity propagation with eventId and truncated pubkey`
- `handler with invalid ctx.pubkey format rejects with F06`
- `every handler code path results in either ctx.accept() or ctx.reject() (zero silent failures)`

### 2. `packages/bitcraft-bls/src/__tests__/identity-failure-modes.test.ts` (10 tests)

**Covers:** AC1, AC2, AC3, AC4
**Tests:**

- `handler invoked with missing ctx.pubkey (undefined cast) rejects with F06`
- `handler invoked with non-string ctx.pubkey (number cast) rejects with F06`
- `handler invoked with wrong-length pubkey (32 chars) rejects with F06`
- `handler invoked with pubkey containing uppercase hex rejects with F06`
- `handler rejects invalid pubkey BEFORE SpacetimeDB call (no wasted API call)`
- `handler error includes event ID and pubkey for debugging`
- `handler with valid pubkey succeeds (control test)`
- `rejection path is explicit (returns ctx.reject, not thrown error swallowed)`
- `ReducerCallError from SpacetimeDB results in explicit T00 rejection (not silent)`
- `unexpected error results in explicit T00 rejection with "Internal error" prefix (not silent)`

### 3. `packages/bitcraft-bls/src/__tests__/e2e-identity-propagation.test.ts` (15 tests, Docker-dependent)

**Covers:** AC5
**Tests:**

- `full pipeline: client.publish() -> Crosstown -> BLS handler -> SpacetimeDB reducer with correct identity -> confirmation`
- `verify game state change attributed to correct Nostr pubkey`
- `test with 3 different keypairs -- each action attributed to correct identity`
- `sequential actions from same identity -- all attributed to same pubkey`
- `ctx.pubkey in handler matches the signing pubkey from @crosstown/client`
- `argsWithIdentity[0] (first reducer arg) matches ctx.pubkey`
- `round-trip: publish -> confirmation received via Nostr relay subscription`
- `pubkey format is 64-char lowercase hex in SpacetimeDB call`
- `identity propagation succeeds when fee schedule is active`
- `identity propagation succeeds when self-write bypass is active`
- `SpacetimeDB receives args as [pubkey, ...originalArgs] format`
- `health endpoint shows connected status after identity-propagated action`
- `identity propagation logging includes eventId and truncated pubkey`
- `round-trip latency < 2s for identity-propagated action (NFR3)`
- `10 sequential actions from same identity all succeed with correct attribution`

### 4. `packages/bitcraft-bls/src/__tests__/e2e-identity-rejection.test.ts` (10 tests, Docker-dependent)

**Covers:** AC3
**Tests:**

- `invalid signature: forged event rejected by SDK, handler never invoked`
- `tampered event content (content changed after signing) rejected (signature mismatch)`
- `tampered event ID rejected (ID mismatch)`
- `missing signature field rejected`
- `no SpacetimeDB reducer call made for any rejected event`
- `no game state change for rejected events`
- `explicit error returned to sender for each rejection`
- `rejection logged with event ID and pubkey`
- `handler invocation count is zero for all rejected events`
- `rejected events do not appear in SpacetimeDB action history`

### 5. `packages/bitcraft-bls/src/__tests__/pipeline-integration.test.ts` (15 tests, Docker-dependent)

**Covers:** AC1-5 (cross-story)
**Tests:**

- `PIPE-01: happy path: valid game action -> reducer executes -> success, identity correct`
- `PIPE-02: invalid content: malformed JSON -> rejected before reducer, no identity propagation`
- `PIPE-03: unknown reducer -> clear error, no state change`
- `PIPE-04: invalid signature -> rejected by SDK before handler, handler never invoked`
- `PIPE-05: insufficient payment -> rejected by SDK with F04`
- `PIPE-06: identity verification: pubkey matches SpacetimeDB attribution in reducer args`
- `PIPE-07: SpacetimeDB timeout -> timeout error, identity still valid in args`
- `PIPE-08: concurrent actions from 5 simultaneous game actions -> all processed, no identity confusion`
- `PIPE-09: sequential actions: 10 actions from same identity -> all attributed to same pubkey`
- `PIPE-10: multi-identity: actions from 3 different keypairs -> each attributed to correct pubkey`
- `cross-story: handler uses fee schedule from Story 3.3, identity from Story 3.2, node from Story 3.1`
- `round-trip latency < 2s (NFR3) for identity-propagated action`
- `SpacetimeDB receives [pubkey, ...originalArgs] format`
- `health endpoint shows connected status after identity-propagated action`
- `identity chain is intact when pricing bypass is active (self-write)`

---

## Stub Modules Created

### `packages/bitcraft-bls/src/identity-chain.ts`

**Purpose:** TDD red phase stub -- provides type definitions and function signatures for test imports.
**Contents:**

- `IdentityChainResult` interface (`pubkey`, `reducerCalled`, `identityPropagated`, `chainIntact`)
- `IdentityChainError` class (extends Error, has `code` property -- follows ContentParseError/FeeScheduleError pattern)
- `verifyIdentityChain()` function -- throws `NOT_IMPLEMENTED`

### `packages/bitcraft-bls/src/verification.ts`

**Purpose:** TDD red phase stub -- provides verification logging types and functions.
**Contents:**

- `VerificationConfig` interface (`rejectInvalidSignatures`, `logRejections`)
- `logVerificationEvent()` function -- throws `NOT_IMPLEMENTED`

---

## Implementation Checklist for DEV Team

### RED Phase (TEA -- COMPLETE)

- [x] All 20 unit acceptance tests generated with `it.skip()`
- [x] 40 integration tests created with `describe.skipIf` (Docker-dependent)
- [x] Stub modules created with interfaces and throw-not-implemented functions
- [x] Full regression suite passes (all existing tests pass, new tests properly skipped)
- [x] No test interdependencies (all tests independent)

### GREEN Phase (DEV -- TODO)

For each item below, remove the `it.skip()` from related tests, implement the feature, and verify tests pass.

1. **Task 1: Implement identity chain verification module**
   - Remove `it.skip()` from identity-chain.test.ts (10 tests)
   - Create `packages/bitcraft-bls/src/identity-chain.ts` with:
     - `IdentityChainResult` interface
     - `IdentityChainError` class extending Error with `code` field
     - `verifyIdentityChain(ctx, reducerName, argsWithIdentity)` function
   - Validation: pubkey must be 64-char lowercase hex, first arg must match pubkey
   - Tests: `pnpm --filter bitcraft-bls vitest run src/__tests__/identity-chain.test.ts`

2. **Task 2: Integrate identity validation into handler flow**
   - Remove `it.skip()` from identity-failure-modes.test.ts (10 tests)
   - Modify `handler.ts`: add pubkey format validation before identity prepend (Step 4)
   - Add explicit check: `typeof ctx.pubkey !== 'string'` or length !== 64 -> reject F06
   - Add explicit check: `/^[0-9a-f]{64}$/` regex test -> reject F06 on failure
   - Log identity propagation after successful validation
   - Audit all code paths for explicit accept/reject (zero silent failures)
   - Tests: `pnpm --filter bitcraft-bls vitest run src/__tests__/identity-failure-modes.test.ts`

3. **Task 3: Create verification logging module**
   - Create `packages/bitcraft-bls/src/verification.ts` with:
     - `VerificationConfig` interface
     - `logVerificationEvent()` function
   - Update `index.ts` exports: add identity-chain and verification exports
   - Tests: verified via identity-chain.test.ts integration with logging

4. **Task 4: Create end-to-end pipeline tests (Docker-dependent)**
   - e2e-identity-propagation.test.ts (15 tests): full pipeline identity verification
   - e2e-identity-rejection.test.ts (10 tests): invalid signature rejection
   - pipeline-integration.test.ts (15 tests): cross-story integration
   - All use `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS || !process.env.BLS_AVAILABLE)` pattern
   - Tests: `pnpm --filter bitcraft-bls test:integration` (requires Docker)

### REFACTOR Phase (DEV -- after GREEN)

- Remove stub comments from identity-chain.ts and verification.ts
- Review error messages for consistency with existing handler error patterns
- Verify no duplication with existing identity-prepend.test.ts (6 tests from Story 3.2)

---

## Running Tests

```bash
# Run all BLS unit tests
pnpm --filter bitcraft-bls test:unit

# Run a specific test file
pnpm --filter bitcraft-bls vitest run src/__tests__/identity-chain.test.ts

# Run tests in watch mode (TDD)
pnpm --filter bitcraft-bls vitest src/__tests__/identity-chain.test.ts

# Run integration tests (requires Docker)
pnpm --filter bitcraft-bls test:integration

# Run full regression
pnpm test:unit
```

---

## Validation Checklist

- [x] Story acceptance criteria analyzed and mapped to test levels
- [x] 20 unit tests created at unit level (all `it.skip()` for TDD red phase)
- [x] 40 integration tests created for Docker-dependent scenarios (skipped via `describe.skipIf`)
- [x] Given-When-Then format used consistently across all tests
- [x] RED phase verified by local test run (new tests skipped, existing pass)
- [x] Test factories reused from existing patterns (createBLSConfig, createHandlerContext)
- [x] No hardcoded test data (factories with overrides used throughout)
- [x] No test interdependencies (all tests independent, can run in any order)
- [x] No flaky patterns (deterministic tests, mocked fs and console)
- [x] Security tests included (OWASP A01 identity validation, A02 no secrets in logs, A03 regex validation, A04 defense-in-depth, A09 logging)
- [x] Implementation checklist created with red-green-refactor guidance
- [x] Execution commands provided and verified
- [x] No duplication with existing identity-prepend.test.ts (6 tests from Story 3.2)
