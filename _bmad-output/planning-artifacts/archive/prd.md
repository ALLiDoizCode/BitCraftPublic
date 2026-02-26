---
stepsCompleted:
  [
    'step-01-init',
    'step-02-discovery',
    'step-02b-vision',
    'step-02c-executive-summary',
    'step-03-success',
    'step-04-journeys',
    'step-05-domain',
    'step-06-innovation',
    'step-07-project-type',
    'step-08-scoping',
    'step-09-functional',
    'step-10-nonfunctional',
    'step-11-polish',
    'step-12-complete',
  ]
inputDocuments:
  - '_bmad-output/planning-artifacts/architecture.md'
  - 'HANDOFF.md'
  - 'AI-NATIVE.md'
  - 'docs/index.md'
  - 'docs/architecture.md'
  - 'docs/data-models.md'
  - 'docs/project-overview.md'
  - 'docs/development-guide.md'
  - 'docs/source-tree-analysis.md'
documentCounts:
  briefs: 0
  research: 0
  projectDocs: 6
  architecture: 1
  vision: 2
classification:
  projectType: 'developer_tool'
  domain: 'scientific'
  complexity: 'medium-high'
  projectContext: 'brownfield'
workflowType: 'prd'
---

# Product Requirements Document — SpacetimeDB World Agent SDK

**Author:** Jonathan
**Date:** 2026-02-24

> **Naming note:** The product needs its own brand name. "BitCraft" refers only to the v1 game world (Apache 2.0 fork, run unmodified). The SDK, TUI client, and platform brand must have an independent identity. Placeholders `[SDK]` and `[TUI]` are used until a name is chosen.

## Executive Summary

The SpacetimeDB World Agent SDK is a TypeScript platform with a Rust terminal frontend, enabling both AI agents and human players to inhabit persistent, economically-constrained game worlds built on SpacetimeDB. The core engine (`@sigil/client`) is a pure TypeScript library handling all game connectivity — SpacetimeDB subscriptions, Crosstown/ILP payments, and Nostr identity. It is consumed by an MCP server (for AI agents), a JSON-RPC IPC backend (for the Rust TUI), and can be imported directly by researchers. The Rust ratatui-based terminal game client is a presentation layer only — a full MMORPG experience playable from the command line, with all game logic and connectivity handled by the TypeScript backend. Agent behavior is defined through `Agent.md` configuration and skill files that map to a game's public reducers (actions) and table subscriptions (perception).

BitCraft, an open-source MMORPG with 364+ reducers, ~80 entity tables, 148 static data tables, a hex-grid world, and full economic/social/combat systems, serves as the v1 world environment. Its MMO complexity — resource scarcity, empire politics, territorial claims, trading, combat — provides decision-making challenges that mirror real-world multi-stakeholder environments. ILP micropayments gate every write action via Crosstown, forcing genuine cost-benefit analysis rather than brute-force exploration.

Target users: AI researchers studying multi-agent behavior in constrained environments, human players seeking a terminal-native MMORPG experience, and game developers building SpacetimeDB worlds accessible to both humans and AI.

### What Makes This Special

1. **One SDK, multiple interfaces.** `@sigil/client` (TypeScript) is the single engine for all game connectivity. AI agents connect via MCP server. Human players connect via a Rust ratatui TUI that talks to a TypeScript backend over JSON-RPC IPC. Same SDK, same SpacetimeDB worlds, multiple frontends optimized for their use cases.

2. **Declarative agent definitions.** Agent behavior configured through `Agent.md` and skill files, not application code. Skills map to public reducers (paid actions) and table subscriptions (free observations). Swapping agent strategies means editing markdown, not rewriting code.

3. **Real-world complexity proxy.** A full MMORPG with economies, social hierarchies, resource competition, and combat provides messy, consequential decision-making that toy environments cannot. Agents live in a world. Humans join that same world from a terminal.

4. **Economic constraints as game design.** ILP micropayments replace artificial rate-limiting with real budget constraints. Every action has a cost. Both AI agents and human players operate under the same economic rules.

5. **World-agnostic architecture.** The SDK targets SpacetimeDB's public surface (reducers + tables), not BitCraft specifically. Any SpacetimeDB game becomes accessible by defining skill files for its public API. BitCraft is v1; the platform extends to any world.

6. **Pluggable cognition runtime.** The five-layer cognition stack (static data, event interpretation, memory, affordance detection, goal planning) powers AI agents. Researchers swap individual layers to study different cognitive strategies. The TUI client replaces the goal planner with human input — same perception stack, different decision layer.

## Project Classification

- **Project Type:** Developer Tool / SDK (TypeScript engine + Rust TUI frontend, polyglot monorepo)
- **Domain:** Scientific / AI Research + Terminal Gaming
- **Complexity:** High (TypeScript SDK with Rust TUI frontend, polyglot monorepo, TUI game client, multi-system integration)
- **Project Context:** Brownfield — new SDK product built on two existing systems: BitCraft Server (Apache 2.0 fork, unmodified) and Crosstown Node (ILP payment gateway, consumed as dependency)
- **Reference Architecture:** rebels-in-the-sky (ratatui terminal game) for TUI/UI patterns only

## Success Criteria

### User Success

**AI Researcher:** Defines an agent entirely through `Agent.md` and skill files — zero TypeScript or Rust code. Deploys it against a BitCraft world. Watches it make autonomous economic decisions. Exports a structured decision log. Swaps the LLM backend and reruns the same experiment. Total time from "I have an idea" to "agent is playing": under 30 minutes.

**Terminal Player:** Launches the ratatui TUI client, connects to a game server, and plays the full game from a terminal — movement, combat, crafting, building, trading, chat, empire management. No graphical client needed. Responsive at 30+ FPS. Playable over SSH.

**Game Developer:** Publishes a new SpacetimeDB game. Writes skill definitions for its public reducers and table subscriptions. AI agents and TUI players can inhabit the new world without any SDK code changes.

### Business Success

**Revenue model:** ILP micropayment fees collected on every game action routed through Crosstown nodes. Every reducer call from every agent and TUI player generates fee revenue. The SDK is open source; the infrastructure is the moat.

**3-month target:** At least 10 concurrent AI agents running sustained experiments against BitCraft, generating measurable ILP traffic through Crosstown infrastructure.

**12-month target:** Multiple SpacetimeDB worlds supported. Community-contributed skill definitions and `Agent.md` templates. Fee revenue covers infrastructure costs with margin.

**Growth flywheel:** Open-source SDK drives adoption → more agents and players → more ILP traffic → more fee revenue → reinvest in SDK quality → more adoption.

### Technical Success

- `@sigil/client` connects to SpacetimeDB for reads and routes writes as ILP packets through Crosstown — no direct reducer calls. Both the MCP server and TUI backend consume this single client.
- `@sigil/client` subscribes to Crosstown's built-in Nostr relay for event confirmations (read path) and uses Crosstown's ILP connector for game actions (write path)
- Nostr public key is the sole identity mechanism — no usernames or passwords
- BLS propagates the authoring Nostr public key to SpacetimeDB on every reducer call
- SpacetimeDB game logic credits the correct player entity based on Nostr public key
- Identity ownership is cryptographically verifiable end-to-end (signed ILP packet → BLS verification → reducer attribution)
- Declarative skill files correctly map to 100% of BitCraft's public reducers and key table subscriptions
- TUI client renders the full BitCraft hex-grid world in real-time at 30+ FPS in a standard terminal
- Experiment harness supports snapshot/restore and comparative analysis across LLM backends
- All game actions route through Crosstown nodes with ILP fee collection

### Measurable Outcomes

| Metric                         | MVP Target                                   | Growth Target                |
| ------------------------------ | -------------------------------------------- | ---------------------------- |
| Agent setup time (no code)     | < 30 min                                     | < 5 min                      |
| Reducers accessible via skills | Top 20 (movement, combat, crafting, trading) | 100% of public reducers      |
| TUI game coverage              | Movement, map, chat, inventory               | Full BitCraft feature parity |
| Concurrent agents supported    | 2                                            | 50+                          |
| ILP fee collection             | Functional                                   | Profitable                   |
| SpacetimeDB worlds supported   | 1 (BitCraft)                                 | 3+                           |

## User Journeys

### Journey 1: Dr. Priya Sharma — AI Researcher, First Experiment

**Situation:** Priya is a computational social scientist studying emergent cooperation in resource-constrained environments. She's frustrated with existing multi-agent benchmarks — too simple (grid worlds) or too artificial (no real economic stakes).

**Opening Scene:** Priya finds the [SDK] on GitHub. She reads the README: "Define your agent in markdown. No code required." She's skeptical — her last "no-code" tool required 200 lines of YAML and a PhD in DevOps.

**Rising Action:** She clones the repo, runs `docker compose up` to start a local game server and Crosstown node, and generates a Nostr keypair. She opens the example `Agent.md`: names her agent "Gatherer-01," sets its personality to "cautious resource optimizer," and selects gathering and trading skills. Each skill file maps a game action to a reducer, lists its ILP cost, and describes what table subscriptions it needs to observe outcomes. She picks 8 skills.

She runs `npm start` with her Agent.md. The SDK connects to SpacetimeDB (table subscriptions), subscribes to Crosstown's relay (event confirmations), and begins sending ILP packets for game actions. Her terminal shows: "Gatherer-01 has entered the world. Observing nearby resources..." Within minutes, the agent is harvesting stone, checking prices, and deciding whether to trade or stockpile.

**Climax:** Priya launches a second agent ("Trader-02") with a different Agent.md — this one prioritizes social interaction and arbitrage. Both agents compete for resources, react to each other's price signals, and adapt strategies. The decision log (JSONL) captures every observation, deliberation, and action with costs. She exports the logs into her analysis notebook. Clean, structured, ready for her cooperation metrics.

**Resolution:** She swaps the GoalsSimple planner for GoalsLLM with Claude, reruns the experiment, and compares decision patterns. Her lab publishes a paper on "Emergent Resource Cooperation Under Real Economic Constraints." She never wrote a line of TypeScript.

**Requirements revealed:** Declarative skill parser, Agent.md configuration, decision logger (JSONL), SpacetimeDB read client, Crosstown read/write clients, Docker dev environment, multi-agent launcher, LLM backend swapping.

### Journey 2: Marcus Chen — Terminal Player, First Session

**Situation:** Marcus is a senior DevOps engineer who lives in the terminal. He misses the depth of MMOs but can't stand leaving his tmux setup.

**Opening Scene:** Marcus installs the [TUI] client via `cargo install [tui-crate]`. He generates a Nostr keypair and launches with his server and key. A ratatui interface fills his terminal — hex-grid map on the left, chat and status panels on the right, inventory below. Other players move on the map. A real MMO, in his terminal.

**Rising Action:** Keyboard shortcuts move his character across the hex grid. The map renders terrain, resources, and players in Unicode/color. He finds a forest, harvests wood (a fraction of a cent via ILP), opens the crafting panel, crafts a basic tool. Chat messages scroll by. He joins an empire, accepts a quest, heads to a contested hex.

Every action is responsive — event-driven architecture (multi-source event loop, tick scheduling at 30+ FPS) keeps the UI smooth. SpacetimeDB table subscriptions push world updates in real-time. He's playing over SSH from his server rack and it works perfectly.

**Climax:** Marcus encounters another player at a resource node. They negotiate in chat, agree to split the hex, set up a trade route. He's managing inventory, monitoring empire politics, crafting equipment, and chatting — all from keyboard shortcuts. Three hours in, he hasn't touched a GUI.

**Resolution:** Marcus plays nightly from his terminal. tmux layout: [TUI] in one pane, monitoring dashboards in another. The game fits his workflow. He tells his engineering friends. They SSH into a shared server and play together.

**Requirements revealed:** Rust ratatui TUI client (hex map, chat, inventory, crafting, status panels), TypeScript TUI backend (`@sigil/tui-backend` wrapping `@sigil/client`), keyboard-driven input, real-time SpacetimeDB subscriptions via TypeScript backend, Nostr keypair identity, ILP wallet integration, 30+ FPS rendering, SSH-compatible, event-driven architecture, JSON-RPC IPC between Rust frontend and TypeScript backend.

### Journey 3: Anika Patel — Game Developer, New SpacetimeDB World

**Situation:** Anika published "StarForge," a SpacetimeDB space trading game with 40 reducers. She wants AI agents and terminal players in her world without building an agent framework or TUI from scratch.

**Opening Scene:** Anika discovers the [SDK] — world-agnostic, targets SpacetimeDB's public surface. To make StarForge accessible, she writes skill definition files for her reducers and maps table subscriptions for world observation.

**Rising Action:** She creates `starforge/skills/` and writes skill files: `mine_asteroid.md`, `create_trade.md`, `build_station.md`. Each specifies reducer name, parameters, ILP cost, required table subscriptions, and natural-language description. She writes a starter `Agent.md` template for a "cautious miner" persona. She registers her game's Crosstown BLS handler and publishes the skill definitions.

**Climax:** A researcher finds StarForge's skill definitions. Without any SDK code changes, they point their agent at Anika's server, load StarForge skills, and launch. The agent mines asteroids and trades commodities. A terminal player loads StarForge's UI configuration and plays from their terminal. Zero SDK code written by Anika.

**Resolution:** StarForge gains AI researchers using it as a testbed. ILP fees flow through her Crosstown node, funding continued development.

**Requirements revealed:** World-agnostic skill file format, skill authoring guide, Crosstown BLS handler registration, community skill marketplace (growth), game-specific TUI configuration.

### Journey 4: Jonathan — Infrastructure Operator, Running the Platform

**Situation:** Jonathan runs the game server deployment and Crosstown node infrastructure. Every game action routes through his nodes as ILP packets.

**Opening Scene:** Jonathan deploys: game server in Docker, Crosstown node configured with ILP fee schedules. The BLS handler validates ILP packets, extracts Nostr public keys, propagates identity to SpacetimeDB reducers, and collects fees.

**Rising Action:** Agents come online. Research labs run 10 concurrent agents. Players join nightly. Each action — harvest, trade, movement, chat — is an ILP packet. He monitors packets per second, fee revenue, BLS validation latency, identity propagation success rate. He adjusts fee schedules by action type.

**Climax:** A research team launches a 50-agent experiment. Traffic spikes. Crosstown nodes handle the load — SpacetimeDB handles game state and Crosstown handles payment routing independently. Fee revenue from one experiment covers monthly infrastructure costs.

**Resolution:** The SDK is open source. The infrastructure — Crosstown nodes, fee collection, identity propagation — is the moat. More worlds come online, more ILP traffic, revenue grows with adoption.

**Requirements revealed:** Docker deployment, Crosstown node configuration, ILP fee schedule management, BLS identity propagation handler, monitoring/observability, scalability, fee revenue tracking.

### Journey Requirements Summary

| Capability Area                               | Journeys        |
| --------------------------------------------- | --------------- |
| Declarative skill files + Agent.md parser     | Priya, Anika    |
| SpacetimeDB read client (table subscriptions) | All             |
| Crosstown relay subscriptions (read path)     | All             |
| Crosstown/ILP write client                    | All             |
| Nostr keypair identity (no passwords)         | All             |
| BLS identity propagation to SpacetimeDB       | All             |
| Decision logger (JSONL)                       | Priya           |
| Multi-agent launcher                          | Priya           |
| LLM backend swapping                          | Priya           |
| ratatui TUI client (hex map, panels, input)   | Marcus          |
| 30+ FPS event-driven rendering                | Marcus          |
| SSH-compatible terminal play                  | Marcus          |
| World-agnostic skill file format              | Anika           |
| Crosstown BLS handler registration            | Anika, Jonathan |
| Docker deployment (game server)               | Jonathan, Priya |
| ILP fee schedule configuration                | Jonathan        |
| Monitoring/observability                      | Jonathan        |
| Scalability under multi-agent load            | Jonathan        |

## Domain-Specific Requirements

### Scientific Research Domain

- **Reproducibility:** Experiment harness supports snapshot/restore of world state, deterministic agent configurations (same Agent.md + same world state = comparable runs), versioned skill definitions. Decision logs capture enough context to reproduce any individual decision.
- **Validation methodology:** Structured JSONL decision logs with timestamps, world state snapshots, costs incurred, and outcomes observed. Comparative analysis tooling for A/B experiments across LLM backends, agent configurations, or skill sets.
- **Accuracy:** Agent perception (table subscriptions) faithfully represents actual world state — no stale reads, no missed events. Event ordering guarantees matter for research validity.
- **Computational resources:** LLM API costs (per-token), ILP transaction costs (per-action), and concurrent agent scaling all compound. Cost tracking and budget controls are research necessities.

### Cryptographic Identity & Payment Domain

- **Key management:** Nostr keypair generation, secure storage, and recovery paths. No username/password fallback — key loss means identity loss.
- **Payment security:** ILP packets signed by the authoring Nostr key. BLS validates signature before executing any reducer call. Fee schedules transparent and verifiable.
- **Identity propagation:** BLS cryptographically proves the authoring Nostr public key to SpacetimeDB on every reducer call. SpacetimeDB attributes actions to the correct player entity based on Nostr public key, not BLS sender identity. Novel integration — no off-the-shelf solution exists.
- **Wallet management:** Users fund ILP wallets, track balances, and see cost-per-action before execution. Both AI agents and TUI players need balance awareness.

### Real-Time Systems Domain

- **SpacetimeDB subscriptions:** Table subscription latency directly affects agent perception quality and TUI responsiveness. Reconnection and state recovery after disconnects handled gracefully.
- **TUI rendering:** 30+ FPS in a standard terminal with hex-grid map, multiple panels, and real-time updates. Event-driven architecture (not polling). Must work over SSH with variable latency.
- **Event ordering:** Concurrent reducer calls deliver consistent table updates. SpacetimeDB provides this at the database level; the SDK must not introduce ordering bugs.

### Licensing & Naming

- **BitCraft Server:** Apache 2.0 licensed fork, run unmodified. Our product — SDK, TUI client, platform brand — must have its own independent name.
- **SDK licensing:** Open-source (license TBD — MIT, Apache 2.0, or AGPL for infrastructure moat). License choice affects community adoption vs. competitive protection.
- **Third-party dependencies:** SpacetimeDB SDK, Nostr client libraries, ILP/Crosstown libraries, ratatui — all must have compatible licenses.

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Declarative Agent Definitions (New Paradigm)**
Agent behavior defined entirely in markdown (`Agent.md` + skill files), not application code. Skills map to game reducers and table subscriptions. No existing agent framework uses this approach — most require Python/TypeScript code. A DSL-level innovation where the "language" is structured markdown.

**2. Single SDK, Multiple Frontends (Novel Architecture)**
A single TypeScript SDK (`@sigil/client`) powers both AI agents (via MCP server) and human terminal players (via Rust ratatui TUI with TypeScript backend). No existing platform provides both an AI agent runtime and a human game client on the same SDK. The TUI client replaces the agent's decision layer with human input — same underlying connectivity, different interaction paradigm.

**3. ILP Micropayments as Game Economics (Novel Integration)**
Every game action is an ILP payment. Economic constraints are real, not simulated. No existing agent benchmark or game environment gates actions through real micropayments. Natural moat: the SDK is open source, the payment infrastructure generates revenue.

**4. Cryptographic Identity Propagation (Novel Integration)**
Nostr public keys as sole identity, with BLS propagating authorship through the ILP → Crosstown → SpacetimeDB chain. No usernames, no passwords. The integration pattern (signed ILP packet → BLS extraction → reducer attribution) doesn't exist in any current system.

**5. World-Agnostic Agent Platform (New Paradigm)**
The SDK targets SpacetimeDB's public surface (reducers + tables), not any specific game. Any SpacetimeDB world becomes agent-accessible by writing skill files for its API. No existing agent framework is designed to be world-agnostic at this level.

### Market Context & Competitive Landscape

- **AI agent frameworks** (LangChain, AutoGPT, CrewAI): Code-first, no game integration, no economic constraints. None offer declarative markdown-based agent definitions.
- **Game AI benchmarks** (OpenAI Gym, PettingZoo, MineRL): Toy environments or single-game integrations. No real economies, persistent worlds, or micropayment constraints.
- **Terminal games** (Dwarf Fortress, NetHack, Cataclysm): Single-player, no real-time multiplayer, no AI agent integration, no economic layer.
- **SpacetimeDB ecosystem**: No existing agent SDK or TUI client framework for SpacetimeDB worlds.

No direct competitor combines declarative agents + real economic constraints + persistent MMO worlds + terminal play + world-agnostic architecture.

### Innovation Validation

| Innovation                         | Validation Method                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Declarative agent definitions      | Can a non-programmer create and deploy a functioning agent in < 30 min using only markdown?       |
| Single SDK, multiple frontends     | Do MCP agents and TUI players have equivalent access to game actions through `@sigil/client`?     |
| ILP micropayments as constraints   | Do agents make meaningfully different decisions when actions have real costs vs. free?            |
| Cryptographic identity propagation | Does BLS correctly attribute actions to the authoring Nostr key across 100% of reducer calls?     |
| World-agnostic architecture        | Can a new SpacetimeDB game become agent-accessible by writing only skill files, zero SDK changes? |

## Developer Tool Specific Requirements

### Language Matrix

| Runtime        | Language           | Primary Users      | Package Manager | Key Dependencies                               |
| -------------- | ------------------ | ------------------ | --------------- | ---------------------------------------------- |
| SDK + Backends | TypeScript/Node.js | All (via wrappers) | pnpm            | SpacetimeDB TS client, nostr-tools, ILP client |
| TUI Frontend   | Rust               | Terminal players   | cargo           | ratatui, crossterm, tokio, serde_json          |
| Infrastructure | Docker             | Platform operators | docker compose  | Game server (WASM), Crosstown node             |

### Installation Methods

- **SDK (`@sigil/client`):** `pnpm install @sigil/client` — pure TypeScript library, zero native dependencies
- **TUI Client:** `cargo install sigil-tui` — Rust binary for terminal frontend (requires `@sigil/tui-backend` TypeScript process)
- **Local development environment:** `docker compose up` — starts game server + Crosstown node
- **Agent deployment:** Clone repo, edit `Agent.md` + select skill files, `npm start` or `cargo run`

### API Surface

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

### Code Examples

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

### Documentation Requirements

- **Getting Started guides** — one per persona (researcher, player, game dev)
- **Skill file authoring guide** — format specification, best practices, examples for all action categories
- **Agent.md specification** — complete schema reference with defaults and validation
- **Architecture overview** — three-client data flow, identity propagation, cognition stack
- **API reference** — auto-generated from TypeScript source (TypeDoc)
- **Reducer catalog** — all accessible game actions with parameters, costs, and related subscriptions

### Implementation Considerations

- **Skill file format:** Parsed by `@sigil/client` (TypeScript) and exposed uniformly to all consumers (MCP server, TUI backend). The Rust TUI does not parse skill files — it receives action information from the TypeScript backend.
- **Version compatibility:** SDK versions declare which SpacetimeDB protocol version and Crosstown API version they support. Skill files include a format version.
- **Error messages:** Actionable developer-facing errors: "Skill file `harvest_resource.md` references reducer `harvest_resource` but SpacetimeDB module does not expose this reducer" — not "connection error."
- **Offline development:** Docker compose environment enables fully offline development and testing. No external service dependencies for local dev.

## Product Scope & Phased Development

### MVP Strategy

**Approach:** Platform MVP — prove the end-to-end data flow (SpacetimeDB reads → Crosstown relay reads → ILP writes → BLS identity propagation → reducer execution) works reliably across both runtimes. Validate two core hypotheses: (1) non-programmers can create functioning agents from markdown alone, and (2) the TUI client delivers a genuinely playable terminal MMORPG experience.

**Resource Requirements:** Solo developer (Jonathan) with AI-assisted development. TypeScript and Rust competency required. Infrastructure: single Docker host for local dev, one Crosstown node for production.

### Phase 1 — MVP

**User Journey Coverage:**

- Priya (AI Researcher): Partial — single agent with basic skills, decision logs. No multi-agent launcher or LLM swapping.
- Marcus (Terminal Player): Partial — movement, map, chat, inventory. No combat, crafting, building, empire management.
- Jonathan (Infrastructure): Full — deploy locally, route ILP packets, collect fees, verify identity propagation.
- Anika (Game Developer): Deferred to Phase 2.

**`@sigil/client` (TypeScript SDK — the engine):**

- SpacetimeDB client wrapper (read path — table subscriptions via WebSocket)
- Crosstown client (read path — relay event subscriptions; write path — ILP packets for game actions)
- Action cost registry (JSON config)
- Decision logger (JSONL output)
- Declarative skill file parser (`Agent.md` + skill definitions)

**`@sigil/mcp-server` (MCP wrapper for AI agents):**

- Exposes game world as MCP resources and game actions as MCP tools
- AI agents (Claude, Vercel AI, OpenCode) connect via standard MCP protocol

**`@sigil/tui-backend` (JSON-RPC IPC wrapper for Rust TUI):**

- Bridges `@sigil/client` to the Rust TUI over stdio
- Pushes real-time game state updates to the TUI, processes user action requests

**Rust TUI (presentation layer only):**

- ratatui TUI client: map view (hex grid), player status, movement, chat, inventory
- Event-driven architecture (rebels-in-the-sky patterns: multi-source event loop, callback-based UI, tick scheduling)
- No direct SpacetimeDB or Crosstown connections — all data flows through `@sigil/tui-backend`

**Infrastructure:**

- Docker compose for game server + Crosstown node (local dev)
- Crosstown BLS game action handler (receive ILP packet → extract Nostr public key + game action → call SpacetimeDB reducer with identity propagation)
- ILP fee collection on all routed game actions

**Identity:**

- Nostr keypair as sole identity (no username/password)
- BLS verifies ILP packet signature → extracts author Nostr public key → propagates to SpacetimeDB
- SpacetimeDB credits correct player entity based on Nostr public key

**Top 20 skill files:** Movement, gathering, trading, chat — enough to prove agents can play meaningfully.

### Phase 2 — Growth (Depth & Research Tooling)

- Layer 5: GoalsLLM (multi-provider LLM decision-making)
- Layer 3: MemorySystem (persistent knowledge, vector DB integration)
- Layer 4: AffordanceEngine (detect available actions with cost/reward estimates)
- Multi-agent launcher (run N agents from YAML config)
- Experiment harness (snapshot/restore, comparative analysis CLI)
- LLM backend swapping for A/B experiments
- Budget controls and cost estimation in Agent.md
- TUI feature parity: combat, crafting, building, trading, empire management, quests
- Expanded skill coverage: 100+ reducers mapped
- World-agnostic generalization (validated with second SpacetimeDB world)
- Crosstown BLS handler registration for third-party games

### Phase 3 — Expansion (Platform & Community)

- Auto-generation of skill files from SpacetimeDB module schema
- Community skill definition marketplace
- SSH server support for remote TUI play
- Agent-to-agent social networks and emergent economies
- Research paper pipeline: structured experiment → analysis → publication-ready figures
- Multiple Crosstown node operators (decentralized infrastructure)
- Terminal-native game platform: "Steam for TUI games, powered by AI"

### Critical Path (build order)

1. BLS identity propagation proof-of-concept (highest-risk, blocks everything)
2. Crosstown/ILP write client (proves the business model)
3. SpacetimeDB + Crosstown read clients (perception layer)
4. Declarative skill parser + Agent.md (core innovation)
5. TypeScript GoalsSimple + decision logger (first working agent)
6. Rust TUI client (hex map + movement + chat)
7. Docker compose dev environment (makes it usable by others)

### Risk Mitigation Strategy

**Technical Risks:**

| Risk                                                        | Likelihood | Impact   | Mitigation                                                                                                                  |
| ----------------------------------------------------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| BLS identity propagation infeasible with SpacetimeDB        | Medium     | Critical | Spike first. If `ctx.sender` cannot be overridden, explore dedicated identity table or signed payloads verified in-reducer. |
| SpacetimeDB subscription performance under multi-agent load | Low        | High     | Designed for real-time subscriptions. Test with 10+ concurrent connections early.                                           |
| Skill file format too rigid for complex game actions        | Medium     | Medium   | Start simple, iterate. Support optional code hooks as escape hatch.                                                         |
| Markdown DSL insufficient for complex agent behavior        | Medium     | Medium   | Hybrid mode: Agent.md for configuration + optional code hooks for custom logic.                                             |
| ratatui hex-grid rendering too slow at scale                | Low        | Medium   | rebels-in-the-sky proves ratatui handles complex real-time UIs. Hex rendering is computationally simpler.                   |
| ILP latency too high for real-time gameplay                 | Low        | Medium   | Local action queue with optimistic execution, settle ILP asynchronously.                                                    |
| World-agnostic abstraction too leaky                        | Medium     | Medium   | Ship game-specific first, generalize iteratively based on second world.                                                     |
| Dual-runtime maintenance burden                             | High       | Medium   | Prioritize one runtime per release cycle, keep shared skill format stable.                                                  |

**Market Risks:**

| Risk                                              | Likelihood | Impact | Mitigation                                                                      |
| ------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------- |
| No researchers interested in MMO agent benchmarks | Medium     | High   | Publish demo video + decision logs. "Real economic constraints" angle is novel. |
| Terminal players too niche                        | Low        | Low    | Small but passionate community. Even modest adoption generates ILP traffic.     |
| SpacetimeDB changes break SDK                     | Medium     | Medium | Pin version, test against stable releases, maintain compatibility matrix.       |

**Resource Risks:**

| Risk                                    | Likelihood | Impact | Mitigation                                                                                    |
| --------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------- |
| Solo developer bottleneck               | High       | High   | AI-assisted development. Prioritize ruthlessly per critical path.                             |
| Scope creep across polyglot monorepo    | High       | Medium | Ship `@sigil/client` and MCP server before TUI. TypeScript backend is the priority.           |
| Infrastructure costs exceed fee revenue | Medium     | Medium | Local Docker dev is free. Single Crosstown node for production. 10 agents covers a small VPS. |

**Domain Risks:**

| Risk                                        | Impact   | Mitigation                                                               |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| Nostr key loss = permanent identity loss    | High     | Seed phrase backup, key export/import, clear onboarding guidance         |
| Stale world state in agent perception       | Medium   | Subscription health monitoring, reconnection with state replay           |
| ILP cost overruns during experiments        | Medium   | Budget caps in Agent.md, cost estimation before action, balance alerts   |
| BLS identity propagation failure            | Critical | Cryptographic verification at every layer, reject unattributable actions |
| BitCraft name used in marketing/code        | Legal    | Establish own brand name early, audit all user-facing strings            |
| License incompatibility in dependency chain | Medium   | License audit of all dependencies before v1                              |

## Functional Requirements

### Identity & Key Management

- **FR1:** Users can generate a new Nostr keypair for use as their sole identity across all SDK interactions
- **FR2:** Users can import an existing Nostr keypair from a file or seed phrase
- **FR3:** Users can export their Nostr keypair for backup and recovery
- **FR4:** The system attributes every game action to the authoring Nostr public key via BLS identity propagation to SpacetimeDB
- **FR5:** Users can verify their identity ownership is cryptographically intact end-to-end (signed ILP packet → BLS verification → reducer attribution)

### World Perception

- **FR6:** All consumers of `@sigil/client` (MCP server, TUI backend) can subscribe to SpacetimeDB table updates in real-time via WebSocket
- **FR7:** All consumers of `@sigil/client` can subscribe to Crosstown relay events (via its built-in Nostr relay) for action confirmations and system notifications
- **FR8:** Agents can load static data tables (`*_desc` tables) and build queryable lookup maps (Layer 1: StaticDataLoader)
- **FR9:** Agents can receive raw table update events and interpret them as semantic narratives (Layer 2: EventInterpreter)
- **FR10:** The system automatically reconnects and recovers subscription state after disconnections

### Agent Configuration & Skills

- **FR11:** Researchers can define agent behavior entirely through an `Agent.md` configuration file with zero application code
- **FR12:** Researchers can select which skills an agent uses by referencing skill files in Agent.md
- **FR13:** Skill files can declare the target reducer, parameters, ILP cost, required table subscriptions, and natural-language usage guidance
- **FR14:** The system validates Agent.md and skill files against the connected SpacetimeDB module's available reducers and tables
- **FR15:** Researchers can set budget limits per agent in Agent.md to cap ILP spending
- **FR16:** Researchers can configure which LLM backend an agent uses in Agent.md (Phase 2)

### Action Execution & Payments

- **FR17:** All consumers of `@sigil/client` can execute game actions by sending signed ILP packets through the Crosstown connector (via `client.publish()`)
- **FR18:** The system constructs ILP packets containing the game action, signs them with the user's Nostr key, and routes them through the Crosstown node
- **FR19:** The BLS handler receives ILP packets, validates signatures, extracts the Nostr public key and game action, and calls the corresponding SpacetimeDB reducer with identity propagation
- **FR20:** The system collects ILP fees on every routed game action
- **FR21:** Users can query their current ILP wallet balance
- **FR22:** Users can view the cost of any action before executing it via the action cost registry

### Agent Cognition

- **FR23:** Agents can make autonomous decisions using a rule-based priority queue planner (Layer 5: GoalsSimple)
- **FR24:** Agents can make autonomous decisions using LLM-powered reasoning with configurable providers (Layer 5: GoalsLLM — Phase 2)
- **FR25:** Agents can maintain persistent memory across sessions (Layer 3: MemorySystem — Phase 2)
- **FR26:** Agents can detect available actions and estimate cost/reward for each (Layer 4: AffordanceEngine — Phase 2)
- **FR27:** Researchers can swap individual cognition layers independently without affecting other layers

### Terminal Game Client (TUI)

- **FR28:** Players can view the game world as a rendered hex-grid map with terrain, resources, and other players in their terminal
- **FR29:** Players can move their character across the hex grid using keyboard controls
- **FR30:** Players can send and receive chat messages with other players
- **FR31:** Players can view and manage their inventory
- **FR32:** Players can view their character status (health, position, skills, empire membership)
- **FR33:** Players can engage in combat with game entities and other players (Phase 2)
- **FR34:** Players can craft items using recipes and gathered resources (Phase 2)
- **FR35:** Players can construct and manage buildings on claimed territory (Phase 2)
- **FR36:** Players can create and respond to trade offers with other players (Phase 2)
- **FR37:** Players can participate in empire management (join, create, govern, diplomacy) (Phase 2)
- **FR38:** The TUI renders at 30+ FPS and works over SSH connections

### Experiment & Analysis

- **FR39:** Agents produce structured decision logs (JSONL) capturing observations, deliberations, actions, costs, and outcomes with timestamps
- **FR40:** Researchers can run multiple agents concurrently against the same world (Phase 2)
- **FR41:** Researchers can configure and launch experiments from YAML configuration files (Phase 2)
- **FR42:** Researchers can snapshot and restore world state for reproducible experiments (Phase 2)
- **FR43:** Researchers can compare decision logs across experiment runs with different agent configurations or LLM backends (Phase 2)

### Infrastructure & Deployment

- **FR44:** Operators can deploy a local development environment (game server + Crosstown node) via Docker compose
- **FR45:** Operators can configure ILP fee schedules for different action types
- **FR46:** Operators can monitor system health: ILP packets per second, fee revenue, BLS validation latency, SpacetimeDB load, identity propagation success rate
- **FR47:** The BLS game action handler maps incoming ILP packets to the correct SpacetimeDB reducers with identity propagation

### World Extensibility

- **FR48:** Game developers can make a new SpacetimeDB world agent-accessible by writing skill files for its public reducers and table subscriptions — no SDK code changes required (Phase 2)
- **FR49:** Game developers can register a Crosstown BLS handler for their SpacetimeDB module's reducers (Phase 2)
- **FR50:** The system can auto-generate skeleton skill files from a SpacetimeDB module's published schema (Phase 3)

## Non-Functional Requirements

### Performance

- **NFR1:** TUI client renders at 30+ FPS in a standard 80x24 terminal with hex map, status panels, and chat visible simultaneously
- **NFR2:** TUI client remains responsive (< 50ms input-to-render latency) over SSH connections with up to 200ms network latency
- **NFR3:** ILP packet round-trip (SDK sends → Crosstown routes → BLS executes reducer → confirmation received) completes within 2 seconds under normal load
- **NFR4:** Agent decision cycle (observe → interpret → decide → act) completes within 5 seconds for GoalsSimple, within 30 seconds for GoalsLLM
- **NFR5:** SpacetimeDB table subscription updates reflected in agent state and TUI display within 500ms of database commit
- **NFR6:** Static data loading (all `*_desc` tables) completes within 10 seconds on first connection
- **NFR7:** Skill file parsing and Agent.md validation completes within 1 second for up to 50 skills

### Security

- **NFR8:** All ILP packets signed with the user's Nostr private key; unsigned or incorrectly signed packets rejected by BLS before reducer execution
- **NFR9:** Nostr private keys never transmitted over the network; only public keys and signatures leave the local system
- **NFR10:** BLS validates identity on every reducer call — no reducer executes without verified Nostr public key attribution
- **NFR11:** Nostr private keys stored encrypted at rest on the local filesystem with user-provided passphrase protection
- **NFR12:** ILP fee schedules publicly verifiable; users can audit the fee for any action before executing it
- **NFR13:** No game action attributed to a Nostr public key without a valid cryptographic signature from the corresponding private key

### Scalability

- **NFR14:** A single Crosstown node supports at least 10 concurrent agents and 5 concurrent TUI players at MVP, scaling to 50+ agents at Phase 2
- **NFR15:** SpacetimeDB subscriptions remain performant with up to 50 concurrent connected clients on a single game server instance
- **NFR16:** Decision log file size remains manageable: JSONL rotation or archival when logs exceed 100MB per agent
- **NFR17:** ILP fee collection maintains accurate accounting under concurrent multi-agent load with no lost or double-counted transactions

### Integration

- **NFR18:** `@sigil/client` uses SpacetimeDB 2.0 TypeScript client SDK (backwards-compatible with 1.6.x server modules). The Rust TUI has no direct SpacetimeDB dependency — it connects via the TypeScript backend.
- **NFR19:** `@sigil/client` connects to any standard Nostr relay implementing NIP-01; Crosstown's built-in relay is the default
- **NFR20:** LLM integration (Phase 2) supports any provider exposing an OpenAI-compatible chat completions API
- **NFR21:** Skill file format is consumed by `@sigil/client` and exposed to all frontends (MCP server, TUI backend) uniformly
- **NFR22:** Docker compose dev environment runs on Linux and macOS with no platform-specific configuration

### Reliability

- **NFR23:** SpacetimeDB subscription automatically reconnects within 10 seconds after connection loss, with full state recovery
- **NFR24:** Failed ILP packets (network timeout, insufficient balance) return clear error codes and do not leave the system in an inconsistent state
- **NFR25:** Agent state persists across SDK restarts: decision logs are append-only, agent configuration is stateless (re-read from Agent.md on startup)
- **NFR26:** TUI client handles SpacetimeDB disconnection gracefully: displays connection status, buffers user input, resumes on reconnection
- **NFR27:** BLS identity propagation has zero silent failures: every reducer call either succeeds with verified identity or fails with an explicit error
