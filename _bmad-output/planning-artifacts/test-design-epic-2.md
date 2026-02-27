# Epic 2: Test Design - Action Execution & Payment Pipeline

**Epic:** Epic 2 - Action Execution & Payment Pipeline
**Test Design Type:** Risk-Based Test Plan
**Epic-Level Analysis Mode:** ENABLED
**Created:** 2026-02-27
**Test Architect:** Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

---

## Executive Summary

This test design defines the comprehensive testing strategy for Epic 2: Action Execution & Payment Pipeline. Epic 2 implements the critical write path enabling users to execute game actions via ILP micropayments with end-to-end cryptographic identity propagation (Nostr key → ILP packet → Crosstown → BLS → SpacetimeDB reducer).

**Epic 2 Objectives:**
- Connect to Crosstown built-in Nostr relay for action confirmations
- Implement action cost registry for ILP fee lookup and wallet balance queries
- Construct and sign ILP packets via `client.publish()` API
- Build BLS game action handler for SpacetimeDB reducer execution
- Validate end-to-end identity propagation (Nostr → ILP → BLS → SpacetimeDB)
- Configure ILP fee collection and action-specific fee schedules

**Test Strategy:**
- **Risk-Based Prioritization:** Focus on high-risk integration points (BLS handler, identity propagation)
- **TDD Approach:** Write tests before implementation (AGREEMENT-1: features with >3 acceptance criteria)
- **Security-First:** OWASP Top 10 review on every story (AGREEMENT-2)
- **Integration Coverage:** Comprehensive end-to-end tests for the full write path
- **Epic 1 Foundation:** Leverage existing test infrastructure (937 passing tests)

**Key Risk Mitigations:**
1. **BLS Handler Complexity (HIGH RISK):** Prototype-driven development with spike (PREP-5), comprehensive integration tests
2. **Crosstown Protocol Gap (MEDIUM RISK):** Protocol research (PREP-4) before Story 2.1 implementation
3. **Identity Propagation Security (HIGH RISK):** End-to-end cryptographic verification tests, no silent failures (NFR27)
4. **ILP Payment Failures (MEDIUM RISK):** Comprehensive error handling tests, wallet balance validation

**Target Metrics:**
- **Test Coverage:** ≥95% line coverage for all new Epic 2 code
- **P0 Acceptance Criteria:** 100% coverage (gate requirement)
- **Integration Tests:** ≥80% of acceptance criteria validated via integration tests
- **Performance:** <2s round-trip for ILP packet execution (NFR3)
- **Security:** OWASP Top 10 compliant on all stories, zero high-severity issues

---

## Table of Contents

1. [Risk Assessment](#1-risk-assessment)
2. [Testing Scope & Boundaries](#2-testing-scope--boundaries)
3. [Test Levels & Types](#3-test-levels--types)
4. [Story-Level Test Plans](#4-story-level-test-plans)
5. [Integration Test Strategy](#5-integration-test-strategy)
6. [Performance Test Plan](#6-performance-test-plan)
7. [Security Test Plan](#7-security-test-plan)
8. [Test Data & Fixtures](#8-test-data--fixtures)
9. [Test Environment Requirements](#9-test-environment-requirements)
10. [Test Automation & CI/CD](#10-test-automation--cicd)
11. [Acceptance Criteria Traceability](#11-acceptance-criteria-traceability)
12. [Quality Gates](#12-quality-gates)
13. [Appendices](#13-appendices)

---

## 1. Risk Assessment

### 1.1 Epic-Level Risks

| Risk ID | Risk Description | Likelihood | Impact | Risk Score | Mitigation Strategy | Test Strategy |
|---------|-----------------|------------|--------|------------|---------------------|---------------|
| **R2-001** | BLS game action handler fails to propagate Nostr identity to SpacetimeDB reducers | Medium | **CRITICAL** | **HIGH** | PREP-5 spike, prototype validation, pair programming (AGREEMENT-3) | Comprehensive integration tests validating end-to-end identity propagation, cryptographic verification tests |
| **R2-002** | Crosstown Nostr relay protocol deviates from NIP-01, breaking subscriptions | Medium | High | **HIGH** | PREP-4 protocol research, document deviations, test against actual Crosstown instance | Integration tests against live Crosstown relay, protocol compliance tests |
| **R2-003** | ILP packet signing fails or produces invalid signatures | Low | **CRITICAL** | **MEDIUM** | Reuse Story 1.2 Nostr signing infrastructure, comprehensive unit tests | Unit tests with known test vectors, integration tests with BLS verification |
| **R2-004** | Wallet balance queries return stale data, enabling double-spend | Medium | High | **MEDIUM** | Transaction locking, balance caching strategy, race condition tests | Concurrent transaction tests, wallet balance consistency tests |
| **R2-005** | BLS handler cannot parse kind 30078 event content (reducer + args) | Low | High | **MEDIUM** | Schema validation, comprehensive error handling, strict JSON parsing | Unit tests with malformed events, edge case tests |
| **R2-006** | Action cost registry becomes out of sync with actual ILP fees charged | Medium | Medium | **MEDIUM** | Single source of truth (cost registry), registry validation on BLS startup | Configuration validation tests, cost registry consistency tests |
| **R2-007** | ILP round-trip latency exceeds 2s threshold (NFR3) | Medium | Medium | **MEDIUM** | Optimize packet construction, async handling, performance monitoring | Load tests, latency measurement tests, performance regression tests |
| **R2-008** | Subscription recovery from Story 1.6 fails for Nostr relay subscriptions | Medium | High | **MEDIUM** | PREP-1 completes Story 1.6 Task 5 before Epic 2, reuse reconnection infrastructure | Integration tests validating Nostr subscription recovery after disconnection |
| **R2-009** | Fee collection accounting loses transactions under concurrent load | Low | High | **MEDIUM** | Transaction logging, idempotency guarantees, audit trail | Concurrent fee collection tests, accounting consistency tests |
| **R2-010** | Unknown reducer names cause BLS handler to crash instead of graceful error | Low | Medium | **LOW** | Allowlist validation, error boundary, graceful fallback | Unit tests with unknown reducers, error handling tests |

### 1.2 Risk Scoring Matrix

**Impact Levels:**
- **CRITICAL:** System unusable, data loss, security breach
- **High:** Major feature broken, significant user impact
- **Medium:** Feature degradation, workaround available
- **Low:** Minor inconvenience, cosmetic issue

**Likelihood Levels:**
- **High:** >50% chance of occurrence
- **Medium:** 20-50% chance
- **Low:** <20% chance

**Risk Score Calculation:**
- **HIGH:** Critical Impact OR (High Impact + Medium/High Likelihood)
- **MEDIUM:** High Impact + Low Likelihood OR Medium Impact
- **LOW:** Low Impact

### 1.3 Risk-Driven Test Prioritization

**Test Priority Allocation:**

1. **P0 (Critical Path - 60% of test effort):**
   - End-to-end identity propagation (R2-001)
   - BLS handler integration (R2-001, R2-005)
   - ILP packet signing and verification (R2-003)
   - Crosstown relay protocol compliance (R2-002)

2. **P1 (High Priority - 25% of test effort):**
   - Wallet balance consistency (R2-004)
   - Subscription recovery (R2-008)
   - Action cost registry synchronization (R2-006)
   - Performance and latency (R2-007)

3. **P2 (Medium Priority - 10% of test effort):**
   - Fee collection accounting (R2-009)
   - Error handling and graceful degradation (R2-010)
   - Configuration validation

4. **P3 (Low Priority - 5% of test effort):**
   - Edge cases and boundary conditions
   - User-facing error messages
   - Logging and observability

---

## 2. Testing Scope & Boundaries

### 2.1 In Scope

**Epic 2 Stories (All 6 stories):**
- Story 2.1: Crosstown Relay Connection & Event Subscriptions
- Story 2.2: Action Cost Registry & Wallet Balance
- Story 2.3: ILP Packet Construction & Signing
- Story 2.4: BLS Game Action Handler
- Story 2.5: Identity Propagation & Verification
- Story 2.6: ILP Fee Collection & Schedule Configuration

**Test Types:**
- Unit tests (TypeScript + Rust)
- Integration tests (full Docker stack required)
- End-to-end tests (Nostr → ILP → BLS → SpacetimeDB)
- Performance tests (latency, throughput)
- Security tests (OWASP Top 10, signature validation)
- Regression tests (Epic 1 test suite continues to pass)

**Components Under Test:**
- `@sigil/client` - Nostr relay connection, ILP packet construction, `client.publish()` API
- BLS game action handler (Crosstown extension)
- Crosstown Nostr relay integration
- Action cost registry (JSON configuration)
- Wallet balance query API
- Fee collection and accounting

### 2.2 Out of Scope

**Explicitly Excluded:**
- SpacetimeDB server internals (already validated in Epic 1)
- Crosstown ILP routing internals (black box, only test public APIs)
- Game logic validation (BitCraft reducer behavior is trusted)
- Agent decision-making (deferred to Epic 3)
- TUI/MCP server (deferred to Epics 4-5)

**Deferred to Later Epics:**
- Agent skill configuration (Epic 3)
- Multi-agent experiments (Epic 9)
- MCP tool integration (Epic 4)

---

## 3. Test Levels & Types

### 3.1 Test Pyramid

```
        /\
       /  \  E2E (10% - 30 tests)
      /____\
     /      \  Integration (25% - 75 tests)
    /________\
   /          \  Unit (65% - 195 tests)
  /____________\

Total Target: ~300 tests for Epic 2
```

**Distribution Rationale:**
- **Unit Tests (65%):** Fast feedback, high coverage, low maintenance
- **Integration Tests (25%):** Validate component interactions, realistic scenarios
- **E2E Tests (10%):** Critical path validation, full stack smoke tests

### 3.2 Unit Tests

**Coverage Target:** ≥95% line coverage

**Focus Areas:**
- Nostr relay connection logic (Story 2.1)
- Action cost registry parser and lookup (Story 2.2)
- ILP packet construction and signing (Story 2.3)
- BLS event parsing and validation (Story 2.4)
- Identity verification functions (Story 2.5)
- Fee schedule configuration loading (Story 2.6)

**Mocking Strategy:**
- WebSocket connections (use EventEmitter-based mocks from Epic 1)
- Crosstown HTTP API (mock fetch/axios responses)
- SpacetimeDB reducer calls (mock reducer registry)
- Wallet balance queries (mock wallet API)

**Test Frameworks:**
- TypeScript: Vitest (consistency with Epic 1)
- Rust: Built-in test framework (`cargo test`)

### 3.3 Integration Tests

**Coverage Target:** ≥80% of P0 acceptance criteria

**Focus Areas:**
- Crosstown Nostr relay subscriptions (Story 2.1)
- End-to-end ILP packet flow (Stories 2.3 + 2.4)
- Identity propagation validation (Story 2.5)
- Fee collection under realistic load (Story 2.6)

**Test Environment:**
- Full Docker stack (BitCraft + Crosstown + BLS handler)
- Test Nostr relay (Crosstown built-in)
- Mock ILP wallet (or test wallet with funded balance)

**Execution:**
- Conditional on Docker availability (auto-skip if not present)
- Requires Story 1.3 Docker stack to be operational
- CI/CD integration (run on every PR with Docker runner)

### 3.4 End-to-End Tests

**Coverage Target:** 30 critical path tests

**Test Scenarios:**
1. Happy path: Generate keypair → fund wallet → execute action → receive confirmation
2. Insufficient balance: Attempt action with unfunded wallet → graceful error
3. Reconnection: Disconnect during action execution → reconnect → verify state
4. Concurrent actions: Multiple agents execute actions simultaneously → validate accounting
5. Invalid signature: Submit ILP packet with wrong signature → reject before execution
6. Unknown reducer: Call non-existent reducer → graceful error, no crash

**Validation Points:**
- ILP packet format (kind 30078, valid JSON content)
- Cryptographic signature verification
- SpacetimeDB reducer execution (via table subscription)
- Wallet balance updates (debit after action)
- Action confirmation events (via Nostr relay)

### 3.5 Performance Tests

**Coverage Target:** 10 performance benchmarks

**Metrics to Track:**
- **NFR3:** ILP round-trip latency (<2s under normal load)
- Action confirmation latency (Nostr relay → client)
- Wallet balance query latency (<200ms)
- BLS handler throughput (actions/second)
- Fee collection transaction rate

**Load Scenarios:**
- Single action (baseline latency)
- 10 concurrent actions (stress test)
- 100 concurrent actions (burst load)
- Sustained load (1 action/sec for 60s)

**Performance Regression:**
- Establish baseline metrics in Story 2.3
- Run regression suite on every PR
- Alert if latency exceeds thresholds

### 3.6 Security Tests

**Coverage Target:** OWASP Top 10 compliance (100%)

**Test Categories:**

1. **Authentication & Cryptography (A02:2021, A07:2021):**
   - Nostr signature validation (reject invalid signatures)
   - Private key protection (never transmitted)
   - Signature forgery attempts (detect and reject)

2. **Input Validation (A03:2021):**
   - Malformed ILP packet content (invalid JSON, missing fields)
   - Injection attacks (SQL injection in reducer args, command injection)
   - Oversized payloads (DoS prevention)

3. **Error Handling (A04:2021, NFR24):**
   - Graceful error messages (no stack traces, no secrets)
   - Boundary-aware errors (crosstown, bls, spacetimedb)
   - No silent failures (NFR27)

4. **Resource Limits (A05:2021):**
   - Wallet balance enforcement (prevent negative balance)
   - Rate limiting (prevent spam attacks)
   - Subscription limits (prevent DoS on Nostr relay)

5. **Logging & Monitoring (A09:2021):**
   - Audit trail for all ILP transactions
   - Error event emission
   - No secrets in logs

**Security Review Process:**
- OWASP checklist applied to every story (AGREEMENT-2)
- Pair review for crypto/identity code (AGREEMENT-3)
- Static analysis (ESLint security plugin, cargo-audit)

---

## 4. Story-Level Test Plans

### 4.1 Story 2.1: Crosstown Relay Connection & Event Subscriptions

**Acceptance Criteria:** 5 ACs (all P0)

**Test Strategy:**
- **Risk Mitigation:** R2-002 (Crosstown protocol deviations), R2-008 (subscription recovery)
- **TDD Required:** YES (5 ACs, triggers AGREEMENT-1)
- **Integration Tests:** REQUIRED (live Crosstown relay)

**Unit Tests (40 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `nostr-relay-connection.test.ts` | 12 | WebSocket connection, NIP-01 compliance |
| `nostr-subscriptions.test.ts` | 15 | Filter validation, event matching, subscription lifecycle |
| `action-confirmation-events.test.ts` | 8 | Event parsing, confirmation handling |
| `nostr-reconnection.test.ts` | 5 | Reuse Story 1.6 reconnection logic for relay |

**Integration Tests (15 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `crosstown-relay-integration.test.ts` | 10 | Live Crosstown relay, real WebSocket, NIP-01 validation |
| `subscription-recovery-integration.test.ts` | 5 | Disconnection → reconnection → re-subscribe flow |

**Key Test Cases:**

1. **AC1 - Relay Connection:**
   - ✅ Connect to `ws://localhost:4040` (Crosstown default)
   - ✅ Validate NIP-01 handshake
   - ✅ `client.nostr` surface available after connection
   - ❌ Connection failure when relay is down → graceful error

2. **AC2 - NIP-01 Subscriptions:**
   - ✅ Subscribe with single filter (e.g., `{ kinds: [30078] }`)
   - ✅ Subscribe with multiple filters
   - ✅ Receive matching events in real-time
   - ❌ Invalid filter format → validation error

3. **AC3 - Action Confirmation Events:**
   - ✅ `client.on('actionConfirmed', handler)` fires on kind 30078 events
   - ✅ Event payload includes reducer name, args, Nostr pubkey
   - ❌ Malformed event content → parsing error, no crash

4. **AC4 - NIP-01 Compliance:**
   - ✅ Connects to standard Nostr relay (not just Crosstown)
   - ✅ Uses Crosstown as default relay
   - ✅ Relay URL configurable via `SigilClient` constructor

5. **AC5 - Reconnection:**
   - ✅ Reuse Story 1.6 exponential backoff
   - ✅ Re-establish subscriptions after reconnection
   - ✅ No missed events during reconnection window (within limits)

**NFR Validation:**
- **NFR19:** NIP-01 compliance (tested with relay-tester tool)
- **NFR23:** Reconnection <10s total (inherit from Story 1.6)

**Security Checks:**
- Rate limiting on subscriptions (prevent DoS)
- WebSocket URL validation (no SSRF)
- Event content size limits

**Mocks Required:**
- `MockNostrRelay` (for unit tests, based on EventEmitter)
- Real Crosstown relay (for integration tests)

**Test Data:**
- Sample kind 30078 events (valid, invalid, edge cases)
- NIP-01 filter examples (from NIP-01 spec)

**Estimated Test Count:** 55 tests (40 unit + 15 integration)

---

### 4.2 Story 2.2: Action Cost Registry & Wallet Balance

**Acceptance Criteria:** 5 ACs (all P0)

**Test Strategy:**
- **Risk Mitigation:** R2-006 (cost registry sync), R2-004 (wallet balance consistency)
- **TDD Required:** YES (5 ACs)
- **Integration Tests:** REQUIRED (wallet API)

**Unit Tests (35 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `action-cost-registry.test.ts` | 15 | JSON parsing, cost lookup, validation |
| `wallet-balance-query.test.ts` | 10 | Balance retrieval, caching, error handling |
| `cost-registry-validation.test.ts` | 10 | Schema validation, unknown actions, edge cases |

**Integration Tests (10 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `wallet-integration.test.ts` | 5 | Real ILP wallet API, balance queries |
| `cost-registry-integration.test.ts` | 5 | Load from file, validate against live BLS |

**Key Test Cases:**

1. **AC1 - Cost Registry Loading:**
   - ✅ Load JSON file at startup
   - ✅ Parse cost registry schema (version, actions)
   - ✅ All mapped actions have valid ILP costs
   - ❌ Invalid JSON → startup error
   - ❌ Missing required fields → validation error

2. **AC2 - Cost Lookup:**
   - ✅ `client.publish.getCost('player_move')` returns cost from registry
   - ✅ Fee schedule is publicly auditable (NFR12)
   - ✅ Cost includes category and frequency metadata

3. **AC3 - Unknown Actions:**
   - ❌ `client.publish.getCost('unknown_action')` → clear error
   - ✅ Error message indicates action not in registry

4. **AC4 - Wallet Balance Query:**
   - ✅ `client.wallet.getBalance()` returns current balance (FR21)
   - ✅ Balance is numeric (ILP units)
   - ❌ Wallet API unreachable → timeout error

5. **AC5 - Balance Accuracy:**
   - ✅ Balance reflects all confirmed transactions (NFR17)
   - ✅ No stale data (cache TTL <5s)
   - ✅ Concurrent queries return consistent results

**NFR Validation:**
- **NFR12:** Fee schedule publicly auditable (JSON file in repo)
- **NFR17:** Accurate balance accounting (no double-count, no loss)
- **FR21:** Wallet balance query API functional

**Security Checks:**
- Path traversal prevention (cost registry file path)
- JSON schema validation (prevent injection)
- Wallet API authentication (if required)

**Mocks Required:**
- `MockWalletAPI` (for unit tests)
- Real ILP wallet (for integration tests, or mock wallet with balance tracking)

**Test Data:**
- Sample cost registry JSON (valid, invalid, edge cases)
- Known wallet balances (test fixtures)

**Estimated Test Count:** 45 tests (35 unit + 10 integration)

---

### 4.3 Story 2.3: ILP Packet Construction & Signing

**Acceptance Criteria:** 6 ACs (all P0)

**Test Strategy:**
- **Risk Mitigation:** R2-003 (ILP packet signing), R2-007 (round-trip latency)
- **TDD Required:** YES (6 ACs)
- **Integration Tests:** REQUIRED (Crosstown connector)

**Unit Tests (50 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `ilp-packet-construction.test.ts` | 20 | Packet format, kind 30078, JSON content |
| `ilp-packet-signing.test.ts` | 15 | Nostr signature, verify sig, private key handling |
| `client-publish-api.test.ts` | 10 | `client.publish()` API, error handling |
| `ilp-routing.test.ts` | 5 | Crosstown connector submission |

**Integration Tests (20 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `ilp-e2e-integration.test.ts` | 15 | End-to-end ILP flow (sign → route → BLS → confirm) |
| `ilp-performance-integration.test.ts` | 5 | Round-trip latency measurement (NFR3) |

**Key Test Cases:**

1. **AC1 - Packet Construction & Signing:**
   - ✅ `client.publish({ reducer: 'player_move', args: [x, y] })` constructs ILP packet
   - ✅ Packet signed with Nostr private key (NFR8)
   - ✅ Packet formatted as kind 30078 Nostr event
   - ✅ Content is valid JSON: `{ "reducer": "player_move", "args": [x, y] }`

2. **AC2 - Crosstown Routing:**
   - ✅ Packet submitted to Crosstown connector
   - ✅ Round-trip completes within 2s under normal load (NFR3)
   - ✅ Returns confirmation or error

3. **AC3 - Success Path:**
   - ✅ Confirmation event received via Nostr relay subscription
   - ✅ Wallet balance decremented by action cost
   - ✅ `client.publish()` resolves successfully

4. **AC4 - Insufficient Balance:**
   - ❌ Wallet balance < action cost → `SigilError` with code `INSUFFICIENT_BALANCE`
   - ✅ Error boundary is `crosstown` (NFR24)
   - ✅ No ILP packet sent
   - ✅ System remains in consistent state (no partial updates)

5. **AC5 - Network Timeout:**
   - ❌ Crosstown unreachable or timeout → `SigilError` with code `NETWORK_TIMEOUT`
   - ✅ Error boundary is `crosstown` (NFR24)
   - ✅ No inconsistent state (no zombie transactions)

6. **AC6 - Private Key Security:**
   - ✅ Nostr private key never transmitted over network (NFR9)
   - ✅ Only public key and signature leave local system
   - ✅ Signature verification succeeds at BLS

**NFR Validation:**
- **NFR3:** Round-trip latency <2s (performance tests)
- **NFR8:** ILP packets signed with Nostr key
- **NFR9:** Private key never transmitted
- **NFR24:** Boundary-aware error handling

**Security Checks:**
- Signature validation (test with known vectors)
- Private key protection (never logged, never exposed)
- Error message sanitization (no stack traces)

**Mocks Required:**
- `MockCrosstownConnector` (for unit tests)
- Real Crosstown instance (for integration tests)

**Test Data:**
- Sample reducers and args (valid, invalid, edge cases)
- Known signature test vectors (NIP-01 spec)
- Wallet balances (funded, unfunded, exact match)

**Performance Tests:**
- Baseline latency (single action, no load)
- Concurrent actions (10 simultaneous publish calls)
- Sustained load (1 action/sec for 60s)

**Estimated Test Count:** 70 tests (50 unit + 20 integration)

---

### 4.4 Story 2.4: BLS Game Action Handler

**Acceptance Criteria:** 5 ACs (all P0)

**Test Strategy:**
- **Risk Mitigation:** R2-001 (identity propagation), R2-005 (event parsing), R2-010 (unknown reducers)
- **TDD Required:** YES (5 ACs)
- **Integration Tests:** REQUIRED (SpacetimeDB + BLS)
- **Pair Programming:** REQUIRED (AGREEMENT-3 - unfamiliar tech: BLS)

**Unit Tests (40 tests, Rust + TypeScript):**

| Test Suite | Test Count | Language | Focus Area |
|------------|-----------|----------|------------|
| `bls-event-parser.test.ts` | 10 | TS | Kind 30078 parsing, extract reducer/args |
| `bls-signature-validation.test.ts` | 10 | TS/Rust | ILP payment validation, signature checks |
| `bls-reducer-dispatcher.test.ts` | 12 | Rust | SpacetimeDB reducer calling, arg marshalling |
| `bls-identity-extraction.test.ts` | 8 | Rust | Nostr pubkey extraction, propagation |

**Integration Tests (25 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `bls-handler-integration.test.ts` | 15 | Live BLS, SpacetimeDB, full action execution |
| `bls-error-handling-integration.test.ts` | 10 | Invalid packets, unknown reducers, signature failures |

**Key Test Cases:**

1. **AC1 - ILP Validation & Event Parsing:**
   - ✅ BLS receives kind 30078 event via ILP routing
   - ✅ Validates ILP payment (existing BLS logic, black box)
   - ✅ Parses event content → extracts `reducer` and `args`
   - ❌ Invalid JSON content → parsing error
   - ❌ Missing `reducer` or `args` → validation error

2. **AC2 - Reducer Execution & Identity Propagation:**
   - ✅ Extracts Nostr public key from event (`pubkey` field)
   - ✅ Calls SpacetimeDB reducer with extracted args
   - ✅ Propagates Nostr pubkey as player identity to SpacetimeDB (FR19, FR47)
   - ✅ Reducer executes successfully (verify via table subscription)

3. **AC3 - Invalid Signature Rejection:**
   - ❌ ILP packet with invalid/missing signature → reject before reducer execution (NFR8)
   - ✅ Explicit error returned to sender
   - ✅ No SpacetimeDB call made

4. **AC4 - Unknown Reducer Handling:**
   - ❌ Event references non-existent reducer → clear error
   - ✅ Error identifies unknown reducer name
   - ✅ No SpacetimeDB call made
   - ✅ BLS handler does not crash

5. **AC5 - No Silent Failures:**
   - ✅ Identity propagation succeeds OR fails with explicit error (NFR27)
   - ✅ Zero silent failures (all errors logged and returned)

**NFR Validation:**
- **FR19, FR47:** Identity propagation to SpacetimeDB
- **NFR8:** Signature validation before execution
- **NFR27:** No silent failures

**Security Checks:**
- Signature forgery attempts (invalid sig, wrong pubkey)
- Reducer allowlisting (prevent arbitrary code execution)
- Argument injection prevention (validate arg types)

**Mocks Required:**
- `MockSpacetimeDBClient` (for unit tests)
- Real SpacetimeDB + Crosstown stack (for integration tests)

**Test Data:**
- Valid kind 30078 events (various reducers)
- Invalid events (bad JSON, missing fields, wrong kind)
- Signature test vectors (valid, invalid, forged)

**Estimated Test Count:** 65 tests (40 unit + 25 integration)

**PREP-5 Spike Output:**
- BLS handler architecture validated
- Reducer calling mechanism proven
- Integration point with Crosstown documented

---

### 4.5 Story 2.5: Identity Propagation & Verification

**Acceptance Criteria:** 4 ACs (all P0)

**Test Strategy:**
- **Risk Mitigation:** R2-001 (end-to-end identity propagation)
- **TDD Required:** YES (4 ACs)
- **Integration Tests:** REQUIRED (full stack: Nostr → ILP → BLS → SpacetimeDB)

**Unit Tests (30 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `identity-verification.test.ts` | 15 | Cryptographic chain validation |
| `identity-attribution.test.ts` | 10 | SpacetimeDB attribution verification |
| `identity-error-handling.test.ts` | 5 | Invalid signatures, identity failures |

**Integration Tests (20 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `e2e-identity-propagation.test.ts` | 15 | Full stack identity validation |
| `identity-security-integration.test.ts` | 5 | Signature forgery attempts, security failures |

**Key Test Cases:**

1. **AC1 - Game Action Attribution:**
   - ✅ Action executed via `client.publish()` is attributed to Nostr pubkey (FR4)
   - ✅ SpacetimeDB reducer receives correct Nostr pubkey as identity
   - ✅ Game state change attributed to correct player entity
   - ✅ Validate attribution via table subscription (e.g., `players` table)

2. **AC2 - Cryptographic Chain Verification:**
   - ✅ `client.identity.verify(actionId)` returns verification result (FR5)
   - ✅ Verification confirms: signed ILP packet → BLS validation → reducer attribution
   - ✅ Result includes: Nostr pubkey, action taken, SpacetimeDB attribution

3. **AC3 - No Attribution Without Valid Signature:**
   - ❌ Unsigned action → rejected (NFR13)
   - ❌ Invalid signature → rejected (NFR13)
   - ❌ Forged signature → rejected (NFR13)
   - ✅ No game action attributed to Nostr pubkey without valid cryptographic signature

4. **AC4 - Identity Verification Failure:**
   - ❌ BLS cannot verify signature against claimed pubkey → reject reducer call
   - ✅ Explicit identity verification failure error (NFR10)
   - ✅ No game state modified (rollback or never executed)

**NFR Validation:**
- **FR4:** Game actions attributed to Nostr pubkey
- **FR5:** End-to-end identity verification
- **NFR10:** Identity verification failures are explicit
- **NFR13:** No action without valid signature

**Security Checks:**
- Signature forgery detection
- Man-in-the-middle attack prevention
- Replay attack prevention (nonce/timestamp validation)

**Mocks Required:**
- None (integration tests only, full stack required)

**Test Data:**
- Known Nostr keypairs (for signature validation)
- Test reducers (simple, observable state changes)
- Forged signatures (for negative tests)

**Estimated Test Count:** 50 tests (30 unit + 20 integration)

---

### 4.6 Story 2.6: ILP Fee Collection & Schedule Configuration

**Acceptance Criteria:** 4 ACs (all P0)

**Test Strategy:**
- **Risk Mitigation:** R2-009 (fee accounting), R2-006 (fee schedule sync)
- **TDD Required:** YES (4 ACs)
- **Integration Tests:** REQUIRED (concurrent load)

**Unit Tests (25 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `fee-collection.test.ts` | 10 | Fee extraction from ILP packets, accounting |
| `fee-schedule-config.test.ts` | 10 | JSON parsing, per-action fees, validation |
| `fee-accounting.test.ts` | 5 | Transaction logging, audit trail |

**Integration Tests (15 tests):**

| Test Suite | Test Count | Focus Area |
|------------|-----------|------------|
| `fee-collection-integration.test.ts` | 10 | Concurrent fee collection, accounting accuracy |
| `fee-schedule-integration.test.ts` | 5 | Live BLS, fee schedule updates |

**Key Test Cases:**

1. **AC1 - Fee Collection:**
   - ✅ ILP fee collected from every routed game action (FR20)
   - ✅ Fee amount matches action cost registry entry
   - ✅ Fee recorded in transaction log

2. **AC2 - Fee Schedule Configuration:**
   - ✅ Operator updates fee schedule JSON file
   - ✅ Different action types have different fees (FR45)
   - ✅ Updated schedule takes effect on subsequent actions
   - ✅ BLS reloads schedule on restart or SIGHUP

3. **AC3 - Concurrent Fee Accounting:**
   - ✅ Multiple ILP fees collected simultaneously (10 concurrent actions)
   - ✅ Fee accounting remains accurate (NFR17)
   - ✅ No lost transactions
   - ✅ No double-counted transactions

4. **AC4 - Fee Transparency:**
   - ✅ User queries action cost via registry → cost includes ILP fee component
   - ✅ Fee is publicly verifiable (NFR12)
   - ✅ Fee schedule changes are documented (changelog)

**NFR Validation:**
- **FR20:** ILP fee collection on every action
- **FR45:** Per-action fee configuration
- **NFR12:** Publicly auditable fees
- **NFR17:** Accurate accounting

**Security Checks:**
- Fee schedule file validation (prevent injection)
- Transaction logging (audit trail)
- No fee bypass attacks

**Mocks Required:**
- `MockFeeCollector` (for unit tests)
- Real BLS + Crosstown (for integration tests)

**Test Data:**
- Sample fee schedules (various action types)
- Transaction logs (valid, invalid, concurrent)

**Performance Tests:**
- Concurrent fee collection (10, 50, 100 actions)
- Fee query latency (<50ms)

**Estimated Test Count:** 40 tests (25 unit + 15 integration)

---

## 5. Integration Test Strategy

### 5.1 Full Stack Integration

**Docker Stack Requirements:**
- BitCraft SpacetimeDB server (Story 1.3)
- Crosstown ILP relay + Nostr relay (Story 1.3)
- BLS game action handler (Story 2.4, NEW)
- Test ILP wallet (Story 2.2, NEW)

**New Docker Services for Epic 2:**

```yaml
# docker/docker-compose.epic2.yml (extends docker-compose.yml)
services:
  bls-handler:
    build: ./bls-handler
    ports:
      - "5000:5000"
    environment:
      - SPACETIMEDB_URL=ws://bitcraft-server:3000
      - CROSSTOWN_URL=ws://crosstown-node:4040
      - ACTION_COST_REGISTRY=/config/cost-registry.json
    volumes:
      - ./config:/config
    depends_on:
      - bitcraft-server
      - crosstown-node
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  test-wallet:
    image: ilp-test-wallet:latest
    ports:
      - "6000:6000"
    environment:
      - INITIAL_BALANCE=10000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6000/balance"]
      interval: 5s
      timeout: 3s
      retries: 3
```

**Integration Test Workflow:**

1. **Setup:**
   - Start full Docker stack (Story 1.3 + Epic 2 extensions)
   - Wait for all health checks to pass
   - Fund test wallet with ILP balance
   - Generate test Nostr keypairs

2. **Execution:**
   - Connect `SigilClient` to all services
   - Execute test scenarios (see test cases below)
   - Validate state across all components

3. **Teardown:**
   - Disconnect clients
   - Collect logs from all services
   - Stop Docker stack
   - Clean up test data

### 5.2 Critical Integration Test Scenarios

**Scenario 1: Happy Path - Full Action Execution**
1. Generate Nostr keypair
2. Load identity into `SigilClient`
3. Query wallet balance → verify ≥10 ILP units
4. Query action cost: `client.publish.getCost('player_move')` → 1 unit
5. Execute action: `await client.publish({ reducer: 'player_move', args: [100, 200] })`
6. Wait for confirmation event via Nostr relay
7. Validate SpacetimeDB state: player position updated
8. Query wallet balance → verify balance decremented by 1 unit
9. **Expected Result:** ✅ Action succeeds, state updated, balance correct

**Scenario 2: Insufficient Balance**
1. Fund wallet with 0 ILP units
2. Attempt action: `await client.publish({ reducer: 'player_move', args: [100, 200] })`
3. **Expected Result:** ❌ `SigilError` with code `INSUFFICIENT_BALANCE`, boundary `crosstown`

**Scenario 3: Reconnection During Action**
1. Start action execution
2. Kill Crosstown node mid-flight
3. Wait for reconnection (Story 1.6 + 2.1 logic)
4. Restart Crosstown node
5. Wait for action confirmation or timeout
6. **Expected Result:** ✅ Reconnection succeeds, action completes OR times out gracefully

**Scenario 4: Concurrent Multi-Agent Actions**
1. Generate 10 Nostr keypairs
2. Fund all wallets with 100 ILP units
3. Execute 10 concurrent `client.publish()` calls (different agents, different actions)
4. Wait for all confirmations
5. Validate SpacetimeDB state: all actions executed
6. Validate wallet balances: all decremented correctly
7. **Expected Result:** ✅ All actions succeed, no accounting errors

**Scenario 5: Invalid Signature**
1. Construct ILP packet manually with forged signature
2. Submit to Crosstown connector
3. **Expected Result:** ❌ BLS rejects packet, no reducer execution, explicit error

**Scenario 6: Unknown Reducer**
1. Execute action: `await client.publish({ reducer: 'nonexistent_reducer', args: [] })`
2. **Expected Result:** ❌ BLS handler returns error, no crash, graceful fallback

**Scenario 7: Fee Schedule Update**
1. Load initial fee schedule (player_move: 1 unit)
2. Execute action → verify 1 unit charged
3. Update fee schedule (player_move: 2 units)
4. Restart BLS handler (or SIGHUP)
5. Execute action → verify 2 units charged
6. **Expected Result:** ✅ Fee schedule update takes effect

### 5.3 Integration Test Execution

**CI/CD Integration:**
- GitHub Actions workflow with Docker
- Conditional execution (skip if Docker unavailable)
- Parallel test execution (where safe)
- Collect Docker logs on failure

**Local Development:**
```bash
# Start Epic 2 Docker stack
docker compose -f docker/docker-compose.yml -f docker/docker-compose.epic2.yml up -d

# Wait for health checks
./docker/scripts/wait-for-health.sh

# Run Epic 2 integration tests
pnpm test:integration --filter epic-2

# Stop stack
docker compose -f docker/docker-compose.yml -f docker/docker-compose.epic2.yml down
```

**Estimated Integration Test Count:** 90 tests across all stories

---

## 6. Performance Test Plan

### 6.1 Performance Requirements

**NFRs from Architecture:**
- **NFR3:** ILP round-trip latency <2s under normal load
- **NFR5:** Real-time updates <500ms (inherited from Epic 1)
- **NFR17:** Accurate transaction accounting (no performance degradation)

### 6.2 Performance Test Scenarios

**Baseline Latency Tests:**

| Test ID | Scenario | Target | Metric |
|---------|----------|--------|--------|
| **PERF-01** | Single action (no load) | <500ms | End-to-end latency |
| **PERF-02** | Action confirmation latency | <200ms | Nostr relay → client |
| **PERF-03** | Wallet balance query | <100ms | HTTP round-trip |
| **PERF-04** | Cost registry lookup | <10ms | In-memory lookup |

**Load Tests:**

| Test ID | Scenario | Load | Target | Metric |
|---------|----------|------|--------|--------|
| **LOAD-01** | Concurrent actions (10 agents) | 10/sec | <2s | 95th percentile latency |
| **LOAD-02** | Burst load (100 agents) | 100 actions | <5s | Max completion time |
| **LOAD-03** | Sustained load | 1 action/sec for 60s | <2s | Average latency |
| **LOAD-04** | Fee collection under load | 50 concurrent fees | 100% accuracy | Accounting correctness |

**Stress Tests:**

| Test ID | Scenario | Load | Failure Mode |
|---------|----------|------|--------------|
| **STRESS-01** | Wallet depleted during action | 0 balance | Graceful error |
| **STRESS-02** | BLS handler overload | 1000 actions/sec | Queue or reject |
| **STRESS-03** | Crosstown relay saturation | 500 subscriptions | Rate limit or drop |

### 6.3 Performance Monitoring

**Instrumentation:**
- Latency measurement at each boundary (client, Crosstown, BLS, SpacetimeDB)
- Timing histograms (p50, p95, p99, max)
- Error rate tracking
- Throughput metrics (actions/sec)

**Tools:**
- Custom performance test harness (Vitest + custom metrics)
- Prometheus metrics (if available in Crosstown/BLS)
- Docker stats (resource usage)

**Regression Detection:**
- Baseline metrics established in Story 2.3
- Run performance suite on every PR
- Alert if p95 latency exceeds thresholds

**Estimated Performance Test Count:** 10 tests

---

## 7. Security Test Plan

### 7.1 OWASP Top 10 Compliance (AGREEMENT-2)

**Epic 2 Security Focus Areas:**

| OWASP Category | Epic 2 Relevance | Test Strategy |
|----------------|------------------|---------------|
| **A02:2021 - Cryptographic Failures** | HIGH (ILP packet signing, signature validation) | Unit tests with known vectors, integration tests with forged signatures |
| **A03:2021 - Injection** | MEDIUM (reducer args, JSON parsing) | Input validation tests, malformed payload tests |
| **A04:2021 - Insecure Design** | MEDIUM (BLS handler error handling) | Error boundary tests, graceful degradation tests |
| **A05:2021 - Security Misconfiguration** | MEDIUM (fee schedules, wallet config) | Configuration validation tests, secure defaults tests |
| **A07:2021 - Identification/Authentication** | CRITICAL (Nostr identity propagation) | End-to-end identity verification tests, signature forgery tests |
| **A09:2021 - Security Logging Failures** | LOW (transaction audit trail) | Audit log tests, no secrets in logs |
| **A10:2021 - SSRF** | LOW (Crosstown URL validation) | URL validation tests (inherited from Epic 1) |

### 7.2 Security Test Cases

**Authentication & Cryptography Tests (30 tests):**

| Test ID | Test Scenario | Expected Result |
|---------|--------------|-----------------|
| **SEC-01** | Valid Nostr signature | ✅ BLS accepts packet |
| **SEC-02** | Invalid signature | ❌ BLS rejects packet |
| **SEC-03** | Forged signature (different key) | ❌ BLS rejects packet |
| **SEC-04** | Missing signature | ❌ BLS rejects packet |
| **SEC-05** | Signature with wrong pubkey | ❌ BLS rejects packet |
| **SEC-06** | Private key never in ILP packet | ✅ Verify packet contents |
| **SEC-07** | Private key never in logs | ✅ Scan logs for nsec patterns |
| **SEC-08** | Replay attack (same packet twice) | ❌ Second attempt rejected |

**Input Validation Tests (20 tests):**

| Test ID | Test Scenario | Expected Result |
|---------|--------------|-----------------|
| **INJ-01** | SQL injection in reducer args | ❌ Validation error, no execution |
| **INJ-02** | Command injection in reducer name | ❌ Validation error, no execution |
| **INJ-03** | Oversized JSON payload (>1MB) | ❌ Size limit rejection |
| **INJ-04** | Malformed JSON (invalid syntax) | ❌ Parsing error, no crash |
| **INJ-05** | Missing required fields | ❌ Validation error |
| **INJ-06** | Type mismatch (string instead of number) | ❌ Type validation error |

**Error Handling Tests (15 tests):**

| Test ID | Test Scenario | Expected Result |
|---------|--------------|-----------------|
| **ERR-01** | Network timeout | ❌ `SigilError` with code `NETWORK_TIMEOUT`, boundary `crosstown` |
| **ERR-02** | Insufficient balance | ❌ `SigilError` with code `INSUFFICIENT_BALANCE`, boundary `crosstown` |
| **ERR-03** | Unknown reducer | ❌ `SigilError` with code `UNKNOWN_REDUCER`, boundary `bls` |
| **ERR-04** | Identity verification failure | ❌ `SigilError` with code `IDENTITY_VERIFICATION_FAILED`, boundary `bls` |
| **ERR-05** | No silent failures (NFR27) | ✅ All errors explicit, logged, returned |

**Resource Limits Tests (10 tests):**

| Test ID | Test Scenario | Expected Result |
|---------|--------------|-----------------|
| **RES-01** | Negative wallet balance attempt | ❌ Rejected before packet sent |
| **RES-02** | Rate limiting (100 actions/sec) | ❌ Rate limit error after threshold |
| **RES-03** | Subscription limit (1000 subscriptions) | ❌ Limit enforced |

### 7.3 Security Review Process

**Code Review Checklist (PREP-7):**
1. ✅ All ILP packets signed with Nostr key
2. ✅ Private keys never transmitted or logged
3. ✅ All reducer args validated before execution
4. ✅ Error messages sanitized (no stack traces, no secrets)
5. ✅ Rate limiting enforced on public endpoints
6. ✅ Transaction audit trail complete
7. ✅ No silent failures (NFR27)

**Security Review Gates:**
- Every story passes OWASP Top 10 review before "done"
- Pair review for crypto/identity code (AGREEMENT-3)
- Static analysis (ESLint security plugin, cargo audit)
- Dependency vulnerability scan (`pnpm audit`, `cargo audit`)

**Estimated Security Test Count:** 75 tests

---

## 8. Test Data & Fixtures

### 8.1 Nostr Keypair Test Fixtures

**Test Keypairs (from Epic 1, reuse):**

```typescript
// packages/client/src/nostr/test-utils/test-keypairs.ts
export const TEST_KEYPAIRS = {
  alice: {
    nsec: 'nsec1...',
    npub: 'npub1...',
    hex: '0x...'
  },
  bob: {
    nsec: 'nsec1...',
    npub: 'npub1...',
    hex: '0x...'
  },
  // ... 10 total test keypairs
};
```

**Signature Test Vectors (NIP-01):**

```typescript
// Known good signatures for validation
export const SIGNATURE_TEST_VECTORS = [
  {
    message: 'test message 1',
    privateKey: '0x...',
    expectedSignature: '0x...'
  },
  // ... 5 test vectors
];
```

### 8.2 Action Cost Registry Test Fixtures

**Valid Cost Registry:**

```json
{
  "version": 1,
  "defaultCost": 10,
  "actions": {
    "player_move": { "cost": 1, "category": "movement" },
    "player_teleport_home": { "cost": 20, "category": "movement" },
    "attack_start": { "cost": 10, "category": "combat" },
    "harvest_start": { "cost": 5, "category": "resource" }
  }
}
```

**Invalid Cost Registries (for negative tests):**
- Missing version field
- Invalid JSON syntax
- Negative cost values
- Unknown action categories

### 8.3 ILP Packet Test Fixtures

**Valid ILP Packets:**

```json
{
  "id": "abc123",
  "pubkey": "npub1...",
  "created_at": 1234567890,
  "kind": 30078,
  "tags": [],
  "content": "{\"reducer\":\"player_move\",\"args\":[100,200]}",
  "sig": "0x..."
}
```

**Invalid ILP Packets (for negative tests):**
- Wrong kind (not 30078)
- Invalid JSON content
- Missing reducer or args
- Forged signature
- Missing signature

### 8.4 Wallet Balance Test Fixtures

**Test Wallets:**

| Wallet ID | Initial Balance | Purpose |
|-----------|----------------|---------|
| `wallet-funded` | 10000 ILP units | Happy path tests |
| `wallet-low` | 5 ILP units | Low balance tests |
| `wallet-empty` | 0 ILP units | Insufficient balance tests |
| `wallet-exact` | 10 ILP units | Exact match tests |

### 8.5 SpacetimeDB Reducer Test Data

**Sample Reducers:**

```typescript
// Simple reducers for testing
const TEST_REDUCERS = [
  {
    name: 'player_move',
    args: ['x: i32', 'y: i32'],
    cost: 1
  },
  {
    name: 'chat_post_message',
    args: ['message: string'],
    cost: 1
  },
  {
    name: 'attack_start',
    args: ['target_id: u64'],
    cost: 10
  }
];
```

### 8.6 Mock Data Generators

**Generate Mock ILP Packets:**

```typescript
// packages/client/src/test-utils/mock-ilp-packet.ts
export function generateMockILPPacket(options: {
  reducer: string;
  args: any[];
  keypair?: NostrKeypair;
  forgeSignature?: boolean;
}): NostrEvent {
  // Generate valid or invalid packet for testing
}
```

**Generate Mock Wallet Responses:**

```typescript
// packages/client/src/test-utils/mock-wallet.ts
export class MockWallet {
  constructor(initialBalance: number) {}
  async getBalance(): Promise<number>;
  async debit(amount: number): Promise<void>;
  simulateNetworkError(): void;
}
```

---

## 9. Test Environment Requirements

### 9.1 Local Development Environment

**Required Software:**
- Node.js ≥20.0.0
- pnpm ≥9.0.0
- Rust ≥1.70 (for BLS handler)
- Docker Desktop (for integration tests)
- Git

**Docker Stack:**
- BitCraft SpacetimeDB server (Story 1.3)
- Crosstown ILP relay + Nostr relay (Story 1.3)
- BLS game action handler (Story 2.4, NEW)
- Test ILP wallet (Story 2.2, NEW)

**Environment Variables:**

```bash
# packages/client/.env.test
SPACETIMEDB_URL=ws://localhost:3000
CROSSTOWN_CONNECTOR_URL=http://localhost:8080
CROSSTOWN_RELAY_URL=ws://localhost:4040
BLS_HANDLER_URL=http://localhost:5000
TEST_WALLET_URL=http://localhost:6000
TEST_WALLET_INITIAL_BALANCE=10000
```

### 9.2 CI/CD Environment

**GitHub Actions Workflows:**

```yaml
# .github/workflows/epic-2-tests.yml
name: Epic 2 Tests

on:
  pull_request:
    paths:
      - 'packages/client/src/**'
      - 'docker/**'
      - '.github/workflows/epic-2-tests.yml'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - name: Start Docker stack
        run: |
          docker compose -f docker/docker-compose.yml \
            -f docker/docker-compose.epic2.yml up -d
      - name: Wait for health checks
        run: ./docker/scripts/wait-for-health.sh
      - run: pnpm install
      - run: pnpm test:integration
      - name: Collect Docker logs on failure
        if: failure()
        run: docker compose logs > docker-logs.txt
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: docker-logs
          path: docker-logs.txt
```

**Linux Compatibility:**
- Epic 2 must pass tests on both macOS and Linux (PREP-2)
- CI runs on Ubuntu 24.04 LTS
- Docker stack validated on Linux before Epic 2 kickoff

### 9.3 Test Database Setup

**SpacetimeDB Test Module:**
- Use BitCraft v1 game module (unmodified)
- Reset database state between test runs
- Seed with minimal test data (1 player, 1 planet, test items)

**Test Data Isolation:**
- Each test uses unique Nostr keypairs
- Wallet balances isolated per test
- SpacetimeDB state reset after each test suite

---

## 10. Test Automation & CI/CD

### 10.1 Test Execution Strategy

**Unit Tests:**
- Run on every file save (watch mode)
- Run on every commit (pre-commit hook)
- Run on every PR (CI/CD)
- Execution time: <30 seconds

**Integration Tests:**
- Run on every PR (CI/CD with Docker)
- Run on demand locally
- Execution time: <5 minutes

**Performance Tests:**
- Run on every PR (baseline validation)
- Run nightly (full suite with load tests)
- Execution time: <10 minutes

**Security Tests:**
- Run on every PR (OWASP checklist)
- Run before story completion (manual review)
- Static analysis on every commit

### 10.2 CI/CD Pipeline

**PR Workflow:**

1. **Pre-Commit Hooks:**
   - Prettier (format)
   - ESLint (lint)
   - TypeScript type-check
   - Rust clippy (lint)

2. **PR Opened:**
   - Unit tests (all packages)
   - TypeScript build
   - Rust build

3. **PR Updated:**
   - Integration tests (Docker stack)
   - Performance tests (baseline)
   - Security scan (pnpm audit, cargo audit)

4. **PR Approved:**
   - Full test suite (unit + integration + performance)
   - Coverage report
   - Test traceability report

**Merge to Main:**
- All tests passing (gate requirement)
- Coverage ≥95% (gate requirement)
- P0 acceptance criteria 100% covered (gate requirement)

### 10.3 Test Reporting

**Test Execution Reports:**
- JUnit XML format (for CI/CD integration)
- HTML coverage report (Vitest)
- Test traceability matrix (AC → Test mapping)

**Dashboards:**
- Test pass rate over time
- Coverage trends
- Performance regression trends
- Flaky test detection

**Notifications:**
- Slack/Discord on test failures
- Email on performance regression
- GitHub PR comments with test summary

---

## 11. Acceptance Criteria Traceability

### 11.1 Traceability Matrix Template

**Per-Story Traceability (following Epic 1 pattern):**

| Story | AC # | AC Description | Priority | Test Suite | Test Count | Coverage |
|-------|------|----------------|----------|------------|------------|----------|
| 2.1 | AC1 | Relay connection | P0 | `nostr-relay-connection.test.ts` | 12 | 100% |
| 2.1 | AC2 | NIP-01 subscriptions | P0 | `nostr-subscriptions.test.ts` | 15 | 100% |
| ... | ... | ... | ... | ... | ... | ... |

**Epic-Level Rollup:**

| Story | Total ACs | P0 ACs | P1 ACs | Total Tests | Coverage |
|-------|-----------|--------|--------|-------------|----------|
| 2.1 | 5 | 5 | 0 | 55 | 100% |
| 2.2 | 5 | 5 | 0 | 45 | 100% |
| 2.3 | 6 | 6 | 0 | 70 | 100% |
| 2.4 | 5 | 5 | 0 | 65 | 100% |
| 2.5 | 4 | 4 | 0 | 50 | 100% |
| 2.6 | 4 | 4 | 0 | 40 | 100% |
| **Total** | **29** | **29** | **0** | **325** | **100%** |

### 11.2 Traceability Report Generation

**Automated Report:**

```typescript
// scripts/generate-traceability-report.ts
export async function generateTraceabilityReport(epic: number) {
  // 1. Parse acceptance criteria from epics.md
  // 2. Find tests matching AC patterns (e.g., "AC1", "Story 2.1 AC1")
  // 3. Count tests per AC
  // 4. Calculate coverage %
  // 5. Generate markdown report
}
```

**Report Output:**
- `_bmad-output/implementation-artifacts/epic-2-test-architecture-traceability.md`
- Per-story reports: `2-X-test-architecture-trace-report.md`

**Quality Gates:**
- P0 coverage ≥ 100% (hard requirement)
- Overall coverage ≥ 80% (soft requirement, aim for 100%)
- No uncovered P0 criteria (blocker)

---

## 12. Quality Gates

### 12.1 Story-Level Gates

**Gate 1: TDD Compliance (AGREEMENT-1)**
- **Requirement:** For features with >3 acceptance criteria, tests written BEFORE implementation
- **Validation:** Review test file commit timestamps (should predate implementation)
- **Epic 2 Impact:** All 6 stories have ≥4 ACs → TDD required on all stories

**Gate 2: P0 Acceptance Criteria Coverage**
- **Requirement:** 100% of P0 criteria have passing tests
- **Validation:** Automated traceability report
- **Epic 2 Impact:** 29 P0 ACs → all 29 must have tests

**Gate 3: Code Review (AGREEMENT-2)**
- **Requirement:** OWASP Top 10 review on every story
- **Validation:** Security checklist completed, no open high-severity issues
- **Epic 2 Impact:** Critical for identity propagation (Stories 2.3, 2.4, 2.5)

**Gate 4: Integration Test Execution**
- **Requirement:** All integration tests pass on Docker stack
- **Validation:** CI/CD pipeline green
- **Epic 2 Impact:** 90 integration tests across all stories

**Gate 5: Performance Validation**
- **Requirement:** NFR3 (ILP round-trip <2s) validated
- **Validation:** Performance test suite
- **Epic 2 Impact:** Story 2.3 establishes baseline, all stories maintain it

### 12.2 Epic-Level Gates

**Gate 1: Test Coverage**
- **Requirement:** ≥95% line coverage for all Epic 2 code
- **Validation:** Vitest coverage report
- **Threshold:** Coverage must not decrease from Epic 1

**Gate 2: Regression Prevention**
- **Requirement:** All Epic 1 tests continue to pass (937 tests)
- **Validation:** Full test suite run
- **Threshold:** 100% pass rate

**Gate 3: End-to-End Validation**
- **Requirement:** At least 30 E2E tests validating full write path
- **Validation:** E2E test suite
- **Critical Scenarios:** Happy path, error handling, concurrent load

**Gate 4: Security Compliance**
- **Requirement:** Zero high-severity security issues
- **Validation:** Security test suite + manual review
- **Critical:** Identity propagation, signature validation

**Gate 5: Performance Compliance**
- **Requirement:** All NFRs validated (NFR3, NFR8, NFR9, NFR10, NFR12, NFR13, NFR17, NFR24, NFR27)
- **Validation:** Performance + security test suites
- **Threshold:** 100% NFR compliance

### 12.3 Epic Completion Criteria

**Epic 2 is COMPLETE when:**

1. ✅ All 6 stories delivered (2.1 through 2.6)
2. ✅ All 29 acceptance criteria met (100%)
3. ✅ All ~325 tests passing (100% pass rate)
4. ✅ Test coverage ≥95%
5. ✅ Integration tests pass on Docker stack
6. ✅ Performance tests validate NFR3 (<2s round-trip)
7. ✅ Security review complete (OWASP Top 10, zero high-severity issues)
8. ✅ Epic 1 regression tests pass (937 tests)
9. ✅ End-to-end scenarios validated (30 E2E tests)
10. ✅ Traceability report generated and reviewed

**Sign-Off Required:**
- Dana (QA Engineer): Test execution and coverage validation
- Charlie (Senior Dev): Code review and technical approval
- Alice (Product Owner): Acceptance criteria sign-off
- Jonathan (Project Lead): Epic completion approval

---

## 13. Appendices

### 13.1 Test Naming Conventions

**Unit Tests:**

```typescript
// Pattern: describe('<ComponentName>', () => { it('should <expected behavior>', () => {}) })
describe('ILPPacketConstructor', () => {
  it('should construct valid kind 30078 packet with reducer and args', () => {
    // AC reference: Story 2.3 AC1
  });

  it('should reject construction if Nostr identity is missing', () => {
    // Error handling
  });
});
```

**Integration Tests:**

```typescript
// Pattern: describe('<Integration Scenario>', () => { it('should <end-to-end behavior>', () => {}) })
describe('E2E: ILP Action Execution', () => {
  it('should execute player_move action and update SpacetimeDB state', async () => {
    // AC reference: Story 2.3 AC3, Story 2.4 AC2, Story 2.5 AC1
  });
});
```

**Performance Tests:**

```typescript
// Pattern: describe('PERF: <Scenario>', () => { it('should <performance requirement>', () => {}) })
describe('PERF: ILP Round-Trip Latency', () => {
  it('should complete ILP packet execution within 2 seconds', async () => {
    // NFR3 validation
  });
});
```

**Security Tests:**

```typescript
// Pattern: describe('SEC: <Attack Vector>', () => { it('should <security requirement>', () => {}) })
describe('SEC: Signature Forgery', () => {
  it('should reject ILP packet with forged signature', async () => {
    // A07:2021, NFR8, NFR13
  });
});
```

### 13.2 Test File Organization

**Directory Structure:**

```
packages/client/src/
├── nostr/
│   ├── relay-connection.ts
│   ├── relay-connection.test.ts           # Unit tests
│   └── relay-integration.test.ts          # Integration tests
├── ilp/
│   ├── packet-constructor.ts
│   ├── packet-constructor.test.ts         # Unit tests
│   ├── packet-signing.test.ts             # Unit tests
│   └── ilp-e2e.integration.test.ts        # E2E tests
├── wallet/
│   ├── balance-query.ts
│   ├── balance-query.test.ts              # Unit tests
│   └── wallet-integration.test.ts         # Integration tests
└── __tests__/                             # Shared test utilities
    ├── test-keypairs.ts
    ├── mock-crosstown.ts
    ├── mock-wallet.ts
    └── mock-bls.ts
```

**BLS Handler (Rust):**

```
docker/bls-handler/
├── src/
│   ├── main.rs
│   ├── event_parser.rs
│   ├── signature_validator.rs
│   ├── reducer_dispatcher.rs
│   └── tests/                             # Unit tests
│       ├── event_parser_tests.rs
│       ├── signature_validator_tests.rs
│       └── reducer_dispatcher_tests.rs
└── integration_tests/                     # Integration tests
    └── bls_handler_integration.rs
```

### 13.3 Test Utility Functions

**Mock Factories:**

```typescript
// packages/client/src/__tests__/test-factories.ts

export function createMockNostrRelay(): MockNostrRelay {
  // EventEmitter-based mock (consistent with Epic 1)
}

export function createMockCrosstownConnector(): MockCrosstown {
  // Mock ILP routing
}

export function createMockWallet(initialBalance: number): MockWallet {
  // Mock wallet with balance tracking
}

export function createMockBLSHandler(): MockBLS {
  // Mock BLS for unit testing client code
}
```

**Test Helpers:**

```typescript
// packages/client/src/__tests__/test-helpers.ts

export async function waitForActionConfirmation(
  client: SigilClient,
  timeout: number = 5000
): Promise<ActionConfirmation> {
  // Wait for confirmation event with timeout
}

export async function fundWallet(
  walletId: string,
  amount: number
): Promise<void> {
  // Fund test wallet via API
}

export async function resetSpacetimeDB(): Promise<void> {
  // Reset database state between tests
}
```

### 13.4 NFR Validation Matrix

**Epic 2 NFRs (from Architecture):**

| NFR ID | Requirement | Test Strategy | Validation Method |
|--------|-------------|---------------|-------------------|
| **NFR3** | ILP round-trip <2s under normal load | Performance tests | Latency measurement in integration tests |
| **NFR8** | ILP packets signed with Nostr key | Unit tests | Signature validation in packet construction |
| **NFR9** | Private key never transmitted | Security tests | Packet inspection, no nsec in transit |
| **NFR10** | Identity verification failures explicit | Error handling tests | Verify error messages, no silent failures |
| **NFR12** | Fee schedule publicly auditable | Configuration tests | Cost registry is JSON in repo |
| **NFR13** | No action without valid signature | Security tests | Signature forgery rejection |
| **NFR17** | Accurate transaction accounting | Concurrent tests | Wallet balance consistency |
| **NFR24** | Boundary-aware error handling | Error tests | Errors include boundary (crosstown, bls, spacetimedb) |
| **NFR27** | Zero silent failures | All tests | Explicit error validation, no exceptions swallowed |

**Validation Status (to be updated during implementation):**

| NFR | Story | Test Coverage | Status |
|-----|-------|---------------|--------|
| NFR3 | 2.3 | `ilp-performance-integration.test.ts` (5 tests) | ⏳ Pending |
| NFR8 | 2.3 | `ilp-packet-signing.test.ts` (15 tests) | ⏳ Pending |
| NFR9 | 2.3 | `ilp-security.test.ts` (10 tests) | ⏳ Pending |
| NFR10 | 2.5 | `identity-error-handling.test.ts` (5 tests) | ⏳ Pending |
| NFR12 | 2.2, 2.6 | `cost-registry-validation.test.ts` (10 tests) | ⏳ Pending |
| NFR13 | 2.4, 2.5 | `signature-validation.test.ts` (15 tests) | ⏳ Pending |
| NFR17 | 2.6 | `fee-accounting.test.ts` (15 tests) | ⏳ Pending |
| NFR24 | All | `error-handling.test.ts` (20 tests) | ⏳ Pending |
| NFR27 | All | All test suites | ⏳ Pending |

### 13.5 Known Risks & Open Questions

**Risks Requiring Attention:**

1. **BLS Handler Development Complexity:**
   - **Risk:** Underestimated effort to build BLS game action handler (Story 2.4)
   - **Mitigation:** PREP-5 spike validates architecture before implementation
   - **Test Impact:** May need additional integration tests if spike reveals complexity

2. **Crosstown Protocol Deviations:**
   - **Risk:** Crosstown Nostr relay may deviate from NIP-01 in unexpected ways
   - **Mitigation:** PREP-4 research documents deviations, update test suite accordingly
   - **Test Impact:** May need protocol compliance tests specific to Crosstown

3. **Subscription Recovery Dependency:**
   - **Risk:** Story 1.6 subscription recovery incomplete (PREP-1)
   - **Mitigation:** Complete PREP-1 before Story 2.1
   - **Test Impact:** Nostr relay reconnection tests depend on PREP-1 completion

4. **Linux Test Coverage Gap:**
   - **Risk:** Integration tests only validated on macOS (PREP-2)
   - **Mitigation:** Run full test suite on Linux before Epic 2 kickoff
   - **Test Impact:** May discover platform-specific failures in Docker stack

**Open Questions:**

1. **ILP Wallet Provider:**
   - Question: Use real ILP wallet or mock wallet for integration tests?
   - Impact: Test fidelity vs. complexity
   - Decision: TBD in PREP-6 (Set Up ILP Wallet Infrastructure)

2. **BLS Handler Deployment:**
   - Question: BLS handler runs as Docker service or embedded in Crosstown?
   - Impact: Integration test setup complexity
   - Decision: TBD in PREP-5 spike

3. **Performance Baseline:**
   - Question: What is acceptable p95 latency for ILP round-trip?
   - Impact: Performance test thresholds
   - Decision: Establish baseline in Story 2.3, iterate if needed

### 13.6 References

**Internal Documentation:**
- CLAUDE.md: Project-specific guidance for Claude agents
- `_bmad-output/planning-artifacts/epics.md`: Epic and story definitions
- `_bmad-output/planning-artifacts/architecture/`: Architecture documentation
- `_bmad-output/implementation-artifacts/epic-1-retro-2026-02-27.md`: Epic 1 retrospective

**External Standards:**
- NIP-01: Nostr Basic Protocol (https://github.com/nostr-protocol/nips/blob/master/01.md)
- OWASP Top 10 2021 (https://owasp.org/Top10/)
- Interledger Protocol (https://interledger.org/)

**Test Frameworks:**
- Vitest: https://vitest.dev/
- Rust test framework: https://doc.rust-lang.org/book/ch11-00-testing.html

---

## Step Summary

**Status:** ✅ SUCCESS

**Duration:** ~45 minutes (wall-clock time)

**What changed:**
- **Created:** `/Users/jonathangreen/Documents/BitCraftPublic/_bmad-output/planning-artifacts/test-design-epic-2.md` (comprehensive 325-test plan)

**Key decisions:**

1. **Risk-Based Prioritization:**
   - Identified 10 epic-level risks (R2-001 through R2-010)
   - Prioritized test effort: 60% P0 (critical path), 25% P1 (high priority), 15% P2/P3
   - Focus on HIGH risk areas: BLS handler (R2-001), Crosstown protocol (R2-002), ILP signing (R2-003)

2. **Test Pyramid Allocation:**
   - Unit tests: 65% (~195 tests) - Fast feedback, high coverage
   - Integration tests: 25% (~75 tests) - Component interactions, Docker stack
   - E2E tests: 10% (~30 tests) - Critical path validation
   - **Total target:** ~300 tests for Epic 2 (vs. 937 for Epic 1, appropriate for scope)

3. **TDD Enforcement:**
   - AGREEMENT-1 applies to ALL Epic 2 stories (all have ≥4 ACs)
   - Tests written BEFORE implementation for every story
   - Traceability reports required (AC → Test mapping)

4. **Security-First Approach:**
   - OWASP Top 10 compliance on every story (AGREEMENT-2)
   - 75 dedicated security tests across Epic 2
   - Focus on A02 (crypto), A03 (injection), A07 (auth)
   - Zero tolerance for high-severity issues

5. **Integration Test Strategy:**
   - Full Docker stack required (BitCraft + Crosstown + BLS + test wallet)
   - New `docker-compose.epic2.yml` extends Epic 1 stack
   - 90 integration tests validating full write path
   - Conditional execution (auto-skip if Docker unavailable)

6. **Performance Validation:**
   - NFR3 (ILP round-trip <2s) validated in Story 2.3
   - 10 performance benchmarks (baseline + load + stress tests)
   - Regression detection on every PR

**Issues found & fixed:** None (this is a planning document, no code changes)

**Remaining concerns:**

1. **BLS Handler Complexity:**
   - Story 2.4 is highest risk (new infrastructure, Rust + TS integration)
   - Mitigated by PREP-5 spike, but test count (65 tests) may be underestimate
   - Recommend buffer time for additional BLS integration tests

2. **Crosstown Protocol Gap:**
   - PREP-4 research may reveal NIP-01 deviations requiring custom tests
   - Test plan assumes NIP-01 compliance; may need protocol-specific tests

3. **Linux Test Coverage:**
   - PREP-2 must complete before Epic 2 (validates Docker stack on Linux)
   - If Linux issues found, integration test count may increase

4. **Test Execution Time:**
   - 325 tests target may push CI/CD execution time >10 minutes
   - Recommend parallelization strategy if CI becomes bottleneck

**Handoff Notes:**
- Test design is READY for Epic 2 implementation kickoff
- All 6 stories have detailed test plans (acceptance criteria → test suites)
- Quality gates defined (100% P0 coverage, ≥95% line coverage, OWASP compliance)
- Traceability matrix template established (follow Epic 1 pattern)
- Integration test strategy validated against Epic 1 Docker foundation

**Next Steps:**
1. Complete PREP tasks (PREP-1, PREP-2, PREP-4, PREP-5) before Epic 2 kickoff
2. Review test design with team (Dana, Charlie, Alice)
3. Begin Story 2.1 implementation with TDD approach
4. Generate traceability reports after each story completion
5. Update test design if PREP spikes reveal new risks

---

**Test Design Architect:** Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
**Document Version:** 1.0
**Approval Status:** ⏳ Pending team review
**Next Review:** After PREP tasks complete
