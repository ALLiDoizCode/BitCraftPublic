# BitCraft Server - Source Tree Analysis

Annotated directory tree of the BitCraft Server monorepo. Symlinks are noted where the global module reuses code from the game module.

```
BitCraftServer/
│
├── .github/
│   ├── workflows/                          # CI/CD pipelines
│   │   ├── upload-module.yml               # Publish to SpacetimeDB on push/PR
│   │   ├── delete-module.yml               # Cleanup PR preview modules
│   │   └── weekly-update-stable-branch.yml # Auto-promote master -> qa -> stable
│   └── pull_request_template.md            # PR template: goals, dev notes, testing
│
├── generate-client-files.sh                # Generate C# (Unity) or TypeScript client bindings
├── migration.sh                            # Run SpacetimeDB migrations
├── publish.sh                              # Multi-region publish script
│
├── packages/
│   ├── game/                               # ===== MAIN GAME MODULE (regional server) =====
│   │   ├── Cargo.toml                      # Deps: spacetimedb 1.6.0, glam, strum, csv, regex
│   │   ├── build.rs                        # Auto-generates handlers, entities, static data, discovery
│   │   ├── build_shared.rs                 # Shared build utilities (also symlinked by global_module)
│   │   │
│   │   ├── bitcraft-macro/                 # Proc macros for code generation
│   │   │   └── src/lib.rs                  # shared_table, static_data_staging_table, etc.
│   │   │
│   │   ├── config/                         # Environment-specific JSON configs
│   │   │   ├── default.json                # Base config (all environments)
│   │   │   ├── local.json                  # Local dev overrides
│   │   │   ├── production.json             # Production settings
│   │   │   ├── qa.json                     # QA settings
│   │   │   ├── staging.json                # Staging settings
│   │   │   └── testing.json                # Test settings
│   │   │
│   │   ├── utility/                        # Build-time data processing tools
│   │   │
│   │   └── src/
│   │       ├── lib.rs                      # Entry point: initialize() reducer, module imports
│   │       │
│   │       ├── agents/                     # 20 scheduled server-side agents
│   │       │                               #   Automated processes: respawning, decay, NPC ticks,
│   │       │                               #   queue management, world maintenance, etc.
│   │       │
│   │       ├── game/
│   │       │   ├── autogen/                # Build-generated code
│   │       │   │   ├── _delete_entity.rs   #   Cascade-delete logic for all entity types
│   │       │   │   └── _static_data.rs     #   Static data table accessors
│   │       │   │
│   │       │   ├── coordinates/            # Hex grid coordinate system
│   │       │   │   ├── float_hex_tile.rs   #   Floating-point hex position
│   │       │   │   ├── small_hex_tile.rs   #   Fine-grained hex tile
│   │       │   │   ├── large_hex_tile.rs   #   Coarse hex tile (chunk-scale)
│   │       │   │   └── chunk_coordinates.rs#   Chunk-based spatial partitioning
│   │       │   │
│   │       │   ├── discovery/              # Knowledge/learning progression system
│   │       │   │                           #   Players discover recipes, skills, locations over time
│   │       │   │
│   │       │   ├── entities/               # ~80 SpacetimeDB table definitions
│   │       │   │                           #   All runtime game objects: players, buildings, items,
│   │       │   │                           #   NPCs, resources, claims, vehicles, etc.
│   │       │   │
│   │       │   ├── game_state/             # Core state management
│   │       │   │                           #   Entity creation, spatial queries, teleportation, wind
│   │       │   │
│   │       │   ├── generic/                # Reusable algorithms
│   │       │   │   └── pathfinder.rs       #   A* pathfinding implementation
│   │       │   │
│   │       │   ├── handlers/               # ===== REDUCERS (public API) =====
│   │       │   │   ├── admin/              # Admin commands (server management, bans, etc.)
│   │       │   │   ├── attack.rs           # Combat system (damage, targeting, PvP/PvE)
│   │       │   │   ├── authentication.rs   # Auth flow, role verification
│   │       │   │   ├── buildings/          # Building placement, upgrades, demolition
│   │       │   │   ├── cheats/             # Dev-mode cheat commands
│   │       │   │   ├── claim/              # Land claim creation, management, permissions
│   │       │   │   ├── dev/                # Developer/debug tools
│   │       │   │   ├── empires/            # Empire management (join, leave, ranks, settings)
│   │       │   │   ├── inventory/          # Item management (pick up, drop, equip, use)
│   │       │   │   ├── migration/          # Data migration reducers (schema evolution)
│   │       │   │   ├── player/             # Player actions
│   │       │   │   │                       #   Movement, sign_in/sign_out, chat, emotes,
│   │       │   │   │                       #   trade initiation, quest interactions
│   │       │   │   ├── player_craft/       # Crafting system (recipes, stations, queues)
│   │       │   │   ├── player_inventory/   # Inventory operations (split, merge, sort, transfer)
│   │       │   │   ├── player_trade/       # Player-to-player trading
│   │       │   │   ├── player_vault/       # Vault storage and collectibles
│   │       │   │   ├── queue/              # Login queue management
│   │       │   │   ├── rentals/            # Property rental system
│   │       │   │   ├── resource/           # Resource node gathering (mining, chopping, etc.)
│   │       │   │   ├── server/             # Server lifecycle management
│   │       │   │   ├── stats/              # Leaderboards and statistics
│   │       │   │   └── world/              # World placement, terrain editing, portals
│   │       │   │
│   │       │   ├── claim_helper.rs         # Claim validation and permission utilities
│   │       │   ├── dimensions.rs           # Dimension definitions (OVERWORLD = 1)
│   │       │   ├── load_config.rs          # Runtime config loader
│   │       │   ├── location_cache.rs       # Spatial lookup caches for fast queries
│   │       │   └── permission_helper.rs    # Permission checking system
│   │       │
│   │       ├── import_reducers.rs          # 100+ static data import reducers
│   │       │                               #   Load game content (items, recipes, skills, biomes, etc.)
│   │       │                               #   from CSV/config into 148 static data tables
│   │       │
│   │       ├── inter_module/               # Cross-module messaging system
│   │       │                               #   Typed messages between game <-> global_module
│   │       │
│   │       ├── macros/                     # Rust utility macros
│   │       ├── messages/                   # SpacetimeDB type definitions (message structs)
│   │       ├── table_caches/               # Performance caches for hot table data
│   │       └── utils/                      # Shared utility functions
│   │
│   │
│   └── global_module/                      # ===== GLOBAL MODULE (cross-region coordinator) =====
│       ├── Cargo.toml                      # Same core deps as game module
│       ├── build.rs                        # Minimal build script (less codegen than game)
│       ├── bitcraft-macro -> ../game/bitcraft-macro      # SYMLINK to game's proc macros
│       ├── build_shared.rs -> ../game/build_shared.rs    # SYMLINK to shared build utils
│       │
│       └── src/
│           ├── lib.rs                      # Entry point (similar initialization to game module)
│           │
│           ├── agents/                     # 2 server-side agents
│           │   ├── empire_decay.rs         #   Gradual empire territory/resource decay
│           │   └── empire_siege.rs         #   Siege timer and resolution logic
│           │
│           ├── game/
│           │   └── handlers/               # Global reducers
│           │       ├── admin/              #   Cross-region admin commands
│           │       ├── authentication.rs   #   Player authentication and account management
│           │       ├── cheats/             #   Global cheat commands (dev mode)
│           │       ├── empires/            #   Empire creation, dissolution, cross-region state
│           │       ├── gm/                 #   Game master / moderation tools
│           │       ├── player/             #   Player account operations
│           │       └── stats/              #   Global statistics and leaderboards
│           │
│           ├── import_global_data.rs       # Region connection info (server URLs, regions)
│           ├── import_reducers.rs          # Static data import (shared with game module)
│           │
│           ├── inter_module/               # Inter-module message handling
│           │                               #   Receives and processes messages from game modules
│           │
│           ├── messages/                   # Message type definitions
│           │                               #   Mostly symlinked from packages/game/src/messages/
│           │
│           └── translations/               # Localization system
│                                           #   Server-side string translations
```

## Key Architectural Notes

### Code Sharing via Symlinks

The global module avoids duplicating shared code by symlinking into the game module:

- `bitcraft-macro/` -- Proc macros are identical for both modules.
- `build_shared.rs` -- Build utilities are shared.
- `messages/` -- Most message type definitions in the global module are symlinks to the game module's definitions.

### Build-Time Code Generation

The game module's `build.rs` is the most significant build script. It generates:

1. **Handler registration** -- Discovers all reducer functions and generates dispatch code.
2. **Entity management** -- Generates cascade-delete logic for all entity types (`_delete_entity.rs`).
3. **Static data accessors** -- Generates typed accessors for all 148 static data tables (`_static_data.rs`).
4. **Discovery bindings** -- Generates code for the knowledge/learning progression system.

### Data Flow

```
Static Data (CSV/config)
    |
    v
import_reducers.rs  --->  148 static data tables (read-only at runtime)

Player Actions (client)
    |
    v
handlers/ (reducers)  --->  ~80 entity/state tables (read-write)
    |
    v
inter_module/  <--->  global_module (auth, empires, economy)
    |
    v
agents/ (scheduled)  --->  Automated maintenance (decay, respawn, ticks)
```

### Coordinate System

The game uses a hex-grid world with multiple coordinate scales:

| Type               | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `FloatHexTile`     | Sub-tile precision for smooth movement     |
| `SmallHexTile`     | Individual gameplay tiles                  |
| `LargeHexTile`     | Chunk-scale tiles for spatial partitioning |
| `ChunkCoordinates` | Chunk addressing for data streaming        |
