# Project Structure & Boundaries

## Complete Project Directory Structure

```
sigil/
├── .github/
│   └── workflows/
│       ├── ci-typescript.yml          # TS: lint, typecheck, test, build
│       ├── ci-rust.yml                # Rust: clippy, rustfmt, test, build
│       └── release.yml                # Package publishing
├── .env.example                       # Environment template (SpacetimeDB URL, Crosstown URL, etc.)
├── .gitignore
├── .eslintrc.cjs                      # Shared ESLint config (root)
├── .prettierrc                        # Shared Prettier config (root)
├── rustfmt.toml                       # Shared Rust formatter config
├── pnpm-workspace.yaml                # pnpm workspace: packages/*
├── package.json                       # Root: scripts, devDependencies (lint, format)
├── tsconfig.base.json                 # Shared TypeScript base config
├── Cargo.toml                         # Virtual manifest: members = ["crates/*"]
├── Cargo.lock
├── LICENSE
│
├── packages/                          # ═══ TypeScript (pnpm workspace) ═══
│   │
│   ├── client/                        # @sigil/client — pure library (the engine)
│   │   ├── package.json               # name: "@sigil/client"
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts               # Barrel: public API surface
│   │   │   ├── client.ts              # SigilClient class — main entry point
│   │   │   ├── types.ts               # Shared types: SigilClientOptions, events, enums
│   │   │   ├── errors.ts              # SigilError class, error codes, boundary enum
│   │   │   ├── spacetimedb/
│   │   │   │   ├── index.ts           # FR6-FR10: client.spacetimedb surface
│   │   │   │   ├── connection.ts      # SpacetimeDB 1.x WebSocket connection manager
│   │   │   │   ├── subscriptions.ts   # Table subscription management
│   │   │   │   ├── reconnect.ts       # Auto-reconnect with exponential backoff
│   │   │   │   ├── static-data.ts     # *_desc table loader (FR8)
│   │   │   │   └── connection.test.ts
│   │   │   ├── nostr/
│   │   │   │   ├── index.ts           # FR1-FR5, FR7: client.nostr surface
│   │   │   │   ├── keypair.ts         # Generate, import, export Nostr keypairs
│   │   │   │   ├── relay.ts           # Nostr relay connection (Crosstown built-in relay)
│   │   │   │   ├── subscriptions.ts   # Relay event subscriptions and filters
│   │   │   │   └── keypair.test.ts
│   │   │   ├── publish/
│   │   │   │   ├── index.ts           # FR17-FR22: client.publish() write path
│   │   │   │   ├── publisher.ts       # Signs action → ILP packet → Crosstown → BLS
│   │   │   │   ├── cost-registry.ts   # Action cost lookup (FR22)
│   │   │   │   ├── wallet.ts          # ILP wallet balance queries (FR21)
│   │   │   │   ├── crosstown-adapter.ts # Wraps @crosstown/client (CrosstownClient lifecycle, publishEvent)
│   │   │   │   ├── bls-proxy.ts       # Identity propagation proxy (Nostr pubkey injection)
│   │   │   │   └── publisher.test.ts
│   │   │   ├── skills/
│   │   │   │   ├── index.ts           # FR11-FR14: Skill file parsing
│   │   │   │   ├── skill-loader.ts    # SKILL.md file loader and validator
│   │   │   │   └── skill-loader.test.ts
│   │   │   └── schemas/
│   │   │       └── ipc-messages.json  # JSON schema for IPC protocol (shared with Rust)
│   │   └── tests/
│   │       └── integration/
│   │           ├── spacetimedb-connection.test.ts
│   │           └── publish-roundtrip.test.ts
│   │
│   ├── mcp-server/                    # Standalone MCP server
│   │   ├── package.json               # name: "@sigil/mcp-server"
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point: MCP server startup
│   │   │   ├── server.ts              # MCP server configuration and transport setup
│   │   │   ├── tools/
│   │   │   │   ├── index.ts           # Tool registration (maps skills → MCP tools)
│   │   │   │   ├── game-actions.ts    # MCP tools for game write actions (via @sigil/client)
│   │   │   │   └── world-queries.ts   # MCP tools for game read queries
│   │   │   ├── resources/
│   │   │   │   ├── index.ts           # Resource registration
│   │   │   │   ├── players.ts         # sigil://players/{id}
│   │   │   │   ├── planets.ts         # sigil://planets/{id}
│   │   │   │   ├── teams.ts           # sigil://teams/{id}
│   │   │   │   └── inventory.ts       # sigil://inventory/{playerId}
│   │   │   └── tools/game-actions.test.ts
│   │   └── tests/
│   │       └── integration/
│   │           └── mcp-tool-execution.test.ts
│   │
│   ├── tui-backend/                   # TUI backend (IPC bridge for Rust TUI)
│   │   ├── package.json               # name: "@sigil/tui-backend"
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point: stdio IPC server
│   │   │   ├── ipc-server.ts          # JSON-RPC 2.0 handler over stdio
│   │   │   ├── methods/
│   │   │   │   ├── index.ts           # Method registration
│   │   │   │   ├── game-state.ts      # getGameState, subscribeUpdates
│   │   │   │   ├── player-actions.ts  # movePlayer, sendChat, manageInventory
│   │   │   │   ├── agent-control.ts   # startAgent, stopAgent, getAgentStatus
│   │   │   │   └── connection.ts      # connect, disconnect, getConnectionStatus
│   │   │   └── ipc-server.test.ts
│   │   └── tests/
│   │       └── integration/
│   │           └── ipc-roundtrip.test.ts
│   │
│   │   # NOTE: No headless-agent package. Headless agents use external
│   │   # agent SDKs (Claude, Vercel AI) connecting to @sigil/mcp-server,
│   │   # or import @sigil/client directly in custom TS code.
│   │
│   ├── bitcraft-bls/                  # BitCraft BLS — Crosstown node (game action handler)
│   │   ├── package.json               # name: "bitcraft-bls" (private, not published)
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── Dockerfile                 # Docker image for BLS container
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point: createNode(), handler registration, start
│   │   │   ├── config.ts              # Environment variable parsing (SPACETIMEDB_URL, TOKEN, etc.)
│   │   │   ├── handler.ts             # Kind 30078 handler: parse content, call SpacetimeDB reducer
│   │   │   ├── spacetimedb-client.ts  # SpacetimeDB HTTP API client (POST /database/bitcraft/call/{reducer})
│   │   │   └── types.ts               # Handler types, SpacetimeDB response types
│   │   └── tests/
│   │       ├── handler.test.ts        # Unit tests for game action handler logic
│   │       └── integration/
│   │           └── bls-e2e.test.ts    # End-to-end: publish → BLS → SpacetimeDB
│   │
│   └── examples/                      # Example agent configurations
│       ├── explorer/
│       │   ├── CLAUDE.md              # Explorer agent config (Claude)
│       │   └── AGENTS.md             # Explorer agent config (non-Claude)
│       ├── trader/
│       │   ├── CLAUDE.md
│       │   └── AGENTS.md
│       └── gatherer/
│           ├── CLAUDE.md
│           └── AGENTS.md
│
├── crates/                            # ═══ Rust (cargo workspace) ═══
│   │
│   └── tui/                           # ratatui TUI (presentation layer only)
│       ├── Cargo.toml                 # Dependencies: ratatui, crossterm, tokio, serde, serde_json
│       ├── src/
│       │   ├── main.rs                # Entry point: parse args, spawn TUI backend, start app
│       │   ├── app.rs                 # App struct: event loop, AppState, AppEvent
│       │   ├── tui.rs                 # Terminal setup: raw mode, alternate screen, FPS cap
│       │   ├── types.rs               # Type aliases, IPC message types (serde, rename_all camelCase)
│       │   ├── ipc/
│       │   │   ├── mod.rs             # IPC module
│       │   │   ├── client.rs          # JSON-RPC 2.0 client over stdio
│       │   │   ├── messages.rs        # Typed request/response/notification enums
│       │   │   └── transport.rs       # Stdio read/write with tokio
│       │   ├── ui/
│       │   │   ├── mod.rs             # UI module: Screen trait, UiCallback, UiState
│       │   │   ├── constants.rs       # UI_SCREEN_SIZE, style constants (UiStyle)
│       │   │   ├── ui_screen.rs       # Top-level view controller, tab navigation
│       │   │   ├── ui_callback.rs     # UiCallback enum → IPC dispatch
│       │   │   ├── ui_frame.rs        # UiFrame wrapper (centering, callback registry)
│       │   │   ├── traits.rs          # Screen, SplitPanel, InteractiveWidget traits
│       │   │   ├── button.rs          # Button widget (hotkeys, hover, disabled)
│       │   │   ├── clickable_list.rs  # Scrollable clickable list widget
│       │   │   ├── clickable_table.rs # Row-based clickable table widget
│       │   │   ├── popup_message.rs   # PopupMessage enum (Ok, Error, Confirm)
│       │   │   ├── widgets.rs         # Shared widget functions, bar renderers
│       │   │   ├── utils.rs           # Image-to-terminal, formatting helpers
│       │   │   └── panels/
│       │   │       ├── mod.rs
│       │   │       ├── splash_screen.rs    # Title screen
│       │   │       ├── world_panel.rs      # Galaxy/planet view (FR28)
│       │   │       ├── player_panel.rs     # Character status (FR32)
│       │   │       ├── inventory_panel.rs  # Inventory management (FR31)
│       │   │       ├── chat_panel.rs       # Chat messages (FR30)
│       │   │       ├── agent_panel.rs      # Agent observation dashboard
│       │   │       ├── market_panel.rs     # Trading (Phase 2, FR36)
│       │   │       └── status_bar.rs       # Connection status, wallet balance
│       │   └── event_handler.rs       # Input polling (crossterm events → AppEvent)
│       └── tests/
│           └── ipc_roundtrip.rs       # Integration test: mock TS backend
│
├── skills/                            # ═══ Shared SKILL.md files ═══
│   ├── bitcraft/                      # BitCraft v1 world skills
│   │   ├── move-player.md             # Skill: player_move reducer
│   │   ├── chat-message.md            # Skill: chat_post_message reducer
│   │   ├── gather-resource.md         # Skill: gather_* reducers
│   │   ├── craft-item.md              # Skill: craft_* reducers (Phase 2)
│   │   ├── trade-offer.md             # Skill: trade_* reducers (Phase 2)
│   │   └── build-structure.md         # Skill: build_* reducers (Phase 2)
│   └── README.md                      # How to write skill files for new worlds (FR48)
│
├── agents/                            # ═══ Agent definitions ═══
│   ├── CLAUDE.md                      # Default Claude agent configuration
│   └── AGENTS.md                      # Default non-Claude agent configuration
│
└── docker/                            # ═══ Infrastructure ═══
    ├── docker-compose.yml             # FR44: BitCraft server + Crosstown connector + BLS
    ├── docker-compose.dev.yml         # Dev overrides (hot reload, debug ports)
    ├── bitcraft-server/
    │   └── Dockerfile                 # BitCraft server (SpacetimeDB WASM module)
    └── crosstown/
        └── Dockerfile                 # Crosstown connector (ILP routing, Nostr relay)
    # NOTE: The BLS Dockerfile lives at packages/bitcraft-bls/Dockerfile
    # (first-party code, built from workspace). Docker compose references it
    # with build context pointing to the workspace package.
```

## Architectural Boundaries

**Boundary 1: `@sigil/client` → External Services**

- SpacetimeDB: WebSocket connection (subscription + reducer calls, SDK 1.x)
- Crosstown: via `@crosstown/client@^0.4.2` (npm) — ILP micropayments, TOON encoding, payment channels, multi-hop routing. `@sigil/client` is the **only** Sigil package that depends on `@crosstown/client`; MCP server and TUI backend access Crosstown through `client.publish()`
- Agent SDKs: HTTP to LLM providers (Anthropic API, OpenAI-compatible)
- All external errors wrapped with `boundary` field at this layer

**Boundary 1b: `packages/bitcraft-bls` → External Services**

- Crosstown SDK: via `@crosstown/sdk@^0.1.4` (npm) — node creation, handler dispatch, signature verification, pricing enforcement
- SpacetimeDB: HTTP API calls (`POST /database/bitcraft/call/{reducer}`) for reducer execution with identity propagation
- Crosstown Connector: embedded connector mode for zero-latency ILP packet delivery (or standalone HTTP mode)
- All handler errors returned via `ctx.reject(code, message)` using ILP error codes (F04, F06, T00)

**Boundary 2: TUI Backend → Rust TUI (IPC)**

- JSON-RPC 2.0 over stdio pipes
- TUI backend is the only TS process the Rust TUI communicates with
- All game state and actions flow through this single boundary
- Schema defined in `packages/client/schemas/ipc-messages.json`

**Boundary 3: MCP Server → MCP Clients**

- Standard MCP protocol (stdio transport)
- Claude, OpenCode, or any MCP-compatible client connects here
- MCP server uses `@sigil/client` internally for all game operations
- Tools = game actions, Resources = game state

**Boundary 4: `@sigil/client` → Consumers**

- Three consumers: tui-backend, headless-agent, harness
- All use the same `SigilClient` API
- Event-driven: consumers subscribe to typed events
- No consumer accesses SpacetimeDB/Crosstown/BLS directly

## Requirements to Structure Mapping

| FR Domain                       | Package/Crate                                   | Key Files                                                                       |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| **FR1-FR5: Identity**           | `packages/client/src/identity/`                 | `keypair.ts`, `signer.ts`                                                       |
| **FR6-FR10: Perception**        | `packages/client/src/perception/`               | `spacetimedb-client.ts`, `static-data.ts`, `reconnect.ts`                       |
| **FR11-FR16: Agent Config**     | `packages/client/src/agent/`                    | `agent-config.ts`, `skill-loader.ts`, `budget-tracker.ts`                       |
| **FR17-FR22: Actions/Payments** | `packages/client/src/actions/`, `src/payments/` | `action-executor.ts`, `crosstown-client.ts`, `bls-proxy.ts`, `cost-registry.ts` |
| **FR4,FR5,FR19,FR20,FR45,FR47: BLS** | `packages/bitcraft-bls/` | `handler.ts`, `spacetimedb-client.ts`, `config.ts` |
| **FR23-FR27: Cognition**        | External agent SDKs via `@sigil/mcp-server`     | MCP tools + `@sigil/client` direct import                                       |
| **FR28-FR38: TUI**              | `crates/tui/`, `packages/tui-backend/`          | `src/ui/panels/*.rs`, `src/methods/*.ts`                                        |
| **FR39-FR43: Experiments**      | External tooling consuming `@sigil/client`      | Phase 2 — JSONL logging built into client                                       |
| **FR44-FR47: Infrastructure**   | `docker/`                                       | `docker-compose.yml`, Dockerfiles                                               |
| **FR48-FR50: Extensibility**    | `skills/`                                       | Skill files per world, `README.md` authoring guide                              |

## Cross-Cutting Concerns Mapping

| Concern                  | Locations                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identity propagation** | `client/src/identity/` → `client/src/payments/bls-proxy.ts` → `client/src/actions/action-executor.ts`                                                                         |
| **Error handling**       | `client/src/errors.ts` (defines) → all `client/src/*/` (throws) → `tui-backend/src/ipc-server.ts` (wraps as JSON-RPC error) → `crates/tui/src/ui/popup_message.rs` (displays) |
| **Logging**              | `headless-agent/src/logger.ts` (decision JSONL) + `client/src/` (system logs via structured JSONL)                                                                            |
| **Budget tracking**      | `client/src/agent/budget-tracker.ts` → `client/src/actions/action-executor.ts` (enforces) → `crates/tui/src/ui/panels/status_bar.rs` (displays)                               |
| **Connection lifecycle** | `client/src/perception/reconnect.ts` → events emitted to all consumers → `tui-backend/` relays to TUI → `crates/tui/src/ui/panels/status_bar.rs` (displays)                   |

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SpacetimeDB Server                          │
│  (BitCraft WASM module, ~80 tables, 364+ reducers)                 │
│  (reducers modified to accept identity: String as first param)     │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │ WebSocket (subscriptions, SDK 1.x) │ HTTP POST /call/{reducer}
           ▼                                   ▲
┌────────────────────────────────────────────┐ │
│              @sigil/client                 │ │
│  client.spacetimedb ◄── table updates      │ │
│  client.nostr ◄── relay events             │ │
│  client.publish() ──► CrosstownClient      │ │
│    .publishEvent()  ──► ILP packet ──┐     │ │
│  client.identity ── Nostr keypair    │     │ │
└───────────────┬──────────────┬───────│─────┘ │
                │ imported by  │       │       │
                ▼              ▼       │       │
    ┌────────────────┐ ┌────────────┐  │       │
    │@sigil/          │ │@sigil/     │  │       │
    │tui-backend      │ │mcp-server  │  │       │
    │(JSON-RPC)       │ │(MCP)       │  │       │
    └───────┬─────────┘ └─────┬──────┘  │       │
            │ stdio IPC       │ MCP     │       │
            ▼                 ▲         │       │
    ┌────────────┐  ┌──────────────┐    │       │
    │ sigil-tui  │  │ Claude / any │    │       │
    │ (ratatui)  │  │ MCP agent    │    │       │
    └────────────┘  └──────────────┘    │       │
                                        ▼       │
                              ┌─────────────────┤
                              │ bitcraft-bls     │
                              │ (@crosstown/sdk) │
                              │  ┌─verify sig    │
                              │  ├─check pricing │
                              │  └─handler:      │
                              │    parse content  │
                              │    prepend pubkey │
                              │    call reducer ──┘
                              └─────────────────┘
```

## Development Workflow

**First-time setup:**

```bash
pnpm install                    # Install all TS dependencies
cargo build                     # Build Rust TUI
docker compose -f docker/docker-compose.dev.yml up  # Start BitCraft + Crosstown
```

**Development (TUI):**

```bash

```
