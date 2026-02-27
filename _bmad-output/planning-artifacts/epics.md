---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd/index.md'
  - '_bmad-output/planning-artifacts/architecture/index.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# Sigil - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Sigil, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Identity & Key Management**

- FR1: Users can generate a new Nostr keypair for use as their sole identity across all SDK interactions
- FR2: Users can import an existing Nostr keypair from a file or seed phrase
- FR3: Users can export their Nostr keypair for backup and recovery
- FR4: The system attributes every game action to the authoring Nostr public key via BLS identity propagation to SpacetimeDB
- FR5: Users can verify their identity ownership is cryptographically intact end-to-end (signed ILP packet -> BLS verification -> reducer attribution)

**World Perception**

- FR6: All consumers of `@sigil/client` (MCP server, TUI backend) can subscribe to SpacetimeDB table updates in real-time via WebSocket
- FR7: All consumers of `@sigil/client` can subscribe to Crosstown relay events (via its built-in Nostr relay) for action confirmations and system notifications
- FR8: Agents can load static data tables (`*_desc` tables) and build queryable lookup maps (StaticDataLoader)
- FR9: Agents can receive raw table update events and interpret them as semantic narratives (EventInterpreter)
- FR10: The system automatically reconnects and recovers subscription state after disconnections

**Agent Configuration & Skills**

- FR11: Researchers can define agent behavior entirely through an `Agent.md` configuration file with zero application code
- FR12: Researchers can select which skills an agent uses by referencing skill files in Agent.md
- FR13: Skill files can declare the target reducer, parameters, ILP cost, required table subscriptions, and natural-language usage guidance
- FR14: The system validates Agent.md and skill files against the connected SpacetimeDB module's available reducers and tables
- FR15: Researchers can set budget limits per agent in Agent.md to cap ILP spending
- FR16: Researchers can configure which LLM backend an agent uses in Agent.md (Phase 2)

**Action Execution & Payments**

- FR17: All consumers of `@sigil/client` can execute game actions by sending signed ILP packets through the Crosstown connector (via `client.publish()`)
- FR18: The system constructs ILP packets containing the game action, signs them with the user's Nostr key, and routes them through the Crosstown node
- FR19: The BLS handler receives ILP packets, validates signatures, extracts the Nostr public key and game action, and calls the corresponding SpacetimeDB reducer with identity propagation
- FR20: The system collects ILP fees on every routed game action
- FR21: Users can query their current ILP wallet balance
- FR22: Users can view the cost of any action before executing it via the action cost registry

**Agent Cognition**

- FR23: Agents can make autonomous decisions using MCP tools for game perception and action execution
- FR24: Agents can make autonomous decisions using LLM-powered reasoning with configurable providers (Phase 2)
- FR25: Agents can maintain persistent memory across sessions (Phase 2)
- FR26: Agents can detect available actions and estimate cost/reward for each (AffordanceEngine — Phase 2)
- FR27: Researchers can swap agent behavior by editing Agent.md and skill files without code changes

**Terminal Game Client (TUI)**

- FR28: Players can view the game world as a rendered hex-grid map with terrain, resources, and other players in their terminal
- FR29: Players can move their character across the hex grid using keyboard controls
- FR30: Players can send and receive chat messages with other players
- FR31: Players can view and manage their inventory
- FR32: Players can view their character status (health, position, skills, empire membership)
- FR33: Players can engage in combat with game entities and other players (Phase 2)
- FR34: Players can craft items using recipes and gathered resources (Phase 2)
- FR35: Players can construct and manage buildings on claimed territory (Phase 2)
- FR36: Players can create and respond to trade offers with other players (Phase 2)
- FR37: Players can participate in empire management (join, create, govern, diplomacy) (Phase 2)
- FR38: The TUI renders at 30+ FPS and works over SSH connections

**Experiment & Analysis**

- FR39: Agents produce structured decision logs (JSONL) capturing observations, deliberations, actions, costs, and outcomes with timestamps
- FR40: Researchers can run multiple agents concurrently against the same world (Phase 2)
- FR41: Researchers can configure and launch experiments from YAML configuration files (Phase 2)
- FR42: Researchers can snapshot and restore world state for reproducible experiments (Phase 2)
- FR43: Researchers can compare decision logs across experiment runs with different agent configurations or LLM backends (Phase 2)

**Infrastructure & Deployment**

- FR44: Operators can deploy a local development environment (game server + Crosstown node) via Docker compose
- FR45: Operators can configure ILP fee schedules for different action types
- FR46: Operators can monitor system health: ILP packets per second, fee revenue, BLS validation latency, SpacetimeDB load, identity propagation success rate
- FR47: The BLS game action handler maps incoming ILP packets to the correct SpacetimeDB reducers with identity propagation

**World Extensibility**

- FR48: Game developers can make a new SpacetimeDB world agent-accessible by writing skill files for its public reducers and table subscriptions — no SDK code changes required (Phase 2)
- FR49: Game developers can register a Crosstown BLS handler for their SpacetimeDB module's reducers (Phase 2)
- FR50: The system can auto-generate skeleton skill files from a SpacetimeDB module's published schema (Phase 3)

### NonFunctional Requirements

**Performance**

- NFR1: TUI client renders at 30+ FPS in a 160x48 terminal viewport with hex map, status panels, and chat visible simultaneously
- NFR2: TUI client remains responsive (< 50ms input-to-render latency) over SSH connections with up to 200ms network latency
- NFR3: ILP packet round-trip (SDK sends -> Crosstown routes -> BLS executes reducer -> confirmation received) completes within 2 seconds under normal load
- NFR4: Agent decision cycle (observe -> interpret -> decide -> act) completes within 5 seconds for MCP-based agents, within 30 seconds for LLM-powered agents
- NFR5: SpacetimeDB table subscription updates reflected in agent state and TUI display within 500ms of database commit
- NFR6: Static data loading (all `*_desc` tables) completes within 10 seconds on first connection
- NFR7: Skill file parsing and Agent.md validation completes within 1 second for up to 50 skills

**Security**

- NFR8: All ILP packets signed with the user's Nostr private key; unsigned or incorrectly signed packets rejected by BLS before reducer execution
- NFR9: Nostr private keys never transmitted over the network; only public keys and signatures leave the local system
- NFR10: BLS validates identity on every reducer call — no reducer executes without verified Nostr public key attribution
- NFR11: Nostr private keys stored encrypted at rest on the local filesystem with user-provided passphrase protection
- NFR12: ILP fee schedules publicly verifiable; users can audit the fee for any action before executing it
- NFR13: No game action attributed to a Nostr public key without a valid cryptographic signature from the corresponding private key

**Scalability**

- NFR14: A single Crosstown node supports at least 10 concurrent agents and 5 concurrent TUI players at MVP, scaling to 50+ agents at Phase 2
- NFR15: SpacetimeDB subscriptions remain performant with up to 50 concurrent connected clients on a single game server instance
- NFR16: Decision log file size remains manageable: JSONL rotation or archival when logs exceed 100MB per agent
- NFR17: ILP fee collection maintains accurate accounting under concurrent multi-agent load with no lost or double-counted transactions

**Integration**

- NFR18: `@sigil/client` uses SpacetimeDB 2.0 TypeScript client SDK (backwards-compatible with 1.6.x server modules). The Rust TUI has no direct SpacetimeDB dependency — it connects via the TypeScript backend.
- NFR19: `@sigil/client` connects to any standard Nostr relay implementing NIP-01; Crosstown's built-in relay is the default
- NFR20: LLM integration (Phase 2) supports any provider exposing an OpenAI-compatible chat completions API
- NFR21: Skill file format is consumed by `@sigil/client` and exposed to all frontends (MCP server, TUI backend) uniformly
- NFR22: Docker compose dev environment runs on Linux and macOS with no platform-specific configuration

**Reliability**

- NFR23: SpacetimeDB subscription automatically reconnects within 10 seconds after connection loss, with full state recovery
- NFR24: Failed ILP packets (network timeout, insufficient balance) return clear error codes and do not leave the system in an inconsistent state
- NFR25: Agent state persists across SDK restarts: decision logs are append-only, agent configuration is stateless (re-read from Agent.md on startup)
- NFR26: TUI client handles SpacetimeDB disconnection gracefully: displays connection status, buffers user input, resumes on reconnection
- NFR27: BLS identity propagation has zero silent failures: every reducer call either succeeds with verified identity or fails with an explicit error

### Additional Requirements

**From Architecture — Starter Template & Project Setup:**

- Manual polyglot workspace initialization (no starter template): pnpm workspace for TypeScript + cargo workspace for Rust
- Single monorepo with `packages/` (TS: client, mcp-server, tui-backend) and `crates/` (Rust: tui)
- SpacetimeDB 2.0 client SDK (v2.0.1) targeting 1.6.x server modules — backwards compatibility must be verified in Phase 1 spike
- Nostr keypair is the SOLE identity mechanism — no usernames, passwords, or OAuth
- Five-Layer Cognition Architecture is SUPERSEDED — Agent = Claude instance with CLAUDE.md/AGENTS.md + Skills + MCP tools (NOT custom cognition stack)

**From Architecture — Technical Infrastructure:**

- BLS game action handler: new callback for kind 30078 events in Crosstown (parse reducer + args, call SpacetimeDB with identity propagation)
- Docker compose stack: BitCraft server (SpacetimeDB WASM module) + Crosstown node + BLS
- CI/CD: GitHub Actions — `pnpm lint && pnpm test && cargo clippy && cargo test` on every PR
- Shared configs at monorepo root: ESLint, Prettier, tsconfig.base.json, rustfmt.toml
- TypeScript strict mode enabled across all packages
- JSON schema validation for IPC messages (shared between TS and Rust)

**From Architecture — API & Communication Patterns:**

- `@sigil/client` API: `client.spacetimedb` (read), `client.nostr` (read), `client.publish()` (write), `client.identity`
- Single write path: `client.publish()` -> ILP packet -> Crosstown -> BLS -> SpacetimeDB
- IPC: JSON-RPC 2.0 over stdio pipes between Rust TUI and TypeScript backend
- All JSON exchanged between Rust and TypeScript uses camelCase fields
- MCP tools use snake_case naming convention
- MCP resource URIs: `sigil://players/{id}`, `sigil://planets/{id}`, `sigil://teams/{id}`
- Event-driven: `EventEmitter` pattern with typed events (gameStateUpdate, playerAction, connectionStatusChange, error)
- Typed error classes: `SigilError` with `code`, `message`, `boundary` fields
- Boundary values for errors: spacetimedb, crosstown, bls, mcp, agent, ipc

**From Architecture — Implementation Patterns:**

- TypeScript: kebab-case files, camelCase functions, PascalCase types, SCREAMING_SNAKE_CASE constants
- Rust: snake_case files/functions, PascalCase types, SCREAMING_SNAKE_CASE constants
- Rust serde: `#[serde(rename_all = "camelCase")]` on all IPC message structs
- Tests: co-located `*.test.ts` for TypeScript, inline `#[cfg(test)]` for Rust
- Build: tsup for TypeScript bundling (ESM + CJS + DTS), vitest for testing
- Connection lifecycle: auto-reconnect with exponential backoff (max 30s), state recovery on reconnect

**From Architecture — Agent Configuration:**

- CLAUDE.md for Claude agents, AGENTS.md for non-Claude agents (Vercel AI, OpenCode)
- Skills use standard Claude Agent Skills format (SKILL.md with YAML frontmatter + markdown body)
- Progressive disclosure: metadata always loaded, full instructions on trigger
- Agent observation mode in TUI (read-only view of agent perception, decisions, actions)

**From UX Design — Terminal Interface:**

- Fixed 160x48 character viewport, centered in terminal
- Minimum terminal size check at startup (show error if < 160x48)
- Keyboard-first design, zero mouse dependency for all features
- 7 tabs: Player, Nearby, World, Map, Actions, Economy, System
- Panel-based layout: left-right split with list + detail (most tabs), full-width hex grid (Map tab)
- Screen trait + SplitPanel pattern from rebels-in-the-sky
- UiCallback enum for typed action dispatch and cross-tab navigation
- Footer key hints from `footer_spans()` — contextual per active screen
- Hover text row for transient messages (errors, cost preview, descriptions)

**From UX Design — Custom Widgets:**

- HexGrid widget: hex world map rendering with player position, entities, terrain, zoom levels
- WalletMeter widget: ILP balance with threshold coloring (OK > 50%, LOW 10-50%, CRITICAL < 10%)
- ConnectionBadge widget: SpacetimeDB + Crosstown connection status (LIVE/STALE/DEAD)
- CostPreview widget: inline action cost display (affordable = teal, unaffordable = red)

**From UX Design — Interaction Patterns:**

- Auto-generate Nostr identity on first launch (zero config)
- Auto-fund wallet from Crosstown Genesis faucet when available
- First action achievable under 2 minutes from launch
- Core loop under 3 keystrokes (navigate -> execute -> see result)
- Cost shown before execution, never confirmation dialogs on routine actions
- Success is silent (panels update from SpacetimeDB subscriptions), errors/warnings in hover text row
- Semantic style token system: STYLE_OK, STYLE_WARN, STYLE_ERROR, STYLE_COST, STYLE_IDENTITY, STYLE_MUTED, STYLE_FOCUS, STYLE_HINT
- Truecolor preferred with 256-color named ANSI fallback
- UiState state machine: Splash -> Setup -> Main

**From UX Design — Accessibility:**

- No color-only information — text labels alongside color indicators
- High contrast foreground colors against dark terminal backgrounds
- No animation dependencies (no blinking/flashing)
- Terminal diversity testing: iTerm2, Terminal.app, Alacritty, Windows Terminal, kitty

### FR Coverage Map

- FR1: Epic 1 — Generate Nostr keypair
- FR2: Epic 1 — Import existing Nostr keypair
- FR3: Epic 1 — Export Nostr keypair for backup
- FR4: Epic 2 — Identity attribution via BLS propagation
- FR5: Epic 2 — End-to-end identity verification
- FR6: Epic 1 — SpacetimeDB table subscriptions via WebSocket
- FR7: Epic 2 — Crosstown relay event subscriptions
- FR8: Epic 1 — Static data table loading (\*\_desc tables)
- FR9: Epic 3 — Event interpretation as semantic narratives
- FR10: Epic 1 — Auto-reconnection and state recovery
- FR11: Epic 3 — Agent.md configuration (zero code)
- FR12: Epic 3 — Skill selection via Agent.md
- FR13: Epic 3 — Skill file format (reducer, params, cost, subscriptions)
- FR14: Epic 3 — Validation against SpacetimeDB module
- FR15: Epic 3 — Budget limits per agent
- FR16: Epic 7 — LLM backend selection in Agent.md (Phase 2)
- FR17: Epic 2 — Execute actions via client.publish()
- FR18: Epic 2 — ILP packet construction and signing
- FR19: Epic 2 — BLS handler validates and calls reducer
- FR20: Epic 2 — ILP fee collection
- FR21: Epic 2 — Wallet balance query
- FR22: Epic 2 — Action cost registry
- FR23: Epic 4 — Autonomous agent decisions via MCP tools
- FR24: Epic 7 — LLM-powered goal planning (Phase 2)
- FR25: Epic 7 — Persistent memory across sessions (Phase 2)
- FR26: Epic 7 — Affordance detection with cost/reward (Phase 2)
- FR27: Epic 3 — Swappable cognition via config/skill changes
- FR28: Epic 5 — Hex-grid map rendering in terminal
- FR29: Epic 5 — Character movement via keyboard
- FR30: Epic 5 — Chat messaging
- FR31: Epic 5 — Inventory management
- FR32: Epic 5 — Character status display
- FR33: Epic 8 — Combat system (Phase 2)
- FR34: Epic 8 — Crafting system (Phase 2)
- FR35: Epic 8 — Building/territory management (Phase 2)
- FR36: Epic 8 — Trading marketplace (Phase 2)
- FR37: Epic 8 — Empire management (Phase 2)
- FR38: Epic 5 — TUI renders at 30+ FPS
- FR39: Epic 3 — Structured decision logging (JSONL)
- FR40: Epic 9 — Multi-agent concurrent execution (Phase 2)
- FR41: Epic 9 — YAML experiment configuration (Phase 2)
- FR42: Epic 9 — World state snapshot/restore (Phase 2)
- FR43: Epic 9 — Comparative decision log analysis (Phase 2)
- FR44: Epic 1 — Docker compose local dev environment
- FR45: Epic 2 — ILP fee schedule configuration
- FR46: Epic 6 — System health monitoring
- FR47: Epic 2 — BLS game action handler mapping
- FR48: Epic 10 — Skill files for new SpacetimeDB worlds (Phase 2)
- FR49: Epic 10 — BLS handler registration for third-party games (Phase 2)
- FR50: Epic 11 — Auto-generate skill files from schema (Phase 3)

## Epic List

### Epic 1: Project Foundation & Game World Connection (MVP)

Users can establish their cryptographic identity and connect to the live BitCraft game world to observe real-time state. Includes monorepo scaffolding, Docker compose dev environment, Nostr keypair management, SpacetimeDB connection + subscriptions, static data loading, and auto-reconnection.
**FRs covered:** FR1, FR2, FR3, FR6, FR8, FR10, FR44

### Epic 2: Action Execution & Payment Pipeline (MVP)

Users can execute game actions via ILP micropayments with end-to-end cryptographic identity propagation. Includes Crosstown relay subscriptions, ILP packet construction/signing/routing, BLS game action handler, identity verification, action cost registry, wallet balance, and fee collection.
**FRs covered:** FR4, FR5, FR7, FR17, FR18, FR19, FR20, FR21, FR22, FR45, FR47

### Epic 3: Declarative Agent Configuration (MVP)

Researchers can define agent behavior entirely through markdown config files with skills, validation, budget limits, and decision logging — zero application code required. Includes Agent.md parsing, skill file loading, event interpretation, SpacetimeDB validation, budget tracking, and JSONL decision logs.
**FRs covered:** FR9, FR11, FR12, FR13, FR14, FR15, FR27, FR39

### Epic 4: MCP Server for AI Agents (MVP)

AI agents (Claude, Vercel AI, OpenCode) can play the game autonomously through the standard MCP protocol, with game state as resources and game actions as tools. Includes @sigil/mcp-server package, resource/tool mapping, and skill-to-MCP-tool integration.
**FRs covered:** FR23

### Epic 5: Terminal Game Client (MVP)

Human players can experience a full MMORPG from their terminal — hex-grid map, movement, chat, inventory, and character status at 30+ FPS. Includes @sigil/tui-backend (JSON-RPC IPC), sigil-tui Rust application, 7-tab layout, custom widgets, keyboard-first design, and semantic style system.
**FRs covered:** FR28, FR29, FR30, FR31, FR32, FR38

### Epic 6: Infrastructure & Observability (MVP)

Operators can monitor system health and researchers can observe agent behavior in real-time. Includes ILP throughput, fee revenue, BLS latency monitoring, and agent observation mode in TUI.
**FRs covered:** FR46

### Epic 7: Advanced Agent Intelligence (Phase 2)

Researchers can run LLM-powered agents with persistent memory, affordance detection, and configurable AI backends for advanced cognitive experiments.
**FRs covered:** FR16, FR24, FR25, FR26

### Epic 8: TUI Advanced Gameplay (Phase 2)

Players can engage in the full depth of BitCraft — combat, crafting, building, trading, and empire management from their terminal.
**FRs covered:** FR33, FR34, FR35, FR36, FR37

### Epic 9: Experiment Harness & Multi-Agent Research (Phase 2)

Researchers can run comparative experiments with multiple concurrent agents, snapshot/restore world state, and analyze decision logs across runs.
**FRs covered:** FR40, FR41, FR42, FR43

### Epic 10: World Extensibility (Phase 2)

Game developers can make any SpacetimeDB world agent-accessible by writing skill files and registering BLS handlers — no SDK code changes required.
**FRs covered:** FR48, FR49

### Epic 11: Platform Expansion (Phase 3)

The platform auto-generates skill files from any SpacetimeDB module's published schema, lowering the barrier for new world integration.
**FRs covered:** FR50

---

## Epic 1: Project Foundation & Game World Connection

Users can establish their cryptographic identity and connect to the live BitCraft game world to observe real-time state. This is the foundational epic — monorepo scaffolding, Docker dev environment, Nostr identity management, SpacetimeDB connection with subscriptions, static data loading, and resilient auto-reconnection.

### Story 1.1: Monorepo Scaffolding & Build Infrastructure

As a developer,
I want a properly structured polyglot monorepo with TypeScript and Rust workspaces, shared configs, and CI/CD,
So that all subsequent packages and crates have a consistent foundation to build on.

**Acceptance Criteria:**

**Given** a fresh clone of the repository
**When** I run `pnpm install`
**Then** the pnpm workspace resolves with `packages/client`, `packages/mcp-server`, and `packages/tui-backend` as workspace members
**And** a shared `tsconfig.base.json` exists at root with strict mode enabled

**Given** a fresh clone of the repository
**When** I run `cargo build` from the root
**Then** the cargo workspace builds with `crates/tui` as a workspace member
**And** a shared `rustfmt.toml` exists at root

**Given** the monorepo is set up
**When** I check the root configuration files
**Then** ESLint config (`.eslintrc.cjs`), Prettier config (`.prettierrc`), and `.env.example` exist at root
**And** `.gitignore` excludes `node_modules/`, `target/`, `.env`, and build artifacts

**Given** a push or pull request to the repository
**When** CI runs
**Then** GitHub Actions workflows execute: TypeScript lint + typecheck + test + build, and Rust clippy + rustfmt + test + build

**Given** the `packages/client` workspace package
**When** I inspect its `package.json`
**Then** it is named `@sigil/client` with a `tsup.config.ts` for ESM + CJS + DTS output
**And** `vitest` is configured for testing

### Story 1.2: Nostr Identity Management

As a user,
I want to generate, import, and export Nostr keypairs as my sole cryptographic identity,
So that I have a secure, portable identity for all SDK interactions.

**Acceptance Criteria:**

**Given** no existing identity file at `~/.sigil/identity`
**When** I call the keypair generation function
**Then** a new Nostr keypair (private key + public key) is generated using `nostr-tools`
**And** the keypair is saved to `~/.sigil/identity` in an encrypted format
**And** the public key (npub) is returned to the caller

**Given** an existing Nostr private key in hex or nsec format
**When** I call the import function with the key
**Then** the keypair is validated, the corresponding public key is derived
**And** the keypair is saved to `~/.sigil/identity`

**Given** an existing seed phrase (BIP-39 compatible)
**When** I call the import function with the seed phrase
**Then** the Nostr keypair is deterministically derived from the seed
**And** the keypair is saved to `~/.sigil/identity`

**Given** a stored keypair at `~/.sigil/identity`
**When** I call the export function
**Then** the private key is returned in nsec format and hex format
**And** the public key is returned in npub format and hex format

**Given** the keypair module is used by `@sigil/client`
**When** the `client.identity` property is accessed
**Then** it returns the loaded Nostr public key and provides signing capability
**And** the private key is never exposed in logs or transmitted over the network (NFR9)

### Story 1.3: Docker Local Development Environment

As an operator,
I want to start a local BitCraft game server and Crosstown node via Docker compose,
So that I have a complete development environment for SDK testing.

**Acceptance Criteria:**

**Given** Docker and docker-compose are installed
**When** I run `docker compose -f docker/docker-compose.yml up`
**Then** a BitCraft server (SpacetimeDB with WASM module) starts and accepts WebSocket connections
**And** a Crosstown node starts with a built-in Nostr relay accepting connections

**Given** the Docker compose stack is running
**When** I connect a SpacetimeDB client to the BitCraft server
**Then** I can subscribe to game tables and receive real-time updates
**And** the server exposes the full BitCraft module (364+ reducers, ~80 entity tables, 148 static data tables)

**Given** the Docker compose stack
**When** I run it on Linux or macOS
**Then** it starts successfully with no platform-specific configuration required (NFR22)

**Given** a `docker-compose.dev.yml` override file
**When** I run `docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up`
**Then** development overrides are applied (debug ports, hot reload if applicable)

### Story 1.4: SpacetimeDB Connection & Table Subscriptions

As a user,
I want to connect to SpacetimeDB and subscribe to table updates in real-time,
So that I can observe the live game world state through the SDK.

**Acceptance Criteria:**

**Given** a running BitCraft SpacetimeDB server
**When** I create a `SigilClient` with SpacetimeDB connection options and call `connect()`
**Then** a WebSocket v2 connection is established to the SpacetimeDB server
**And** the `client.spacetimedb` surface is available for subscriptions

**Given** an active SpacetimeDB connection
**When** I call `client.spacetimedb.subscribe('player_state', query)`
**Then** I receive the initial state snapshot for matching rows
**And** subsequent updates are pushed in real-time as the database changes

**Given** an active subscription
**When** a reducer modifies subscribed table rows
**Then** the update is reflected in the client state within 500ms of database commit (NFR5)

**Given** the `client.spacetimedb` surface
**When** I access `client.spacetimedb.tables`
**Then** I get generated type-safe table accessors for the BitCraft module

**Given** an active SpacetimeDB connection
**When** I listen to `client.on('gameStateUpdate', handler)`
**Then** aggregated game state events are emitted from SpacetimeDB subscription updates

**Given** a SpacetimeDB connection using SDK version 2.0.1
**When** connected to a BitCraft server running module version 1.6.x
**Then** the connection succeeds and table subscriptions work correctly (backwards compatibility — NFR18)

### Story 1.5: Static Data Table Loading

As a user,
I want to load all static data tables (\*\_desc tables) at startup and build queryable lookup maps,
So that I can reference game data (item descriptions, recipe definitions, terrain types) efficiently.

**Acceptance Criteria:**

**Given** an active SpacetimeDB connection
**When** I call the static data loading function
**Then** all `*_desc` tables (148 static data tables) are loaded from SpacetimeDB
**And** queryable lookup maps are built (keyed by primary ID)

**Given** static data loading has started
**When** the loading completes
**Then** it finishes within 10 seconds on first connection (NFR6)
**And** a `staticDataLoaded` event is emitted

**Given** loaded static data
**When** I query a lookup map (e.g., `staticData.get('item_desc', itemId)`)
**Then** the corresponding static data record is returned with correct types

**Given** static data is loaded
**When** the SpacetimeDB connection is lost and restored
**Then** the static data remains cached (static tables don't change at runtime)

### Story 1.6: Auto-Reconnection & State Recovery

As a user,
I want the system to automatically reconnect after connection loss and recover my subscription state,
So that temporary network issues don't disrupt my experience.

**Acceptance Criteria:**

**Given** an active SpacetimeDB connection with subscriptions
**When** the WebSocket connection is lost
**Then** the system emits a `connectionChange` event with status `disconnected`
**And** begins automatic reconnection attempts with exponential backoff

**Given** reconnection attempts are in progress
**When** the backoff interval increases
**Then** it caps at a maximum of 30 seconds between attempts
**And** the system emits `connectionChange` events with status `reconnecting`

**Given** the system is reconnecting
**When** a reconnection attempt succeeds
**Then** the connection is re-established within 10 seconds of the first successful attempt (NFR23)
**And** all previous table subscriptions are automatically re-subscribed
**And** the system emits a `connectionChange` event with status `connected`

**Given** subscriptions are recovered after reconnection
**When** the initial state snapshot is received
**Then** the client state is updated to the current database state
**And** any events that occurred during disconnection are reflected in the recovered state

**Given** a persistent connection failure (server down)
**When** reconnection attempts exhaust a configurable retry limit
**Then** the system emits a `connectionChange` event with status `failed`
**And** provides a clear error message with the failure reason

---

## Epic 2: Action Execution & Payment Pipeline

Users can execute game actions via ILP micropayments with end-to-end cryptographic identity propagation. Every action is signed with the user's Nostr key, routed through Crosstown, validated by BLS, and executed as a SpacetimeDB reducer call with verified identity attribution.

### Story 2.1: Crosstown Relay Connection & Event Subscriptions

As a user,
I want to connect to the Crosstown built-in Nostr relay and subscribe to events,
So that I receive action confirmations, system notifications, and relay-sourced updates.

**Acceptance Criteria:**

**Given** a running Crosstown node with a built-in Nostr relay
**When** I create a `SigilClient` with Nostr relay options and call `connect()`
**Then** a WebSocket connection is established to the Crosstown Nostr relay
**And** the `client.nostr` surface is available for subscriptions

**Given** an active Nostr relay connection
**When** I call `client.nostr.subscribe(filters)` with NIP-01 compliant filters
**Then** I receive matching events from the relay in real-time

**Given** an active Nostr relay subscription
**When** an action confirmation event is published to the relay
**Then** the `client.on('actionConfirmed', handler)` event fires with the confirmation details

**Given** the Nostr relay connection
**When** the relay implements NIP-01
**Then** the client connects successfully to any standard Nostr relay (NFR19)
**And** Crosstown's built-in relay is used as the default

**Given** the Nostr relay connection is lost
**When** reconnection is attempted
**Then** the same exponential backoff strategy from Story 1.6 is applied
**And** relay subscriptions are re-established on reconnection

### Story 2.2: Action Cost Registry & Wallet Balance

As a user,
I want to look up the ILP cost of any game action and query my wallet balance,
So that I can make informed decisions about spending before executing actions.

**Acceptance Criteria:**

**Given** a JSON action cost registry configuration file
**When** the system loads the cost registry at startup
**Then** every mapped game action (reducer) has an associated ILP cost

**Given** a loaded cost registry
**When** I call `client.publish.getCost(actionName)` for a known action
**Then** the ILP cost for that action is returned
**And** the fee schedule is publicly auditable (NFR12)

**Given** a loaded cost registry
**When** I query a cost for an unknown action
**Then** a clear error is returned indicating the action is not in the registry

**Given** an active Crosstown connection
**When** I call the wallet balance query function
**Then** my current ILP wallet balance is returned (FR21)

**Given** a wallet balance query
**When** the balance is retrieved
**Then** the balance reflects all confirmed transactions accurately (NFR17)

### Story 2.3: ILP Packet Construction & Signing

As a user,
I want to execute game actions by calling `client.publish()` which constructs a signed ILP packet and routes it through Crosstown,
So that I can interact with the game world through the single write path.

**Acceptance Criteria:**

**Given** an initialized `SigilClient` with identity and Crosstown connection
**When** I call `client.publish({ reducer: 'player_move', args: [...] })`
**Then** an ILP packet is constructed containing the game action
**And** the packet is signed with my Nostr private key (NFR8)
**And** the packet is formatted as a kind 30078 Nostr event

**Given** a constructed ILP packet
**When** it is submitted to the Crosstown connector
**Then** the packet is routed through the Crosstown node to the BLS handler
**And** the round-trip completes within 2 seconds under normal load (NFR3)

**Given** a `client.publish()` call
**When** the action succeeds
**Then** a confirmation event is received via the Nostr relay subscription
**And** the wallet balance is decremented by the action cost

**Given** a `client.publish()` call
**When** the wallet has insufficient balance
**Then** a `SigilError` is returned with code `INSUFFICIENT_BALANCE` and boundary `crosstown` (NFR24)
**And** no ILP packet is sent, and the system remains in a consistent state

**Given** a `client.publish()` call
**When** a network timeout occurs
**Then** a `SigilError` is returned with code `NETWORK_TIMEOUT` and boundary `crosstown`
**And** the system does not leave an inconsistent state (NFR24)

**Given** any `client.publish()` call
**When** the packet is constructed
**Then** the Nostr private key is never transmitted over the network — only the public key and signature leave the local system (NFR9)

### Story 2.4: BLS Game Action Handler

As an operator,
I want the BLS to receive ILP-routed game action events, validate signatures, and call the correct SpacetimeDB reducer with identity propagation,
So that game actions are securely executed with verified authorship.

**Acceptance Criteria:**

**Given** a Crosstown BLS instance configured with a game action handler
**When** a kind 30078 Nostr event arrives via ILP routing
**Then** the BLS validates the ILP payment (existing BLS logic)
**And** parses the event content to extract `reducer` name and `args`

**Given** a valid ILP payment and parseable event content
**When** the BLS processes the game action
**Then** it extracts the authoring Nostr public key from the event
**And** calls the corresponding SpacetimeDB reducer with the extracted args
**And** propagates the Nostr public key as the player identity to SpacetimeDB (FR19, FR47)

**Given** an incoming ILP packet with an invalid or missing signature
**When** the BLS attempts validation
**Then** the packet is rejected before any reducer execution (NFR8)
**And** an explicit error is returned to the sender

**Given** an incoming event referencing a non-existent reducer
**When** the BLS attempts to dispatch
**Then** the action fails with a clear error identifying the unknown reducer
**And** no SpacetimeDB call is made

**Given** any BLS reducer call
**When** identity propagation is attempted
**Then** it either succeeds with verified Nostr public key attribution or fails with an explicit error — zero silent failures (NFR27)

### Story 2.5: Identity Propagation & Verification

As a user,
I want every game action attributed to my Nostr public key and the ability to verify my identity ownership end-to-end,
So that I can trust the system correctly attributes my actions.

**Acceptance Criteria:**

**Given** a game action executed via `client.publish()`
**When** the action is processed by BLS and forwarded to SpacetimeDB
**Then** the SpacetimeDB reducer executes with the authoring Nostr public key as the player identity (FR4)
**And** the game state change is attributed to the correct player entity based on that public key

**Given** a completed game action
**When** I call the identity verification function
**Then** the system confirms the cryptographic chain: signed ILP packet → BLS signature validation → reducer identity attribution (FR5)
**And** the verification result includes the Nostr public key, the action taken, and the SpacetimeDB attribution

**Given** any reducer call to SpacetimeDB
**When** identity propagation is checked
**Then** no game action is ever attributed to a Nostr public key without a valid cryptographic signature from the corresponding private key (NFR13)

**Given** an attempted identity propagation
**When** the BLS cannot verify the signature against the claimed public key
**Then** the reducer call is rejected with an explicit identity verification failure
**And** no game state is modified (NFR10)

### Story 2.6: ILP Fee Collection & Schedule Configuration

As an operator,
I want the system to collect ILP fees on every routed game action and configure fee schedules per action type,
So that the platform generates revenue from game activity.

**Acceptance Criteria:**

**Given** an ILP packet routed through Crosstown
**When** the BLS processes the game action
**Then** the configured ILP fee is collected from the payment (FR20)
**And** the fee amount matches the action cost registry entry for that action type

**Given** an operator managing fee schedules
**When** they update the fee schedule configuration (JSON file)
**Then** different action types can have different fee amounts (FR45)
**And** the updated schedule takes effect on subsequent actions

**Given** concurrent multi-agent load
**When** multiple ILP fees are collected simultaneously
**Then** fee accounting remains accurate with no lost or double-counted transactions (NFR17)

**Given** a configured fee schedule
**When** a user queries the cost of an action via the cost registry
**Then** the displayed cost includes the ILP fee component
**And** the fee is publicly verifiable (NFR12)

---

## Epic 3: Declarative Agent Configuration

Researchers can define agent behavior entirely through markdown configuration files — Agent.md for personality, skill selection, and budget limits; SKILL.md files for game action mappings. The system validates configurations against the live SpacetimeDB module, enforces budgets, interprets game events as semantic narratives, and produces structured decision logs. Zero application code required.

### Story 3.1: Skill File Format & Parser

As a researcher,
I want to define game actions as SKILL.md files with reducer mappings, parameters, costs, and usage guidance,
So that I can declaratively specify what actions an agent can perform.

**Acceptance Criteria:**

**Given** a SKILL.md file with YAML frontmatter and markdown body
**When** the skill loader parses the file
**Then** the following fields are extracted: skill name, target reducer, parameters (with types), ILP cost, required table subscriptions, and natural-language description (FR13)

**Given** a directory containing multiple SKILL.md files
**When** the skill loader loads the directory
**Then** all valid skill files are parsed and registered in an action registry
**And** parsing completes within 1 second for up to 50 skills (NFR7)

**Given** a malformed SKILL.md file (missing required fields)
**When** the skill loader attempts to parse it
**Then** a clear error is returned identifying the file and the missing/invalid fields
**And** valid skills from the same directory are still loaded

**Given** a loaded skill
**When** it is accessed by any consumer (MCP server, TUI backend)
**Then** the skill format is consumed uniformly across all frontends (NFR21)

**Given** the skill file progressive disclosure pattern
**When** skills are initially loaded
**Then** only metadata (name, reducer, cost) is loaded eagerly
**And** full instructions and guidance are loaded on demand when the skill is triggered

### Story 3.2: Agent.md Configuration & Skill Selection

As a researcher,
I want to define agent behavior entirely through an Agent.md configuration file,
So that I can create and modify agents without writing any application code.

**Acceptance Criteria:**

**Given** an Agent.md file with configuration sections
**When** the agent config parser loads the file
**Then** the following are extracted: agent name, personality description, selected skill references, budget limit, logging preferences (FR11)

**Given** an Agent.md that references skill files by name
**When** the agent configuration is loaded
**Then** the referenced skills are resolved from the skills directory
**And** only the selected skills are active for that agent (FR12)

**Given** an Agent.md referencing a non-existent skill file
**When** the configuration is loaded
**Then** a clear error identifies the missing skill file by name
**And** the agent does not start with a partial skill set

**Given** a valid Agent.md and resolved skills
**When** the agent is initialized
**Then** a CLAUDE.md is generated for Claude agents with the personality, constraints, goals, and MCP tool references
**And** an AGENTS.md equivalent is available for non-Claude agents (Vercel AI, OpenCode)

**Given** an Agent.md configuration
**When** the agent restarts
**Then** Agent.md is re-read from disk (stateless configuration — NFR25)
**And** any changes to Agent.md take effect on the next startup

### Story 3.3: Configuration Validation Against SpacetimeDB

As a researcher,
I want the system to validate my agent config and skill files against the connected SpacetimeDB module,
So that I catch configuration errors before runtime failures.

**Acceptance Criteria:**

**Given** loaded skill files referencing specific reducers
**When** validation runs against the connected SpacetimeDB module
**Then** each skill's target reducer is confirmed to exist in the module's available reducers (FR14)
**And** reducer parameter types are checked for compatibility

**Given** a skill file referencing a non-existent reducer
**When** validation runs
**Then** an actionable error is returned: "Skill file `harvest_resource.md` references reducer `harvest_resource` but SpacetimeDB module does not expose this reducer"

**Given** skill files declaring required table subscriptions
**When** validation runs
**Then** each required table is confirmed to exist in the SpacetimeDB module's table list (FR14)

**Given** a complete Agent.md with skill references
**When** full validation runs (agent config + all skills + SpacetimeDB module)
**Then** a validation report is produced listing all passed checks and any failures
**And** validation completes within 1 second for up to 50 skills (NFR7)

### Story 3.4: Budget Tracking & Limits

As a researcher,
I want to set ILP budget limits per agent and have the system enforce them,
So that my agents don't overspend during experiments.

**Acceptance Criteria:**

**Given** an Agent.md with a budget limit specified (e.g., `## Budget: 0.05 USD/hour`)
**When** the agent is initialized
**Then** the budget tracker is configured with the specified limit (FR15)
**And** the current spend is initialized to zero

**Given** an active agent with a budget limit
**When** `client.publish()` is called for a game action
**Then** the action cost is checked against the remaining budget before execution
**And** if the action would exceed the budget, it is rejected with a `BUDGET_EXCEEDED` error

**Given** an agent executing actions over time
**When** the cumulative spend approaches the budget limit
**Then** a warning event is emitted at configurable thresholds (e.g., 80%, 90%)

**Given** an agent that has reached its budget limit
**When** any further `client.publish()` is attempted
**Then** all actions are rejected until the budget is reset or increased
**And** the rejection is logged in the decision log

**Given** budget tracking across actions
**When** the agent session is reviewed
**Then** total spend, per-action costs, and budget utilization are available as queryable metrics

### Story 3.5: Event Interpretation as Semantic Narratives

As a researcher,
I want raw SpacetimeDB table update events interpreted as human-readable semantic narratives,
So that agents and researchers can understand what happened in the game world meaningfully.

**Acceptance Criteria:**

**Given** a raw SpacetimeDB table update event (row insert, update, or delete)
**When** the event interpreter processes it
**Then** a semantic narrative is produced describing what happened in game terms (FR9)
**And** the narrative includes: event type, affected entity, key state changes, and timestamp

**Given** a player position table update
**When** interpreted
**Then** the narrative reads like: "Player [pubkey] moved from hex (x1,y1) to hex (x2,y2)"
**And** includes the player's display name if available from static data

**Given** multiple rapid table updates from a single reducer call
**When** interpreted
**Then** related updates are correlated into a single coherent narrative where possible
**And** the original raw events remain accessible alongside the narrative

**Given** an unknown or unmapped table update
**When** interpreted
**Then** a generic narrative is produced: "Table [name] row [id] [inserted/updated/deleted]"
**And** no error is thrown — graceful degradation for unmapped events

### Story 3.6: Structured Decision Logging

As a researcher,
I want agents to produce structured JSONL decision logs capturing the full decision cycle,
So that I can analyze agent behavior, reproduce decisions, and compare across experiment runs.

**Acceptance Criteria:**

**Given** an agent executing its decision cycle
**When** a decision is made (observe → interpret → decide → act)
**Then** a JSONL log entry is appended with: timestamp, observation summary, semantic events received, action chosen, action cost, action result, and outcome (FR39)

**Given** decision logging is active
**When** log entries are written
**Then** they are appended to the configured JSONL file (append-only — NFR25)
**And** each line is valid JSON parseable independently

**Given** a decision log file
**When** it exceeds 100MB
**Then** log rotation or archival is triggered automatically (NFR16)

**Given** an agent action that fails
**When** the failure is logged
**Then** the log entry includes the error code, boundary, and error message
**And** the world state at the time of failure is captured

**Given** decision log entries
**When** analyzed after an experiment
**Then** each entry contains enough context to reproduce the decision: the input state, the skill invoked, the parameters chosen, and the outcome observed

### Story 3.7: Swappable Agent Configuration

As a researcher,
I want to swap agent skills, behavior, and configuration by editing markdown files,
So that I can run different agent strategies without code changes.

**Acceptance Criteria:**

**Given** a running agent with a set of active skills
**When** I modify Agent.md to reference different skill files
**Then** on next agent restart, the new skill set takes effect (FR27)
**And** the old skills are no longer available to the agent

**Given** two Agent.md files with different personalities and skill selections
**When** I start agents with each configuration
**Then** each agent behaves according to its own Agent.md independently

**Given** a SKILL.md file that is updated (e.g., cost changed, parameters adjusted)
**When** the agent restarts
**Then** the updated skill definition is loaded
**And** the agent uses the new cost/parameter values

**Given** the agent configuration system
**When** different configurations are used across experiment runs
**Then** each run's Agent.md and skill file versions are logged alongside decision logs for reproducibility

---

## Epic 4: MCP Server for AI Agents

AI agents (Claude, Vercel AI, OpenCode) can play the BitCraft game autonomously through the standard MCP protocol. The @sigil/mcp-server package wraps @sigil/client, exposing game world state as MCP resources and game actions as MCP tools. Any MCP-compatible agent can connect, perceive the world, and act — completing the autonomous decision loop.

### Story 4.1: MCP Server Package & Transport Setup

As a developer,
I want a standalone @sigil/mcp-server process that wraps @sigil/client and exposes the MCP protocol,
So that AI agents can connect to the game world through a standard interface.

**Acceptance Criteria:**

**Given** the `@sigil/mcp-server` package in the monorepo
**When** it is started with configuration (SpacetimeDB host, Crosstown node, Nostr identity)
**Then** an MCP server starts and listens over stdio transport
**And** it internally creates a `SigilClient` instance and connects to SpacetimeDB + Crosstown

**Given** a running MCP server
**When** an MCP-compatible client (Claude Desktop, OpenCode, any MCP client) initiates a connection
**Then** the MCP handshake completes successfully
**And** the client receives the server's capability list (tools and resources)

**Given** the MCP server process
**When** the underlying SpacetimeDB or Crosstown connection fails
**Then** the MCP server surfaces connection errors to connected clients via MCP error responses
**And** reconnection is handled by the underlying `@sigil/client` (from Epic 1)

**Given** a user configuring MCP in `claude_desktop_config.json` or equivalent
**When** they add the @sigil/mcp-server entry
**Then** the server is discoverable and connectable with standard MCP configuration

### Story 4.2: Game State as MCP Resources

As an AI agent,
I want to read game world state through MCP resources with typed URIs,
So that I can perceive the game world and make informed decisions.

**Acceptance Criteria:**

**Given** a connected MCP client
**When** it reads `sigil://players/{id}`
**Then** the player's current state is returned (position, health, skills, empire, inventory summary)
**And** the data is sourced from live SpacetimeDB subscriptions

**Given** a connected MCP client
**When** it reads `sigil://planets/{id}`
**Then** the planet/hex data is returned (terrain, resources, buildings, occupants)

**Given** a connected MCP client
**When** it reads `sigil://teams/{id}`
**Then** the team/empire data is returned (members, territory, diplomacy status)

**Given** a connected MCP client
**When** it reads `sigil://inventory/{playerId}`
**Then** the player's full inventory is returned with item details resolved from static data

**Given** any MCP resource read
**When** the underlying SpacetimeDB data updates
**Then** subsequent resource reads reflect the current state
**And** resource data is derived from the same `@sigil/client` state used by all consumers

**Given** a resource URI referencing a non-existent entity
**When** an MCP client reads it
**Then** a clear MCP error is returned indicating the entity was not found

### Story 4.3: Game Actions as MCP Tools

As an AI agent,
I want to execute game actions through MCP tools mapped from skill files,
So that I can interact with the game world using the same actions available to all players.

**Acceptance Criteria:**

**Given** loaded skill files from the skills directory
**When** the MCP server registers tools
**Then** each skill is exposed as an MCP tool with snake_case naming (e.g., `move_player`, `gather_resource`, `send_chat`)
**And** tool descriptions include the skill's natural-language guidance

**Given** an MCP tool derived from a skill file
**When** an agent calls the tool with parameters
**Then** the MCP server invokes `client.publish()` with the corresponding reducer and arguments
**And** the action follows the full ILP payment pipeline (from Epic 2)

**Given** an MCP tool call
**When** the action succeeds
**Then** the tool returns a success result with the updated game state relevant to the action
**And** the action cost is included in the response

**Given** an MCP tool call
**When** the action fails (insufficient balance, invalid parameters, reducer error)
**Then** the tool returns a structured MCP error with code, message, and boundary
**And** the error is actionable (agent can understand what went wrong)

**Given** an MCP tool call
**When** the agent's budget limit is exceeded
**Then** the tool returns a `BUDGET_EXCEEDED` error
**And** no ILP packet is sent

**Given** the skill-to-tool mapping
**When** the skill format is consumed by the MCP server
**Then** it is consumed uniformly — the same skill files power MCP tools, TUI actions, and direct SDK usage (NFR21)

### Story 4.4: Agent Autonomous Game Loop

As a researcher,
I want an AI agent to connect via MCP, perceive the game world, and execute actions autonomously,
So that I can observe emergent agent behavior in a real economic environment.

**Acceptance Criteria:**

**Given** a Claude agent configured with MCP server connection and CLAUDE.md
**When** the agent starts
**Then** it connects to @sigil/mcp-server via MCP protocol
**And** reads game state resources to perceive the world
**And** calls MCP tools to execute game actions based on its skills and goals (FR23)

**Given** an autonomous agent executing its game loop
**When** it completes a perceive → decide → act cycle
**Then** the cycle repeats continuously without human intervention
**And** all decisions and actions are logged to the JSONL decision log (from Story 3.6)

**Given** a non-Claude agent (Vercel AI SDK, OpenCode)
**When** it connects to @sigil/mcp-server
**Then** it has the same tool and resource access as a Claude agent
**And** the MCP protocol is the standard interface regardless of agent framework

**Given** an agent operating autonomously
**When** it encounters an error (action failure, connection issue)
**Then** the agent receives the error through MCP error responses
**And** can decide how to handle it (retry, change strategy, log and continue)

**Given** a researcher observing an autonomous agent
**When** the agent has been running for an extended period
**Then** the decision log captures the complete history of observations, decisions, and outcomes
**And** the agent's budget consumption is trackable through the budget system (from Story 3.4)

---

## Epic 5: Terminal Game Client

Human players can experience a full MMORPG from their terminal — navigate a hex-grid map, move their character, chat with other players, manage inventory, and view character status at 30+ FPS. The Rust ratatui TUI (sigil-tui) is a pure presentation layer connected to @sigil/tui-backend via JSON-RPC IPC. All game data and actions flow through the TypeScript backend. Keyboard-first design following rebels-in-the-sky patterns.

### Story 5.1: TUI Backend JSON-RPC IPC Server

As a developer,
I want @sigil/tui-backend to bridge @sigil/client to the Rust TUI over JSON-RPC 2.0 stdio,
So that the TUI can access game state and execute actions without any direct SpacetimeDB or Crosstown connections.

**Acceptance Criteria:**

**Given** the `@sigil/tui-backend` package
**When** it is spawned as a child process by the Rust TUI
**Then** it starts a JSON-RPC 2.0 server listening on stdio (stdin/stdout)
**And** internally creates a `SigilClient` instance and connects to SpacetimeDB + Crosstown

**Given** a JSON-RPC request from the Rust TUI
**When** the method is `getGameState` with valid params
**Then** the backend returns the current game state from `@sigil/client` subscriptions
**And** the response uses camelCase JSON fields

**Given** a JSON-RPC request for a player action (e.g., `movePlayer`)
**When** the backend receives it
**Then** it calls `client.publish()` with the corresponding reducer and arguments
**And** returns the result (success or typed error) as a JSON-RPC response

**Given** a game state change from SpacetimeDB subscriptions
**When** the backend detects the update
**Then** it sends a JSON-RPC notification (no id) to the Rust TUI: `{"jsonrpc": "2.0", "method": "gameStateUpdate", "params": {...}}`
**And** notifications are pushed in real-time without TUI polling

**Given** an error in the backend (SpacetimeDB disconnect, ILP failure)
**When** the error is forwarded to the TUI
**Then** it is wrapped as a JSON-RPC error object with `code`, `message`, and `data.boundary`
**And** the Rust TUI can map the error to a user-friendly display

**Given** the IPC message schema
**When** messages cross the Rust ↔ TypeScript boundary
**Then** all JSON fields use camelCase (TS conventions dominate wire format)
**And** Rust message structs use `#[serde(rename_all = "camelCase")]`

**Given** loaded skill files (from Epic 3)
**When** the TUI backend determines available game actions
**Then** actions are derived from the loaded skill file registry — not hardcoded reducer names
**And** the TUI backend exposes the same skill-sourced actions consumed by the MCP server (NFR21)

### Story 5.2: Rust TUI Application Shell & Screen Architecture

As a player,
I want a polished terminal application with tab navigation, keyboard controls, and a consistent screen layout,
So that I have a familiar, efficient interface for playing the game.

**Acceptance Criteria:**

**Given** the `sigil-tui` binary is launched
**When** the application starts
**Then** it spawns the `@sigil/tui-backend` as a child process over stdio
**And** sets up the terminal in raw mode with alternate screen (crossterm)
**And** renders within a fixed 160x48 character viewport centered in the terminal

**Given** a terminal smaller than 160x48
**When** the application starts
**Then** a clear error message is displayed: "Terminal too small. Requires 160x48, current: {w}x{h}"
**And** the application does not attempt to render the full UI

**Given** the application is running
**When** the main layout renders
**Then** it follows the rebels-in-the-sky vertical layout: tab bar (top), active tab content (center), footer key hints (1 row), hover text (1 row)

**Given** the UiState state machine
**When** the application launches
**Then** it progresses through: Splash → Setup (identity/connection) → Main (gameplay)
**And** the Main state displays 7 tabs: Player, Nearby, World, Map, Actions, Economy, System

**Given** the Main state is active
**When** the player presses Tab or BackTab
**Then** the active tab cycles forward or backward through the tab list (wrapping)
**And** the active tab content re-renders immediately

**Given** the Screen trait implementation
**When** any screen renders
**Then** it implements `update()`, `render()`, `handle_key_events()`, and `footer_spans()`
**And** dirty flags minimize re-renders to maintain 30+ FPS (NFR1)

**Given** any screen in the application
**When** ESC is pressed
**Then** a quit confirmation popup appears overlaying the current screen
**And** the popup captures all key input until dismissed

### Story 5.3: Connection & Identity Setup Flow

As a player,
I want the first launch to automatically set up my identity, connect to the game, and fund my wallet,
So that I can start playing within 2 minutes with zero manual configuration.

**Acceptance Criteria:**

**Given** a first-time launch with no existing Nostr identity
**When** the Setup screen is displayed
**Then** a new Nostr keypair is auto-generated and saved to `~/.sigil/identity`
**And** the public key (npub) is displayed briefly

**Given** an existing Nostr identity at `~/.sigil/identity`
**When** the application starts
**Then** the existing keypair is loaded automatically
**And** the Setup screen skips identity generation

**Given** identity is loaded
**When** the Setup screen connects
**Then** SpacetimeDB connection is established via the TUI backend
**And** Crosstown SPSP handshake completes automatically
**And** connection status is displayed with a spinner during progress

**Given** Crosstown connection is established
**When** the wallet is unfunded
**Then** the system requests tokens from the Crosstown Genesis faucet automatically
**And** if the faucet is unavailable, setup instructions are shown with STYLE_WARN

**Given** the wallet is funded and SpacetimeDB is connected
**When** no existing player entity is found for the Nostr public key
**Then** a player creation screen is shown (name, starting location)
**And** `client.publish()` calls the create_player reducer via Crosstown

**Given** an existing player entity
**When** identity and connections are established
**Then** the application transitions directly to Main state with the Player tab active
**And** total time from launch to Main is under 5 seconds for returning players

### Story 5.4: Player Tab & Character Status

As a player,
I want to view my character's status, stats, and equipment in a dedicated tab,
So that I can track my progress and manage my character.

**Acceptance Criteria:**

**Given** the Player tab is active
**When** it renders
**Then** it uses the standard left-right SplitPanel layout: category list (left), detail view (right)
**And** categories include: Stats, Equipment, Skills, Empire

**Given** the Stats category is selected
**When** the detail panel renders
**Then** the player's health, position (hex coordinates), level, and key attributes are displayed (FR32)
**And** data is sourced from SpacetimeDB subscription updates via the TUI backend

**Given** the Equipment category is selected
**When** the detail panel renders
**Then** equipped items are shown with names resolved from static data
**And** item stats and properties are displayed

**Given** the Empire category is selected
**When** the detail panel renders
**Then** the player's empire membership, role, and empire status are shown (FR32)
**And** "No empire" is displayed with STYLE_MUTED if the player is unaffiliated

**Given** any category in the Player tab
**When** underlying SpacetimeDB data updates
**Then** the panel re-renders with updated values within 500ms (NFR5)
**And** dirty flags prevent unnecessary re-renders of unchanged data

**Given** the Player tab
**When** the player navigates with Up/Down arrows
**Then** the category list follows SplitPanel wrapping behavior
**And** the footer shows available actions for the selected category

### Story 5.5: Map Tab & Hex Grid Rendering

As a player,
I want to view the game world as a hex-grid map with terrain, resources, and entities,
So that I can navigate and understand the world around me.

**Acceptance Criteria:**

**Given** the Map tab is active
**When** it renders
**Then** a full-width hex-grid map is displayed (no left-right split — Map is the exception)
**And** the map is centered on the player's current position (FR28)

**Given** the hex grid rendering
**When** hexes are drawn
**Then** terrain types are color-coded using the semantic style token system
**And** resources, buildings, and other players are rendered with distinct symbols/colors
**And** the player's own hex is highlighted

**Given** the map is rendered
**When** the player presses arrow keys
**Then** the map viewport pans in the corresponding direction (free-scroll mode)
**And** rendering remains at 30+ FPS during panning (NFR1)

**Given** the map is in free-scroll mode
**When** the player presses a "center on player" key (e.g., `c`)
**Then** the map re-centers on the player's current position

**Given** the HexGrid widget
**When** nearby entities update via SpacetimeDB subscriptions
**Then** the map re-renders to reflect new entity positions, resource changes, and terrain updates
**And** updates appear within 500ms of database commit (NFR5)

**Given** the Map tab footer
**When** the player hovers (selects) a hex
**Then** the hover text row shows hex details: coordinates, terrain type, occupants, resources

### Story 5.6: Character Movement

As a player,
I want to move my character across the hex grid using keyboard controls,
So that I can explore the game world and interact with nearby entities.

**Acceptance Criteria:**

**Given** the Map tab is active and the player is in movement mode
**When** the player presses a directional key (mapped to hex directions)
**Then** the CostPreview widget shows the ILP cost for the move action in the hover text row
**And** the footer shows the movement key bindings

**Given** the cost preview is displayed
**When** the player confirms the move (presses Enter or the movement key again)
**Then** `client.publish()` is called via the TUI backend with the movement skill's target reducer and target hex (skill-sourced, not hardcoded)
**And** the move action is executed through the full ILP pipeline (FR29)

**Given** a successful move action
**When** the SpacetimeDB subscription reflects the new position
**Then** the hex grid updates the player marker to the new hex
**And** the map re-centers on the new position
**And** the wallet balance in the status bar updates to reflect the cost

**Given** a failed move action (insufficient funds, invalid destination)
**When** the TUI backend returns an error
**Then** the hover text row displays the error with STYLE_ERROR
**And** the player's position remains unchanged on the map

**Given** movement input
**When** the input-to-render cycle completes
**Then** the total latency is under 50ms for local rendering (NFR2)
**And** the ILP round-trip for the actual move completes within 2 seconds (NFR3)

### Story 5.7: Chat Panel & Messaging

As a player,
I want to send and receive chat messages with other players,
So that I can communicate and coordinate within the game world.

**Acceptance Criteria:**

**Given** the chat functionality
**When** accessible from any tab (as a panel or overlay)
**Then** recent chat messages are displayed in chronological order
**And** each message shows the sender's display name (resolved from static data) and timestamp

**Given** the chat input is focused
**When** the player types a message and presses Enter
**Then** `client.publish()` is called with the chat skill's target reducer via the TUI backend (FR30, skill-sourced per NFR21)
**And** the message appears in the chat panel once confirmed via SpacetimeDB subscription

**Given** another player sends a chat message
**When** the SpacetimeDB subscription delivers the update
**Then** the new message appears in the chat panel in real-time
**And** messages from different players are visually distinguishable

**Given** the chat panel
**When** messages overflow the visible area
**Then** the player can scroll through message history with Up/Down keys
**And** new messages auto-scroll to the bottom unless the player is scrolling history

**Given** a chat message send failure
**When** the error is returned
**Then** the hover text row shows the error with STYLE_ERROR
**And** the unsent message text is preserved for the player to retry

### Story 5.8: Inventory Management

As a player,
I want to view and manage my inventory with item details,
So that I can track my possessions and use items effectively.

**Acceptance Criteria:**

**Given** the Player tab with Inventory selected, or a dedicated inventory view
**When** it renders
**Then** all items in the player's inventory are listed with name, quantity, and category (FR31)
**And** item names and descriptions are resolved from static data (\*\_desc tables)

**Given** an inventory list
**When** the player navigates with Up/Down arrows
**Then** the selected item's full details are shown in the detail panel: description, stats, weight, usability

**Given** an inventory item that has available actions (use, equip, drop)
**When** the item is selected
**Then** the footer shows available action keys with ILP cost for each action
**And** the CostPreview widget shows the cost in the hover text row

**Given** the player executes an inventory action (e.g., equip item)
**When** the action succeeds via `client.publish()`
**Then** the inventory list updates to reflect the change (item moved to equipment, quantity decremented)
**And** the Player tab stats update if equipment changed

**Given** the inventory data
**When** SpacetimeDB subscription updates occur (item gained from gathering, item traded)
**Then** the inventory panel re-renders automatically
**And** new items appear and removed items disappear without manual refresh

### Story 5.9: Status Bar, WalletMeter & ConnectionBadge

As a player,
I want a persistent status bar showing wallet balance, connection status, and mode indicator,
So that I always know my financial and system state at a glance.

**Acceptance Criteria:**

**Given** the application is in Main state
**When** any tab is active
**Then** the status bar is persistently visible at the bottom of the screen
**And** it contains: WalletMeter, ConnectionBadge, current mode/tab indicator

**Given** the WalletMeter widget
**When** the Crosstown wallet balance is available
**Then** the balance is displayed as a gauge with threshold coloring: WALLET_OK (green, > 50%), WALLET_LOW (yellow, 10-50%), WALLET_CRITICAL (red, < 10%)
**And** the numeric balance is shown alongside the gauge

**Given** the ConnectionBadge widget
**When** SpacetimeDB and Crosstown connections are active
**Then** the badge shows CONNECTION_LIVE (green) with a status icon
**And** connection latency is indicated if elevated

**Given** the SpacetimeDB connection is lost
**When** the ConnectionBadge updates
**Then** it shows CONNECTION_DEAD (gray) immediately
**And** the hover text row shows reconnection attempt count

**Given** a stale connection (connected but high latency)
**When** the ConnectionBadge updates
**Then** it shows CONNECTION_STALE (purple) with latency value

**Given** a game action is executed
**When** the wallet balance changes
**Then** the WalletMeter updates inline with the new balance
**And** no separate notification is needed — the status bar is the feedback mechanism

**Given** any status bar element
**When** rendered alongside game panels
**Then** text labels accompany all color indicators (no color-only information)
**And** the status bar renders correctly on both truecolor and 256-color terminals (ANSI fallback)

---

## Epic 6: Infrastructure & Observability

Operators can monitor system health across the full pipeline — ILP throughput, fee revenue, BLS latency, SpacetimeDB load, and identity propagation success rates. Researchers can spectate their agents' perception, decisions, and actions in real-time through a dedicated TUI observation panel.

### Story 6.1: System Health Monitoring Dashboard

As an operator,
I want to monitor system health metrics across the full pipeline,
So that I can detect issues, track throughput, and ensure the platform is running correctly.

**Acceptance Criteria:**

**Given** the System tab in the TUI (or a dedicated monitoring endpoint)
**When** the operator views system health
**Then** the following metrics are displayed in real-time (FR46):

- ILP packets per second (throughput)
- Fee revenue (cumulative and per-minute rate)
- BLS validation latency (average and p95)
- SpacetimeDB load (active subscriptions, query latency)
- Identity propagation success rate (successful vs. failed attributions)

**Given** system health metrics
**When** a metric crosses a warning threshold (e.g., BLS latency > 1s, success rate < 99%)
**Then** the metric is highlighted with STYLE_WARN
**And** if it crosses a critical threshold, it is highlighted with STYLE_ERROR

**Given** the monitoring system
**When** metrics are collected
**Then** they are sourced from the TUI backend which aggregates data from @sigil/client events
**And** metrics update at the slow tick rate (10Hz) to avoid rendering overhead

**Given** a single Crosstown node under normal load
**When** 10 concurrent agents and 5 concurrent TUI players are connected
**Then** all health metrics remain within acceptable ranges (NFR14)
**And** SpacetimeDB subscriptions remain performant with up to 50 concurrent clients (NFR15)

**Given** system health data
**When** the operator needs historical context
**Then** sparkline widgets show recent metric trends (last 5 minutes)
**And** numeric values show current, average, and peak

### Story 6.2: Agent Observation Mode in TUI

As a researcher,
I want to spectate my agents' perception, decisions, and actions in real-time through the TUI,
So that I can observe emergent behavior without disrupting the agent.

**Acceptance Criteria:**

**Given** the System tab or a dedicated Agent panel in the TUI
**When** the researcher selects an active agent from a list
**Then** a read-only observation view is displayed showing the agent's current state

**Given** the agent observation view
**When** the agent perceives world state (SpacetimeDB subscription updates)
**Then** the observation panel shows what the agent "sees" — semantic events from the event interpreter (Story 3.5)

**Given** the agent observation view
**When** the agent makes a decision (calls an MCP tool)
**Then** the panel shows: the skill invoked, parameters chosen, ILP cost, and action result
**And** the display updates in real-time as decisions occur

**Given** the agent observation view
**When** the agent's budget is tracked
**Then** the panel shows current spend, remaining budget, and a budget utilization gauge

**Given** the observation mode
**When** the researcher is viewing an agent
**Then** the view is strictly read-only — no ability to control or interfere with the agent
**And** the observation data is sourced from the same decision log (Story 3.6) and @sigil/client events

**Given** multiple agents owned by the same researcher
**When** the agent list is displayed
**Then** each agent shows: name, status (active/idle/stopped), current action, budget utilization
**And** the researcher can switch between agents using the SplitPanel list pattern

---

## Epic 7: Advanced Agent Intelligence (Phase 2)

Researchers can run LLM-powered agents with configurable AI backends, persistent memory across sessions, and affordance detection that estimates cost/reward for available actions. This extends the declarative agent system (Epic 3) with deeper cognitive capabilities for advanced experiments.

### Story 7.1: Configurable LLM Backend Selection

As a researcher,
I want to specify which LLM provider and model my agent uses in Agent.md,
So that I can run experiments with different AI backends without code changes.

**Acceptance Criteria:**

**Given** an Agent.md with an LLM configuration section (e.g., `## LLM: claude-sonnet-4-5-20250929`)
**When** the agent configuration is loaded
**Then** the specified LLM provider and model are resolved and configured for the agent's inference calls (FR16)

**Given** supported LLM providers
**When** the agent is configured
**Then** any provider exposing an OpenAI-compatible chat completions API is supported (NFR20)
**And** Anthropic and OpenAI are supported as first-class providers

**Given** an Agent.md referencing an unavailable or invalid LLM backend
**When** configuration validation runs
**Then** a clear error identifies the invalid provider/model
**And** the agent does not start with a broken inference configuration

**Given** two agents with different LLM backends
**When** both run against the same world
**Then** each uses its configured provider independently
**And** decision logs capture which LLM backend produced each decision for A/B comparison

**Given** LLM inference calls
**When** the agent makes decisions
**Then** token usage and API costs are tracked per agent session alongside ILP costs
**And** the budget system (Story 3.4) can optionally include LLM API costs in the budget limit

### Story 7.2: LLM-Powered Goal Planning

As a researcher,
I want agents to make autonomous decisions using LLM-powered reasoning,
So that I can study how language models navigate complex economic and social environments.

**Acceptance Criteria:**

**Given** an agent configured with GoalsLLM planning
**When** the agent's decision cycle runs
**Then** the current world state (semantic events, available actions, budget) is formatted as a prompt
**And** the configured LLM is called to reason about what action to take (FR24)

**Given** an LLM inference call for decision-making
**When** the response is received
**Then** the chosen action is parsed, validated against available skills, and executed via `client.publish()`
**And** the full decision cycle completes within 30 seconds (NFR4)

**Given** the LLM response
**When** it suggests an action not in the agent's skill set
**Then** the system rejects the invalid action with a clear log entry
**And** the agent can retry with a corrected prompt or fall back to the next-best action

**Given** LLM-powered decision-making
**When** each decision is made
**Then** the decision log captures: input prompt (or summary), LLM response, parsed action, execution result, inference latency, and token usage

**Given** the GoalsLLM planner
**When** compared to GoalsSimple (rule-based, from MCP-based agents)
**Then** both planners produce compatible decision log formats
**And** comparative analysis tools can compare decision quality across planner types

### Story 7.3: Persistent Memory System

As a researcher,
I want agents to maintain persistent knowledge across sessions,
So that agents can learn from past experiences and build up contextual understanding over time.

**Acceptance Criteria:**

**Given** an agent with memory enabled in Agent.md
**When** the agent observes events and makes decisions during a session
**Then** key observations, outcomes, and learned patterns are stored in the memory system (FR25)

**Given** an agent session ends
**When** the agent is restarted
**Then** the memory system loads previously stored knowledge from disk
**And** the agent has access to memories from prior sessions

**Given** memory persistence
**When** data is serialized to disk
**Then** it is stored as JSON files in the agent's data directory
**And** the format supports in-memory loading with indexed lookups

**Given** the memory system
**When** the agent queries memory for relevant context (e.g., "what happened last time I visited this hex?")
**Then** relevant memories are retrieved based on recency and relevance
**And** retrieved memories are included in the LLM prompt context for decision-making

**Given** memory accumulation over many sessions
**When** the memory store grows large
**Then** older or less-relevant memories can be summarized or pruned
**And** memory storage size remains bounded per agent

### Story 7.4: Affordance Detection Engine

As a researcher,
I want agents to detect available actions and estimate cost/reward for each,
So that agents can make economically rational decisions in the game world.

**Acceptance Criteria:**

**Given** the agent's current world state (position, inventory, nearby entities)
**When** the affordance engine runs
**Then** all currently available actions are identified based on the agent's skills, position, and game state (FR26)

**Given** detected available actions
**When** the affordance engine estimates costs and rewards
**Then** each action has: ILP cost (from cost registry), estimated reward (heuristic or learned), prerequisites met (boolean), and confidence score

**Given** the affordance list
**When** it is provided to the goal planner (GoalsLLM or GoalsSimple)
**Then** the planner uses cost/reward estimates to make informed decisions
**And** the decision log captures which affordances were considered and why the chosen action was selected

**Given** the agent's budget constraints
**When** affordances are evaluated
**Then** actions exceeding the remaining budget are marked as unaffordable
**And** the planner is informed to avoid budget-exceeding actions

**Given** a changing game world
**When** SpacetimeDB subscription updates arrive
**Then** the affordance list is recalculated to reflect new available actions
**And** actions that are no longer possible (moved out of range, resource depleted) are removed

---

## Epic 8: TUI Advanced Gameplay (Phase 2)

Players can engage in the full depth of BitCraft from their terminal — combat, crafting, building, trading, and empire management. Each system extends the TUI with new panels, action menus, and skill file mappings, building on the core gameplay established in Epic 5.

### Story 8.1: Combat System

As a player,
I want to engage in combat with game entities and other players from my terminal,
So that I can defend my territory, compete for resources, and progress through challenges.

**Acceptance Criteria:**

**Given** the player is near a combatable entity or another player
**When** the player selects combat actions from the action menu
**Then** available combat skills are shown with ILP costs in the footer (FR33)
**And** the CostPreview widget shows the cost before execution

**Given** a combat action is executed
**When** `client.publish()` calls the corresponding combat reducer
**Then** the combat result is reflected via SpacetimeDB subscription updates
**And** health changes, damage dealt, and combat outcomes are displayed in the relevant panels

**Given** an active combat encounter
**When** the player takes damage or defeats an opponent
**Then** the Player tab stats update in real-time (health, status effects)
**And** the Map tab updates entity positions and states

**Given** combat skill files
**When** loaded by the system
**Then** combat-related reducers are mapped to skill files with appropriate costs and prerequisites
**And** the same skills are available to AI agents via MCP tools

### Story 8.2: Crafting System

As a player,
I want to craft items using recipes and gathered resources,
So that I can create equipment, tools, and trade goods.

**Acceptance Criteria:**

**Given** the Economy tab or a crafting panel
**When** the player views available recipes
**Then** recipes are listed with required materials, output items, and ILP crafting cost (FR34)
**And** recipes with all materials available are highlighted; unavailable recipes show missing materials

**Given** a craftable recipe selected
**When** the player initiates crafting
**Then** the CostPreview shows the ILP cost
**And** `client.publish()` calls the appropriate `craft_*` reducer

**Given** a successful craft action
**When** SpacetimeDB subscription updates arrive
**Then** the crafted item appears in inventory and consumed materials are removed
**And** the inventory panel updates automatically

**Given** crafting recipe data
**When** loaded from static data tables
**Then** recipe names, descriptions, and material requirements are resolved from \*\_desc tables

### Story 8.3: Building & Territory Management

As a player,
I want to construct and manage buildings on claimed territory,
So that I can establish a base, produce resources, and expand my empire's footprint.

**Acceptance Criteria:**

**Given** the player has claimed territory
**When** they view building options
**Then** available building types are listed with material costs, ILP costs, and prerequisites (FR35)

**Given** a building is placed
**When** `client.publish()` calls the `build_*` reducer
**Then** the building appears on the hex grid map at the specified location
**And** the player's inventory is decremented by the material cost

**Given** an existing building
**When** the player selects it on the map or in a building list
**Then** building status, production output, and management options are displayed
**And** upgrade and demolish actions are available with cost previews

**Given** territory and building data
**When** SpacetimeDB updates arrive
**Then** the map and building panels reflect current state automatically

### Story 8.4: Trading Marketplace

As a player,
I want to create and respond to trade offers with other players,
So that I can buy and sell resources, items, and services in the game economy.

**Acceptance Criteria:**

**Given** the Economy tab with market view
**When** the player browses the marketplace
**Then** active trade offers are listed with: offered items, requested items, seller identity, and ILP transaction cost (FR36)

**Given** the player wants to create a trade offer
**When** they specify items to offer and items to request
**Then** `client.publish()` creates the trade offer via the `trade_*` reducer
**And** the offer appears in the marketplace for other players

**Given** an existing trade offer from another player
**When** the player accepts the offer
**Then** `client.publish()` executes the trade via the appropriate reducer
**And** both players' inventories update via SpacetimeDB subscriptions

**Given** a trade the player created
**When** they want to cancel it
**Then** a cancel action is available with the trade still active
**And** the offer is removed from the marketplace after cancellation

### Story 8.5: Empire Management

As a player,
I want to participate in empire management — join, create, govern, and conduct diplomacy,
So that I can collaborate with other players and compete at a larger scale.

**Acceptance Criteria:**

**Given** the player is not in an empire
**When** they browse available empires
**Then** existing empires are listed with member count, territory size, and join requirements (FR37)
**And** a "Create Empire" option is available

**Given** the player joins or creates an empire
**When** the action is executed via `client.publish()`
**Then** the Player tab updates with empire membership and role
**And** empire-specific panels become available (member list, territory, diplomacy)

**Given** the player has governance permissions in their empire
**When** they access governance controls
**Then** they can manage members (promote, demote, remove), set policies, and initiate diplomacy with other empires

**Given** diplomacy actions (alliance, war, trade agreements)
**When** initiated via the TUI
**Then** the actions are executed through appropriate reducers with ILP costs
**And** diplomacy status is visible in the empire panel

---

## Epic 9: Experiment Harness & Multi-Agent Research (Phase 2)

Researchers can run comparative experiments with multiple concurrent agents, configure experiments from YAML files, snapshot and restore world state for reproducibility, and analyze decision logs across experiment runs.

### Story 9.1: Multi-Agent Concurrent Launcher

As a researcher,
I want to run multiple agents concurrently against the same game world,
So that I can study multi-agent dynamics, competition, and emergent behavior.

**Acceptance Criteria:**

**Given** a multi-agent configuration (YAML or command-line)
**When** the launcher is invoked
**Then** N agents are spawned concurrently, each with its own Nostr identity and @sigil/client instance (FR40)
**And** each agent connects to the same SpacetimeDB server

**Given** multiple concurrent agents
**When** all are running
**Then** each agent operates independently with its own Agent.md, skill set, and budget
**And** each produces its own JSONL decision log

**Given** concurrent agents under load
**When** 10+ agents are active simultaneously
**Then** the system remains stable and performant (NFR14)
**And** SpacetimeDB subscriptions remain responsive for all connected clients

**Given** the agent launcher
**When** a single agent crashes or exceeds its budget
**Then** other agents continue running unaffected
**And** the failed agent's status and error are logged

### Story 9.2: YAML Experiment Configuration

As a researcher,
I want to define experiments in YAML configuration files,
So that I can specify agent configurations, parameters, and experiment metadata declaratively.

**Acceptance Criteria:**

**Given** a YAML experiment configuration file
**When** the experiment runner parses it
**Then** the following are extracted: experiment name, agent configurations (count, Agent.md paths, skill sets), duration, and success criteria (FR41)

**Given** a valid experiment configuration
**When** the experiment is launched
**Then** all specified agents are started with their respective configurations
**And** experiment metadata (start time, config hash, versions) is recorded

**Given** an experiment configuration referencing invalid Agent.md paths or skills
**When** validation runs before launch
**Then** clear errors identify the invalid references
**And** the experiment does not start with a partial configuration

**Given** completed experiments
**When** the configuration file is archived alongside results
**Then** the exact experiment is reproducible by re-running the same YAML file against the same world state

### Story 9.3: World State Snapshot & Restore

As a researcher,
I want to snapshot and restore SpacetimeDB world state,
So that I can run reproducible experiments from the same starting conditions.

**Acceptance Criteria:**

**Given** a running game world
**When** the researcher triggers a snapshot
**Then** the current SpacetimeDB world state is captured and saved to a timestamped snapshot file (FR42)

**Given** a saved snapshot
**When** the researcher triggers a restore
**Then** the SpacetimeDB world state is restored to the captured state
**And** all connected clients receive subscription updates reflecting the restored state

**Given** a snapshot file
**When** multiple experiments are run from the same snapshot
**Then** each experiment starts from identical world conditions
**And** results are comparable across runs

**Given** snapshot/restore operations
**When** they execute
**Then** the operations complete within a reasonable timeframe for the world size
**And** agent states (decision logs, budgets) are reset or preserved as configured

### Story 9.4: Comparative Decision Log Analysis

As a researcher,
I want to compare decision logs across experiment runs,
So that I can evaluate how different agent configurations or LLM backends affect behavior and outcomes.

**Acceptance Criteria:**

**Given** decision logs from multiple experiment runs
**When** the analysis tool processes them
**Then** comparative metrics are produced: actions taken, budget efficiency, area explored, goals achieved, error rates (FR43)

**Given** two experiment runs with different LLM backends
**When** compared
**Then** the analysis highlights behavioral differences: decision latency, action distribution, cost patterns, and outcome quality

**Given** comparative analysis results
**When** the researcher reviews them
**Then** results are formatted as structured reports (JSON or markdown)
**And** key metrics are summarized with statistical comparisons

**Given** decision logs from agents with different skill configurations
**When** compared
**Then** the analysis shows how skill availability affected agent behavior and decision patterns

---

## Epic 10: World Extensibility (Phase 2)

Game developers can make any SpacetimeDB world agent-accessible by writing skill files for its public reducers and registering Crosstown BLS handlers — no SDK code changes required. The platform generalizes beyond BitCraft.

### Story 10.1: Skill File Authoring for New Worlds

As a game developer,
I want to write skill files for my SpacetimeDB world's public reducers,
So that AI agents and TUI players can interact with my game through the Sigil platform.

**Acceptance Criteria:**

**Given** a SpacetimeDB module with public reducers and tables
**When** the game developer writes SKILL.md files for each reducer
**Then** each skill maps a game action to a reducer with parameters, cost, and subscriptions (FR48)
**And** no changes to @sigil/client, @sigil/mcp-server, or sigil-tui are required

**Given** skill files for a new SpacetimeDB world
**When** loaded by @sigil/client
**Then** the skill parser validates them against the connected module's schema
**And** valid skills are exposed as MCP tools and TUI actions automatically

**Given** a skill file authoring guide (skills/README.md)
**When** a developer follows the guide
**Then** they can create functioning skill files for any SpacetimeDB reducer
**And** example skill files for BitCraft serve as templates

**Given** a new world's skill files
**When** the MCP server loads them
**Then** AI agents can play the new world using the same MCP protocol
**And** the only per-world customization is the skill files themselves

### Story 10.2: BLS Handler Registration for Third-Party Games

As a game developer,
I want to register a Crosstown BLS handler for my SpacetimeDB module's reducers,
So that my game world is accessible through the ILP payment pipeline.

**Acceptance Criteria:**

**Given** a new SpacetimeDB module
**When** the game developer registers a BLS handler with the Crosstown node
**Then** ILP-routed game action events for their module are dispatched to the correct SpacetimeDB instance (FR49)

**Given** a registered BLS handler
**When** ILP packets arrive with the new module's reducer names
**Then** the BLS validates signatures, extracts identity, and calls the correct reducers
**And** identity propagation works the same as for BitCraft

**Given** multiple BLS handlers (BitCraft + third-party game)
**When** both are registered on the same Crosstown node
**Then** events are routed to the correct handler based on event metadata
**And** handlers operate independently without interference

---

## Epic 11: Platform Expansion (Phase 3)

The platform auto-generates skeleton skill files from any SpacetimeDB module's published schema, dramatically lowering the barrier for new world integration and enabling rapid onboarding of new game worlds.

### Story 11.1: Auto-Generate Skill Files from SpacetimeDB Schema

As a game developer,
I want the system to auto-generate skeleton skill files from my SpacetimeDB module's published schema,
So that I can quickly bootstrap skill definitions without manually mapping every reducer.

**Acceptance Criteria:**

**Given** a connected SpacetimeDB module
**When** the skill generator tool is invoked
**Then** it reads the module's published schema (available reducers, table definitions, parameter types) (FR50)
**And** generates a SKILL.md skeleton for each public reducer

**Given** generated skeleton skill files
**When** the developer reviews them
**Then** each file contains: reducer name, parameter names with types, required table subscriptions (inferred from reducer arguments), and placeholder description/guidance

**Given** generated skeletons
**When** loaded by @sigil/client without modifications
**Then** they are syntactically valid and pass basic skill parsing
**And** they require developer review to add: ILP cost, natural-language guidance, and usage conditions

**Given** a large SpacetimeDB module (e.g., BitCraft with 364+ reducers)
**When** the generator runs
**Then** all public reducers produce skill file skeletons
**And** the generator completes within a reasonable time (under 60 seconds)
