# Epic 3: Test Design - BitCraft BLS Game Action Handler

**Epic:** Epic 3 - BitCraft BLS Game Action Handler
**Test Design Type:** Risk-Based Test Plan
**Epic-Level Analysis Mode:** ENABLED
**Created:** 2026-03-13
**Test Architect:** Claude Opus 4.6 (claude-opus-4-6)

---

## Executive Summary

This test design defines the comprehensive testing strategy for Epic 3: BitCraft BLS Game Action Handler. Epic 3 is the first server-side component in the Sigil platform -- a Crosstown node built with `@crosstown/sdk` that receives ILP-routed game action events, validates Nostr signatures, propagates player identity, and calls SpacetimeDB reducers. It runs in Docker alongside the BitCraft server.

**Epic 3 Objectives:**

- Stand up `packages/bitcraft-bls` package with `@crosstown/sdk` embedded connector mode (Story 3.1)
- Implement kind 30078 game action handler: parse reducer/args, call SpacetimeDB with identity (Story 3.2)
- Configure per-action-type pricing via `kindPricing` and fee schedule (Story 3.3)
- Verify end-to-end cryptographic identity chain: client signing -> SDK verification -> reducer attribution (Story 3.4)

**Why This Epic Is High Risk:**

1. **First server-side component** -- new infrastructure pattern (Docker, networking, lifecycle management)
2. **External SDK dependency** -- `@crosstown/sdk@^0.1.4` is an external npm package with limited community adoption; API surface may have undocumented behavior
3. **Docker networking** -- BLS container must communicate with SpacetimeDB container over internal Docker network
4. **SpacetimeDB HTTP API** -- BLS calls reducers via HTTP POST; error handling, auth tokens, and identity propagation are all new integration points
5. **ILP error code mapping** -- Crosstown SDK uses ILP error codes (F04, F06, T00) that must be mapped to Sigil error semantics

**Test Strategy:**

- **Risk-Based Prioritization:** Focus on high-risk integration points (SDK API surface, SpacetimeDB HTTP calls, identity propagation)
- **TDD Approach:** Write tests before implementation (AGREEMENT-1: all stories have >3 acceptance criteria)
- **Security-First:** OWASP Top 10 review on every story (AGREEMENT-2)
- **Contract Testing:** Validate BLS handler against the integration contract spec'd in Story 2.4
- **Layered Mocking:** Unit tests mock `@crosstown/sdk` internals; integration tests use real Docker stack

**Target Metrics:**

- **Test Coverage:** >=95% line coverage for all `packages/bitcraft-bls` code
- **P0 Acceptance Criteria:** 100% coverage (gate requirement)
- **Integration Tests:** >=80% of acceptance criteria validated via integration tests
- **Performance:** <500ms BLS event processing latency (p99), <2s full round-trip (NFR3)
- **Security:** OWASP Top 10 compliant, zero high-severity issues
- **Regression:** All 651 existing tests continue to pass

---

## Table of Contents

1. [Epic-Level Risk Assessment](#1-epic-level-risk-assessment)
2. [Test Strategy Per Story](#2-test-strategy-per-story)
3. [Cross-Story Integration Tests](#3-cross-story-integration-tests)
4. [Test Infrastructure Needs](#4-test-infrastructure-needs)
5. [Risk-Based Prioritization](#5-risk-based-prioritization)
6. [Security Test Plan](#6-security-test-plan)
7. [Performance Test Plan](#7-performance-test-plan)
8. [Test Data & Fixtures](#8-test-data--fixtures)
9. [Quality Gates](#9-quality-gates)

---

## 1. Epic-Level Risk Assessment

### 1.1 Risk Register

| Risk ID    | Risk Description                                                                                             | Likelihood | Impact       | Risk Score   | Mitigation Strategy                                                                                                              | Test Strategy                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ---------- | ------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **R3-001** | `@crosstown/sdk` API does not behave as documented (limited adoption, version 0.1.x)                         | **High**   | **CRITICAL** | **CRITICAL** | PREP-E3-2 validates SDK API before implementation; fallback to raw HTTP connector if SDK fails                                   | SDK smoke tests in Story 3.1; mock SDK for unit tests; integration tests validate real SDK behavior           |
| **R3-002** | Docker networking: BLS cannot reach SpacetimeDB container over internal network                              | Medium     | **CRITICAL** | **HIGH**     | Validate Docker compose networking in Story 3.1; use Docker health checks with dependency ordering                               | Integration tests require full Docker stack; network connectivity tests in Story 3.1                          |
| **R3-003** | SpacetimeDB HTTP API returns unexpected responses or requires undocumented auth                              | Medium     | High         | **HIGH**     | Document actual SpacetimeDB HTTP API behavior in Story 3.2; test all response codes (200, 400, 404, 500)                         | Comprehensive HTTP response handling tests; mock SpacetimeDB for unit tests; real SpacetimeDB for integration |
| **R3-004** | Identity propagation fails: pubkey not correctly prepended to reducer args                                   | Low        | **CRITICAL** | **HIGH**     | Contract spec defines exact format; unit tests validate arg construction; E2E tests verify SpacetimeDB receives correct identity | End-to-end identity verification tests in Story 3.4; unit tests for arg prepending in Story 3.2               |
| **R3-005** | ILP error code mapping: SDK error codes (F04, F06, T00) not correctly mapped to BLS error semantics          | Medium     | High         | **HIGH**     | Map all SDK error codes in Story 3.2; document mapping in contract spec                                                          | Unit tests for each error code mapping; integration tests trigger real SDK errors                             |
| **R3-006** | BLS process lifecycle: graceful shutdown drops in-flight packets                                             | Medium     | Medium       | **MEDIUM**   | Implement SIGTERM/SIGINT handlers in Story 3.1; test with in-flight requests                                                     | Lifecycle tests: start, stop, restart; in-flight packet handling during shutdown                              |
| **R3-007** | Kind pricing configuration mismatch between BLS and client action cost registry                              | Medium     | Medium       | **MEDIUM**   | Single source of truth for fee schedule; BLS loads same registry format as client                                                | Configuration validation tests; consistency tests between BLS and client cost registries                      |
| **R3-008** | SpacetimeDB reducers reject identity parameter (BitCraft reducers not yet modified to accept `nostr_pubkey`) | Medium     | High         | **HIGH**     | Story 3.2 requires reducer modification; test with modified reducers only                                                        | Integration tests call real reducers with identity; unit tests mock SpacetimeDB response                      |
| **R3-009** | Embedded connector mode has different behavior than standalone mode (undocumented differences)               | Medium     | Medium       | **MEDIUM**   | PREP-E3-2 validates embedded mode specifically; test both modes if feasible                                                      | Story 3.1 validates embedded connector initialization and packet delivery                                     |
| **R3-010** | BLS handler performance: event processing exceeds 500ms latency budget under load                            | Low        | Medium       | **LOW**      | Performance budgets defined in contract spec; monitor per-step latency                                                           | Performance tests: baseline, sustained load (10 actions/sec), burst load                                      |

### 1.2 Risk Scoring Matrix

**Impact Levels:**

- **CRITICAL:** System unusable, data loss, security breach, identity mis-attribution
- **High:** Major feature broken, significant user impact
- **Medium:** Feature degradation, workaround available
- **Low:** Minor inconvenience, cosmetic issue

**Likelihood Levels:**

- **High:** >50% chance -- new technology, limited docs
- **Medium:** 20-50% chance -- integration complexity
- **Low:** <20% chance -- well-understood patterns

**Risk Score Calculation:**

- **CRITICAL:** Critical Impact + High Likelihood
- **HIGH:** Critical Impact + Medium/Low Likelihood OR High Impact + High Likelihood
- **MEDIUM:** High Impact + Low Likelihood OR Medium Impact
- **LOW:** Low Impact

### 1.3 Key Risk Insight

**R3-001 is the dominant risk.** `@crosstown/sdk@^0.1.4` is a pre-1.0 external dependency. The entire BLS architecture depends on its `createNode()`, `createVerificationPipeline`, `createPricingValidator`, and `HandlerContext` APIs working as described in the architecture doc. If the SDK behaves differently than expected, the entire epic is blocked.

**Mitigation priority:**

1. PREP-E3-2 (validate SDK API) must complete before Story 3.1 begins
2. Story 3.1 tests should be the first integration point -- fail fast if SDK is incompatible
3. All unit tests must mock the SDK at the module boundary, not at internal implementation details

---

## 2. Test Strategy Per Story

### 2.1 Story 3.1: BLS Package Setup & Crosstown SDK Node

**Acceptance Criteria:** 5 ACs (all P0)
**Risk Mitigation:** R3-001 (SDK API), R3-002 (Docker networking), R3-006 (lifecycle), R3-009 (embedded mode)
**TDD Required:** YES (5 ACs)
**Integration Tests:** REQUIRED (Docker stack with BLS container)

**Risk Assessment:** This is the highest-risk story. It introduces a new package, a new external SDK dependency, and Docker infrastructure. Everything else in Epic 3 depends on Story 3.1 working.

#### Unit Tests (~35 tests)

| Test Suite                  | Test Count | Focus Area                                                                         |
| --------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `node-setup.test.ts`        | 12         | `createNode()` configuration, embedded connector mode, secretKey/mnemonic identity |
| `node-lifecycle.test.ts`    | 10         | `node.start()`, `node.stop()`, SIGTERM/SIGINT handling, graceful shutdown          |
| `health-check.test.ts`      | 8          | Health endpoint: pubkey, EVM address, connected status                             |
| `config-validation.test.ts` | 5          | Environment variables, missing config, invalid values                              |

#### Integration Tests (~15 tests)

| Test Suite                             | Test Count | Focus Area                                                                               |
| -------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `bls-docker-integration.test.ts`       | 8          | BLS container starts, connects to SpacetimeDB, health check passes                       |
| `bls-connectivity-integration.test.ts` | 7          | Docker network connectivity, SpacetimeDB reachability, embedded connector initialization |

#### Key Test Cases

**AC1 - SDK Dependency & Package Setup:**

- `createNode()` is callable with embedded connector config
- `@crosstown/sdk` is listed as dependency in `packages/bitcraft-bls/package.json`
- Package builds without errors (`pnpm build --filter @sigil/bitcraft-bls`)

**AC2 - Node Initialization (Embedded Connector Mode):**

- `createNode()` called with `connector` parameter (not `connectorUrl`) for embedded mode
- Node identity derived from `secretKey` environment variable
- `node.start()` resolves successfully and begins processing
- Node identity derivable from `generateMnemonic()` as fallback
- Reject invalid secretKey format (wrong length, non-hex)

**AC3 - Health Check:**

- Health endpoint returns node pubkey, EVM address, connected status
- Health check reports `connected: false` before `node.start()`
- Health check reports `connected: true` after successful start
- Health check logs pubkey and ILP address on startup

**AC4 - Docker Compose Integration:**

- BLS container added to `docker/docker-compose.yml`
- BLS container starts after BitCraft server is healthy (depends_on with health check)
- BLS connects to SpacetimeDB via Docker internal network (e.g., `http://bitcraft-server:3000`)
- Environment variables passed correctly from compose file

**AC5 - Graceful Shutdown:**

- `node.stop()` called on SIGTERM
- `node.stop()` called on SIGINT
- In-flight packet processing completes before shutdown
- Process exits cleanly (exit code 0) after shutdown

#### Mocks Required

```typescript
// Mock @crosstown/sdk for unit tests
vi.mock('@crosstown/sdk', () => ({
  createNode: vi.fn().mockReturnValue({
    start: vi.fn().mockResolvedValue({ peerCount: 1, channelCount: 1 }),
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    identity: { pubkey: 'mock_pubkey', evmAddress: '0xmock' },
  }),
  fromSecretKey: vi.fn().mockReturnValue({ pubkey: 'mock_pubkey' }),
  generateMnemonic: vi.fn().mockReturnValue('test mnemonic words...'),
}));
```

#### Estimated Test Count: 50 tests (35 unit + 15 integration)

---

### 2.2 Story 3.2: Game Action Handler (kind 30078)

**Acceptance Criteria:** 5 ACs (all P0)
**Risk Mitigation:** R3-003 (SpacetimeDB HTTP API), R3-004 (identity propagation), R3-005 (ILP error codes), R3-008 (reducer identity param)
**TDD Required:** YES (5 ACs)
**Integration Tests:** REQUIRED (BLS + SpacetimeDB)
**Pair Programming:** REQUIRED (AGREEMENT-3 -- unfamiliar tech: @crosstown/sdk handler API)

**Risk Assessment:** This is the core handler implementation. It integrates three external systems (SDK HandlerContext, SpacetimeDB HTTP API, Nostr event content format). The most common failure mode will be incorrect SpacetimeDB HTTP API usage.

#### Unit Tests (~45 tests)

| Test Suite                   | Test Count | Focus Area                                                                         |
| ---------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `handler-dispatch.test.ts`   | 10         | Handler registration on kind 30078, `ctx.decode()` usage, handler invocation       |
| `content-parser.test.ts`     | 12         | Parse `event.content` JSON, extract `reducer` and `args`, validate format          |
| `spacetimedb-caller.test.ts` | 12         | HTTP POST to `/database/bitcraft/call/{reducer}`, headers, body, response handling |
| `identity-prepend.test.ts`   | 6          | Prepend `ctx.pubkey` to args array, npub conversion, arg preservation              |
| `error-mapping.test.ts`      | 5          | Map SpacetimeDB HTTP errors to `ctx.reject()` ILP error codes                      |

#### Integration Tests (~20 tests)

| Test Suite                          | Test Count | Focus Area                                                                            |
| ----------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `handler-e2e-integration.test.ts`   | 12         | Full handler flow: ILP packet -> decode -> parse -> SpacetimeDB call -> accept/reject |
| `handler-error-integration.test.ts` | 8          | Invalid content, unknown reducer, SpacetimeDB errors, zero silent failures            |

#### Key Test Cases

**AC1 - Event Decoding and Content Parsing:**

- Handler calls `ctx.decode()` to get full `NostrEvent`
- Parses `event.content` as JSON with `{ reducer, args }` structure
- SDK has already validated Nostr signature via `createVerificationPipeline`
- Handler receives pre-verified `ctx.pubkey`

**AC2 - SpacetimeDB Reducer Call with Identity:**

- HTTP POST to `POST /database/bitcraft/call/{reducer}`
- Request body: `[ctx.pubkey, ...args]` (pubkey prepended as first argument)
- `Authorization: Bearer {SPACETIMEDB_TOKEN}` header present
- `Content-Type: application/json` header present
- Handler returns `ctx.accept({ eventId: event.id })` on 200 OK

**AC3 - Invalid Content Handling:**

- Malformed JSON content returns `ctx.reject('F06', 'Invalid event content: missing reducer or args')`
- Missing `reducer` field returns `ctx.reject('F06', ...)`
- Missing `args` field returns `ctx.reject('F06', ...)`
- Non-string `reducer` returns `ctx.reject('F06', ...)`
- No SpacetimeDB call is made on content parsing failure

**AC4 - Unknown Reducer / SpacetimeDB Errors:**

- SpacetimeDB 404 returns `ctx.reject('T00', 'Unknown reducer: {name}')`
- SpacetimeDB 400 returns `ctx.reject('T00', 'Reducer {name} failed: {error}')`
- SpacetimeDB 500 returns `ctx.reject('T00', 'Reducer {name} failed: {error}')`
- SpacetimeDB timeout (>30s) returns `ctx.reject('T00', ...)`
- Error logged with event ID, pubkey (truncated), reducer name, error reason

**AC5 - Zero Silent Failures (NFR27):**

- Every handler execution results in either `ctx.accept()` or `ctx.reject()`
- No unhandled exceptions -- all errors caught and mapped to `ctx.reject()`
- All errors include: event ID, pubkey (truncated), reducer name, error reason
- No swallowed promises or fire-and-forget async calls

#### ILP Error Code Mapping (Critical for R3-005)

| Condition                          | ILP Code | Message Pattern                                  | Retryable |
| ---------------------------------- | -------- | ------------------------------------------------ | --------- |
| SDK: invalid signature             | `F06`    | (handled by SDK, not our handler)                | No        |
| SDK: insufficient payment          | `F04`    | (handled by SDK, not our handler)                | No        |
| Handler: invalid JSON content      | `F06`    | `Invalid event content: ...`                     | No        |
| Handler: missing reducer/args      | `F06`    | `Invalid event content: missing reducer or args` | No        |
| SpacetimeDB: 404 (unknown reducer) | `T00`    | `Unknown reducer: {name}`                        | No        |
| SpacetimeDB: 400 (bad args)        | `T00`    | `Reducer {name} failed: {error}`                 | No        |
| SpacetimeDB: 500 (internal error)  | `T00`    | `Reducer {name} failed: {error}`                 | Yes       |
| SpacetimeDB: timeout               | `T00`    | `Reducer {name} timed out`                       | Yes       |
| Handler: unexpected error          | `T00`    | `Internal error: {message}`                      | Yes       |

#### Mocks Required

```typescript
// Mock HandlerContext for unit tests
function createMockContext(overrides?: Partial<HandlerContext>): HandlerContext {
  const event = {
    id: 'test_event_id',
    pubkey: 'abc123def456...',
    kind: 30078,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify({ reducer: 'player_move', args: [{ x: 100 }, { x: 200 }] }),
    sig: 'valid_sig...',
  };
  return {
    kind: 30078,
    pubkey: event.pubkey,
    amount: 100n,
    destination: 'g.crosstown.bitcraft',
    toon: 'base64_toon...',
    decode: vi.fn().mockReturnValue(event),
    accept: vi.fn().mockReturnValue({ fulfillment: Buffer.alloc(32) }),
    reject: vi.fn().mockReturnValue({ code: 'T00', message: 'test' }),
    ...overrides,
  };
}

// Mock fetch for SpacetimeDB HTTP calls
vi.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
  // Return appropriate responses based on URL and body
});
```

#### Estimated Test Count: 65 tests (45 unit + 20 integration)

---

### 2.3 Story 3.3: Pricing Configuration & Fee Schedule

**Acceptance Criteria:** 5 ACs (all P0)
**Risk Mitigation:** R3-007 (pricing mismatch)
**TDD Required:** YES (5 ACs)
**Integration Tests:** REQUIRED (pricing enforcement with real SDK)

**Risk Assessment:** Medium risk. The SDK handles pricing enforcement automatically via `createPricingValidator`. Our main risk is configuration mismatch between the BLS `kindPricing` and the client's action cost registry.

#### Unit Tests (~30 tests)

| Test Suite                    | Test Count | Focus Area                                                                       |
| ----------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `pricing-config.test.ts`      | 10         | `kindPricing` configuration in `createNode()`, per-action pricing map            |
| `fee-schedule-loader.test.ts` | 10         | JSON fee schedule loading, validation, format compatibility with client registry |
| `pricing-enforcement.test.ts` | 5          | SDK `createPricingValidator` integration, insufficient payment rejection (F04)   |
| `self-write-bypass.test.ts`   | 5          | Node's own pubkey skips pricing (SDK default), verify bypass behavior            |

#### Integration Tests (~10 tests)

| Test Suite                         | Test Count | Focus Area                                                        |
| ---------------------------------- | ---------- | ----------------------------------------------------------------- |
| `pricing-integration.test.ts`      | 6          | Real SDK pricing enforcement, F04 rejection for underpaid packets |
| `fee-schedule-consistency.test.ts` | 4          | BLS fee schedule matches client action cost registry              |

#### Key Test Cases

**AC1 - Kind Pricing Configuration:**

- `createNode()` receives `kindPricing: { 30078: <price> }` (FR20)
- SDK's `createPricingValidator` automatically rejects underpaid packets
- Pricing validated at startup (reject invalid/negative prices)

**AC2 - Per-Action-Type Fee Schedule:**

- JSON fee schedule file loaded at startup
- Different reducers can have different costs (FR45)
- Fee schedule exposed in format compatible with `@sigil/client` action cost registry (Story 2.2)
- Invalid fee schedule file causes startup failure with clear error

**AC3 - SDK Pricing Enforcement:**

- Packet with payment >= configured price -> handler invoked
- Packet with payment < configured price -> SDK rejects with F04 before handler
- Self-write bypass: node's own pubkey skips pricing check (SDK default)

**AC4 - Client Registry Consistency:**

- BLS fee schedule and client action cost registry use compatible formats
- Cost lookup for any reducer returns same value from both sources (NFR12)
- Fee is publicly verifiable (exposed via API or config file)

**AC5 - Concurrent Fee Accounting:**

- Multiple ILP fees validated simultaneously (10 concurrent packets)
- SDK handles payment validation atomically per packet (NFR17)
- No double-charge or missed validation under concurrent load

#### Estimated Test Count: 40 tests (30 unit + 10 integration)

---

### 2.4 Story 3.4: Identity Propagation & End-to-End Verification

**Acceptance Criteria:** 5 ACs (all P0)
**Risk Mitigation:** R3-004 (identity propagation), R3-008 (reducer identity param)
**TDD Required:** YES (5 ACs)
**Integration Tests:** REQUIRED (full pipeline: client -> Crosstown -> BLS -> SpacetimeDB)
**Pair Programming:** REQUIRED (AGREEMENT-3 -- end-to-end cryptographic chain)

**Risk Assessment:** This is the highest-value story -- it validates that the entire cryptographic identity chain works. It is also the most complex to test because it requires the full Docker stack running with all services communicating correctly.

#### Unit Tests (~20 tests)

| Test Suite                       | Test Count | Focus Area                                                                      |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `identity-chain.test.ts`         | 10         | Verify cryptographic chain: signed event -> verified pubkey -> reducer arg      |
| `identity-failure-modes.test.ts` | 10         | Invalid signature rejection, pubkey mismatch, missing identity, explicit errors |

#### Integration Tests (~25 tests)

| Test Suite                         | Test Count | Focus Area                                                                                         |
| ---------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `e2e-identity-propagation.test.ts` | 15         | Full pipeline: `client.publish()` -> Crosstown -> BLS -> SpacetimeDB reducer with correct identity |
| `e2e-identity-rejection.test.ts`   | 10         | Invalid signature rejected before handler, no reducer call, no game state change                   |

#### Key Test Cases

**AC1 - Client Signing Through BLS Verification:**

- `client.publish()` creates signed ILP packet
- SDK's `createVerificationPipeline` verifies Nostr signature automatically
- Handler receives `ctx.pubkey` -- the verified authoring public key
- SpacetimeDB reducer executes with that pubkey as player identity (FR4)

**AC2 - Cryptographic Chain Integrity:**

- Signed event (client) -> signature verified (SDK) -> pubkey propagated to reducer (handler) -> game state attributed to player (SpacetimeDB) (FR5)
- Chain verified by checking SpacetimeDB game state reflects the action attributed to the correct pubkey

**AC3 - Invalid Signature Rejection (NFR8, NFR13):**

- ILP packet with invalid Nostr signature rejected by SDK before handler invocation
- No SpacetimeDB reducer call made for invalid signatures
- No game action attributed to the claimed pubkey
- Explicit error returned to sender

**AC4 - Zero Silent Failures for Identity (NFR27, NFR10):**

- Identity propagation either succeeds with verified pubkey or fails with explicit error
- No reducer executes without verified Nostr public key attribution
- All identity-related errors are logged and returned

**AC5 - Full Pipeline Integration Test:**

- Event published via `@crosstown/client` -> routed through embedded connector -> processed by BLS handler -> SpacetimeDB reducer called with correct identity -> confirmation received on Nostr relay
- Test verifies the game state change is attributed to the correct Nostr pubkey
- Requires full Docker stack running

#### Estimated Test Count: 45 tests (20 unit + 25 integration)

---

## 3. Cross-Story Integration Tests

These tests span multiple stories and validate end-to-end flows that no single story can test in isolation.

### 3.1 Full Pipeline Tests (Stories 3.1 + 3.2 + 3.4)

**Test Suite:** `packages/bitcraft-bls/src/__tests__/pipeline-integration.test.ts`
**Estimated Count:** 15 tests
**Requires:** Full Docker stack (BitCraft server + Crosstown node + BLS handler)

| Test ID     | Scenario                                                        | Stories       | Expected Result                                       |
| ----------- | --------------------------------------------------------------- | ------------- | ----------------------------------------------------- |
| **PIPE-01** | Happy path: valid game action -> reducer executes -> success    | 3.1, 3.2, 3.4 | `ctx.accept()` returned, SpacetimeDB state updated    |
| **PIPE-02** | Invalid content: malformed JSON -> rejected before reducer call | 3.1, 3.2      | `ctx.reject('F06', ...)`, no SpacetimeDB call         |
| **PIPE-03** | Unknown reducer: non-existent reducer -> clear error            | 3.1, 3.2      | `ctx.reject('T00', ...)`, no SpacetimeDB state change |
| **PIPE-04** | Invalid signature: forged event -> rejected by SDK              | 3.1, 3.4      | SDK rejects with F06, handler never invoked           |
| **PIPE-05** | Insufficient payment: underpaid packet -> rejected by SDK       | 3.1, 3.3      | SDK rejects with F04, handler never invoked           |
| **PIPE-06** | Identity verification: pubkey matches SpacetimeDB attribution   | 3.2, 3.4      | Reducer receives correct pubkey as first arg          |
| **PIPE-07** | SpacetimeDB timeout: reducer takes >30s -> timeout error        | 3.1, 3.2      | `ctx.reject('T00', ...)` with timeout message         |
| **PIPE-08** | Concurrent actions: 5 simultaneous game actions                 | 3.1, 3.2, 3.3 | All actions processed, no lost packets                |
| **PIPE-09** | Sequential actions: 10 actions from same identity               | 3.2, 3.4      | All attributed to same pubkey                         |
| **PIPE-10** | Multi-identity: actions from 3 different keypairs               | 3.2, 3.4      | Each attributed to correct pubkey                     |

### 3.2 Pricing + Handler Tests (Stories 3.2 + 3.3)

**Test Suite:** `packages/bitcraft-bls/src/__tests__/pricing-handler-integration.test.ts`
**Estimated Count:** 8 tests

| Test ID      | Scenario                                                       | Stories  | Expected Result                             |
| ------------ | -------------------------------------------------------------- | -------- | ------------------------------------------- |
| **PRICE-01** | Paid action: payment meets fee -> handler invoked              | 3.2, 3.3 | Handler processes action normally           |
| **PRICE-02** | Underpaid action: payment below fee -> SDK rejects             | 3.2, 3.3 | F04 error, handler not invoked              |
| **PRICE-03** | Free action (self-write): node's own pubkey -> bypass pricing  | 3.2, 3.3 | Handler invoked despite zero payment        |
| **PRICE-04** | Different action costs: move (cheap) vs craft (expensive)      | 3.2, 3.3 | Each validated against its configured price |
| **PRICE-05** | Fee schedule reload: update schedule -> new prices take effect | 3.2, 3.3 | Changed prices enforced after reload        |

### 3.3 Client-to-BLS End-to-End Tests (All Stories + Client Epic 2)

**Test Suite:** `packages/client/src/integration-tests/client-bls-e2e.integration.test.ts`
**Estimated Count:** 12 tests
**Requires:** Full Docker stack + `@sigil/client` publish path

These tests validate the entire system from the Sigil client perspective, connecting Epic 2's `client.publish()` to Epic 3's BLS handler.

| Test ID    | Scenario                                                                                          | Expected Result                                    |
| ---------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **E2E-01** | `client.publish({ reducer: 'player_move', args: [...] })` -> BLS processes -> SpacetimeDB updated | Success confirmation received                      |
| **E2E-02** | `client.publish()` with insufficient wallet balance -> clear error                                | `SigilError` with `INSUFFICIENT_BALANCE` code      |
| **E2E-03** | `client.publish()` with unknown reducer -> BLS error propagated                                   | `SigilError` with `UNKNOWN_REDUCER` boundary `bls` |
| **E2E-04** | `client.publish()` -> verify game state change via SpacetimeDB subscription                       | Table update received with correct attribution     |
| **E2E-05** | `client.publish()` round-trip latency < 2s (NFR3)                                                 | Performance assertion passes                       |
| **E2E-06** | Multiple `client.publish()` calls sequentially -> all succeed                                     | All confirmations received                         |
| **E2E-07** | `client.publish()` -> BLS rejects -> error propagated to client via Nostr relay                   | Client receives structured error with event ID     |
| **E2E-08** | Client uses action cost registry -> BLS fee matches -> action succeeds                            | Fee paid matches BLS expectation                   |

### 3.4 Smoke Test Script

**Location:** `scripts/smoke-bls.ts`
**Purpose:** Quick validation that the BLS handler is operational after Docker stack startup.

```bash
# Run smoke test
pnpm smoke:bls
```

**Smoke test steps:**

1. Connect to Crosstown relay
2. Publish a signed kind 30078 event via `@crosstown/client`
3. Verify BLS handler processes the event
4. Verify SpacetimeDB reducer was called
5. Report success/failure with timing

---

## 4. Test Infrastructure Needs

### 4.1 New Docker Services

The existing `docker/docker-compose.yml` has `bitcraft-server` and `crosstown-node`. Epic 3 adds:

```yaml
# Added to docker/docker-compose.yml
bitcraft-bls:
  build:
    context: ../packages/bitcraft-bls
    dockerfile: Dockerfile
  container_name: sigil-bitcraft-bls
  networks:
    - sigil-dev
  environment:
    - SPACETIMEDB_URL=http://bitcraft-server:3000
    - SPACETIMEDB_DATABASE=bitcraft
    - SPACETIMEDB_TOKEN=${SPACETIMEDB_ADMIN_TOKEN}
    - BLS_SECRET_KEY=${BLS_SECRET_KEY:-}
    - BLS_LOG_LEVEL=${BLS_LOG_LEVEL:-info}
    - BLS_FEE_SCHEDULE_PATH=/config/fee-schedule.json
  volumes:
    - ./config:/config:ro
  depends_on:
    bitcraft-server:
      condition: service_healthy
    crosstown-node:
      condition: service_healthy
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:3001/health']
    interval: 15s
    timeout: 5s
    retries: 3
    start_period: 10s
  restart: unless-stopped
```

### 4.2 Mock SDK Module

For unit testing without the real `@crosstown/sdk`:

**Location:** `packages/bitcraft-bls/src/__tests__/mocks/crosstown-sdk-mock.ts`

```typescript
// Provides mock implementations of:
// - createNode() -> MockNode
// - fromSecretKey() -> MockIdentity
// - generateMnemonic() -> string
// - HandlerContext (for handler unit tests)
// - AcceptResponse / RejectResponse types
```

### 4.3 SpacetimeDB HTTP API Mock

For unit testing the SpacetimeDB caller without a running server:

**Location:** `packages/bitcraft-bls/src/__tests__/mocks/spacetimedb-mock.ts`

```typescript
// Mock fetch responses for SpacetimeDB HTTP API:
// - POST /database/bitcraft/call/{reducer} -> 200, 400, 404, 500
// - GET /database/bitcraft/info -> 200 (health check)
// - Configurable per-reducer response behavior
// - Latency simulation for timeout testing
```

### 4.4 Test Fixtures

**Location:** `packages/bitcraft-bls/src/__tests__/fixtures/`

Required fixture files:

- `valid-events.ts` -- properly signed kind 30078 events for various reducers
- `invalid-events.ts` -- malformed content, wrong kind, corrupted signatures
- `fee-schedules.ts` -- valid and invalid fee schedule JSON files
- `spacetimedb-responses.ts` -- sample HTTP responses for all status codes
- `handler-contexts.ts` -- pre-built `HandlerContext` mocks for common scenarios

### 4.5 Shared Test Utilities

**Reuse from Epic 2:**

- `generateKeypair()` from `packages/client/src/nostr/keypair.ts`
- `finalizeEvent()` from `nostr-tools/pure`
- `bytesToHex()` from `@noble/hashes/utils`
- `BLSErrorCode` type from `packages/client/src/bls/types.ts`

**New for Epic 3:**

- `createMockContext()` -- builds `HandlerContext` mock with configurable overrides
- `createMockNode()` -- builds mock Crosstown node with handler registration
- `waitForBLSResponse()` -- waits for BLS handler response via Nostr relay (integration tests)
- `callSpacetimeDBReducer()` -- helper for directly calling SpacetimeDB HTTP API (verification)

### 4.6 Test Environment Variables

```bash
# packages/bitcraft-bls/.env.test
SPACETIMEDB_URL=http://localhost:3000
SPACETIMEDB_DATABASE=bitcraft
SPACETIMEDB_TOKEN=test_admin_token
BLS_SECRET_KEY=test_secret_key_hex_64_chars
BLS_LOG_LEVEL=debug
BLS_FEE_SCHEDULE_PATH=./src/__tests__/fixtures/test-fee-schedule.json
```

### 4.7 Conditional Test Execution

Following the project's existing pattern (103 skipped integration tests):

```typescript
// Integration tests auto-skip when Docker is unavailable
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
const blsAvailable = process.env.BLS_AVAILABLE === 'true';

describe.skipIf(!runIntegrationTests || !blsAvailable)('BLS Handler Integration Tests', () => {
  /* ... */
});
```

---

## 5. Risk-Based Prioritization

### 5.1 Test Priority Allocation

| Priority                 | % of Effort | Focus Area                                                                        | Risk IDs                       |
| ------------------------ | ----------- | --------------------------------------------------------------------------------- | ------------------------------ |
| **P0 (Critical Path)**   | 60%         | SDK integration, handler core logic, identity propagation, SpacetimeDB HTTP calls | R3-001, R3-003, R3-004, R3-005 |
| **P1 (High Priority)**   | 25%         | Docker networking, pricing enforcement, error handling, lifecycle                 | R3-002, R3-006, R3-007, R3-008 |
| **P2 (Medium Priority)** | 10%         | Configuration validation, embedded mode specifics, fee consistency                | R3-009, R3-010                 |
| **P3 (Low Priority)**    | 5%          | Edge cases, logging, performance optimization                                     | --                             |

### 5.2 Recommended Test Writing Order

Based on risk and dependency analysis, tests should be written in this order:

**Phase 1: SDK Validation (Story 3.1 -- write first, fail fast)**

1. `node-setup.test.ts` -- Can we create a node with the SDK? (R3-001)
2. `node-lifecycle.test.ts` -- Does start/stop work? (R3-006)
3. `bls-docker-integration.test.ts` -- Does the container start and connect? (R3-002)

**Phase 2: Core Handler (Story 3.2 -- the heart of the epic)** 4. `content-parser.test.ts` -- Can we parse event content? (R3-005) 5. `spacetimedb-caller.test.ts` -- Can we call SpacetimeDB reducers? (R3-003) 6. `identity-prepend.test.ts` -- Is pubkey correctly prepended? (R3-004) 7. `handler-dispatch.test.ts` -- Does the handler accept/reject correctly? 8. `error-mapping.test.ts` -- Are ILP error codes correct? (R3-005)

**Phase 3: Pricing (Story 3.3)** 9. `pricing-config.test.ts` -- Does kindPricing work? 10. `fee-schedule-loader.test.ts` -- Does the fee schedule load? (R3-007)

**Phase 4: End-to-End Identity (Story 3.4)** 11. `identity-chain.test.ts` -- Is the cryptographic chain intact? (R3-004) 12. `e2e-identity-propagation.test.ts` -- Full pipeline test 13. `pipeline-integration.test.ts` -- Cross-story integration

**Phase 5: Edge Cases and Polish** 14. Remaining unit tests (config validation, health check, self-write bypass) 15. Performance tests 16. Security tests

### 5.3 Which Tests Are Most Critical

The following tests, if they fail, indicate a fundamental problem that blocks the epic:

| Rank | Test                                                                  | Why It's Critical                                                             |
| ---- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1    | `createNode()` succeeds with embedded connector                       | If SDK `createNode()` doesn't work, Epic 3 is blocked entirely                |
| 2    | Handler receives `ctx.decode()` NostrEvent                            | If handler can't decode events, no game actions can be processed              |
| 3    | SpacetimeDB HTTP POST `/database/bitcraft/call/{reducer}` returns 200 | If we can't call reducers, identity propagation is moot                       |
| 4    | `ctx.pubkey` matches original signer's pubkey                         | If identity is wrong, every game action is mis-attributed (security critical) |
| 5    | `ctx.reject()` propagates error back to client                        | If errors are silent, NFR27 is violated                                       |

---

## 6. Security Test Plan

### 6.1 OWASP Top 10 Compliance (AGREEMENT-2)

| OWASP Category                               | Epic 3 Relevance                                             | Test Strategy                                                                 |
| -------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **A02:2021 - Cryptographic Failures**        | HIGH -- signature verification delegated to SDK              | Verify SDK rejects invalid signatures; verify no private key leakage in logs  |
| **A03:2021 - Injection**                     | HIGH -- reducer name and args passed to SpacetimeDB HTTP API | Reducer name validation (alphanumeric + underscore only); args JSON-sanitized |
| **A04:2021 - Insecure Design**               | MEDIUM -- error handling, zero silent failures               | Every code path returns explicit success or error                             |
| **A05:2021 - Security Misconfiguration**     | MEDIUM -- SpacetimeDB admin token, Docker config             | Token not logged; env vars not exposed; Docker network isolation              |
| **A07:2021 - Identification/Authentication** | CRITICAL -- identity propagation is the core feature         | End-to-end identity chain verification; no action without valid signature     |
| **A09:2021 - Security Logging**              | LOW -- audit trail for all processed events                  | Log event ID, pubkey, reducer, result; never log signatures or tokens         |

### 6.2 Security Test Cases (~25 tests)

| Test ID    | Test Scenario                                                          | Expected Result                                 |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| **SEC-01** | Reducer name with path traversal (`../../../etc/passwd`)               | Rejected: invalid reducer name format           |
| **SEC-02** | Reducer name with SQL injection (`test; DROP TABLE`)                   | Rejected: invalid reducer name format           |
| **SEC-03** | Reducer name with command injection (`test && rm -rf /`)               | Rejected: invalid reducer name format           |
| **SEC-04** | Oversized event content (>1MB)                                         | Rejected: content size limit                    |
| **SEC-05** | SpacetimeDB admin token not present in logs                            | Verified: no token in any log output            |
| **SEC-06** | Private key not present in health check response                       | Verified: only pubkey exposed                   |
| **SEC-07** | Invalid signature event -> no reducer call made                        | Verified: SDK rejects, no SpacetimeDB HTTP call |
| **SEC-08** | Forged pubkey in event (different from signer) -> rejected             | Verified: SDK detects pubkey/signature mismatch |
| **SEC-09** | Replay attack (same event submitted twice)                             | Depends on SDK dedup behavior -- document       |
| **SEC-10** | Docker network isolation: BLS not accessible from host (internal only) | Verified: only health check port exposed        |

---

## 7. Performance Test Plan

### 7.1 Performance Requirements

| Metric                                   | Requirement       | Source               |
| ---------------------------------------- | ----------------- | -------------------- |
| BLS event processing latency             | <500ms (p99)      | BLS handler contract |
| Signature validation                     | <50ms (p99)       | (SDK responsibility) |
| SpacetimeDB HTTP call                    | <400ms (p95)      | BLS handler contract |
| Full round-trip (client -> confirmation) | <2s (p99)         | NFR3                 |
| Sustained throughput                     | 10 actions/second | BLS impl spec        |

### 7.2 Performance Test Scenarios (~8 tests)

| Test ID     | Scenario                                            | Target               | Metric                  |
| ----------- | --------------------------------------------------- | -------------------- | ----------------------- |
| **PERF-01** | Single action (no concurrent load)                  | <200ms               | BLS processing time     |
| **PERF-02** | 10 concurrent actions                               | <500ms p95           | BLS processing time     |
| **PERF-03** | Sustained load: 10 actions/sec for 30s              | <500ms p99, 0 errors | Latency + error rate    |
| **PERF-04** | Full round-trip: `client.publish()` -> confirmation | <2s                  | End-to-end latency      |
| **PERF-05** | Content parsing only (no network)                   | <10ms                | Parse latency           |
| **PERF-06** | SpacetimeDB HTTP call only                          | <400ms p95           | HTTP latency            |
| **PERF-07** | Burst: 50 actions in 1 second                       | <2s to process all   | Throughput              |
| **PERF-08** | Cold start: first action after BLS startup          | <5s                  | Startup + first request |

---

## 8. Test Data & Fixtures

### 8.1 Nostr Event Fixtures

Reuse from Epic 2 (`packages/client/src/bls/contract-validation.test.ts` pattern):

```typescript
// packages/bitcraft-bls/src/__tests__/fixtures/events.ts
export async function createValidGameAction(reducer: string, args: unknown[]): Promise<NostrEvent> {
  const keypair = await generateKeypair();
  const pubkeyHex = bytesToHex(keypair.publicKey);
  return finalizeEvent(
    {
      pubkey: pubkeyHex,
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${reducer}_${Date.now()}`],
        ['fee', '100'],
      ],
      content: JSON.stringify({ reducer, args }),
    },
    keypair.privateKey
  );
}
```

### 8.2 Fee Schedule Fixtures

```json
// packages/bitcraft-bls/src/__tests__/fixtures/test-fee-schedule.json
{
  "version": 1,
  "defaultCost": 100,
  "actions": {
    "player_move": { "cost": 50, "category": "movement" },
    "craft_item": { "cost": 200, "category": "crafting" },
    "harvest_resource": { "cost": 100, "category": "resource" },
    "send_chat": { "cost": 10, "category": "social" },
    "build_structure": { "cost": 500, "category": "building" }
  }
}
```

### 8.3 SpacetimeDB Response Fixtures

```typescript
// packages/bitcraft-bls/src/__tests__/fixtures/spacetimedb-responses.ts
export const SPACETIMEDB_RESPONSES = {
  success: { status: 200, body: { success: true } },
  unknownReducer: { status: 404, body: { error: 'Reducer not found' } },
  badArgs: { status: 400, body: { error: 'Invalid argument types' } },
  internalError: { status: 500, body: { error: 'Internal server error' } },
};
```

---

## 9. Quality Gates

### 9.1 Story-Level Gates

| Gate                         | Requirement                            | Validation                         |
| ---------------------------- | -------------------------------------- | ---------------------------------- |
| TDD Compliance (AGREEMENT-1) | Tests written before implementation    | Review test file commit timestamps |
| P0 AC Coverage               | 100% of P0 criteria have passing tests | Automated traceability             |
| OWASP Review (AGREEMENT-2)   | OWASP Top 10 review completed          | Security checklist                 |
| Integration Tests            | All integration tests pass with Docker | CI/CD pipeline                     |
| Pair Review (AGREEMENT-3)    | SDK/crypto code pair-reviewed          | Review record                      |

### 9.2 Epic-Level Gates

| Gate          | Requirement                                     | Threshold               |
| ------------- | ----------------------------------------------- | ----------------------- |
| Test Coverage | >=95% line coverage for `packages/bitcraft-bls` | Hard requirement        |
| Regression    | All 651 existing tests pass                     | 100% pass rate          |
| P0 ACs        | All 20 P0 acceptance criteria have tests        | 100%                    |
| Integration   | Cross-story integration tests pass              | 100%                    |
| Performance   | NFR3 (<2s round-trip) validated                 | Performance test passes |
| Security      | Zero high-severity security issues              | OWASP compliant         |
| Contract      | BLS handler matches contract spec (Story 2.4)   | Contract tests pass     |

### 9.3 Epic Completion Criteria

Epic 3 is COMPLETE when:

1. All 4 stories delivered (3.1 through 3.4)
2. All 20 acceptance criteria met (100%)
3. All ~200 tests passing (100% pass rate)
4. Test coverage >=95% for `packages/bitcraft-bls`
5. Integration tests pass on Docker stack (BLS + BitCraft + Crosstown)
6. Performance tests validate NFR3 (<2s round-trip)
7. Security review complete (OWASP Top 10, zero high-severity)
8. Existing 651 tests continue to pass (regression)
9. BLS handler contract compliance validated (Story 2.4 contract tests)
10. End-to-end identity propagation verified (Story 3.4)

---

## Test Count Summary

| Story                       | Unit Tests | Integration Tests | Total    |
| --------------------------- | ---------- | ----------------- | -------- |
| 3.1: BLS Package Setup      | 35         | 15                | 50       |
| 3.2: Game Action Handler    | 45         | 20                | 65       |
| 3.3: Pricing Configuration  | 30         | 10                | 40       |
| 3.4: Identity Propagation   | 20         | 25                | 45       |
| **Cross-Story Integration** | --         | 35                | 35       |
| **Security Tests**          | 25         | --                | 25       |
| **Performance Tests**       | --         | 8                 | 8        |
| **Total**                   | **155**    | **113**           | **~268** |

**Test Pyramid Distribution:**

- Unit: 58% (155 tests) -- fast feedback, mock SDK and SpacetimeDB
- Integration: 42% (113 tests) -- real Docker stack, actual network calls

The higher-than-normal integration test percentage reflects the inherent nature of this epic: it is a server-side component whose primary value is in how it integrates with external systems. Mocking can only validate contract compliance; integration tests validate actual behavior.

---

## Appendix: Mapping to Epic 2 BLS Contract Tests

Epic 2 Story 2.4 produced client-side BLS contract tests (`packages/client/src/bls/contract-validation.test.ts` and `packages/client/src/integration-tests/bls-handler.integration.test.ts`). Epic 3 completes the other side of the contract:

| Contract Aspect            | Epic 2 Tests (Client-Side)                         | Epic 3 Tests (BLS-Side)                                                                   |
| -------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Kind 30078 event structure | `contract-validation.test.ts` AC1 (15 tests)       | `handler-dispatch.test.ts` (10 tests)                                                     |
| Event content parsing      | `contract-validation.test.ts` AC2 (18 tests)       | `content-parser.test.ts` (12 tests)                                                       |
| Signature validation       | `contract-validation.test.ts` AC3 (15 tests)       | SDK handles (verified in `e2e-identity-propagation.test.ts`)                              |
| Identity propagation       | `contract-validation.test.ts` identity (6 tests)   | `identity-prepend.test.ts` (6 tests) + `identity-chain.test.ts` (10 tests)                |
| Error response format      | `types.test.ts` (30 tests)                         | `error-mapping.test.ts` (5 tests)                                                         |
| Integration flow           | `bls-handler.integration.test.ts` (7 ACs, skipped) | `pipeline-integration.test.ts` (15 tests) + `e2e-identity-propagation.test.ts` (15 tests) |

When Epic 3 is complete, the Epic 2 integration tests (`bls-handler.integration.test.ts`) should be un-skipped and validated against the real BLS handler.
