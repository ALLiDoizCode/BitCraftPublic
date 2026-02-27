# ADR-003: Polyglot Monorepo Structure

**Status:** Accepted
**Date:** 2026-02-25 (Implemented in Story 1.1)
**Deciders:** Jonathan (Project Lead), Charlie (Senior Dev)

---

## Context

The Sigil SDK consists of multiple interconnected components written in different languages:
- **TypeScript**: Client library, MCP server, TUI backend (Node.js runtime)
- **Rust**: Terminal user interface (ratatui), BLS handler (future)

The question was: Should these components live in separate repositories (multi-repo) or a single monorepo? And if monorepo, how do we structure TypeScript and Rust workspaces?

---

## Problem Statement

We need a repository structure that:
1. **Supports multiple languages** (TypeScript + Rust)
2. **Shares code between packages** (e.g., types, utilities)
3. **Has atomic versioning** (all packages versioned together)
4. **Simplifies CI/CD** (single build pipeline)
5. **Scales to 10+ packages** (client, MCP server, TUI, BLS handler, etc.)
6. **Provides good IDE support** (VS Code, JetBrains)

---

## Options Considered

### Option 1: Multi-Repo (Separate Repositories)

**Structure:**
```
sigil-client/         (TypeScript repo)
sigil-mcp-server/     (TypeScript repo)
sigil-tui/            (Rust repo)
sigil-bls-handler/    (Rust repo)
```

**Pros:**
- Clear separation of concerns
- Independent versioning (client v1.0.0, TUI v2.0.0)
- Language-specific tooling (no polyglot complexity)

**Cons:**
- Dependency management nightmare (npm link, cargo path dependencies)
- No atomic versioning (client and MCP server can drift)
- Duplicate CI/CD configuration (4 separate pipelines)
- Harder to coordinate breaking changes across packages
- No shared types or utilities (code duplication)

---

### Option 2: Polyglot Monorepo (Single Repo, Multiple Workspaces)

**Structure:**
```
BitCraftPublic/
├── packages/            # TypeScript workspace (pnpm)
│   ├── client/
│   ├── mcp-server/
│   └── tui-backend/
├── crates/              # Rust workspace (cargo)
│   ├── tui/
│   └── bls-handler/
├── package.json         # Root pnpm workspace
└── Cargo.toml           # Root cargo workspace
```

**Pros:**
- **Atomic versioning**: All packages versioned together (0.1.0 across the board)
- **Shared code**: Types, utilities, constants shared between packages
- **Single CI/CD pipeline**: One GitHub Actions workflow
- **Coordinated changes**: Breaking changes affect all packages at once (good for refactoring)
- **Single source of truth**: All code in one place

**Cons:**
- **Polyglot complexity**: Requires both Node.js and Rust toolchains
- **IDE configuration**: VS Code needs both TypeScript and Rust extensions
- **Build time**: Longer than single-language monorepo (must build both TS and Rust)

---

### Option 3: TypeScript Monorepo + Rust Monorepo (Separate by Language)

**Structure:**
```
sigil-ts/            # TypeScript monorepo
├── packages/
│   ├── client/
│   ├── mcp-server/
│   └── tui-backend/

sigil-rust/          # Rust monorepo
├── crates/
│   ├── tui/
│   └── bls-handler/
```

**Pros:**
- Language-specific tooling (no polyglot complexity)
- Separate CI/CD for TS and Rust (faster builds)

**Cons:**
- No shared types between TS and Rust (IPC protocol duplication)
- Versioning coordination required (must manually keep versions in sync)
- Two repositories to manage (PRs, issues, documentation)

---

## Decision

**We chose Option 2: Polyglot Monorepo (Single Repo, TypeScript + Rust Workspaces)**

Repository name: `BitCraftPublic` (inherited from upstream BitCraft fork)

---

## Rationale

1. **Atomic Versioning is Critical**
   - Client library, MCP server, and TUI must stay in sync
   - Breaking changes in client API affect MCP server and TUI backend
   - Versioning everything together prevents drift (all packages are 0.1.0)

2. **Shared Types and Utilities**
   - IPC protocol types shared between TypeScript backend and Rust TUI
   - Nostr types shared between client and MCP server
   - Build scripts, linting config, CI/CD shared across all packages

3. **Simplified Dependency Management**
   - TypeScript packages reference each other via `workspace:*` protocol (pnpm)
   - Rust crates reference each other via `path = "../tui"` (cargo)
   - No `npm link` hacks, no version mismatches

4. **Single CI/CD Pipeline**
   - One GitHub Actions workflow for all packages
   - Matrix builds for TypeScript and Rust
   - Fewer configuration files to maintain

5. **Better Refactoring Experience**
   - Rename a type → Find all usages across all packages
   - Extract shared utility → All packages can import it immediately
   - No "update 5 repositories" when making breaking changes

6. **Epic 1 Validation**
   - Story 1.1 implemented monorepo structure
   - 12 tests validate build infrastructure (TypeScript + Rust)
   - `pnpm build` and `cargo build` work seamlessly

---

## Consequences

### Positive
- ✅ **Atomic versioning**: All packages at 0.1.0, no drift
- ✅ **Shared code**: Types, utilities, build scripts
- ✅ **Single source of truth**: All code in one repository
- ✅ **Simplified CI/CD**: One pipeline, fewer config files
- ✅ **Better refactoring**: Cross-package changes are trivial

### Negative
- ⚠️ **Polyglot complexity**: Requires Node.js + Rust + pnpm + cargo
- ⚠️ **IDE setup**: VS Code needs TypeScript + Rust extensions
- ⚠️ **Build time**: Longer than single-language monorepo
- ⚠️ **Onboarding**: New contributors must install both toolchains

### Mitigation Strategies
1. **Clear setup documentation**: `CLAUDE.md` has detailed setup instructions
2. **VS Code config**: `.vscode/extensions.json` recommends extensions
3. **Docker development**: Docker stack handles Rust builds (optional)
4. **Build optimization**: `pnpm build` only rebuilds changed packages (incremental)

---

## Implementation Details

**Story 1.1: Monorepo Scaffolding & Build Infrastructure** (2026-02-25)

### TypeScript Workspace (pnpm)

```json
// package.json (root)
{
  "name": "sigil-monorepo",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "pnpm --recursive build",
    "test": "pnpm --recursive test"
  }
}
```

**Packages:**
- `packages/client` - Core SDK (`@sigil/client`)
- `packages/mcp-server` - MCP protocol wrapper (`@sigil/mcp-server`)
- `packages/tui-backend` - JSON-RPC IPC backend (`@sigil/tui-backend`)

**Cross-Package References:**
```json
// packages/mcp-server/package.json
{
  "dependencies": {
    "@sigil/client": "workspace:*"
  }
}
```

---

### Rust Workspace (cargo)

```toml
# Cargo.toml (root)
[workspace]
members = ["crates/tui"]
resolver = "2"
```

**Crates:**
- `crates/tui` - Terminal UI (`sigil-tui`)
- `crates/bls-handler` - BLS game action handler (future, Epic 2 Story 2.4)

**Cross-Crate References:**
```toml
# crates/bls-handler/Cargo.toml (future)
[dependencies]
sigil-tui = { path = "../tui" }
```

---

### Build Scripts

**TypeScript Build:**
```bash
pnpm build        # Build all TypeScript packages
pnpm test         # Run all tests
pnpm lint         # Lint all packages
```

**Rust Build:**
```bash
cargo build       # Build all Rust crates
cargo test        # Run all Rust tests
cargo clippy      # Lint all crates
```

**All-in-One:**
```bash
pnpm build && cargo build  # Build everything
```

---

### CI/CD Pipeline

**.github/workflows/test.yml:**
```yaml
name: Test

on: [push, pull_request]

jobs:
  typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test

  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - run: cargo build
      - run: cargo test
      - run: cargo clippy
```

---

## File Structure

```
BitCraftPublic/
├── packages/                    # TypeScript workspace (pnpm)
│   ├── client/                  # @sigil/client
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── mcp-server/              # @sigil/mcp-server
│   └── tui-backend/             # @sigil/tui-backend
│
├── crates/                      # Rust workspace (cargo)
│   └── tui/                     # sigil-tui
│       ├── src/
│       └── Cargo.toml
│
├── docker/                      # Docker development environment
│   ├── bitcraft/
│   ├── crosstown/
│   └── docker-compose.yml
│
├── _bmad-output/                # BMAD workflow artifacts
│   ├── planning-artifacts/
│   └── implementation-artifacts/
│
├── package.json                 # Root pnpm workspace config
├── Cargo.toml                   # Root cargo workspace config
├── tsconfig.json                # Root TypeScript config
├── .gitignore
├── .prettierrc
├── .eslintrc.json
├── CLAUDE.md                    # Claude agent project guide
└── README.md                    # BitCraft server README (upstream)
```

---

## Naming Conventions

### npm Packages (TypeScript)
- **Scope**: `@sigil/*` (organization scope)
- **Names**: `@sigil/client`, `@sigil/mcp-server`, `@sigil/tui-backend`
- **Version**: Synchronized (all at 0.1.0)

### Rust Crates
- **Names**: `sigil-tui`, `sigil-bls-handler`
- **Version**: Synchronized with npm packages (0.1.0)

### Cross-Language Conventions
- **JSON fields (IPC)**: `camelCase`
- **Rust serde**: `#[serde(rename_all = "camelCase")]`
- **MCP tool names**: `snake_case`

---

## Related Decisions

- **ADR-002**: Nostr-Only Identity (TypeScript implementation in `packages/client`)
- **ADR-004**: Docker-Based Development Environment (supports polyglot builds)
- **Epic 5**: Terminal Game Client (Rust TUI communicates with TypeScript backend via IPC)

---

## References

- **pnpm Workspaces**: https://pnpm.io/workspaces
- **Cargo Workspaces**: https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html
- **Story 1.1 Report**: `_bmad-output/implementation-artifacts/1-1-monorepo-scaffolding-and-build-infrastructure.md`

---

**Status:** ✅ ACCEPTED - Implemented in Epic 1 Story 1.1 (12 tests, 100% pass rate)
**Last Updated:** 2026-02-27 by Charlie (Senior Dev)
