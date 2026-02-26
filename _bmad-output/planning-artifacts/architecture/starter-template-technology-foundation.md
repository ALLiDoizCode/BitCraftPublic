# Starter Template & Technology Foundation

## Primary Technology Domain

TypeScript SDK with Rust TUI frontend — no standard starter template applies. Manual workspace initialization for both TypeScript (pnpm) and Rust (cargo) workspaces.

## Starter Options Considered

| Option | Verdict | Reason |
|--------|---------|--------|
| Standard web starters (T3, Next.js, Vite) | Not applicable | SDK library, not web application |
| pnpm monorepo template generators | Partial fit | Provide workspace scaffolding but not SDK-specific tooling |
| cargo-generate templates | Partial fit | Generic workspace templates lack SpacetimeDB integration |
| Manual initialization | Selected | Full control over structure, dependencies, and workspace topology |

## Selected Approach: Manual Polyglot Workspace Initialization

**Rationale:** The project's unique integration requirements (SpacetimeDB + Crosstown + Nostr + ILP + ratatui) mean no existing template provides meaningful head start. Manual setup ensures dependency versions are verified and workspace structure matches the architectural needs.

## Verified Current Dependency Versions

**TypeScript SDK Dependencies:**

| Package | Version | Notes |
|---------|---------|-------|
| `spacetimedb` | 2.0.1 | **BREAKING: replaces deprecated `@clockworklabs/spacetimedb-sdk`**. New WebSocket v2 protocol, reducer callbacks removed (use event tables + `_then()` callbacks). Backwards-compatible with 1.6.x modules. |
| `nostr-tools` | 2.23.0 | Event signing, key management, NIP implementations |
| `pnpm` | 9.x | Workspace monorepo management |
| `tsup` | latest | Zero-config TypeScript bundler (ESM + CJS output, DTS generation) |
| `vitest` | latest | TypeScript-native test framework |
| `typescript` | 5.x | Strict mode configuration |

**Rust TUI Dependencies (presentation layer only — no direct SpacetimeDB or Crosstown connections):**

| Crate | Version | Notes |
|-------|---------|-------|
| `ratatui` | 0.30+ | Modular workspace architecture since 0.30. Terminal UI framework |
| `crossterm` | 0.29.0 | Cross-platform terminal manipulation |
| `tokio` | 1.x | Async runtime (rt, time, macros, sync) |
| `serde` / `serde_json` | latest | JSON-RPC IPC serialization with `@sigil/tui-backend` |

**Shared Tooling:**

| Tool | Purpose |
|------|---------|
| Docker / docker-compose | Local dev environment (BitCraft server + Crosstown node) |
| GitHub Actions | CI/CD |

## SpacetimeDB Version Strategy

**Critical decision:** BitCraft Server pins `spacetimedb = "=1.6.0"`. The TypeScript SDK has moved to 2.0.1. SpacetimeDB 2.0 maintains backwards compatibility with existing modules, meaning 2.0 clients can connect to 1.6.x servers. The architecture should:

- Target **SpacetimeDB 2.0 client SDKs** for both TypeScript and Rust
- Verify backwards compatibility with 1.6.x modules during Phase 1 spike
- Document any 2.0-specific features that are unavailable when connected to 1.6.x servers
- Plan for BitCraft Server eventually upgrading to 2.0

## TypeScript Workspace Initialization

```bash
mkdir sigil && cd sigil
pnpm init