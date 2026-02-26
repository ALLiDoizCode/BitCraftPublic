# Core Architectural Decisions

## Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Repository Strategy — Single polyglot monorepo (TS + Rust)
2. Identity Propagation — BLS proxy reducer pattern with Nostr pubkey injection
3. Agent Runtime — Claude instance with CLAUDE.md/AGENTS.md + Skills + MCP tools
4. MCP Server — Standalone TypeScript MCP server exposing game world
5. Client Package Architecture — `@sigil/client` TS package consumed by TUI backend + headless agent
6. Agent Inference — TS backend uses Agent SDKs (Anthropic, Vercel AI) for LLM inference

**Important Decisions (Shape Architecture):**
7. TUI Architecture — rebels-in-the-sky patterns + agent observation mode
8. Skill File Format — Standard Claude Agent Skills (SKILL.md), out of scope for custom design
9. Agent Config Naming — CLAUDE.md (Claude agents) / AGENTS.md (non-Claude agents)

**Deferred Decisions (Post-MVP):**
- Vector DB choice for semantic memory (ChromaDB vs alternatives)
- Multi-agent coordination protocols
- Agent marketplace / sharing mechanism
- SSH server support for TUI (rebels-in-the-sky has this, defer to Phase 2+)

## Data Architecture

**Database:** SpacetimeDB (server-side, unmodified BitCraft). No additional database required for MVP.
- SpacetimeDB SDK 1.3.3 (1.x) required for compatibility with BitCraft's 1.6.0 server (SDK 2.0+ NOT backwards compatible)
- ~80 entity tables, 148 static data tables, 364+ reducers available
- Subscription-based real-time state sync via TypeScript SDK

**Data Modeling:** SpacetimeDB tables define the schema. TypeScript SDK consumes generated client bindings.
- TypeScript: `spacetimedb generate --lang typescript`

**Persistence:** Agent state (CLAUDE.md, skill files, decision logs) stored as local files. Game state lives entirely in SpacetimeDB.

## Authentication & Security

**Identity:** Nostr keypair is the sole identity mechanism.
- No usernames, passwords, or OAuth
- Private keys managed locally per agent/player, never transmitted
- Public key = player identity across all systems

**Identity Propagation Pattern:**
```
Agent/Player → SDK Proxy Layer → Inject Nostr pubkey as reducer arg
→ ILP payment signed with Nostr key → Crosstown routes to BLS
→ BLS validates signature against pubkey → Forwards to SpacetimeDB reducer
```

**Authorization:** BLS (BitCraft Login Server) validates every write action. No bypass paths. ILP micropayment required for every game write.

**Security Invariants:**
- Zero silent identity propagation failures (fail loud, fail fast)
- All ILP packets cryptographically signed
- Private keys never leave the local process
- SDK proxy layer cannot be bypassed for write operations

## API & Communication Patterns

**MCP Server (Primary Agent Interface):**
- Standalone TypeScript process
- Exposes game world state as MCP resources (read)
- Exposes game actions as MCP tools (write, routed through BLS)
- Any MCP-compatible client can connect (Claude, Vercel AI, OpenCode, etc.)
- Connects to SpacetimeDB for subscriptions, Crosstown/BLS for authenticated writes

**SpacetimeDB Protocol:**
- WebSocket (SpacetimeDB SDK 1.x compatible with 1.6.0 server)
- Subscription-based: clients subscribe to table queries, receive real-time updates
- Reducer calls for all write operations
- Global reducer callbacks (1.x SDK pattern; 2.0+ uses event tables + `_then()` callbacks)

**Crosstown/ILP Protocol:**
- Every game write action is an ILP micropayment
- Payment routes through Crosstown relay nodes
- BLS validates and forwards to SpacetimeDB

**TUI ↔ Backend Communication:**
- Rust ratatui TUI connects to TypeScript backend via IPC (stdio/local WebSocket)
- TypeScript backend handles all SpacetimeDB, Crosstown, and MCP connectivity
- TUI is a pure presentation layer — no direct SpacetimeDB or Crosstown connections from Rust

**Error Handling:** Errors cross multiple boundaries (SpacetimeDB → TS Backend → Crosstown → BLS → SpacetimeDB). The TypeScript backend provides actionable error messages with context about which boundary failed, surfaced in the TUI.

## Client Package Architecture (`@sigil/client`)

**Key Architectural Decision:** `@sigil/client` is the core engine — a pure TypeScript library with no CLI, no process management, no transport opinions. It handles all game connectivity: SpacetimeDB subscriptions, Crosstown/ILP payments, Nostr identity, and event aggregation. Everything else is a thin wrapper.

**Architecture: Client + Wrappers**

```
                    @sigil/client
                   (pure library — the engine)
                  /                \
                 /                  \
    @sigil/                 @sigil/
    mcp-server              tui-backend
    (MCP protocol wrapper)  (JSON-RPC IPC wrapper)
        ↑                        ↑
    Claude / OpenCode /       Rust TUI
    Vercel AI / any MCP       (sigil-tui)
    compatible agent
```

- **`@sigil/client`** — pure library. Imported by wrappers. Never runs as a process itself.
- **`@sigil/mcp-server`** — wraps client in MCP protocol. AI agents (Claude, OpenCode, Vercel AI) connect here.
- **`@sigil/tui-backend`** — wraps client in JSON-RPC 2.0 over stdio. Rust TUI spawns and talks to this.

The "headless agent" use case is handled by external agent SDKs (Vercel AI SDK, Claude Agent SDK) that either import `@sigil/client` directly or connect to `@sigil/mcp-server`. No separate headless package needed.

**`@sigil/client` API Surface:**

```typescript
const client = new SigilClient({
  spacetimedb: { host: '...', module: '...' },
  nostr: { relay: '...', privateKey: '...' },
  crosstown: { node: '...' }
})

// === Two independent read surfaces ===

// SpacetimeDB: game world state
client.spacetimedb.subscribe('player_state', query)
client.spacetimedb.on('tableUpdate', handler)
client.spacetimedb.tables   // generated type-safe table accessors

// Nostr relay: confirmations, notifications, social
client.nostr.subscribe(filters)
client.nostr.on('event', handler)
client.nostr.relay           // raw relay connection

// === One write path ===

// Everything goes through ILP — single write API
client.publish(action)       // signs → ILP packet → Crosstown → BLS → SpacetimeDB

// === High-level aggregated events ===

client.on('actionConfirmed', handler)   // from Nostr relay
client.on('gameStateUpdate', handler)   // from SpacetimeDB
client.on('connectionChange', handler)  // from either

// === Identity ===

client.identity              // Nostr keypair, public key
```

| Surface | Purpose | Type |
|---------|---------|------|
| `client.spacetimedb` | Game world state (tables, subscriptions) | Read |
| `client.nostr` | Relay events (confirmations, social, custom) | Read |
| `client.publish()` | All game actions (ILP → Crosstown → BLS → SpacetimeDB) | Write |
| `client.on()` | High-level aggregated events from both sources | Read (convenience) |
| `client.identity` | Nostr keypair, public key | Identity |

**Design rationale:**
- Two read surfaces because SpacetimeDB and Nostr relay are independent data sources with different protocols
- One write path because the architecture has a single write pipeline (all actions go through ILP/Crosstown/BLS)
- `client.publish()` — not "write to SpacetimeDB" or "write to Nostr". The consumer publishes intent; the client handles the pipeline
- High-level events aggregate from both sources for consumers who don't need to know which system generated the event

## Frontend Architecture (Hybrid TUI)

**Rust TUI (Presentation Layer):**
- ratatui 0.30+ with crossterm 0.29.0 backend
- tokio async runtime for terminal input + tick scheduling + IPC
- Follows rebels-in-the-sky patterns:
  - `Screen` trait: `update()`, `render()`, `handle_key_events()`, `footer_spans()`
  - `UiCallback` enum: Typed callback variants dispatched to backend via IPC
  - `CallbackRegistry`: Mouse/keyboard hit-testing during render pass
  - `UiFrame` wrapper: Screen centering, callback registration, hover text
  - Dirty flags: Minimize re-renders, target 30+ FPS
  - Tick system: Slow tick (10Hz) for game state polling, fast tick (40Hz) for animations

**TUI Backend (consumes `@sigil/client`):**
- Node.js process that imports `@sigil/client`
- Exposes game state and action API to the Rust TUI via IPC
- Manages agent inference lifecycle
- Bridges agent decisions to game actions

**Communication Bridge (Rust ↔ TypeScript):**
- IPC mechanism: stdio pipes (Rust spawns Node.js child process) or local WebSocket
- Protocol: JSON messages with typed schemas (game state updates, action requests, responses)
- Rust TUI sends user actions → TS backend processes → SpacetimeDB/Crosstown → result back to TUI
- TS backend pushes real-time game state updates → Rust TUI renders

## Headless Agent Mode

Headless agents are not a Sigil package — they are external agent frameworks that consume Sigil:
- **Via MCP:** Agent SDKs (Claude, OpenCode, Vercel AI) connect to `@sigil/mcp-server` using standard MCP protocol. The MCP server exposes game world as tools/resources. This is the primary headless path.
- **Via direct import:** A researcher can `import { SigilClient } from '@sigil/client'` in their own TypeScript code alongside any agent SDK (Vercel AI SDK, Anthropic SDK) for custom orchestration.

**Agent Observation Mode (TUI only):**
- TUI includes a dedicated view for spectating agents owned by the human player
- Real-time display of agent perception, decisions, and actions (sourced from TS backend)
- Read-only view — human observes but does not control the agent

**Panels (following rebels pattern):**
- Game world view (galaxy, planets, teams)
- Agent dashboard (observation mode)
- Player/team management
- Market/trading interface
- Space adventure (if applicable)

## Infrastructure & Deployment

**Local Development:**
- Docker Compose: BitCraft server + Crosstown node + BLS
- TypeScript workspace builds independently (SDK core + MCP server + TUI backend)
- Rust TUI builds independently (presentation layer only)
- MCP server runs as standalone process

**Repository Layout (Single Polyglot Monorepo):**
```
sigil/
├── packages/              # TypeScript (pnpm workspace)
│   ├── client/            # @sigil/client — pure library (the engine)
│   │                      #   SpacetimeDB + Crosstown/ILP + Nostr + Identity
│   ├── mcp-server/        # @sigil/mcp-server — MCP protocol wrapper
│   └── tui-backend/       # @sigil/tui-backend — JSON-RPC IPC wrapper
├── crates/                # Rust (cargo workspace)
│   └── tui/               # sigil-tui — ratatui presentation layer
├── skills/                # Shared SKILL.md files
├── agents/                # Agent definitions
│   ├── CLAUDE.md          # Claude agent configuration
│   └── AGENTS.md          # Non-Claude agent configuration
├── examples/              # Example agent configurations
├── docker/                # Docker Compose for local dev
├── pnpm-workspace.yaml
├── Cargo.toml             # Virtual manifest
└── package.json
```

**CI/CD:** GitHub Actions — lint, test, build for both workspaces. Type checking (TS strict mode), clippy (Rust).

## Agent Configuration Architecture

**CLAUDE.md (Claude Agents):**
- Claude-specific configuration following Claude Code conventions
- Defines agent personality, constraints, goals, budget limits
- References skills and MCP server connection details

**AGENTS.md (Non-Claude Agents):**
- Generic agent configuration for non-Claude AI systems (Vercel AI, OpenCode, etc.)
- Runtime-agnostic format
- Same game capabilities, different configuration surface

**Skills (SKILL.md):**
- Standard Claude Agent Skills format
- YAML frontmatter: name, description
- Markdown body: instructions, examples, tool references
- Progressive disclosure: metadata always loaded, full instructions on trigger

## Decision Impact Analysis

**Implementation Sequence:**
1. Repository scaffolding (monorepo with TS workspace + Rust crate)
2. `@sigil/client` package: SpacetimeDB 1.x client + Nostr relay + Crosstown/ILP + Identity + `client.publish()` write path
3. `@sigil/mcp-server` (MCP protocol wrapper over `@sigil/client`, exposes game world as tools/resources)
4. `@sigil/tui-backend` (JSON-RPC IPC wrapper over `@sigil/client`, bridge for ratatui)
5. `sigil-tui` Rust TUI application (ratatui presentation layer, connects to tui-backend via IPC)
6. Agent configuration (CLAUDE.md + AGENTS.md + Skills)
7. Agent observation mode in TUI

**Cross-Component Dependencies:**
- `@sigil/client` is the foundational package — both wrappers depend on it
- `@sigil/mcp-server` wraps `@sigil/client` in MCP protocol (for AI agents)
- `@sigil/tui-backend` wraps `@sigil/client` in JSON-RPC IPC (for Rust TUI)
- `sigil-tui` depends on `@sigil/tui-backend` (IPC communication for all data)
- Headless agents connect to `@sigil/mcp-server` via MCP, or import `@sigil/client` directly
- Skills are consumed by MCP server (tool definitions) and agent configs
- Identity + `client.publish()` pipeline is foundational — blocks all write operations

**Superseded Architecture (to be removed/replaced in future refinement):**
- Section 5: Five-Layer Cognition Architecture → Replaced by Claude + Skills + MCP
- Section 5.1: CognitionPlugin<TInput, TOutput, TState> → No longer applicable
- Section 5.2: Layer implementations (PerceptionFilter, GoalsEngine, etc.) → Agent cognition is Claude, not custom code
- Rust SDK core for SpacetimeDB/Crosstown → Eliminated; `@sigil/client` (TS) handles all connectivity
- Section 10: Technology Choices → Partially superseded (single TS runtime for all backend logic, Rust only for TUI rendering)

---
