# Story 1.4: Implementation Checklist

This checklist maps test files to implementation tasks. Use it to track progress during implementation.

## Prerequisites

- [x] Test architecture complete (3,731 lines of test code)
- [x] Acceptance criteria tests written (546 lines)
- [x] Integration tests written (453 lines)
- [x] Unit tests written (1,589 lines)
- [x] Edge case tests written (473 lines)
- [x] Test utilities created (333 lines)
- [x] Test documentation written (337 lines)

## Implementation Tasks

### Task 1: Connection Manager
**File**: `src/spacetimedb/connection.ts`
**Tests**: `__tests__/connection.test.ts` (368 tests)
**Coverage**: AC1, AC6

- [ ] Create `SpacetimeDBConnectionOptions` interface
- [ ] Create `SpacetimeDBConnection` class extending EventEmitter
- [ ] Implement connection state machine (disconnected → connecting → connected → failed)
- [ ] Implement `connect()` method with timeout support
- [ ] Implement `disconnect()` method with cleanup
- [ ] Implement connection options validation
- [ ] Add connection event emission (connectionChange)
- [ ] Handle WebSocket v1 protocol (SDK 1.3.3)
- [ ] Add error handling (network, DNS, timeout)
- [ ] Add JSDoc documentation

**Test Validation**:
```bash
pnpm test connection.test.ts
```

Expected: All connection tests passing

### Task 2: Subscription Manager
**File**: `src/spacetimedb/subscriptions.ts`
**Tests**: `__tests__/subscriptions.test.ts` (398 tests)
**Coverage**: AC2, AC5

- [ ] Create `TableQuery` type
- [ ] Create `SubscriptionHandle` interface
- [ ] Create `SubscriptionManager` class
- [ ] Implement `subscribe<T>(tableName, query)` method
- [ ] Implement subscription event emission (tableSnapshot, rowInserted, rowUpdated, rowDeleted)
- [ ] Implement `unsubscribe(subscriptionId)` method
- [ ] Implement `unsubscribeAll()` method
- [ ] Implement game state update aggregation
- [ ] Add subscription limit (max 50 concurrent)
- [ ] Add error handling (subscriptionError events)
- [ ] Add JSDoc documentation

**Test Validation**:
```bash
pnpm test subscriptions.test.ts
```

Expected: All subscription tests passing

### Task 3: Table Accessors
**File**: `src/spacetimedb/tables.ts`
**Tests**: `__tests__/tables.test.ts` (418 tests)
**Coverage**: AC4

- [ ] Create `TableAccessor<T>` class
- [ ] Implement in-memory cache (Map-based)
- [ ] Implement `get(id)` method (O(1) lookup)
- [ ] Implement `getAll()` method
- [ ] Implement `query(predicate)` method
- [ ] Wire up cache updates from subscription events
- [ ] Implement cache invalidation on disconnect
- [ ] Create type-safe table accessor exports
- [ ] Add JSDoc documentation
- [ ] Optimize for large tables (10k+ rows)

**Test Validation**:
```bash
pnpm test tables.test.ts
```

Expected: All table accessor tests passing, performance benchmarks met

### Task 4: Latency Monitor
**File**: `src/spacetimedb/latency.ts`
**Tests**: `__tests__/latency.test.ts` (405 tests)
**Coverage**: AC3, NFR5

- [ ] Create `LatencyMonitor` class
- [ ] Implement latency calculation (commit timestamp → client timestamp)
- [ ] Implement rolling window (last 1000 measurements)
- [ ] Implement statistics calculation (avg, p50, p95, p99)
- [ ] Implement threshold monitoring (500ms for NFR5)
- [ ] Emit `updateLatency` event for each measurement
- [ ] Log warning if latency exceeds 500ms
- [ ] Expose `getStats()` method
- [ ] Optimize percentile calculation (efficient algorithm)
- [ ] Add JSDoc documentation

**Test Validation**:
```bash
pnpm test latency.test.ts
```

Expected: All latency monitoring tests passing, NFR5 compliance validated

### Task 5: SpacetimeDB Surface Integration
**File**: `src/index.ts`, `src/client.ts`
**Tests**: `__tests__/acceptance-criteria.test.ts` (546 tests)
**Coverage**: All ACs

- [ ] Update `SigilClientConfig` to include `spacetimedb` options
- [ ] Create `SpacetimeDBSurface` interface
- [ ] Add `spacetimedb` property to `SigilClient`
- [ ] Initialize connection manager in constructor
- [ ] Initialize subscription manager in constructor
- [ ] Initialize table accessors in constructor
- [ ] Initialize latency monitor in constructor
- [ ] Implement `connect()` method on SigilClient
- [ ] Implement `disconnect()` method on SigilClient
- [ ] Wire up event forwarding (gameStateUpdate, connectionChange)
- [ ] Add SigilClient as EventEmitter
- [ ] Export spacetimedb types and interfaces
- [ ] Update JSDoc documentation

**Test Validation**:
```bash
pnpm test acceptance-criteria.test.ts
```

Expected: All acceptance criteria tests passing

### Task 6: Type Generation (Optional - depends on SDK capabilities)
**File**: `src/spacetimedb/generated/index.ts` or `scripts/generate-types.sh`
**Coverage**: AC4

Research SpacetimeDB SDK 1.3.3 capabilities:

**Option A: CLI tool exists**
- [ ] Create `scripts/generate-types.sh`
- [ ] Run codegen against BitCraft module
- [ ] Output to `src/spacetimedb/generated/`
- [ ] Create index.ts re-exports
- [ ] Add to build process
- [ ] Document in README

**Option B: Programmatic generation**
- [ ] Create `src/spacetimedb/codegen.ts`
- [ ] Implement type generation from schema
- [ ] Run on module connection
- [ ] Cache generated types
- [ ] Document in README

**Option C: Manual type definitions**
- [ ] Define common table types manually
- [ ] Create `src/spacetimedb/types.ts`
- [ ] Export table row interfaces
- [ ] Document known tables

**Test Validation**:
```bash
# Verify type-safe accessors work
pnpm typecheck
```

Expected: No TypeScript errors, type safety validated

### Task 7: Integration Testing
**Tests**: `__tests__/integration.test.ts` (453 tests)
**Coverage**: All ACs against live server

Prerequisites:
- [ ] Docker stack from Story 1.3 running
- [ ] BitCraft server accessible at ws://localhost:3000
- [ ] RUN_INTEGRATION_TESTS env var set

Tasks:
- [ ] Run integration tests
- [ ] Verify live connection works
- [ ] Verify real subscriptions work
- [ ] Measure actual latency (must be <500ms for NFR5)
- [ ] Verify SDK 1.3.3 compatibility with BitCraft 1.6.x (NFR18)
- [ ] Fix any integration issues
- [ ] Document integration test setup

**Test Validation**:
```bash
cd docker && docker compose up -d
export RUN_INTEGRATION_TESTS=true
pnpm test:integration
```

Expected: All integration tests passing, NFR5 and NFR18 validated

### Task 8: Edge Case Handling
**Tests**: `__tests__/edge-cases.test.ts` (473 tests)
**Coverage**: Robustness, error recovery

- [ ] Implement concurrent operation safety
- [ ] Implement large data handling (10k+ rows)
- [ ] Implement network error recovery
- [ ] Implement resource limits (subscription count, cache size)
- [ ] Implement graceful degradation
- [ ] Handle malformed WebSocket messages
- [ ] Handle timestamp edge cases
- [ ] Add comprehensive error logging
- [ ] Document error handling strategy

**Test Validation**:
```bash
pnpm test edge-cases.test.ts
```

Expected: All edge case tests passing, robust error handling

### Task 9: Documentation
**Files**: `README.md`, JSDoc comments
**Coverage**: Usage, examples, API reference

- [ ] Update `packages/client/README.md` with SpacetimeDB section
- [ ] Document connection options
- [ ] Document subscription API
- [ ] Document table accessors
- [ ] Document events (connectionChange, gameStateUpdate, etc.)
- [ ] Document latency monitoring
- [ ] Add code examples
- [ ] Document SDK version requirement (1.3.3)
- [ ] Document NFR5 compliance
- [ ] Document troubleshooting

**Validation**:
- [ ] Review README for completeness
- [ ] Verify examples run
- [ ] Check JSDoc coverage

### Task 10: Example Script
**File**: `examples/subscribe-to-game-state.ts`
**Coverage**: End-to-end usage demonstration

- [ ] Create example directory
- [ ] Import SigilClient
- [ ] Create client with connection options
- [ ] Demonstrate connection
- [ ] Demonstrate subscriptions (3-5 tables)
- [ ] Demonstrate event listening
- [ ] Demonstrate table accessors
- [ ] Add inline comments
- [ ] Document how to run

**Validation**:
```bash
tsx examples/subscribe-to-game-state.ts
```

Expected: Example runs successfully, demonstrates all features

### Task 11: Final Validation
**Coverage**: All ACs, all NFRs, full test suite

- [ ] Run all unit tests: `pnpm test:unit`
- [ ] Run all integration tests: `pnpm test:integration`
- [ ] Run full test suite: `pnpm test`
- [ ] Check coverage: `pnpm test:coverage` (aim for 95%+)
- [ ] Run type checker: `pnpm typecheck`
- [ ] Run linter: `pnpm lint`
- [ ] Build package: `pnpm build`
- [ ] Verify dist/ output (ESM, CJS, DTS)
- [ ] Run example script
- [ ] Verify all 6 ACs met
- [ ] Verify NFR5 (latency <500ms)
- [ ] Verify NFR18 (SDK 1.3.3 compatibility)

**Final Checklist**:
- [ ] ✅ AC1: Connection to SpacetimeDB works
- [ ] ✅ AC2: Table subscriptions work with real-time push
- [ ] ✅ AC3: Latency monitoring validates <500ms (NFR5)
- [ ] ✅ AC4: Type-safe table accessors available
- [ ] ✅ AC5: Game state update events emitted
- [ ] ✅ AC6: SDK 1.3.3 backwards compatibility (NFR18)

### Task 12: Commit
**Coverage**: Story completion, git commit

- [ ] Stage changes: `git add .`
- [ ] Verify clean working directory
- [ ] Run pre-commit checks (tests, lint, types)
- [ ] Commit with message:
  ```
  feat(1-4): spacetimedb connection and table subscriptions complete

  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  ```

## Progress Tracking

**Overall Progress**: 0% (tests written, implementation pending)

### By Component
- [ ] Connection Manager: 0/10 subtasks
- [ ] Subscription Manager: 0/11 subtasks
- [ ] Table Accessors: 0/10 subtasks
- [ ] Latency Monitor: 0/10 subtasks
- [ ] SigilClient Integration: 0/13 subtasks
- [ ] Type Generation: 0/? subtasks (TBD)
- [ ] Integration Testing: 0/7 subtasks
- [ ] Edge Case Handling: 0/9 subtasks
- [ ] Documentation: 0/10 subtasks
- [ ] Example Script: 0/9 subtasks
- [ ] Final Validation: 0/13 subtasks
- [ ] Commit: 0/4 subtasks

### By Acceptance Criteria
- [ ] AC1: SigilClient connects (Tasks 1, 5)
- [ ] AC2: Table subscriptions (Tasks 2, 5)
- [ ] AC3: Latency monitoring (Tasks 4, 5)
- [ ] AC4: Type-safe accessors (Tasks 3, 5, 6)
- [ ] AC5: Game state events (Tasks 2, 5)
- [ ] AC6: SDK compatibility (Tasks 1, 5, 7)

## Test-Driven Implementation Strategy

### Red-Green-Refactor Cycle

1. **RED**: Run tests (they fail - no implementation)
   ```bash
   pnpm test connection.test.ts
   # ❌ All tests fail
   ```

2. **GREEN**: Implement minimal code to pass tests
   ```typescript
   // src/spacetimedb/connection.ts
   export class SpacetimeDBConnection extends EventEmitter {
     async connect() { /* minimal implementation */ }
   }
   ```

3. **REFACTOR**: Improve code quality, add optimizations
   ```typescript
   // Add error handling, improve performance, add docs
   ```

4. **VERIFY**: Tests still pass
   ```bash
   pnpm test connection.test.ts
   # ✅ All tests pass
   ```

5. **REPEAT**: Next component

### Implementation Order (Recommended)

1. **Connection Manager** (foundation - everything depends on it)
2. **Subscription Manager** (core feature)
3. **Table Accessors** (depends on subscriptions)
4. **Latency Monitor** (independent, can be parallel)
5. **SigilClient Integration** (ties everything together)
6. **Type Generation** (optional, improves DX)
7. **Integration Testing** (validates against live server)
8. **Edge Cases** (polish and robustness)
9. **Documentation** (polish)
10. **Example** (polish)

### Parallel Implementation

These can be implemented in parallel (independent):
- Connection Manager
- Latency Monitor

These must be sequential:
- Connection → Subscriptions → Tables → Integration
- All components → SigilClient Integration

## Estimated Effort

- **Connection Manager**: 1-2 hours
- **Subscription Manager**: 2-3 hours
- **Table Accessors**: 1-2 hours
- **Latency Monitor**: 1 hour
- **SigilClient Integration**: 1-2 hours
- **Type Generation**: 2-4 hours (depends on SDK)
- **Integration Testing**: 2-3 hours
- **Edge Cases**: 1-2 hours
- **Documentation**: 1-2 hours
- **Example**: 30 minutes

**Total Estimated**: 12-21 hours

## Notes

- Tests are written but will fail until implementation exists
- TypeScript errors are expected (properties don't exist yet)
- Follow TDD: Run tests → Implement → Tests pass → Refactor
- Integration tests require Docker stack from Story 1.3
- Aim for 95%+ test coverage
- All tests must pass before committing

## References

- Story spec: `_bmad-output/implementation-artifacts/1-4-spacetimedb-connection-and-table-subscriptions.md`
- Test architecture: `TEST_ARCHITECTURE_1_4.md`
- Test documentation: `__tests__/README.md`
