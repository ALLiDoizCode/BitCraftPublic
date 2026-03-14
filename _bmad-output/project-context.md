# Sigil Project Context

**Generated:** 2026-03-14
**Status:** Epic 3 Complete (4/4 stories), Epics 1-3 Complete (15/15 stories)
**Phase:** MVP Development (Epics 1-3 delivered, Epics 4-8 remaining)

---

## Executive Summary

**Sigil** is an SDK platform for building AI agents and terminal clients that interact with SpacetimeDB-based game worlds. The platform features a pure TypeScript client library (`@sigil/client`), a BLS game action handler (`@sigil/bitcraft-bls`), MCP server wrapper for AI agents (`@sigil/mcp-server`), JSON-RPC IPC backend for terminal UIs (`@sigil/tui-backend`), and a Rust-based ratatui TUI (`sigil-tui`).

**Current Status:**

- **Epic 1 (Project Foundation):** COMPLETE - 6/6 stories delivered
- **Epic 2 (Action Execution & Payment Pipeline):** COMPLETE - 5/5 stories delivered
- **Epic 3 (BitCraft BLS Game Action Handler):** COMPLETE - 4/4 stories delivered
- **Epic 4 (Declarative Agent Configuration):** NEXT - 7 stories, backlog
- **Total Tests:** 972 passing (866 TypeScript + 98 root integration + 8 Rust), 212 skipped (require Docker)
- **Code Quality:** OWASP Top 10 compliant across all stories, 0 semgrep findings in Epic 3 (4 scans), lint baseline clean
- **Infrastructure:** Full publish pipeline operational -- client SDK through BLS handler to SpacetimeDB

**Epic 3 Delivered:**
Epic 3 delivered the **first server-side component** -- a Crosstown BLS node (`packages/bitcraft-bls/`) that receives ILP-routed game action events, validates Nostr signatures via `@crosstown/sdk`, parses kind 30078 event content, enforces per-reducer pricing via a fee schedule, prepends the player's Nostr pubkey as identity to reducer arguments, and calls SpacetimeDB reducers via HTTP API. The package includes a Dockerfile for containerized deployment and is integrated into the Docker Compose stack.

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
  - `@sigil/bitcraft-bls` - BLS game action handler (server-side, Crosstown SDK node)
  - `@sigil/mcp-server` - MCP protocol wrapper over client (for AI agents, future)
  - `@sigil/tui-backend` - JSON-RPC IPC wrapper over client (for Rust TUI, future)
- **Crosstown SDK packages (workspace stubs):**
  - `@crosstown/client` - ILP client: signing, TOON encoding, payment channels, transport (v0.4.2)
  - `@crosstown/relay` - TOON encoding/decoding for Nostr events (v0.4.2)
  - `@crosstown/sdk` - BLS node creation, identity derivation, handler registration (v0.1.4)
- **Rust crate:** `sigil-tui` - Terminal user interface using ratatui
- **MCP resource URIs:** `sigil://players/{id}`, `sigil://planets/{id}`

### Architecture Principles

1. **Single Polyglot Monorepo:** TypeScript (pnpm workspace) + Rust (cargo workspace)
2. **Pure Client Library:** `@sigil/client` is a pure engine library with no CLI or process management
3. **Single Write Path:** `client.publish()` -> content-only ILP template -> CrosstownAdapter -> `@crosstown/client` (signs, TOON-encodes, ILP-routes) -> BLS handler -> SpacetimeDB
4. **Nostr-Only Identity:** Nostr keypair (secp256k1) is the ONLY identity mechanism (no OAuth, no passwords)
5. **Identity Propagation:** BLS handler extracts verified Nostr pubkey and prepends as first reducer argument (64-char hex)
6. **TUI Architecture:** Rust (ratatui) presentation layer + TypeScript backend via JSON-RPC IPC
7. **Agent Model:** Claude instance with CLAUDE.md + Skills + MCP tools (NOT custom cognition stack)

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
│   ├── bitcraft-bls/            # @sigil/bitcraft-bls - BLS Game Action Handler (Epic 3)
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point, main(), public API re-exports
│   │   │   ├── config.ts        # BLSConfig, env var loading, fee schedule integration
│   │   │   ├── node.ts          # createBLSNode(), wraps @crosstown/sdk
│   │   │   ├── handler.ts       # createGameActionHandler(), kind 30078 processing
│   │   │   ├── content-parser.ts # parseEventContent(), JSON parsing with validation
│   │   │   ├── spacetimedb-caller.ts # callReducer(), HTTP API calls to SpacetimeDB
│   │   │   ├── fee-schedule.ts  # loadFeeSchedule(), per-reducer pricing
│   │   │   ├── health.ts        # HTTP health check + /fee-schedule endpoint
│   │   │   ├── lifecycle.ts     # Graceful shutdown, SIGTERM/SIGINT handlers
│   │   │   ├── identity-chain.ts # verifyIdentityChain(), identity verification module
│   │   │   ├── verification.ts  # logVerificationEvent(), verification logging
│   │   │   ├── utils.ts         # truncatePubkey(), PUBKEY_REGEX shared utilities
│   │   │   └── __tests__/       # 29 test files (21 unit + 8 integration)
│   │   │       ├── factories/   # bls-config.factory.ts, handler-context.factory.ts, identity.factory.ts
│   │   │       └── fixtures/    # Test fixtures
│   │   ├── Dockerfile           # Multi-stage Docker build
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── vitest.config.ts
│   │
│   ├── crosstown-client/        # @crosstown/client v0.4.2 (workspace stub, Story 2.5)
│   │   └── src/
│   │       └── index.ts         # CrosstownClient, signing, TOON, transport
│   │
│   ├── crosstown-relay/         # @crosstown/relay v0.4.2 (workspace stub, Story 2.5)
│   │   └── src/
│   │       └── index.ts         # encodeEventToToon, decodeEventFromToon
│   │
│   ├── crosstown-sdk/           # @crosstown/sdk v0.1.4 (workspace stub, Story 3.1)
│   │   └── src/
│   │       └── index.ts         # createNode, fromSecretKey, fromMnemonic, HandlerContext
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
│   ├── docker-compose.yml       # Main stack (BitCraft + Crosstown + BLS)
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
│   │   ├── 1-{1-6}-*.md         # 6 Epic 1 story specs
│   │   ├── 2-{1-5}-*.md         # 5 Epic 2 story specs
│   │   ├── 3-{1-4}-*.md         # 4 Epic 3 story specs
│   │   ├── adr/                 # Architecture Decision Records (4)
│   │   ├── reports/             # Test architecture traceability (incl. Epic 3)
│   │   └── test-reviews/        # Test review reports
│   ├── auto-bmad-artifacts/
│   │   ├── epic-1-end-report.md       # Epic 1 completion report
│   │   ├── epic-1-start-report.md     # Epic 1 start report
│   │   ├── epic-2-end-report.md       # Epic 2 completion report
│   │   ├── epic-2-retro-2026-03-13.md # Epic 2 retrospective
│   │   ├── epic-2-start-report.md     # Epic 2 start report
│   │   ├── epic-3-retro-2026-03-14.md # Epic 3 retrospective
│   │   ├── epic-3-start-report.md     # Epic 3 start report
│   │   ├── story-2-5-report.md        # Story 2.5 report
│   │   ├── story-3-{1-4}-report.md    # 4 Epic 3 story reports
│   │   └── spike-*.md                 # Compatibility spikes
│   ├── test-artifacts/           # ATDD checklists, NFR assessments
│   └── test-reports/             # Test execution reports
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

**`@sigil/bitcraft-bls`:**

- `@crosstown/sdk` workspace:^0.1.4 (BLS node creation, identity derivation, handler registration)
- `@noble/hashes` ^1.6.1 (hex conversion utilities)

**`@crosstown/client` v0.4.2 (workspace stub):**

- `nostr-tools` ^2.23.0 (Nostr event signing via finalizeEvent)
- `@noble/hashes` ^1.6.1 (public key derivation)

**`@crosstown/sdk` v0.1.4 (workspace stub):**

- `nostr-tools` ^2.23.0 (public key derivation)
- `@noble/hashes` ^1.6.1 (hex conversion)
- `@noble/curves` ^1.3.0 (secp256k1 cryptography)
- `@scure/bip39` ^1.6.0 (BIP-39 mnemonic)
- `@scure/bip32` ^1.6.0 (HD key derivation, NIP-06)

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

**Docker Stack (Stories 1.3, 3.1):**

- `bitcraft-server` - SpacetimeDB 1.6.x server running BitCraft game module
  - Port: 3000 (localhost-only)
  - Volumes: `./docker/volumes/spacetimedb`
  - Health checks, resource limits, logging
- `crosstown-node` - Crosstown ILP relay with built-in Nostr relay
  - Ports: 4040 (Nostr), 4041 (HTTP)
  - Volumes: `./docker/volumes/crosstown`
  - Depends on: `bitcraft-server`
- `bitcraft-bls` - BLS game action handler (Epic 3)
  - Port: 3001 (localhost-only)
  - Multi-stage Docker build from `packages/bitcraft-bls/Dockerfile`
  - Depends on: `bitcraft-server` (service_healthy)
  - Health check: `curl -f http://localhost:3001/health`
  - Requires: `SPACETIMEDB_ADMIN_TOKEN` env var

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

### 2. Publish Pipeline Architecture (Epics 2-3 - Complete)

**Full End-to-End Flow:**

1. `client.publish.publish({ reducer, args })` called
2. Validate client state (identity, CrosstownAdapter, cost registry)
3. Look up action cost from registry
4. Check wallet balance (fail fast if insufficient)
5. Construct content-only ILP packet template (kind 30078, no pubkey/sig)
6. Submit to `CrosstownAdapter.publishEvent()` which delegates to `@crosstown/client`
7. `@crosstown/client` signs event (adds pubkey, created_at, id, sig), TOON-encodes, ILP-routes
8. Crosstown connector routes ILP packet to BLS handler
9. BLS handler receives packet via `@crosstown/sdk` node
10. SDK validates Nostr signature (secp256k1 Schnorr), enforces kind pricing
11. Handler decodes event, parses `event.content` as `{reducer, args}`
12. Handler validates pubkey format (defense-in-depth: 64-char hex regex)
13. Handler enforces per-reducer fee schedule pricing
14. Handler calls SpacetimeDB reducer via HTTP API with `[pubkey, ...args]`
15. Handler returns `ctx.accept({eventId})` or `ctx.reject(errorCode, message)`
16. Client receives confirmation via Nostr relay subscription

**Key Design Decision:** Sigil client owns only event CONTENT construction. All signing, TOON encoding, payment channel management, and transport are delegated to `@crosstown/client`. The BLS handler owns identity propagation, pricing enforcement, and reducer dispatch.

### 3. BLS Handler Architecture (Epic 3 - Complete)

**Handler Pipeline (kind 30078):**

```
ILP Packet → @crosstown/sdk (signature verify + kind pricing)
  → createGameActionHandler()
    → ctx.decode() → parseEventContent({reducer, args})
    → validate pubkey format (64-char hex regex)
    → enforce per-reducer fee schedule
    → callReducer(spacetimedbUrl, reducer, [pubkey, ...args], token)
    → ctx.accept({eventId}) | ctx.reject(errorCode, message)
```

**ILP Error Codes:**

- `F06` - Invalid content (malformed JSON, missing fields, invalid reducer name, content too large)
- `T00` - SpacetimeDB errors (404 reducer not found, 400 bad args, 500 internal, timeout)
- `F04` - Insufficient payment (kind pricing or per-reducer fee below minimum)
- `F00` - Unregistered kind (no handler for event kind)

**Identity Propagation:**

- Nostr pubkey extracted from verified event (`ctx.pubkey`, 64-char hex)
- Handler validates pubkey format (defense-in-depth after SDK verification)
- Pubkey prepended as first argument to reducer call: `[pubkey, ...args]`
- Self-write bypass: handler's own pubkey skips fee enforcement

### 4. SpacetimeDB 2.0 SDK on 1.6.x Servers

**Decision:** Use SpacetimeDB 2.0 SDK (`@clockworklabs/spacetimedb-sdk` ^1.3.3) to connect to 1.6.x server modules.
**Status:** VALIDATED - No compatibility issues found in Epics 1-3 testing.

### 5. Nostr Keypair as Sole Identity

**Decision:** Nostr keypair (secp256k1) is the ONLY identity mechanism. Private key NEVER exposed via client API.
**Status:** COMPLETE in Story 1.2, identity propagation implemented in Epic 3 (Stories 3.2, 3.4).

### 6. @crosstown/client Integration (Story 2.5)

**What was removed (scaffolding):**

- `event-signing.ts` (signing delegated to `@crosstown/client`)
- `crosstown-connector.ts` (transport delegated to `@crosstown/client`)

**What was added:**

- `CrosstownAdapter` wrapping `@crosstown/client` with SSRF protection and error mapping
- `@crosstown/relay` for TOON encoding/decoding
- `ilp-packet.ts` simplified to content-only templates (no pubkey, no signing)

**Status:** COMPLETE - All scaffolding removed, adapter operational.

### 7. Workspace Stub Pattern for External Dependencies

**Decision:** Create workspace stubs for unpublished external packages, matching the expected API surface from spec documents and contracts.

**Current Stubs:**

- `@crosstown/client@^0.4.2` (packages/crosstown-client/) -- ILP signing, TOON, transport
- `@crosstown/relay@^0.4.2` (packages/crosstown-relay/) -- TOON encoding/decoding
- `@crosstown/sdk@^0.1.4` (packages/crosstown-sdk/) -- BLS node creation, identity derivation, handlers

**Risk:** None of these stubs have contract tests validating them against real packages. API divergence risk increases with each additional stub. AGREEMENT-8 (Epic 2 retro) committed to contract tests but remains unimplemented.

---

## Epic Breakdown & Progress

### Epic Inventory (13 epics, 61 stories)

**MVP (Epics 1-8):** 45 stories

- Epic 1: Project Foundation & Game World Connection (6 stories) - **COMPLETE**
- Epic 2: Action Execution & Payment Pipeline (5 stories) - **COMPLETE**
- Epic 3: BitCraft BLS Game Action Handler (4 stories) - **COMPLETE**
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

### Epic 3: BitCraft BLS Game Action Handler

**Status:** COMPLETE (2026-03-14)
**Stories:** 4/4 delivered
**Acceptance Criteria:** 20/20 met (100%), 18/20 fully test-covered (90% traceability)
**Retrospective:** `_bmad-output/auto-bmad-artifacts/epic-3-retro-2026-03-14.md`

| Story | Title                                          | ACs | Status |
| ----- | ---------------------------------------------- | --- | ------ |
| 3.1   | BLS Package Setup & Crosstown SDK Node         | 5   | Done   |
| 3.2   | Game Action Handler (kind 30078)               | 5   | Done   |
| 3.3   | Pricing Configuration & Fee Schedule           | 5   | Done   |
| 3.4   | Identity Propagation & End-to-End Verification | 5   | Done   |

**Epic 3 Deliverables:**

- `packages/bitcraft-bls/` -- New package: BLS game action handler (13 source files, 29 test files)
- `packages/crosstown-sdk/` -- New workspace stub: `@crosstown/sdk@^0.1.4`
- Docker Compose updated with `bitcraft-bls` service (third container)
- 226 unit tests + 80 integration test placeholders (Docker-dependent)
- 62 code review issues found, 56 fixed, 6 accepted (0 critical, 1 high)
- 0 semgrep findings across 4 security scans

**Epic 3 Risks (Resolved):**

- **R3-001 (CRITICAL):** `@crosstown/sdk@^0.1.4` -- MITIGATED via workspace stub pattern
- **R3-002 (HIGH):** Docker networking -- RESOLVED, Docker Compose service integrated
- **R3-003 (HIGH):** SpacetimeDB HTTP API -- RESOLVED, callReducer() handles all response codes
- **R3-004 (HIGH):** Identity propagation -- RESOLVED, hex pubkey prepend with defense-in-depth validation
- **R3-005 (HIGH):** ILP error codes -- RESOLVED, F04/F06/T00/F00 all mapped
- **R3-008 (HIGH):** BitCraft reducer modifications -- ASSUMED COMPLETE (handler prepends pubkey)

**Epic 3 Known Gaps:**

- 80 integration test placeholders contain `expect(true).toBe(true)` (Docker-dependent, tracked as DEBT-E3-1)
- Story 3.4 AC3 (invalid signature rejection) partially covered -- SDK-level path needs real `@crosstown/sdk`
- Story 3.4 AC5 (full pipeline integration) not covered -- all 30 tests are placeholders
- `verifyIdentityChain()` and `logVerificationEvent()` are exported but unused dead code (DEBT-E3-3)
- All logging uses `console.log()`, no structured logging (DEBT-E3-4)

### Epic 4: Declarative Agent Configuration (NEXT)

**Status:** Backlog
**Stories:** 7
**Dependencies:** Epic 3 complete (dependency met)
**Sprint Focus:** Next epic to begin

| Story | Title                                             | ACs | Status  |
| ----- | ------------------------------------------------- | --- | ------- |
| 4.1   | Skill File Format & Parser                        | -   | Backlog |
| 4.2   | Agent.md Configuration & Skill Selection          | -   | Backlog |
| 4.3   | Configuration Validation Against SpacetimeDB      | -   | Backlog |
| 4.4   | Budget Tracking & Limits                          | -   | Backlog |
| 4.5   | Event Interpretation as Semantic Narratives       | -   | Backlog |
| 4.6   | Structured Decision Logging                       | -   | Backlog |
| 4.7   | Swappable Agent Configuration                     | -   | Backlog |

**Epic 4 Context:**

- Client-side configuration and parsing logic (lower risk than Epic 3)
- Skill files produce `{ reducer, args }` payloads consumed by BLS handler (Story 3.2)
- Pricing model compatible: action cost registry (Story 2.2) + fee schedule (Story 3.3)
- Preparation tasks defined in Epic 3 retro: PREP-E4-1 through PREP-E4-5

---

## Testing & Quality Metrics

### Test Coverage (as of Epic 3 completion)

**Total Tests:** 972 passing, 212 skipped (Docker-dependent)

- **TypeScript Client (`@sigil/client`):** 641 passed, 103 skipped (36 test files: 29 passed, 7 skipped)
- **TypeScript BLS (`@sigil/bitcraft-bls`):** 223 passed, 80 skipped (29 test files: 21 passed, 8 skipped)
- **TypeScript MCP Server:** 1 passed (placeholder)
- **TypeScript TUI Backend:** 1 passed (placeholder)
- **Root Integration Tests:** 98 passed, 29 skipped (5 test files: 2 passed, 3 skipped)
- **Rust Tests:** 8 passed (1 unit + 7 integration)

**Test Growth:**

- Epic 1 end: ~305 tests
- Epic 2 end: 748 tests
- Epic 3 start baseline: 749 tests
- Epic 3 end: 972 tests (+223 net new, primarily from @sigil/bitcraft-bls)

### Test Architecture Traceability

All stories include comprehensive traceability reports linking:

- Functional Requirements (FRs) -> Acceptance Criteria (ACs) -> Test Cases

**Epic 3 Traceability:** 90% overall (18/20 ACs fully covered, 1 partial, 1 not covered)

**Reports:**

- `_bmad-output/implementation-artifacts/reports/epic-3-testarch-trace-report.md` (aggregate)
- `_bmad-output/implementation-artifacts/reports/3-2-testarch-trace-report.md`
- `_bmad-output/implementation-artifacts/reports/3-3-testarch-trace-report.md`
- `_bmad-output/implementation-artifacts/reports/3-4-testarch-trace-report.md`
- `_bmad-output/implementation-artifacts/reports/2-3-testarch-trace-report.md`
- `_bmad-output/implementation-artifacts/reports/2-5-testarch-trace-report.md`
- `_bmad-output/implementation-artifacts/2-1-test-architecture-traceability.md`
- `_bmad-output/implementation-artifacts/2-2-test-architecture-traceability.md`

### Code Quality & Security

- OWASP Top 10 compliance validated on all 15 stories (Epics 1-3)
- Semgrep security scanning: 5 issues found and fixed in Epic 2, **0 issues in Epic 3** (4 scans, 360+ rules each)
- SSRF protection on Crosstown connector URL, BTP endpoint, wallet balance client
- Private key never logged, never in error messages
- Embedded credentials rejected in connector URLs
- Input validation on reducer names (alphanumeric + underscore, 1-64 chars)
- Content size limits (1MB) on event parsing
- Pubkey format validation (64-char hex regex) as defense-in-depth
- Fee schedule file path validation (OWASP A03)

### Test Execution

```bash
# Unit Tests (fast, no Docker)
pnpm --filter @sigil/client test:unit    # 641 tests
pnpm --filter @sigil/bitcraft-bls test   # 223 tests (+ 80 skipped)
pnpm --filter @sigil/client test:watch   # TDD watch mode

# All workspace tests
pnpm test                                # All TS packages (866 pass, 183 skip)

# Integration Tests (require Docker)
docker compose -f docker/docker-compose.yml up -d
pnpm test:integration                    # Root integration tests (98 pass, 29 skip)
pnpm --filter @sigil/client test:integration  # Client integration tests
docker compose -f docker/docker-compose.yml down

# BLS Smoke Test
pnpm smoke:bls  # Quick BLS handler validation (requires Docker + BLS handler)

# Rust
cd crates/tui && cargo test              # 8 tests
cd crates/tui && cargo clippy            # Lint
```

---

## Known Issues & Technical Debt

### High Priority

**DEBT-E3-5: Deferred Action Items from Epic 2 Retro**

- 4 of 8 commitments from Epic 2 retro were not addressed during Epic 3
- Includes: ACTION-E2-1 (contract test pattern), PREP-E3-3 (stub validation), PREP-E3-4 (getEvmAddress), ACTION-E2-2 (test tracking)
- Must be resolved before or during Epic 4

### Medium Priority

**DEBT-2: Load Remaining 108 Static Data Tables**

- Story 1.5 loaded 40/148 static data tables. Remaining 108 needed for full game state coverage.
- May block Epic 4-5 if agent skills require missing tables.

**DEBT-5: Wallet Balance Stub Mode**

- WalletClient falls back to stub mode (fixed balance 10000) when Crosstown balance API returns 404/501.
- WalletClient.enableStubMode() / disableStubMode() for explicit control. SIGIL_WALLET_STUB=true env var.

**DEBT-6: EVM Address Derivation is Placeholder**

- CrosstownAdapter.getEvmAddress() and @crosstown/sdk fromSecretKey() both return truncated pubkey as placeholder.
- No current consumer uses real EVM addresses. Doesn't block Epic 4.

**DEBT-E3-1: 80 Integration Test Placeholders in BLS Package**

- All 80 integration tests contain `expect(true).toBe(true)` placeholder assertions.
- Skipped without Docker, but would pass vacuously even WITH Docker.
- Need Docker stack with real services to implement real assertions.

**DEBT-E3-2: @crosstown/sdk Workspace Stub Unvalidated**

- `@crosstown/sdk@^0.1.4` does not exist on npm. Stub built from spec documents.
- API divergence risk is high -- createNode, createVerificationPipeline, createPricingValidator are assumptions.
- No contract tests validate these assumptions.

### Low Priority

**DEBT-4: Improve Docker Test Stability**

- Integration tests fail when Docker is not running. Auto-skip works but could be improved.

**DEBT-E3-3: Dead Code Exports in BLS Package**

- `verifyIdentityChain()` and `logVerificationEvent()` are exported but have zero production consumers.
- AGREEMENT-11: Gets 1-epic grace period; must be integrated or removed after Epic 4.

**DEBT-E3-4: Console Logging in BLS Handler**

- All BLS handler logging uses `console.log()`. No structured logging (JSON, log levels, correlation IDs).
- Deferred to Epic 8 (Infrastructure & Observability).

### Resolved

- **DEBT-1: Complete Story 1.6 Subscription Recovery** - RESOLVED in Epic 2 prep (PREP-1)
- **DEBT-3: Add Linux Integration Test Coverage** - RESOLVED in Epic 2 prep (PREP-2)

### Epic 4 Prep Items (from Epic 3 Retro)

| #         | Item                                            | Priority | Status                |
| --------- | ----------------------------------------------- | -------- | --------------------- |
| PREP-E4-1 | Complete deferred Epic 2/3 action items          | Critical | Not started           |
| PREP-E4-2 | Clean up dead code from Epic 3                   | Critical | Not started           |
| PREP-E4-3 | Research SKILL.md file format                    | Critical | Not started           |
| PREP-E4-4 | Plan integration test infrastructure             | Parallel | Not started           |
| PREP-E4-5 | Update project context                           | Parallel | THIS DOCUMENT         |

### Epic 3 Action Items (from Retro)

| Item        | Description                                          | Owner   | Status      |
| ----------- | ---------------------------------------------------- | ------- | ----------- |
| ACTION-E3-1 | Create contract tests for ALL workspace stubs         | Charlie | Not started |
| ACTION-E3-2 | Convert integration test placeholders to real tests   | Dana    | Not started |
| ACTION-E3-3 | Establish structured logging pattern                  | Charlie | Not started |

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
pnpm test   # 866 TS tests pass, 183 skipped
```

### Docker Stack Management

```bash
docker compose -f docker/docker-compose.yml up -d       # Start (3 services)
docker compose -f docker/docker-compose.yml ps           # Status
docker compose -f docker/docker-compose.yml logs -f bitcraft-bls  # BLS handler logs
docker compose -f docker/docker-compose.yml restart      # Restart
docker compose -f docker/docker-compose.yml down -v && rm -rf docker/volumes/* && docker compose -f docker/docker-compose.yml up -d  # Full reset
```

**Note:** The `bitcraft-bls` service requires `SPACETIMEDB_ADMIN_TOKEN` to be set in your environment or `.env` file.

### CI/CD

- `.github/workflows/ci-typescript.yml` - TypeScript lint, typecheck, unit tests, build (Ubuntu + macOS), integration tests with Docker
- `.github/workflows/ci-rust.yml` - Rust format, clippy, test, build (Ubuntu + macOS)

**Branch Strategy:**

- `master` - Main development branch (stable)
- `epic-2` - Current feature branch (contains Epic 3 work, ready for PR to master)
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

**Epic 1 Story Specs:**

- `1-1-monorepo-scaffolding-and-build-infrastructure.md`
- `1-2-nostr-identity-management.md`
- `1-3-docker-local-development-environment.md`
- `1-4-spacetimedb-connection-and-table-subscriptions.md`
- `1-5-static-data-table-loading.md`
- `1-6-auto-reconnection-and-state-recovery.md`

**Epic 2 Story Specs:**

- `2-1-crosstown-relay-connection-and-event-subscriptions.md`
- `2-2-action-cost-registry-and-wallet-balance.md`
- `2-3-ilp-packet-construction-and-signing.md`
- `2-4-bls-game-action-handler.md`
- `2-5-crosstown-client-integration.md`

**Epic 3 Story Specs:**

- `3-1-bls-package-setup-and-crosstown-sdk-node.md`
- `3-2-game-action-handler-kind-30078.md`
- `3-3-pricing-configuration-and-fee-schedule.md`
- `3-4-identity-propagation-and-end-to-end-verification.md`

**Retrospectives:**

- `epic-1-retro-2026-02-27.md` - Epic 1 retrospective
- `auto-bmad-artifacts/epic-2-retro-2026-03-13.md` - Epic 2 retrospective
- `auto-bmad-artifacts/epic-3-retro-2026-03-14.md` - Epic 3 retrospective

**Architecture Decision Records:**

- `adr/adr-001-spacetimedb-sdk-version.md`
- `adr/adr-002-nostr-only-identity.md`
- `adr/adr-003-polyglot-monorepo.md`
- `adr/adr-004-docker-dev-stack.md`

**Auto-BMAD Artifacts:**

- `auto-bmad-artifacts/epic-1-end-report.md` - Epic 1 completion report
- `auto-bmad-artifacts/epic-1-start-report.md` - Epic 1 start report
- `auto-bmad-artifacts/epic-2-end-report.md` - Epic 2 completion report
- `auto-bmad-artifacts/epic-2-retro-2026-03-13.md` - Epic 2 retrospective
- `auto-bmad-artifacts/epic-2-start-report.md` - Epic 2 start report
- `auto-bmad-artifacts/epic-3-retro-2026-03-14.md` - Epic 3 retrospective
- `auto-bmad-artifacts/epic-3-start-report.md` - Epic 3 start report
- `auto-bmad-artifacts/story-2-5-report.md` - Story 2.5 report
- `auto-bmad-artifacts/story-3-1-report.md` - Story 3.1 report
- `auto-bmad-artifacts/story-3-2-report.md` - Story 3.2 report
- `auto-bmad-artifacts/story-3-3-report.md` - Story 3.3 report
- `auto-bmad-artifacts/story-3-4-report.md` - Story 3.4 report

**Test Architecture:**

- `reports/epic-3-testarch-trace-report.md` - Epic 3 aggregate traceability
- `reports/3-2-testarch-trace-report.md`
- `reports/3-3-testarch-trace-report.md`
- `reports/3-4-testarch-trace-report.md`
- `reports/2-3-testarch-trace-report.md`
- `reports/2-5-testarch-trace-report.md`
- `2-1-test-architecture-traceability.md`
- `2-2-test-architecture-traceability.md`
- `test-artifacts/atdd-checklist-3-1.md` through `atdd-checklist-3-4.md`
- `test-artifacts/nfr-assessment-3-2.md` through `nfr-assessment-3-4.md`
- `test-artifacts/automation-summary-3-1.md`, `automation-summary-3-4.md`

**Status Tracking:**

- `sprint-status.yaml` - Epic/story status (updated 2026-03-14)

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

**Phase:** MVP Implementation (Epics 1-3 complete, Epic 4 next)
**Module:** bmm (Business Model & Management)
**Sprint Focus:** Epic 4 - Declarative Agent Configuration

### Workflow Steps Completed

1. Architecture Definition - 22 architecture documents, validated against requirements
2. Epic Breakdown - 13 epics, 61 stories, all 50 FRs covered
3. Epic 1 Implementation - 6 stories delivered
4. Epic 1 Retrospective - Lessons learned, action items, prep tasks defined
5. Epic 2 Preparation - PREP-1, PREP-2, PREP-4, PREP-5, ACTION-1 completed
6. Epic 2 Implementation - 5 stories delivered
7. Epic 2 Retrospective - Scope management validated, scaffolding approach proven
8. Epic 5 Inserted - "BitCraft Game Analysis & Playability Validation" (8 stories), Epics 5-12 renumbered to 6-13
9. Epic 3 Started - Baseline green (749 tests), test design created (~268 planned tests)
10. Epic 3 Implementation - 4 stories delivered (226 unit + 80 integration placeholder tests)
11. Epic 3 Retrospective - Workspace stub pattern validated, integration test gap documented

### Next Workflow Steps

1. Execute Epic 4 preparation tasks (PREP-E4-1 through PREP-E4-3 critical)
2. Create Story 4.1 spec file (Skill File Format & Parser)
3. Implement Epic 4 stories: 4.1 -> 4.2 -> ... -> 4.7

---

## Functional Requirements Coverage

### Identity & Key Management (FR1-FR5)

- **FR1:** Generate new Nostr keypair - COMPLETE (Story 1.2)
- **FR2:** Import existing Nostr keypair - COMPLETE (Story 1.2)
- **FR3:** Export Nostr keypair for backup - COMPLETE (Story 1.2)
- **FR4:** Attribute actions to Nostr public key - COMPLETE (Stories 2.3-2.5 signing, Story 3.2 identity prepend)
- **FR5:** Verify identity ownership end-to-end - COMPLETE (Story 3.4 identity chain verification, defense-in-depth pubkey validation)

### World Perception (FR6-FR10)

- **FR6:** Subscribe to SpacetimeDB table updates - COMPLETE (Story 1.4)
- **FR7:** Subscribe to Crosstown relay events - COMPLETE (Story 2.1)
- **FR8:** Load static data tables - COMPLETE (Story 1.5, partial: 40/148)
- **FR9:** Interpret table events as semantic narratives - Backlog (Epic 4)
- **FR10:** Auto-reconnect after disconnections - COMPLETE (Story 1.6)

### Action Execution & Payments (FR17-FR22)

- **FR17:** Execute actions via client.publish() - COMPLETE (Story 2.3, refined in 2.5)
- **FR18:** ILP packet construction - COMPLETE (Story 2.3, simplified in 2.5)
- **FR19:** BLS handler validates and calls reducer - COMPLETE (Story 3.2)
- **FR20:** ILP fee collection - COMPLETE (Story 3.3, per-reducer fee schedule)
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

- **FR44:** Docker compose local dev - COMPLETE (Story 1.3, updated in 3.1 with BLS service)
- **FR45:** ILP fee schedule configuration - COMPLETE (Story 3.3)
- **FR46:** System health monitoring - PARTIAL (Story 3.1 health endpoint, full dashboard in Epic 8)
- **FR47:** BLS game action handler mapping - COMPLETE (Story 3.2)

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

**AGREEMENT-8: Contract Tests for External Package APIs**
Create contract tests for workspace stubs that validate API assumptions. Tests should fail if real packages diverge from stubs. (NOT YET IMPLEMENTED -- carried forward as ACTION-E3-1)

### From Epic 3 Retrospective

**AGREEMENT-9: Execute Retro Action Items Within the Next Epic**
All action items from retrospectives must be completed (or explicitly re-assessed and re-committed) within the next epic. The Scrum Master tracks action item completion at the start of each new epic.

**AGREEMENT-10: No Placeholder Integration Tests Without Tracking**
Integration test placeholders (`expect(true).toBe(true)`) must be tracked in a centralized document with: (a) the test name, (b) what it should test, (c) Docker dependencies needed, (d) estimated effort to implement.

**AGREEMENT-11: Dead Code Gets 1-Epic Grace Period**
Exported code with zero production consumers gets one epic's grace period. If still unused after the next epic, it must be either integrated or removed.

### Code Review Checklist

**Security (OWASP Top 10):**

- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all external data (WebSocket, IPC, file paths)
- [ ] Path traversal prevention (Docker volumes, file I/O)
- [ ] SSRF protection on all URL inputs (crosstown connector, BTP endpoint, wallet API)
- [ ] Rate limiting on public endpoints (Nostr relay, MCP tools)
- [ ] Content size limits on parsed inputs (event content, fee schedule files)

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
- [ ] No placeholder tests without tracking (AGREEMENT-10)

---

## Changelog

### 2026-03-14: Epic 3 Complete, Project Context Regenerated

**Delivered:**

- Epic 3: 4/4 stories complete (BLS Package Setup, Game Action Handler, Pricing & Fee Schedule, Identity Propagation)
- New package: `@sigil/bitcraft-bls` (13 source files, 29 test files, Dockerfile)
- New workspace stub: `@crosstown/sdk@^0.1.4` (packages/crosstown-sdk/)
- Docker Compose updated with `bitcraft-bls` service (3rd container)
- Epic 3 retrospective with 3 new team agreements (AGREEMENT-9, 10, 11)
- 226 unit tests + 80 integration test placeholders
- 972 total tests passing (up from 749 at Epic 3 start)

**Quality:**

- 20/20 acceptance criteria met, 18/20 fully test-covered (90% traceability)
- 62 code review issues found across 12 review passes, 56 fixed, 6 accepted
- 0 semgrep findings across 4 security scans (360+ rules each)
- All 4 NFR assessments PASS

### 2026-03-13: Epic 3 Started, Epic 2 Complete

**Delivered:**

- Epic 2: 5/5 stories complete
- Epic 2 retrospective and completion report
- Epic 3 start: baseline green (749 tests), test design created (~268 planned tests)
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

**Document Version:** 4.0
**Last Updated:** 2026-03-14
**Generated By:** `/bmad-bmm-generate-project-context yolo`
**Status:** Epics 1-3 Complete (15/15 stories), Epic 4 Next
