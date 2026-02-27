# Integration Test Strategy

**Date:** 2026-02-27
**Status:** Active
**Owner:** Charlie (Senior Dev)
**Relates To:** ACTION-1 from Epic 1 Retrospective

---

## Executive Summary

This document establishes clear guidelines for when to write integration tests vs. unit tests, how to handle Docker dependencies in CI/CD, and fallback strategies when Docker isn't available. It addresses the complexity flagged in the Epic 1 retrospective where 127 integration tests require the full Docker stack (BitCraft server + Crosstown node), making local development and CI/CD more complex.

**Key Principles:**
1. **Prefer unit tests** - They're faster, more reliable, and easier to maintain
2. **Integration tests for network behavior** - Only when you must verify real WebSocket connections or Docker services
3. **Graceful degradation** - Auto-skip integration tests when Docker unavailable
4. **Clear documentation** - New contributors should understand the trade-offs

---

## When to Write Integration Tests vs. Unit Tests

### Unit Tests (Preferred)

**Use unit tests when testing:**

- **Business logic** - State management, data transformations, calculations
- **Pure functions** - Functions with no side effects or external dependencies
- **API surface** - Public method interfaces and error handling
- **Edge cases** - Null checks, boundary conditions, input validation
- **Mocked dependencies** - When you can mock external services (WebSocket, database, file system)

**Example scenarios:**
- `calculateBackoffDelay()` - Pure function, deterministic output
- `Keypair.generate()` - No external dependencies, fast execution
- `StaticDataLoader.parseTable()` - Data transformation logic
- `ReconnectionManager` state transitions - Mock the connection object

**Benefits:**
- Fast execution (< 1ms per test)
- No Docker required
- Run in watch mode during development
- Reliable (no flaky network issues)
- Easy to debug
- Can run in CI without Docker setup

**Example:**
```typescript
// Good: Unit test with mocked connection
describe('ReconnectionManager', () => {
  it('should calculate exponential backoff correctly', () => {
    const manager = new ReconnectionManager(mockConnection);
    const delays = [
      manager.calculateBackoffDelay(0),
      manager.calculateBackoffDelay(1),
      manager.calculateBackoffDelay(2),
    ];
    expect(delays[0]).toBeGreaterThanOrEqual(900);
    expect(delays[1]).toBeGreaterThanOrEqual(1800);
    expect(delays[2]).toBeGreaterThanOrEqual(3600);
  });
});
```

---

### Integration Tests (When Necessary)

**Use integration tests when testing:**

- **Full stack interactions** - End-to-end flows across multiple services
- **Real WebSocket connections** - When mocking WebSocket behavior is insufficient
- **Docker services** - BitCraft server, Crosstown node, BLS handler
- **Network behavior** - Actual network latency, timeout handling, reconnection flows
- **SpacetimeDB SDK** - Verifying SDK compatibility with real server
- **Subscription recovery** - Validating snapshot merging after reconnection

**Example scenarios:**
- `SigilClient.connect()` to real SpacetimeDB server
- Subscription to `player_state` table and receiving real updates
- Reconnection after server restart
- Static data loading from live BitCraft module
- Crosstown relay event subscriptions (Epic 2)

**Trade-offs:**
- Slow execution (seconds per test due to Docker startup)
- Docker required (adds setup complexity)
- Flaky (network issues, timing problems)
- Harder to debug (multiple services, logs across containers)
- Cannot run in watch mode (too slow)
- CI requires Docker setup

**Example:**
```typescript
// Good: Integration test with real Docker stack
describe('SpacetimeDB Connection - Integration', () => {
  it('should connect to real BitCraft server and subscribe to player_state', async () => {
    // Requires Docker: docker compose -f docker/docker-compose.yml up -d
    const client = new SigilClient({
      spacetimedb: { url: 'ws://localhost:3000', databaseName: 'bitcraft' }
    });
    await client.connect();
    const players = client.spacetimedb.tables.players.getAll();
    expect(Array.isArray(players)).toBe(true);
  });
});
```

---

## Docker Dependency Handling in CI

### GitHub Actions Workflow

Integration tests require Docker Compose to start the full stack. We use conditional execution to skip integration tests when Docker isn't available.

**Workflow Structure:**

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test # Runs unit tests only (fast)

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests # Only run if unit tests pass
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build

      # Start Docker stack
      - name: Start Docker services
        run: |
          docker compose -f docker/docker-compose.yml up -d
          docker compose -f docker/docker-compose.yml ps

      # Wait for services to be healthy
      - name: Wait for services
        run: |
          timeout 60 bash -c 'until curl -f http://localhost:3000/database/bitcraft/info; do sleep 2; done'
          timeout 60 bash -c 'until curl -f http://localhost:4041/health; do sleep 2; done'

      # Run integration tests
      - run: pnpm test:integration

      # Cleanup
      - name: Stop Docker services
        if: always()
        run: docker compose -f docker/docker-compose.yml down -v
```

**Key Patterns:**
1. **Separate jobs** - Unit tests run first (fast feedback), integration tests run if unit tests pass
2. **Health checks** - Wait for services to be ready before running tests (prevents flaky tests)
3. **Cleanup** - Always stop Docker services, even if tests fail (`if: always()`)
4. **Timeout guards** - Prevent CI from hanging if services don't start

---

### Conditional Test Execution

Use Vitest's `skipIf` to conditionally skip integration tests when Docker isn't available.

**Pattern:**

```typescript
import { describe, it, expect } from 'vitest';

// Check if Docker is available
const isDockerAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:3000/database/bitcraft/info');
    return response.ok;
  } catch {
    return false;
  }
};

const DOCKER_AVAILABLE = await isDockerAvailable();

describe.skipIf(!DOCKER_AVAILABLE)('SpacetimeDB Connection - Integration', () => {
  it('should connect to real BitCraft server', async () => {
    // Integration test code...
  });
});
```

**Benefits:**
- Tests automatically skip if Docker not running
- Clear skip message in test output
- No false negatives (skipped tests don't fail the build)
- Developers can run unit tests without Docker

**Test Output:**
```
✓ src/spacetimedb/__tests__/connection.test.ts (27 tests) 109ms
↓ src/spacetimedb/__tests__/integration.test.ts (16 tests | 16 skipped)
  ↓ SpacetimeDB Connection - Integration (16 tests | 16 skipped)
    ↓ should connect to real BitCraft server (skipped)
```

---

## Fallback Strategies When Docker Unavailable

### Strategy 1: Auto-Skip Integration Tests (Recommended)

**Implementation:**
- Use `describe.skipIf(!DOCKER_AVAILABLE)` pattern (see above)
- Clear skip message in test output
- No false negatives

**Pros:**
- Simple to implement
- No code duplication
- Developers can run unit tests without Docker
- CI can run on machines without Docker

**Cons:**
- Integration test coverage not verified locally without Docker
- Developers may forget to run integration tests before pushing

**Best For:**
- Local development (developers iterate on unit tests)
- CI environments without Docker support

---

### Strategy 2: Lightweight Mocks for Local Development (Optional)

**Implementation:**
- Provide in-memory mock implementations of Docker services
- Example: Mock SpacetimeDB server that simulates table subscriptions
- Developers can run "integration-like" tests without Docker

**Pros:**
- Faster than real Docker stack
- No Docker setup required for local development
- Still validates integration points (mocked behavior)

**Cons:**
- Mocks may diverge from real behavior
- Additional maintenance burden (mock implementations)
- Not true integration tests (doesn't catch real network issues)

**Best For:**
- Rapid local development
- Testing integration logic without full stack

**Example:**
```typescript
// packages/client/src/spacetimedb/test-utils/mock-server.ts
export class MockSpacetimeDBServer {
  private tables: Map<string, any[]> = new Map();

  async subscribe(tableName: string, query: any) {
    // Return mock data
    return this.tables.get(tableName) || [];
  }

  async emit(tableName: string, event: string, row: any) {
    // Simulate row events
  }
}
```

**Status:** NOT IMPLEMENTED
**Priority:** LOW - Defer to backlog (DEBT-4)

---

### Strategy 3: Docker Setup Documentation (Current Approach)

**Implementation:**
- Provide clear Docker setup instructions in `docker/README.md`
- One-command setup: `docker compose -f docker/docker-compose.yml up -d`
- Health check scripts: `docker/scripts/health-check.sh`

**Pros:**
- Full integration test coverage
- Tests validate real behavior
- Reusable for local development

**Cons:**
- Requires Docker Desktop or Docker Engine
- Setup complexity for new contributors
- Slow test execution (minutes for full stack startup)

**Best For:**
- CI/CD (GitHub Actions, GitLab CI)
- Pre-commit hooks (run integration tests before push)
- Release validation (full end-to-end testing)

**Documentation:**
See `docker/README.md` for detailed setup instructions.

---

## Test Execution Guidelines

### Local Development Workflow

```bash
# Fast feedback loop (unit tests only)
pnpm test:watch  # Run in packages/client

# Full validation (unit + integration tests)
docker compose -f docker/docker-compose.yml up -d  # Start stack
pnpm test                                          # Run all tests
docker compose -f docker/docker-compose.yml down  # Stop stack
```

### CI/CD Workflow

```bash
# GitHub Actions (automatic)
1. Run unit tests (fast, no Docker)
2. Start Docker stack
3. Wait for health checks
4. Run integration tests
5. Stop Docker stack
```

### Pre-Commit Hook (Optional)

```bash
# .husky/pre-commit
#!/bin/sh
pnpm test  # Run unit tests only (fast)

# Optional: Run integration tests if Docker available
if docker info > /dev/null 2>&1; then
  echo "Docker available - running integration tests..."
  docker compose -f docker/docker-compose.yml up -d
  pnpm test:integration
  docker compose -f docker/docker-compose.yml down
else
  echo "Docker not available - skipping integration tests"
fi
```

---

## Test Organization

### File Naming Convention

```
packages/client/src/
├── __tests__/
│   ├── connection.test.ts          # Unit tests (mocked connection)
│   ├── integration.test.ts         # Integration tests (real Docker stack)
│   ├── reconnection-manager.test.ts # Unit tests (mocked connection)
│   └── reconnection.integration.test.ts # Integration tests (real reconnection)
```

**Pattern:**
- `*.test.ts` - Unit tests (fast, no Docker)
- `*.integration.test.ts` - Integration tests (slow, requires Docker)

**Benefits:**
- Clear distinction between test types
- Easy to filter in Vitest configuration
- Developers know which tests require Docker

---

### Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',           // Unit tests (always run)
      'src/**/*.integration.test.ts' // Integration tests (conditional)
    ],
    exclude: [
      'node_modules/**',
      'dist/**'
    ],
  },
});
```

---

## Health Check Patterns

### Wait for Services to Be Ready

Integration tests should not start until all Docker services are healthy. Use health check scripts to prevent flaky tests.

**Docker Compose Health Checks:**

```yaml
# docker/docker-compose.yml
services:
  bitcraft-server:
    image: clockworklabs/spacetimedb:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/database/bitcraft/info"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 30s

  crosstown-node:
    image: crosstown:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4041/health"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 30s
```

**Health Check Script:**

```bash
# docker/scripts/health-check.sh
#!/bin/bash
set -e

echo "Waiting for BitCraft server..."
timeout 60 bash -c 'until curl -f http://localhost:3000/database/bitcraft/info; do sleep 2; done'

echo "Waiting for Crosstown node..."
timeout 60 bash -c 'until curl -f http://localhost:4041/health; do sleep 2; done'

echo "All services healthy!"
```

**Usage in Tests:**

```typescript
// src/__tests__/setup.integration.ts
import { beforeAll } from 'vitest';

beforeAll(async () => {
  // Wait for services to be healthy
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetch('http://localhost:3000/database/bitcraft/info');
      await fetch('http://localhost:4041/health');
      return; // Both services healthy
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Services did not become healthy in time');
});
```

---

## Epic 2 Considerations

### BLS Handler Integration (Story 2.4)

Epic 2 Story 2.4 introduces the BLS (Billing and Lifecycle Services) handler, which will run as a third Docker service. Integration tests for Story 2.4 will require:

1. **BLS handler service** in `docker-compose.yml`
2. **Health check** for BLS handler
3. **Integration tests** validating:
   - ILP packet delivery via Crosstown
   - BLS callback execution
   - SpacetimeDB reducer invocation

**Recommendation:**
- Write unit tests for BLS handler logic (packet parsing, signature verification)
- Write integration tests for end-to-end flow (Nostr relay → BLS → SpacetimeDB)
- Use `describe.skipIf(!DOCKER_AVAILABLE)` pattern for integration tests

---

### Crosstown Relay Integration (Story 2.1)

Story 2.1 introduces Crosstown relay event subscriptions. Integration tests will require:

1. **Crosstown node running** (already in Docker stack)
2. **Nostr relay protocol** knowledge (see PREP-4)
3. **Integration tests** validating:
   - Subscription to Crosstown events
   - Event filtering and parsing
   - Error handling

**Recommendation:**
- Write unit tests for event parsing and filtering logic
- Write integration tests for real Crosstown relay connections
- Use health check pattern to wait for Crosstown node

---

## Metrics & Success Criteria

### Epic 1 Baseline

- **Total Tests:** 937 (810 unit, 127 integration)
- **Unit Test Pass Rate:** 100%
- **Integration Test Pass Rate:** 100% (when Docker available)
- **Unit Test Execution Time:** < 30 seconds
- **Integration Test Execution Time:** ~30 seconds (with Docker running)

### Epic 2 Goals

- **Maintain >95% unit test coverage** (prefer unit tests over integration tests)
- **Integration tests auto-skip gracefully** when Docker unavailable
- **CI pipeline completes in < 5 minutes** (including Docker setup and integration tests)
- **New contributor can run unit tests in < 2 minutes** (no Docker required)

---

## Team Agreements

### From Epic 1 Retrospective

**AGREEMENT-1: Test-First for Complex Features**
For features with >3 acceptance criteria, write tests before implementation. Applies to both unit tests and integration tests.

**AGREEMENT-5: Integration Test Documentation**
Integration tests requiring Docker must have:
- Clear setup instructions in test file header
- Graceful failure messages when Docker unavailable
- Health check patterns to prevent flaky tests

---

## References

- **Epic 1 Retrospective:** `_bmad-output/implementation-artifacts/epic-1-retro-2026-02-27.md`
- **Docker Setup:** `docker/README.md`
- **Test Reports:** `_bmad-output/implementation-artifacts/epic-1-test-architecture-traceability.md`
- **Vitest Documentation:** https://vitest.dev/guide/
- **Docker Compose Documentation:** https://docs.docker.com/compose/

---

**Document Status:** ACTIVE - Apply starting Epic 2
**Last Updated:** 2026-02-27 by Charlie (Senior Dev)
**Next Review:** After Epic 2 Story 2.1 (validate strategy effectiveness)
