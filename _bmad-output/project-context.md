# Sigil Project Context

**Generated:** 2026-03-13
**Status:** Epic 3 In-Progress (0/4 stories), Epics 1-2 Complete (11/11 stories)
**Phase:** MVP Development (Epics 1-2 delivered, Epics 3-8 remaining)

---

## Executive Summary

**Sigil** is an SDK platform for building AI agents and terminal clients that interact with SpacetimeDB-based game worlds. The platform features a pure TypeScript client library (`@sigil/client`), MCP server wrapper for AI agents (`@sigil/mcp-server`), JSON-RPC IPC backend for terminal UIs (`@sigil/tui-backend`), and a Rust-based ratatui TUI (`sigil-tui`).

**Current Status:**

- **Epic 1 (Project Foundation):** COMPLETE - 6/6 stories delivered
- **Epic 2 (Action Execution & Payment Pipeline):** COMPLETE - 5/5 stories delivered
- **Epic 3 (BitCraft BLS Game Action Handler):** IN-PROGRESS - 0/4 stories, fully sequential: 3.1 -> 3.2 -> 3.3 -> 3.4
- **Total Tests:** 748 passing (643 TypeScript + 98 root integration + 7 Rust), 132 skipped (require Docker)
- **Code Quality:** OWASP Top 10 compliant across all stories, lint baseline clean
- **Infrastructure:** Full publish pipeline operational via `@crosstown/client` adapter

**Epic 3 Focus:**
Epic 3 is the **first server-side component** -- a Crosstown BLS node (`packages/bitcraft-bls/`) that receives ILP packets, validates Nostr signatures, and forwards game actions to SpacetimeDB with identity propagation. High risk due to new infrastructure pattern, external SDK dependency (`@crosstown/sdk@^0.1.4`), and Docker networking requirements.

---

## Project Overview

### What is Sigil?

Sigil is the brand name for the SDK/platform that enables:

1. **AI Agents** to play SpacetimeDB games via MCP tools and Claude/Vercel AI SDK integration
2. **Human Players** to interact with games via a terminal UI (TUI) built with ratatui
3. **Researchers** to run multi-agent experiments and comparative decision analysis

**BitCraft** refers ONLY to the v1 game world (Apache 2.0 fork). BitCraft reducers WILL be modified to accept `identity: String` as first parameter for identity propagation (decided in Story 2.4, BLOCKER-1).

### Brand & Package Naming

- **npm scope:** `@sigil/*`
  - `@sigil/client` - Core TypeScript library (engine, no CLI, no process management)
  - `@sigil/mcp-server` - MCP protocol wrapper over client (for AI agents, future)
  - `@sigil/tui-backend` - JSON-RPC IPC wrapper over client (for Rust TUI, future)
- **Crosstown SDK packages (workspace):**
  - `@crosstown/client` - ILP client: signing, TOON encoding, payment channels, transport (v0.4.2)
  - `@crosstown/relay` - TOON encoding/decoding for Nostr events (v0.4.2)
- **Rust crate:** `sigil-tui` - Terminal user interface using ratatui
- **MCP resource URIs:** `sigil://players/{id}`, `sigil://planets/{id}`

### Architecture Principles

1. **Single Polyglot Monorepo:** TypeScript (pnpm workspace) + Rust (cargo workspace)
2. **Pure Client Library:** `@sigil/client` is a pure engine library with no CLI or process management
3. **Single Write Path:** `client.publish()` -> content-only ILP template -> CrosstownAdapter -> `@crosstown/client` (signs, TOON-encodes, ILP-routes) -> BLS -> SpacetimeDB
4. **Nostr-Only Identity:** Nostr keypair (secp256k1) is the ONLY identity mechanism (no OAuth, no passwords)
5. **TUI Architecture:** Rust (ratatui) presentation layer + TypeScript backend via JSON-RPC IPC
6. **Agent Model:** Claude instance with CLAUDE.md + Skills + MCP tools (NOT custom cognition stack)

---

## Repository Structure

```
BitCraftPublic/
├── packages/                    # TypeScript workspace (pnpm)
│   ├── client/                  # @sigil/client - Core SDK
│   │   ├── src/
│   │   │   ├── client.ts        # Main SigilClient class (Epic 1 + Epic 2)
│   │   │   ├── index.ts         # Public API exports
│   │   │   ├── nostr/           # Nostr identity & relay client
│   │   │   │   ├── keypair.ts          # Key generation, import, export (Story 1.2)
│   │   │   │   ├── storage.ts          # Encrypted key storage (Story 1.2)
│   │   │   │   ├── nostr-client.ts     # NIP-01 relay client (Story 2.1)
│   │   │   │   ├── types.ts            # Nostr event types, filters (Story 2.1)
│   │   │   │   └── test-utils/         # Test fixtures
│   │   │   ├── spacetimedb/     # SpacetimeDB integration
│   │   │   │   ├── connection.ts
│   │   │   │   ├── tables.ts
│   │   │   │   ├── subscriptions.ts
│   │   │   │   ├── static-data-loader.ts
│   │   │   │   ├── static-data-tables.ts
│   │   │   │   ├── reconnection-manager.ts
│   │   │   │   ├── reconnection-types.ts
│   │   │   │   ├── latency.ts
│   │   │   │   ├── generated/   # SpacetimeDB generated types
│   │   │   │   └── __tests__/   # 16 test files
│   │   │   ├── crosstown/       # Crosstown client adapter (Story 2.5)
│   │   │   │   ├── crosstown-adapter.ts    # Wraps @crosstown/client
│   │   │   │   └── crosstown-adapter.test.ts
│   │   │   ├── publish/         # Action execution pipeline (Stories 2.2-2.5)
│   │   │   │   ├── action-cost-registry.ts # JSON-based cost lookup (Story 2.2)
│   │   │   │   ├── ilp-packet.ts           # Content-only ILP templates (Story 2.3, simplified in 2.5)
│   │   │   │   └── *.test.ts               # 6 test files
│   │   │   ├── wallet/          # Wallet balance client (Story 2.2)
│   │   │   │   ├── wallet-client.ts        # HTTP balance queries + stub mode
│   │   │   │   └── wallet-client.test.ts
│   │   │   ├── bls/             # BLS handler types (Story 2.4)
│   │   │   │   ├── types.ts               # BLSErrorCode, BLSResponse types
│   │   │   │   ├── types.test.ts
│   │   │   │   └── contract-validation.test.ts
│   │   │   ├── errors/          # Error code documentation
│   │   │   │   └── error-codes.md
│   │   │   ├── __tests__/       # Cross-module tests + factories
│   │   │   │   ├── factories/   # Test data factories
│   │   │   │   │   ├── bls-error.factory.ts
│   │   │   │   │   └── nostr-event.factory.ts
│   │   │   │   └── integration/
│   │   │   │       └── wallet-balance.test.ts
│   │   │   └── integration-tests/    # Docker-dependent integration tests
│   │   │       ├── bls-handler.integration.test.ts
│   │   │       └── crosstown-adapter.integration.test.ts
│   │   ├── config/
│   │   │   └── default-action-costs.json  # Default action cost registry
│   │   └── package.json         # 26 source + 36 test files
│   │
│   ├── crosstown-client/        # @crosstown/client v0.4.2 (Story 2.5)
│   │   └── src/
│   │       └── index.ts         # CrosstownClient, signing, TOON, transport
│   │
│   ├── crosstown-relay/         # @crosstown/relay v0.4.2 (Story 2.5)
│   │   └── src/
│   │       └── index.ts         # encodeEventToToon, decodeEventFromToon
│   │
│   ├── mcp-server/              # @sigil/mcp-server (future Epic 6)
│   │   └── src/
│   │       └── index.ts         # Minimal placeholder
│   │
│   └── tui-backend/             # @sigil/tui-backend (future Epic 7)
│       └── src/
│           └── index.ts         # Minimal placeholder
│
├── crates/                      # Rust workspace (cargo)
│   └── tui/                     # sigil-tui
│       ├── src/
│       │   └── main.rs          # Minimal placeholder
│       └── Cargo.toml
│
├── docker/                      # Local development environment
│   ├── bitcraft/                # BitCraft SpacetimeDB server
│   ├── crosstown/               # Crosstown ILP relay node
│   ├── scripts/                 # Setup and health check scripts
│   ├── tests/                   # Docker stack integration tests
│   ├── volumes/                 # Persistent data volumes
│   ├── docker-compose.yml       # Main stack (BitCraft + Crosstown)
│   ├── docker-compose.dev.yml   # Dev overrides
│   └── README.md                # Setup and usage docs
│
├── scripts/                     # Utility scripts
│   └── bls-handler-smoke-test.ts  # BLS handler smoke test (Story 2.4)
│
├── docs/                        # Developer documentation
│   ├── bls-handler-contract.md    # BLS integration contract (Story 2.4)
│   ├── crosstown-bls-implementation-spec.md  # Crosstown BLS spec (Story 2.4)
│   ├── architecture.md
│   ├── data-models.md
│   ├── development-guide.md
│   ├── project-overview.md
│   └── source-tree-analysis.md
│
├── BitCraftServer/              # Upstream BitCraft server (Apache 2.0)
│   └── packages/
│       ├── global_module/       # SpacetimeDB global module
│       └── game/                # BitCraft game logic
│
├── _bmad-output/                # BMAD workflow artifacts
│   ├── planning-artifacts/
│   │   ├── epics.md             # 13 epics, 61 stories
│   │   ├── test-design-epic-3.md # Epic 3 test design (~268 planned tests)
│   │   ├── architecture/        # 22 architecture docs
│   │   ├── prd/                 # Product requirements
│   │   ├── ux-design-specification.md
│   │   └── archive/             # Historical planning docs
│   ├── implementation-artifacts/
│   │   ├── sprint-status.yaml   # Epic/story tracking
│   │   ├── epic-1-retro-2026-02-27.md
│   │   ├── 1-{1-6}-*.md         # 6 Epic 1 story reports
│   │   ├── 2-{1-5}-*.md         # 5 Epic 2 story reports
│   │   ├── adr/                 # Architecture Decision Records (4)
│   │   ├── reports/             # Test architecture traceability
│   │   └── test-reviews/        # Test review reports
│   ├── auto-bmad-artifacts/
│   │   ├── epic-2-end-report.md       # Epic 2 completion report
│   │   ├── epic-2-retro-2026-03-13.md # Epic 2 retrospective
│   │   ├── epic-3-start-report.md     # Epic 3 start report
│   │   └── story-2-5-report.md        # Story 2.5 report
│   └── test-reports/            # Test execution reports
│
├── package.json                 # Root monorepo config (pnpm)
├── Cargo.toml                   # Rust workspace config
├── tsconfig.base.json           # TypeScript base config
├── vitest.config.ts             # Root integration test config
└── README.md                    # BitCraft server README (upstream)
```

---

## Technology Stack

### Core Technologies

- **Runtime:** Node.js >=20.0.0
- **Package Manager:** pnpm >=9.0.0
- **TypeScript:** 5.2+ (strict mode, ES2022 target, ESNext module, bundler moduleResolution)
- **Rust:** 1.70+ (2021 edition)

### TypeScript Dependencies

**`@sigil/client`:**

- `@clockworklabs/spacetimedb-sdk` ^1.3.3 (SpacetimeDB 2.0 client, targets 1.6.x servers)
- `@crosstown/client` workspace:^0.4.2 (ILP signing, TOON encoding, transport)
- `@crosstown/relay` workspace:^0.4.2 (TOON encoding/decoding for Nostr events)
- `nostr-tools` ^2.23.0 (Nostr keypair, signing, NIP-19 encoding)
- `@noble/hashes` ^1.6.1 (SHA256, hex conversion utilities)
- `@scure/bip39` ^1.6.0 (BIP-39 mnemonic seed phrases)
- `ws` ^8.18.0 (WebSocket client for Nostr relay)

**`@crosstown/client` v0.4.2:**

- `nostr-tools` ^2.23.0 (Nostr event signing via finalizeEvent)
- `@noble/hashes` ^1.6.1 (public key derivation)

**Testing & Build:**

- `vitest` latest (unit & integration testing)
- `@vitest/coverage-v8` ^4.0.18 (code coverage)
- `tsup` latest (TypeScript bundler)

### Rust Dependencies

**`sigil-tui`:**

- `ratatui` 0.30 (terminal UI framework)
- `crossterm` 0.29.0 (cross-platform terminal manipulation)
- `tokio` 1.x (async runtime, features: rt, time, macros, sync)
- `serde` 1.x (serialization, derive macros)
- `serde_json` 1.x (JSON-RPC protocol)

### Development Environment

**Docker Stack (Story 1.3):**

- `bitcraft-server` - SpacetimeDB 1.6.x server running BitCraft game module
  - Port: 3000 (localhost-only)
  - Volumes: `./docker/volumes/spacetimedb`
  - Health checks, resource limits, logging
- `crosstown-node` - Crosstown ILP relay with built-in Nostr relay
  - Ports: 4040 (Nostr), 4041 (HTTP)
  - Volumes: `./docker/volumes/crosstown`
  - Depends on: `bitcraft-server`

**CI/CD:**

- GitHub Actions workflows (`ci-typescript.yml`, `ci-rust.yml`)
- TypeScript CI: Ubuntu + macOS matrix, lint, typecheck, unit tests, build, integration tests with Docker
- Rust CI: Ubuntu + macOS matrix, format check, clippy, test, build

---

## Key Architecture Decisions

### 1. Client API Design (Updated Epic 2)

```typescript
const client = new SigilClient({
  spacetimedb: { url: 'ws://localhost:3000', databaseName: 'bitcraft' },
  autoLoadStaticData: true,
  reconnection: { maxRetries: 5, baseDelay: 1000 },
  nostrRelay: { url: 'ws://localhost:4040' },           // Story 2.1
  actionCostRegistryPath: './config/default-action-costs.json', // Story 2.2
  crosstownConnectorUrl: 'http://localhost:4041',        // Story 2.3-2.5
  btpEndpoint: 'ws://localhost:3000',                    // Story 2.5
  publishTimeout: 2000,                                  // Story 2.3-2.5
});

// Identity Management (Story 1.2)
await client.loadIdentity('passphrase', '/path/to/keypair.json');
console.log(client.identity.publicKey.npub); // npub1abc...
const signedEvent = await client.identity.sign(eventTemplate);

// SpacetimeDB Read Access (Story 1.4)
client.spacetimedb.tables.players.onInsert((player) => { ... });
const allPlayers = client.spacetimedb.tables.players.getAll();

// Static Data Loading (Story 1.5)
const staticData = await client.spacetimedb.staticData.load();
console.log(staticData.itemDesc.get(itemId));

// Nostr Relay (Story 2.1)
client.nostr.subscribe([{ kinds: [30078] }], (event) => { ... });
client.on('actionConfirmed', (confirmation) => { ... });

// Action Cost Queries (Story 2.2)
const cost = client.publish.getCost('player_move');    // Returns 1
const canAfford = await client.publish.canAfford('player_move'); // true/false
const balance = await client.wallet.getBalance();      // Returns 10000

// Publish Game Action (Story 2.3-2.5)
const result = await client.publish.publish({
  reducer: 'player_move',
  args: [100, 200],
});
// result: { eventId, reducer, args, fee, pubkey, timestamp }
```

### 2. Publish Pipeline Architecture (Epic 2 - Finalized in Story 2.5)

**Flow:**

1. `client.publish.publish({ reducer, args })` called
2. Validate client state (identity, CrosstownAdapter, cost registry)
3. Look up action cost from registry
4. Check wallet balance (fail fast if insufficient)
5. Construct content-only ILP packet template (kind 30078, no pubkey/sig)
6. Submit to `CrosstownAdapter.publishEvent()` which delegates to `@crosstown/client`
7. `@crosstown/client` signs event (adds pubkey, created_at, id, sig), TOON-encodes, ILP-routes
8. Wait for confirmation event via Nostr relay subscription
9. Return confirmation details

**Key Design Decision:** Sigil client owns only event CONTENT construction. All signing, TOON encoding, payment channel management, and transport are delegated to `@crosstown/client`. This clean separation means the Sigil SDK never handles signing directly in the publish path.

### 3. SpacetimeDB 2.0 SDK on 1.6.x Servers

**Decision:** Use SpacetimeDB 2.0 SDK (`@clockworklabs/spacetimedb-sdk` ^1.3.3) to connect to 1.6.x server modules.
**Status:** VALIDATED - No compatibility issues found in Epic 1 and Epic 2 testing.

### 4. Nostr Keypair as Sole Identity

**Decision:** Nostr keypair (secp256k1) is the ONLY identity mechanism. Private key NEVER exposed via client API.
**Status:** COMPLETE in Story 1.2, identity propagation architecture defined in Story 2.4.

### 5. BLS Handler Integration Contract (Story 2.4)

**Key Architectural Decisions:**

- BitCraft reducers WILL be modified to accept `identity: String` as first parameter (~358 reducers)
- Wallet balance checks and ILP fee deduction are OUT OF SCOPE (EVM onchain wallets)
- BLS handler validates Nostr signatures, extracts pubkey, prepends to reducer args
- BLS handler exposes `POST /handle-packet` endpoint receiving ILP packets from Crosstown connector
- Identity is passed as hex pubkey (64-char hex string), NOT npub format
  **Status:** Contract spec'd and validated. Implementation in Epic 3.

### 6. @crosstown/client Integration (Story 2.5)

**What was removed (scaffolding):**

- `event-signing.ts` (signing delegated to `@crosstown/client`)
- `crosstown-connector.ts` (transport delegated to `@crosstown/client`)

**What was added:**

- `CrosstownAdapter` wrapping `@crosstown/client` with SSRF protection and error mapping
- `@crosstown/relay` for TOON encoding/decoding
- `ilp-packet.ts` simplified to content-only templates (no pubkey, no signing)

**Status:** COMPLETE - All scaffolding removed, adapter operational.

---

## Epic Breakdown & Progress

### Epic Inventory (13 epics, 61 stories)

**MVP (Epics 1-8):** 45 stories

- Epic 1: Project Foundation & Game World Connection (6 stories) - **COMPLETE**
- Epic 2: Action Execution & Payment Pipeline (5 stories) - **COMPLETE**
- Epic 3: BitCraft BLS Game Action Handler (4 stories) - **IN-PROGRESS**
- Epic 4: Declarative Agent Configuration (7 stories) - Backlog
- Epic 5: BitCraft Game Analysis & Playability Validation (8 stories) - Backlog
- Epic 6: MCP Server for AI Agents (4 stories) - Backlog
- Epic 7: Terminal Game Client (9 stories) - Backlog
- Epic 8: Infrastructure & Observability (2 stories) - Backlog

**Phase 2 (Epics 9-12):** 15 stories

- Epic 9: Advanced Agent Intelligence (4 stories) - Backlog
- Epic 10: TUI Advanced Gameplay (5 stories) - Backlog
- Epic 11: Experiment Harness & Multi-Agent Research (4 stories) - Backlog
- Epic 12: World Extensibility (2 stories) - Backlog

**Phase 3 (Epic 13):** 1 story

- Epic 13: Platform Expansion (1 story) - Backlog

### Epic 1: Project Foundation & Game World Connection

**Status:** COMPLETE (2026-02-27)
**Stories:** 6/6 delivered
**Acceptance Criteria:** 29/29 met (100%)

| Story | Title                                        | Status |
| ----- | -------------------------------------------- | ------ |
| 1.1   | Monorepo Scaffolding & Build Infrastructure  | Done   |
| 1.2   | Nostr Identity Management                    | Done   |
| 1.3   | Docker Local Development Environment         | Done   |
| 1.4   | SpacetimeDB Connection & Table Subscriptions | Done   |
| 1.5   | Static Data Table Loading                    | Done   |
| 1.6   | Auto-Reconnection & State Recovery           | Done   |

### Epic 2: Action Execution & Payment Pipeline

**Status:** COMPLETE (2026-03-13)
**Stories:** 5/5 delivered (2 stories descoped to Epic 3)
**Acceptance Criteria:** 36/36 met (100%)

| Story | Title                                               | Status |
| ----- | --------------------------------------------------- | ------ |
| 2.1   | Crosstown Relay Connection & Event Subscriptions    | Done   |
| 2.2   | Action Cost Registry & Wallet Balance               | Done   |
| 2.3   | ILP Packet Construction & Signing                   | Done   |
| 2.4   | BLS Game Action Handler (contract spec)             | Done   |
| 2.5   | @crosstown/client Integration & Scaffolding Removal | Done   |

**Epic 2 Scope Changes:**

- Stories 2.6 (Identity Propagation) and 2.7 (ILP Fee Collection) REMOVED from Epic 2, moved to Epic 3
- Story 2.5 title changed to "@crosstown/client Integration & Scaffolding Removal"

### Epic 3: BitCraft BLS Game Action Handler (CURRENT)

**Status:** IN-PROGRESS (started 2026-03-13)
**Stories:** 0/4 completed
**Dependencies:** Epic 2 complete (dependency met)
**Story Order:** 3.1 -> 3.2 -> 3.3 -> 3.4 (fully sequential)
**Test Plan:** ~268 tests planned (155 unit + 113 integration)

| Story | Title                                          | ACs | Status  |
| ----- | ---------------------------------------------- | --- | ------- |
| 3.1   | BLS Package Setup & Crosstown SDK Node         | 5   | Backlog |
| 3.2   | Game Action Handler (kind 30078)               | 5   | Backlog |
| 3.3   | Pricing Configuration & Fee Schedule           | 5   | Backlog |
| 3.4   | Identity Propagation & End-to-End Verification | 5   | Backlog |

**Risk Assessment:**

- **R3-001 (CRITICAL):** `@crosstown/sdk@^0.1.4` API compatibility -- pre-1.0, limited docs
- **R3-002 (HIGH):** Docker networking -- BLS container must reach SpacetimeDB container
- **R3-003 (HIGH):** SpacetimeDB HTTP API response format assumptions
- **R3-004 (HIGH):** Identity propagation correctness (hex pubkey format)
- **R3-005 (HIGH):** ILP error code mapping (F04, F06, T00, F00)
- **R3-008 (HIGH):** BitCraft reducer identity parameter acceptance (~358 reducers to modify)

**New Package:** `packages/bitcraft-bls/` -- first server-side component
**New Docker Service:** BLS handler container (third service alongside bitcraft-server and crosstown-node)
**Key Spec:** `docs/crosstown-bls-implementation-spec.md` (detailed implementation spec from Story 2.4)

---

## Testing & Quality Metrics

### Test Coverage (as of Epic 3 start)

**Total Tests:** 748 passing, 132 skipped (Docker-dependent)

- **TypeScript Client:** 641 passed, 103 skipped (29 test files)
- **TypeScript MCP Server:** 1 passed (placeholder)
- **TypeScript TUI Backend:** 1 passed (placeholder)
- **Root Integration Tests:** 98 passed, 29 skipped (2 test files)
- **Rust Unit Tests:** 7 passed

### Test Architecture Traceability

All stories include comprehensive traceability reports linking:

- Functional Requirements (FRs) -> Acceptance Criteria (ACs) -> Test Cases

**Reports:**

- `_bmad-output/implementation-artifacts/reports/2-3-testarch-trace-report.md`
- `_bmad-output/implementation-artifacts/reports/2-5-testarch-trace-report.md`
- `_bmad-output/implementation-artifacts/2-1-test-architecture-traceability.md`
- `_bmad-output/implementation-artifacts/2-2-test-architecture-traceability.md`
- `_bmad-output/test-artifacts/atdd-checklist-2-5.md`
- `_bmad-output/test-artifacts/nfr-assessment-story-2-5.md`

### Code Quality & Security

- OWASP Top 10 compliance validated on all stories
- Semgrep security scanning (5 issues found and fixed in Epic 2)
- SSRF protection on Crosstown connector URL, BTP endpoint, and wallet balance client
- Private key never logged, never in error messages
- Embedded credentials rejected in connector URLs
- Input validation on reducer names (alphanumeric + underscore, 1-64 chars)

### Test Execution

```bash
# Unit Tests (fast, no Docker)
pnpm --filter @sigil/client test:unit    # 641 tests
pnpm --filter @sigil/client test:watch   # TDD watch mode

# All workspace tests
pnpm test                                # All TS packages

# Integration Tests (require Docker)
docker compose -f docker/docker-compose.yml up -d
pnpm test:integration                    # Root integration tests
pnpm --filter @sigil/client test:integration  # Client integration tests
docker compose -f docker/docker-compose.yml down

# BLS Smoke Test
pnpm smoke:bls  # Quick BLS handler validation (requires Docker + BLS handler)

# Rust
cd crates/tui && cargo test              # 7 tests
cd crates/tui && cargo clippy            # Lint
```

---

## Known Issues & Technical Debt

### Medium Priority

**DEBT-2: Load Remaining 108 Static Data Tables**

- Story 1.5 loaded 40/148 static data tables. Remaining 108 needed for full game state coverage.
- May block Epic 4-5 if agent skills require missing tables.

**DEBT-5: Wallet Balance Stub Mode**

- WalletClient falls back to stub mode (fixed balance 10000) when Crosstown balance API returns 404/501.
- WalletClient.enableStubMode() / disableStubMode() for explicit control. SIGIL_WALLET_STUB=true env var.

**DEBT-6: EVM Address Derivation is Placeholder**

- CrosstownAdapter.getEvmAddress() returns truncated Nostr pubkey as placeholder.
- No current consumer uses EVM addresses. Doesn't block Epic 3.

### Low Priority

**DEBT-4: Improve Docker Test Stability**

- Integration tests fail when Docker is not running. Auto-skip works but could be improved.

### Resolved

- **DEBT-1: Complete Story 1.6 Subscription Recovery** - RESOLVED in Epic 2 prep (PREP-1)
- **DEBT-3: Add Linux Integration Test Coverage** - RESOLVED in Epic 2 prep (PREP-2)

### Epic 3 Prep Items (from Epic 2 Retro)

| #           | Item                                                  | Priority | Status                        |
| ----------- | ----------------------------------------------------- | -------- | ----------------------------- |
| PREP-E3-1   | Modify BitCraft reducers for identity parameter       | Critical | Deferred to Epic 3 story work |
| PREP-E3-2   | Validate @crosstown/sdk API for BLS node creation     | Critical | Deferred to Story 3.1 spike   |
| PREP-E3-3   | Replace @crosstown workspace stubs with real packages | Critical | N/A -- stubs are functional   |
| PREP-E3-4   | Implement getEvmAddress() properly                    | Critical | N/A -- doesn't block Epic 3   |
| ACTION-E2-1 | Contract test pattern for external deps               | High     | Deferred                      |
| ACTION-E2-2 | Tracking issue for 103 skipped integration tests      | High     | Deferred                      |

---

## Development Workflow

### Getting Started

**Prerequisites:**

- Node.js >=20.0.0
- pnpm >=9.0.0
- Rust 1.70+ (for TUI development)
- Docker Desktop (for integration tests)

**Setup:**

```bash
cd /Users/jonathangreen/Documents/BitCraftPublic
pnpm install
pnpm build
pnpm --filter @sigil/client test:unit
```

### Docker Stack Management

```bash
docker compose -f docker/docker-compose.yml up -d       # Start
docker compose -f docker/docker-compose.yml ps           # Status
docker compose -f docker/docker-compose.yml logs -f bitcraft-server  # Logs
docker compose -f docker/docker-compose.yml restart      # Restart
docker compose -f docker/docker-compose.yml down -v && rm -rf docker/volumes/* && docker compose -f docker/docker-compose.yml up -d  # Full reset
```

### CI/CD

- `.github/workflows/ci-typescript.yml` - TypeScript lint, typecheck, unit tests, build (Ubuntu + macOS), integration tests with Docker
- `.github/workflows/ci-rust.yml` - Rust format, clippy, test, build (Ubuntu + macOS)

**Branch Strategy:**

- `master` - Main development branch (stable)
- `epic-X` - Epic-specific feature branches (currently: `epic-2`, working on Epic 3)
- PRs merge to `master` after review

---

## Documentation Index

### Planning Artifacts

- `_bmad-output/planning-artifacts/epics.md` - Epic breakdown (13 epics, 61 stories)
- `_bmad-output/planning-artifacts/test-design-epic-3.md` - Epic 3 test design (~268 tests)
- `_bmad-output/planning-artifacts/architecture/index.md` - Architecture overview (22 docs)
- `_bmad-output/planning-artifacts/prd/index.md` - Product requirements
- `_bmad-output/planning-artifacts/ux-design-specification.md` - UX design

### Implementation Artifacts

**Epic 1 Story Reports:**

- `1-1-monorepo-scaffolding-and-build-infrastructure.md`
- `1-2-nostr-identity-management.md`
- `1-3-docker-local-development-environment.md`
- `1-4-spacetimedb-connection-and-table-subscriptions.md`
- `1-5-static-data-table-loading.md`
- `1-6-auto-reconnection-and-state-recovery.md`

**Epic 2 Story Reports:**

- `2-1-crosstown-relay-connection-and-event-subscriptions.md`
- `2-2-action-cost-registry-and-wallet-balance.md`
- `2-3-ilp-packet-construction-and-signing.md`
- `2-4-bls-game-action-handler.md`
- `2-5-crosstown-client-integration.md`

**Retrospectives:**

- `epic-1-retro-2026-02-27.md` - Epic 1 retrospective
- `auto-bmad-artifacts/epic-2-retro-2026-03-13.md` - Epic 2 retrospective

**Architecture Decision Records:**

- `adr/adr-001-spacetimedb-sdk-version.md`
- `adr/adr-002-nostr-only-identity.md`
- `adr/adr-003-polyglot-monorepo.md`
- `adr/adr-004-docker-dev-stack.md`

**Auto-BMAD Artifacts:**

- `auto-bmad-artifacts/epic-2-end-report.md` - Epic 2 completion report
- `auto-bmad-artifacts/epic-2-retro-2026-03-13.md` - Epic 2 retrospective
- `auto-bmad-artifacts/epic-3-start-report.md` - Epic 3 start report
- `auto-bmad-artifacts/story-2-5-report.md` - Story 2.5 report

**Test Architecture:**

- `reports/2-3-testarch-trace-report.md`
- `reports/2-5-testarch-trace-report.md`
- `2-1-test-architecture-traceability.md`
- `2-2-test-architecture-traceability.md`
- `test-artifacts/atdd-checklist-2-5.md`
- `test-artifacts/nfr-assessment-story-2-5.md`

**Status Tracking:**

- `sprint-status.yaml` - Epic/story status (updated 2026-03-13)

### Developer Documentation

- `docs/bls-handler-contract.md` - BLS integration contract
- `docs/crosstown-bls-implementation-spec.md` - Crosstown BLS implementation spec (v2.0)
- `docs/architecture.md` - Architecture overview
- `docs/data-models.md` - Data models
- `docs/development-guide.md` - Development guide
- `docker/README.md` - Docker stack setup and troubleshooting

---

## BMAD Workflow State

### Current Phase

**Phase:** MVP Implementation (Epics 1-2 complete, Epic 3 in progress)
**Module:** bmm (Business Model & Management)
**Sprint Focus:** Epic 3 - BitCraft BLS Game Action Handler

### Workflow Steps Completed

1. Architecture Definition - 22 architecture documents, validated against requirements
2. Epic Breakdown - 13 epics, 61 stories, all 50 FRs covered
3. Epic 1 Implementation - 6 stories delivered
4. Epic 1 Retrospective - Lessons learned, action items, prep tasks defined
5. Epic 2 Preparation - PREP-1, PREP-2, PREP-4, PREP-5, ACTION-1 completed
6. Epic 2 Implementation - 5 stories delivered
7. Epic 2 Retrospective - Scope management validated, scaffolding approach proven
8. Epic 5 Inserted - "BitCraft Game Analysis & Playability Validation" (8 stories), Epics 5-12 renumbered to 6-13
9. Epic 3 Started - Baseline green (748 tests), test design created (~268 planned tests)

### Next Workflow Steps

1. Create Story 3.1 spec file (BLS Package Setup & Crosstown SDK Node)
2. Validate `@crosstown/sdk` API surface (spike)
3. Implement Epic 3 stories sequentially: 3.1 -> 3.2 -> 3.3 -> 3.4

---

## Functional Requirements Coverage

### Identity & Key Management (FR1-FR5)

- **FR1:** Generate new Nostr keypair - COMPLETE (Story 1.2)
- **FR2:** Import existing Nostr keypair - COMPLETE (Story 1.2)
- **FR3:** Export Nostr keypair for backup - COMPLETE (Story 1.2)
- **FR4:** Attribute actions to Nostr public key - PARTIAL (signing in Epic 2, attribution in Epic 3)
- **FR5:** Verify identity ownership end-to-end - PARTIAL (signing in Epic 2, verification in Epic 3)

### World Perception (FR6-FR10)

- **FR6:** Subscribe to SpacetimeDB table updates - COMPLETE (Story 1.4)
- **FR7:** Subscribe to Crosstown relay events - COMPLETE (Story 2.1)
- **FR8:** Load static data tables - COMPLETE (Story 1.5, partial: 40/148)
- **FR9:** Interpret table events as semantic narratives - Backlog (Epic 4)
- **FR10:** Auto-reconnect after disconnections - COMPLETE (Story 1.6)

### Action Execution & Payments (FR17-FR22)

- **FR17:** Execute actions via client.publish() - COMPLETE (Story 2.3, refined in 2.5)
- **FR18:** ILP packet construction - COMPLETE (Story 2.3, simplified in 2.5)
- **FR19:** BLS handler validates and calls reducer - IN-PROGRESS (Epic 3)
- **FR20:** ILP fee collection - IN-PROGRESS (Epic 3)
- **FR21:** Wallet balance query - COMPLETE (Story 2.2, stub mode)
- **FR22:** Action cost registry - COMPLETE (Story 2.2)

### Agent Configuration & Skills (FR11-FR16, FR27)

- **FR11-FR15, FR27:** Backlog (Epic 4)
- **FR16:** Backlog (Epic 9, Phase 2)

### Agent Cognition (FR23-FR26)

- **FR23-FR26:** Backlog (Epics 6/9)

### Terminal Game Client (FR28-FR38)

- **FR28-FR38:** Backlog (Epics 7/10)

### Infrastructure & Deployment (FR44-FR47)

- **FR44:** Docker compose local dev - COMPLETE (Story 1.3)
- **FR45:** ILP fee schedule configuration - IN-PROGRESS (Epic 3)
- **FR46:** System health monitoring - Backlog (Epic 8)
- **FR47:** BLS game action handler mapping - IN-PROGRESS (Epic 3)

### Experiment & Analysis (FR39-FR43), World Extensibility (FR48-FR50)

- All Backlog (Epics 4/11/12/13)

---

## Team Agreements & Best Practices

### From Epic 1 Retrospective

**AGREEMENT-1: Test-First for Complex Features**
For any feature with >3 acceptance criteria, write tests before implementation.

**AGREEMENT-2: Security Review on Every Story**
Every story must pass OWASP Top 10 review before marking "done". No exceptions.

**AGREEMENT-3: Pair on Unfamiliar Technologies**
When a story involves new tech (Nostr, ILP, BLS), pair programming or pair review is mandatory.

**AGREEMENT-4: Technical Debt Tracking**
Any deferred work must be captured and linked in story documentation.

**AGREEMENT-5: Integration Test Documentation**
Integration tests requiring Docker must have clear setup instructions and graceful failure messages.

### From Epic 2 Retrospective

**AGREEMENT-6: Scaffolding-Then-Integrate**
When integrating external SDKs, build working scaffolding first, then swap in the real dependency. This gives deep understanding and creates integration contracts.

**AGREEMENT-7: Proactive Scope Management**
When stories belong to a different repository/team, move them early and document the rationale explicitly in sprint-status.yaml.

### Code Review Checklist

**Security (OWASP Top 10):**

- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all external data (WebSocket, IPC, file paths)
- [ ] Path traversal prevention (Docker volumes, file I/O)
- [ ] SSRF protection on all URL inputs (crosstown connector, BTP endpoint, wallet API)
- [ ] Rate limiting on public endpoints (Nostr relay, MCP tools)

**TypeScript Safety:**

- [ ] No `any` types (use `unknown` or specific types)
- [ ] Null/undefined handling (`?.` optional chaining)
- [ ] Error handling (try/catch, Promise rejection)
- [ ] Type exports from `index.ts` for public API

**Rust Safety:**

- [ ] No `unsafe` blocks (unless justified and documented)
- [ ] Error propagation (`Result<T, E>`, `?` operator)

**Testing:**

- [ ] Traceability: AC -> Test mapping documented
- [ ] Edge cases covered (empty inputs, boundary values, failure modes)
- [ ] Integration tests conditionally run (Docker availability check)

---

## Changelog

### 2026-03-13: Epic 3 Started, Epic 2 Complete

**Delivered:**

- Epic 2: 5/5 stories complete
- Epic 2 retrospective and completion report
- Epic 3 start: baseline green (748 tests), test design created (~268 planned tests)
- Epic 5 inserted: "BitCraft Game Analysis & Playability Validation" (8 stories)
- Sprint status updated: Epic 3 in-progress

**Updated:**

- 13 epics, 61 stories total
- Project context regenerated for Epic 3 start
- New auto-bmad-artifacts: epic-2-end-report, epic-2-retro, epic-3-start-report, story-2-5-report

### 2026-03-13: Epic 2 Complete

**Delivered:**

- Full publish pipeline: `client.publish()` -> CrosstownAdapter -> @crosstown/client -> BLS -> SpacetimeDB
- Nostr relay client (NIP-01), action cost registry, wallet client, BLS contract spec
- @crosstown/client integration (Story 2.5), custom scaffolding removed

### 2026-02-27: Epic 1 Complete

**Delivered:**

- Epic 1: 6/6 stories complete
- Comprehensive retrospective with action items and prep tasks

---

**Document Version:** 3.0
**Last Updated:** 2026-03-13
**Generated By:** `/bmad-bmm-generate-project-context yolo`
**Status:** Epic 3 In-Progress, Epics 1-2 Complete
