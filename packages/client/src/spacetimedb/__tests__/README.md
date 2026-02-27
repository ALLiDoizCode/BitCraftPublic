# SpacetimeDB Test Architecture (Story 1.4)

This directory contains the comprehensive test suite for Story 1.4: SpacetimeDB Connection & Table Subscriptions.

## Test Structure

### ATDD (Acceptance Test-Driven Development)

The test suite follows ATDD principles, with tests organized by acceptance criteria and user stories.

### Test Files

#### `acceptance-criteria.test.ts`

**Purpose**: Executable specifications for all acceptance criteria (AC1-AC6)

**Coverage**:

- AC1: SigilClient connects to SpacetimeDB
- AC2: Subscribe to table updates with real-time push
- AC3: Real-time update latency requirement (NFR5)
- AC4: Type-safe table accessors
- AC5: Game state update events
- AC6: SDK backwards compatibility

**When to run**: Always (part of `pnpm test`)

**Key characteristics**:

- BDD-style Given/When/Then structure
- Tests behavior, not implementation
- Each test maps directly to acceptance criteria
- Validates end-to-end user workflows

#### `integration.test.ts`

**Purpose**: Tests against live BitCraft SpacetimeDB server

**Coverage**:

- Live server connection (ws://localhost:3000)
- Real table subscriptions
- Actual latency measurements (NFR5 verification)
- SDK 1.3.3 compatibility with BitCraft 1.6.x (NFR18)
- Volume persistence across restarts
- Performance under real load

**When to run**: Integration test phase (requires Docker stack)

**Prerequisites**:

```bash
cd docker && docker compose up
export RUN_INTEGRATION_TESTS=true
pnpm test:integration
```

**Key characteristics**:

- Requires live BitCraft server
- Tests real WebSocket protocol v1 communication
- Validates NFR5 (<500ms latency) in production-like conditions
- Skipped by default (set `RUN_INTEGRATION_TESTS` env var to enable)

#### `connection.test.ts`

**Purpose**: Unit tests for SpacetimeDB connection manager

**Coverage**:

- Connection options validation
- State machine transitions (disconnected → connecting → connected)
- Connection event emission
- Timeout handling
- WebSocket protocol URL construction
- Error handling (network errors, DNS failures, timeouts)
- Clean disconnect and cleanup

**Key characteristics**:

- Fast (no network I/O)
- Isolated (mocks SpacetimeDB SDK)
- Tests internal state management
- Validates error paths

#### `subscriptions.test.ts`

**Purpose**: Unit tests for subscription manager

**Coverage**:

- Subscription lifecycle (create → snapshot → updates → unsubscribe)
- Event emission (tableSnapshot, rowInserted, rowUpdated, rowDeleted)
- Game state update aggregation
- Multiple concurrent subscriptions
- Subscription cleanup
- Error handling
- Subscription limits (DoS prevention)

**Key characteristics**:

- Tests subscription logic in isolation
- Validates event batching and aggregation
- Tests resource management

#### `tables.test.ts`

**Purpose**: Unit tests for type-safe table accessors

**Coverage**:

- Cache initialization and updates
- get(), getAll(), query() methods
- Cache synchronization with events
- Type safety verification
- Performance (large tables, queries)
- Memory management

**Key characteristics**:

- Tests in-memory cache behavior
- Validates type-safe API
- Performance benchmarks (10k+ rows)
- Memory leak prevention

#### `latency.test.ts`

**Purpose**: Unit tests for latency monitoring (NFR5)

**Coverage**:

- Latency measurement calculation
- NFR5 threshold monitoring (500ms)
- Statistics (avg, p50, p95, p99)
- Rolling window (last 1000 measurements)
- Warning emission on threshold violation
- Performance of stats calculation

**Key characteristics**:

- Validates NFR5 implementation
- Tests percentile calculations
- Ensures efficient processing

#### `edge-cases.test.ts`

**Purpose**: Boundary conditions and uncommon scenarios

**Coverage**:

- Concurrent operations (rapid connect/disconnect)
- Large data scenarios (millions of rows, large messages)
- Network conditions (timeouts, intermittent connectivity)
- Data consistency (out-of-order updates, duplicates)
- Resource limits (subscription caps, cache limits)
- Type coercion edge cases
- Event listener memory management
- Protocol edge cases (malformed messages)
- Timezone/timestamp edge cases
- Error recovery

**Key characteristics**:

- Tests robustness
- Validates graceful degradation
- Ensures no edge case crashes

## Running Tests

### Run all tests

```bash
pnpm test
```

### Run specific test file

```bash
pnpm test acceptance-criteria.test.ts
```

### Run integration tests (requires Docker stack)

```bash
cd docker && docker compose up -d
export RUN_INTEGRATION_TESTS=true
pnpm test integration.test.ts
```

### Run with coverage

```bash
pnpm test:coverage
```

### Watch mode (during development)

```bash
pnpm test:watch
```

## Test Coverage Goals

- **Unit tests**: 100% code coverage for all modules
- **Integration tests**: All acceptance criteria verified against live server
- **Edge cases**: All identified boundary conditions tested

## Test Philosophy

### ATDD Principles

1. **Tests as Specifications**: Tests define behavior, not implementation
2. **Acceptance Criteria Traceability**: Every AC has corresponding test(s)
3. **Executable Documentation**: Tests serve as usage examples
4. **Test-First Mindset**: Tests written before or alongside implementation

### BDD (Behavior-Driven Development)

Tests use Given/When/Then structure:

```typescript
it('should receive initial state snapshot for matching rows', async () => {
  // Given: an active SpacetimeDB connection
  await client.connect();

  // When: I call client.spacetimedb.subscribe('player_state', query)
  const handle = await client.spacetimedb.subscribe('player_state', {});

  // Then: I receive the initial state snapshot for matching rows
  expect(handle).toBeDefined();
  expect(handle.tableName).toBe('player_state');
});
```

### Test Pyramid

```
      /\
     /  \       Integration Tests (few, slow, high value)
    /____\
   /      \     Unit Tests (many, fast, focused)
  /________\
 /__________\   Edge Cases (comprehensive, boundary conditions)
```

- **Unit tests**: Many, fast, isolated
- **Integration tests**: Few, slower, end-to-end
- **Edge cases**: Comprehensive boundary coverage

## Mocking Strategy

### What we mock

- SpacetimeDB SDK (in unit tests)
- Network layer (in unit tests)
- Time/Date for deterministic tests

### What we don't mock

- Internal application logic
- Data structures (Map, Set, etc.)
- Event emitters
- Live server (in integration tests)

## NFR Validation

### NFR5: Real-time update latency <500ms

- **Unit tests**: `latency.test.ts` validates monitoring infrastructure
- **Integration tests**: `integration.test.ts` measures actual latency against live server

### NFR18: SDK backwards compatibility

- **Unit tests**: `connection.test.ts` validates SDK version constraint
- **Integration tests**: `integration.test.ts` verifies SDK 1.3.3 works with BitCraft 1.6.x

## Continuous Integration

Tests run automatically on:

- Every commit (unit tests only)
- Pull requests (unit + integration tests)
- Pre-merge checks (full suite + coverage)

## Test Data

### Fixtures

- No external fixtures required (tests use in-memory mocks)
- Integration tests use live BitCraft data

### Test Isolation

- Each test is independent
- No shared state between tests
- `beforeEach`/`afterEach` for setup/teardown

## Debugging Tests

### Run single test

```bash
pnpm test -t "should connect to BitCraft server"
```

### Debug in VS Code

Add breakpoint, then use "Debug Test" CodeLens

### Verbose output

```bash
pnpm test --reporter=verbose
```

### Show console logs

```bash
pnpm test --reporter=verbose --no-coverage
```

## Performance Benchmarks

Tests include performance assertions:

- **Connection**: <10s timeout (configurable)
- **Latency measurement**: <10ms for 1000 calculations
- **Table cache**: O(1) lookups for 10k+ rows
- **Query performance**: <10ms for 1000 rows

## Future Test Enhancements

### Planned for Story 1.5

- Static data loading tests
- Codegen validation tests

### Planned for Story 1.6

- Auto-reconnection tests
- State recovery tests

## Contributing

When adding new functionality:

1. **Write acceptance criteria tests first** (TDD)
2. **Add unit tests** for internal components
3. **Update integration tests** if behavior changes
4. **Add edge cases** for boundary conditions
5. **Verify all tests pass** before committing
6. **Check coverage** (aim for 100%)

## Test Anti-Patterns to Avoid

❌ Testing implementation details (internal variables)
❌ Brittle tests (tight coupling to structure)
❌ Flaky tests (non-deterministic behavior)
❌ Slow unit tests (use mocks, not real I/O)
❌ Missing cleanup (memory leaks in tests)
❌ Sharing state between tests
❌ Over-mocking (tests become meaningless)

✅ Test behavior, not implementation
✅ Isolated, independent tests
✅ Deterministic, repeatable results
✅ Fast unit tests (<1ms each)
✅ Proper cleanup in afterEach
✅ Each test has single responsibility
✅ Mock external dependencies, not internal logic

## References

- Story 1.4 specification: `_bmad-output/implementation-artifacts/1-4-spacetimedb-connection-and-table-subscriptions.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- NFR5: Real-time updates <500ms
- NFR18: SpacetimeDB SDK 1.3.3 compatibility
