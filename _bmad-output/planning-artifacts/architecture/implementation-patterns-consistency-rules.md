# Implementation Patterns & Consistency Rules

## Pattern Categories Defined

**9 critical conflict areas** identified where AI agents could make incompatible choices across the polyglot monorepo.

## Naming Patterns

**TypeScript Naming Conventions:**

- Files: `kebab-case.ts` (e.g., `game-state.ts`, `mcp-server.ts`, `identity-proxy.ts`)
- Functions/variables: `camelCase` (e.g., `getPlayerInfo`, `gameState`)
- Types/interfaces: `PascalCase` (e.g., `PlayerState`, `GameAction`, `SigilClientOptions`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_PLAYERS`, `DEFAULT_TICK_RATE`)
- Exports: barrel `index.ts` per package for public API surface

**Rust Naming Conventions (following rebels-in-the-sky):**

- Files: `snake_case.rs` (e.g., `game_panel.rs`, `clickable_list.rs`)
- Functions/variables: `snake_case` (e.g., `handle_key_events`, `game_state`)
- Types/structs/enums: `PascalCase` (e.g., `UiCallback`, `AppEvent`, `Screen`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `UI_SCREEN_SIZE`, `LEFT_PANEL_WIDTH`)

**JSON / IPC Field Naming:**

- All JSON exchanged between Rust and TypeScript uses `camelCase` fields
- Rust side: `#[serde(rename_all = "camelCase")]` on all IPC message structs
- Rationale: TS is the data layer, Rust is presentation — TS conventions dominate the wire format

**MCP Tool & Resource Naming:**

- Tool names: `snake_case` (MCP convention) — e.g., `move_player`, `get_inventory`, `submit_trade`, `explore_planet`
- Resource URIs: plural nouns — `sigil://players/{id}`, `sigil://planets/{id}`, `sigil://teams/{id}`

## Structure Patterns

**TypeScript Project Organization:**

- One package per concern: `client`, `mcp-server`, `tui-backend`, `headless-agent`, `harness`
- Each package has: `src/`, `tests/`, `package.json`, `tsconfig.json`, `tsup.config.ts`
- Barrel exports: `src/index.ts` defines public API per package
- Internal modules: `src/{feature}/` directories for complex packages

**Rust Project Organization (rebels-in-the-sky pattern):**

- Single `crates/tui/` crate for the TUI application
- Module structure mirrors rebels: `src/ui/` (panels, widgets), `src/ipc/` (backend communication)
- One file per widget, one file per panel/screen
- `mod.rs` barrel re-exports per module

**Test Organization:**

- TypeScript: co-located `*.test.ts` next to source files (vitest convention)
- TypeScript integration tests: `packages/*/tests/integration/`
- Rust: inline `#[cfg(test)] mod tests` blocks (standard Rust, matches rebels-in-the-sky)
- Rust integration tests: `crates/tui/tests/`
- Cross-runtime IPC tests: `packages/tui-backend/tests/integration/`

**Configuration Files:**

- Shared ESLint + Prettier config at monorepo root
- Shared `tsconfig.base.json` at root, extended per package
- Shared `rustfmt.toml` at root
- Environment: `.env.example` at root, `.env` gitignored

## Format Patterns

**IPC Protocol — JSON-RPC 2.0:**

- Standard JSON-RPC 2.0 format for all Rust ↔ TypeScript communication
- Request: `{"jsonrpc": "2.0", "method": "getGameState", "params": {}, "id": 1}`
- Response: `{"jsonrpc": "2.0", "result": {...}, "id": 1}`
- Error: `{"jsonrpc": "2.0", "error": {"code": -32000, "message": "...", "data": {"boundary": "spacetimedb"}}, "id": 1}`
- Notification (no response expected): `{"jsonrpc": "2.0", "method": "gameStateUpdate", "params": {...}}`
- Rust side: typed message enums with serde, matching rebels-in-the-sky `AppEvent` pattern

**Error Format (`@sigil/client`):**

- Typed error classes extending `Error`
- Required fields: `code` (enum), `message` (human-readable), `boundary` (where error originated)
- Boundary values: `spacetimedb`, `crosstown`, `bls`, `mcp`, `agent`, `ipc`
- Example: `new SigilError({ code: 'REDUCER_FAILED', message: 'Move rejected: insufficient fuel', boundary: 'spacetimedb' })`

**Data Exchange:**

- Dates: ISO 8601 strings in JSON (`2026-02-25T12:00:00Z`)
- IDs: string UUIDs (matching SpacetimeDB identity format)
- Nulls: explicit `null` in JSON, `Option<T>` in Rust, `T | null` in TypeScript
- Game ticks: `number` (milliseconds since epoch, matching rebels-in-the-sky `Tick = u64`)

## Communication Patterns

**`@sigil/client` Event System:**

- Event-driven: `EventEmitter` pattern with typed events
- Client emits typed events on SpacetimeDB subscription updates
- Events: `gameStateUpdate`, `playerAction`, `agentDecision`, `connectionStatusChange`, `error`
- Consumers (tui-backend, headless-agent) subscribe to events they care about
- No polling — all state changes are push-based from SpacetimeDB subscriptions

**`@sigil/client` Public API Pattern:**

- Constructor: `new SigilClient(options: SigilClientOptions)`
- All methods: `async/await` Promises (no callbacks, no observables)
- All methods return typed results — no `any`
- Options object pattern for all configuration
- Explicit `connect()` / `disconnect()` lifecycle methods

**TUI State Management (rebels-in-the-sky pattern):**

- `UiCallback` enum: typed variants for all user actions
- Callbacks dispatched to TUI backend via JSON-RPC over IPC
- Dirty flags on state changes to minimize re-renders
- `AppState` enum for top-level application state machine
- Panel-level state managed per-screen (matching rebels `UiState`, `UiTab`)

## Process Patterns

**Error Handling Chain:**

- `@sigil/client`: catches and wraps all external errors with `boundary` field
- TUI backend: forwards typed errors via JSON-RPC error objects to Rust TUI
- Rust TUI: maps IPC errors to UI-displayable popup messages (matching rebels `PopupMessage::Error`)
- Headless agent: logs errors to decision log, applies retry/backoff per error type
- Invariant: Rust TUI never crashes on backend errors — always displays gracefully

**Connection Lifecycle:**

- `@sigil/client` manages SpacetimeDB WebSocket connection
- Auto-reconnect with exponential backoff (max 30s) on disconnect
- Connection state emitted as events: `connecting`, `connected`, `disconnected`, `reconnecting`
- TUI displays connection status in status bar (matching rebels pattern)
- Headless agent logs connection state changes

**Agent Inference Lifecycle:**

- `@sigil/client` provides pluggable agent inference via Agent SDK integration
- Inference configured at construction: `new SigilClient({ agent: { sdk: 'anthropic', model: 'claude-sonnet-4-5-20250929' } })`
- Agent loop: perceive (SpacetimeDB state) → decide (LLM inference) → act (reducer call via Crosstown)
- Decision logging: every inference call logged with input context, output action, latency
- Budget tracking: token/cost tracking per agent session

**Loading States:**

- TUI: loading spinner on panels awaiting backend data (rebels pattern)
- Named states: `loading`, `loaded`, `error`, `stale` (connected but data outdated)
- Global connection state in status bar, per-panel data state in panel header

## Enforcement Guidelines

**All AI Agents Working on This Codebase MUST:**

- Follow the naming conventions above for their respective language (TS or Rust)
- Use JSON-RPC 2.0 for any new IPC messages
- Use `camelCase` for all JSON fields crossing the IPC boundary
- Use `snake_case` for MCP tool names
- Wrap errors with `boundary` field indicating origin
- Write co-located tests for new TypeScript code
- Write inline `#[cfg(test)]` tests for new Rust code
- Use `async/await` for all async TypeScript code (no callbacks)

**Enforcement Mechanisms:**

- ESLint: naming convention rules, no-any rule, consistent-type-imports
- Prettier: format on save, checked in CI
- `cargo clippy`: lint all Rust code, deny warnings in CI
- `rustfmt`: format all Rust code, checked in CI
- JSON schema validation: IPC message schemas in `packages/client/schemas/`, validated by both TS (ajv) and Rust (serde) sides
- CI pipeline: `pnpm lint && pnpm test && cargo clippy && cargo test` on every PR

## Pattern Examples

**Good — IPC message from Rust TUI to TS backend:**

```json
{
  "jsonrpc": "2.0",
  "method": "movePlayer",
  "params": { "playerId": "abc-123", "targetPlanetId": "def-456" },
  "id": 42
}
```

**Bad — wrong field casing, no JSON-RPC wrapper:**

```json
{ "action": "move_player", "player_id": "abc-123", "target_planet_id": "def-456" }
```

**Good — MCP tool definition:**

```json
{ "name": "move_player", "description": "Move a player to a target planet" }
```

**Bad — camelCase MCP tool name:**

```json
{ "name": "movePlayer", "description": "Move a player to a target planet" }
```

**Good — error from `@sigil/client`:**

```typescript
throw new SigilError({
  code: 'REDUCER_FAILED',
  message: 'Move rejected: insufficient fuel',
  boundary: 'spacetimedb',
});
```

**Bad — untyped error:**

```typescript
throw new Error('something went wrong');
```

---
