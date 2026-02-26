# BitCraft Server - Project Documentation Index

## Project Overview

- **Type:** Monorepo with 2 parts (game, global_module)
- **Primary Language:** Rust (2021 edition)
- **Runtime:** SpacetimeDB v1.6.0 (WASM)
- **Architecture:** Regional game servers + Global coordinator

## Quick Reference

### Game Module (game)

- **Type:** Backend (SpacetimeDB WASM module)
- **Tech Stack:** Rust, SpacetimeDB 1.6.0, glam, strum, csv, regex
- **Root:** `packages/game/`
- **Source Files:** ~533 `.rs` files
- **Purpose:** Regional gameplay server (movement, combat, crafting, buildings, resources, NPCs, trading)

### Global Module (global_module)

- **Type:** Backend (SpacetimeDB WASM module)
- **Tech Stack:** Rust, SpacetimeDB 1.6.0 (symlinks shared code from game)
- **Root:** `packages/global_module/`
- **Source Files:** ~150+ `.rs` files
- **Purpose:** Cross-region coordinator (auth, accounts, empires, social, moderation, economy)

## Generated Documentation

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Data Models](./data-models.md)
- [Development Guide](./development-guide.md)

## Existing Documentation

- [PR Template](../BitCraftServer/.github/pull_request_template.md) - Pull request template with goals, dev notes, testing checklist

## Getting Started

1. Install Rust 2021 toolchain via [rustup](https://rustup.rs/)
2. Add WASM target: `rustup target add wasm32-unknown-unknown`
3. Install SpacetimeDB CLI v1.6.0 from [spacetimedb.com](https://spacetimedb.com/install)
4. Build: `cd packages/game && cargo build --release --target wasm32-unknown-unknown`
5. Publish: `spacetime publish <module-name> -s <server>`
6. See [Development Guide](./development-guide.md) for full setup instructions
