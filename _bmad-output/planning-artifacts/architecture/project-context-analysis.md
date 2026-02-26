# Project Context Analysis

## Requirements Overview

**Functional Requirements:**
50 FRs across 9 domains. The architecture must support two distinct user experiences (AI researcher via TypeScript, terminal player via Rust TUI) sharing a common perception and action layer. 27 FRs are MVP-scoped, 23 are Phase 2/3.

**Non-Functional Requirements:**
27 NFRs with critical constraints:
- Performance: TUI at 30+ FPS, ILP round-trip < 2s, agent decision cycle < 5s (simple) / < 30s (LLM)
- Security: All ILP packets signed, private keys never transmitted, BLS validates every reducer call
- Scalability: 10 concurrent agents MVP, 50+ Phase 2
- Integration: SpacetimeDB 1.6.x, Nostr NIP-01, OpenAI-compatible LLM APIs
- Reliability: Auto-reconnect within 10s, zero silent identity propagation failures

**Scale & Complexity:**
- Primary domain: TypeScript SDK + Rust TUI + Real-time Systems + Payment Infrastructure
- Complexity level: High
- Estimated architectural components: 15+ (`@sigil/client`, `@sigil/mcp-server`, `@sigil/tui-backend`, Rust TUI, SpacetimeDB client, Crosstown client, skill parser, IPC layer, TUI app, experiment harness, decision logger, Docker environment, BLS handler, action cost registry, snapshot system, analysis tools)

## Technical Constraints & Dependencies

| Constraint | Impact | Source |
|-----------|--------|--------|
| SpacetimeDB 1.6.x protocol | Pins subscription API surface | `@sigil/client` |
| Crosstown consumed as dependency | No modifications to payment layer | Write path |
| BitCraft server unmodified | Must work with vanilla reducers | All game interactions |
| Nostr public key = sole identity | No username/password fallback | Identity system |
| ILP payment on every write | Zero bypass paths allowed | Business model |
| Skill file format parsed by `@sigil/client` | Single parser in TypeScript, served to TUI via IPC | Core interoperability |
| ratatui/crossterm for TUI | Terminal rendering constraints | Rust TUI client |
| rebels-in-the-sky patterns | Reference architecture for TUI | Event loop, Screen trait, widgets |

## Cross-Cutting Concerns Identified

1. **Identity Propagation** — Nostr keypair → ILP signature → BLS verification → SpacetimeDB attribution. Touches every write path in `@sigil/client`.
2. **Skill File Format** — Markdown-based DSL parsed by `@sigil/client` (TypeScript). Skill data served to TUI via IPC.
3. **SpacetimeDB Subscription Management** — `@sigil/client` manages connection lifecycle, reconnection, state recovery. ~80 entity tables + 148 static data tables. TUI receives data via IPC.
4. **Error Handling Across Boundaries** — Errors cross SpacetimeDB → `@sigil/client` → Crosstown → BLS → SpacetimeDB. Actionable error messages per PRD requirement.
5. **Cost Tracking** — Budget awareness in Agent.md, skill file cost declarations, ILP wallet balance, action cost registry. All managed by `@sigil/client`.
6. **Logging & Observability** — JSONL decision logs (agent), system metrics (infrastructure), BLS validation (identity). Research validity depends on complete logging.

## Architecture Refinement Focus Areas

Based on gap analysis between existing architecture and finalized PRD:

1. **ADD: Rust TUI Architecture** — ratatui TUI application communicating with `@sigil/tui-backend` via JSON-RPC IPC, event-driven architecture following rebels-in-the-sky patterns
2. **ADD: Declarative Agent System** — Agent.md parser, skill file format specification, action registry in `@sigil/client`
3. **ADD: Identity Propagation Design** — End-to-end mechanism for Nostr key → BLS → SpacetimeDB
4. **UPDATE: System Context** — Expand to single SDK with multiple consumer interfaces (MCP, IPC, direct import)
5. **UPDATE: Data Flow** — Add Crosstown relay read path, identity propagation detail
6. **UPDATE: Cognition Stack** — Integrate with declarative skill files instead of programmatic config
7. **UPDATE: Project Structure** — Polyglot monorepo (pnpm + cargo workspace layout)
8. **UPDATE: Phased Plan** — Align with PRD's critical path and multi-interface scope

---
