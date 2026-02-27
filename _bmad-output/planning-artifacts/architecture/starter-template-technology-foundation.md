# Starter Template & Technology Foundation

## Primary Technology Domain

TypeScript SDK with Rust TUI frontend — no standard starter template applies. Manual workspace initialization for both TypeScript (pnpm) and Rust (cargo) workspaces.

## Starter Options Considered

| Option                                    | Verdict        | Reason                                                            |
| ----------------------------------------- | -------------- | ----------------------------------------------------------------- |
| Standard web starters (T3, Next.js, Vite) | Not applicable | SDK library, not web application                                  |
| pnpm monorepo template generators         | Partial fit    | Provide workspace scaffolding but not SDK-specific tooling        |
| cargo-generate templates                  | Partial fit    | Generic workspace templates lack SpacetimeDB integration          |
| Manual initialization                     | Selected       | Full control over structure, dependencies, and workspace topology |

## Selected Approach: Manual Polyglot Workspace Initialization

**Rationale:** The project's unique integration requirements (SpacetimeDB + Crosstown + Nostr + ILP + ratatui) mean no existing template provides meaningful head start. Manual setup ensures dependency versions are verified and workspace structure matches the architectural needs.

## Verified Current Dependency Versions

**TypeScript SDK Dependencies:**

| Package                          | Version | Notes                                                                                                                                                                                                                                       |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@clockworklabs/spacetimedb-sdk` | ^1.3.3  | **REQUIRED VERSION:** Must use 1.x SDK for compatibility with BitCraft's SpacetimeDB 1.6.0 server. SDK 2.0+ introduces incompatible WebSocket v2 protocol. See spike: `_bmad-output/auto-bmad-artifacts/spike-spacetimedb-compatibility.md` |
| `nostr-tools`                    | 2.23.0  | Event signing, key management, NIP implementations                                                                                                                                                                                          |
| `pnpm`                           | 9.x     | Workspace monorepo management                                                                                                                                                                                                               |
| `tsup`                           | latest  | Zero-config TypeScript bundler (ESM + CJS output, DTS generation)                                                                                                                                                                           |
| `vitest`                         | latest  | TypeScript-native test framework                                                                                                                                                                                                            |
| `typescript`                     | 5.x     | Strict mode configuration                                                                                                                                                                                                                   |

**Rust TUI Dependencies (presentation layer only — no direct SpacetimeDB or Crosstown connections):**

| Crate                  | Version | Notes                                                            |
| ---------------------- | ------- | ---------------------------------------------------------------- |
| `ratatui`              | 0.30+   | Modular workspace architecture since 0.30. Terminal UI framework |
| `crossterm`            | 0.29.0  | Cross-platform terminal manipulation                             |
| `tokio`                | 1.x     | Async runtime (rt, time, macros, sync)                           |
| `serde` / `serde_json` | latest  | JSON-RPC IPC serialization with `@sigil/tui-backend`             |

**Shared Tooling:**

| Tool                    | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| Docker / docker-compose | Local dev environment (BitCraft server + Crosstown node) |
| GitHub Actions          | CI/CD                                                    |

## SpacetimeDB Version Strategy

**Critical decision (Updated 2026-02-26):** BitCraft Server pins `spacetimedb = "=1.6.0"`. Compatibility spike confirmed that SpacetimeDB 2.0 clients are **NOT backwards compatible** with 1.6.x servers due to new WebSocket protocol v2 and breaking API changes.

**Required Approach:**

- Use **SpacetimeDB SDK 1.3.3** (latest stable 1.x) for TypeScript client
- Client SDK version must match server version per SpacetimeDB documentation
- SDK 2.0.0 additionally has broken npm dependencies (`spacetimedb@next` does not exist)

**Upgrade Path:**

- Monitor BitCraft server repo for SpacetimeDB 2.x upgrade
- When server upgrades to 2.x, coordinate client SDK upgrade
- Expect breaking changes requiring client code refactoring (see [SpacetimeDB Migration Guide](https://spacetimedb.com/docs/upgrade/))

**Spike Report:** See `_bmad-output/auto-bmad-artifacts/spike-spacetimedb-compatibility.md` for detailed findings

## TypeScript Workspace Initialization

```bash
mkdir sigil && cd sigil
pnpm init
```
