# ADR-004: Docker-Based Development Environment

**Status:** Accepted
**Date:** 2026-02-26 (Implemented in Story 1.3)
**Deciders:** Jonathan (Project Lead), Charlie (Senior Dev), Elena (Junior Dev)

---

## Context

The Sigil SDK requires a local development environment for:
1. **BitCraft SpacetimeDB server** (v1.6.x) - Game world simulation
2. **Crosstown ILP relay node** - Nostr relay + ILP packet routing
3. **BLS game action handler** (future, Epic 2) - Identity propagation

Developers need to run these services locally for integration testing and development. The question was: How do we package and distribute these services?

---

## Problem Statement

We need a local development environment that:
1. **Runs BitCraft server** - SpacetimeDB 1.6.x with BitCraft game module
2. **Runs Crosstown relay** - Nostr relay + ILP routing
3. **Is easy to set up** - One-command startup
4. **Is consistent across machines** - Works on macOS, Linux (Windows future)
5. **Is isolated** - Doesn't pollute host machine with dependencies
6. **Supports integration tests** - Tests can connect to real services

---

## Options Considered

### Option 1: Native Installation (No Docker)

**Setup:**
- Install SpacetimeDB binary (`spacetime` CLI)
- Clone BitCraft server, build from source
- Clone Crosstown, build from source (Rust)
- Configure services, start manually

**Pros:**
- No Docker dependency (lighter weight)
- Faster startup (no container overhead)

**Cons:**
- **Setup complexity**: 30+ minute setup process (install deps, build from source)
- **Platform differences**: Different setup instructions for macOS, Linux, Windows
- **Dependency conflicts**: SpacetimeDB may conflict with other local services
- **No isolation**: Services pollute host machine (ports, files)
- **Hard to reproduce issues**: "Works on my machine" problems

---

### Option 2: Docker Compose (Recommended)

**Setup:**
```bash
docker compose -f docker/docker-compose.yml up -d
```

**Pros:**
- **One-command setup**: `docker compose up -d` (< 2 minutes)
- **Cross-platform**: Works on macOS, Linux, Windows (with Docker Desktop)
- **Isolated**: Services run in containers (no host pollution)
- **Reproducible**: Same environment on all machines
- **Version-controlled config**: `docker-compose.yml` is in Git
- **Health checks**: Containers auto-restart on failure
- **Realistic testing**: Integration tests use real services

**Cons:**
- **Docker dependency**: Requires Docker Desktop or Docker Engine
- **Setup complexity for new contributors**: Must install Docker first
- **Resource usage**: Containers consume CPU/memory
- **Integration test complexity**: Tests must wait for services to be ready

---

### Option 3: Kubernetes (Overkill)

**Setup:**
- Install Minikube or kind (local Kubernetes cluster)
- Write Kubernetes manifests (Deployments, Services, ConfigMaps)
- Deploy to local cluster

**Pros:**
- Production-like environment (if deploying to Kubernetes later)

**Cons:**
- **Massive overkill for local dev** (adds 10x complexity)
- **Steep learning curve**: Requires Kubernetes knowledge
- **Slow**: Kubernetes startup is slower than Docker Compose
- **Not needed**: We're not deploying to Kubernetes in MVP

---

## Decision

**We chose Option 2: Docker Compose for local development environment.**

---

## Rationale

1. **One-Command Setup**
   - `docker compose up -d` starts all services
   - No manual dependency installation (SpacetimeDB, Rust toolchain, etc.)
   - New contributors productive in < 5 minutes

2. **Cross-Platform Compatibility**
   - Works on macOS (Intel + Apple Silicon)
   - Works on Linux (Ubuntu, Fedora, Arch)
   - Future: Works on Windows with WSL2 + Docker Desktop

3. **Isolation & Reproducibility**
   - Services run in containers (no host pollution)
   - Same Docker images on all machines (no "works on my machine")
   - Version-controlled config (`docker-compose.yml` in Git)

4. **Integration Testing**
   - 127 integration tests connect to Docker stack (Stories 1.4-1.6)
   - Realistic testing (real WebSocket connections, real subscriptions)
   - Health checks ensure services ready before tests run

5. **Epic 1 Validation**
   - Story 1.3 implemented Docker stack (8 tests, 100% pass rate)
   - Stories 1.4-1.6 validated integration tests (all pass)
   - Docker stack operational, no blockers

---

## Consequences

### Positive
- ✅ **Fast setup**: 1 command, < 2 minutes
- ✅ **Cross-platform**: macOS + Linux (Windows future)
- ✅ **Isolated**: No host pollution
- ✅ **Reproducible**: Same environment everywhere
- ✅ **Integration tests**: 127 tests against real services
- ✅ **Health checks**: Auto-restart on failure

### Negative
- ⚠️ **Docker dependency**: Must install Docker Desktop (250MB download)
- ⚠️ **Onboarding friction**: New contributors must install Docker first
- ⚠️ **Resource usage**: Containers consume ~1GB RAM, 500MB disk
- ⚠️ **Integration test complexity**: Tests must wait for services (health checks)

### Mitigation Strategies
1. **Clear documentation**: `docker/README.md` has setup instructions + troubleshooting
2. **Health check scripts**: `docker/scripts/health-check.sh` ensures services ready
3. **Auto-skip tests**: Integration tests auto-skip if Docker not running (ACTION-1)
4. **Docker Desktop alternatives**: Support native Docker Engine on Linux (no Desktop needed)

---

## Implementation Details

**Story 1.3: Docker Local Development Environment** (2026-02-26)

### Docker Compose Configuration

**File:** `docker/docker-compose.yml`

```yaml
version: '3.8'

services:
  bitcraft-server:
    image: clockworklabs/spacetimedb:1.6.0
    container_name: bitcraft-server
    ports:
      - "3000:3000"
    volumes:
      - ./bitcraft:/opt/bitcraft:ro
      - ./volumes/spacetimedb:/var/lib/spacetimedb
    environment:
      - SPACETIMEDB_LOG=info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/database/bitcraft/info"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 30s
    restart: unless-stopped

  crosstown-node:
    build: ./crosstown
    container_name: crosstown-node
    ports:
      - "4040:4040"  # Nostr relay
      - "4041:4041"  # HTTP API
    volumes:
      - ./volumes/crosstown:/var/lib/crosstown
    environment:
      - CROSSTOWN_HTTP_PORT=4041
      - CROSSTOWN_NOSTR_PORT=4040
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4041/health"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 30s
    depends_on:
      - bitcraft-server
    restart: unless-stopped
```

---

### Services

#### 1. BitCraft Server (SpacetimeDB 1.6.x)

**Image:** `clockworklabs/spacetimedb:1.6.0` (pinned version, not `latest`)
**Port:** 3000 (localhost-only, not exposed to internet)
**Volumes:**
- `./bitcraft:/opt/bitcraft:ro` - BitCraft game module (read-only)
- `./volumes/spacetimedb:/var/lib/spacetimedb` - Persistent data

**Health Check:**
```bash
curl -f http://localhost:3000/database/bitcraft/info
```

**Log Viewing:**
```bash
docker compose -f docker/docker-compose.yml logs -f bitcraft-server
```

---

#### 2. Crosstown ILP Relay Node

**Build:** `./crosstown/Dockerfile` (built from source)
**Ports:**
- 4040: Nostr relay (WebSocket)
- 4041: HTTP API (health check, metrics)

**Volumes:**
- `./volumes/crosstown:/var/lib/crosstown` - Persistent relay data

**Health Check:**
```bash
curl -f http://localhost:4041/health
```

**Log Viewing:**
```bash
docker compose -f docker/docker-compose.yml logs -f crosstown-node
```

---

### Usage

**Start services:**
```bash
docker compose -f docker/docker-compose.yml up -d
```

**Check service health:**
```bash
docker compose -f docker/docker-compose.yml ps
```

**Stop services:**
```bash
docker compose -f docker/docker-compose.yml down
```

**Reset environment (WARNING: deletes persistent data):**
```bash
docker compose -f docker/docker-compose.yml down -v
rm -rf docker/volumes/*
docker compose -f docker/docker-compose.yml up -d
```

---

### Security Improvements (Epic 1 Code Review)

Story 1.3 code review identified and fixed 12 security issues (H-001 through L-004):

**H-001: Path Traversal Prevention**
```bash
# docker/bitcraft/init.sh
if ! echo "$MODULE_PATH" | grep -q '^/opt/bitcraft/'; then
    echo "ERROR: Invalid module path (must be under /opt/bitcraft/)"
    exit 1
fi
```

**H-002: Port Validation**
```rust
// crosstown-src/src/main.rs
if http_port < 1024 || nostr_port < 1024 {
    tracing::error!("Port numbers must be >= 1024 for unprivileged users");
    std::process::exit(1);
}
```

**H-003: Rate Limiting**
```rust
// crosstown-src/src/main.rs
let mut rate_limiter = RateLimiter::new(100, 60); // 100 events per 60 seconds
if !rate_limiter.check_and_record() {
    tracing::warn!("Rate limit exceeded for connection");
    continue;
}
```

**See:** `_bmad-output/implementation-artifacts/1-3-code-review-report-pass3.md` for full security review.

---

### Integration Test Pattern

```typescript
// src/__tests__/integration.test.ts
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
    const client = new SigilClient({
      spacetimedb: { url: 'ws://localhost:3000', databaseName: 'bitcraft' }
    });
    await client.connect();
    expect(client.spacetimedb.connection.connectionState).toBe('connected');
  });
});
```

**See:** `_bmad-output/implementation-artifacts/integration-test-strategy.md` for full integration test strategy (ACTION-1).

---

## NFR Compliance

**NFR16: Docker One-Command Setup**
- ✅ Validated: `docker compose up -d` starts all services
- ✅ Health checks ensure services ready before tests run
- ✅ Documentation in `docker/README.md`

**NFR22: Cross-Platform Support (Linux + macOS)**
- ✅ macOS validated in Epic 1 (Intel + Apple Silicon)
- ⚠️ Linux validation deferred to PREP-2 (Ubuntu 24.04)
- 🔜 Windows support deferred to Phase 2 (Epic 7-10)

---

## Epic 2 Considerations

### BLS Handler Service (Story 2.4)

Epic 2 Story 2.4 will add a third Docker service:

```yaml
# docker-compose.yml (future)
services:
  bls-handler:
    build: ./bls-handler
    container_name: bls-handler
    ports:
      - "5000:5000"
    depends_on:
      - crosstown-node
      - bitcraft-server
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 5s
      timeout: 3s
      retries: 10
```

**Integration:** BLS handler subscribes to Crosstown (kind 30078 events) and calls SpacetimeDB reducers.

---

## Related Decisions

- **ADR-001**: SpacetimeDB 2.0 SDK on 1.6.x Servers (Docker runs 1.6.x server)
- **ADR-003**: Polyglot Monorepo (Docker supports TypeScript + Rust builds)
- **ACTION-1**: Integration Test Strategy (Docker stack required for 127 integration tests)

---

## References

- **Docker Compose Docs**: https://docs.docker.com/compose/
- **Story 1.3 Report**: `_bmad-output/implementation-artifacts/1-3-docker-local-development-environment.md`
- **Docker README**: `docker/README.md`
- **Security Review**: `_bmad-output/implementation-artifacts/1-3-code-review-report-pass3.md`

---

**Status:** ✅ ACCEPTED - Implemented in Epic 1 Story 1.3 (8 tests, 12 security issues fixed)
**Last Updated:** 2026-02-27 by Charlie (Senior Dev)
