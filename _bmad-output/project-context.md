# Sigil Project Context

**Generated:** 2026-03-13
**Status:** Epic 2 Complete (5/5 stories), Epic 1 Complete (6/6 stories)
**Phase:** MVP Development (Epics 1-2 delivered, Epics 3-8 remaining)

---

## Executive Summary

**Sigil** is an SDK platform for building AI agents and terminal clients that interact with SpacetimeDB-based game worlds. The platform features a pure TypeScript client library (`@sigil/client`), MCP server wrapper for AI agents (`@sigil/mcp-server`), JSON-RPC IPC backend for terminal UIs (`@sigil/tui-backend`), and a Rust-based ratatui TUI (`sigil-tui`).

**Current Status:**
- **Epic 1 (Project Foundation):** COMPLETE - 6/6 stories delivered, 937 tests passing
- **Epic 2 (Action Execution & Payment Pipeline):** COMPLETE - 5/5 stories delivered, 651 tests passing
- **Total Tests:** 651 passing (641 TypeScript unit + 7 Rust + 3 root integration), 103 integration tests skipped (require Docker)
- **Code Quality:** OWASP Top 10 compliant across all stories
- **Infrastructure:** Full publish pipeline operational via `@crosstown/client` adapter

**Key Deliverables (Epic 2):**
1. Nostr relay client (NIP-01 compliant) for Crosstown event subscriptions and action confirmations
2. Action cost registry with JSON configuration for per-action ILP pricing
3. Wallet balance client with HTTP API and stub mode fallback
4. ILP packet content construction (kind 30078 Nostr events)
5. BLS handler integration contract specification and validation tests
6. `@crosstown/client` adapter integration replacing custom scaffolding (Story 2.5)

**Next Steps:**
- Begin Epic 3: BitCraft BLS Game Action Handler (4 stories)
- Epic 3 implements the BLS handler itself (contract spec'd in Story 2.4)

---

## Project Overview

### What is Sigil?

Sigil is the brand name for the SDK/platform that enables:
1. **AI Agents** to play SpacetimeDB games via MCP tools and Claude/Vercel AI SDK integration
2. **Human Players** to interact with games via a terminal UI (TUI) built with ratatui
3. **Researchers** to run multi-agent experiments and comparative decision analysis

**BitCraft** refers ONLY to the v1 game world (Apache 2.0 fork, run unmodified as the reference implementation).

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
4. **Nostr-Only Identity:** Nostr keypair is the sole identity mechanism (no OAuth, no passwords)
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
│   └── test-reports/            # Test execution reports
│
├── package.json                 # Root monorepo config (pnpm)
├── Cargo.toml                   # Rust workspace config
├── tsconfig.json                # TypeScript config
├── vitest.config.ts             # Root integration test config
└── README.md                    # BitCraft server README (upstream)
```

---

## Technology Stack

### Core Technologies

- **Runtime:** Node.js >=20.0.0
- **Package Manager:** pnpm >=9.0.0
- **TypeScript:** 5.2+
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

**Decision:** Story 2.4 defines the integration contract and validation tests only. The actual BLS handler implementation lives in Epic 3.

**Key Architectural Decisions (Story 2.4):**
- BitCraft reducers WILL be modified to accept `identity: String` as first parameter
- Wallet balance checks and ILP fee deduction are OUT OF SCOPE (EVM onchain wallets)
- BLS handler validates Nostr signatures, extracts pubkey, prepends to reducer args

**Status:** Contract spec'd and validated. Implementation deferred to Epic 3.

### 6. @crosstown/client Integration (Story 2.5)

**Decision:** Replace custom scaffolding (event-signing.ts, crosstown-connector.ts) with official `@crosstown/client` library.

**What was removed:**
- `event-signing.ts` (signing delegated to `@crosstown/client`)
- `crosstown-connector.ts` (transport delegated to `@crosstown/client`)

**What was simplified:**
- `ilp-packet.ts` now returns content-only templates (no pubkey, no signing)

**What was added:**
- `CrosstownAdapter` wrapping `@crosstown/client` with SSRF protection and error mapping
- `@crosstown/relay` for TOON encoding/decoding

**Status:** COMPLETE - All scaffolding removed, adapter operational.

---

## Epic Breakdown & Progress

### Epic Inventory (13 epics, 61 stories)

**MVP (Epics 1-8):** 45 stories
- Epic 1: Project Foundation & Game World Connection (6 stories) - **COMPLETE**
- Epic 2: Action Execution & Payment Pipeline (5 stories) - **COMPLETE**
- Epic 3: BitCraft BLS Game Action Handler (4 stories) - Backlog
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
**Tests:** 937 total (810 unit, 127 integration), 100% pass rate
**Acceptance Criteria:** 29/29 met (100%)

| Story | Title | Tests | Status |
|-------|-------|-------|--------|
| 1.1 | Monorepo Scaffolding & Build Infrastructure | 12 | Done |
| 1.2 | Nostr Identity Management | 45 | Done |
| 1.3 | Docker Local Development Environment | 8 | Done |
| 1.4 | SpacetimeDB Connection & Table Subscriptions | 124 | Done |
| 1.5 | Static Data Table Loading | 38 | Done |
| 1.6 | Auto-Reconnection & State Recovery | 710 | Done |

**Deliverables:**
- Polyglot monorepo with pnpm + cargo workspaces
- Nostr keypair generation, import, export, signing (BIP-39 support)
- Docker stack: BitCraft server + Crosstown node (health checks, resource limits)
- SpacetimeDB WebSocket connection, table subscriptions, event handling
- Static data loader (40/148 tables loaded, 108 deferred)
- Reconnection manager with exponential backoff, max retries, state recovery

### Epic 2: Action Execution & Payment Pipeline

**Status:** COMPLETE (2026-03-13)
**Stories:** 5/5 delivered
**Tests:** 651 total passing (641 TS unit + 7 Rust + 3 root integration), 103 integration tests skipped (require Docker)

| Story | Title | Key Deliverables | Status |
|-------|-------|-----------------|--------|
| 2.1 | Crosstown Relay Connection & Event Subscriptions | NostrClient (NIP-01), reconnection, action confirmation detection | Done |
| 2.2 | Action Cost Registry & Wallet Balance | ActionCostRegistryLoader, WalletClient, PublishAPI (getCost/canAfford) | Done |
| 2.3 | ILP Packet Construction & Signing | ILP packet types, event construction, signing, Crosstown connector | Done |
| 2.4 | BLS Handler Integration Contract | BLS error types, contract validation tests, implementation spec | Done |
| 2.5 | @crosstown/client Integration & Scaffolding Removal | CrosstownAdapter, simplified ilp-packet.ts, removed event-signing.ts/crosstown-connector.ts | Done |

**Epic 2 Changes to sprint-status.yaml:**
- Stories 2.6 (Identity Propagation) and 2.7 (ILP Fee Collection) REMOVED - Moved to Epic 3 (BitCraft BLS). Spec'd in Story 2.4, implemented in Epic 3.
- Story 2.5 changed title to "@crosstown/client Integration & Scaffolding Removal"

**New Modules Added in Epic 2:**
- `packages/client/src/nostr/nostr-client.ts` - NIP-01 compliant Nostr relay client
- `packages/client/src/nostr/types.ts` - Nostr event types, filters, subscriptions
- `packages/client/src/publish/action-cost-registry.ts` - JSON-based action cost lookup
- `packages/client/src/publish/ilp-packet.ts` - Content-only ILP packet templates
- `packages/client/src/wallet/wallet-client.ts` - HTTP wallet balance queries
- `packages/client/src/bls/types.ts` - BLS handler error codes and response types
- `packages/client/src/crosstown/crosstown-adapter.ts` - `@crosstown/client` wrapper with SSRF protection
- `packages/crosstown-client/` - `@crosstown/client` v0.4.2 package
- `packages/crosstown-relay/` - `@crosstown/relay` v0.4.2 package
- `packages/client/config/default-action-costs.json` - Default action cost registry
- `scripts/bls-handler-smoke-test.ts` - BLS handler smoke test script
- `docs/bls-handler-contract.md` - BLS integration contract
- `docs/crosstown-bls-implementation-spec.md` - Crosstown BLS implementation spec

**Modules Removed in Epic 2 (Story 2.5 cleanup):**
- `packages/client/src/publish/event-signing.ts` - Signing delegated to `@crosstown/client`
- `packages/client/src/crosstown/crosstown-connector.ts` - Transport delegated to `@crosstown/client`

### Epic 3: BitCraft BLS Game Action Handler (Next)

**Status:** BACKLOG
**Stories:** 4
**Dependencies:** Epic 2 complete (dependency met)

**Stories:**
- 3.1: BLS Package Setup & Crosstown SDK Node
- 3.2: Game Action Handler (kind 30078)
- 3.3: Pricing Configuration & Fee Schedule
- 3.4: Identity Propagation & End-to-End Verification

**Risk Assessment:**
- **High Risk:** BLS handler is new infrastructure - first server-side component
- **Medium Risk:** Requires modifying BitCraft reducers to accept identity parameter
- **Low Risk:** Integration contract well-defined in Story 2.4

---

## Testing & Quality Metrics

### Test Coverage (Epic 1 + Epic 2)

**Total Tests (as of Epic 2 completion):** 651 passing
- **TypeScript Unit Tests:** 641 passing (29 test files)
- **Rust Unit Tests:** 7 passing
- **Root Integration Tests:** 3 passing
- **Integration Tests:** 103 skipped (require Docker stack)

**Test Distribution by Story (Epic 2):**
- Story 2.1: 35 unit tests (Nostr relay client)
- Story 2.2: 69 unit tests + 6 integration (action cost registry, wallet)
- Story 2.3: 61 unit tests (ILP packets, signing, connector)
- Story 2.4: 47 unit tests + 10 integration (BLS contract validation)
- Story 2.5: Refactored existing tests for adapter pattern, added CrosstownAdapter tests

**Test Files (Epic 2 new/updated):**
- `nostr/nostr-client.test.ts` - NIP-01 relay client tests
- `nostr/acceptance-criteria.test.ts` - Story 2.1 AC validation
- `publish/action-cost-registry.test.ts` - Cost lookup, validation, edge cases
- `publish/ilp-packet.test.ts` - Content construction, validation
- `publish/client-publish.test.ts` - End-to-end publish flow
- `publish/client-publish-adapter.test.ts` - CrosstownAdapter publish tests
- `publish/confirmation-flow.test.ts` - Confirmation event handling
- `publish/story-2-5-acceptance-criteria.test.ts` - Story 2.5 AC validation
- `wallet/wallet-client.test.ts` - Balance queries, stub mode
- `bls/types.test.ts` - BLS error types, type guards
- `bls/contract-validation.test.ts` - BLS integration contract
- `crosstown/crosstown-adapter.test.ts` - Adapter lifecycle, error mapping, SSRF

### Test Architecture Traceability

All stories include comprehensive traceability reports linking:
- Functional Requirements (FRs) -> Acceptance Criteria (ACs) -> Test Cases

**Reports:**
- `_bmad-output/implementation-artifacts/reports/2-3-testarch-trace-report.md`
- `_bmad-output/implementation-artifacts/reports/2-5-testarch-trace-report.md`
- `_bmad-output/implementation-artifacts/2-1-test-architecture-traceability.md`
- `_bmad-output/implementation-artifacts/2-2-test-architecture-traceability.md`
- Individual story reports contain embedded traceability

### Code Quality & Security

**Code Review (Epic 2):**
- Multiple review passes per story (adversarial general review)
- OWASP Top 10 compliance validated on all stories
- Semgrep security scan on Story 2.3

**Security Highlights (Epic 2):**
- SSRF protection on Crosstown connector URL (production: block localhost/internal IPs, require HTTPS)
- SSRF protection on BTP WebSocket endpoint (production: require wss://)
- SSRF protection on wallet balance client
- Private key never logged, never in error messages
- Embedded credentials rejected in connector URLs
- Input validation on reducer names (alphanumeric + underscore, 1-64 chars)
- JSON serialization validation on action args

### Test Execution

**Unit Tests:**
```bash
pnpm --filter @sigil/client test:unit    # Run unit tests (641 tests)
pnpm --filter @sigil/client test         # Run all client tests
```

**Integration Tests (require Docker):**
```bash
docker compose -f docker/docker-compose.yml up -d  # Start stack
pnpm --filter @sigil/client test:integration       # Run integration tests
docker compose -f docker/docker-compose.yml down   # Stop stack
```

**BLS Smoke Test:**
```bash
pnpm smoke:bls  # Quick BLS handler validation (requires Docker + BLS handler)
```

**Root Integration Tests:**
```bash
pnpm test:integration  # Root-level integration tests
```

---

## Known Issues & Technical Debt

### Medium Priority

**DEBT-2: Load Remaining 108 Static Data Tables**
- **Priority:** MEDIUM
- **Effort:** 12 hours
- **Description:** Story 1.5 loaded 40/148 static data tables. Remaining 108 tables needed for full game state coverage.
- **Impact:** May block Epic 4-5 if agent skills require missing tables.

**DEBT-5: Wallet Balance Stub Mode**
- **Priority:** MEDIUM
- **Effort:** 4 hours
- **Description:** WalletClient falls back to stub mode (fixed balance 10000) when Crosstown balance API returns 404/501. Real balance API integration deferred.
- **Impact:** Wallet balance is not real until Crosstown implements the balance endpoint. Tests validate stub behavior correctly.
- **Mitigation:** WalletClient.enableStubMode() / disableStubMode() for explicit control. SIGIL_WALLET_STUB=true env var for automatic stub activation.

**DEBT-6: EVM Address Derivation is Placeholder**
- **Priority:** LOW
- **Effort:** 2 hours
- **Description:** CrosstownAdapter.getEvmAddress() returns truncated Nostr pubkey as placeholder. Proper implementation requires keccak256 hash of uncompressed secp256k1 public key.
- **Impact:** No current consumer uses EVM addresses. Will be needed if/when Crosstown adds EVM wallet support.

### Low Priority

**DEBT-4: Improve Docker Test Stability**
- **Priority:** LOW (quality of life)
- **Effort:** 4 hours
- **Description:** Integration tests fail when Docker is not running. Auto-skip works but could be improved with lightweight mocks.
- **Impact:** New contributor friction.

### Resolved (Epic 2)

**DEBT-1: Complete Story 1.6 Subscription Recovery** - RESOLVED in Epic 2 prep (PREP-1)
**DEBT-3: Add Linux Integration Test Coverage** - RESOLVED in Epic 2 prep (PREP-2). CI now runs on Ubuntu + macOS.

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
# From repository root
cd /Users/jonathangreen/Documents/BitCraftPublic

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run unit tests (no Docker required)
pnpm --filter @sigil/client test:unit

# Start Docker stack
docker compose -f docker/docker-compose.yml up -d

# Run integration tests
pnpm --filter @sigil/client test:integration

# Stop Docker stack
docker compose -f docker/docker-compose.yml down
```

### Package Development

**Working on `@sigil/client`:**
```bash
cd packages/client
pnpm test:watch           # Watch mode for TDD
pnpm test:unit            # Unit tests only (641 tests)
pnpm test:integration     # Integration tests (requires Docker)
pnpm test:coverage        # Generate coverage report
pnpm build                # Build dist/ output
```

**Working on `sigil-tui`:**
```bash
cd crates/tui
cargo build               # Build binary
cargo test                # Run Rust tests (7 tests)
cargo clippy              # Lint
```

### Docker Stack Management

```bash
# Start services
docker compose -f docker/docker-compose.yml up -d

# Health checks
curl http://localhost:3000/database/bitcraft/info  # BitCraft server
curl http://localhost:4041/health                  # Crosstown node

# View logs
docker compose -f docker/docker-compose.yml logs -f bitcraft-server

# Reset environment
docker compose -f docker/docker-compose.yml down -v
rm -rf docker/volumes/*
docker compose -f docker/docker-compose.yml up -d
```

### CI/CD

**GitHub Actions:**
- `.github/workflows/ci-typescript.yml` - TypeScript lint, typecheck, unit tests, build (Ubuntu + macOS), integration tests with Docker
- `.github/workflows/ci-rust.yml` - Rust format, clippy, test, build (Ubuntu + macOS)

**Branch Strategy:**
- `master` - Main development branch (stable)
- `epic-X` - Epic-specific feature branches (currently: `epic-2`)
- PRs merge to `master` after review

---

## Documentation Index

### Planning Artifacts

**Core Planning:**
- `_bmad-output/planning-artifacts/epics.md` - Epic breakdown (13 epics, 61 stories)
- `_bmad-output/planning-artifacts/architecture/index.md` - Architecture overview (22 docs)
- `_bmad-output/planning-artifacts/prd/index.md` - Product requirements (archived)
- `_bmad-output/planning-artifacts/ux-design-specification.md` - UX design

**Architecture Deep Dives:**
- `architecture/2-design-principles.md` - Design philosophy
- `architecture/3-system-context.md` - System boundaries and interactions
- `architecture/4-data-flow.md` - Data flow patterns
- `architecture/7-crosstown-integration.md` - ILP relay integration
- `architecture/8-action-cost-registry.md` - Action cost design
- `architecture/11-docker-development-environment.md` - Docker stack design
- `architecture/12-phased-implementation-plan.md` - MVP/Phase 2/Phase 3 breakdown
- `architecture/13-technology-choices.md` - Technology selection rationale

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

**Architecture Decision Records:**
- `adr/adr-001-spacetimedb-sdk-version.md`
- `adr/adr-002-nostr-only-identity.md`
- `adr/adr-003-polyglot-monorepo.md`
- `adr/adr-004-docker-dev-stack.md`

**Prep Task Reports (Epic 2 Preparation):**
- `epic-2-prep-tasks.md` - Prep task summary
- `prep-2-linux-validation-checklist.md` - Linux validation
- `prep-2-platform-analysis.md` - Platform compatibility analysis
- `prep-4-crosstown-relay-protocol.md` - Crosstown protocol research
- `prep-5-bls-handler-spike.md` - BLS handler architecture spike
- `integration-test-strategy.md` - Integration test strategy

**Test Architecture:**
- `reports/2-3-testarch-trace-report.md`
- `reports/2-5-testarch-trace-report.md`
- `2-1-test-architecture-traceability.md`
- `2-2-test-architecture-traceability.md`

**Status Tracking:**
- `sprint-status.yaml` - Epic/story status (updated 2026-03-13)

### Developer Documentation

- `docs/bls-handler-contract.md` - BLS integration contract
- `docs/crosstown-bls-implementation-spec.md` - Crosstown BLS implementation spec
- `docs/architecture.md` - Architecture overview
- `docs/data-models.md` - Data models
- `docs/development-guide.md` - Development guide
- `docker/README.md` - Docker stack setup and troubleshooting

---

## BMAD Workflow State

### Current Phase

**Phase:** 3-solutioning (Architecture COMPLETE, Epics & Stories COMPLETE)
**Module:** bmm (Business Model & Management)
**Status:** Implementation in progress (Epics 1-2 complete, Epic 3 next)

### Workflow Steps Completed

1. Architecture Definition - 22 architecture documents, validated against requirements
2. Epic Breakdown - 13 epics, 61 stories, all 50 FRs covered
3. Epic 1 Implementation - 6 stories delivered, 937 tests passing
4. Epic 1 Retrospective - Lessons learned, action items, prep tasks defined
5. Epic 2 Preparation - PREP-1, PREP-2, PREP-4, PREP-5, ACTION-1 completed
6. Epic 2 Implementation - 5 stories delivered, 651 tests passing
7. Epic 5 Inserted - "BitCraft Game Analysis & Playability Validation" (8 stories), old Epics 5-12 renumbered to 6-13

### Next Workflow Steps

1. Begin Epic 3 implementation (Story 3.1: BLS Package Setup & Crosstown SDK Node)
2. Continue MVP development (Epics 3-8)

---

## Functional Requirements Coverage

### Identity & Key Management (FR1-FR5)

- **FR1:** Generate new Nostr keypair - COMPLETE (Story 1.2)
- **FR2:** Import existing Nostr keypair - COMPLETE (Story 1.2)
- **FR3:** Export Nostr keypair for backup - COMPLETE (Story 1.2)
- **FR4:** Attribute actions to Nostr public key - PARTIAL (signing side done in Epic 2, attribution side in Epic 3)
- **FR5:** Verify identity ownership end-to-end - PARTIAL (signing side done in Epic 2, verification side in Epic 3)

### World Perception (FR6-FR10)

- **FR6:** Subscribe to SpacetimeDB table updates - COMPLETE (Story 1.4)
- **FR7:** Subscribe to Crosstown relay events - COMPLETE (Story 2.1)
- **FR8:** Load static data tables - COMPLETE (Story 1.5, partial: 40/148)
- **FR9:** Interpret table events as semantic narratives - Backlog (Epic 4)
- **FR10:** Auto-reconnect after disconnections - COMPLETE (Story 1.6)

### Action Execution & Payments (FR17-FR22)

- **FR17:** Execute actions via client.publish() - COMPLETE (Story 2.3, refined in 2.5)
- **FR18:** ILP packet construction - COMPLETE (Story 2.3, simplified in 2.5)
- **FR19:** BLS handler validates and calls reducer - Backlog (Epic 3, contract spec'd in Story 2.4)
- **FR20:** ILP fee collection - Backlog (Epic 3)
- **FR21:** Wallet balance query - COMPLETE (Story 2.2, stub mode until Crosstown API available)
- **FR22:** Action cost registry - COMPLETE (Story 2.2)

### Agent Configuration & Skills (FR11-FR16, FR27)

- **FR11-FR15, FR27:** Skill files, agent configuration, budget tracking, swappable config - Backlog (Epic 4)
- **FR16:** LLM backend selection - Backlog (Epic 9, Phase 2)

### Agent Cognition (FR23-FR26)

- **FR23:** Autonomous decisions via MCP tools - Backlog (Epic 6)
- **FR24-FR26:** LLM reasoning, persistent memory, affordance detection - Backlog (Epic 9, Phase 2)

### Terminal Game Client (FR28-FR38)

- **FR28-FR32, FR38:** TUI screens, movement, chat, inventory - Backlog (Epic 7)
- **FR33-FR37:** Combat, crafting, building, trading, empires - Backlog (Epic 10, Phase 2)

### Infrastructure & Deployment (FR44-FR47)

- **FR44:** Docker compose local dev - COMPLETE (Story 1.3)
- **FR45:** ILP fee schedule configuration - Backlog (Epic 3)
- **FR46:** System health monitoring - Backlog (Epic 8)
- **FR47:** BLS game action handler mapping - Backlog (Epic 3, contract spec'd in Story 2.4)

### Experiment & Analysis (FR39-FR43)

- **FR39:** Structured decision logging - Backlog (Epic 4)
- **FR40-FR43:** Multi-agent, YAML experiments, snapshots, analysis - Backlog (Epic 11, Phase 2)

### World Extensibility (FR48-FR50)

- **FR48-FR49:** Skill files for new worlds, BLS handler registration - Backlog (Epic 12, Phase 2)
- **FR50:** Auto-generate skill files - Backlog (Epic 13, Phase 3)

---

## Non-Functional Requirements Status

### Performance (NFR1-NFR7)

- **NFR1:** TUI renders 30+ FPS - Backlog (Epic 7)
- **NFR2:** TUI responsive over SSH - Backlog (Epic 7)
- **NFR3:** ILP round-trip <2s - Architecture designed, tested with timeouts in Story 2.3/2.5
- **NFR4:** Agent decision cycle <5s - Backlog (Epic 4)
- **NFR5:** Table updates reflected <500ms - VALIDATED (Story 1.4)
- **NFR6:** Static data loading <10s - VALIDATED (Story 1.5)
- **NFR7:** Skill file parsing <1s - Backlog (Epic 4)

### Security (NFR8-NFR13)

- **NFR8:** Signed ILP packets - COMPLETE (Story 2.3/2.5 via @crosstown/client)
- **NFR9:** Private keys never transmitted - COMPLETE (Story 1.2, 2.3/2.5)
- **NFR10:** BLS validates identity on every call - Backlog (Epic 3)
- **NFR11:** Encrypted key storage - COMPLETE (Story 1.2)
- **NFR12:** Fee schedules publicly auditable - COMPLETE (Story 2.2, JSON config file)
- **NFR13:** No action without valid signature - Architecture designed, implementation in Epic 3

### Scalability (NFR14-NFR17)

- **NFR14-NFR17:** Concurrent agents, subscriptions, log rotation, fee accounting - Backlog (various epics)

### Integration (NFR18-NFR22)

- **NFR18:** SpacetimeDB 2.0 SDK on 1.6.x - VALIDATED (Stories 1.4, 2.1-2.5)
- **NFR19:** Standard Nostr relay NIP-01 - COMPLETE (Story 2.1)
- **NFR20:** LLM provider compatibility - Backlog (Epic 9, Phase 2)
- **NFR21:** Skill file format consumed uniformly - Backlog (Epic 4)
- **NFR22:** Docker runs on Linux + macOS - VALIDATED (PREP-2, CI runs both)

### Reliability (NFR23-NFR27)

- **NFR23:** Auto-reconnect within 10s - COMPLETE (Story 1.6)
- **NFR24:** Failed ILP packets return clear errors - COMPLETE (Story 2.3/2.5)
- **NFR25:** Agent state persists across restarts - Backlog (Epic 4)
- **NFR26:** TUI handles disconnection gracefully - Backlog (Epic 7)
- **NFR27:** Zero silent BLS failures - Architecture designed (Story 2.4), implementation in Epic 3

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
Any deferred work must be captured as GitHub issues and linked in story documentation.

**AGREEMENT-5: Integration Test Documentation**
Integration tests requiring Docker must have clear setup instructions and graceful failure messages.

### Code Review Checklist

**Security (OWASP Top 10):**
- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all external data (WebSocket, IPC, file paths)
- [ ] Path traversal prevention (Docker volumes, file I/O)
- [ ] SSRF protection on all URL inputs (crosstown connector, BTP endpoint, wallet API)
- [ ] Rate limiting on public endpoints (Nostr relay, MCP tools)
- [ ] Dependency vulnerabilities checked (`pnpm audit`, `cargo audit`)

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

## Contact & Resources

### Project Links

- **Repository:** https://github.com/bitcraftlabs/sigil (future public repo)
- **BitCraft Upstream:** https://github.com/clockworklabs/BitCraft (Apache 2.0)
- **SpacetimeDB:** https://spacetimedb.com
- **Crosstown:** (private - Clockwork Labs ILP relay)

---

## Changelog

### 2026-03-13: Epic 2 Complete, Epic 5 Inserted

**Delivered:**
- Epic 2: 5/5 stories complete, 651 tests passing
- Full publish pipeline: `client.publish()` -> CrosstownAdapter -> @crosstown/client -> BLS -> SpacetimeDB
- Nostr relay client (NIP-01), action cost registry, wallet client, BLS contract spec
- @crosstown/client integration (Story 2.5), custom scaffolding removed
- Epic 5 inserted: "BitCraft Game Analysis & Playability Validation" (8 stories)
- Epics 5-12 renumbered to 6-13

**Updated:**
- Sprint status updated: 13 epics, 61 stories
- Project context regenerated to reflect Epic 2 deliverables
- Technical debt updated (DEBT-1 and DEBT-3 resolved, DEBT-5 and DEBT-6 added)

**Next:**
- Begin Epic 3: BitCraft BLS Game Action Handler (4 stories)
- Implement BLS handler per integration contract spec'd in Story 2.4

### 2026-02-27: Epic 1 Complete, Epic 2 Preparation

**Delivered:**
- Epic 1: 6/6 stories complete, 937 tests passing
- Comprehensive retrospective with action items and prep tasks
- Sprint status updated in `sprint-status.yaml`

**Next:**
- Execute Epic 2 preparation tasks (completed)
- Begin Epic 2 implementation (completed 2026-03-13)

---

**Document Version:** 2.0
**Last Updated:** 2026-03-13
**Generated By:** `/bmad-bmm-generate-project-context yolo`
**Status:** Epic 2 Complete, Epic 3 Next
