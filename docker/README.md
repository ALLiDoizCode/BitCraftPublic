# Docker Local Development Environment

This directory contains Docker Compose configuration for running a complete local development environment for the Sigil SDK, including:

- **BitCraft Server**: SpacetimeDB with the BitCraft game module (v1.6.x compatible)
- **Crosstown Node**: Nostr relay with BLS (Blockchain-Like Signing) proxy (stub mode)

## Prerequisites

- **Docker Desktop 4.0+** (macOS 10.15+) or **Docker Engine 20.10+** (Linux)
- **Docker Compose v2** CLI (included with Docker Desktop)
  - **Note**: Docker Compose v2 uses `docker compose` (no hyphen) command
  - Modern compose files do not require `version:` field at the top
- Supported platforms: macOS (Intel/Apple Silicon), Linux (amd64)
- **Disk space**: ~3GB for Docker images (SpacetimeDB + Rust 1.83 toolchain)

### Test Tools (for smoke tests)

- `curl` - Usually pre-installed
- `jq` - Install via `brew install jq` (macOS) or `apt-get install jq` (Linux)
- `websocat` - Install via `cargo install websocat`
- `spacetime` CLI - Install via `curl -fsSL https://install.spacetimedb.com | sh`

## Quick Start

### 1. Obtain BitCraft WASM Module

The BitCraft WASM module is required to run the SpacetimeDB server. Choose one of the following options:

#### Option 1: Download from GitHub Release

```bash
# Download from BitCraft Apache 2.0 fork (v1.6.x compatible)
# Repository: https://github.com/bitcraftlabs/bitcraft
# Tag: v1.6.x-compatible
curl -L -o docker/bitcraft/bitcraft.wasm \
  https://github.com/bitcraftlabs/bitcraft/releases/download/v1.6.x-compatible/bitcraft.wasm

# Verify SHA256 checksum (replace with actual checksum from release)
sha256sum docker/bitcraft/bitcraft.wasm
```

#### Option 2: Build from Source

```bash
# Clone BitCraft repository
git clone https://github.com/bitcraftlabs/bitcraft.git
cd bitcraft

# Build using SpacetimeDB CLI
spacetime build --module-path .

# Copy to Docker directory
cp target/bitcraft.wasm ../docker/bitcraft/bitcraft.wasm
```

#### Option 3: Use Pre-built Module from Assets

```bash
# If available in project assets
cp _assets/bitcraft.wasm docker/bitcraft/bitcraft.wasm

# Verify SHA256 checksum (see _assets/checksums.txt)
sha256sum docker/bitcraft/bitcraft.wasm
```

### 2. Start the Stack

```bash
cd docker
docker compose up
```

Or from the project root:

```bash
docker compose -f docker/docker-compose.yml up
```

The stack will:

1. Build the BitCraft server container (SpacetimeDB 1.0.0 + module)
2. Build the Crosstown node container (Rust 1.83 multi-stage build)
3. Start BitCraft server and wait for health check (max 100s: 10s start + 30s interval × 3 retries)
4. Start Crosstown node (depends on BitCraft being healthy, max 105s: 15s start + 30s interval × 3 retries)

### 3. Verify Services

```bash
# Check service status
docker compose ps

# Both services should show "healthy" status
# BitCraft: http://localhost:3000
# Crosstown: ws://localhost:4040 (Nostr), http://localhost:4041 (HTTP)

# Run smoke tests
./tests/smoke-test.sh
```

## Connection Endpoints

### Base Mode (Production)

- **SpacetimeDB WebSocket**: `ws://localhost:3000`
- **SpacetimeDB HTTP**: `http://localhost:3000/database/bitcraft/info`
- **Crosstown Nostr Relay**: `ws://localhost:4040`
- **Crosstown HTTP API**: `http://localhost:4041/health`, `http://localhost:4041/metrics`

### Dev Mode (Additional Debug Ports)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Additional endpoints:

- **SpacetimeDB Admin**: `http://localhost:3001` (management API)
- **Crosstown Metrics**: `http://localhost:4042` (Prometheus metrics)

**SECURITY WARNING**: Dev mode exposes administrative endpoints (ports 3001, 4042) without authentication. These ports are bound to `127.0.0.1` (localhost only) but can still be accessed by any local process. **Never use dev mode in production or on untrusted networks.** For production deployments, use proper authentication and TLS.

Dev mode also enables:

- Debug log levels (`SPACETIMEDB_LOG_LEVEL=debug`, `CROSSTOWN_LOG_LEVEL=debug`)
- Hot module reloading (mount `./bitcraft-module` to `/opt/bitcraft`)

## Volume Locations

Data is persisted in `./volumes/`:

- `./volumes/spacetimedb/data` - SpacetimeDB database and logs
- `./volumes/crosstown/events` - Crosstown relay event storage

**Note**: Volumes are excluded from git via `.gitignore`

## Configuration

Copy `.env.example` to `.env` to customize configuration:

```bash
cp .env.example .env
```

Available variables:

```bash
# BitCraft ports and resources
BITCRAFT_PORT=3000
BITCRAFT_ADMIN_PORT=3001
BITCRAFT_MEMORY_LIMIT=1G

# Crosstown ports and resources
CROSSTOWN_NOSTR_PORT=4040
CROSSTOWN_HTTP_PORT=4041
CROSSTOWN_METRICS_PORT=4042
CROSSTOWN_MEMORY_LIMIT=512M

# Logging
SPACETIMEDB_LOG_LEVEL=info  # debug, info, warn, error
CROSSTOWN_LOG_LEVEL=info

# Crosstown build mode
CROSSTOWN_BUILD_MODE=remote  # remote (git clone) or local (docker/crosstown/crosstown-src/)
```

## Crosstown Build Modes

The Crosstown node supports two build modes:

### Remote Mode (Default)

Clones Crosstown from a git repository:

```bash
CROSSTOWN_BUILD_MODE=remote docker compose up
```

**Note**: Remote build is not yet implemented (waiting for Crosstown repository URL). For now, use local mode.

### Local Mode

Uses local source from `docker/crosstown/crosstown-src/`:

```bash
CROSSTOWN_BUILD_MODE=local docker compose up
```

The local source is a minimal stub implementation that:

- Runs a NIP-01 compliant Nostr relay
- Listens for kind 30078 events (BLS game actions)
- Logs ILP packets to stdout (stub mode, does NOT forward to SpacetimeDB)
- Provides HTTP health and metrics endpoints

## BitCraft Module Capabilities

The BitCraft WASM module (v1.6.x) exposes:

- **364+ reducers** - Game logic entry points
- **~80 entity tables** - Dynamic game state (players, planets, resources, etc.)
- **148 static data tables** - Game configuration (item definitions, recipes, etc.)

**Note**: Full module validation is performed in Story 1.5. For this story (1.3), we only verify the module loads successfully.

## Crosstown BLS Integration

The Crosstown node includes a BLS (Blockchain-Like Signing) proxy for game actions:

### Stub Mode (Story 1.3 - Current)

- Subscribes to kind 30078 events on built-in Nostr relay
- Parses ILP packet: `{ reducer: string, args: any[], fee: number }`
- Logs to stdout: `[BLS STUB] Received kind 30078 from {pubkey}: reducer={name}, args_count={n}, fee={amount}`
- Stores event normally but **does NOT forward to SpacetimeDB**

### Full Mode (Story 2.4+ - BLS Handler Implementation)

The BLS handler validates Nostr event signatures and forwards authenticated game actions to SpacetimeDB with identity propagation:

- Parse ILP packet from event content (extract `reducer` and `args`)
- Validate Nostr event signature (secp256k1 Schnorr verification per NIP-01)
- Extract Nostr pubkey from event author
- Call SpacetimeDB reducer via HTTP API with identity prepended as first argument
- Return success or error response to Crosstown connector

**Configuration:**

The BLS handler requires the following environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SPACETIMEDB_URL` | SpacetimeDB HTTP endpoint | `http://localhost:3000` | Yes |
| `SPACETIMEDB_DATABASE` | Database name | `bitcraft` | Yes |
| `SPACETIMEDB_TOKEN` | Authentication token (admin token for MVP) | (none) | Yes |

**Example `docker-compose.yml` configuration:**

```yaml
services:
  crosstown-node:
    environment:
      - SPACETIMEDB_URL=http://bitcraft-server:3000
      - SPACETIMEDB_DATABASE=bitcraft
      - SPACETIMEDB_TOKEN=${SPACETIMEDB_TOKEN}
    depends_on:
      bitcraft-server:
        condition: service_healthy
```

**Setting the authentication token:**

For MVP, use an admin token (full permissions):

```bash
# Generate admin token from SpacetimeDB (one-time setup)
spacetime token create admin-token --identity admin

# Add to .env file
echo "SPACETIMEDB_TOKEN=<token_here>" >> .env

# Restart Crosstown to pick up new token
docker compose restart crosstown-node
```

**SECURITY WARNING:** The admin token has full SpacetimeDB permissions (all reducers, all tables). This is overly permissive for production deployments. Future work (Epic 6) will create a service account with reducer-only permissions.

**Expected log output (BLS handler enabled):**

```
[INFO] BLS: Initializing game action handler
  spacetimedb_url: http://bitcraft-server:3000
  database: bitcraft
  token: <redacted>

[INFO] BLS: Action succeeded
  eventId: a1b2c3d4e5f6...
  pubkey: 32e1827635450ebb...
  reducer: player_move
  args: [{"x":100,"z":200},{"x":110,"z":200},false]
  duration: 42ms

[ERROR] BLS: Action failed
  eventId: a1b2c3d4e5f6...
  pubkey: 32e1827635450ebb...
  reducer: nonexistent_reducer
  errorCode: UNKNOWN_REDUCER
  message: Reducer 'nonexistent_reducer' not found in SpacetimeDB (404 Not Found)
  duration: 15ms
```

**Integration contract reference:**

See [docs/bls-handler-contract.md](../docs/bls-handler-contract.md) for the complete integration contract between Sigil SDK and Crosstown BLS handler, including:

- Event format (kind 30078 structure)
- Signature validation requirements (NIP-01)
- Content parsing requirements
- SpacetimeDB HTTP API contract
- Error response format and error codes
- Performance and logging requirements

**Implementation specification reference:**

See [docs/crosstown-bls-implementation-spec.md](../docs/crosstown-bls-implementation-spec.md) for detailed implementation requirements for the Crosstown BLS handler team

## Smoke Tests

Run the smoke test suite to verify the stack is working:

```bash
./tests/smoke-test.sh
```

Tests include:

1. Prerequisites check (curl, jq, websocat, spacetime CLI)
2. Service health checks (both services healthy within 60s)
3. SpacetimeDB HTTP endpoint (database info)
4. Crosstown HTTP endpoint (health check)
5. Crosstown Nostr relay WebSocket (REQ/EOSE)
6. SpacetimeDB WebSocket subscription (via spacetime CLI)
7. Service dependency order (Crosstown depends on BitCraft)
8. Development override file (debug ports)
9. Volume persistence (data volumes configured)
10. Cross-platform compatibility (current platform)
11. BitCraft module validation (module loaded)
12. Crosstown BLS stub logging (kind 30078 events)

**Note**: Some tests may be skipped if the real BitCraft WASM module is not loaded (placeholder only).

## Common Operations

### View Logs

```bash
# All services
docker compose logs

# Follow logs in real-time
docker compose logs -f

# Specific service
docker compose logs bitcraft-server
docker compose logs crosstown-node
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart bitcraft-server
docker compose restart crosstown-node
```

### Stop Services

```bash
# Stop (preserves volumes)
docker compose stop

# Stop and remove containers (preserves volumes)
docker compose down

# Stop and remove containers AND volumes (WARNING: deletes all data)
docker compose down -v
```

### Rebuild Containers

```bash
# Rebuild all
docker compose up --build

# Rebuild specific service
docker compose up --build bitcraft-server
```

### Reset Development Environment

Completely reset the environment (destroys all data):

```bash
./scripts/reset-dev-env.sh
```

This script:

1. Stops all containers
2. Removes all volumes (deletes all game data)
3. Rebuilds containers from scratch
4. Starts the stack

## Troubleshooting

### Port Conflicts

If ports are already in use, modify `.env`:

```bash
BITCRAFT_PORT=3100
CROSSTOWN_NOSTR_PORT=4140
CROSSTOWN_HTTP_PORT=4141
```

### Permission Issues (Linux)

On Linux, volume mounts may have permission issues. The containers run as non-root users:

- BitCraft: UID 1000 (user: `spacetime` from base image)
- Crosstown: UID 1000 (user: `crosstown`)

**Why this happens:**
- Docker on Linux mounts volumes with the host filesystem directly
- If your host user has a different UID (e.g., 1001), the container cannot write to the volume
- macOS Docker Desktop handles this automatically with osxfs, so macOS users don't see this issue

**Fix permissions:**

```bash
# From docker/ directory
sudo chown -R 1000:1000 volumes/spacetimedb
sudo chown -R 1000:1000 volumes/crosstown

# Restart services
docker compose restart
```

**Alternative (change volume directory ownership to your user):**

```bash
# If you want the volumes owned by your user on the host
sudo chown -R $USER:$USER volumes/

# Then modify Dockerfile to run as your UID (advanced, not recommended)
```

**Note:** This is a Linux-only issue. macOS and Windows Docker Desktop handle permissions transparently.

### Healthcheck Failures

Check logs for errors:

```bash
docker compose logs bitcraft-server
docker compose logs crosstown-node
```

Common issues:

- **BitCraft**: WASM module missing or invalid (check `bitcraft.wasm` exists and >100KB)
- **Crosstown**: Build failed (check Rust source in `crosstown-src/`)

### BitCraft Module Not Found

If you see `ERROR: BitCraft WASM module not found`:

1. Ensure `docker/bitcraft/bitcraft.wasm` exists (not just `.placeholder`)
2. Verify file size >100KB: `ls -lh docker/bitcraft/bitcraft.wasm`
3. See "Obtain BitCraft WASM Module" section above

### Crosstown Build Fails

If Crosstown build fails:

1. Check build mode in `.env`: `CROSSTOWN_BUILD_MODE=local`
2. Verify `docker/crosstown/crosstown-src/` contains valid Rust crate
3. Check Cargo.toml has `[[bin]] name = "crosstown"`
4. View build logs: `docker compose build crosstown-node`

## Platform Requirements

### macOS

- **macOS 10.15+** (Catalina or later)
- **Docker Desktop 4.0+**
- Supported architectures: Intel (amd64), Apple Silicon (arm64)

### Linux

- **Linux kernel 3.10+**
- **Docker Engine 20.10+**
- **Docker Compose v2** (install via `apt-get install docker-compose-plugin` or download from Docker)
- Supported architecture: amd64

**Note**: Windows and Podman are not officially supported for this story.

## Multi-Architecture Support

Docker images use multi-arch builds supporting:

- `linux/amd64` - macOS Intel, Linux x86_64
- `linux/arm64` - macOS Apple Silicon

No platform-specific flags required. Docker automatically selects the correct image for your platform.

## Next Steps

Once the Docker environment is running:

1. **Story 1.4**: Connect SDK client to SpacetimeDB WebSocket
2. **Story 1.5**: Validate BitCraft module capabilities (reducers, tables)
3. **Story 2.3**: Publish ILP packets to Crosstown Nostr relay
4. **Story 2.5**: Implement full BLS identity propagation (Crosstown → SpacetimeDB)

## CI Integration

**TODO**: Add smoke tests to GitHub Actions workflow (future story)

```yaml
# Example GitHub Actions job
jobs:
  docker-smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start Docker stack
        run: docker compose -f docker/docker-compose.yml up -d
      - name: Run smoke tests
        run: ./docker/tests/smoke-test.sh
      - name: Cleanup
        run: docker compose -f docker/docker-compose.yml down -v
```

## References

- **Epic 1 (Infrastructure)**: `_bmad-output/planning-artifacts/epics.md#Epic 1`
- **Architecture**: `_bmad-output/planning-artifacts/architecture.md`
- **Story 1.1**: Monorepo scaffolding (commit `536f759`)
- **Story 1.2**: Nostr identity (commit `72a7fc3`)
- **SpacetimeDB Docs**: https://spacetimedb.com/docs
- **Nostr NIPs**: https://github.com/nostr-protocol/nips
