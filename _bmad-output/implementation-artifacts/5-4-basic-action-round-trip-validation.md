# Story 5.4: Basic Action Round-Trip Validation

Status: done

<!--
Validation Status: VALIDATED
Review Type: Adversarial Review via /bmad-review-adversarial-general (2026-03-16)
Reviewer: Claude Opus 4.6
BMAD Standards Compliance: VERIFIED (2026-03-16)
- Story structure: Complete (all required sections present, including Change Log, Code Review Record, Verification Steps, and Dev Agent Record templates)
- Acceptance criteria: 6 ACs with Given/When/Then format, FR/NFR traceability
- Task breakdown: 7 tasks with detailed subtasks, AC mapping on each task
- FR traceability: FR4, FR5 -> AC2, AC4; FR17 -> AC1; FR20, FR21, FR22 -> AC5; NFR3, NFR5 -> AC1, AC3
- Dependencies: Documented (4 epics + 3 stories required complete, 3 external, 4 stories blocked)
- Technical design: Comprehensive with BLOCKER-1 bypass rationale, SpacetimeDB SDK usage, reducer reference, subscription requirements, timing requirements
- Security review: OWASP Top 10 coverage complete (all 10 categories assessed)
Issues Found & Fixed: 44 (16 pre-implementation adversarial + 3 implementation + 9 Code Review #1 + 9 Code Review #2 + 7 Code Review #3; see Change Log and Code Review Record)
Ready for Implementation: YES
-->

## Story

As a developer,
I want to execute a single game action through the full SDK pipeline and verify the state change is observable via SpacetimeDB subscriptions,
So that we have confidence the fundamental plumbing works before testing complex gameplay sequences.

## Dependencies

**Required Complete (all done):**

- **Epic 1** (Project Foundation) -- monorepo structure, SpacetimeDB connection, Docker environment
- **Epic 2** (Action Execution & Payment Pipeline) -- publish pipeline, BLS handler contract spec
- **Epic 3** (BitCraft BLS Game Action Handler) -- BLS handler, identity propagation analysis
- **Epic 4** (Declarative Agent Configuration) -- skill file format, config validation, event interpreter
- **Story 5.1** (Server Source Analysis & Reducer Catalog) -- 669 reducers cataloged across 14 game systems, BitCraft Game Reference document, progressive action pattern documentation, identity model analysis (BLOCKER-1)
- **Story 5.2** (Game State Model & Table Relationships) -- 138 entity tables mapped to 21 categories, 80 FK relationships, subscription requirements per game system
- **Story 5.3** (Game Loop Mapping & Precondition Documentation) -- 9 game loops documented with preconditions, state transitions, Mermaid diagrams, MVP vs Phase 2 classification

**External Dependencies:**

- Docker stack: 3 services (bitcraft-server, crosstown-node, bitcraft-bls) running and healthy
- BitCraft Game Reference: `_bmad-output/planning-artifacts/bitcraft-game-reference.md` (authoritative reference for reducer signatures, table impacts, game loops)
- SpacetimeDB WebSocket access: `ws://localhost:3000` (direct connection to bitcraft-server)

**Blocks:**

- Story 5.5 (Player Lifecycle & Movement Validation) -- builds on reusable fixtures and connection patterns
- Story 5.6 (Resource Gathering & Inventory Validation) -- uses fixture patterns
- Story 5.7 (Multi-Step Crafting Loop Validation) -- uses fixture patterns
- Story 5.8 (Error Scenarios & Graceful Degradation) -- uses fixture patterns and error assertion patterns

## Acceptance Criteria

1. **Pipeline round-trip execution (AC1)** (FR17, NFR5)
   **Given** a running Docker stack (BitCraft server + Crosstown node + BLS)
   **When** a game action is executed via the SpacetimeDB WebSocket client (direct connection, bypassing BLS per BLOCKER-1)
   **Then** the reducer executes successfully on the BitCraft server
   **And** the state change is observable via SpacetimeDB subscription within 500ms (NFR5)

2. **State change verification via subscription (AC2)** (FR4, FR5)
   **Given** a successful reducer execution (e.g., `sign_in`)
   **When** the state change is committed to SpacetimeDB
   **Then** the SpacetimeDB subscription receives the table update
   **And** the client-side state reflects the change (e.g., `signed_in_player_state` row inserted, `player_state.signed_in` toggled to true)

3. **Round-trip timing measurement (AC3)** (NFR3)
   **Given** the action round-trip
   **When** the full pipeline is timed (reducer call -> subscription update received)
   **Then** the round-trip completes within 2 seconds under normal load (NFR3)
   **And** timing breakdowns are logged: call-to-SpacetimeDB, SpacetimeDB-to-subscription-update

4. **Identity verification (AC4)** (FR4, FR5)
   **Given** the SpacetimeDB identity used to connect
   **When** the reducer executes and state changes are examined
   **Then** the game state change is attributed to the correct SpacetimeDB `Identity` (via `ctx.sender`)
   **And** the identity chain is verified: WebSocket connection identity matches the `user_state` entry which maps to the player `entity_id` used in all state changes

5. **Wallet/cost accounting (AC5)** (FR20, FR21, FR22)
   **Given** the action cost
   **When** the wallet balance is queried before and after the action
   **Then** the balance accounting is verified against the cost registry
   **And** the cost mechanism is documented (note: wallet stub mode is active per DEBT-5; this AC validates the stub accounting path, not real ILP fees)

6. **Reusable test fixture production (AC6)**
   **Given** the round-trip test passes
   **When** the test infrastructure is reviewed
   **Then** a reusable test fixture is produced: Docker stack health check, SpacetimeDB WebSocket connection setup, single-action execution helper, subscription state verification helper
   **And** the fixture is saved to `packages/client/src/__tests__/integration/` for reuse by Stories 5.5-5.8

## Tasks / Subtasks

### Task 1: Docker Stack Health Check and SpacetimeDB Direct Connection (AC: 1, 6)

- [x] 1.1 Create Docker stack health check utility at `packages/client/src/__tests__/integration/docker-health.ts` that checks all 3 services: bitcraft-server (port 3000), crosstown-node (port 4041), bitcraft-bls (port 3001)
- [x] 1.2 Implement health check with `fetch()` calls to each service's health endpoint; export `isDockerStackHealthy()` async function that returns boolean
- [x] 1.3 Create `describeWithDocker()` test wrapper (or `describe.skipIf(!dockerHealthy)` pattern) that conditionally runs integration test suites based on Docker availability
- [x] 1.4 Create SpacetimeDB WebSocket direct connection helper that connects to `ws://localhost:3000` using `@clockworklabs/spacetimedb-sdk` with a fresh identity (not through BLS/Crosstown)
- [x] 1.5 Export reusable connection setup/teardown functions: `connectToSpacetimeDB()`, `disconnectFromSpacetimeDB()`, with configurable database name (default: `bitcraft`)

### Task 2: SpacetimeDB Subscription Setup and Verification Helpers (AC: 2, 6)

- [x] 2.1 Create subscription helper that subscribes to specified tables and collects row insert/update/delete events
- [x] 2.2 Implement `waitForTableUpdate(tableName, predicate, timeoutMs)` helper that returns a Promise resolving when a table row matching the predicate is received
- [x] 2.3 Implement `assertTableState(tableName, expectedRows)` helper that verifies the current client-side table state matches expectations
- [x] 2.4 Create subscription setup for the minimum Story 5.4 tables: `user_state`, `player_state`, `signed_in_player_state` (from Game Reference Quick Reference)
- [x] 2.5 Add timeout handling: `waitForTableUpdate` rejects with descriptive error after `timeoutMs` (default 5000ms)

### Task 3: Execute Basic Reducer Round-Trip -- Simplest Reducer and Player Lifecycle (AC: 1, 2, 4)

- [x] 3.1 Write integration test: call `synchronize_time` reducer with any f64 value, verify reducer call succeeds (simplest possible round-trip validation, no state changes expected)
- [x] 3.2 Write integration test: connect to SpacetimeDB, verify `user_state` entry exists for the connection identity
- [x] 3.3 Write integration test: call `player_queue_join` reducer, verify success (or handle "already in queue" gracefully)
- [x] 3.4 Write integration test: call `sign_in` reducer with appropriate `PlayerSignInRequest`, verify `signed_in_player_state` row appears via subscription
- [x] 3.5 Write integration test: verify `player_state.signed_in` is now `true` via subscription
- [x] 3.6 Write integration test: call `sign_out` reducer, verify `signed_in_player_state` row is deleted via subscription
- [x] 3.7 Write integration test: verify `player_state.signed_in` is now `false` after sign_out

### Task 4: Timing and Performance Measurement (AC: 3)

- [x] 4.1 Add `performance.now()` instrumentation around reducer call and subscription receipt
- [x] 4.2 Log timing breakdown: `{reducerCallTime, subscriptionReceiveTime, totalRoundTripTime}`
- [x] 4.3 Write assertion: total round-trip < 2000ms (NFR3)
- [x] 4.4 Write assertion: subscription update received within 500ms of reducer completion (NFR5)
- [x] 4.5 Document performance baseline in test output for future regression comparison

### Task 5: Identity Chain Verification (AC: 4)

- [x] 5.1 Extract the SpacetimeDB `Identity` from the WebSocket connection
- [x] 5.2 Verify `user_state` table has an entry with `identity` matching the connection identity
- [x] 5.3 Extract `entity_id` from the `user_state` entry
- [x] 5.4 Verify `player_state` entry with matching `entity_id` exists and reflects the correct sign-in state
- [x] 5.5 Verify `signed_in_player_state` entry with matching `entity_id` appears after sign-in and disappears after sign-out

### Task 6: Wallet/Cost Accounting Verification (AC: 5)

- [x] 6.1 Document that wallet stub mode is active (DEBT-5: WalletClient returns fixed balance 10000 in stub mode)
- [x] 6.2 Query wallet balance before action execution using `WalletClient.getBalance()`
- [x] 6.3 Execute action and query wallet balance after
- [x] 6.4 Verify the stub-mode accounting path works without errors (balance queries succeed, cost registry lookups succeed)
- [x] 6.5 Add test comment documenting that real ILP fee validation is deferred to BLOCKER-1 resolution

### Task 7: Produce Reusable Test Fixtures and Documentation (AC: 6)

- [x] 7.1 Refactor Docker health check, SpacetimeDB connection, and subscription helpers into a shared fixtures module at `packages/client/src/__tests__/integration/fixtures/`
- [x] 7.2 Export `createTestClient()` factory function that handles connection, subscription setup, and cleanup
- [x] 7.3 Export `executeReducer(client, reducerName, args)` helper that wraps reducer calls with timing and error handling
- [x] 7.4 Export `verifyStateChange(client, tableName, predicate, timeoutMs)` helper
- [x] 7.5 Document fixture usage in code comments and JSDoc for Stories 5.5-5.8 developers
- [x] 7.6 Ensure all fixtures support `beforeEach`/`afterEach` lifecycle management (connect before, disconnect after each test)

## Dev Notes

### Story Nature: Validation with Docker Integration (Code Delivery)

This is the FIRST validation story in Epic 5. Unlike Stories 5.1-5.3 (research/documentation), Story 5.4 produces working integration tests and reusable test fixtures. This story establishes the patterns and infrastructure that Stories 5.5-5.8 will build upon.

### CRITICAL: BLOCKER-1 -- Bypass BLS Handler, Use Direct WebSocket

Per the BitCraft Game Reference (BLOCKER-1 Analysis), the BLS handler's identity propagation mechanism is incompatible with unmodified BitCraft reducers:

- BLS prepends Nostr pubkey as first reducer arg, but BitCraft reducers use `ctx.sender` (not an explicit identity parameter)
- When BLS calls reducers via HTTP with the admin token, `ctx.sender` is the admin identity, NOT the player

**Decision for Story 5.4:** Call reducers DIRECTLY via SpacetimeDB WebSocket client. The SpacetimeDB SDK connects with a unique identity, and `ctx.sender` correctly identifies the calling player. This bypasses the BLS handler entirely and tests the reducer behavior itself.

**Implications:**
- Do NOT use `client.publish()` for these tests (that goes through Crosstown/BLS)
- Use `@clockworklabs/spacetimedb-sdk` directly to connect and call reducers
- The SpacetimeDB connection identity IS the player identity (via `user_state` mapping)
- The BLS-based publish pipeline will be validated after BLOCKER-1 is resolved

### SpacetimeDB SDK Direct Usage

The `@clockworklabs/spacetimedb-sdk` (^1.3.3) provides:

```typescript
import { DbConnection } from '@clockworklabs/spacetimedb-sdk';

// Connect with auto-generated identity
const connection = DbConnection.builder()
  .withUri('ws://localhost:3000')
  .withModuleName('bitcraft')
  .onConnect((identity, token) => {
    // identity is the SpacetimeDB Identity for this connection
    // Use this to look up user_state and find the player entity_id
  })
  .build();

// Call reducers directly
connection.reducers.sign_in({ owner_entity_id: entityId });
connection.reducers.sign_out();
connection.reducers.player_queue_join();

// Subscribe to tables
connection.db.user_state.onInsert((row) => { ... });
connection.db.signed_in_player_state.onInsert((row) => { ... });
```

**Important:** A brand-new SpacetimeDB identity may NOT have an existing `user_state` entry. The test must handle initial player creation or use a known test identity. Check if the BitCraft server auto-creates a `user_state` entry on first WebSocket connection, or if a separate player creation reducer is needed.

### Top Reducers for Story 5.4 (from Game Reference)

| Reducer | Purpose | Simplest Test |
|---------|---------|---------------|
| `synchronize_time` | Simplest reducer (no state changes, accepts any f64) | Call with any f64, expect success |
| `sign_in` | Session establishment | Call with `{owner_entity_id: 0}`, expect `signed_in_player_state` insert |
| `sign_out` | Session teardown | Call after sign_in, expect `signed_in_player_state` delete |

**Recommended test sequence:**
1. Connect to SpacetimeDB
2. Call `synchronize_time` (simplest possible reducer, validates basic round-trip)
3. Call `player_queue_join` (if needed)
4. Call `sign_in` and verify subscription updates
5. Call `sign_out` and verify subscription updates

### Subscription Requirements (from Game Reference)

Story 5.4 requires subscriptions to at minimum 3 tables:

| Table | Purpose |
|-------|---------|
| `user_state` | Maps SpacetimeDB Identity to player entity_id |
| `player_state` | Player profile, signed_in status |
| `signed_in_player_state` | Currently signed-in players (insert/delete on sign_in/sign_out) |

### Reducer -> Table Impact Matrix for sign_in (from Game Reference)

| Direction | Tables |
|-----------|--------|
| **Reads** | `user_state`, `player_state`, `signed_in_player_state`, `mobile_entity_state`, `inventory_state`, `active_buff_state` |
| **Writes** | `player_state`, `signed_in_player_state`, `inventory_state`, `active_buff_state`, `mobile_entity_state`, `player_action_state` |

### Player Lifecycle Preconditions (from Game Reference)

| Step | Precondition | Error on Failure |
|------|-------------|------------------|
| `player_queue_join` | `user_state` entry exists for `ctx.sender` | "You must have a character to join the queue" |
| `sign_in` | `user_state.can_sign_in == true` (set by queue processing) | "You must join the queue first." |
| `sign_in` | Player not already signed in | "Already signed in" |
| `sign_out` | Player is signed in | _(silent return, no error)_ |

### Testing Approach

**Framework:** Vitest (consistent with all existing tests in the project)

**Integration test location:** `packages/client/src/__tests__/integration/` (per AC6 and existing pattern from `wallet-balance.test.ts`)

**Fixture location:** `packages/client/src/__tests__/integration/fixtures/` (new directory for reusable helpers)

**Conditional execution:** Tests skip when Docker is not available. Use `describe.skipIf()` pattern consistent with existing integration tests (see `bls-handler.integration.test.ts` pattern: `describe.skipIf(!runIntegrationTests)`).

**Environment variables for conditional execution:**

| Variable | Purpose |
|----------|---------|
| `RUN_INTEGRATION_TESTS=true` | Enable integration test suite |
| `SPACETIMEDB_URL=ws://localhost:3000` | SpacetimeDB server URL (default) |
| `SPACETIMEDB_DATABASE=bitcraft` | Database name (default) |

### Known Risks

| Risk ID | Risk | Impact | Mitigation |
|---------|------|--------|------------|
| R5-001 | BLOCKER-1 identity propagation | HIGH | Bypass BLS handler; use direct WebSocket. Validates reducer behavior directly. |
| R5-012 | No `user_state` for new identity | HIGH | Investigate whether BitCraft auto-creates `user_state` on connect. If not, may need cheat/admin reducer to create initial player. |
| R5-013 | SpacetimeDB SDK API surface unknown at runtime | MEDIUM | Use SDK documentation, trial-and-error with actual connection. SDK is ^1.3.3, validated in Epic 1 against 1.6.x servers. |
| R5-014 | Docker stack startup time | LOW | Use health check polling with generous timeout (90s for bitcraft-server per docker-compose). |
| R5-015 | Subscription timing non-determinism | MEDIUM | Use `waitForTableUpdate` with configurable timeout (default 5000ms). Retry logic on flaky subscriptions. |

### Project Structure Notes

- **New integration test file:** `packages/client/src/__tests__/integration/action-round-trip.test.ts`
- **New fixture directory:** `packages/client/src/__tests__/integration/fixtures/`
  - `docker-health.ts` -- Docker stack health check
  - `spacetimedb-connection.ts` -- Direct WebSocket connection helpers
  - `subscription-helpers.ts` -- Table subscription and state verification
  - `test-client.ts` -- Composite test client factory
- **No modifications** to existing Epic 1-4 production code
- **No new npm dependencies** -- uses existing `@clockworklabs/spacetimedb-sdk` (^1.3.3) and `vitest`
- Follows existing test structure patterns from `packages/client/src/__tests__/integration/wallet-balance.test.ts` and `packages/client/src/integration-tests/bls-handler.integration.test.ts`

### Security Considerations (OWASP Top 10)

This is a validation/testing story. OWASP assessment is included per AGREEMENT-2.

- **A01 (Broken Access Control):** N/A -- test fixtures connect with auto-generated SpacetimeDB identities. No auth bypass or privilege escalation. Docker services are localhost-only (127.0.0.1 binding per docker-compose.yml).
- **A02 (Cryptographic Failures):** N/A -- no crypto in test fixtures. SpacetimeDB handles identity cryptography internally.
- **A03 (Injection):** LOW RISK -- reducer names and args are controlled test data. Reducer name validation (alphanumeric + underscore, 1-64 chars) is in the existing `ilp-packet.ts`. Test fixtures should validate reducer names before calling.
- **A04 (Insecure Design):** N/A -- test infrastructure only. No production design decisions.
- **A05 (Security Misconfiguration):** LOW RISK -- Docker stack uses localhost-only binding. `SPACETIMEDB_ADMIN_TOKEN` must not be committed to test code or logs.
- **A06 (Vulnerable Components):** N/A -- no new dependencies added. Existing `@clockworklabs/spacetimedb-sdk` has known undici transitive vuln (DEBT-E4-5, pre-existing).
- **A07 (Authentication Failures):** N/A -- WebSocket connections use auto-generated SpacetimeDB identities. No password or token handling in test code.
- **A08 (Data Integrity Failures):** N/A -- test fixtures verify state transitions; no serialization attacks.
- **A09 (Security Logging):** N/A -- test infrastructure; no audit trail needed.
- **A10 (SSRF):** LOW RISK -- connection URLs are hardcoded localhost defaults. SSRF protection exists in `CrosstownAdapter` (Epic 2) but is not used here (direct WebSocket).

### FR/NFR Traceability

| Requirement | Coverage | Notes |
|---|---|---|
| FR4 (Identity via Nostr keypair) | AC2, AC4 | Identity chain verified via SpacetimeDB `ctx.sender` -> `user_state` -> `entity_id`. Note: Nostr keypair identity propagation via BLS is deferred to BLOCKER-1 resolution; this validates the SpacetimeDB-native identity path. |
| FR5 (Identity persistence and recovery) | AC2, AC4 | SpacetimeDB identity persists across reconnections. Verified via subscription state recovery. |
| FR17 (Execute actions via client.publish()) | AC1 | Validates reducer execution via direct WebSocket (equivalent to the reducer call step of the publish pipeline). BLS-routed `client.publish()` deferred to BLOCKER-1 resolution. |
| FR20 (Fee collection) | AC5 | Wallet stub mode accounting validated. Real ILP fee collection deferred to BLOCKER-1. |
| FR21 (Action cost lookup) | AC5 | Cost registry lookup tested. |
| FR22 (Wallet balance check) | AC5 | Wallet balance query via stub mode tested. |
| NFR3 (Round-trip < 2 seconds) | AC3 | Full round-trip timing measured and asserted < 2000ms. |
| NFR5 (Subscription update < 500ms) | AC1, AC3 | Subscription latency measured and asserted < 500ms. AC1 includes 500ms subscription observation requirement. |

### Previous Story Intelligence

**From Story 5.1 (Server Source Analysis & Reducer Catalog):**

1. **669 reducers cataloged.** Use `synchronize_time` as the simplest possible reducer for basic round-trip test (accepts f64, no side effects).
2. **Identity model via `actor_id(ctx, true/false)`:** All player-facing reducers resolve identity through `user_state` -> `entity_id`. The `true` parameter requires `signed_in_player_state` to exist.
3. **BLOCKER-1 identity propagation mismatch:** BLS handler prepends Nostr pubkey as first arg, but BitCraft reducers use `ctx.sender`. Story 5.4 MUST bypass BLS and call reducers directly via WebSocket.
4. **Complex request types:** Most reducers accept SpacetimeType structs (serialized as JSON arrays in field order). `sign_in` takes `PlayerSignInRequest { owner_entity_id: u64 }`.

**From Story 5.2 (Game State Model & Table Relationships):**

1. **138 entity tables mapped.** Story 5.4 needs only 3 tables minimum: `user_state`, `player_state`, `signed_in_player_state`.
2. **Subscription requirements documented.** Story 5.4 requires 3 subscriptions (see Quick Reference).
3. **`user_state` maps Identity to entity_id.** This is the identity chain verification path.

**From Story 5.3 (Game Loop Mapping & Precondition Documentation):**

1. **Player Lifecycle loop fully documented.** Sequence: `player_queue_join` -> `sign_in` -> gameplay -> `sign_out`. All preconditions and error messages documented.
2. **Precondition Quick Reference.** Maps 30 common preconditions to error messages (useful for AC1 error handling).
3. **Testing Path Classification.** All Stories 5.4-5.8 should use WebSocket direct (not BLS) per BLOCKER-1.

### Git Intelligence

Recent commits show Stories 5.1-5.3 completion:
- `a7634c7 feat(5-3): story complete`
- `453d20b feat(5-2): story complete`
- `fe773a2 feat(5-1): story complete`
- `0377d91 chore(epic-5): epic start -- baseline green, retro actions resolved`

Commit convention: `feat(5-4): story complete` expected for story completion.
Branch: `epic-5` (current working branch).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5, Story 5.4] -- Acceptance criteria and story requirements
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md] -- BitCraft Game Reference (authoritative)
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md#Quick Reference] -- Top reducers for Story 5.4, Reducer -> Table Impact Matrix
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md#Game Loops] -- Player Lifecycle loop documentation with preconditions and state transitions
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md#Identity Propagation] -- BLOCKER-1 analysis and bypass recommendation
- [Source: _bmad-output/planning-artifacts/bitcraft-game-reference.md#Subscription Quick Reference] -- Minimum 3 tables for Story 5.4
- [Source: _bmad-output/implementation-artifacts/5-3-game-loop-mapping-and-precondition-documentation.md] -- Previous story file with intelligence
- [Source: _bmad-output/project-context.md] -- Project context (Epics 1-4 complete, Epic 5 in progress)
- [Source: _bmad-output/project-context.md#Known Issues] -- BLOCKER-1, DEBT-2, DEBT-5, DEBT-E3-1
- [Source: _bmad-output/planning-artifacts/architecture/4-data-flow.md] -- Write path and read path architecture
- [Source: _bmad-output/planning-artifacts/architecture/7-crosstown-integration.md] -- Crosstown/BLS integration details
- [Source: packages/client/src/publish/ilp-packet.ts] -- ILP packet construction (for reference, not used directly in Story 5.4)
- [Source: packages/client/src/integration-tests/bls-handler.integration.test.ts] -- Existing integration test pattern (conditional Docker execution)
- [Source: packages/client/src/__tests__/integration/wallet-balance.test.ts] -- Existing integration test location
- [Source: docker/docker-compose.yml] -- Docker stack configuration (3 services, health checks, port mappings)
- [Source: packages/client/src/spacetimedb/connection.ts] -- SpacetimeDB connection manager
- [Source: packages/client/src/spacetimedb/subscriptions.ts] -- SpacetimeDB subscription manager

## Implementation Constraints

1. **Direct WebSocket only** -- Do NOT use `client.publish()` or the Crosstown/BLS pipeline. Call reducers directly via `@clockworklabs/spacetimedb-sdk` WebSocket connection (BLOCKER-1 workaround).
2. **No new npm dependencies** -- Use existing `@clockworklabs/spacetimedb-sdk` (^1.3.3) and `vitest`. No new packages.
3. **Docker-dependent tests must be skippable** -- All integration tests must gracefully skip when Docker is not available (AGREEMENT-5).
4. **No modifications to Epic 1-4 production code** -- Test fixtures and integration tests only. Do not modify `packages/client/src/` production files.
5. **Fixture reusability** -- All helpers (Docker health, connection, subscription, state verification) must be importable by Stories 5.5-5.8.
6. **Admin token must NOT appear in test code** -- Use environment variables for any sensitive values (SPACETIMEDB_ADMIN_TOKEN per docker-compose.yml). Do not hardcode tokens.
7. **Consistent test patterns** -- Follow existing integration test patterns from `bls-handler.integration.test.ts` (describe.skipIf, beforeEach/afterEach lifecycle, timeout configuration).
8. **No placeholder assertions** -- Every test must have real assertions (AGREEMENT-10). No `expect(true).toBe(true)`.
9. **Performance assertions must be non-flaky** -- Use generous timeouts for NFR assertions (2000ms for round-trip, 500ms for subscription). Consider retry logic for timing-sensitive assertions.
10. **Table names and column names must match Game Reference** -- Use `signed_in_player_state` (not `signed_in_state`), `player_state.signed_in` (not `is_signed_in`), `mobile_entity_state.location_x` (not `position_x`). Cross-reference with Story 5.2 nomenclature.

## CRITICAL Anti-Patterns (MUST AVOID)

1. **DO NOT use `client.publish()` for reducer calls.** This routes through Crosstown/BLS which has BLOCKER-1 identity propagation issues. Use direct SpacetimeDB WebSocket SDK.
2. **DO NOT create placeholder tests with `expect(true).toBe(true)`.** Every assertion must verify real behavior (AGREEMENT-10).
3. **DO NOT hardcode `SPACETIMEDB_ADMIN_TOKEN` or any secrets in test code.** Use `process.env` for all sensitive values.
4. **DO NOT skip Docker health checks.** If Docker is down, tests must skip gracefully with clear messages, not fail with cryptic connection errors.
5. **DO NOT assume a `user_state` entry exists for a new identity.** Investigate the player creation flow and handle the case where a new SpacetimeDB identity has no existing player.
6. **DO NOT use hardcoded timeouts without documentation.** Every timeout value should reference the NFR it validates (e.g., 2000ms = NFR3, 500ms = NFR5).
7. **DO NOT modify existing production code in `packages/client/src/`.** This story creates test infrastructure only.
8. **DO NOT create test fixtures that leak connections.** Always clean up SpacetimeDB WebSocket connections in `afterEach`/`afterAll` hooks.
9. **DO NOT use incorrect table/column names.** Cross-reference ALL names with the BitCraft Game Reference (Story 5.2 nomenclature).
10. **DO NOT make tests depend on server-side state from previous test runs.** Each test should be independent (create its own state or use idempotent operations).

## Definition of Done

- [x] Docker stack health check utility created and working
- [x] SpacetimeDB direct WebSocket connection helper created
- [x] Subscription setup and verification helpers created
- [x] At least one reducer round-trip test passes (e.g., `synchronize_time` or `sign_in`/`sign_out`)
- [x] State change verified via subscription (e.g., `signed_in_player_state` insert/delete)
- [x] Round-trip timing measured and asserted < 2000ms (NFR3)
- [x] Subscription update latency asserted < 500ms (NFR5)
- [x] Identity chain verified: connection identity -> `user_state` -> `entity_id` -> state changes
- [x] Wallet/cost accounting stub path validated
- [x] Reusable test fixtures produced in `packages/client/src/__tests__/integration/fixtures/`
- [x] All tests skip gracefully when Docker is not available
- [x] No placeholder assertions (AGREEMENT-10)
- [x] No hardcoded secrets in test code
- [x] OWASP Top 10 review completed (AGREEMENT-2)
- [x] All table/column references consistent with Game Reference nomenclature

## Verification Steps

1. Docker health check: `packages/client/src/__tests__/integration/fixtures/docker-health.ts` exists and `isDockerStackHealthy()` returns boolean
2. Connection helper: `packages/client/src/__tests__/integration/fixtures/spacetimedb-connection.ts` exports `connectToSpacetimeDB()` and `disconnectFromSpacetimeDB()`
3. Subscription helper: `packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts` exports `waitForTableUpdate()` and `assertTableState()`
4. Test client factory: `packages/client/src/__tests__/integration/fixtures/test-client.ts` exports `createTestClient()`
5. Integration test file: `packages/client/src/__tests__/integration/action-round-trip.test.ts` exists with real assertions (no placeholder tests)
6. Docker skip: tests skip gracefully when Docker is not available (run with Docker down, verify skip messages)
7. Round-trip timing: at least one test asserts total round-trip < 2000ms (NFR3)
8. Subscription latency: at least one test asserts subscription update < 500ms (NFR5)
9. Identity chain: test verifies connection identity -> `user_state` -> `entity_id` -> state changes
10. Wallet stub: test calls `WalletClient.getBalance()` and cost registry lookup without errors
11. Table/column names: spot-check all table references against BitCraft Game Reference nomenclature
12. No secrets: grep test files for `SPACETIMEDB_ADMIN_TOKEN` -- must only appear in `process.env` references
13. Fixture reusability: all fixtures are importable from `packages/client/src/__tests__/integration/fixtures/`
14. Connection cleanup: all tests use `afterEach`/`afterAll` to disconnect WebSocket connections

## Change Log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-03-16 | Initial story creation | Epic 5 Story 5.4 spec |
| 2026-03-16 | Adversarial review fixes (16 issues) | BMAD standards compliance -- see Code Review Record |
| 2026-03-16 | Implementation complete: fixtures + integration tests | Dev implementation -- 6 files created, SDK API fixes applied |
| 2026-03-16 | Code Review #1 fixes (9 issues: 4M, 5L) | Fixed callReducer flags, error detection, Uint8Array copy, File List accuracy, test count, onError callback path |
| 2026-03-16 | Code Review #2 fixes (9 issues: 4M, 5L) | Fixed AC1 sign_in race condition, tautological assertion, exported serializeReducerArgs, updated test counts, removed unused import |
| 2026-03-16 | Code Review #3 fixes (7 issues: 4M, 3L) | Fixed stale subscription listener callbacks, executeReducer timeout rejection, subscription silent failure logging, reducer name validation, Docker skip pattern docs, void connection comment, subscription timeout docs |

## Code Review Record

| Review Pass | Date | Reviewer | Issues Found | Issues Fixed | Notes |
| --- | --- | --- | --- | --- | --- |
| Adversarial Review | 2026-03-16 | Claude Opus 4.6 | 16 | 16 | 0 critical, 0 high, 6 medium, 10 low -- Pre-implementation story spec review |
| Implementation Review | 2026-03-16 | Claude Opus 4.6 | 3 | 3 | 0 critical, 0 high, 3 medium -- SDK API fixes during implementation |
| Code Review #1 | 2026-03-16 | Claude Opus 4.6 | 9 | 9 | 0 critical, 0 high, 4 medium, 5 low -- Post-implementation code review |
| Code Review #2 | 2026-03-16 | Claude Opus 4.6 | 9 | 9 | 0 critical, 0 high, 4 medium, 5 low -- Adversarial review via /bmad-bmm-code-review |
| Code Review #3 | 2026-03-16 | Claude Opus 4.6 | 7 | 7 | 0 critical, 0 high, 4 medium, 3 low -- Adversarial code review with OWASP security check |

### Review Findings (2026-03-16)

1. **[MEDIUM]** Added validation metadata HTML comment block (BMAD standard from Stories 4.1, 4.7, 5.1-5.3) -- includes Validation Status, BMAD Standards Compliance verification, story structure checklist, Issues Found count, and Ready for Implementation flag. Previously had only a minimal "validation is optional" comment.
2. **[MEDIUM]** Fixed FR20 incorrectly assigned to AC1 header -- AC1 is about pipeline round-trip execution, not fee collection. Changed AC1 header from `(FR17, FR20)` to `(FR17, NFR5)` since AC1 includes the 500ms subscription observation requirement (NFR5).
3. **[MEDIUM]** Added FR20 to AC5 header -- FR/NFR Traceability table correctly maps FR20 to AC5 (wallet/cost accounting) but the AC5 header was missing it. Changed from `(FR21, FR22)` to `(FR20, FR21, FR22)`.
4. **[MEDIUM]** Added `synchronize_time` reducer test as Task 3.1 -- Dev Notes "Recommended test sequence" starts with `synchronize_time` as the simplest possible round-trip, but no task/subtask covered it. Added 3.1 and renumbered existing 3.1-3.6 to 3.2-3.7.
5. **[MEDIUM]** Added missing Verification Steps section (BMAD standard from Story 5.3) -- 14 concrete verification steps covering all ACs, Docker skip behavior, security, and fixture reusability.
6. **[MEDIUM]** Added missing Change Log section (BMAD standard from all completed stories) -- required for tracking all modifications to the story file.
7. **[LOW]** Added missing Code Review Record section with Review Findings (BMAD standard from all completed stories) -- documents all review passes and findings.
8. **[LOW]** Updated FR/NFR Traceability table: FR4 and FR5 coverage expanded to include AC2 (state change verification) in addition to AC4 (identity verification) -- AC2 verifies state changes attributed to the correct identity.
9. **[LOW]** Updated FR/NFR Traceability table: NFR5 coverage expanded to include AC1 in addition to AC3 -- AC1 explicitly states "within 500ms (NFR5)" for subscription observation.
10. **[LOW]** Added NFR5 traceability tag to AC1 header -- AC1 explicitly references NFR5 ("within 500ms") but the header only listed FR17.
11. **[LOW]** Updated Task 3 title from "Execute Basic Reducer Round-Trip -- Player Lifecycle" to "Execute Basic Reducer Round-Trip -- Simplest Reducer and Player Lifecycle" to reflect addition of `synchronize_time` test.
12. **[LOW]** Noted epics.md AC1 deviation is appropriate: canonical epics.md says "through `@sigil/client`" and "ILP packet is constructed, signed, and routed through `@crosstown/client` to the BLS" but story correctly bypasses this per BLOCKER-1. The deviation is well-documented in Dev Notes.
13. **[LOW]** Noted epics.md AC3 timing breakdown deviation is appropriate: canonical epics.md specifies 4-segment timing (client-to-Crosstown, Crosstown-to-BLS, BLS-to-SpacetimeDB, SpacetimeDB-to-subscription) but story correctly simplifies to 2-segment (call-to-SpacetimeDB, SpacetimeDB-to-subscription-update) due to BLOCKER-1 bypass.
14. **[LOW]** Noted epics.md AC4 identity chain deviation is appropriate: canonical says "signed event pubkey matches SpacetimeDB reducer caller identity" (Nostr pubkey) but story correctly uses SpacetimeDB native Identity (via `ctx.sender`) due to BLOCKER-1 bypass. The deviation is documented in BLOCKER-1 section.
15. **[LOW]** Noted epics.md AC5 deviation is appropriate: canonical says "balance is decremented by exactly the action cost" but story correctly validates stub-mode accounting path (DEBT-5) rather than real fee collection.
16. **[LOW]** Definition of Done "No placeholder assertions" reference now includes agreement number: `(AGREEMENT-10)` was already present in line 386, consistent with standard.

### Code Review #1 Findings (2026-03-16)

1. **[MEDIUM]** `callReducer` in `test-client.ts` was missing required third argument `flags: CallReducerFlags`. SDK expects `callReducer(reducerName, argsBuffer, flags)` but code only passed 2 args. Fixed by adding `'FullUpdate'` flag to ensure TransactionUpdate subscription changes are received.
2. **[MEDIUM]** Redundant `new Uint8Array(writer.getBuffer())` in `test-client.ts` -- `BinaryWriter.getBuffer()` already returns `Uint8Array`, so the wrapping creates an unnecessary copy. Simplified to `writer.getBuffer()`.
3. **[MEDIUM]** Error detection in `executeReducer` checked `...rest` args for errors, but per SDK `ReducerEventContextInterface`, reducer errors are reported via `ctx.event` property. Fixed to check `ctx.event` first (including `tag === 'Failed'` check), with rest args as fallback for SDK version compatibility.
4. **[MEDIUM]** Completion Note #3 claimed "17 integration tests" but actual count is 22 tests across 6 AC blocks. Updated to reflect correct count.
5. **[LOW]** File List action labels were all incorrect: claimed 5 files "Modified" and 1 "Created", but git shows ALL 6 files were newly created by this story (first added in commit `5b19885`). Fixed all to "Created".
6. **[LOW]** File List `action-round-trip.test.ts` description was contradictory: claimed "Created" action with "pre-existing, no changes needed" description. Fixed to accurate description.
7. **[LOW]** `subscribeToTables` onError callback in `subscription-helpers.ts` checked `ctx?.error?.message` but SDK `ErrorContextInterface` puts the error on `ctx?.event?.message`. Fixed to check `ctx?.event?.message` first.
8. **[LOW]** `spacetimedb-connection.ts` stores `build()` return value and voids it -- documented as intentional GC prevention. No code change needed.
9. **[LOW]** File List descriptions for `docker-health.ts` and `action-round-trip.test.ts` said "no changes needed" / "pre-existing" for files entirely created by this story. Fixed descriptions to be accurate.

### Code Review #2 Findings (2026-03-16)

1. **[MEDIUM]** AC1 sign_in test had race condition: `waitForTableInsert` was registered AFTER `executeReducer`, so if the subscription update arrived before the listener was set up, the test would hang until the 5000ms timeout. Fixed to use network-first pattern (listener before action), consistent with AC2 and AC3 tests.
2. **[MEDIUM]** AC1 `player_queue_join` test had tautological assertion: `expect(succeeded || errorMessage !== undefined).toBe(true)` covers all code paths and can never fail, violating the spirit of AGREEMENT-10. Fixed to assert meaningful timing on success and validate known precondition error patterns on failure.
3. **[MEDIUM]** `serializeReducerArgs` in `test-client.ts` was private but should be exported for Stories 5.5-5.8 reuse (AC6). This is the extension point for new reducer argument formats. Fixed to `export async function` and added to barrel export in `index.ts`.
4. **[MEDIUM]** ATDD checklist header said "17 tests" but actual count is 22. Story file was already fixed in Code Review #1 but ATDD artifact was missed. Fixed header, execution evidence, and priority distribution table.
5. **[LOW]** Unused `afterAll` import in `action-round-trip.test.ts`. Imported from vitest but never used in the file (only `afterEach` is used). Removed from import statement.
6. **[LOW]** NFR assessment referenced "17 tests" and "17 `it()` blocks" in multiple places. Updated all occurrences to correct count of 22.
7. **[LOW]** Multiple hard-coded `setTimeout` waits in integration tests (8 instances). Documented as acceptable for integration tests against real Docker services where subscription propagation timing is non-deterministic. The project's `waitForTableInsert`/`waitForTableDelete` helpers are used where possible; remaining `setTimeout` waits are for subscription propagation delays where no specific event is expected. No code change needed.
8. **[LOW]** AC1 sign_in test captured `signInError` but never asserted on it -- if sign_in failed but a stale `signed_in_player_state` row existed, the test could pass vacuously. Fixed in M1: removed try/catch around `executeReducer`, so sign_in failure now correctly throws and fails the test.
9. **[LOW]** Story file Change Log and Code Review Record updated with this review's findings.

### Code Review #3 Findings (2026-03-16)

1. **[MEDIUM]** `waitForTableInsert`/`waitForTableDelete` in `subscription-helpers.ts` had stale callback listeners. After the promise resolved or rejected (on timeout), the `onInsert`/`onDelete` callback remained registered and would fire on subsequent inserts/deletes. Added a `settled` flag to both functions that gates callback execution, preventing stale listeners from firing after the promise has settled. Important for reuse by Stories 5.5-5.8 with longer-lived connections.
2. **[MEDIUM]** `executeReducer` in `test-client.ts` silently resolved on 5000ms timeout instead of rejecting. If the reducer callback was never received (when `onReducer` is supported but the callback never fires), the function would resolve as if successful, masking server-side failures. Changed to reject with a descriptive error message, guiding callers to use `verifyStateChange()` for subscription-based confirmation.
3. **[MEDIUM]** `subscribeToTables` in `subscription-helpers.ts` silently resolved on 3000ms timeout with no diagnostic output. If the `onApplied` callback was never received, the function would resolve without any indication that subscription setup may have failed, leading to confusing downstream `waitForTableInsert` timeout errors. Added `console.warn` with the subscription queries and a diagnostic message when resolving on timeout.
4. **[MEDIUM]** Missing reducer name validation in `executeReducer`. The function passed `reducerName` directly to `conn.callReducer()` without any input validation. Since the direct WebSocket path bypasses `ilp-packet.ts` validation, typos in reducer names would produce confusing server-side errors. Added regex validation consistent with `ilp-packet.ts` (alphanumeric + underscore, 1-64 chars).
5. **[LOW]** Duplicate `if (!dockerHealthy)` pattern across 16 test cases lacked explanation of why it can't be consolidated. Added a block comment in `action-round-trip.test.ts` explaining that `describe.skipIf` evaluates synchronously before `beforeAll`, making the per-test async check technically necessary.
6. **[LOW]** `void connection;` comment in `spacetimedb-connection.ts` was misleading -- claimed "store to prevent GC" but `void` discards values. Actual GC prevention comes from `conn` captured in the `onConnect` closure. Updated comment to accurately explain the code's behavior.
7. **[LOW]** `subscribeToTables` 3000ms subscription timeout was undocumented. Other timeouts in the codebase reference specific NFRs or have rationale comments. Added inline documentation explaining the 3000ms value choice (addressed as part of fix M3).

### OWASP Top 10 Security Review (Code Review #3)

- **A01 (Broken Access Control):** PASS -- All connections use auto-generated SpacetimeDB identities on localhost. No privilege escalation vectors.
- **A02 (Cryptographic Failures):** PASS -- No cryptographic operations in test fixtures. SpacetimeDB handles identity cryptography.
- **A03 (Injection):** PASS (FIXED) -- Added reducer name validation in `executeReducer` (regex: `[a-zA-Z0-9_]{1,64}`). Prevents injection of malformed reducer names via the direct WebSocket path.
- **A04 (Insecure Design):** PASS -- Test infrastructure only; no production design decisions.
- **A05 (Security Misconfiguration):** PASS -- Docker services bound to localhost only. No `SPACETIMEDB_ADMIN_TOKEN` in test code (verified via grep).
- **A06 (Vulnerable Components):** PASS -- No new dependencies added. Pre-existing undici vuln (DEBT-E4-5) unchanged.
- **A07 (Authentication Failures):** PASS -- WebSocket connections use auto-generated SpacetimeDB identities. No password or token handling.
- **A08 (Data Integrity Failures):** PASS -- Test fixtures verify state transitions; no serialization attacks.
- **A09 (Security Logging):** PASS -- Test infrastructure; no audit trail required.
- **A10 (SSRF):** PASS -- Connection URLs are hardcoded localhost defaults or read from process.env. No user-controlled URL inputs.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

N/A -- no debug sessions required

### Completion Notes List

1. **Task 1 (Docker Stack Health Check):** Created `docker-health.ts` with `isDockerStackHealthy()`, `checkDockerStackHealth()`, `checkServiceHealth()`, and `logDockerStackHealth()`. Checks all 3 services in parallel. Returns typed `ServiceHealthResult` and `DockerStackHealthResult`.

2. **Task 2 (Subscription Helpers):** Created `subscription-helpers.ts` with `waitForTableInsert()`, `waitForTableDelete()`, `queryTableState()`, `subscribeToTables()`, and `subscribeToStory54Tables()`. Uses `SubscriptionBuilderImpl` from SDK ^1.3.3 with `onApplied`/`onError` callbacks. Timeout with descriptive errors.

3. **Task 3 (Reducer Round-Trip):** Created `action-round-trip.test.ts` with 22 integration tests across 6 AC describe blocks. Tests cover synchronize_time (simplest reducer), sign_in/sign_out lifecycle, subscription insert/delete verification, wallet/cost accounting, and fixture API validation. All tests conditionally skip when Docker is not available via `describe.skipIf(!runIntegrationTests)` and inner `dockerHealthy` check.

4. **Task 4 (Timing Measurement):** AC3 tests include `performance.now()` instrumentation with NFR3 assertion (< 2000ms round-trip) and NFR5 assertion (< 500ms subscription latency). Timing breakdowns logged via `console.log`.

5. **Task 5 (Identity Chain):** AC4 tests verify connection identity -> user_state -> entity_id -> player_state -> signed_in_player_state chain. Identity comparison handles SpacetimeDB Identity objects (toHexString, string coercion).

6. **Task 6 (Wallet/Cost Accounting):** AC5 tests validate WalletClient stub mode (DEBT-5: returns 10000) and ActionCostRegistryLoader cost lookups. Documents that real ILP fee validation is deferred to BLOCKER-1 resolution.

7. **Task 7 (Reusable Fixtures):** Created `test-client.ts` with `createTestClient()` factory, `executeReducer()` helper with BSATN binary serialization via `BinaryWriter`, and `verifyStateChange()` helper. Created `index.ts` barrel export. All fixtures importable from `fixtures/` for Stories 5.5-5.8.

8. **SDK API Fix:** Discovered that SpacetimeDB SDK ^1.3.3 exports `DbConnectionBuilder` (not `DbConnection`), `SubscriptionBuilderImpl` (not `conn.subscribe()`), and `callReducer(name, bsatnBuffer)` (not typed reducer methods). Fixed all fixtures to use the correct SDK API: `new DbConnectionBuilder(null, passthrough)` for connections, `new SubscriptionBuilderImpl(conn)` for subscriptions, and `conn.callReducer()` with `BinaryWriter`-serialized args.

### File List

| File | Action | Description |
| --- | --- | --- |
| `packages/client/src/__tests__/integration/fixtures/docker-health.ts` | Created | Docker stack health check utility: `isDockerStackHealthy()`, `checkDockerStackHealth()`, `checkServiceHealth()`, `logDockerStackHealth()` |
| `packages/client/src/__tests__/integration/fixtures/spacetimedb-connection.ts` | Created | SpacetimeDB direct WebSocket connection helpers using `DbConnectionBuilder` with null remote module |
| `packages/client/src/__tests__/integration/fixtures/subscription-helpers.ts` | Created | Table subscription and state verification: `waitForTableInsert()`, `waitForTableDelete()`, `queryTableState()`, `subscribeToTables()`, `subscribeToStory54Tables()` |
| `packages/client/src/__tests__/integration/fixtures/test-client.ts` | Created | Composite test client factory: `createTestClient()`, `executeReducer()` with BSATN serialization via `BinaryWriter`, `verifyStateChange()`, `serializeReducerArgs()` |
| `packages/client/src/__tests__/integration/fixtures/index.ts` | Created | Barrel export for all reusable test fixtures (AC6) |
| `packages/client/src/__tests__/integration/action-round-trip.test.ts` | Created | 22 integration tests across 6 AC blocks: pipeline round-trip, state verification, timing, identity chain, wallet/cost, fixture validation |
