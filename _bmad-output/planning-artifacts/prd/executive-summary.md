# Executive Summary

The SpacetimeDB World Agent SDK is a TypeScript platform with a Rust terminal frontend, enabling both AI agents and human players to inhabit persistent, economically-constrained game worlds built on SpacetimeDB. The core engine (`@sigil/client`) is a pure TypeScript library handling all game connectivity — SpacetimeDB subscriptions, Crosstown/ILP payments, and Nostr identity. It is consumed by an MCP server (for AI agents), a JSON-RPC IPC backend (for the Rust TUI), and can be imported directly by researchers. The Rust ratatui-based terminal game client is a presentation layer only — a full MMORPG experience playable from the command line, with all game logic and connectivity handled by the TypeScript backend. Agent behavior is defined through `Agent.md` configuration and skill files that map to a game's public reducers (actions) and table subscriptions (perception).

BitCraft, an open-source MMORPG with 364+ reducers, ~80 entity tables, 148 static data tables, a hex-grid world, and full economic/social/combat systems, serves as the v1 world environment. Its MMO complexity — resource scarcity, empire politics, territorial claims, trading, combat — provides decision-making challenges that mirror real-world multi-stakeholder environments. ILP micropayments gate every write action via Crosstown, forcing genuine cost-benefit analysis rather than brute-force exploration.

Target users: AI researchers studying multi-agent behavior in constrained environments, human players seeking a terminal-native MMORPG experience, and game developers building SpacetimeDB worlds accessible to both humans and AI.

## What Makes This Special

1. **One SDK, multiple interfaces.** `@sigil/client` (TypeScript) is the single engine for all game connectivity. AI agents connect via MCP server. Human players connect via a Rust ratatui TUI that talks to a TypeScript backend over JSON-RPC IPC. Same SDK, same SpacetimeDB worlds, multiple frontends optimized for their use cases.

2. **Declarative agent definitions.** Agent behavior configured through `Agent.md` and skill files, not application code. Skills map to public reducers (paid actions) and table subscriptions (free observations). Swapping agent strategies means editing markdown, not rewriting code.

3. **Real-world complexity proxy.** A full MMORPG with economies, social hierarchies, resource competition, and combat provides messy, consequential decision-making that toy environments cannot. Agents live in a world. Humans join that same world from a terminal.

4. **Economic constraints as game design.** ILP micropayments replace artificial rate-limiting with real budget constraints. Every action has a cost. Both AI agents and human players operate under the same economic rules.

5. **World-agnostic architecture.** The SDK targets SpacetimeDB's public surface (reducers + tables), not BitCraft specifically. Any SpacetimeDB game becomes accessible by defining skill files for its public API. BitCraft is v1; the platform extends to any world.

6. **Pluggable cognition runtime.** The five-layer cognition stack (static data, event interpretation, memory, affordance detection, goal planning) powers AI agents. Researchers swap individual layers to study different cognitive strategies. The TUI client replaces the goal planner with human input — same perception stack, different decision layer.
