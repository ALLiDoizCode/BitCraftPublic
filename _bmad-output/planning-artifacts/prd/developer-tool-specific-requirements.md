# Developer Tool Specific Requirements

## Language Matrix

| Runtime | Language | Primary Users | Package Manager | Key Dependencies |
|---------|----------|--------------|----------------|-----------------|
| SDK + Backends | TypeScript/Node.js | All (via wrappers) | pnpm | SpacetimeDB TS client, nostr-tools, ILP client |
| TUI Frontend | Rust | Terminal players | cargo | ratatui, crossterm, tokio, serde_json |
| Infrastructure | Docker | Platform operators | docker compose | Game server (WASM), Crosstown node |

## Installation Methods

- **SDK (`@sigil/client`):** `pnpm install @sigil/client` — pure TypeScript library, zero native dependencies
- **TUI Client:** `cargo install sigil-tui` — Rust binary for terminal frontend (requires `@sigil/tui-backend` TypeScript process)
- **Local development environment:** `docker compose up` — starts game server + Crosstown node
- **Agent deployment:** Clone repo, edit `Agent.md` + select skill files, `npm start` or `cargo run`

## API Surface

**Declarative Layer (no code):**
- `Agent.md` — Agent configuration: name, personality, skill selection, budget limits, LLM backend, logging preferences
- Skill files (`.md`) — One per game action: reducer name, parameters, ILP cost, required table subscriptions, natural-language description, usage guidance

**SDK Runtime Layer (TypeScript):**
- `SpacetimeDBClient` — Table subscription management, query interface, reconnection handling
- `CrosstownClient` — Relay subscription for events (read), ILP packet construction/signing/submission (write), fee tracking
- `SkillParser` — Load and validate Agent.md + skill files, build action registry
- `CognitionStack` — Pluggable five-layer pipeline (StaticData → EventInterpreter → Memory → Affordance → Goals)
- `DecisionLogger` — JSONL output with timestamps, world state, costs, outcomes

**TUI Frontend (Rust — presentation layer only):**
- `TuiApp` — ratatui application: event loop, screen management, input handling (rebels-in-the-sky patterns)
- `HexRenderer` — Hex-grid map rendering with terrain, entities, players
- `PanelSystem` — Chat, inventory, status, crafting panels with keyboard navigation
- `IpcClient` — JSON-RPC 2.0 client communicating with `@sigil/tui-backend` (TypeScript) over stdio
- All game data and actions flow through the TypeScript backend — Rust has no direct SpacetimeDB or Crosstown connections

## Code Examples

**Example Agent.md:**
```markdown
# Agent: Gatherer-01
## Personality: Cautious resource optimizer
## Skills: harvest_resource, check_prices, create_trade_offer, move_to_hex
## Budget: 0.05 USD/hour
## LLM: claude-sonnet-4-5-20250929
## Logging: decisions.jsonl
```

**Example Skill File (`harvest_resource.md`):**
```markdown
# Skill: Harvest Resource
## Reducer: harvest_resource
## Parameters: entity_id (u64), tool_id (u64)
## Cost: 0.001 USD
## Subscriptions: nearby_resources, player_inventory, player_position
## Description: Harvest a resource node within range. Requires appropriate tool in inventory.
## When to use: When a harvestable resource is nearby and inventory has space.
```

**Quickstart paths:**
1. AI Researcher: Clone → `docker compose up` → edit Agent.md → `npm start` (< 30 min)
2. Terminal Player: `cargo install sigil-tui` → generate Nostr key → connect (spawns TypeScript backend automatically) → play (< 5 min)
3. Game Developer: Write skill files for reducers → register BLS handler → publish (< 1 hour)

## Documentation Requirements

- **Getting Started guides** — one per persona (researcher, player, game dev)
- **Skill file authoring guide** — format specification, best practices, examples for all action categories
- **Agent.md specification** — complete schema reference with defaults and validation
- **Architecture overview** — three-client data flow, identity propagation, cognition stack
- **API reference** — auto-generated from TypeScript source (TypeDoc)
- **Reducer catalog** — all accessible game actions with parameters, costs, and related subscriptions

## Implementation Considerations

- **Skill file format:** Parsed by `@sigil/client` (TypeScript) and exposed uniformly to all consumers (MCP server, TUI backend). The Rust TUI does not parse skill files — it receives action information from the TypeScript backend.
- **Version compatibility:** SDK versions declare which SpacetimeDB protocol version and Crosstown API version they support. Skill files include a format version.
- **Error messages:** Actionable developer-facing errors: "Skill file `harvest_resource.md` references reducer `harvest_resource` but SpacetimeDB module does not expose this reducer" — not "connection error."
- **Offline development:** Docker compose environment enables fully offline development and testing. No external service dependencies for local dev.