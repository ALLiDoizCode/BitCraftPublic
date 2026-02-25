# SpacetimeDB CLI & Deployment Reference

## Table of Contents
- [Installation](#installation)
- [CLI Commands](#cli-commands)
- [Local Development](#local-development)
- [MainCloud Deployment](#maincloud-deployment)
- [Self-Hosting](#self-hosting)
- [HTTP API](#http-api)
- [SQL Reference](#sql-reference)
- [Configuration](#configuration)

## Installation

```bash
# Install SpacetimeDB CLI (Linux/macOS)
curl -sSf https://install.spacetimedb.com | sh

# Windows (PowerShell)
iwr https://windows.spacetimedb.com -useb | iex

# Docker
docker run --rm --pull always -p 3000:3000 clockworklabs/spacetime start

# Verify
spacetime version
```

### Interactive Development
```bash
spacetime dev                               # Auto-rebuild, republish, generate bindings
spacetime dev --template basic-rs           # Create project from template (basic-rs, basic-cs, basic-ts, react-ts)
spacetime dev --client-lang typescript      # Specify client language
spacetime dev --delete-data                 # Handle data on schema changes
spacetime dev --run "npm run dev"           # Custom client dev server command
spacetime dev --server-only                 # Skip client initialization
```

## CLI Commands

### Project Management
```bash
spacetime init --lang <rust|csharp|typescript> --project-path <path> <name>
spacetime build                          # Build module to WASM
spacetime publish <DATABASE_NAME>        # Publish to server
spacetime publish --delete-data <NAME>   # Republish and reset data
spacetime publish -c always <NAME>       # -c / --delete-data: always|on-conflict|never
spacetime publish --break-clients <NAME> # Allow breaking changes
spacetime publish --parent <NAME> <NEW>  # Inherit permissions from existing DB
spacetime delete <NAME>                  # Delete database
spacetime list                           # List your databases
spacetime rename <OLD> <NEW>             # Rename database
```

### Development
```bash
spacetime start                          # Start local server (port 3000)
spacetime dev                            # Interactive dev mode (auto-rebuild)
spacetime build --debug                  # Debug build
spacetime login                          # Authenticate with server
spacetime logout                         # Clear authentication
```

### Database Operations
```bash
spacetime logs <NAME>                    # View module logs
spacetime logs --follow <NAME>           # Stream logs in real-time
spacetime sql <NAME> "SELECT * FROM t"   # Execute SQL query
spacetime sql <NAME> --interactive       # Interactive SQL mode
spacetime sql --anonymous <NAME> "..."   # Query as unprivileged client
spacetime describe <NAME>               # Show database schema
spacetime call <NAME> <reducer> [args]   # Invoke a reducer
spacetime subscribe <NAME> <QUERY>       # Monitor subscription updates
```

### Code Generation
```bash
spacetime generate --lang rust --out-dir <path> --project-path <module-path>
spacetime generate --lang csharp --out-dir <path> --project-path <module-path>
spacetime generate --lang typescript --out-dir <path> --project-path <module-path>
spacetime generate --lang unrealcpp --uproject-dir <path> --project-path <module-path> --module-name <name>
spacetime generate --include-private ...    # Include private tables/functions in bindings
```

### Server Management
```bash
spacetime server add <name> --url <url>  # Add a server
spacetime server list                    # List configured servers
spacetime server set-default <name>      # Set default server
spacetime server ping                    # Test connectivity
spacetime server fingerprint             # Get server fingerprint
```

### Energy
```bash
spacetime energy balance                 # Check energy/budget
```

## Local Development

```bash
# Terminal 1: Start local server
spacetime start

# Terminal 2: Publish module
spacetime publish my-app

# Terminal 3: Watch logs
spacetime logs --follow my-app

# Interactive dev mode (auto-rebuilds on file changes)
spacetime dev
```

Database names must match: `/^[a-z0-9]+(-[a-z0-9]+)*$/` (lowercase, numbers, dashes).

## MainCloud Deployment

```bash
spacetime login
spacetime server set-default maincloud
spacetime publish my-app
```

### MainCloud Details
- **URL:** `https://maincloud.spacetimedb.com`
- **Dashboard:** `https://spacetimedb.com/profile` (metrics, tables, logs, access controls)
- **Pricing:** Free tier: 2,500 TeV/month; Pro: $25/month with 100,000 TeV
- **Database states:** Running (active), Paused (data preserved, zero energy). Free tier auto-pauses after inactivity (~1s resume)
- **Zero-downtime updates:** Module code is hot-swapped without disconnecting clients

## Self-Hosting

### Quick Setup (Ubuntu 24.04)

```bash
# 1. Create system user
sudo mkdir /stdb
sudo useradd --system spacetimedb
sudo chown -R spacetimedb:spacetimedb /stdb

# 2. Install
curl -sSf https://install.spacetimedb.com | sh -s -- --root-dir /stdb --yes

# 3. Create systemd service at /etc/systemd/system/spacetimedb.service
# ExecStart=/stdb/spacetime --root-dir=/stdb start --listen-addr='127.0.0.1:3000'

# 4. Start
sudo systemctl enable spacetimedb
sudo systemctl start spacetimedb

# 5. Add server to CLI
spacetime server add self-hosted --url https://example.com
```

### Nginx Reverse Proxy

Configure Nginx as a reverse proxy to restrict access. By default, expose only `/v1/database/[name]/subscribe` (WebSocket) and `/v1/identity` (required for TypeScript SDK). Optionally enable full publishing, reducer calls, and SQL endpoints.

### HTTPS with Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d example.com
```

### Version Updates
```bash
sudo systemctl stop spacetimedb
spacetime --root-dir=/stdb version upgrade
sudo systemctl start spacetimedb
```

## HTTP API

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/identity` | Request new identity/token |
| POST | `/v1/database` | Publish database |
| POST | `/v1/database/:name/call/:reducer` | Call reducer |
| POST | `/v1/database/:name/sql` | Execute SQL |
| GET | `/v1/database/:name/subscribe` | WebSocket connection |
| GET | `/v1/database/:name/schema` | Fetch schema |
| GET | `/v1/database/:name/logs` | Retrieve logs |
| DELETE | `/v1/database/:name` | Delete database |
| GET | `/v1/ping` | Health check |
| GET | `/v1/database/:name/names` | List database identifiers |
| POST | `/v1/database/:name/names` | Add database name |
| GET | `/v1/database/:name/identity` | Get database identity hex |

### Authentication
```
Authorization: Bearer <token>
```
Tokens are OpenID Connect-compliant JWTs.

### WebSocket Protocols
- Binary: `v1.bsatn.spacetimedb`
- JSON: `v1.json.spacetimedb`

## SQL Reference

### Subscription SQL (real-time replication)
```sql
-- Basic subscription
SELECT * FROM player

-- Filtered subscription
SELECT * FROM player WHERE online = true

-- Join (max 2 tables, join columns must be indexed)
SELECT p.* FROM player p
INNER JOIN team t ON p.team_id = t.id
WHERE t.active = true
```

**Subscription limitations:**
- Only `SELECT *` projections (full rows)
- Max 2-table INNER JOINs
- Join columns must be indexed
- No arithmetic in WHERE clauses
- Operators: `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`, `AND`, `OR`

### Query/DML SQL (CLI and HTTP)
```sql
-- Extended SELECT
SELECT col1, col2 FROM table WHERE condition LIMIT 100

-- INSERT
INSERT INTO player (username, score) VALUES ('Alice', 0)

-- UPDATE
UPDATE player SET score = 100 WHERE username = 'Alice'

-- DELETE
DELETE FROM player WHERE score < 0

-- System variables
SET row_limit = 10000
SHOW row_limit
```

**Identifiers** are case-sensitive. Use double quotes for reserved words.

**Literals:** `true`/`false`, integers with optional scientific notation, floats, single-quoted strings, hex: `X'...'` or `0x...`

## Configuration

### Local Config (config.toml)
Located at `~/.local/share/spacetime/data/config.toml` (Linux/macOS).
Windows: `%LOCALAPPDATA%\SpacetimeDB\data\config.toml`

```toml
[certificate-authority]
jwt-priv-key-path = "/path/to/key"
jwt-pub-key-path = "/path/to/key.pub"

[logs]
level = "info"
directives = ["spacetimedb=warn"]

[websocket]
ping-interval = "15s"
idle-timeout = "30s"
close-handshake-timeout = "250ms"
incoming-queue-length = 2048
```
