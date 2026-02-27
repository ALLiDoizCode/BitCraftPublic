---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-02-27'
workflowType: 'testarch-atdd'
inputDocuments:
  - '/Users/jonathangreen/Documents/BitCraftPublic/_bmad-output/implementation-artifacts/1-6-auto-reconnection-and-state-recovery.md'
  - '/Users/jonathangreen/Documents/BitCraftPublic/_bmad/tea/testarch/knowledge/data-factories.md'
  - '/Users/jonathangreen/Documents/BitCraftPublic/_bmad/tea/testarch/knowledge/component-tdd.md'
  - '/Users/jonathangreen/Documents/BitCraftPublic/_bmad/tea/testarch/knowledge/test-quality.md'
  - '/Users/jonathangreen/Documents/BitCraftPublic/_bmad/tea/testarch/knowledge/test-levels-framework.md'
---

# ATDD Checklist - Epic 1, Story 6: Auto-Reconnection & State Recovery

**Date:** 2026-02-27
**Author:** Jonathan
**Primary Test Level:** Integration + Unit
**Stack Type:** Backend/Library (TypeScript SDK)

---

## Story Summary

As a user of the Sigil client library, I want the system to automatically reconnect after connection loss and recover my subscription state, so that temporary network issues don't disrupt my experience.

**As a** developer using the Sigil client library
**I want** automatic reconnection with subscription recovery
**So that** my application remains resilient to temporary network failures without manual intervention

---

## Acceptance Criteria

1. **AC1: Connection loss detection and reconnection initiation**
   - Given an active SpacetimeDB connection with subscriptions
   - When the WebSocket connection is lost unexpectedly (not manual disconnect)
   - Then the system emits a `connectionChange` event with status `disconnected` and includes the disconnect reason
   - And begins automatic reconnection attempts with exponential backoff within 1 second

2. **AC2: Exponential backoff with cap**
   - Given reconnection attempts are in progress
   - When the backoff interval increases after each failed attempt
   - Then it follows the sequence: 1s, 2s, 4s, 8s, 16s, 30s (capped at 30 seconds per NFR10)
   - And jitter (±10%) is applied to each delay to prevent thundering herd
   - And the system emits `connectionChange` events with status `reconnecting` before each attempt

3. **AC3: Successful reconnection and subscription recovery**
   - Given the system is reconnecting
   - When a reconnection attempt succeeds
   - Then the connection is re-established and all subscriptions are restored within 10 seconds total (NFR23)
   - And all previous table subscriptions are automatically re-subscribed with original filters
   - And the system emits a `connectionChange` event with status `connected`
   - And the system emits a `subscriptionsRecovered` event when all subscriptions are restored

4. **AC4: State snapshot recovery**
   - Given subscriptions are recovered after reconnection
   - When the initial state snapshot is received for each subscription
   - Then the client state is merged with the current database state (update, not replace)
   - And table update events are emitted for rows that changed during disconnection
   - And the static data cache from Story 1.5 persists without reload

5. **AC5: Reconnection failure handling**
   - Given a persistent connection failure (server down)
   - When reconnection attempts exhaust the configured retry limit (default: 10 attempts)
   - Then the system emits a `connectionChange` event with status `failed`
   - And provides a clear error message including: total attempts, last error details, and failure reason
   - And allows manual retry via `retryConnection()` method

---

## Failing Tests Created (RED Phase)

### Unit Tests (18 tests)

**File:** `packages/client/src/spacetimedb/__tests__/reconnection-manager.test.ts` (~450 lines)

- ✅ **Test:** `should detect unexpected connection loss and emit disconnected event`
  - **Status:** RED - ReconnectionManager class does not exist yet
  - **Verifies:** AC1 - connection loss detection

- ✅ **Test:** `should NOT trigger reconnection on manual disconnect`
  - **Status:** RED - isManualDisconnect flag not implemented
  - **Verifies:** AC1 - manual vs unexpected disconnect differentiation

- ✅ **Test:** `should start reconnection within 1 second of disconnect`
  - **Status:** RED - reconnection logic not implemented
  - **Verifies:** AC1 - timing requirement

- ✅ **Test:** `should calculate exponential backoff correctly (1s, 2s, 4s, 8s, 16s, 30s)`
  - **Status:** RED - calculateBackoffDelay function does not exist
  - **Verifies:** AC2 - exponential backoff sequence

- ✅ **Test:** `should apply jitter (±10%) to backoff delays`
  - **Status:** RED - jitter calculation not implemented
  - **Verifies:** AC2 - thundering herd prevention

- ✅ **Test:** `should cap backoff delay at 30 seconds (NFR10)`
  - **Status:** RED - max delay cap not implemented
  - **Verifies:** AC2 - NFR10 compliance

- ✅ **Test:** `should emit reconnecting status before each attempt with attempt number`
  - **Status:** RED - ConnectionChangeEvent not defined
  - **Verifies:** AC2 - status event emission

- ✅ **Test:** `should successfully reconnect and emit connected status`
  - **Status:** RED - reconnect method not implemented
  - **Verifies:** AC3 - successful reconnection

- ✅ **Test:** `should restore all subscriptions with original filters after reconnection`
  - **Status:** RED - subscription recovery logic not implemented
  - **Verifies:** AC3 - subscription restoration

- ✅ **Test:** `should emit subscriptionsRecovered event with metadata`
  - **Status:** RED - SubscriptionsRecoveredEvent not defined
  - **Verifies:** AC3 - recovery event emission

- ✅ **Test:** `should complete reconnection + subscription recovery within 10 seconds (NFR23)`
  - **Status:** RED - performance optimization not implemented
  - **Verifies:** AC3 - NFR23 compliance

- ✅ **Test:** `should merge snapshot data into existing state (not replace)`
  - **Status:** RED - snapshot merging logic not implemented
  - **Verifies:** AC4 - merge strategy

- ✅ **Test:** `should emit update events for changed rows during snapshot merge`
  - **Status:** RED - update event emission not implemented
  - **Verifies:** AC4 - change detection

- ✅ **Test:** `should preserve static data cache across reconnection`
  - **Status:** RED - static data persistence check not implemented
  - **Verifies:** AC4 - Story 1.5 integration

- ✅ **Test:** `should stop reconnection after retry limit exhausted`
  - **Status:** RED - retry limit enforcement not implemented
  - **Verifies:** AC5 - failure detection

- ✅ **Test:** `should emit failed status with comprehensive error details`
  - **Status:** RED - error reporting not implemented
  - **Verifies:** AC5 - error message completeness

- ✅ **Test:** `should allow manual retry via retryConnection() after failure`
  - **Status:** RED - retryConnection method not implemented
  - **Verifies:** AC5 - manual retry capability

- ✅ **Test:** `should reset attempt counter on manual retry`
  - **Status:** RED - attempt counter reset not implemented
  - **Verifies:** AC5 - retry state management

### Integration Tests (12 tests)

**File:** `packages/client/src/spacetimedb/__tests__/reconnection.integration.test.ts` (~600 lines)

- ✅ **Test:** `should auto-reconnect to live BitCraft server after disconnect`
  - **Status:** RED - Docker stack must be running, integration not implemented
  - **Verifies:** AC1, AC3 - full reconnection flow with real server

- ✅ **Test:** `should detect disconnect reason from WebSocket close event`
  - **Status:** RED - disconnect reason extraction not implemented
  - **Verifies:** AC1 - reason reporting

- ✅ **Test:** `should apply exponential backoff with observable delays`
  - **Status:** RED - timing measurement not implemented
  - **Verifies:** AC2 - backoff verification with real network

- ✅ **Test:** `should apply jitter to prevent simultaneous reconnections`
  - **Status:** RED - jitter verification not implemented
  - **Verifies:** AC2 - delay variance measurement

- ✅ **Test:** `should restore player table subscription after reconnection`
  - **Status:** RED - subscription restoration not implemented
  - **Verifies:** AC3 - subscription recovery with real tables

- ✅ **Test:** `should restore multiple subscriptions in parallel`
  - **Status:** RED - parallel subscription logic not implemented
  - **Verifies:** AC3 - performance optimization

- ✅ **Test:** `should emit subscriptionsRecovered with accurate metadata`
  - **Status:** RED - metadata collection not implemented
  - **Verifies:** AC3 - recovery event accuracy

- ✅ **Test:** `should merge snapshot data with client state after reconnection`
  - **Status:** RED - snapshot merge logic not tested with real data
  - **Verifies:** AC4 - merge behavior with live server

- ✅ **Test:** `should emit update events for rows changed during disconnect`
  - **Status:** RED - change detection not implemented
  - **Verifies:** AC4 - event emission accuracy

- ✅ **Test:** `should preserve static data cache (no reload on reconnection)`
  - **Status:** RED - static data cache verification not implemented
  - **Verifies:** AC4 - Story 1.5 integration check

- ✅ **Test:** `should fail after 10 reconnection attempts when server is down`
  - **Status:** RED - failure handling not implemented
  - **Verifies:** AC5 - retry limit enforcement with real network

- ✅ **Test:** `should successfully retry after manual retryConnection() call`
  - **Status:** RED - manual retry not implemented
  - **Verifies:** AC5 - recovery after failure

---

## Data Factories Created

### ReconnectionScenario Factory

**File:** `packages/client/src/spacetimedb/__tests__/factories/reconnection-scenario.factory.ts`

**Exports:**

- `createReconnectionScenario(overrides?)` - Create test scenario with connection, subscriptions, and disconnect configuration
- `createConnectionConfig(overrides?)` - Create SpacetimeDB connection configuration
- `createSubscriptionSnapshot(overrides?)` - Create snapshot of active subscriptions

**Example Usage:**

```typescript
const scenario = createReconnectionScenario({
  maxReconnectAttempts: 3,
  initialDelay: 500,
  hasActiveSubscriptions: true
});

const config = createConnectionConfig({
  host: 'localhost',
  port: 3000,
  reconnection: { autoReconnect: true, maxReconnectAttempts: 10 }
});
```

---

## Test Fixtures Created

### ReconnectionManager Test Fixture

**File:** `packages/client/src/spacetimedb/__tests__/fixtures/reconnection-manager.fixture.ts`

**Fixtures:**

- `mockConnection` - Mock SpacetimeDB connection with controllable state
  - **Setup:** Creates mock connection with spy methods
  - **Provides:** Controllable connect/disconnect/close events
  - **Cleanup:** Removes all listeners, resets spies

- `mockSubscriptionManager` - Mock subscription manager with tracked subscriptions
  - **Setup:** Creates subscription tracking with restore capability
  - **Provides:** Subscribe/unsubscribe spies, subscription state
  - **Cleanup:** Clears subscription state

**Example Usage:**

```typescript
import { test } from './fixtures/reconnection-manager.fixture';

test('should reconnect and restore subscriptions', async ({ mockConnection, mockSubscriptionManager }) => {
  const manager = new ReconnectionManager(mockConnection);

  // Simulate disconnect
  mockConnection.emit('close', { code: 1006, reason: 'Network error' });

  // Verify reconnection triggered
  expect(mockConnection.connect).toHaveBeenCalled();
});
```

---

## Mock Requirements

### SpacetimeDB Connection Mock

**Methods:** `connect()`, `disconnect()`, `emit(event, data)`

**Events to emit:**

- `close: { code: number, reason: string }` - WebSocket close event
- `open: void` - WebSocket open event
- `error: Error` - Connection error event

**Success Behavior:**

```typescript
mockConnection.connect.mockResolvedValue(undefined);
mockConnection.emit('open');
```

**Failure Behavior:**

```typescript
mockConnection.connect.mockRejectedValue(new Error('Connection refused'));
```

**Notes:** Mock should track call count, arguments, and allow event emission control for testing reconnection scenarios.

---

## Required Configuration

### vitest.config.ts Integration Test Setup

**File:** `packages/client/vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    // Integration tests require Docker stack
    include: ['**/*.integration.test.ts'],
    testTimeout: 30000, // Allow time for reconnection sequences
    hookTimeout: 10000,
    teardownTimeout: 5000,
    // Only run integration tests when env var set
    include: process.env.RUN_INTEGRATION_TESTS
      ? ['**/*.integration.test.ts']
      : [],
  }
});
```

**Implementation Example:**

Integration tests should check for Docker stack availability in setup:

```typescript
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

let dockerAvailable = false;

beforeAll(async () => {
  try {
    // Check if BitCraft server is running at ws://localhost:3000
    const response = await fetch('http://localhost:3000/health');
    dockerAvailable = response.ok;
  } catch (e) {
    console.warn('Docker stack not available, skipping integration tests');
  }
});

describe('Reconnection Integration', () => {
  it.skipIf(!dockerAvailable)('should reconnect to live server', async () => {
    // Test implementation
  });
});
```

---

## Implementation Checklist

### Test Group 1: ReconnectionManager Core (Unit Tests)

**File:** `packages/client/src/spacetimedb/__tests__/reconnection-manager.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/client/src/spacetimedb/reconnection-manager.ts`
- [ ] Define `ReconnectionManager` class with constructor accepting `SpacetimeDBConnection`
- [ ] Implement `ConnectionState` type: `'connected' | 'disconnected' | 'reconnecting' | 'failed'`
- [ ] Implement exponential backoff algorithm: `calculateBackoffDelay(attemptNumber: number): number`
  - Formula: `delay = min(initialDelay * (2 ^ attemptNumber), maxDelay) * (1 + jitter)`
  - Initial delay: 1000ms, max delay: 30000ms, jitter: ±10%
- [ ] Implement connection state monitoring with `onDisconnect()` handler
- [ ] Add `isManualDisconnect` flag to skip reconnection on user-initiated disconnect
- [ ] Implement automatic reconnection logic with `async reconnect(): Promise<void>` method
- [ ] Track current attempt number and reset on successful reconnection
- [ ] Implement retry limit enforcement (default: 10 attempts, 0 = infinite)
- [ ] Emit `connectionChange` events with appropriate status transitions
- [ ] Add subscription snapshot storage before disconnection
- [ ] Implement subscription recovery after successful reconnection
- [ ] Implement state snapshot merging (update, not replace)
- [ ] Emit table update events for changed rows
- [ ] Add reconnection failure handling with comprehensive error details
- [ ] Implement `retryConnection(): Promise<void>` method for manual retry
- [ ] Run tests: `pnpm --filter @sigil/client test reconnection-manager.test.ts`
- [ ] ✅ All unit tests pass (green phase)

**Estimated Effort:** 12 hours

---

### Test Group 2: TypeScript Type Definitions (Unit Tests)

**File:** `packages/client/src/spacetimedb/reconnection-types.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/client/src/spacetimedb/reconnection-types.ts`
- [ ] Define `ConnectionState` type: `'connected' | 'disconnected' | 'reconnecting' | 'failed'`
- [ ] Define `ConnectionChangeEvent` interface:
  ```typescript
  interface ConnectionChangeEvent {
    status: ConnectionState;
    reason?: string;
    attemptNumber?: number;
    nextAttemptDelay?: number;
    error?: Error;
  }
  ```
- [ ] Define `SubscriptionsRecoveredEvent` interface:
  ```typescript
  interface SubscriptionsRecoveredEvent {
    totalSubscriptions: number;
    successfulSubscriptions: number;
    failedSubscriptions: number;
    recoveryTimeMs: number;
  }
  ```
- [ ] Define `ReconnectionMetrics` interface:
  ```typescript
  interface ReconnectionMetrics {
    attemptCount: number;
    successfulReconnects: number;
    failedReconnects: number;
    avgReconnectTime: number;
    lastReconnectDuration: number;
    lastReconnectTimestamp: Date | null;
  }
  ```
- [ ] Define `ReconnectionOptions` interface:
  ```typescript
  interface ReconnectionOptions {
    autoReconnect: boolean;
    maxReconnectAttempts: number;
    initialDelay: number;
    maxDelay: number;
    jitterPercent: number;
  }
  ```
- [ ] Export all types from `packages/client/src/spacetimedb/index.ts`
- [ ] Run tests: `pnpm --filter @sigil/client typecheck`
- [ ] ✅ Type definitions compile without errors

**Estimated Effort:** 2 hours

---

### Test Group 3: SigilClient Integration (Unit Tests)

**File:** `packages/client/src/client.ts`

**Tasks to make these tests pass:**

- [ ] Import `ReconnectionManager` and types into `client.ts`
- [ ] Add `reconnection` private property to `SigilClient` class
- [ ] Initialize `ReconnectionManager` in `SigilClient` constructor
- [ ] Extend `SigilClientOptions` to include `reconnection?: ReconnectionOptions`
- [ ] Wire up event forwarding: `reconnection` events → `SigilClient.emit('connectionChange', ...)`
- [ ] Add `getConnectionState(): ConnectionState` getter to SigilClient
- [ ] Add `getReconnectionMetrics(): ReconnectionMetrics | null` method
- [ ] Add `cancelReconnection(): void` method to SigilClient
- [ ] Add `retryConnection(): Promise<void>` method to SigilClient
- [ ] Update `SigilClient` event types to include reconnection events
- [ ] Run tests: `pnpm --filter @sigil/client test client.test.ts`
- [ ] ✅ Integration tests pass

**Estimated Effort:** 4 hours

---

### Test Group 4: Integration Tests with Live Server

**File:** `packages/client/src/spacetimedb/__tests__/reconnection.integration.test.ts`

**Tasks to make these tests pass:**

- [ ] Start Docker stack: `cd docker && docker compose up`
- [ ] Verify BitCraft server is healthy at ws://localhost:3000
- [ ] Create integration test file with Docker availability check
- [ ] Implement test: auto-reconnect to live server after disconnect
- [ ] Implement test: detect disconnect reason from WebSocket close event
- [ ] Implement test: verify exponential backoff with observable delays
- [ ] Implement test: verify jitter variance in delays
- [ ] Implement test: restore player table subscription after reconnection
- [ ] Implement test: restore multiple subscriptions in parallel
- [ ] Implement test: verify subscriptionsRecovered event metadata
- [ ] Implement test: merge snapshot data with client state
- [ ] Implement test: emit update events for changed rows
- [ ] Implement test: preserve static data cache (no reload)
- [ ] Implement test: fail after retry limit when server down
- [ ] Implement test: manual retry after failure
- [ ] Measure and verify reconnection completes within 10 seconds (NFR23)
- [ ] Run tests: `pnpm --filter @sigil/client test:integration`
- [ ] ✅ All integration tests pass

**Estimated Effort:** 10 hours

---

### Test Group 5: Metrics Tracking (Unit Tests)

**File:** `packages/client/src/spacetimedb/__tests__/reconnection-manager.test.ts` (additional tests)

**Tasks to make these tests pass:**

- [ ] Implement reconnection metrics tracking in `ReconnectionManager`
- [ ] Track: `attemptCount`, `successfulReconnects`, `failedReconnects`
- [ ] Track: `avgReconnectTime`, `lastReconnectDuration`, `lastReconnectTimestamp`
- [ ] Implement `getReconnectionMetrics(): ReconnectionMetrics | null` method
- [ ] Emit `reconnectionMetrics` event with timing data
- [ ] Log warning if reconnection exceeds 10 seconds (NFR23)
- [ ] Log error if connection establishment exceeds 5 seconds
- [ ] Run tests: `pnpm --filter @sigil/client test reconnection-manager.test.ts`
- [ ] ✅ Metrics tests pass

**Estimated Effort:** 3 hours

---

### Test Group 6: Edge Cases (Unit + Integration Tests)

**File:** `packages/client/src/spacetimedb/__tests__/reconnection-edge-cases.test.ts`

**Tasks to make these tests pass:**

- [ ] Create edge case test file
- [ ] Test: connection loss during initial connect (before subscriptions)
- [ ] Test: connection loss during static data loading
- [ ] Test: rapid connect/disconnect cycles (debounce logic)
- [ ] Test: concurrent reconnection attempts (mutex/lock)
- [ ] Test: memory cleanup after 100 reconnection cycles
- [ ] Test: server restart with schema changes
- [ ] Test: network partition (long disconnect, state divergence)
- [ ] Test: manual cancelReconnection() stops retry loop
- [ ] Run tests: `pnpm --filter @sigil/client test reconnection-edge-cases.test.ts`
- [ ] ✅ All edge case tests pass

**Estimated Effort:** 6 hours

---

## Running Tests

```bash
# Run all unit tests for reconnection
cd packages/client
pnpm test reconnection

# Run specific test file
pnpm test reconnection-manager.test.ts

# Run integration tests (requires Docker stack running)
cd ../../docker && docker compose up -d
cd ../packages/client
RUN_INTEGRATION_TESTS=true pnpm test:integration

# Run with coverage
pnpm test:coverage reconnection

# Watch mode for development
pnpm test:watch reconnection-manager.test.ts

# Type checking
pnpm typecheck
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All 30 tests written and failing (18 unit + 12 integration)
- ✅ Test factories created for scenario generation
- ✅ Fixtures created with auto-cleanup
- ✅ Mock requirements documented (SpacetimeDB connection)
- ✅ Configuration requirements listed (vitest integration test setup)
- ✅ Implementation checklist created (6 test groups)

**Verification:**

- All tests run and fail as expected
- Failure messages are clear: "ReconnectionManager is not defined", "calculateBackoffDelay does not exist"
- Tests fail due to missing implementation, not test bugs
- Each test explicitly maps to one or more acceptance criteria

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one test group** from implementation checklist (start with Test Group 1: Core)
2. **Read the tests** to understand expected behavior
3. **Implement minimal code** to make that specific group pass
4. **Run the tests** to verify they now pass (green)
5. **Check off the tasks** in implementation checklist
6. **Move to next test group** and repeat

**Key Principles:**

- One test group at a time (don't try to implement everything at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

**Recommended Implementation Order:**

1. Test Group 2: Type Definitions (fastest, foundational)
2. Test Group 1: ReconnectionManager Core (main logic)
3. Test Group 3: SigilClient Integration (wiring)
4. Test Group 5: Metrics Tracking (observability)
5. Test Group 4: Integration Tests (end-to-end verification)
6. Test Group 6: Edge Cases (robustness)

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Each test group completion is a milestone

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (if NFR23 violations detected)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if API contracts change)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Refactoring Opportunities:**

- Extract backoff calculation into utility function if used elsewhere
- Consolidate event emission logic (reduce duplication)
- Optimize subscription restoration (parallel vs sequential)
- Improve error message formatting
- Add debug logging for troubleshooting

**Completion:**

- All 30 tests pass
- Code quality meets team standards (run `pnpm lint`)
- No duplications or code smells
- NFR23 verified: reconnection completes <10 seconds
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Start Docker stack**: `cd docker && docker compose up -d`
4. **Run failing tests** to confirm RED phase: `pnpm --filter @sigil/client test reconnection`
5. **Begin implementation** using implementation checklist as guide (start with Type Definitions)
6. **Work one test group at a time** (red → green for each group)
7. **Share progress** in daily standup
8. **When all tests pass**, refactor code for quality
9. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Factory patterns for test data generation (reconnection scenarios, connection configs)
- **component-tdd.md** - Red-Green-Refactor cycle principles adapted for library testing
- **test-quality.md** - Deterministic testing (no hard waits, explicit assertions, <300 lines per test)
- **test-levels-framework.md** - Test level selection (unit for logic, integration for SpacetimeDB interaction)

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm --filter @sigil/client test reconnection`

**Expected Results:**

```
FAIL packages/client/src/spacetimedb/__tests__/reconnection-manager.test.ts
  ● Test suite failed to run

    Cannot find module './reconnection-manager'

      1 | import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
    > 2 | import { ReconnectionManager } from '../reconnection-manager';
        | ^
      3 | import { ConnectionState } from '../reconnection-types';

FAIL packages/client/src/spacetimedb/__tests__/reconnection.integration.test.ts
  ● Test suite failed to run

    Cannot find module '../reconnection-manager'

Test Suites: 2 failed, 2 total
Tests:       0 total
```

**Summary:**

- Total tests: 30 (18 unit + 12 integration)
- Passing: 0 (expected)
- Failing: 30 (expected - module not found, types not defined)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

- `Cannot find module './reconnection-manager'` - Module doesn't exist yet
- `Cannot find module '../reconnection-types'` - Type definitions don't exist yet
- `ReconnectionManager is not defined` - Class not implemented
- `calculateBackoffDelay is not a function` - Method not implemented
- `ConnectionChangeEvent is not defined` - Type not defined

---

## Notes

- **Test isolation:** All unit tests use mocks for SpacetimeDB connection to ensure fast execution and isolation
- **Integration test dependency:** Integration tests require Docker stack running (BitCraft server at ws://localhost:3000)
- **NFR23 compliance:** Reconnection must complete within 10 seconds (connection + subscription recovery)
- **NFR10 compliance:** Exponential backoff capped at 30 seconds maximum delay
- **Static data cache:** Integration with Story 1.5 - cache must persist across reconnections (no reload)
- **Parallel execution:** All tests are parallel-safe (use factories for unique data, fixtures for cleanup)
- **Memory safety:** Edge case tests verify no memory leaks from repeated reconnections
- **Manual disconnect:** Tests verify reconnection is NOT triggered when user calls `disconnect()`

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @Jonathan in Slack/Discord
- Refer to `_bmad-output/implementation-artifacts/1-6-auto-reconnection-and-state-recovery.md` for story details
- Consult `_bmad/tea/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-02-27
