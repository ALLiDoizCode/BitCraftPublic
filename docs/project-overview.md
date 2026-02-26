# BitCraft Server - Project Overview

## Summary

BitCraft Server is the server-side codebase for BitCraft, a massively multiplayer online RPG built on [SpacetimeDB](https://spacetimedb.com/) v1.6.0. The project is written in Rust (2021 edition) and compiles to two WebAssembly modules that run inside SpacetimeDB instances.

## Architecture

The system follows a **regional + global** architecture:

- **Game Module** (regional server) -- Handles all gameplay for a single server region: movement, combat, crafting, building, resource gathering, world generation, NPCs, and trading.
- **Global Module** (cross-region coordinator) -- Handles authentication, player accounts, empires, social features, moderation, and the premium economy across all regions.

Regional game servers communicate with the global coordinator through a **typed inter-module message system**.

## Codebase at a Glance

| Metric | Value |
|---|---|
| Language | Rust 2021 edition |
| Runtime | SpacetimeDB v1.6.0 (WASM) |
| Game module source files | ~533 `.rs` files |
| Global module source files | ~150+ `.rs` files |
| Server-side agents | 20 scheduled agents for automated game processes |
| Static data tables | 148 tables defining game content (items, recipes, skills, etc.) |
| Entity/state tables | ~80 SpacetimeDB tables for runtime game state |
| Client code generation | C# (Unity) and TypeScript bindings |

## Repository Structure

This is a **Rust monorepo** with two primary packages:

```
packages/
  game/           # Regional game server WASM module
  global_module/  # Global coordinator WASM module
```

The global module symlinks shared code (macros, build utilities, message types) from the game module to avoid duplication.

## Key Subsystems

### Game Module

- **Handlers (Reducers)** -- The public API surface. Covers player actions, combat, crafting, inventory, trading, building placement, land claims, resource gathering, empires, admin commands, and developer tools.
- **Entities** -- ~80 SpacetimeDB table definitions representing all runtime game objects and their state.
- **Agents** -- 20 server-side scheduled tasks that drive automated processes (resource respawning, NPC behavior, decay, sieges, etc.).
- **Coordinates** -- A hex-grid coordinate system with multiple tile sizes (FloatHexTile, SmallHexTile, LargeHexTile) and chunk-based spatial organization.
- **Static Data** -- 148 tables of game content imported at initialization from CSV/config sources. Covers items, recipes, buildings, skills, biomes, and more.
- **Build System** -- A custom `build.rs` pipeline that auto-generates handler registrations, entity management code, static data loaders, and discovery system bindings.

### Global Module

- **Authentication and Accounts** -- Player identity, sign-in, role management.
- **Empires** -- Cross-region empire state, decay mechanics, siege coordination.
- **Social and Moderation** -- Player reporting, moderation tools, GM commands.
- **Premium Economy** -- In-game premium currency and transactions.
- **Translations** -- Server-side localization system.

## Deployment

- **CI/CD** via GitHub Actions with multi-environment SpacetimeDB deployment.
- **Branch promotion**: `master` -> `qa` -> `stable` (weekly automated promotion).
- **PR preview modules**: Each pull request gets a dedicated SpacetimeDB module (`bitcraft-pr-{number}`) for testing.
- **Client codegen**: Automated generation of C# and TypeScript bindings from the module schema.
