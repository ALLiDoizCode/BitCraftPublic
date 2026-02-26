---
stepsCompleted: []
lastStep: ''
lastSaved: ''
---

# Test Design: Epic 1 - Project Foundation & Game World Connection

**Date:** 2026-02-26
**Author:** Jonathan
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic 1

**Risk Summary:**

- Total risks identified: 11
- High-priority risks (≥6): 4
- Critical categories: TECH (5 risks), SEC (1 risk), PERF (2 risks)

**Coverage Summary:**

- P0 scenarios: 31 (~40-50 hours)
- P1 scenarios: 30 (~35-45 hours)
- P2/P3 scenarios: 15 (~18-25 hours)
- **Total effort**: 76 tests, ~93-120 hours (~12-15 days)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **BitCraft game server testing** | Original BitCraft codebase is Apache 2.0 fork, run unmodified | Rely on upstream BitCraft tests |
| **Crosstown relay internals** | Third-party dependency, integration point only | Test SDK integration, not Crosstown implementation |
| **SpacetimeDB server module** | Server-side WASM module is existing codebase | Test client SDK connection, not module logic |
| **External LLM backends** | Phase 2 feature, not in Epic 1 scope | Defer to Phase 2 testing |

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|---------|-------|-----------|-------|----------|
| R-001 | TECH | SpacetimeDB 2.0 SDK backwards compatibility with 1.6.x server unverified | 3 | 3 | 9 | Run compatibility spike before Story 1.4 implementation. If incompatible, fall back to 1.6.x client SDK | Dev | Before Story 1.4 |
| R-002 | SEC | Nostr private key storage without encryption-at-rest (NFR11 requires encrypted at rest with passphrase) | 2 | 3 | 6 | Implement passphrase encryption in Story 1.2 OR defer to Phase 2 with explicit warning in code/docs | Dev | Story 1.2 or Phase 2 |
| R-003 | TECH | WebSocket reconnection state recovery may lose in-flight updates during disconnect window | 3 | 2 | 6 | Implement event buffer with replay mechanism for missed updates during reconnection | Dev | Story 1.6 |
| R-004 | PERF | Static data loading (148 tables) may exceed 10s performance budget (NFR6) | 2 | 3 | 6 | Profile early, implement parallel loading with connection pooling if serial loading too slow | Dev | Story 1.5 |

### Medium-Priority Risks (Score 4-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|---------|-------|-----------|-------|
| R-005 | OPS | Docker images for BitCraft/Crosstown may not exist publicly | 2 | 2 | 4 | Build from source with Dockerfiles if needed, budget extra time for Story 1.3 | Dev |
| R-006 | TECH | CI/CD complexity with polyglot monorepo (TS + Rust) may cause flaky builds | 2 | 2 | 4 | Use matrix builds, workspace caching, keep CI simple | Dev |
| R-007 | DATA | Subscription state inconsistency after rapid disconnect/reconnect cycles | 2 | 2 | 4 | Add connection state machine with hysteresis to prevent race conditions | Dev |
| R-008 | TECH | TypeScript strict mode may surface type errors in SpacetimeDB generated types | 2 | 2 | 4 | Run typecheck early, fix generated type issues upstream if needed | Dev |

### Low-Priority Risks (Score 1-3)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|---------|-------|--------|
| R-009 | OPS | Platform differences between Linux and macOS Docker environments | 1 | 2 | 2 | Monitor in CI, fix if issues arise |
| R-010 | BUS | User confusion about Nostr key backup workflow | 1 | 2 | 2 | Document clearly in README |
| R-011 | PERF | Exponential backoff cap at 30s may feel slow to users | 1 | 1 | 1 | Monitor user feedback, adjust if needed |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] Requirements and assumptions agreed upon by QA, Dev, PM
- [ ] Docker and docker-compose installed on dev machines
- [ ] SpacetimeDB CLI available for local testing
- [ ] Nostr test keys generated for test fixtures
- [ ] R-001 (SDK compatibility) verified via spike before Story 1.4

## Exit Criteria

- [ ] All P0 tests passing
- [ ] All P1 tests passing (or failures triaged)
- [ ] No open high-priority / high-severity bugs
- [ ] R-001, R-002, R-003, R-004 mitigated or explicitly waived
- [ ] Test coverage ≥80% on critical paths

---

## Test Coverage Plan

### P0 (Critical) - Run on every commit

**Criteria**: Blocks core journey + High risk (≥6) + No workaround

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|------------|-----------|------------|-------|-------|
| Story 1.1 - CI/CD pipeline validation | Integration | - | 2 | Dev | Verify TS + Rust builds pass |
| Story 1.2 - Nostr key generation | Unit | R-002 | 3 | Dev | Generate, validate, no duplicates |
| Story 1.2 - Key import (hex/nsec) | Unit | R-002 | 3 | Dev | Valid formats, error on invalid |
| Story 1.2 - Key export | Integration | R-002 | 2 | Dev | File operations, encryption |
| Story 1.2 - Identity signing | Unit | R-002 | 2 | Dev | Sign/verify operations |
| Story 1.3 - Docker compose startup | Integration | R-005 | 2 | Dev | BitCraft + Crosstown running |
| Story 1.4 - SpacetimeDB WebSocket connection | Integration | R-001 | 3 | Dev | Connect, subscribe, disconnect |
| Story 1.4 - Table subscriptions | Integration | R-001 | 4 | Dev | Subscribe, updates, type safety |
| Story 1.4 - SDK backwards compatibility | Integration | R-001 | 3 | Dev | 2.0 client + 1.6.x server |
| Story 1.6 - Auto-reconnection | Integration | R-003 | 4 | Dev | Disconnect, backoff, reconnect |
| Story 1.6 - Subscription recovery | Integration | R-003 | 3 | Dev | Re-subscribe, state recovery |

**Total P0**: 31 tests, ~40-50 hours

### P1 (High) - Run on PR to main

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|------------|-----------|------------|-------|-------|
| Story 1.1 - Monorepo workspace structure | Unit | - | 2 | Dev | pnpm + cargo workspace validation |
| Story 1.1 - Shared config inheritance | Unit | - | 3 | Dev | tsconfig, ESLint, rustfmt |
| Story 1.2 - Seed phrase import | Unit | R-002 | 2 | Dev | BIP-39 derivation |
| Story 1.3 - Docker dev overrides | Integration | R-005 | 2 | Dev | docker-compose.dev.yml |
| Story 1.3 - Platform compatibility | Integration | R-009 | 2 | Dev | Linux + macOS tests |
| Story 1.4 - Type-safe table accessors | Integration | R-008 | 3 | Dev | Generated types from SDK |
| Story 1.4 - gameStateUpdate events | Integration | - | 3 | Dev | Event aggregation |
| Story 1.5 - Static data loading | Integration | R-004 | 4 | Dev | Load all *_desc tables |
| Story 1.5 - Lookup maps | Integration | R-004 | 3 | Dev | Query by ID, performance |
| Story 1.6 - Exponential backoff | Unit | - | 3 | Dev | Backoff calculation, 30s cap |
| Story 1.6 - Connection status events | Integration | - | 3 | Dev | connected/disconnected/reconnecting |

**Total P1**: 30 tests, ~35-45 hours

### P2 (Medium) - Run nightly/weekly

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|------------|-----------|------------|-------|-------|
| Story 1.1 - Build artifact validation | Integration | - | 2 | Dev | ESM + CJS + DTS output |
| Story 1.2 - Key export error handling | Unit | - | 2 | Dev | Missing file, permissions |
| Story 1.3 - Docker image build from source | Integration | R-005 | 2 | Dev | If images missing |
| Story 1.4 - Connection timeout handling | Integration | - | 2 | Dev | Server unreachable |
| Story 1.5 - Static data caching | Integration | - | 2 | Dev | Subsequent loads fast |
| Story 1.6 - Persistent failure handling | Integration | - | 2 | Dev | Exhaust retries, emit failed event |

**Total P2**: 12 tests, ~15-20 hours

### P3 (Low) - Run on-demand

**Criteria**: Nice-to-have + Exploratory + Performance benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
|-------------|------------|------------|-------|-------|
| Story 1.2 - User confusion about backup | Manual | 1 | QA | UX validation |
| Story 1.6 - Reconnect latency benchmarks | Performance | 2 | Dev | Measure 10s recovery |

**Total P3**: 3 tests, ~3-5 hours

---

## Execution Order

### Smoke Tests (<5 min)

**Purpose**: Fast feedback, catch build-breaking issues

- [ ] Docker compose starts successfully (30s)
- [ ] SpacetimeDB connection succeeds (30s)
- [ ] Nostr key generation works (10s)

**Total**: 3 scenarios

### P0 Tests (<10 min)

**Purpose**: Critical path validation

- [ ] All Story 1.2 identity tests (Unit)
- [ ] All Story 1.4 connection tests (Integration)
- [ ] All Story 1.6 reconnection tests (Integration)

**Total**: 31 scenarios

### P1 Tests (<30 min)

**Purpose**: Important feature coverage

- [ ] All workspace and config tests
- [ ] Static data loading tests
- [ ] Event system tests

**Total**: 30 scenarios

### P2/P3 Tests (<60 min)

**Purpose**: Full regression coverage

- [ ] Edge cases and error scenarios
- [ ] Performance benchmarks

**Total**: 15 scenarios

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
|----------|-------|------------|-------------|-------|
| P0 | 31 | 1.5-2.0 | 40-50 | Complex setup, security |
| P1 | 30 | 1.0-1.5 | 35-45 | Standard coverage |
| P2 | 12 | 1.0-1.5 | 15-20 | Simple scenarios |
| P3 | 3 | 1.0-2.0 | 3-5 | Exploratory |
| **Total** | **76** | **-** | **93-120** | **~12-15 days** |

### Prerequisites

**Test Data:**

- Nostr test key factory (faker-based, auto-cleanup)
- SpacetimeDB table fixtures (pre-seeded data)
- Docker image cache (build once, reuse)

**Tooling:**

- Vitest for TypeScript unit/integration tests
- Cargo test for Rust unit tests
- Docker compose for integration environment
- GitHub Actions for CI/CD

**Environment:**

- Docker + docker-compose installed
- Node.js 20+ and pnpm
- Rust 1.70+ and cargo
- SpacetimeDB CLI for local testing

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers (R-001, R-002, R-003, R-004)

### Coverage Targets

- **Critical paths**: ≥80% (connection, identity, reconnection)
- **Security scenarios**: 100% (identity management, key storage)
- **Business logic**: ≥70% (static data loading, subscriptions)
- **Edge cases**: ≥50% (error handling, timeouts)

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) items unmitigated
- [ ] R-001 (SDK compatibility) verified before Story 1.4
- [ ] R-002 (key encryption) resolved or explicitly waived with security review
- [ ] R-003 (reconnection) implements event buffer and replay
- [ ] R-004 (static data perf) meets 10s budget or has approved waiver

---

## Mitigation Plans

### R-001: SpacetimeDB 2.0 SDK backwards compatibility with 1.6.x server unverified (Score: 9)

**Mitigation Strategy:** Run 0.5-day compatibility spike after Story 1.1 completes. Test SpacetimeDB 2.0.1 TypeScript client connecting to BitCraft 1.6.x server. Verify subscriptions, table updates, and type generation work correctly. If incompatible, fall back to SpacetimeDB 1.6.x client SDK and update architecture docs.

**Owner:** Dev Lead
**Timeline:** Before Story 1.4 starts
**Status:** Planned
**Verification:** Create spike test that connects 2.0 client to 1.6.x server, subscribes to a table, receives updates. Document outcome in spike report.

### R-002: Nostr private key storage without encryption-at-rest (Score: 6)

**Mitigation Strategy:** Option A: Implement passphrase encryption in Story 1.2 using standard crypto libraries (add 2-3 days). Option B: Store plaintext at ~/.sigil/identity for MVP with clear warning in README and FIXME comment, defer encryption to Phase 2. Recommend Option B for MVP velocity if security review approves waiver.

**Owner:** Dev Lead + Security Review
**Timeline:** Story 1.2 or Phase 2
**Status:** Planned
**Verification:** If Option A: Test passphrase encryption/decryption. If Option B: Security review approves waiver with documented risks.

### R-003: WebSocket reconnection state recovery may lose in-flight updates (Score: 6)

**Mitigation Strategy:** Implement event buffer in Story 1.6 that stores missed SpacetimeDB updates during disconnection. On reconnection, replay buffered events before resuming live updates. Use timestamp-based deduplication to prevent duplicate processing.

**Owner:** Dev
**Timeline:** Story 1.6
**Status:** Planned
**Verification:** Integration test: Disconnect during active updates, reconnect, verify all updates received in order with no duplicates.

### R-004: Static data loading (148 tables) may exceed 10s performance budget (Score: 6)

**Mitigation Strategy:** Profile static data loading in Story 1.5. If serial loading exceeds 10s, implement parallel requests with connection pooling. If still slow, consider lazy loading for non-critical tables or caching at SDK level.

**Owner:** Dev
**Timeline:** Story 1.5
**Status:** Planned
**Verification:** Performance test: Measure cold-start static data load time, ensure ≤10s (NFR6). Benchmark with 148 tables.

---

## Assumptions and Dependencies

### Assumptions

1. SpacetimeDB 2.0 SDK is backwards-compatible with 1.6.x servers (R-001 to verify)
2. BitCraft and Crosstown have public Docker images OR can be built from source
3. Nostr keypair generation uses standard `nostr-tools` library
4. Static data tables are read-only and cacheable after first load
5. NFR11 (encryption at rest) can be deferred to Phase 2 with waiver if needed
6. CI/CD runs on GitHub Actions with Docker support

### Dependencies

1. SpacetimeDB server (BitCraft 1.6.x) must be running for integration tests - Required by Story 1.3
2. Crosstown node with Nostr relay must be available for Epic 2 - Required by Story 1.3
3. `nostr-tools` TypeScript library for key management - Required by Story 1.2
4. SpacetimeDB 2.0 TypeScript client SDK available via npm - Required by Story 1.4
5. Docker and docker-compose on CI runners - Required by Story 1.3

### Risks to Plan

- **Risk**: R-001 (SDK compatibility) fails spike, requiring fallback to 1.6.x SDK
  - **Impact**: 1-2 day delay for Story 1.4, architecture docs update
  - **Contingency**: Use SpacetimeDB 1.6.x client SDK as fallback, update PRD/architecture
- **Risk**: Docker images don't exist, require building from source
  - **Impact**: 2-3 day delay for Story 1.3
  - **Contingency**: Build Dockerfiles for BitCraft + Crosstown, cache in CI
- **Risk**: Static data loading exceeds 10s budget
  - **Impact**: 1-2 day delay for Story 1.5 optimization
  - **Contingency**: Parallel loading, lazy loading, or request waiver for NFR6

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: \_\_\_\_\_ Date: \_\_\_\_\_
- [ ] Tech Lead: \_\_\_\_\_ Date: \_\_\_\_\_
- [ ] QA Lead: \_\_\_\_\_ Date: \_\_\_\_\_

**Comments:**

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **BitCraft Server** | SDK reads game state | No regression tests needed (unmodified upstream) |
| **Crosstown Relay** | SDK connects to Nostr relay | No regression tests needed (Epic 2 scope) |
| **SpacetimeDB SDK** | Core dependency | Verify SDK version compatibility (R-001) |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/index.md`
- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 1)
- Architecture: `_bmad-output/planning-artifacts/architecture/index.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (Step-File Architecture)
