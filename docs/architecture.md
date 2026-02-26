# BitCraft Server Architecture

## Table of Contents

- [1. Overview](#1-overview)
- [2. Repository Structure](#2-repository-structure)
- [3. Module Architecture](#3-module-architecture)
  - [3.1 Game Module (Regional)](#31-game-module-regional)
  - [3.2 Global Module (Cross-Region)](#32-global-module-cross-region)
  - [3.3 Shared Code via Symlinks](#33-shared-code-via-symlinks)
- [4. SpacetimeDB Integration](#4-spacetimedb-integration)
  - [4.1 Tables](#41-tables)
  - [4.2 Reducers](#42-reducers)
  - [4.3 Scheduled Reducers (Agents)](#43-scheduled-reducers-agents)
- [5. Entity System](#5-entity-system)
- [6. Coordinate System](#6-coordinate-system)
- [7. Handler Organization](#7-handler-organization)
- [8. Inter-Module Communication](#8-inter-module-communication)
  - [8.1 Message Protocol](#81-message-protocol)
  - [8.2 Shared Table Synchronization](#82-shared-table-synchronization)
  - [8.3 Message Processing Lifecycle](#83-message-processing-lifecycle)
- [9. Static Data Pipeline](#9-static-data-pipeline)
- [10. Discovery and Knowledge System](#10-discovery-and-knowledge-system)
- [11. Permission System](#11-permission-system)
- [12. World Generation](#12-world-generation)
- [13. Server Agents](#13-server-agents)
- [14. Build System and Code Generation](#14-build-system-and-code-generation)
  - [14.1 build.rs / build_shared.rs](#141-buildrs--build_sharedrs)
  - [14.2 Procedural Macros (bitcraft-macro)](#142-procedural-macros-bitcraft-macro)
- [15. Configuration System](#15-configuration-system)
- [16. Authentication and Roles](#16-authentication-and-roles)
- [17. Key Data Flow Patterns](#17-key-data-flow-patterns)
- [18. Dependencies](#18-dependencies)
- [19. CI/CD](#19-cicd)
- [20. Conventions and Patterns for Contributors](#20-conventions-and-patterns-for-contributors)

---

## 1. Overview

BitCraft Server is a Rust-based game server for the BitCraft MMORPG, built on top of [SpacetimeDB](https://spacetimedb.com) v1.6.0. The server compiles to WebAssembly (WASM) modules that run inside the SpacetimeDB runtime, leveraging its built-in database, subscription system, and scheduled reducer infrastructure.

The architecture is organized as a **monorepo with two SpacetimeDB WASM modules**:

| Module | Role | Approx. Size | Crate Type |
|--------|------|--------------|------------|
| `game` | Regional game server -- handles all gameplay for a single world region | ~533 .rs files | `cdylib` |
| `global_module` | Cross-region coordinator -- authentication, player accounts, empires, social features | ~150 .rs files | `cdylib` |

Both modules are compiled with Rust 2021 edition and target `wasm32-unknown-unknown`. The release profile uses `opt-level = 's'` with LTO enabled to minimize WASM binary size.

---

## 2. Repository Structure

```
BitCraftServer/
  packages/
    game/                           # Regional game module
      Cargo.toml                    # crate: bitcraft-spacetimedb (cdylib)
      build.rs                      # Code generation entry point
      build_shared.rs               # Shared build logic (symlinked to global_module)
      bitcraft-macro/               # Proc macro crate
        Cargo.toml
        src/lib.rs
      src/
        lib.rs                      # Module entry: init, connect, disconnect, world gen
        agents/                     # 20+ scheduled background processes
          mod.rs
          auto_logout_agent.rs
          building_decay_agent.rs
          ...
        game/
          mod.rs
          coordinates/              # Hex grid coordinate types
          dimensions.rs             # Dimension constants (OVERWORLD, etc.)
          entities/                 # ~80+ entity state structs
          handlers/                 # Reducer implementations by domain
            admin/
            attack.rs
            authentication.rs
            buildings/
            cheats/
            claim/
            dev/
            empires/
            inventory/
            migration/
            player/                 # ~70+ player action reducers
            player_craft/
            player_inventory/
            player_trade/
            player_vault/
            queue/
            rentals/
            resource/
            server/
            stats/
            world/
          game_state/               # Core state helpers (entity creation, time)
          discovery/                # Knowledge/discovery system (partially auto-generated)
          static_data/              # Static data helpers (building, resource, loot, etc.)
          permission_helper.rs      # Claim-based permission checks
          claim_helper.rs           # Claim tile lookups
          location_cache.rs         # Cached world locations (trading posts, ruins, spawns)
          reducer_helpers/          # Shared reducer utility functions
          world_gen/                # Procedural world generation
          unity_helpers/            # Client-facing coordinate helpers
        inter_module/               # Inter-module messaging system
          mod.rs                    # SharedTransactionAccumulator, message routing
          reducers.rs               # process_inter_module_message, response handling
          _autogen.rs               # Auto-generated InterModuleTableUpdates
          player_create.rs
          transfer_player.rs
          ...
        messages/                   # Table/type definitions (shared between modules)
          components.rs             # Entity state tables (~80 SpacetimeDB tables)
          static_data.rs            # Static game data tables (~148 staged data tables)
          inter_module.rs           # Inter-module message types
          authentication.rs         # Identity, roles
          generic.rs                # Config, Globals, AdminBroadcast
          ...
        macros/                     # Shared macro utilities
        utils/                      # Shared utilities
        table_caches/               # Table caching layer
        i18n.rs                     # Internationalization

    global_module/                  # Cross-region global module
      Cargo.toml                    # Same crate name: bitcraft-spacetimedb (cdylib)
      build.rs
      build_shared.rs               # Symlink -> game/build_shared.rs
      src/
        lib.rs                      # Module entry: init
        agents/                     # Global agents (fewer than game)
        game/
          handlers/                 # Global handlers
            admin/
            authentication.rs
            cheats/
            empires/
            gm/
            player/
            stats/
          entities/
          static_data/
          coordinates/
          ...
        inter_module/               # Global-side inter-module processing
        messages/                   # Symlink -> game/src/messages/
        macros/                     # Symlink -> game/src/macros/
        utils/                      # Symlink -> game/src/utils/
        i18n.rs                     # Symlink -> game/src/i18n.rs
        translations/               # Translation data
```

---

## 3. Module Architecture

### 3.1 Game Module (Regional)

The `game` module is an instance of a **regional server**. In a multi-region deployment, multiple `game` modules run simultaneously, each responsible for a rectangular portion of the game world. Key responsibilities:

- **Player gameplay**: Movement, combat, crafting, building, trading, extraction, eating, sleeping, quests
- **World state**: Terrain chunks, resource deposits, buildings, enemies, NPCs, dropped inventories
- **Claim system**: Land ownership, permissions, building claims, empire settlements
- **Entity lifecycle**: Creation (with region-encoded IDs), state management, deletion
- **Background processes**: 20+ scheduled agents for world simulation
- **World generation**: Procedural terrain, biome placement, resource distribution, building spawns

Entry point: `src/lib.rs` defines the `initialize` reducer (called on module init), `identity_connected`/`identity_disconnected` reducers, and world generation reducers.

### 3.2 Global Module (Cross-Region)

The `global_module` manages state that must be consistent across all regions:

- **Authentication**: Player identity verification, role management
- **Player accounts**: User creation, name management, region tracking
- **Empires**: Empire creation, membership, permissions, settlements, sieges, hexite economy
- **Social features**: Friends, chat, moderation
- **Premium economy**: Hub items, premium currency
- **Translations**: Multi-language support
- **Admin/GM tools**: Global administration, moderation commands

### 3.3 Shared Code via Symlinks

Several directories are shared between `game` and `global_module` via filesystem symlinks:

| Shared Path | Contents |
|-------------|----------|
| `messages/` | All SpacetimeDB table definitions and type declarations |
| `macros/` | Shared macro utilities |
| `utils/` | Shared utility functions |
| `i18n.rs` | Internationalization module |
| `build_shared.rs` | Shared build script logic |
| `bitcraft-macro/` | Procedural macro crate |

This ensures both modules use identical table schemas and type definitions, which is critical for inter-module communication.

---

## 4. SpacetimeDB Integration

### 4.1 Tables

Tables are defined using the `#[spacetimedb::table(...)]` attribute macro. They fall into several categories:

| Category | Location | Description | Example |
|----------|----------|-------------|---------|
| Entity State | `messages/components.rs` | Runtime game entity state (~80 tables) | `PlayerState`, `BuildingState`, `EnemyState` |
| Static Data | `messages/static_data.rs` | Game content definitions (~148 tables) | `BuildingDesc`, `ItemDesc`, `RecipeDesc` |
| Shared Tables | Various `messages/*.rs` | Replicated between modules via `#[shared_table]` | `IdentityRole`, `EmpireState` |
| Inter-Module | `messages/inter_module.rs` | Message passing tables | `InterModuleMessageV4` |
| Generic | `messages/generic.rs` | Singleton config/state | `Config`, `Globals`, `AdminBroadcast` |

Table access follows SpacetimeDB conventions:

```rust
// Insert
ctx.db.player_state().try_insert(player)?;

// Query by primary key
let player = ctx.db.player_state().entity_id().find(&entity_id);

// Query by index
let members = ctx.db.claim_member_state().player_claim().filter((player_id, claim_id));

// Update
ctx.db.player_state().entity_id().update(modified_player);

// Delete
ctx.db.player_state().entity_id().delete(entity_id);

// Iterate
for enemy in ctx.db.enemy_state().iter() { ... }
```

### 4.2 Reducers

Reducers are the public API of each module. They are Rust functions annotated with `#[spacetimedb::reducer]`:

```rust
#[spacetimedb::reducer]
pub fn player_move(ctx: &ReducerContext, x: f32, z: f32, ...) -> Result<(), String> {
    let entity_id = game_state::actor_id(ctx, true)?;
    // ... movement logic
    Ok(())
}
```

Special reducer types:
- `#[spacetimedb::reducer(init)]` -- Called once when the module is first published
- `#[spacetimedb::reducer(client_connected)]` -- Called when a client connects
- `#[spacetimedb::reducer(client_disconnected)]` -- Called when a client disconnects

Reducers that modify shared tables must also use `#[shared_table_reducer]` (a proc macro that sets up the `SharedTransactionAccumulator`).

### 4.3 Scheduled Reducers (Agents)

SpacetimeDB supports scheduled/repeating reducers. BitCraft uses these extensively for background simulation. Each agent initializes via `spacetimedb::schedule!` or similar scheduling primitives and checks `agents::should_run(ctx)` before executing.

---

## 5. Entity System

All game entities (players, buildings, enemies, NPCs, resources, etc.) share a **common entity ID space**. Entity IDs are 64-bit unsigned integers with the **region index encoded in the upper 8 bits**:

```rust
// From game_state/mod.rs
pub fn create_entity(ctx: &ReducerContext) -> u64 {
    let mut globals = ctx.db.globals().version().find(&0).unwrap();
    globals.entity_pk_counter += 1;
    let pk = globals.entity_pk_counter;
    let pk = pk | ((globals.region_index as u64) << 56);  // Region in bits 56-63
    ctx.db.globals().version().update(globals);
    pk
}
```

This design enables:
- Globally unique entity IDs across all regions without coordination
- Quick identification of which region owns an entity by inspecting the upper byte
- Safe cross-region entity references

Entity state is stored across multiple tables using `entity_id` as a common key. An entity's full state is the union of all rows with its `entity_id` across tables like `LocationState`, `HealthState`, `InventoryState`, etc.

Entity deletion is auto-generated by `build.rs`, which scans `messages/components.rs` for tables with a `#[delete]` attribute and generates `delete_entity()` / `clear_entity()` functions in `src/game/autogen/_delete_entity.rs`.

---

## 6. Coordinate System

BitCraft uses a multi-layered hexagonal coordinate system. All coordinate types are defined in `game/coordinates/` with backing message types in `messages/util.rs`:

| Type | Granularity | Usage |
|------|-------------|-------|
| `OffsetCoordinatesFloat` | Sub-tile float precision | Player positions, mobile entities |
| `FloatHexTile` | Hex tile with float offset | Movement targets, precise positions |
| `SmallHexTile` | Single hex tile (integer) | Building placement, resource positions, claim tiles |
| `LargeHexTile` | Cluster of small hex tiles | Large-scale spatial queries |
| `ChunkCoordinates` | Terrain chunk (grid of tiles) | Terrain data, biome assignment |
| `RegionCoordinates` | World region | Multi-region world layout |
| `HexDirection` | 6 cardinal hex directions | Movement, building orientation |
| `OffsetCoordinatesSmall` | Small offset coordinates (x, z, dimension) | General entity locations |
| `OffsetCoordinatesLarge` | Large offset coordinates | Dimension-level positioning |

Entities are positioned via two tables:
- `LocationState` -- For static entities (buildings, resources): stores `OffsetCoordinatesSmall`
- `MobileEntityState` -- For moving entities (players, enemies): stores `OffsetCoordinatesFloat` with timestamp

The world is divided into **dimensions**. Dimension 1 is the `OVERWORLD`. Building interiors create separate dimensions. Each dimension has a `DimensionDescriptionState` defining its position and size in the larger world grid.

---

## 7. Handler Organization

Game logic is organized into handler modules under `game/handlers/`. Each handler file typically contains one or more `#[spacetimedb::reducer]` functions. The `mod.rs` files are **auto-generated by build.rs** -- adding a new `.rs` file to a handler directory automatically makes it available.

### Game Module Handlers

| Domain | Path | Description |
|--------|------|-------------|
| `admin/` | `handlers/admin/` | Admin commands (broadcast, world management) |
| `attack` | `handlers/attack.rs` | Combat attack logic |
| `authentication` | `handlers/authentication.rs` | Role checks, identity validation |
| `buildings/` | `handlers/buildings/` | Building placement, deconstruction, repair, signs, project sites |
| `cheats/` | `handlers/cheats/` | Dev/cheat commands (creative mode) |
| `claim/` | `handlers/claim/` | Land claim management, permissions |
| `dev/` | `handlers/dev/` | Developer tools |
| `empires/` | `handlers/empires/` | Empire operations (settlements, sieges, nodes, supplies) |
| `inventory/` | `handlers/inventory/` | Inventory management |
| `migration/` | `handlers/migration/` | Data migration reducers |
| `player/` | `handlers/player/` | ~70+ player actions: movement, crafting, trading, eating, sleeping, quests, teleportation, etc. |
| `player_craft/` | `handlers/player_craft/` | Crafting operations |
| `player_inventory/` | `handlers/player_inventory/` | Player inventory operations |
| `player_trade/` | `handlers/player_trade/` | Player-to-player trading |
| `player_vault/` | `handlers/player_vault/` | Vault (persistent storage) operations |
| `queue/` | `handlers/queue/` | Player login queue management |
| `rentals/` | `handlers/rentals/` | Housing rental system |
| `resource/` | `handlers/resource/` | Resource extraction and management |
| `server/` | `handlers/server/` | Server lifecycle operations |
| `stats/` | `handlers/stats/` | Player statistics tracking |
| `world/` | `handlers/world/` | World state queries and operations |

### Reducer Helpers

Common logic shared across handlers lives in `game/reducer_helpers/`:

| Helper | Purpose |
|--------|---------|
| `building_helpers.rs` | Building creation, footprint, spawns, claims |
| `cargo_helpers.rs` | Cargo item management |
| `deployable_helpers.rs` | Deployable entity management (vehicles, siege engines) |
| `dimension_helpers.rs` | Dimension creation and queries |
| `distance_helpers.rs` | Distance calculations on hex grid |
| `footprint_helpers.rs` | Building footprint tile management |
| `health_helpers.rs` | Health manipulation |
| `interior_helpers.rs` | Building interior creation |
| `loot_chest_helpers.rs` | Loot chest generation |
| `move_validation_helpers.rs` | Movement anti-cheat validation |
| `player_action_helpers.rs` | Progressive action state management |
| `restore_player_helpers.rs` | Player state restoration on sign-in |
| `stats_helpers.rs` | Statistics calculation |
| `timer_helpers.rs` | Scheduled timer utilities |
| `user_text_input_helpers.rs` | Text input sanitization |

---

## 8. Inter-Module Communication

The game and global modules communicate through an **inter-module message system** built on SpacetimeDB tables. This is one of the most critical architectural patterns in the codebase.

### 8.1 Message Protocol

Messages are stored in the `InterModuleMessageV4` table (the current version; V1-V3 exist for backward compatibility):

```rust
#[spacetimedb::table(name = inter_module_message_v4, public)]
pub struct InterModuleMessageV4 {
    #[primary_key]
    #[auto_inc]
    pub id: u64,       // Auto-incrementing message ID
    pub to: u8,        // Recipient: 0 = global module, 1+ = region index
    pub contents: MessageContentsV4,  // Typed message payload
}
```

The `MessageContentsV4` enum defines all possible message types:

```rust
pub enum MessageContentsV4 {
    TableUpdate(InterModuleTableUpdates),          // Shared table sync
    TransferPlayerRequest(TransferPlayerMsgV4),    // Cross-region player transfer
    TransferPlayerHousingRequest(...),             // Housing transfer
    PlayerCreateRequest(PlayerCreateMsg),           // New player creation
    UserUpdateRegionRequest(UserUpdateRegionMsg),   // Region tracking update
    OnPlayerNameSetRequest(...),                    // Name change propagation
    ClaimCreateEmpireSettlementState(...),          // Empire settlement
    EmpireCreateBuilding(...),                      // Empire building operations
    OnEmpireBuildingDeleted(...),                   // Building deletion notification
    EmpireClaimJoin(...),                           // Empire-claim association
    EmpireResupplyNode(...),                        // Node resupply
    EmpireStartSiege(...),                          // Siege initiation
    SignPlayerOut(SignPlayerOutMsg),                 // Remote sign-out
    AdminBroadcastMessage(...),                     // Global announcements
    PlayerSkipQueue(...),                           // Queue skip
    GrantHubItem(...),                              // Premium item grant
    RecoverDeployable(...),                         // Cross-region deployable recovery
    ReplaceIdentity(...),                           // Identity migration
    // ... and more
}
```

### 8.2 Shared Table Synchronization

Tables annotated with `#[shared_table]` are automatically replicated between modules. The build system generates:

1. **Operation enums** for each shared table (e.g., `IdentityRoleOp { Insert(...), Delete(...) }`)
2. An **`InterModuleTableUpdates`** struct containing optional vectors of operations for every shared table
3. An **`apply_updates()`** method that replays all operations on the receiving module

The `SharedTransactionAccumulator` (defined in `inter_module/mod.rs`) manages this process:

```rust
pub struct SharedTransactionAccumulator<'a> {
    pub ctx: &'a ReducerContext,
}

// When dropped, sends accumulated table updates as an inter-module message
impl Drop for SharedTransactionAccumulator<'_> {
    fn drop(&mut self) {
        self.send_shared_transaction();
    }
}
```

Table updates accumulate in **thread-local storage** during reducer execution:

```rust
thread_local! {
    static TABLE_UPDATES_GLOBAL: RefCell<InterModuleAccumulator> = ...;
    static TABLE_UPDATES_OTHER_REGIONS: RefCell<InterModuleAccumulator> = ...;
    static DELAYED_MESSAGES: RefCell<Vec<(MessageContentsV4, InterModuleDestination)>> = ...;
}
```

Reducers that modify shared tables use the `#[shared_table_reducer]` attribute, which the `bitcraft-macro` proc macro expands to set up and tear down the accumulator.

### 8.3 Message Processing Lifecycle

1. **Sender** inserts a row into `inter_module_message_v4` with a destination module ID
2. An external **relay service** (outside the WASM modules) polls for new messages and calls `process_inter_module_message` on the destination module
3. **Destination** processes the message, dispatching on `MessageContentsV4` variant
4. The relay calls `on_inter_module_message_processed` on the **sender** with the result
5. The sender handles success/failure (e.g., completing a player transfer or rolling back)

Message deduplication uses `InterModuleMessageCounter` tables that track the last processed message ID per sender module.

Destinations are expressed as:

```rust
pub enum InterModuleDestination {
    Global,                  // Send to global module (id = 0)
    AllOtherRegions,         // Broadcast to all region modules except self
    GlobalAndAllOtherRegions,// Both global and all other regions
    Region(u8),              // Send to a specific region by index
}
```

---

## 9. Static Data Pipeline

Game content (items, buildings, enemies, recipes, skills, etc.) is managed through a **staged data pipeline** with ~148 static data tables. The workflow is:

1. **Stage**: Upload data via auto-generated `stage_{table_name}` reducers. Each call inserts records into `staged_{table_name}` tables.
2. **Validate**: Call `validate_staged_data` to verify all staged tables are non-empty.
3. **Commit**: Apply staged data to live tables, replacing existing content.
4. **Clear**: Call `clear_staged_static_data` to remove all staged records.

The `build.rs` script auto-generates all staging reducers by scanning `messages/*.rs` for tables annotated with `#[static_data_staging_table]`:

```rust
// Auto-generated example:
#[spacetimedb::reducer]
pub fn stage_item_desc(ctx: &ReducerContext, records: Vec<ItemDesc>) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }
    for r in records {
        if let Err(e) = ctx.db.staged_item_desc().try_insert(r.clone()) {
            return Err(e.to_string());
        }
    }
    Ok(())
}
```

All staging reducers require Admin role.

---

## 10. Discovery and Knowledge System

The discovery system tracks what each player has encountered or acquired. It is **heavily code-generated** by `build.rs`.

### Knowledge Categories

There are ~20 knowledge tables, each tracking a different category. Tables are identified by annotations on their struct definitions in `messages/components.rs`:

| Annotation | Type | ID Field | Example Table |
|------------|------|----------|---------------|
| `#[knowledge]` | Simple knowledge | `id: i32` | `KnowledgeItemState`, `KnowledgeBuildingState` |
| `#[knowledge_entity]` | Entity knowledge | `entity_id: u64` | `KnowledgeEnemyState`, `KnowledgeNpcState` |
| `#[knowledge_location]` | Location knowledge | `location_hash` | `KnowledgeRuinsState` |
| `#[knowledge_recipe]` | Recipe knowledge | `id: i32` + auto-discovers components | `KnowledgeCraftState` |
| `#[knowledge_on_acquire_callback]` | Knowledge with callback | `id: i32` | (triggers additional logic on acquire) |

### Generated API

For each knowledge table `Knowledge{Name}State`, the build system generates:

```rust
impl Discovery {
    // Static checks (no Discovery instance needed)
    pub fn already_discovered_{name}(ctx, player_entity_id, id) -> bool;
    pub fn already_acquired_{name}(ctx, player_entity_id, id) -> bool;

    // Instance methods (lazy-loads knowledges on first use)
    pub fn has_discovered_{name}(&self, id) -> bool;
    pub fn has_acquired_{name}(&self, id) -> bool;
    pub fn discover_{name}(&mut self, ctx, id);   // Mark as discovered
    pub fn acquire_{name}(&mut self, ctx, id);     // Mark as acquired (implies discovered)
}
```

### Knowledge States

Each knowledge entry has a `KnowledgeState`:
- **Discovered** -- The player has seen/encountered the thing
- **Acquired** -- The player has obtained/mastered the thing

### Usage Pattern

```rust
let mut discovery = Discovery::new(player_entity_id);

// Discovering an item (lazy-initializes knowledge arrays from DB)
discovery.discover_item(ctx, item_id);

// Acquiring an item (auto-discovers if not already discovered)
discovery.acquire_item(ctx, item_id);

// Commit changes back to DB (only writes tables that changed, using hash comparison)
discovery.commit(ctx);
```

The `Discovery` struct uses lazy initialization -- it only loads knowledge arrays from the database when a modification is first attempted. On `commit()`, it compares hashes of each knowledge array to detect changes and only writes back modified tables.

---

## 11. Permission System

Permissions control who can interact with claimed land and buildings. The system is implemented in `game/permission_helper.rs` and `game/claim_helper.rs`.

### Permission Types

```rust
pub enum ClaimPermission {
    Build,      // Place/destroy buildings and tiles
    Inventory,  // Access storage containers
    Usage,      // Use functional buildings (crafting stations, etc.)
}
```

### Permission Resolution Order

The permission check in `has_permission()` follows this priority:

1. **Rental dimension check**: If the entity is in a rented interior (dimension != OVERWORLD), check the rent whitelist. If the player is on the whitelist, they have access. Claims are ignored for rented spaces.

2. **Claim-based check** (via `has_claim_permission()`):
   - **Neutral claims**: Allow `Usage` and `Inventory` for everyone
   - **Unowned claims** (owner_player_entity_id == 0): Allow everything
   - **Unshielded claims** (supplies == 0): Allow everything
   - **Claim members**: Check `ClaimMemberState` for per-permission flags (`build_permission`, `inventory_permission`; `Usage` is always true for members)
   - **Non-members**: Denied

### Building Interaction Levels

Buildings have an `interact_permission` and `build_permission` field in their description, using `BuildingInteractionLevel`:

| Level | Behavior |
|-------|----------|
| `All` | Anyone can interact |
| `None` | No one can interact |
| `Empire` | Only empire members with appropriate empire permissions |
| Default | Falls through to claim-based permission check |

### Empire Overrides

Empire buildings (watchtowers, hexite reserves, foundries) have special permission logic:
- Watchtower `Usage` is open to everyone (for siege initiation)
- Empire node operations require empire membership
- Depleted watchtowers can be destroyed by any empire member on that influence area
- Emperor-only operations for destructive actions on active nodes

---

## 12. World Generation

World generation creates terrain, biomes, buildings, resources, enemies, and NPCs. The system lives in `game/world_gen/` and supports multiple generation modes:

| Mode | Reducer | Description |
|------|---------|-------------|
| Full procedural | `generate_world` | Uses `WorldDefinition` and `WorldGraph` for full procedural generation |
| Dev island | `generate_dev_island` | Small test island for development |
| Flat world | `generate_flat_world` | Flat terrain for testing |
| External upload | `start_generating_world` + `insert_terrain_chunk` | Terrain uploaded chunk-by-chunk from external tool |

### Generation Pipeline

1. **Region setup**: `start_generating_world` creates `DimensionDescriptionState` and `WorldRegionState`
2. **Terrain generation**: Chunks are generated or uploaded, each containing tile data
3. **Building placement**: World-gen buildings with claims and interiors
4. **Resource distribution**: Resource deposits placed per biome rules
5. **Enemy spawning**: Enemies placed according to enemy type definitions
6. **NPC placement**: NPCs at designated locations
7. **Location cache**: `LocationCache::build()` indexes key locations (trading posts, ruins, spawn points)
8. **Resources log**: `ResourcesLog` records generation metadata
9. **Agent initialization**: Background agents are started

The world is considered "loaded" when a `ResourcesLog` entry exists (`world_loaded()` check).

---

## 13. Server Agents

Agents are scheduled background processes that drive world simulation. They are initialized after world generation and check `agents::should_run(ctx)` (which reads `Config.agents_enabled`) before executing.

| Agent | File | Purpose |
|-------|------|---------|
| Auto-Logout | `auto_logout_agent.rs` | Signs out inactive players after timeout |
| Building Decay | `building_decay_agent.rs` | Reduces building durability over time |
| Chat Cleanup | `chat_cleanup_agent.rs` | Removes old chat messages |
| Crumb Trail Cleanup | `crumb_trail_clean_up_agent.rs` | Cleans up player movement trail markers |
| Day/Night Cycle | `day_night_agent.rs` | Advances the in-game time of day |
| Duel | `duel_agent.rs` | Manages duel timeouts and resolution |
| Enemy Regen | `enemy_regen_agent.rs` | Respawns enemies and regenerates health |
| Environment Debuff | `environment_debuff_agent.rs` | Applies environmental damage/effects |
| Growth | `growth_agent.rs` | Advances crop/plant growth stages |
| NPC AI | `npc_ai_agent.rs` | Drives NPC behavior and movement |
| Player Housing Income | `player_housing_income_agent.rs` | Distributes rental income to housing owners |
| Player Regen | `player_regen_agent.rs` | Regenerates player health/stamina |
| Region Population | `region_population_agent.rs` | Tracks and reports region player counts |
| Rent Collector | `rent_collector_agent.rs` | Collects rent payments from tenants |
| Resource Regen | `resources_regen.rs` | Respawns depleted resource deposits |
| Starving | `starving_agent.rs` | Applies hunger damage to starving players |
| Storage Log Cleanup | `storage_log_cleanup_agent.rs` | Cleans up old storage access logs |
| Teleportation Energy Regen | `teleportation_energy_regen_agent.rs` | Regenerates teleportation energy |
| Trade Sessions | `trade_sessions_agent.rs` | Times out inactive trade sessions |
| Traveler Tasks | `traveler_task_agent.rs` | Manages NPC traveler task timers |

Agent tick rates are configured via static data parameters (`parameters_desc_v2` table) and can be updated at runtime via `update_scheduled_timers_from_static_data`.

Admin controls:
- `stop_agents` -- Pauses all agents (sets `Config.agents_enabled = false`)
- `start_agents` -- Resumes agents (no re-initialization)
- `force_start_agents` -- Re-initializes agents (warning: may cause duplicates)

---

## 14. Build System and Code Generation

### 14.1 build.rs / build_shared.rs

The build system performs extensive code generation by parsing source files. It runs during `cargo build` and generates files in `src/game/autogen/` and `src/inter_module/`.

| Generated File | Source Function | What It Generates |
|----------------|-----------------|-------------------|
| `game/handlers/**/mod.rs` | `build_all_handlers_mods()` | Auto-discovers handler files and generates `pub mod` declarations |
| `game/autogen/_delete_entity.rs` | `build_gamestate_operations()` | `delete_entity()` and `clear_entity()` functions that delete from all relevant entity tables |
| `game/autogen/_static_data.rs` | `build_static_data_staging_tables()` | `stage_*`, `clear_staged_static_data`, and `validate_staged_data` reducers |
| `inter_module/_autogen.rs` | `build_shared_tables()` | `InterModuleTableUpdates` struct, per-table `Op` enums, `apply_updates()` |
| `game/discovery/autogen/_discovery.rs` | `build_knowledge()` | `Knowledges` struct, `Discovery` impl with discover/acquire/commit methods |
| `utils/version.rs` | `build_version_reducer()` | `current_version` reducer that logs the git commit hash |

The build script identifies tables by scanning for annotations in the Rust source:
- `#[spacetimedb::table(...)]` -- Identifies SpacetimeDB tables
- `#[delete]` -- Marks tables included in entity deletion
- `#[shared_table]` -- Marks tables replicated between modules
- `#[static_data_staging_table]` -- Marks static data tables that get staging reducers
- `#[knowledge]`, `#[knowledge_entity]`, `#[knowledge_location]`, `#[knowledge_recipe]`, `#[knowledge_on_acquire_callback]` -- Knowledge system markers
- `#[achievement]` -- Links knowledge to achievement evaluation

### 14.2 Procedural Macros (bitcraft-macro)

The `bitcraft-macro` crate (in `packages/game/bitcraft-macro/`) provides procedural macros used throughout the codebase:

| Macro | Usage | Purpose |
|-------|-------|---------|
| `#[shared_table]` | Table struct decoration | Marks a table for inter-module replication; generates insert/delete hooks that add operations to the `SharedTransactionAccumulator` |
| `#[shared_table_reducer]` | Reducer function decoration | Wraps the reducer to initialize and finalize the `SharedTransactionAccumulator` (begin on entry, send on exit) |
| `#[static_data_staging_table]` | Table struct decoration | Marks a table for static data staging pipeline |
| `#[event_table]` | Table struct decoration | Marks a table as an event (transient data) |
| `#[custom_inter_module_insert]` | Table struct decoration | Indicates the table has a custom `inter_module_insert()` method instead of using the default insert |

Dependencies: `syn 2.0`, `quote 1.0`, `proc-macro2`.

---

## 15. Configuration System

Configuration is loaded via the `load_config` reducer, which accepts multiple named environment configs and selects one based on the deployment environment.

```rust
#[spacetimedb::reducer]
pub fn load_config(ctx: &ReducerContext, environment_names: Vec<String>, contents: Vec<String>)
```

The selected config is parsed as JSON and stored in the `Config` table:

```rust
pub struct Config {
    pub version: i32,       // Always 0 (singleton)
    pub env: String,        // Environment name: "dev", "local", "production", "qa", "staging", "testing"
    pub agents_enabled: bool, // Whether background agents should execute
}
```

Environment names used in the project:
- `dev` -- Default for new database instances; relaxed permissions
- `local` -- Local development
- `production` -- Live production servers
- `qa` -- Quality assurance testing
- `staging` -- Pre-production staging
- `testing` -- Automated testing

The `Globals` singleton table stores global state:

```rust
pub struct Globals {
    pub version: i32,           // Always 0 (singleton)
    pub entity_pk_counter: u64, // Next entity ID (before region bits)
    pub dimension_counter: u32, // Next dimension ID
    pub region_index: u8,       // This region's index (0 for global)
}
```

---

## 16. Authentication and Roles

Authentication is identity-based using SpacetimeDB's built-in `Identity` type. The `IdentityRole` table maps identities to roles:

```rust
pub struct IdentityRole {
    pub role: Role,
    pub identity: Identity,
}

pub enum Role {
    Admin,
    SkipQueue,
    // ... other roles
}
```

Key authentication functions in `handlers/authentication.rs`:

| Function | Purpose |
|----------|---------|
| `has_role(ctx, identity, role)` | Check if an identity has a specific role |
| `is_authenticated(ctx, identity)` | Verify the identity is allowed to connect |
| `ServerIdentity::validate_server_or_admin(ctx)` | Verify caller is server or admin |
| `ServerIdentity::validate_server_only(ctx)` | Verify caller is the server identity |

The `initialize` reducer (called on module creation) grants Admin role to both the deployer identity (`ctx.sender`) and the database identity (`ctx.identity()`).

Connection flow:
1. Client connects, triggering `identity_connected`
2. Check if identity is a developer service account
3. Check if identity has `SkipQueue` role
4. Check if identity is blocked
5. Check if identity is authenticated
6. If identity has an existing signed-in session, sign them out first
7. If identity has no `UserState`, reject with error

---

## 17. Key Data Flow Patterns

### Player Sign-In Flow

1. Client connects -> `identity_connected` validates identity
2. Client calls `sign_in` reducer
3. Server restores player state (position, inventory, knowledge, etc.)
4. Server creates `SignedInPlayerState` entry
5. Client receives table subscriptions

### Cross-Region Player Transfer

1. Player initiates transfer (teleport/walk to region boundary)
2. Source region serializes full player state into `TransferPlayerMsgV4` (~40+ state tables)
3. Message inserted into `inter_module_message_v4` table
4. Relay forwards to destination region's `process_inter_module_message`
5. Destination region deserializes and inserts player state
6. Relay calls `on_inter_module_message_processed` on source
7. Source region cleans up local player state

### Static Data Update Flow

1. Admin calls `clear_staged_static_data` to reset staging tables
2. Admin calls `stage_{table_name}` for each data table (can batch records)
3. Admin calls a commit reducer that validates and swaps staged -> live
4. System calls `update_scheduled_timers_from_static_data` to apply new parameters

### Shared Table Modification Flow

1. Reducer decorated with `#[shared_table_reducer]` is called
2. `SharedTransactionAccumulator::begin_shared_transaction()` initializes thread-local accumulators
3. Any insert/delete on `#[shared_table]` tables adds operations to the accumulator
4. When the accumulator is dropped (reducer exit), it:
   - Packages all accumulated operations into `InterModuleTableUpdates`
   - Sends them as `MessageContentsV4::TableUpdate` to the global module (and optionally other regions)
5. Direct inter-module messages queued during the reducer are sent after table updates

---

## 18. Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| `spacetimedb` | =1.6.0 (unstable features) | Core database runtime, tables, reducers, scheduling |
| `spacetimedb-bindings-sys` | =1.6.0 | Low-level WASM bindings |
| `spacetimedb-bindings-macro` | =1.6.0 | Derive macros for SpacetimeDB types |
| `bitcraft-macro` | path dependency | Project-specific proc macros |
| `glam` | 0.30.9 | Math library (vectors, matrices) for game calculations |
| `strum` / `strum_macros` | 0.24 | Enum iteration and string conversion |
| `probability` | 0.20.3 | Probability distributions for loot tables, world gen |
| `csv` | 1.1 | CSV parsing for data import |
| `json` | * | JSON parsing for configuration |
| `regex` | 1.10.4 | Text pattern matching (name validation, etc.) |
| `lazy_static` | * | Lazy-initialized static values |
| `queues` | 1.0 | Queue data structures |
| `num-traits` | 0.2 | Numeric trait abstractions |

Build dependencies:
| Crate | Version | Purpose |
|-------|---------|---------|
| `glob` | 0.3.0 | File pattern matching for code generation |

Proc macro dependencies (bitcraft-macro):
| Crate | Version | Purpose |
|-------|---------|---------|
| `syn` | 2.0 | Rust syntax parsing |
| `quote` | 1.0 | Rust code generation |
| `proc-macro2` | * | Procedural macro utilities |

---

## 19. CI/CD

The project uses GitHub Actions for continuous integration and deployment.

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `upload-module.yml` | Push to branch / PR | Publishes the WASM module to SpacetimeDB |
| `delete-module.yml` | PR close | Cleans up PR-specific module instances |
| `weekly-update-stable-branch.yml` | Weekly schedule | Updates the stable release branch |

### Module Naming Convention

| Branch | Module Name |
|--------|-------------|
| `master` | `bitcraft-master` |
| `qa` | `bitcraft-qa` |
| PR #123 | `bitcraft-pr-123` |

### Deployment Notes

- Module publishing includes retry logic for transient failures
- The `-c` flag is used for schema-breaking changes (clears existing data)
- Both `game` and `global_module` must be published together for schema compatibility

---

## 20. Conventions and Patterns for Contributors

### Adding a New Reducer

1. Create a new `.rs` file in the appropriate `handlers/` subdirectory
2. Add `#[spacetimedb::reducer]` to the function
3. If the reducer modifies shared tables, also add `#[shared_table_reducer]`
4. The `mod.rs` will be **auto-generated** by `build.rs` -- no manual module registration needed
5. Always validate the caller at the start:
   ```rust
   let entity_id = game_state::actor_id(ctx, true)?;  // For player actions
   // or
   if !has_role(ctx, &ctx.sender, Role::Admin) {       // For admin actions
       return Err("Invalid permissions".into());
   }
   ```

### Adding a New Entity Table

1. Add the struct to `messages/components.rs` with `#[spacetimedb::table(...)]`
2. Include `entity_id: u64` as a field (with `#[primary_key]`) to integrate with the entity system
3. Add `#[delete]` annotation if the table should be cleaned up on entity deletion
4. Add `#[shared_table]` if the table needs inter-module replication
5. Rebuild to generate updated `_delete_entity.rs` and `_autogen.rs`

### Adding a New Static Data Table

1. Define the struct in `messages/static_data.rs`
2. Add `#[static_data_staging_table(table_name)]` annotation
3. Add the corresponding `#[spacetimedb::table(name = staged_table_name)]` for the staging copy
4. Rebuild to auto-generate `stage_*` and `clear_staged_*` reducers

### Adding a New Knowledge Category

1. Define the knowledge table in `messages/components.rs`
2. Annotate with the appropriate knowledge type (`#[knowledge]`, `#[knowledge_entity]`, etc.)
3. Optionally add `#[achievement]` if it should trigger achievement evaluation
4. Rebuild to auto-generate Discovery methods

### Adding a New Agent

1. Create `{name}_agent.rs` in `src/agents/`
2. Implement `init(ctx)` and the scheduled reducer function
3. Register the agent in `agents/mod.rs` `init()` function
4. Check `agents::should_run(ctx)` at the start of the scheduled function
5. If the agent's tick rate comes from static data, add an `update_timer(ctx)` function and register it in `update_scheduled_timers_from_static_data`

### Adding a New Inter-Module Message

1. Add a new message struct in `messages/inter_module.rs`
2. Add a new variant to `MessageContentsV4`
3. Create a handler module in `inter_module/` with `process_message_on_destination()` and optionally `handle_destination_result_on_sender()`
4. Register the handler in `inter_module/reducers.rs` in the `process_inter_module_message` match statement
5. Register the response handler in `on_inter_module_message_processed` if needed

### Common Patterns

**Singleton tables** use `version: i32` as primary key with value `0`:
```rust
let config = ctx.db.config().version().find(&0).unwrap();
```

**Entity state queries** use `entity_id` lookups:
```rust
let health = ctx.db.health_state().entity_id().find(&entity_id);
```

**Error handling** returns `Result<(), String>`:
```rust
pub fn my_reducer(ctx: &ReducerContext) -> Result<(), String> {
    // Validate
    let entity_id = game_state::actor_id(ctx, true)?;
    // Process
    // ...
    Ok(())
}
```

**Logging** uses SpacetimeDB's log macro:
```rust
use spacetimedb::log;
log::info!("Player {} signed in", entity_id);
log::error!("Failed to insert: {}", error);
log::warn!("Unexpected state");
```
