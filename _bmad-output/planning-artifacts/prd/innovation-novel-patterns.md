# Innovation & Novel Patterns

## Detected Innovation Areas

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

## Market Context & Competitive Landscape

- **AI agent frameworks** (LangChain, AutoGPT, CrewAI): Code-first, no game integration, no economic constraints. None offer declarative markdown-based agent definitions.
- **Game AI benchmarks** (OpenAI Gym, PettingZoo, MineRL): Toy environments or single-game integrations. No real economies, persistent worlds, or micropayment constraints.
- **Terminal games** (Dwarf Fortress, NetHack, Cataclysm): Single-player, no real-time multiplayer, no AI agent integration, no economic layer.
- **SpacetimeDB ecosystem**: No existing agent SDK or TUI client framework for SpacetimeDB worlds.

No direct competitor combines declarative agents + real economic constraints + persistent MMO worlds + terminal play + world-agnostic architecture.

## Innovation Validation

| Innovation                         | Validation Method                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Declarative agent definitions      | Can a non-programmer create and deploy a functioning agent in < 30 min using only markdown?       |
| Single SDK, multiple frontends     | Do MCP agents and TUI players have equivalent access to game actions through `@sigil/client`?     |
| ILP micropayments as constraints   | Do agents make meaningfully different decisions when actions have real costs vs. free?            |
| Cryptographic identity propagation | Does BLS correctly attribute actions to the authoring Nostr key across 100% of reducer calls?     |
| World-agnostic architecture        | Can a new SpacetimeDB game become agent-accessible by writing only skill files, zero SDK changes? |
