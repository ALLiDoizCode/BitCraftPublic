# Epic 5: Test Design - BitCraft Game Analysis & Playability Validation

**Epic:** Epic 5 - BitCraft Game Analysis & Playability Validation
**Test Design Type:** Risk-Based Test Plan
**Epic-Level Analysis Mode:** ENABLED
**Created:** 2026-03-15
**Test Architect:** Claude Opus 4.6 (claude-opus-4-6)

---

## Executive Summary

This test design defines the comprehensive testing strategy for Epic 5: BitCraft Game Analysis & Playability Validation. Epic 5 is fundamentally different from Epics 1-4: it combines research/documentation work (Stories 5.1-5.3) with Docker-based end-to-end validation testing (Stories 5.4-5.8). The epic validates that the full Sigil SDK pipeline -- from `client.publish()` through Crosstown/BLS to SpacetimeDB state changes observed via subscriptions -- works with real BitCraft gameplay scenarios.

**Epic 5 Objectives:**

- Analyze BitCraft server source to catalog reducers, state models, and game loops (Stories 5.1-5.3)
- Produce the BitCraft Game Reference document (`_bmad-output/planning-artifacts/bitcraft-game-reference.md`)
- Validate basic action round-trip through the full pipeline (Story 5.4)
- Validate player lifecycle and movement (Story 5.5)
- Validate resource gathering and inventory mutations (Story 5.6)
- Validate multi-step crafting loops with dependent actions (Story 5.7)
- Validate error scenarios and graceful degradation (Story 5.8)
- Produce reusable integration test fixtures for all future epics (Stories 5.4-5.8)

**Why This Epic Is Uniquely Challenging:**

1. **Dual nature** -- Half research/documentation, half Docker integration testing
2. **First sustained Docker usage** -- Stories 5.4-5.8 all require the full 3-service Docker stack running continuously
3. **Unknown game mechanics** -- Stories 5.1-5.3 must discover actual reducer signatures, preconditions, and state transitions from source analysis
4. **Discovery-driven testing** -- Test cases for 5.4-5.8 depend on findings from 5.1-5.3, so test design must be adaptive
5. **Multi-table state verification** -- Gathering and crafting tests must verify coordinated changes across multiple SpacetimeDB tables
6. **242 existing skipped tests** -- Epic 5 creates the opportunity (and expectation) to convert placeholder tests to real assertions
7. **Identity propagation in gameplay** -- First real-world test of the identity chain with actual BitCraft reducers

**Test Strategy:**

- **Documentation stories (5.1-5.3):** Verification through peer review, cross-referencing, and completeness checklists
- **Validation stories (5.4-5.8):** Docker-based integration tests with real SpacetimeDB state verification
- **Fixture-first development:** Build reusable test infrastructure in 5.4, extend in 5.5-5.8
- **Risk-based prioritization:** Focus on Docker stability, identity propagation, and multi-table consistency

**Target Metrics:**

- **Research stories (5.1-5.3):** Completeness coverage of documented vs. actual reducers/tables/loops
- **Validation stories (5.4-5.8):** 100% of acceptance criteria validated with real Docker assertions
- **Integration test conversion:** Convert at least 40 of the 80 BLS placeholder tests to real assertions
- **Regression:** All 1426 existing tests continue to pass
- **Docker stability:** <5% test flakiness rate across all Docker-based tests

---

## Table of Contents

1. [Epic-Level Risk Assessment](#1-epic-level-risk-assessment)
2. [Test Strategy Per Story](#2-test-strategy-per-story)
3. [Cross-Story Test Scenarios](#3-cross-story-test-scenarios)
4. [Docker Test Strategy](#4-docker-test-strategy)
5. [Test Fixture Architecture](#5-test-fixture-architecture)
6. [Coverage Targets](#6-coverage-targets)
7. [Risk-Based Prioritization](#7-risk-based-prioritization)
8. [Quality Gates](#8-quality-gates)

---

## 1. Epic-Level Risk Assessment

### 1.1 Risk Register

| Risk ID    | Risk Description                                                                                          | Likelihood | Impact       | Risk Score   | Mitigation Strategy                                                                                              | Test Strategy                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------- | ---------- | ------------ | ------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **R5-001** | Docker stack instability: services crash, hang, or become unhealthy during test runs                      | **High**   | **CRITICAL** | **CRITICAL** | Health check gates before every test suite; automatic retry with state reset; per-suite timeouts                  | Docker lifecycle management in test setup; health check assertions; automatic state reset between suites    |
| **R5-002** | BitCraft server source not available or too complex: Rust source analysis fails to extract reducer catalog | Medium     | **CRITICAL** | **HIGH**     | Multiple analysis approaches: source code, published schema, runtime introspection, Docker container inspection  | Cross-reference source analysis with runtime schema; flag discrepancies; fallback to published schema only |
| **R5-003** | Identity propagation fails with real BitCraft reducers: pubkey not accepted as first argument              | Medium     | **CRITICAL** | **HIGH**     | BLOCKER-1 already identified: BitCraft reducers must be modified for identity param; test with actual reducers    | Story 5.4 explicitly validates identity chain; fail fast if identity propagation broken                    |
| **R5-004** | Static data table gaps: 108 of 148 tables not loaded (DEBT-2), blocking gathering/crafting validation     | **High**   | High         | **HIGH**     | Identify which specific tables are needed for 5.6/5.7 during 5.1-5.3; load them on demand                       | Pre-test check for required static data; skip with clear error if missing data would cause false failures  |
| **R5-005** | Async timing sensitivity: subscription updates arrive too late for assertion; flaky tests                  | **High**   | High         | **HIGH**     | Configurable wait timeouts with exponential polling; retry patterns; explicit state verification loops            | waitForCondition() utility with configurable timeout; assertion retries; explicit state polling             |
| **R5-006** | Reducer precondition failures: game state not set up correctly for gathering/crafting (player not spawned, not near resource) | Medium | High | **HIGH** | Stories 5.1-5.3 document preconditions; test fixtures handle full state setup                                     | Fixture chain: spawn player -> position near resource -> gather; each step verified before next            |
| **R5-007** | Multi-table consistency: gathering/crafting state changes not correlated correctly across tables           | Medium     | High         | **HIGH**     | Story 5.2 documents table relationships; tests verify all expected table changes                                  | Subscribe to all relevant tables before action; verify complete set of expected changes                     |
| **R5-008** | Crosstown/BLS connection drops during multi-step test sequences (crafting loop)                            | Medium     | Medium       | **MEDIUM**   | Connection health monitoring in test harness; retry entire sequence on connection loss                            | Connection health check between steps; graceful test abort on infrastructure failure                        |
| **R5-009** | Wallet balance insufficient for multi-step test sequences                                                  | Low        | Medium       | **LOW**      | Fund test wallets at fixture setup; track balance across test sequence                                            | Pre-test wallet balance verification; balance tracking in fixtures                                          |
| **R5-010** | Research stories produce incomplete documentation due to obfuscated/complex server code                    | Medium     | Medium       | **MEDIUM**   | Accept partial documentation; mark unknowns; plan for iterative refinement during validation stories              | Validation stories (5.4-5.8) serve as acceptance tests for research accuracy                                |

### 1.2 Risk Scoring Matrix

**Impact Levels:**

- **CRITICAL:** Full pipeline broken, identity mis-attribution, tests cannot run, blockers for all downstream epics
- **High:** Major validation scenario blocked, incomplete game reference, unreliable test fixtures
- **Medium:** Partial coverage, workaround available, non-blocking degradation
- **Low:** Minor gaps, cosmetic issues, non-essential documentation missing

**Likelihood Levels:**

- **High:** >50% chance -- Docker instability is well-documented in project history; async timing is inherently probabilistic; static data gaps are known (DEBT-2)
- **Medium:** 20-50% chance -- identity propagation with real reducers untested; server source complexity varies
- **Low:** <20% chance -- wallet balance manageable; well-understood patterns from Epics 1-4

**Risk Score Calculation:**

- **CRITICAL:** Critical Impact + High Likelihood
- **HIGH:** Critical Impact + Medium/Low Likelihood OR High Impact + High/Medium Likelihood
- **MEDIUM:** High Impact + Low Likelihood OR Medium Impact
- **LOW:** Low Impact

### 1.3 Key Risk Insight

**R5-001 (Docker instability) is the dominant operational risk.** Every validation story (5.4-5.8) depends on a healthy Docker stack. Unlike previous epics where integration tests were conditional and could be skipped, Epic 5 validation stories ARE integration tests. If Docker is unstable, the entire second half of the epic is blocked.

**R5-003 (identity propagation) is the dominant technical risk.** BLOCKER-1 from the architecture states that BitCraft reducers must be modified to accept `identity: String` as the first parameter. Story 5.4 is the first real-world validation of this. If identity propagation fails with actual reducers, Stories 5.4-5.8 are all blocked.

**R5-005 (async timing) is the dominant reliability risk.** SpacetimeDB subscription updates arriving within 500ms (NFR5) is a design target, not a guarantee. Tests must be resilient to timing variations without being so lenient that they mask real failures.

**Compound risk:** R5-001 + R5-005 together create the most dangerous scenario: Docker services degraded performance causes subscription updates to arrive slowly, triggering async timeout failures that appear as test flakiness. Mitigation requires both infrastructure stability and generous-but-bounded timing tolerances.

---

## 2. Test Strategy Per Story

### 2.1 Story 5.1: Server Source Analysis & Reducer Catalog

**Acceptance Criteria:** 5 ACs
**Risk Mitigation:** R5-002 (source analysis complexity), R5-010 (incomplete documentation)
**TDD Required:** NO (research/documentation story)
**Integration Tests:** NOT required (no code deliverables)
**Docker Required:** YES (for runtime schema introspection to cross-reference source analysis)

**Risk Assessment:** Medium risk. The BitCraft server source (`BitCraftServer/packages/game/src/`) is available in the repository. The primary risk is the complexity of Rust source analysis and completeness of the catalog. The fallback is to rely on the published SpacetimeDB schema (available at runtime) supplemented by source comments.

#### Verification Strategy

Since Story 5.1 produces documentation (the BitCraft Game Reference), testing is verification-oriented:

| Verification ID | Verification                                                               | Method                                     |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| **V5.1-01**     | Reducer catalog covers all public reducers (~364)                          | Cross-reference with runtime `GET /database/bitcraft/schema` |
| **V5.1-02**     | Each reducer has documented argument types                                 | Manual review; spot-check 10 reducers against source         |
| **V5.1-03**     | Reducers grouped by game system (movement, gathering, crafting, etc.)      | Peer review of groupings                                      |
| **V5.1-04**     | Identity propagation convention documented                                 | Verified by Story 5.4 (action round-trip)                     |
| **V5.1-05**     | Game Reference document saved to correct path                              | File existence check                                          |
| **V5.1-06**     | Foreign key relationships documented (reducer args -> table PKs)           | Cross-reference 5 sample reducers against tables              |

#### Completeness Metrics

- **Reducer coverage:** % of reducers in published schema that appear in catalog
- **Signature coverage:** % of cataloged reducers with complete argument documentation
- **Game system coverage:** All major systems (movement, gathering, crafting, combat, building, trading, empire, chat, player lifecycle) have at least 1 reducer documented

#### Estimated Verification Count: 6 checks (manual + automated)

---

### 2.2 Story 5.2: Game State Model & Table Relationships

**Acceptance Criteria:** 5 ACs
**Risk Mitigation:** R5-004 (static data gaps), R5-007 (multi-table consistency)
**TDD Required:** NO (research/documentation story)
**Integration Tests:** NOT required (no code deliverables)
**Docker Required:** YES (for table introspection)

**Risk Assessment:** Medium risk. Table analysis is more straightforward than reducer analysis because table schemas are published. The main risk is completeness of relationship mapping -- identifying which tables are linked by foreign keys requires source analysis or careful inference.

#### Verification Strategy

| Verification ID | Verification                                                             | Method                                              |
| --------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| **V5.2-01**     | Entity tables (~80) mapped to game concepts                              | Cross-reference with runtime schema table list       |
| **V5.2-02**     | Foreign key relationships identified and documented                      | Spot-check 10 relationships against runtime data     |
| **V5.2-03**     | Subscription requirements per game loop documented                       | Used as input to Stories 5.5-5.7 test fixtures       |
| **V5.2-04**     | Static data dependency analysis identifies gaps vs. 40 loaded tables     | Compare loaded table list with required tables        |
| **V5.2-05**     | Mermaid relationship diagram included in Game Reference                  | Diagram renders correctly; spot-check 5 relationships |

#### Completeness Metrics

- **Entity table coverage:** % of entity tables (~80) mapped to game concepts
- **Relationship coverage:** Number of documented foreign key relationships
- **Static data gap analysis:** Count of essential but unloaded tables identified

#### Estimated Verification Count: 5 checks (manual + automated)

---

### 2.3 Story 5.3: Game Loop Mapping & Precondition Documentation

**Acceptance Criteria:** 5 ACs
**Risk Mitigation:** R5-006 (reducer preconditions), R5-010 (incomplete documentation)
**TDD Required:** NO (research/documentation story)
**Integration Tests:** NOT required (no code deliverables)
**Docker Required:** NO (builds on 5.1 + 5.2 analysis)

**Risk Assessment:** Medium risk. Game loop documentation depends entirely on the quality of 5.1 and 5.2 analysis. The main risk is that preconditions may be incomplete -- conditions that are enforced in server code but not obvious from signatures alone. This risk is mitigated by Stories 5.4-5.8 which will discover missing preconditions through actual execution.

#### Verification Strategy

| Verification ID | Verification                                                        | Method                                            |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| **V5.3-01**     | Core loops documented (lifecycle, movement, gathering, crafting, combat, trading, chat, empire) | Checklist review                                  |
| **V5.3-02**     | Movement loop has correct reducer sequence                          | Validated by Story 5.5                            |
| **V5.3-03**     | Gathering loop has correct reducer sequence                         | Validated by Story 5.6                            |
| **V5.3-04**     | Crafting loop has correct reducer sequence                          | Validated by Story 5.7                            |
| **V5.3-05**     | Preconditions distinguish state/spatial/temporal/identity types     | Peer review                                       |
| **V5.3-06**     | Mermaid sequence diagrams included for each loop                    | Diagram renders correctly                         |
| **V5.3-07**     | MVP vs. Phase 2 loops identified                                    | Cross-reference with epics.md FR Coverage Map     |

#### Key Insight

Story 5.3 is validated by Stories 5.4-5.8. If the game loop documentation is wrong (incorrect reducer sequence, missing preconditions), the validation stories will fail. This creates a natural feedback loop: validation failures trigger updates to the Game Reference.

#### Estimated Verification Count: 7 checks (manual)

---

### 2.4 Story 5.4: Basic Action Round-Trip Validation

**Acceptance Criteria:** 6 ACs
**Risk Mitigation:** R5-001 (Docker stability), R5-003 (identity propagation), R5-005 (async timing)
**TDD Required:** YES (6 ACs, all P0)
**Integration Tests:** REQUIRED (all tests require Docker stack)
**Docker Required:** YES (full 3-service stack)

**Risk Assessment:** HIGH risk. This is the foundational validation story. If the basic round-trip fails, all subsequent stories (5.5-5.8) are blocked. The primary risks are: Docker stack health, identity propagation with real reducers, and async timing of subscription updates. This story also produces the reusable test fixture infrastructure that all later stories depend on.

#### Integration Tests (~30 tests)

| Test Suite                          | Test Count | Focus Area                                                                               |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `round-trip-basic.integration.test.ts`      | 10 | Single action execution, state change verification, subscription update receipt          |
| `round-trip-identity.integration.test.ts`   | 8  | Identity propagation: signed pubkey matches SpacetimeDB state attribution                |
| `round-trip-timing.integration.test.ts`     | 5  | NFR3 (<2s round-trip), NFR5 (<500ms subscription update), timing breakdowns              |
| `round-trip-cost.integration.test.ts`       | 4  | Wallet balance change, fee collection verification                                        |
| `round-trip-fixture.integration.test.ts`    | 3  | Reusable fixture validation: setup/teardown, client initialization, subscription setup    |

#### Key Test Cases

**AC1 - Full Pipeline Execution:**

- `client.publish()` -> Crosstown/BLS -> SpacetimeDB reducer -> success
- Verify ILP packet construction, signing, routing
- Verify BLS handler parses event and calls SpacetimeDB
- Verify reducer executes without error

**AC2 - State Change Observable via Subscription:**

- Subscribe to relevant table BEFORE action
- Execute action
- Receive subscription update within configurable timeout (default 5s, target 500ms)
- Verify state change matches expected mutation

**AC3 - Round-Trip Timing:**

- Time: client-to-Crosstown (publish latency)
- Time: Crosstown-to-BLS (routing latency)
- Time: BLS-to-SpacetimeDB (reducer call latency)
- Time: SpacetimeDB-to-subscription (propagation latency)
- Assert total < 2s (NFR3); log breakdown for analysis

**AC4 - Identity Chain Verification:**

- Signed event pubkey matches `client.identity.publicKey`
- SpacetimeDB state change attributed to correct pubkey
- No state change attributed to wrong identity

**AC5 - Cost Verification:**

- Query wallet balance before action
- Execute action
- Query wallet balance after action
- Assert balance decremented by action cost from cost registry
- Verify fee collection (FR20)

**AC6 - Reusable Fixture Production:**

- Docker stack setup/teardown helpers
- Client initialization with identity, subscriptions, cost registry
- Single-action execution helper with state verification
- All helpers documented and exported for Stories 5.5-5.8

#### Mocks Required

None. Story 5.4 uses real services exclusively. All Docker services must be running.

#### Estimated Test Count: 30 tests (all integration, Docker-required)

---

### 2.5 Story 5.5: Player Lifecycle & Movement Validation

**Acceptance Criteria:** 5 ACs
**Risk Mitigation:** R5-003 (identity propagation), R5-005 (async timing), R5-006 (preconditions)
**TDD Required:** YES (5 ACs, all P0)
**Integration Tests:** REQUIRED (all Docker-based)
**Docker Required:** YES

**Risk Assessment:** HIGH risk. Player lifecycle is the most fundamental gameplay operation. If player creation or movement fails, all subsequent stories are blocked. Movement is the first multi-step sequence test (move through path A -> B -> C), introducing sequential action timing dependencies.

#### Integration Tests (~35 tests)

| Test Suite                            | Test Count | Focus Area                                                                        |
| ------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `player-lifecycle.integration.test.ts`        | 10 | Player creation, initial state, identity attribution, existence verification       |
| `player-movement.integration.test.ts`         | 12 | Single move, sequential moves, position verification, subscription updates         |
| `player-movement-errors.integration.test.ts`  | 8  | Invalid target, blocked terrain, too-far movement, error propagation               |
| `player-movement-cost.integration.test.ts`    | 5  | Per-move cost deduction, cumulative cost across path, wallet balance tracking       |

#### Key Test Cases

**AC1 - Player Creation:**

- Fresh Nostr identity -> call player creation reducer -> player entity appears in SpacetimeDB
- Verify: initial position, health, default attributes via subscription
- Verify: player entity attributed to the Nostr public key used for creation

**AC2 - Movement:**

- Existing player -> call movement reducer with valid target -> position updates
- Subscription delivers position change
- Old position and new position both verifiable

**AC3 - Invalid Movement:**

- Target out of bounds -> reducer rejects, clear error from BLS
- Blocked terrain -> reducer rejects, position unchanged (verified via subscription)
- Too far to move in one action -> error with distance constraint

**AC4 - Sequential Movements:**

- Path A -> B -> C: each movement individually verified
- Cost deducted per movement
- Total wallet balance change equals sum of movement costs
- Identity correct on all movements

**AC5 - Reusable Fixtures:**

- `createPlayer(identity)` -> returns player entity reference
- `movePlayer(client, target)` -> returns updated position
- `verifyPosition(client, expectedPosition)` -> asserts position matches
- `createPlayerAtPosition(identity, position)` -> spawn and move to location

#### Estimated Test Count: 35 tests (all integration, Docker-required)

---

### 2.6 Story 5.6: Resource Gathering & Inventory Validation

**Acceptance Criteria:** 5 ACs
**Risk Mitigation:** R5-004 (static data gaps), R5-006 (preconditions), R5-007 (multi-table consistency)
**TDD Required:** YES (5 ACs, all P0)
**Integration Tests:** REQUIRED (all Docker-based)
**Docker Required:** YES

**Risk Assessment:** HIGH risk. Gathering is the first multi-table mutation test: resource table (quantity change) + inventory table (item added). This story exercises multi-table subscription correlation and depends on static data tables (item_desc) that may not be fully loaded (DEBT-2). Also requires spatial preconditions (player must be near resource node) which depend on successful movement from Story 5.5.

#### Integration Tests (~30 tests)

| Test Suite                              | Test Count | Focus Area                                                                      |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `gathering-basic.integration.test.ts`           | 10 | Successful gather, resource decrement, inventory increment, identity correlation |
| `gathering-multi-table.integration.test.ts`     | 8  | Multi-table subscription verification, event correlation, item_desc resolution   |
| `gathering-errors.integration.test.ts`          | 7  | Empty resource node, non-existent resource, inventory full, error messages       |
| `gathering-cost.integration.test.ts`            | 5  | Gathering cost, wallet balance, charge-on-attempt vs charge-on-success           |

#### Key Test Cases

**AC1 - Successful Gathering:**

- Player near resource node -> call gathering reducer -> resource quantity decremented, item in inventory
- Subscribe to BOTH resource table and inventory table before action
- Verify both updates received

**AC2 - Multi-Table Subscription Verification:**

- At least 2 table updates received: resource change + inventory change
- Both updates correlated to same action and same identity
- Resource item ID matches inventory item ID

**AC3 - Error Scenarios:**

- Gather from empty resource -> error, inventory unchanged
- Gather from non-existent node -> error, no state changes
- Wallet reflects only the attempt cost (or no change if charged on success)

**AC4 - Static Data Resolution:**

- Item ID resolves against `item_desc` table
- Item name matches expected resource type
- Item quantity is accurate

**AC5 - Reusable Fixtures:**

- `findNearbyResource(client, position)` -> returns resource node reference
- `gatherResource(client, resourceId)` -> returns gathering result
- `verifyInventoryContains(client, itemId, quantity)` -> asserts inventory state
- `verifyResourceQuantity(client, resourceId, expectedQuantity)` -> asserts resource state

#### Pre-Test Requirements

- Player must exist (depends on Story 5.5 fixtures)
- Player must be positioned near a resource node
- Resource node must have remaining quantity
- Required static data tables must be loaded (item_desc at minimum)

#### Estimated Test Count: 30 tests (all integration, Docker-required)

---

### 2.7 Story 5.7: Multi-Step Crafting Loop Validation

**Acceptance Criteria:** 5 ACs
**Risk Mitigation:** R5-006 (preconditions), R5-007 (multi-table consistency), R5-008 (connection drops)
**TDD Required:** YES (5 ACs, all P0)
**Integration Tests:** REQUIRED (all Docker-based)
**Docker Required:** YES

**Risk Assessment:** HIGHEST risk validation story. This is the most complex test scenario in Epic 5: it chains multiple actions (gather A, gather B, craft C) where each action's output feeds the next action's input. Requires all previous stories' fixtures working correctly. Connection stability across the full sequence is critical. Partial failure handling (what happens if crafting fails midway through gathering?) adds complexity.

#### Integration Tests (~30 tests)

| Test Suite                           | Test Count | Focus Area                                                                           |
| ------------------------------------ | ---------- | ------------------------------------------------------------------------------------ |
| `crafting-loop.integration.test.ts`          | 10 | Full loop: gather A + gather B + craft C; inventory before/after; material consumption |
| `crafting-basic.integration.test.ts`         | 8  | Craft with valid recipe + materials, product appears, materials consumed               |
| `crafting-errors.integration.test.ts`        | 7  | Insufficient materials, invalid recipe, missing prerequisites                          |
| `crafting-consistency.integration.test.ts`   | 5  | Partial failure recovery, state consistency after mid-loop failure, retry behavior      |

#### Key Test Cases

**AC1 - Full Crafting Loop:**

- Gather material A -> gather material B -> craft item C
- Each step verified: cost deducted, state changed, identity correct
- Final inventory: item C present, materials A and B consumed (or decremented)
- Total wallet cost = sum of all action costs

**AC2 - Crafting Reducer:**

- `client.publish()` with crafting reducer, valid recipe, sufficient materials
- Crafted item appears in inventory via subscription
- Materials removed or decremented in inventory
- Total balance change = sum of gathering + crafting costs

**AC3 - Insufficient Materials:**

- Attempt craft without required materials -> error identifying missing materials
- No inventory changes (neither materials consumed nor product created)

**AC4 - Partial Failure Recovery:**

- Gather A succeeds -> gather B fails (e.g., resource depleted) -> player retains gathered A
- System in consistent state: can retry B, or use A for a different recipe
- No orphaned state

**AC5 - Performance Baseline:**

- Total end-to-end time for crafting loop documented
- Breakdown: per-action latency, total subscription latency, total wallet cost
- This becomes the baseline metric for future performance comparison

#### Pre-Test Requirements

- Player exists and is positioned near resources (Story 5.5 fixtures)
- Resource nodes with correct materials exist (may require specific map location)
- Recipe for target item exists in static data
- Wallet has sufficient balance for all actions in sequence

#### Estimated Test Count: 30 tests (all integration, Docker-required)

---

### 2.8 Story 5.8: Error Scenarios & Graceful Degradation

**Acceptance Criteria:** 6 ACs
**Risk Mitigation:** R5-001 (Docker stability), R5-005 (async timing), R5-008 (connection drops)
**TDD Required:** YES (6 ACs, all P0)
**Integration Tests:** REQUIRED (all Docker-based)
**Docker Required:** YES
**Parallel with:** Story 5.6 (can begin when 5.4 + 5.5 are complete)

**Risk Assessment:** MEDIUM risk. Error scenario testing is well-understood from Epics 1-4. The novel aspects are: testing against real BitCraft reducer errors (not mocks), simulating connection loss during active operations, and verifying the complete error catalog across the full pipeline. The connection loss simulation (AC4, AC5) introduces Docker manipulation during tests, which adds infrastructure complexity.

#### Integration Tests (~35 tests)

| Test Suite                            | Test Count | Focus Area                                                                        |
| ------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `error-unknown-reducer.integration.test.ts`   | 6  | Non-existent reducer, SigilError code/boundary, no state changes                   |
| `error-invalid-args.integration.test.ts`      | 6  | Wrong argument types/count, actionable error messages, expected vs. provided types  |
| `error-insufficient-balance.integration.test.ts`| 6  | Insufficient wallet, INSUFFICIENT_BALANCE error, no reducer call, balance unchanged |
| `error-connection-loss.integration.test.ts`   | 10 | SpacetimeDB disconnect/reconnect, Crosstown disconnect, state consistency           |
| `error-catalog.integration.test.ts`           | 7  | Error code, boundary, message format documentation; error assertion fixtures        |

#### Key Test Cases

**AC1 - Unknown Reducer:**

- `client.publish()` with non-existent reducer name -> BLS rejects
- SigilError returned with appropriate code and boundary
- No SpacetimeDB state changes

**AC2 - Invalid Arguments:**

- Wrong argument types -> actionable error (expected types vs. provided)
- Wrong argument count -> error identifying mismatch
- BLS error propagated to client

**AC3 - Insufficient Balance:**

- Wallet with insufficient balance -> INSUFFICIENT_BALANCE error (NFR24)
- No SpacetimeDB reducer call made
- Wallet balance remains unchanged

**AC4 - SpacetimeDB Connection Loss:**

- Action in progress -> SpacetimeDB connection lost -> subscription state recovers after reconnect
- Game state consistent: either action completed or it did not (no partial state)
- This test may require Docker container manipulation (pause/unpause)

**AC5 - Crosstown Connection Loss:**

- Action in progress -> Crosstown connection lost -> NETWORK_TIMEOUT or NETWORK_ERROR
- Boundary: `crosstown`
- System does not leave inconsistent state (NFR24)
- This test may require Docker container manipulation

**AC6 - Error Catalog:**

- Each error case documents: code, boundary, message format, system state after error
- Error catalog appended to BitCraft Game Reference
- Reusable error assertion fixtures produced

#### Estimated Test Count: 35 tests (all integration, Docker-required)

---

## 3. Cross-Story Test Scenarios

These tests span multiple stories and validate end-to-end gameplay flows that no single story covers in isolation.

### 3.1 Full Gameplay Loop (Stories 5.5 + 5.6 + 5.7)

**Test Suite:** `packages/client/src/__tests__/integration/gameplay-loop.integration.test.ts`
**Estimated Count:** 10 tests
**Requires:** Full Docker stack; all story fixtures from 5.4-5.7

| Test ID      | Scenario                                                                                      | Stories       | Expected Result                                                    |
| ------------ | --------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| **LOOP-01**  | Create player -> move to resource -> gather -> craft -> verify final inventory                 | 5.5, 5.6, 5.7 | Full gameplay loop completes; crafted item in inventory             |
| **LOOP-02**  | Same as LOOP-01 but verify cumulative wallet cost across all actions                          | 5.5, 5.6, 5.7 | Balance decremented by total of all action costs                   |
| **LOOP-03**  | Same as LOOP-01 but verify identity consistency across all actions                            | 5.5, 5.6, 5.7 | All state changes attributed to same Nostr pubkey                  |
| **LOOP-04**  | Two players: player A and player B each perform independent gameplay loops simultaneously     | 5.5, 5.6, 5.7 | Both loops complete; state correctly attributed to respective identities |
| **LOOP-05**  | Player exhausts a resource, moves to different resource, gathers, crafts                      | 5.5, 5.6, 5.7 | Resource depletion handled; second resource usable                  |

### 3.2 Error Recovery in Gameplay (Stories 5.5 + 5.6 + 5.8)

**Test Suite:** `packages/client/src/__tests__/integration/gameplay-error-recovery.integration.test.ts`
**Estimated Count:** 8 tests

| Test ID       | Scenario                                                                                     | Stories       | Expected Result                                                  |
| ------------- | -------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| **ERRREC-01** | Move to invalid position -> error -> move to valid position -> success                       | 5.5, 5.8      | Recovery after movement error; player at valid position          |
| **ERRREC-02** | Gather from depleted resource -> error -> find new resource -> gather -> success              | 5.5, 5.6, 5.8 | Recovery after gathering error; item in inventory                |
| **ERRREC-03** | Craft with missing materials -> error -> gather missing material -> craft -> success          | 5.6, 5.7, 5.8 | Recovery after crafting error; crafted item in inventory          |
| **ERRREC-04** | Connection loss during movement -> reconnect -> verify position state is consistent           | 5.5, 5.8      | Position either moved or not; no partial state                   |
| **ERRREC-05** | Rapid sequential actions (move, move, gather, craft) with budget tracking                    | 5.5-5.8       | All actions execute or fail cleanly; budget accurately tracked   |

### 3.3 Identity Propagation Across Game Systems (Stories 5.4 + 5.5 + 5.6)

**Test Suite:** `packages/client/src/__tests__/integration/identity-cross-system.integration.test.ts`
**Estimated Count:** 6 tests

| Test ID       | Scenario                                                                            | Stories        | Expected Result                                           |
| ------------- | ----------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------- |
| **IDENT-01**  | Single identity: create player -> move -> gather -> all attributed to same pubkey   | 5.4, 5.5, 5.6 | Consistent identity across game systems                   |
| **IDENT-02**  | Two identities: each creates player, moves, gathers; no cross-contamination         | 5.4, 5.5, 5.6 | Each player's state isolated to correct identity          |
| **IDENT-03**  | Verify identity in subscription updates matches publish identity                     | 5.4, 5.5      | Subscription update entity owner = publish event pubkey   |
| **IDENT-04**  | Forged identity attempt (publish with wrong key) -> rejected by BLS                 | 5.4, 5.8      | Invalid signature rejected; no state change               |

### 3.4 Research Validation (Stories 5.1-5.3 validated by 5.4-5.8)

These are not automated tests but tracking mechanisms that verify research accuracy:

| Validation ID | What's Validated                                    | Source Story | Validated By    |
| ------------- | --------------------------------------------------- | ------------ | --------------- |
| **RVAL-01**   | Reducer names documented in 5.1 are callable        | 5.1          | Stories 5.4-5.7 |
| **RVAL-02**   | Reducer argument types in 5.1 are correct           | 5.1          | Stories 5.4-5.7 |
| **RVAL-03**   | Table relationships from 5.2 match observed updates | 5.2          | Story 5.6, 5.7  |
| **RVAL-04**   | Game loop sequences from 5.3 execute successfully   | 5.3          | Stories 5.5-5.7 |
| **RVAL-05**   | Preconditions from 5.3 are complete                 | 5.3          | Stories 5.5-5.8 |

---

## 4. Docker Test Strategy

### 4.1 Service Lifecycle Management

Epic 5 validation tests require the full Docker stack (3 services: bitcraft-server, crosstown-node, bitcraft-bls). The test strategy manages service lifecycle at three levels:

**Level 1: Test Run Setup (once per `pnpm test:integration` invocation)**

```typescript
// globalSetup.integration.ts
export async function setup() {
  // 1. Verify Docker daemon is running
  // 2. Start or verify Docker stack: docker compose up -d
  // 3. Wait for all 3 services to be healthy (with timeout)
  // 4. Run database reset if needed (clean state for test run)
  // 5. Store stack status in global state
}

export async function teardown() {
  // 1. Optionally stop Docker stack (configurable: keep running for rapid re-runs)
  // 2. Collect Docker logs for debugging if tests failed
}
```

**Level 2: Test Suite Setup (once per test file)**

```typescript
// Per-file setup
beforeAll(async () => {
  // 1. Health check: all 3 services still healthy
  // 2. Create fresh test identity (Nostr keypair)
  // 3. Initialize SigilClient with test identity
  // 4. Establish subscriptions for test-relevant tables
  // 5. Fund test wallet (if needed)
});

afterAll(async () => {
  // 1. Disconnect client
  // 2. No state cleanup needed (tests use unique identities)
});
```

**Level 3: Individual Test Setup (before each test)**

```typescript
// Per-test setup
beforeEach(async () => {
  // 1. Verify client connection is healthy
  // 2. Record wallet balance (for cost verification)
  // 3. Set up test-specific subscriptions
});

afterEach(async () => {
  // 1. Unsubscribe test-specific subscriptions
  // 2. Log any warnings or unexpected states
});
```

### 4.2 Health Check Protocol

Before any test suite runs, verify all 3 services are healthy:

```typescript
async function verifyDockerHealth(timeout: number = 60000): Promise<boolean> {
  const services = [
    { name: 'bitcraft-server', url: 'http://localhost:3000/database/bitcraft/info' },
    { name: 'crosstown-node', url: 'http://localhost:4041/health' },
    { name: 'bitcraft-bls', url: 'http://localhost:3001/health' },
  ];

  for (const service of services) {
    const healthy = await waitForHealthy(service.url, timeout);
    if (!healthy) {
      throw new Error(`Service ${service.name} not healthy after ${timeout}ms`);
    }
  }
  return true;
}
```

### 4.3 State Reset Strategy

Unlike unit tests, integration tests share a persistent SpacetimeDB database. Two approaches for state isolation:

**Approach A: Unique Identity Per Test Suite (RECOMMENDED)**

Each test file creates a fresh Nostr keypair. Since all state is attributed to identities, tests are naturally isolated. No database reset needed.

- **Pros:** Fast (no reset), tests can run in parallel, no shared state conflicts
- **Cons:** Database accumulates test data over time; may need periodic full reset

**Approach B: Full Database Reset Between Suites**

Reset the SpacetimeDB database between test suites to ensure clean state.

```bash
docker compose -f docker/docker-compose.yml down -v
rm -rf docker/volumes/*
docker compose -f docker/docker-compose.yml up -d
```

- **Pros:** Guaranteed clean state; no data accumulation
- **Cons:** SLOW (60-90s per reset); breaks test parallelism

**Recommendation:** Use Approach A (unique identities) for normal test runs. Use Approach B (full reset) only for CI/CD or when test pollution is suspected.

### 4.4 Connection Loss Simulation (Story 5.8)

Story 5.8 requires simulating connection loss. Two techniques:

**Technique 1: Docker Pause/Unpause**

```bash
docker pause sigil-bitcraft-server    # Simulates network partition
# ... wait for timeout/reconnection ...
docker unpause sigil-bitcraft-server  # Restore connectivity
```

**Technique 2: Network Disconnect**

```bash
docker network disconnect sigil-dev sigil-bitcraft-server
# ... wait for timeout/reconnection ...
docker network connect sigil-dev sigil-bitcraft-server
```

**Recommendation:** Use Docker pause/unpause. It simulates network partition without killing the process, allowing state preservation. Network disconnect is more aggressive and may cause service restart.

### 4.5 Docker Flakiness Mitigation

Based on 242 existing skipped tests and project history with Docker instability:

| Mitigation                    | Implementation                                                              |
| ----------------------------- | --------------------------------------------------------------------------- |
| Generous timeouts             | 30s for health checks, 10s for subscription updates, 5s for action round-trips |
| Retry on infrastructure failure | Retry entire test (not assertion) up to 2 times on connection errors        |
| Health check between steps    | Verify service health between multi-step test sequences                      |
| Parallel test isolation       | Unique identities prevent test interference                                  |
| Flakiness tracking            | Log intermittent failures separately; track flakiness rate per test          |
| CI retry strategy             | CI reruns failed integration tests once before failing the build             |

---

## 5. Test Fixture Architecture

### 5.1 Fixture Hierarchy

Epic 5 produces a layered fixture architecture that all future integration tests (Epics 6-8) can reuse:

```
Layer 4: Game Loop Fixtures (Story 5.7)
  - craftingLoop(client, recipe)
  - gatherAndCraft(client, materials, recipe)

Layer 3: Game System Fixtures (Stories 5.5, 5.6)
  - createPlayer(identity)
  - movePlayer(client, target)
  - gatherResource(client, resourceId)
  - verifyInventory(client, itemId, quantity)

Layer 2: Pipeline Fixtures (Story 5.4)
  - executeAction(client, reducer, args)
  - verifyStateChange(client, table, predicate)
  - waitForSubscriptionUpdate(client, table, timeout)

Layer 1: Infrastructure Fixtures (Story 5.4)
  - createTestClient(options?)
  - createTestIdentity()
  - verifyDockerHealth()
  - withDockerStack(testFn)
```

### 5.2 Fixture Location

```
packages/client/src/__tests__/integration/
  fixtures/
    infrastructure.ts          # Layer 1: Docker, client, identity
    pipeline.ts                # Layer 2: Action execution, state verification
    player.ts                  # Layer 3: Player lifecycle, movement
    resources.ts               # Layer 3: Gathering, inventory
    crafting.ts                # Layer 4: Crafting loops
    errors.ts                  # Error assertion helpers
    wait-helpers.ts            # Async waiting utilities (waitForCondition, etc.)
  round-trip/                  # Story 5.4 tests
  player-lifecycle/            # Story 5.5 tests
  gathering/                   # Story 5.6 tests
  crafting/                    # Story 5.7 tests
  error-scenarios/             # Story 5.8 tests
  cross-story/                 # Cross-story scenarios (Section 3)
```

### 5.3 Core Fixture Interfaces

```typescript
// infrastructure.ts
interface TestClientOptions {
  identity?: NostrKeypair;      // Auto-generate if not provided
  subscriptions?: string[];     // Tables to subscribe to on connect
  costRegistryPath?: string;    // Action cost registry file
  timeout?: number;             // Default operation timeout
}

export async function createTestClient(options?: TestClientOptions): Promise<SigilClient>;
export async function createTestIdentity(): Promise<NostrKeypair>;
export async function verifyDockerHealth(timeout?: number): Promise<void>;

// pipeline.ts
interface ActionResult {
  eventId: string;
  reducer: string;
  args: unknown[];
  cost: number;
  pubkey: string;
  latencyMs: number;
}

export async function executeAction(
  client: SigilClient,
  reducer: string,
  args: unknown[],
  options?: { timeout?: number }
): Promise<ActionResult>;

export async function waitForSubscriptionUpdate<T>(
  client: SigilClient,
  table: string,
  predicate: (row: T) => boolean,
  timeout?: number
): Promise<T>;

export async function verifyNoStateChange(
  client: SigilClient,
  table: string,
  predicate: (row: unknown) => boolean,
  waitMs?: number
): Promise<void>;

// wait-helpers.ts
export async function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  options?: { timeout?: number; interval?: number; message?: string }
): Promise<void>;

export async function retryOnFailure<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; delay?: number; retryOn?: (err: Error) => boolean }
): Promise<T>;
```

### 5.4 BLS Placeholder Test Conversion

DEBT-E3-1 identifies 80 BLS integration test placeholders with `expect(true).toBe(true)`. Epic 5 should convert at least 40 of these to real assertions:

| BLS Test Category            | Placeholder Count | Target Conversion | Conversion Story |
| ---------------------------- | ----------------- | ----------------- | ---------------- |
| Handler dispatch tests       | ~20               | 10                | 5.4              |
| Identity propagation tests   | ~15               | 10                | 5.4, 5.5         |
| Error handling tests         | ~15               | 10                | 5.8              |
| Pricing enforcement tests    | ~15               | 5                 | 5.4              |
| Lifecycle tests              | ~15               | 5                 | 5.4              |
| **Total**                    | **~80**           | **40**            |                  |

Conversion approach:
1. Identify placeholders whose scenarios are exercised by Epic 5 validation tests
2. Replace `expect(true).toBe(true)` with real Docker-dependent assertions
3. Keep `describe.skipIf(!DOCKER_AVAILABLE)` pattern for conditional execution
4. Track remaining unconverted placeholders in DEBT register

---

## 6. Coverage Targets

### 6.1 Research Stories (5.1-5.3): Documentation Coverage

Research stories produce documentation, not code. Coverage is measured by completeness and accuracy:

| Metric                          | Target     | How Measured                                          |
| ------------------------------- | ---------- | ----------------------------------------------------- |
| Reducer catalog completeness    | >= 90%     | Cataloged reducers / total reducers in published schema |
| Reducer signature completeness  | >= 80%     | Reducers with full arg documentation / total cataloged  |
| Entity table mapping            | >= 85%     | Mapped entity tables / total entity tables (~80)        |
| Game system coverage            | 100%       | All 9 game systems have at least 1 documented loop      |
| Relationship documentation      | >= 70%     | Documented FK relationships / inferred total             |
| Precondition completeness       | >= 75%     | Documented preconditions / preconditions discovered in 5.4-5.8 |

**Acceptance standard:** Research stories are "done" when the documentation passes peer review AND the documented sequences in Stories 5.1-5.3 are successfully executed in Stories 5.4-5.7. Failed execution triggers research refinement.

### 6.2 Validation Stories (5.4-5.8): Test Coverage

| Metric                              | Target     | How Measured                                       |
| ----------------------------------- | ---------- | -------------------------------------------------- |
| P0 Acceptance Criteria coverage     | 100%       | All ACs have at least 1 passing integration test   |
| Integration test pass rate          | >= 95%     | Passing / total (allowing for flakiness margin)    |
| BLS placeholder conversion          | >= 40 of 80 | Real assertions replacing `expect(true).toBe(true)` |
| Error scenario coverage             | 100%       | All error codes documented and tested (Story 5.8)  |
| Fixture reusability                 | 100%       | All fixtures used by at least 2 test suites        |
| Docker flakiness rate               | < 5%       | Flaky test count / total integration test runs     |

### 6.3 Overall Epic 5 Coverage

| Metric                    | Target   | Notes                                               |
| ------------------------- | -------- | --------------------------------------------------- |
| Acceptance criteria met   | 37/37    | 27 ACs (5.4-5.8) + 10 documentation checks (5.1-5.3) |
| New integration tests     | ~190     | From Stories 5.4-5.8 + cross-story scenarios         |
| Converted placeholder tests | >= 40  | From DEBT-E3-1 (80 placeholders)                     |
| Regression                | 100%     | All 1426 existing tests pass                         |
| Docker stability          | < 5%     | Flakiness rate across all integration runs           |

### 6.4 Why No Line Coverage Target for 5.1-5.3

Stories 5.1-5.3 produce documentation (the BitCraft Game Reference), not application code. Line coverage metrics are not applicable. Their "coverage" is measured by:

1. **Cross-reference coverage:** How much of the documented information is verifiable against the live system
2. **Validation coverage:** How much of the documented game loops are successfully executed in Stories 5.4-5.7
3. **Accuracy rate:** Documented reducer signatures match actual behavior (measured by test pass rate in 5.4-5.8)

---

## 7. Risk-Based Prioritization

### 7.1 Test Priority Allocation

| Priority                 | % of Effort | Focus Area                                                                                    | Risk IDs                         |
| ------------------------ | ----------- | --------------------------------------------------------------------------------------------- | -------------------------------- |
| **P0 (Critical Path)**   | 50%         | Docker infrastructure fixtures, basic round-trip, identity propagation, player lifecycle       | R5-001, R5-003, R5-005           |
| **P1 (High Priority)**   | 30%         | Multi-table verification, gathering, crafting loop, sequential action consistency              | R5-004, R5-006, R5-007           |
| **P2 (Medium Priority)** | 15%         | Error scenarios, connection loss simulation, BLS placeholder conversion                       | R5-008, R5-010                   |
| **P3 (Low Priority)**    | 5%          | Performance baselines, wallet balance edge cases, cross-system identity tests                 | R5-009                           |

### 7.2 Recommended Execution Order

Based on risk, dependency chain (5.1 -> 5.2 -> 5.3 -> 5.4 -> 5.5 -> 5.6 -> 5.7, with 5.8 parallel to 5.6):

**Phase 1: Research Foundation (Stories 5.1, 5.2, 5.3)**

Sequential, as each depends on the previous:
1. **5.1: Server Source Analysis** -- Discover reducer catalog, identity conventions
2. **5.2: Game State Model** -- Map tables, relationships, subscription requirements
3. **5.3: Game Loop Mapping** -- Document sequences, preconditions, state transitions

**Phase 2: Infrastructure & Round-Trip (Story 5.4)**

The pivot from research to validation:
4. **5.4: Basic Round-Trip** -- Build test fixtures, validate pipeline, prove identity works
   - Write infrastructure fixtures (Layer 1) first
   - Then pipeline fixtures (Layer 2)
   - Then round-trip tests
   - Convert ~20 BLS placeholder tests

**Phase 3: Core Gameplay Validation (Stories 5.5, 5.6 || 5.8)**

5. **5.5: Player Lifecycle & Movement** -- Validate most fundamental gameplay
   - Write player fixtures (Layer 3)
   - Then lifecycle and movement tests
6. **5.6: Resource Gathering** -- Validate multi-table mutations (parallel start with 5.8)
   - Write resource fixtures (Layer 3)
   - Then gathering tests
7. **5.8: Error Scenarios** -- Can begin once 5.4 + 5.5 complete (parallel with 5.6)
   - Write error assertion fixtures
   - Then error scenario tests
   - Convert ~10 BLS placeholder tests

**Phase 4: Complex Validation (Story 5.7)**

8. **5.7: Multi-Step Crafting Loop** -- Highest complexity, depends on 5.5 + 5.6
   - Write crafting fixtures (Layer 4)
   - Then crafting loop tests

**Phase 5: Cross-Story Scenarios**

9. Cross-story integration tests (Section 3)
10. BLS placeholder conversion remainder
11. Final regression verification

### 7.3 Which Tests Are Most Critical

The following tests, if they fail, indicate a fundamental problem that blocks the epic:

| Rank | Test                                                                            | Why It's Critical                                                          |
| ---- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | Docker health check passes for all 3 services                                  | If Docker stack broken, all validation stories blocked                     |
| 2    | `client.publish()` -> SpacetimeDB reducer executes successfully                | If basic round-trip fails, entire pipeline is broken                       |
| 3    | SpacetimeDB subscription receives update after reducer execution               | If subscription broken, cannot verify state changes                         |
| 4    | State change attributed to correct Nostr pubkey                                | If identity propagation wrong, security model broken (BLOCKER-1)           |
| 5    | Player creation produces observable player entity                              | If player lifecycle broken, no gameplay is possible                        |
| 6    | Gathering produces updates to BOTH resource and inventory tables               | If multi-table mutations broken, complex gameplay untestable               |

---

## 8. Quality Gates

### 8.1 Story-Level Gates

**Research Stories (5.1-5.3):**

| Gate                     | Requirement                                                   | Validation                              |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------- |
| Completeness             | Meets minimum coverage metrics (Section 6.1)                  | Automated schema cross-reference        |
| Peer Review              | Documentation reviewed for accuracy and completeness          | PR review                               |
| Path Correctness         | BitCraft Game Reference at correct path                       | File existence check                    |
| Cross-Reference          | Runtime schema cross-referenced with documentation            | Spot-check 10 reducers, 10 tables       |

**Validation Stories (5.4-5.8):**

| Gate                         | Requirement                                                  | Validation                         |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| P0 AC Coverage               | 100% of acceptance criteria have passing integration tests   | Test traceability report           |
| Docker Stability             | Tests pass on 3 consecutive runs (flakiness check)           | CI retry validation                |
| Fixture Reuse                | All fixtures used by at least 2 test suites                  | Import graph analysis              |
| No Placeholders (AGREEMENT-10)| No `expect(true).toBe(true)` in new tests                  | Test code review                   |
| OWASP Review (AGREEMENT-2)  | OWASP Top 10 review on error handling and identity code      | Security checklist                 |

### 8.2 Epic-Level Gates

| Gate                   | Requirement                                                    | Threshold                |
| ---------------------- | -------------------------------------------------------------- | ------------------------ |
| Research Completeness  | Game Reference covers all 9 game systems                       | 100% game system coverage |
| Validation Pass Rate   | All 27 validation ACs have passing tests                       | 100%                     |
| Regression             | All 1426 existing tests pass                                   | 100% pass rate           |
| Integration Tests      | >= 190 new integration tests passing                           | >= 190 tests             |
| BLS Conversion         | >= 40 placeholder tests converted to real assertions           | >= 40 converted          |
| Docker Flakiness       | < 5% flakiness rate                                            | < 5%                     |
| Fixture Quality        | All fixture layers (1-4) documented and reusable               | Layer completeness check |
| Performance Baseline   | Round-trip, movement, gathering, crafting times documented      | Baselines recorded       |

### 8.3 Epic Completion Criteria

Epic 5 is COMPLETE when:

1. All 8 stories delivered (5.1 through 5.8)
2. BitCraft Game Reference document produced and peer-reviewed
3. All 27 validation acceptance criteria met with passing integration tests
4. All ~190 new integration tests passing (allowing < 5% flakiness margin)
5. All 1426 existing tests continue to pass (regression)
6. >= 40 BLS placeholder tests converted to real assertions
7. Reusable fixture architecture (4 layers) documented and operational
8. Error catalog appended to BitCraft Game Reference
9. Performance baselines documented for movement, gathering, crafting loops
10. Docker test infrastructure stable (< 5% flakiness across 3 consecutive runs)
11. Game Reference completeness metrics meet targets (Section 6.1)

---

## Test Count Summary

| Story                                    | Documentation Checks | Integration Tests | Total    |
| ---------------------------------------- | -------------------- | ----------------- | -------- |
| 5.1: Server Source Analysis              | 6                    | 0                 | 6        |
| 5.2: Game State Model                    | 5                    | 0                 | 5        |
| 5.3: Game Loop Mapping                   | 7                    | 0                 | 7        |
| 5.4: Basic Action Round-Trip             | 0                    | 30                | 30       |
| 5.5: Player Lifecycle & Movement         | 0                    | 35                | 35       |
| 5.6: Resource Gathering & Inventory      | 0                    | 30                | 30       |
| 5.7: Multi-Step Crafting Loop            | 0                    | 30                | 30       |
| 5.8: Error Scenarios & Graceful Degradation | 0                 | 35                | 35       |
| **Cross-Story Integration**              | --                   | 24                | 24       |
| **BLS Placeholder Conversion**           | --                   | 40                | 40       |
| **Total**                                | **18**               | **224**           | **~242** |

**Test Pyramid Distribution:**

- Documentation verification: 7% (18 checks) -- manual + automated completeness verification
- Integration (Docker): 93% (224 tests) -- real services, real state mutations, real assertions

The extremely high integration test percentage reflects the nature of Epic 5: it IS an integration validation epic. There is no new application code to unit test -- the tests validate that existing code (Epics 1-4) works correctly against the real BitCraft game world.

---

## Appendix A: Dependency on Existing Infrastructure

Epic 5 tests reuse the following from Epics 1-4:

| Component                     | Source                                                        | Used By               |
| ----------------------------- | ------------------------------------------------------------- | --------------------- |
| SigilClient                   | `packages/client/src/client.ts`                               | All stories (5.4-5.8) |
| Nostr Keypair                 | `packages/client/src/nostr/keypair.ts`                        | All stories (identity) |
| SpacetimeDB Connection        | `packages/client/src/spacetimedb/connection.ts`               | All stories (subscriptions) |
| Static Data Loader            | `packages/client/src/spacetimedb/static-data-loader.ts`       | Stories 5.6, 5.7 (item resolution) |
| Publish Pipeline              | `packages/client/src/publish/`                                | All stories (action execution) |
| Action Cost Registry          | `packages/client/src/publish/action-cost-registry.ts`         | Stories 5.4-5.7 (cost verification) |
| CrosstownAdapter              | `packages/client/src/crosstown/crosstown-adapter.ts`          | All stories (publish routing) |
| BLS Handler                   | `packages/bitcraft-bls/src/handler.ts`                        | All stories (reducer dispatch) |
| Docker Compose Stack          | `docker/docker-compose.yml`                                   | All stories (3 services) |
| Event Interpreter             | `packages/client/src/agent/event-interpreter.ts`              | Stories 5.6, 5.7 (narrative verification) |
| Docker conditional skip       | `process.env.RUN_INTEGRATION_TESTS`                           | All integration tests |

## Appendix B: Mapping Epic 5 to Functional Requirements

Epic 5 does not introduce NEW functional requirements. It validates the integration of existing FRs:

| FR   | Description                                                  | Validated By  | How                                                     |
| ---- | ------------------------------------------------------------ | ------------- | ------------------------------------------------------- |
| FR4  | Identity attribution via BLS propagation                     | 5.4, 5.5      | State changes attributed to correct Nostr pubkey         |
| FR5  | End-to-end identity verification                             | 5.4           | Signed pubkey -> BLS verification -> reducer attribution |
| FR17 | Execute actions via client.publish()                         | 5.4-5.7       | All game actions executed through publish pipeline       |
| FR18 | ILP packet construction and signing                          | 5.4           | Round-trip validates packet construction                 |
| FR19 | BLS validates and calls reducer                              | 5.4-5.7       | BLS handler processes all game actions                   |
| FR20 | ILP fee collection                                           | 5.4           | Wallet balance change matches action cost                |
| FR21 | Wallet balance query                                         | 5.4-5.7       | Balance verified before and after actions                |
| FR22 | Action cost registry                                         | 5.4-5.7       | Costs from registry match wallet deductions              |
| FR47 | BLS game action handler mapping                              | 5.4-5.7       | Reducer dispatch works for movement, gathering, crafting |

## Appendix C: NFR Validation Matrix

| NFR    | Requirement                                | Validated By | Test Strategy                                              |
| ------ | ------------------------------------------ | ------------ | ---------------------------------------------------------- |
| NFR3   | ILP round-trip <2s                         | Story 5.4    | Timing assertions on action execution                      |
| NFR5   | Subscription update <500ms                 | Story 5.4    | Timing assertions on subscription receipt                  |
| NFR8   | Invalid signatures rejected                | Story 5.8    | Forged identity test                                       |
| NFR24  | Failed actions do not leave inconsistent state | Story 5.8 | Verify no partial state after errors                       |
| NFR27  | Zero silent failures                       | Story 5.8    | All errors produce explicit codes and messages             |

## Appendix D: Known Technical Debt Relevant to Epic 5

| Debt ID    | Description                              | Impact on Epic 5                                              | Mitigation                                               |
| ---------- | ---------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| DEBT-2     | 108/148 static data tables not loaded    | May block 5.6/5.7 if needed tables missing                    | 5.2 identifies required tables; load on demand            |
| DEBT-5     | Wallet balance stub mode                 | May give false balance results                                | Ensure stub mode disabled for integration tests           |
| DEBT-E3-1  | 80 BLS placeholder tests                 | Opportunity: convert to real assertions                       | Target 40 conversions during Epic 5                       |
| DEBT-E4-3  | Limited event interpreter coverage (4 tables) | Gathering/crafting narratives may be generic                | Extend interpreters as needed during 5.6/5.7              |
