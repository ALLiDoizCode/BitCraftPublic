# Epic 2 Preparation Tasks

**Date:** 2026-02-27
**Status:** In Progress
**Epic:** Epic 2 - Action Execution & Payment Pipeline

---

## Overview

This document tracks the preparation tasks identified in the Epic 1 retrospective that must be completed before beginning Epic 2 implementation. These tasks address technical debt, platform compatibility, and architectural spikes required for Epic 2 success.

---

## Critical Path Tasks (Must Complete Before Epic 2)

### PREP-1: Complete Story 1.6 Subscription Recovery [BLOCKER]

**Owner:** Charlie (Senior Dev)
**Estimated Effort:** 8 hours
**Status:** NOT STARTED
**Priority:** CRITICAL - BLOCKS Epic 2

**Description:**
Task 5 in Story 1.6 (subscription recovery after reconnection) is partially complete. The reconnection logic works, but subscription re-subscribe flow and snapshot merging logic is stubbed out. The `ReconnectionManager.recoverSubscriptions()` method emits events but does not actually call back into the `SubscriptionManager` to re-establish subscriptions.

**Current State:**
- ✅ Subscription metadata capture before disconnect (working)
- ✅ Reconnection with exponential backoff (working)
- ✅ Event emission for subscription recovery (working)
- ❌ Actual re-subscription to tables (stubbed)
- ❌ Snapshot merging logic (not implemented)
- ❌ Integration tests for full recovery flow (mocked)

**Acceptance Criteria:**
- [ ] Wire `ReconnectionManager` to `SubscriptionManager` for actual re-subscription
- [ ] Implement subscription re-subscribe logic: iterate over stored subscriptions and call `subscribe(tableName, query)` for each
- [ ] Implement snapshot merging logic:
  - [ ] For each row in snapshot, check if it exists in cache
  - [ ] If exists and changed, update and emit update event
  - [ ] If new, add to cache and emit insert event
  - [ ] Preserve rows not in snapshot (may have been deleted server-side)
- [ ] Write integration tests validating full recovery flow (requires Docker)
- [ ] Verify all subscriptions restored within 10 seconds total (NFR23)
- [ ] Verify static data cache persists (do NOT reload static tables)
- [ ] Update Story 1.6 status to fully complete

**Impact if NOT Completed:**
Epic 2 Story 2.1 (Crosstown Relay Connection & Event Subscriptions) depends on reliable subscription recovery. Agents will miss action confirmations after reconnection without this. This is a BLOCKER for Epic 2 kickoff.

**Technical Notes:**
The `ReconnectionManager` currently stores subscription metadata in `subscriptionSnapshots` array but does not have a reference to the `SubscriptionManager`. Architectural refactoring required to pass `SubscriptionManager` into `ReconnectionManager` constructor or provide callback interface.

**Dependencies:**
- SpacetimeDB SDK subscription API (already implemented in `SubscriptionManager`)
- Table caching mechanism (already implemented in `TableAccessor`)

---

### PREP-2: Validate Linux Compatibility

**Owner:** Elena (Junior Dev)
**Estimated Effort:** 4 hours
**Status:** NOT STARTED
**Priority:** HIGH - BLOCKS Epic 2

**Description:**
All Epic 1 stories were tested on macOS only. Linux compatibility is assumed but not verified (NFR22 requires both Linux and macOS support). Epic 2 introduces BLS handler (Rust code) which must work on Linux.

**Acceptance Criteria:**
- [ ] Run full test suite on Linux (Ubuntu 24.04 or equivalent)
  - [ ] 810 unit tests pass
  - [ ] 127 integration tests pass (requires Docker)
- [ ] Run Docker stack on Linux and verify all services start
  - [ ] `bitcraft-server` starts and health checks pass
  - [ ] `crosstown-node` starts and health checks pass
  - [ ] `docker compose -f docker/docker-compose.yml ps` shows all services healthy
- [ ] Document any platform-specific issues found
  - [ ] File path differences (e.g., line endings, path separators)
  - [ ] Docker volume mount compatibility
  - [ ] Network binding differences
- [ ] Update CI to run integration tests on both macOS and Linux
  - [ ] Add Linux runner to GitHub Actions workflows
  - [ ] Verify integration tests pass on Linux runner

**Impact if NOT Completed:**
NFR22 (cross-platform support) will not be met. Epic 2 BLS handler (Rust code) may have Linux-specific issues that are not caught until later. This could delay Epic 2 stories 2.4-2.6.

**Technical Notes:**
- Spin up Ubuntu 24.04 VM or use GitHub Actions Linux runner
- Docker Compose V2 syntax is already used (compatible with Linux)
- Pay attention to file system case sensitivity (Linux vs. macOS)

**Dependencies:**
- Docker Desktop for Linux or native Docker Engine
- GitHub Actions Linux runner (ubuntu-latest)

---

### PREP-4: Research Crosstown Nostr Relay Protocol

**Owner:** Charlie (Senior Dev)
**Estimated Effort:** 4 hours
**Status:** NOT STARTED
**Priority:** HIGH - BLOCKS Epic 2 Story 2.1

**Description:**
Story 2.1 (Crosstown Relay Connection & Event Subscriptions) requires understanding Crosstown's built-in Nostr relay. Charlie flagged documentation gaps in Epic 1. The Crosstown relay implementation may deviate from standard NIP-01 Nostr relay protocol.

**Acceptance Criteria:**
- [ ] Read Crosstown source code for relay implementation
  - [ ] Identify relay event types (kind numbers)
  - [ ] Document subscription filter syntax
  - [ ] Document connection protocol (WebSocket handshake, authentication)
- [ ] Create reference doc for Story 2.1 implementation
  - [ ] Event type reference (kind numbers and their meanings)
  - [ ] Subscription filter examples
  - [ ] Connection flow diagram
  - [ ] Error handling patterns
- [ ] Identify any Crosstown features not in standard Nostr relay (NIP-01)
  - [ ] Custom event kinds (e.g., kind 30078 for BLS callbacks)
  - [ ] Proprietary filters or query syntax
  - [ ] Authentication mechanisms
  - [ ] Rate limiting behavior

**Deliverables:**
- `_bmad-output/implementation-artifacts/crosstown-relay-protocol-reference.md`

**Impact if NOT Completed:**
Story 2.1 implementation will be delayed as Charlie reverse-engineers the protocol during implementation. This is on the critical path for Epic 2.

**Technical Notes:**
- Crosstown source code location: TBD (check Docker image or GitHub repo)
- NIP-01 reference: https://github.com/nostr-protocol/nips/blob/master/01.md
- Focus on event types used for ILP packet delivery and action confirmations

**Dependencies:**
- Crosstown source code access or running Crosstown node for live testing

---

### PREP-5: Spike BLS Handler Architecture

**Owner:** Charlie (Senior Dev) + Elena (Junior Dev) - PAIR PROGRAMMING
**Estimated Effort:** 6 hours
**Status:** NOT STARTED
**Priority:** HIGH - BLOCKS Epic 2 Story 2.4

**Description:**
Story 2.4 (BLS Game Action Handler) is the most complex story in Epic 2. Architecture is defined, but implementation details are unclear. This spike validates feasibility and identifies blockers before committing to Story 2.4.

**Acceptance Criteria:**
- [ ] Review architecture doc section on BLS identity propagation
  - [ ] Re-read `_bmad-output/planning-artifacts/architecture/7-crosstown-integration.md`
  - [ ] Identify gaps or ambiguities in architecture spec
- [ ] Prototype minimal BLS callback in Crosstown (kind 30078 events)
  - [ ] Subscribe to Crosstown relay for kind 30078 events
  - [ ] Parse event payload (ILP packet, Nostr signature)
  - [ ] Extract reducer name and arguments from ILP packet
  - [ ] Log event to verify subscription works
- [ ] Validate ILP packet parsing and SpacetimeDB reducer calling
  - [ ] Parse ILP packet format (Interledger Protocol)
  - [ ] Extract Nostr public key from signed ILP packet
  - [ ] Call SpacetimeDB reducer with extracted arguments
  - [ ] Verify reducer execution completes successfully
- [ ] Document findings and share with team
  - [ ] Write spike report with recommendations
  - [ ] Identify any architectural changes needed
  - [ ] Create task list for Story 2.4 implementation

**Deliverables:**
- `_bmad-output/implementation-artifacts/bls-handler-spike-report.md`
- Proof-of-concept code (throwaway, not production)

**Impact if NOT Completed:**
Story 2.4 implementation may hit unexpected blockers mid-sprint. The BLS handler is the most risky component in Epic 2 (flagged in retrospective). This spike de-risks the implementation.

**Technical Notes:**
- Pair programming recommended (Charlie + Elena) - AGREEMENT-3
- Spike is timeboxed to 6 hours - stop and document findings even if not complete
- Focus on validating architecture assumptions, NOT production implementation

**Dependencies:**
- Crosstown relay running locally (from Story 1.3 Docker stack)
- SpacetimeDB SDK reducer calling API
- ILP packet format specification

---

### ACTION-1: Establish Integration Test Strategy

**Owner:** Charlie (Senior Dev)
**Estimated Effort:** 2 hours
**Status:** NOT STARTED
**Priority:** MEDIUM - Should complete before Epic 2

**Description:**
127 integration tests require the full Docker stack (BitCraft server + Crosstown node + BLS handler), which adds complexity to CI/CD and local development. New contributors struggle with Docker setup (flagged in retrospective). We need clear guidelines on when to write integration tests vs. unit tests, and how to handle Docker dependencies.

**Acceptance Criteria:**
- [ ] Document when to write integration tests vs. unit tests
  - [ ] Integration tests: Full stack interactions, end-to-end flows, real WebSocket connections
  - [ ] Unit tests: Business logic, state management, pure functions, mocked dependencies
  - [ ] Guideline: Prefer unit tests unless you need to verify network behavior or Docker services
- [ ] Document how to handle Docker dependencies in CI
  - [ ] GitHub Actions workflow for integration tests (Docker Compose setup)
  - [ ] Conditional test execution (skip integration tests if Docker unavailable)
  - [ ] Health check strategy (wait for services to be ready before running tests)
- [ ] Document fallback strategies when Docker isn't available
  - [ ] Auto-skip integration tests with clear message
  - [ ] Provide lightweight mocks for local development (optional)
  - [ ] Document Docker setup instructions for new contributors

**Deliverables:**
- Update `CLAUDE.md` with integration test strategy section
- Create `TESTING.md` guide for contributors

**Impact if NOT Completed:**
Epic 2 stories will continue the ad-hoc approach to integration testing. New contributors will struggle with setup (reduces team velocity).

**Technical Notes:**
- Review Vitest configuration for conditional test execution
- Document Docker Compose health check patterns
- Align with AGREEMENT-5 from retrospective

---

## Recommended Tasks (Non-Blocking)

### PREP-3: Document Static Data Table Debt

**Owner:** Alice (Product Owner)
**Estimated Effort:** 1 hour
**Status:** IN PROGRESS
**Priority:** MEDIUM

**Description:**
Story 1.5 loaded only 40 of 148 static data tables. Remaining 108 tables must be tracked as technical debt. If Epic 2 stories need those tables, we'll hit blockers.

**Acceptance Criteria:**
- [ ] Create GitHub issue: "Load remaining 108 static data tables"
  - [ ] List all 148 tables from BitCraft schema
  - [ ] Identify which 40 are already loaded
  - [ ] Document which 108 are missing
- [ ] Identify which tables are likely needed for Epic 2-6
  - [ ] Review Epic 2 stories for table dependencies
  - [ ] Flag high-priority tables (e.g., action cost tables, item descriptions)
- [ ] Add to backlog with priority
  - [ ] High priority: Tables needed for Epic 2-3
  - [ ] Medium priority: Tables needed for Epic 4-6
  - [ ] Low priority: Nice-to-have tables

**Deliverables:**
- GitHub issue with detailed table list and priority
- Update `_bmad-output/implementation-artifacts/technical-debt-register.md`

**Impact if NOT Completed:**
Epic 2-6 stories may discover missing tables mid-implementation, causing delays.

**Technical Notes:**
- Reference `packages/client/src/spacetimedb/static-data-tables.ts` (currently 34 tables listed)
- BitCraft schema introspection: `docker exec bitcraft-server spacetime schema list`

---

### PREP-6: Set Up ILP Wallet Infrastructure

**Owner:** Alice (Product Owner) + Jonathan (Project Lead)
**Estimated Effort:** 3 hours
**Status:** NOT STARTED
**Priority:** MEDIUM - Can complete during early Epic 2 stories

**Description:**
Story 2.2 (Action Cost Registry & Wallet Balance) requires ILP wallet balance queries. Wallet infrastructure must exist before Story 2.2 starts.

**Acceptance Criteria:**
- [ ] Determine ILP wallet provider (mock vs. real)
  - [ ] Option 1: Mock wallet for development (fast, no external dependencies)
  - [ ] Option 2: Real wallet provider (e.g., Rafiki, Interledger.js)
  - [ ] Decision: Document rationale in Epic 2 prep report
- [ ] Set up test accounts and fund with test ILP
  - [ ] Create 3 test accounts (Alice, Bob, Charlie)
  - [ ] Fund each with 10,000 ILP test units
  - [ ] Document account addresses and credentials
- [ ] Document wallet API endpoints
  - [ ] Balance query: `GET /wallet/{address}/balance`
  - [ ] Transaction history: `GET /wallet/{address}/transactions`
  - [ ] Send payment: `POST /wallet/{address}/send`
- [ ] Share credentials with dev team
  - [ ] Add to `.env.example` file
  - [ ] Add to `docker/README.md` (Docker stack documentation)
  - [ ] Add to team Slack channel

**Deliverables:**
- ILP wallet setup documentation
- `.env.example` updated with wallet credentials

**Impact if NOT Completed:**
Story 2.2 will be blocked waiting for wallet infrastructure. Can be completed in parallel with Story 2.1.

**Technical Notes:**
- Lean toward mock wallet for MVP (Epic 1-6)
- Real wallet integration can be deferred to Phase 2 (Epic 7-10)

---

### PREP-7: Create Epic 2 Code Review Checklist

**Owner:** Charlie (Senior Dev)
**Estimated Effort:** 2 hours
**Status:** NOT STARTED
**Priority:** MEDIUM - Should complete before Epic 2 Story 2.1 review

**Description:**
Epic 1 code reviews were thorough but ad-hoc. A checklist will improve consistency and reduce review time. Extract common review issues from Epic 1 and create reusable checklist.

**Acceptance Criteria:**
- [ ] Extract common review issues from Epic 1
  - [ ] H-001 (path traversal in Docker volumes)
  - [ ] H-002 (unvalidated port ranges in Docker config)
  - [ ] H-003 (Nostr relay DoS risk - unbounded subscriptions)
  - [ ] TypeScript: `any` types, missing error handling
  - [ ] Rust: `unsafe` blocks, missing error propagation
- [ ] Create checklist covering OWASP Top 10, Rust safety, TypeScript safety
  - [ ] OWASP Top 10: Injection, broken auth, XSS, SSRF, etc.
  - [ ] TypeScript: No `any`, null checks, error handling, type exports
  - [ ] Rust: No `unsafe`, Result propagation, memory safety, async best practices
- [ ] Add checklist to project docs
  - [ ] Create `_bmad-output/implementation-artifacts/code-review-checklist.md`
  - [ ] Link from `CLAUDE.md` and `CONTRIBUTING.md`
- [ ] Train Dana (QA) on using checklist
  - [ ] Pair review session (Charlie + Dana)
  - [ ] Review Epic 1 retrospective security findings

**Deliverables:**
- `_bmad-output/implementation-artifacts/code-review-checklist.md`
- Dana trained on checklist usage

**Impact if NOT Completed:**
Epic 2 code reviews will continue ad-hoc approach. Review quality may vary, and security issues may slip through.

**Technical Notes:**
- Align with AGREEMENT-2 (security review on every story)
- Reference OWASP Top 10 2021: https://owasp.org/Top10/

---

## Action Items (Process Improvements)

### ACTION-2: Adopt Security-First Code Review Protocol

**Owner:** Charlie (Senior Dev) + Dana (QA Engineer)
**Estimated Effort:** Ongoing (process change)
**Status:** NOT STARTED
**Priority:** HIGH

**Description:**
Formalize security review as a mandatory step in every story. Epic 1 caught 3 high-severity issues in code review (H-001, H-002, H-003). This must continue in Epic 2.

**Acceptance Criteria:**
- [ ] Create OWASP Top 10 checklist (covered in PREP-7)
- [ ] Add security review step to every story
  - [ ] Before marking story "done", run security review
  - [ ] Use checklist to verify OWASP Top 10 compliance
  - [ ] Document findings in code review report
- [ ] Train team on common vulnerabilities
  - [ ] Injection attacks (SQL, command, path traversal)
  - [ ] SSRF (Server-Side Request Forgery)
  - [ ] DoS (Denial of Service) vectors
  - [ ] Authentication bypass
  - [ ] Secrets in code

**Deliverables:**
- Security review step added to story workflow
- Team training session (1 hour)

**Impact if NOT Completed:**
Security vulnerabilities may slip into production. Epic 1 proved that security review catches critical issues.

**Technical Notes:**
- Aligns with AGREEMENT-2 from retrospective
- Reference AGREEMENT-3 (pair review on unfamiliar tech)

---

## Documentation Tasks

### DOC-1: Create Epic 1 Architecture Decisions Record (ADR)

**Owner:** Charlie (Senior Dev)
**Estimated Effort:** 2 hours
**Deadline:** End of Week
**Status:** NOT STARTED
**Priority:** MEDIUM

**Description:**
Document key architecture decisions from Epic 1 for future reference. This prevents "why did we do it this way?" questions 6 months from now.

**Acceptance Criteria:**
- [ ] Document key decisions:
  - [ ] SpacetimeDB 2.0 SDK on 1.6.x servers (backwards compatibility decision)
  - [ ] Nostr-only identity (no OAuth, no passwords)
  - [ ] Polyglot monorepo (TypeScript + Rust)
  - [ ] Docker dev stack (local development environment)
- [ ] For each decision, capture:
  - [ ] Context (what problem were we solving?)
  - [ ] Options considered (what alternatives did we evaluate?)
  - [ ] Decision (what did we choose?)
  - [ ] Rationale (why did we choose this?)
  - [ ] Consequences (what are the trade-offs?)
- [ ] Create ADR format:
  - [ ] Title: "ADR-001: [Decision Title]"
  - [ ] Status: Accepted | Superseded | Deprecated
  - [ ] Date: YYYY-MM-DD
  - [ ] Deciders: [List of people involved]

**Deliverables:**
- `_bmad-output/implementation-artifacts/adr/adr-001-spacetimedb-sdk-version.md`
- `_bmad-output/implementation-artifacts/adr/adr-002-nostr-only-identity.md`
- `_bmad-output/implementation-artifacts/adr/adr-003-polyglot-monorepo.md`
- `_bmad-output/implementation-artifacts/adr/adr-004-docker-dev-stack.md`

**Impact if NOT Completed:**
Future team members will not understand why decisions were made. Architectural drift may occur as new decisions contradict old ones.

**Technical Notes:**
- ADR format: https://adr.github.io/
- Reference Epic 1 retrospective and story reports for decision context

---

### DOC-2: Write Crosstown Relay Protocol Reference

**Owner:** Charlie (Senior Dev)
**Estimated Effort:** Included in PREP-4
**Status:** NOT STARTED (part of PREP-4)
**Priority:** HIGH - BLOCKS Epic 2 Story 2.1

**Description:**
Document Crosstown's built-in Nostr relay, including event types, subscription filters, and deviations from NIP-01. This is a deliverable of PREP-4.

See PREP-4 for details.

---

## Deferred Tasks (Track, Don't Implement Now)

### ACTION-3: Improve First-Time Contributor Onboarding

**Owner:** Elena (Junior Dev)
**Deadline:** End of Epic 2
**Status:** DEFERRED
**Priority:** LOW

**Description:**
Write `CONTRIBUTING.md` with setup instructions, Docker quickstart, and links to key architecture docs. Goal: new contributor can run tests in < 30 minutes.

**Reason for Deferral:**
Not blocking Epic 2. Can be completed in parallel during Epic 2 stories.

---

### DEBT-2: Load Remaining 108 Static Data Tables

**Owner:** Elena (Junior Dev)
**Estimated Effort:** 12 hours
**Status:** DEFERRED
**Priority:** MEDIUM - May block Epic 3-4

**Description:**
Story 1.5 loaded 40/148 static data tables. Remaining 108 tables needed for full game state coverage.

**Reason for Deferral:**
Create GitHub issue (PREP-3), prioritize for Epic 3-4. Not blocking Epic 2.

---

### DEBT-4: Improve Docker Test Stability

**Owner:** Charlie (Senior Dev)
**Estimated Effort:** 4 hours
**Status:** DEFERRED
**Priority:** LOW (quality of life)

**Description:**
Make integration tests auto-skip when Docker isn't running, or provide lightweight mocks.

**Reason for Deferral:**
ACTION-1 (integration test strategy) addresses this at the process level. Code changes can be deferred to backlog.

---

## Timeline & Dependencies

**Critical Path (must complete before Epic 2 kickoff):**

```
Day 1 (8 hours):
- Charlie: PREP-1 (8h) - Subscription recovery
- Elena: PREP-2 (4h) + start PREP-4 research (2h)

Day 2 (8 hours):
- Charlie: PREP-4 (4h) + ACTION-1 (2h)
- Elena: Continue PREP-2 (2h) + assist PREP-4 (4h)

Day 3 (8 hours):
- Charlie + Elena: PREP-5 (6h) - BLS spike (pair programming)
- Charlie: Finalize PREP-4 docs (2h)

Total: 24 hours (3 days at 8 hours/day)
```

**Parallel Workstreams (can complete during early Epic 2 stories):**

- Alice: PREP-3 (1h) + PREP-6 (3h) - Can start immediately
- Charlie: PREP-7 (2h) + DOC-1 (2h) - Can complete before Story 2.1 review

**Epic 2 Readiness Gate:**

✅ PREP-1: Subscription recovery COMPLETE
✅ PREP-2: Linux compatibility VALIDATED
✅ PREP-4: Crosstown protocol DOCUMENTED
✅ PREP-5: BLS spike COMPLETE
✅ ACTION-1: Integration test strategy DOCUMENTED

---

## Status Tracking

Last Updated: 2026-02-27

| Task | Owner | Effort | Status | Blocker? |
|------|-------|--------|--------|----------|
| PREP-1 | Charlie | 8h | NOT STARTED | ✅ YES |
| PREP-2 | Elena | 4h | NOT STARTED | ✅ YES |
| PREP-3 | Alice | 1h | IN PROGRESS | ❌ NO |
| PREP-4 | Charlie | 4h | NOT STARTED | ✅ YES |
| PREP-5 | Charlie + Elena | 6h | NOT STARTED | ✅ YES |
| PREP-6 | Alice + Jonathan | 3h | NOT STARTED | ❌ NO |
| PREP-7 | Charlie | 2h | NOT STARTED | ❌ NO |
| ACTION-1 | Charlie | 2h | NOT STARTED | ⚠️  RECOMMENDED |
| ACTION-2 | Charlie + Dana | Ongoing | NOT STARTED | ❌ NO |
| DOC-1 | Charlie | 2h | NOT STARTED | ❌ NO |

**Total Effort (Critical Path):** 24 hours (3 days)
**Total Effort (All Tasks):** 33 hours (4 days)

---

## Next Steps

1. **Start Critical Path (Day 1):** Charlie begins PREP-1, Elena begins PREP-2
2. **Review Progress Daily:** Standup meetings to track prep task completion
3. **Epic 2 Kickoff Decision:** After Day 3, assess readiness and decide Epic 2 start date
4. **Retrospective Learnings:** Apply Epic 1 agreements (TDD, security review, pairing) to prep tasks

---

**Document Status:** LIVING DOCUMENT - Update as prep tasks complete
**Last Updated:** 2026-02-27 by Claude Code
