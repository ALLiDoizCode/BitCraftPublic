# Product Scope & Phased Development

## MVP Strategy

**Approach:** Platform MVP — prove the end-to-end data flow (SpacetimeDB reads → Crosstown relay reads → ILP writes → BLS identity propagation → reducer execution) works reliably across both runtimes. Validate two core hypotheses: (1) non-programmers can create functioning agents from markdown alone, and (2) the TUI client delivers a genuinely playable terminal MMORPG experience.

**Resource Requirements:** Solo developer (Jonathan) with AI-assisted development. TypeScript and Rust competency required. Infrastructure: single Docker host for local dev, one Crosstown node for production.

## Phase 1 — MVP

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

## Phase 2 — Growth (Depth & Research Tooling)

- LLM-powered agent reasoning (multi-provider decision-making)
- Persistent memory system (knowledge persistence across sessions)
- AffordanceEngine (detect available actions with cost/reward estimates)
- Multi-agent launcher (run N agents from YAML config)
- Experiment harness (snapshot/restore, comparative analysis CLI)
- LLM backend swapping for A/B experiments
- Budget controls and cost estimation in Agent.md
- TUI feature parity: combat, crafting, building, trading, empire management, quests
- Expanded skill coverage: 100+ reducers mapped
- World-agnostic generalization (validated with second SpacetimeDB world)
- Crosstown BLS handler registration for third-party games

## Phase 3 — Expansion (Platform & Community)

- Auto-generation of skill files from SpacetimeDB module schema
- Community skill definition marketplace
- SSH server support for remote TUI play
- Agent-to-agent social networks and emergent economies
- Research paper pipeline: structured experiment → analysis → publication-ready figures
- Multiple Crosstown node operators (decentralized infrastructure)
- Terminal-native game platform: "Steam for TUI games, powered by AI"

## Critical Path (build order)

1. BLS identity propagation proof-of-concept (highest-risk, blocks everything)
2. Crosstown/ILP write client (proves the business model)
3. SpacetimeDB + Crosstown read clients (perception layer)
4. Declarative skill parser + Agent.md (core innovation)
5. TypeScript GoalsSimple + decision logger (first working agent)
6. Rust TUI client (hex map + movement + chat)
7. Docker compose dev environment (makes it usable by others)

## Risk Mitigation Strategy

**Technical Risks:**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| BLS identity propagation infeasible with SpacetimeDB | Medium | Critical | Spike first. If `ctx.sender` cannot be overridden, explore dedicated identity table or signed payloads verified in-reducer. |
| SpacetimeDB subscription performance under multi-agent load | Low | High | Designed for real-time subscriptions. Test with 10+ concurrent connections early. |
| Skill file format too rigid for complex game actions | Medium | Medium | Start simple, iterate. Support optional code hooks as escape hatch. |
| Markdown DSL insufficient for complex agent behavior | Medium | Medium | Hybrid mode: Agent.md for configuration + optional code hooks for custom logic. |
| ratatui hex-grid rendering too slow at scale | Low | Medium | rebels-in-the-sky proves ratatui handles complex real-time UIs. Hex rendering is computationally simpler. |
| ILP latency too high for real-time gameplay | Low | Medium | Local action queue with optimistic execution, settle ILP asynchronously. |
| World-agnostic abstraction too leaky | Medium | Medium | Ship game-specific first, generalize iteratively based on second world. |
| Dual-runtime maintenance burden | High | Medium | Prioritize one runtime per release cycle, keep shared skill format stable. |

**Market Risks:**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| No researchers interested in MMO agent benchmarks | Medium | High | Publish demo video + decision logs. "Real economic constraints" angle is novel. |
| Terminal players too niche | Low | Low | Small but passionate community. Even modest adoption generates ILP traffic. |
| SpacetimeDB changes break SDK | Medium | Medium | Pin version, test against stable releases, maintain compatibility matrix. |

**Resource Risks:**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Solo developer bottleneck | High | High | AI-assisted development. Prioritize ruthlessly per critical path. |
| Scope creep across polyglot monorepo | High | Medium | Ship `@sigil/client` and MCP server before TUI. TypeScript backend is the priority. |
| Infrastructure costs exceed fee revenue | Medium | Medium | Local Docker dev is free. Single Crosstown node for production. 10 agents covers a small VPS. |

**Domain Risks:**

| Risk | Impact | Mitigation |
|------|--------|------------|
| Nostr key loss = permanent identity loss | High | Seed phrase backup, key export/import, clear onboarding guidance |
| Stale world state in agent perception | Medium | Subscription health monitoring, reconnection with state replay |
| ILP cost overruns during experiments | Medium | Budget caps in Agent.md, cost estimation before action, balance alerts |
| BLS identity propagation failure | Critical | Cryptographic verification at every layer, reject unattributable actions |
| BitCraft name used in marketing/code | Legal | Establish own brand name early, audit all user-facing strings |
| License incompatibility in dependency chain | Medium | License audit of all dependencies before v1 |
