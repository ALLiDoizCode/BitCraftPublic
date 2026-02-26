# BitCraft Server - Data Models

This document catalogs the SpacetimeDB tables used in the BitCraft Server, organized by domain. Tables are defined with `#[spacetimedb::table(...)]` and compiled into the WASM modules.

## Table Categories

The codebase uses five categories of tables:

| Category | Count | Description |
|---|---|---|
| Entity/State Tables | ~80 | Runtime game objects and player state |
| Static Data Tables | ~148 | Immutable game content (items, recipes, skills, etc.) |
| Staged Data Tables | ~148 | Staging copies for the static data pipeline |
| Shared Tables | ~15 | Tables replicated between game and global modules |
| Event Tables | ~5 | Transient event data |

---

## 1. Core System Tables

These singleton or system-level tables manage global state.

| Table | PK | Shared | Description |
|---|---|---|---|
| `globals` | `version: i32` | No | Entity PK counter, dimension counter, region index |
| `config` | `version: i32` | No | Environment name, agents_enabled flag |
| `admin_broadcast` | `version: i32` | No | Server-wide broadcast message |
| `world_region_state` | `id: u8` | No | Region boundaries in chunk coordinates |
| `world_region_name_state` | `id: u16` | No | Player-facing region name and module prefix |
| `resource_count` | `resource_id: i32` | No | Resource deposit count per type (for respawning) |
| `region_connection_info` | `id: u8` | Yes | Region server host and module name |
| `region_population_info` | `region_id: u8` | Yes | Signed-in players and queue count per region |

---

## 2. Player Tables

### Core Player State

| Table | PK | Description |
|---|---|---|
| `player_state` | `entity_id: u64` | Core player data (name, location, spawn point) |
| `user_state` | `identity: Identity` | Account-level state (identity to entity mapping) |
| `signed_in_player_state` | `entity_id: u64` | Currently signed-in player marker |
| `player_timestamp_state` | `entity_id: u64` | Last activity timestamps |
| `player_username_state` | `entity_id: u64` | Display username |
| `player_lowercase_username_state` | `entity_id: u64` | Lowercase username (for case-insensitive lookups) |
| `player_prefs_state` | `entity_id: u64` | Player preferences |
| `player_settings_state_v2` | `entity_id: u64` | V2 settings (keybindings, UI preferences) |
| `onboarding_state` | `entity_id: u64` | Tutorial/onboarding progress |

### Player Attributes

| Table | PK | Description |
|---|---|---|
| `health_state` | `entity_id: u64` | Current and max health |
| `stamina_state` | `entity_id: u64` | Current and max stamina |
| `experience_state` | `entity_id: u64` | XP and level |
| `character_stats_state` | `entity_id: u64` | Stat allocations |
| `satiation_state` | `entity_id: u64` | Food/hunger system |
| `combat_state` | `entity_id: u64` | Combat engagement state |
| `active_buff_state` | `entity_id: u64` | Active buffs/debuffs |
| `teleportation_energy_state` | `entity_id: u64` | Teleportation energy pool |
| `move_validation_strike_counter_state` | `entity_id: u64` | Anti-cheat movement validation |

### Player Progression (Knowledge Tables)

Each knowledge table tracks player discovery/acquisition in a specific category:

| Table | PK | Knowledge Type | Description |
|---|---|---|---|
| `knowledge_item_state` | `entity_id: u64` | Simple | Items discovered/acquired |
| `knowledge_building_state` | `entity_id: u64` | Simple | Buildings encountered |
| `knowledge_craft_state` | `entity_id: u64` | Recipe | Crafting recipes (auto-discovers components) |
| `knowledge_construction_state` | `entity_id: u64` | Simple | Construction recipes |
| `knowledge_extract_state` | `entity_id: u64` | Simple | Extraction recipes |
| `knowledge_resource_state` | `entity_id: u64` | Simple | Resource types |
| `knowledge_resource_placement_state` | `entity_id: u64` | Simple | Resource placement recipes |
| `knowledge_enemy_state` | `entity_id: u64` | Entity | Enemy types |
| `knowledge_npc_state` | `entity_id: u64` | Entity | NPC types |
| `knowledge_ruins_state` | `entity_id: u64` | Location | Ruins discovered |
| `knowledge_lore_state` | `entity_id: u64` | Simple | Lore entries |
| `knowledge_cargo_state` | `entity_id: u64` | Simple | Cargo types |
| `knowledge_vault_state` | `entity_id: u64` | Simple | Vault items |
| `knowledge_secondary_state` | `entity_id: u64` | Simple | Secondary knowledge |
| `knowledge_battle_action_state` | `entity_id: u64` | Simple | Battle actions |
| `knowledge_achievement_state` | `entity_id: u64` | Simple | Achievements |
| `knowledge_deployable_state` | `entity_id: u64` | Simple | Deployable items |
| `knowledge_paving_state` | `entity_id: u64` | Simple | Paving tiles |
| `knowledge_claim_state` | `entity_id: u64` | Simple | Claim tech |
| `knowledge_pillar_shaping_state` | `entity_id: u64` | Simple | Pillar shaping |

### Player Inventory and Equipment

| Table | PK | Description |
|---|---|---|
| `inventory_state` | `entity_id: u64` | Inventory slots (multiple per player) |
| `equipment_state` | `entity_id: u64` | Equipped items |
| `toolbar_state` | `entity_id: u64` | Toolbar slot assignments |
| `action_state` | `entity_id: u64` | Active action slots |
| `ability_state` | `entity_id: u64` | Ability assignments |
| `action_bar_state` | `entity_id: u64` | Action bar configuration |
| `vault_state` | `entity_id: u64` | Personal vault contents |
| `unclaimed_collectibles_state` | `entity_id: u64` | Collectibles pending claim |
| `attack_outcome_state` | `entity_id: u64` | Last attack result |
| `extract_outcome_state` | `entity_id: u64` | Last extraction result |
| `exploration_chunks_state` | `entity_id: u64` | Map exploration progress |

### Player Activities

| Table | PK | Description |
|---|---|---|
| `player_action_state` | `entity_id: u64` | Current player actions (crafting, gathering) |
| `trade_session_state` | `entity_id: u64` | Active trade session |
| `deployable_collectible_state_v2` | `entity_id: u64` | Deployable item collectible tracking |
| `traveler_task_state` | `entity_id: u64` | Active traveler NPC tasks |
| `quest_chain_state` | `entity_id: u64` | Quest chain progress |
| `player_housing_state` | `entity_id: u64` | Housing ownership and rental info |

---

## 3. World and Terrain Tables

| Table | PK | Description |
|---|---|---|
| `dimension_description_state` | `dimension_id: u32` | Dimension metadata (OVERWORLD = 1) |
| `terrain_chunk_state` | Chunk coords | Terrain data per chunk |
| `biome_state` | Location | Biome assignment per tile |
| `paving_tile_state` | Location | Player-placed paving tiles |
| `terraform_state` | Location | Terrain modifications |
| `wind_state` | `id: u8` | Wind direction and speed |

---

## 4. Building Tables

| Table | PK | Description |
|---|---|---|
| `building_state` | `entity_id: u64` | Building instance (type, location, owner, durability) |
| `building_inventory_state` | `entity_id: u64` | Building storage contents |
| `building_craft_state` | `entity_id: u64` | Crafting station active recipe |
| `building_growth_state` | `entity_id: u64` | Crop/plant growing in building |
| `wall_state` | `entity_id: u64` | Wall segments |
| `gate_state` | `entity_id: u64` | Gates (open/closed) |
| `elevator_state` | `entity_id: u64` | Elevator positions |
| `interior_portal_state` | `entity_id: u64` | Interior portal connections |
| `portal_state` | `entity_id: u64` | World portal locations |
| `loot_chest_state` | `entity_id: u64` | Chest instances with contents |

---

## 5. Claim and Permission Tables

| Table | PK | Description |
|---|---|---|
| `claim_state` | `entity_id: u64` | Land claim (owner, name, tile boundaries) |
| `claim_tile_state` | Location | Individual claimed tiles |
| `claim_member_state` | Composite | Claim membership with permission flags |
| `claim_tech_state` | `entity_id: u64` | Unlocked claim technologies |
| `claim_description_state` | `entity_id: u64` | Claim description and settings |
| `rent_agreement_state` | `entity_id: u64` | Active rental agreements |
| `rent_whitelist_state` | Composite | Rental access whitelist |
| `identity_role` | Composite | Role assignments (Admin, SkipQueue, etc.) |

---

## 6. Empire Tables

| Table | PK | Shared | Description |
|---|---|---|---|
| `empire_state` | `entity_id: u64` | Yes | Empire data (name, color, icon, emperor) |
| `empire_member_state` | `entity_id: u64` | Yes | Empire membership and rank |
| `empire_building_state` | `entity_id: u64` | Yes | Empire-owned structures |
| `empire_settlement_state` | `entity_id: u64` | Yes | Empire settlements |
| `empire_siege_state` | `entity_id: u64` | Yes | Active siege state |
| `empire_supply_queue_state` | `entity_id: u64` | Yes | Supply queue for empire nodes |
| `empire_influence_state` | Location | No | Territory influence map |
| `emperor_crown_state` | `entity_id: u64` | Yes | Emperor crown item |

---

## 7. NPC and Enemy Tables

| Table | PK | Description |
|---|---|---|
| `npc_state` | `entity_id: u64` | NPC instance (type, location, dialogue) |
| `enemy_state` | `entity_id: u64` | Enemy instance (type, health, spawn point) |
| `enemy_movement_state` | `entity_id: u64` | Enemy pathfinding state |
| `threat_state` | Composite | Threat/aggro table for combat AI |
| `targetable_state` | `entity_id: u64` | Whether entity can be targeted |

---

## 8. Resource Tables

| Table | PK | Description |
|---|---|---|
| `resource_state` | `entity_id: u64` | Resource deposit (type, location, remaining) |
| `resource_growth_state` | `entity_id: u64` | Growing resource (crop) progress |

---

## 9. Deployable Tables

| Table | PK | Description |
|---|---|---|
| `deployable_state` | `entity_id: u64` | Deployable item instance (campfire, sign, etc.) |
| `trade_order_state` | `entity_id: u64` | Trade orders on market deployables |

---

## 10. Communication Tables

| Table | PK | Description |
|---|---|---|
| `chat_message_state` | `entity_id: u64` | Chat messages (with timestamps, for cleanup) |
| `crumb_trail_state` | `entity_id: u64` | Player movement trail markers |
| `storage_log_state` | `entity_id: u64` | Storage container access log |
| `alert_state` | `entity_id: u64` | Player alert notifications |

---

## 11. Inter-Module Communication Tables

| Table | PK | Shared | Description |
|---|---|---|---|
| `inter_module_message_v4` | Auto | No | Outbound messages to other modules |
| `inter_module_message_counter` | `module_id` | No | Deduplication counter per sender |

### Key Message Types (MessageContentsV4)

The `MessageContentsV4` enum defines all inter-module message types:

| Variant | Direction | Description |
|---|---|---|
| `TableUpdate` | Both | Shared table replication (auto-generated) |
| `TransferPlayerRequest` | Region->Region | Full player state transfer (~40 sub-tables) |
| `TransferPlayerHousingRequest` | Region->Region | Housing portal transfer |
| `PlayerCreateRequest` | Global->Region | Create player in region |
| `UserUpdateRegionRequest` | Region->Global | Update player's active region |
| `OnPlayerNameSetRequest` | Region->Global | Notify name change |
| `ClaimCreateEmpireSettlementState` | Region->Global | Create empire settlement from claim |
| `EmpireCreateBuilding` | Region->Global | Register empire building |
| `DeleteEmpire` | Global->Region | Dissolve empire |
| `EmpireStartSiege` | Region->Global | Initiate siege |
| `SignPlayerOut` | Global->Region | Force sign-out |
| `AdminBroadcastMessage` | Global->Region | Broadcast admin message |
| `GrantHubItem` | Global->Region | Grant premium item |
| `ReplaceIdentity` | Global->Region | Account identity migration |

---

## 12. Static Data Tables (Desc Tables)

Static data tables define immutable game content. They are loaded via the staged data pipeline. The latest version is `StaticDataUploadV3`.

### Game Parameters

| Table | Description |
|---|---|
| `ParametersDesc` | Global game parameters (tick rates, distances, limits) |
| `PrivateParametersDesc` | Server-only parameters (not sent to client) |
| `CharacterStatDesc` | Character stat definitions |

### Items and Equipment

| Table | Description |
|---|---|
| `ItemDesc` | Item definitions (name, description, stack size, category) |
| `WeaponDesc` | Weapon stats (damage, range, speed) |
| `WeaponTypeDesc` | Weapon type categories |
| `ToolDesc` | Tool stats (efficiency, durability) |
| `ToolTypeDesc` | Tool type categories |
| `EquipmentDesc` | Equipment definitions (armor, accessories) |
| `ClothingDesc` | Cosmetic clothing |
| `FoodDesc` | Food items (satiation, buffs) |
| `TeleportItemDesc` | Teleportation items |
| `CargoDesc` | Cargo type definitions |
| `ItemListDesc` | Item list groups (for loot tables, recipes) |

### Recipes and Crafting

| Table | Description |
|---|---|
| `CraftingRecipeDesc` | Crafting recipes (inputs, outputs, station, skill) |
| `ConstructionRecipeDesc` | Building construction recipes |
| `DeconstructionRecipeDesc` | Building demolition recipes |
| `ExtractionRecipeDesc` | Resource extraction recipes |
| `ResourceGrowthRecipeDesc` | Crop/plant growth recipes |
| `ResourcePlacementRecipeDesc` | Resource placement (farming) recipes |
| `ItemConversionRecipeDesc` | Item transformation recipes |
| `TerraformRecipeDesc` | Terrain modification recipes |
| `PillarShapingDesc` | Pillar shaping recipes |

### Buildings and Structures

| Table | Description |
|---|---|
| `BuildingDesc` | Building definitions (size, category, HP, cost) |
| `BuildingTypeDesc` | Building type categories |
| `BuildingClaimDesc` | Building-to-claim associations |
| `BuildingRepairsDesc` | Building repair recipes |
| `BuildingSpawnDesc` | Building spawn points (for NPCs/enemies) |
| `BuildingPortalDesc` | Building portal definitions |
| `InteriorPortalConnectionsDesc` | Interior portal routing |
| `InteriorNetworkDesc` | Building interior network topology |
| `InteriorInstanceDesc` | Interior instance definitions |
| `InteriorEnvironmentDesc` | Interior environment settings |
| `InteriorSpawnDesc` | Interior NPC/enemy spawn points |
| `InteriorShapeDesc` | Interior room shapes |
| `WallDesc` | Wall type definitions |
| `GateDesc` | Gate type definitions |
| `ElevatorDesc` | Elevator definitions |
| `PavingTileDesc` | Paving tile types |

### World and Environment

| Table | Description |
|---|---|
| `BiomeDesc` | Biome definitions (terrain, resources, enemies) |
| `ResourceDesc` | Resource deposit types |
| `ResourceClumpDesc` | Resource cluster patterns |
| `PathfindingDesc` | Pathfinding cost definitions |
| `EnvironmentDebuffDesc` | Environmental hazard effects |
| `DistantVisibleEntityDesc` | LOD/distant entity rendering rules |

### Combat and NPCs

| Table | Description |
|---|---|
| `EnemyDesc` | Enemy type definitions (stats, loot, AI) |
| `EnemyAiParamsDesc` | Enemy AI behavior parameters |
| `NpcDesc` | NPC definitions (dialogue, trades, quests) |
| `CombatActionDescV2` | Combat ability definitions |
| `CombatActionMultiHitDesc` | Multi-hit combat action definitions |
| `TargetingMatrixDesc` | Targeting rules (friendly fire, AoE) |
| `LootTableDesc` | Loot table probabilities |
| `LootChestDesc` | Loot chest tier definitions |
| `LootRarityDesc` | Loot rarity tiers |
| `ChestRarityDesc` | Chest rarity tiers |

### Player Progression

| Table | Description |
|---|---|
| `SkillDesc` | Skill definitions (XP curves, unlocks) |
| `SecondaryKnowledgeDesc` | Secondary knowledge category definitions |
| `KnowledgeScrollDesc` | Knowledge scroll items |
| `KnowledgeScrollTypeDesc` | Knowledge scroll type categories |
| `KnowledgeStatModifierDesc` | Stat modifiers from knowledge |
| `AchievementDesc` | Achievement definitions |
| `PlayerActionDesc` | Player action definitions |
| `OnboardingRewardDesc` | Tutorial/onboarding rewards |
| `CollectibleDesc` | Collectible item definitions |

### Buffs and Effects

| Table | Description |
|---|---|
| `BuffDesc` | Buff definitions (duration, effects) |
| `BuffTypeDesc` | Buff type categories |
| `AlertDesc` | Alert notification types |

### Empire and Social

| Table | Description |
|---|---|
| `EmpireRankDesc` | Empire rank definitions and permissions |
| `EmpireSuppliesDesc` | Empire supply node definitions |
| `EmpireNotificationDesc` | Empire notification types |
| `EmpireTerritoryDesc` | Territory influence definitions |
| `EmpireColorDesc` | Available empire colors |
| `EmpireIconDesc` | Available empire icons |
| `EmoteDesc` | Emote animations |
| `ClaimTileCost` | Claim tile expansion costs |
| `ClaimTechDesc` | Claim technology tree |

### Deployables and Travel

| Table | Description |
|---|---|
| `DeployableDesc` | Deployable item definitions |
| `TravelerTaskDesc` | NPC traveler task definitions |
| `TravelerTradeOrderDesc` | NPC trade order definitions |
| `PlayerHousingDesc` | Player housing type definitions |
| `HexiteExchangeEntryDesc` | Premium currency exchange rates |
| `ContributionLootDesc` | Contribution reward loot tables |
| `ReservedNameDesc` | Reserved player names |
| `ClimbRequirementDesc` | Terrain climbing requirements |

---

## 13. Entity ID System

Entity IDs are `u64` values with the region index encoded in the upper 8 bits:

```
Bits:  [63..56] [55..0]
       region   entity_counter
```

This ensures entity IDs are globally unique across regions without coordination. The `Globals.entity_pk_counter` provides the lower 56 bits, and `Globals.region_index` provides the upper 8 bits.

Entity creation: `game_state::create_entity_id(ctx)` atomically increments the counter and applies the region mask.

Entity deletion: The auto-generated `delete_entity(ctx, entity_id)` function (from `build.rs`) cascades deletions across all tables annotated with `#[delete]` that have a matching `entity_id` field.

---

## 14. Coordinate Types

The system uses multiple coordinate types at different spatial granularities:

| Rust Type | Message Type | Granularity | Usage |
|---|---|---|---|
| `OffsetCoordinatesFloat` | `FloatHexTileMessage` | Sub-tile | Player position, smooth movement |
| `OffsetCoordinatesSmall` | `SmallHexTileMessage` | Single tile | Building placement, resource nodes |
| `OffsetCoordinatesLarge` | `LargeHexTileMessage` | Chunk-scale | Spatial partitioning |
| `ChunkCoordinates` | `ChunkCoordinatesMessage` | Chunk | Data streaming, terrain loading |
| `RegionCoordinates` | N/A | Region | Cross-region addressing |

All coordinate types include `x: i32`, `z: i32`, and `dimension: u32` fields.
