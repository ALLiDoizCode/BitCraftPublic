# BitCraft Server - Development Guide

## Prerequisites

1. **Rust 2021 toolchain** -- Install via [rustup](https://rustup.rs/).
2. **WASM target** -- Add the compilation target:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```
3. **SpacetimeDB CLI v1.6.0** -- Install from [spacetimedb.com](https://spacetimedb.com/install).

## Building

The game module compiles to a WASM binary that runs inside SpacetimeDB.

```bash
cd packages/game/
cargo build --release --target wasm32-unknown-unknown
```

The global module builds the same way:

```bash
cd packages/global_module/
cargo build --release --target wasm32-unknown-unknown
```

The build process invokes a custom `build.rs` that auto-generates:
- Handler/reducer registrations
- Entity management code
- Static data import reducers
- Discovery system bindings

## Publishing to SpacetimeDB

Deploy a module to a SpacetimeDB instance:

```bash
spacetime publish <module-name> -s <server>
```

For multi-region deployments, use the provided script:

```bash
./publish.sh
```

For database migrations:

```bash
./migration.sh
```

## Configuration

Environment-specific JSON configs live in `packages/game/config/`:

| File | Purpose |
|---|---|
| `default.json` | Base configuration (all environments) |
| `local.json` | Local development overrides |
| `production.json` | Production settings |
| `qa.json` | QA environment settings |
| `staging.json` | Staging environment settings |
| `testing.json` | Test environment settings |

Configuration is loaded at module initialization via the `load_config` system.

## Client Code Generation

Generate client bindings (C# for Unity or TypeScript) from the published module schema:

```bash
./generate-client-files.sh
```

This produces typed client code that matches the server's table definitions and reducer signatures.

## CI/CD Pipeline

### Automated Publishing

| Trigger | Action |
|---|---|
| Push to `master` | Publish to development SpacetimeDB instance |
| Push to `qa` | Publish to QA SpacetimeDB instance |
| Push to `stable` | Publish to production SpacetimeDB instance |
| Pull request opened/updated | Publish preview module as `bitcraft-pr-{number}` |
| Pull request closed | Delete the preview module (`delete-module.yml`) |

### Branch Strategy

```
master  -->  qa  -->  stable
```

- **master** -- Active development. All PRs merge here.
- **qa** -- Quality assurance. Promoted from master weekly.
- **stable** -- Production. Promoted from qa weekly.

Weekly promotion is automated via `.github/workflows/weekly-update-stable-branch.yml`.

### GitHub Actions Workflows

- **`upload-module.yml`** -- Builds and publishes WASM modules to SpacetimeDB on push or PR events.
- **`delete-module.yml`** -- Cleans up PR preview modules when pull requests are closed.
- **`weekly-update-stable-branch.yml`** -- Automates the `master -> qa -> stable` branch promotion on a weekly schedule.

## Pull Request Process

PRs use a structured template (`.github/pull_request_template.md`) with the following sections:

1. **Goals** -- What the PR accomplishes.
2. **Dev notes** -- Implementation details, decisions, caveats.
3. **Testing checklist** -- Steps to verify the changes work correctly.

## Project Layout Quick Reference

```
packages/game/src/
  lib.rs                  # Module entry point (initialize reducer)
  agents/                 # 20 scheduled server agents
  game/handlers/          # All reducers (public API)
  game/entities/          # ~80 SpacetimeDB table definitions
  game/coordinates/       # Hex grid coordinate system
  import_reducers.rs      # 100+ static data import reducers
  inter_module/           # Cross-module messaging
  messages/               # SpacetimeDB type definitions

packages/global_module/src/
  lib.rs                  # Module entry point
  agents/                 # Empire decay and siege agents
  game/handlers/          # Global reducers (auth, empires, admin, etc.)
  inter_module/           # Inter-module message handling
  translations/           # Localization system
```
