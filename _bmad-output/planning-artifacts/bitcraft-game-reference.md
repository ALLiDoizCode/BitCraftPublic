# BitCraft Game Reference

**Generated:** 2026-03-15
**Source:** `BitCraftServer/packages/game/src/` (Apache 2.0 fork, read-only analysis)
**Purpose:** Authoritative reference for Stories 5.2-5.8, skill file construction, and `client.publish()` call validation

---

## Overview

### Server Architecture Summary

The BitCraft game server is a SpacetimeDB module (compiled to WASM) that implements a multiplayer crafting/exploration MMO. The server is organized as a Rust crate with the following key directories:

```
BitCraftServer/packages/game/src/
  lib.rs                    # Module entry point, world generation reducers, agent lifecycle
  import_reducers.rs        # Auto-generated import/stage reducer declarations
  i18n.rs                   # Internationalization strings
  agents/                   # 21 server-side scheduled agents (background game loops)
  game/
    handlers/               # Player-callable and server-callable reducers (~398 game reducers)
      admin/                # 44 admin/GM reducers
      buildings/            # 10 building management reducers
      cheats/               # 41 cheat/debug reducers
      claim/                # 22 claim (land ownership) reducers
      dev/                  # 3 dev-only reducers
      empires/              # 9 empire system reducers
      inventory/            # 10 inventory management reducers
      migration/            # 9 data migration reducers
      player/               # ~70 player action reducers (movement, gathering, combat, etc.)
      player_craft/         # 14 crafting reducers
      player_inventory/     # 7 equipment/item use reducers
      player_trade/         # 13 trading reducers (P2P + barter stall)
      player_vault/         # 11 deployable/collectible management reducers
      queue/                # 4 player queue/grace period reducers
      rentals/              # 12 rental system reducers
      resource/             # 3 resource respawn reducers
      server/               # 14 server-internal reducers
      stats/                # 2 stats logging reducers
      world/                # 3 world generation reducers
      attack.rs             # 5 combat/attack reducers
      authentication.rs     # Authentication helpers (not a reducer)
      target_update.rs      # 1 targeting reducer
    entities/               # 82 entity/state table definitions
    static_data/            # 9 static data table definition files
    autogen/                # Auto-generated code (148 import_* reducers, 88 stage_* reducers)
    coordinates/            # Hex coordinate system (SmallHexTile, LargeHexTile, FloatHexTile)
    game_state/             # Game state management (actor_id lookup, unix time helpers)
    reducer_helpers/        # Shared reducer helper functions
    discovery/              # Knowledge/discovery system
    generic/                # Generic game utilities
    unity_helpers/          # Unity client compatibility
    world_gen/              # World generation algorithms
  inter_module/             # Cross-module messaging
  macros/                   # Rust macros
  messages/                 # SpacetimeDB message types (action requests, components, etc.)
  table_caches/             # Table caching utilities
  utils/                    # Version and utility reducers
```

### Module Structure

The module contains approximately **669 reducers** total, broken down as:

| Category | Count | Description |
|----------|-------|-------------|
| Player-Facing Game Reducers | ~180 | Reducers callable by game clients (movement, crafting, trading, etc.) |
| Server-Internal Reducers | ~30 | Timer-based, server-to-server reducers (despawn, teleport, etc.) |
| Agent Loop Reducers | ~21 | Scheduled background tasks (regen, decay, AI, day/night) |
| Admin/GM Reducers | ~44 | Game master tools and admin operations |
| Cheat/Debug Reducers | ~41 | Developer debug commands |
| Migration Reducers | ~9 | One-time data migration reducers |
| Import Reducers | ~176 | Auto-generated state/data import reducers (`import_*`) |
| Stage Reducers | ~88 | Auto-generated static data staging reducers (`stage_*`) |
| Data Management | ~5 | `clear_staged_static_data`, `commit_staged_static_data`, `load_config`, etc. |
| World Generation | ~7 | `generate_world`, `generate_dev_island`, `start_generating_world`, etc. |
| Other Utility | ~68 | Quest, onboarding, housing, rental, claim tech, etc. |

### Identity Model

**SpacetimeDB Identity:** All reducers receive a `ctx: &ReducerContext` parameter. The caller's identity is accessed via `ctx.sender`, which is a SpacetimeDB `Identity` type (256-bit hash).

**Player Resolution:** The function `game_state::actor_id(ctx, must_be_signed_in)` looks up `ctx.sender` in the `user_state` table to find the player's `entity_id` (a `u64`). This is the primary mechanism by which reducers know which player is acting.

**No explicit identity parameter:** Unmodified BitCraft reducers do NOT accept an identity string as a parameter. They rely entirely on `ctx.sender` from the SpacetimeDB framework.

---

## Reducer Catalog

### Movement System

Reducers for player and entity movement, climbing, teleportation, and elevator use.

**Typical invocation sequence:** `sign_in` -> `player_move` (repeated) -> `player_climb` -> `player_teleport_home` / `player_teleport_waystone` -> `sign_out`

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `player_move` | `(ctx, request: PlayerMoveRequest) -> Result<(), String>` | Primary movement. Request: `{timestamp: u64, destination: Option<OffsetCoordinatesFloat>, origin: Option<OffsetCoordinatesFloat>, duration: f32, move_type: i32, running: bool}` |
| `player_climb` | `(ctx, request: PlayerClimbRequest) -> Result<(), String>` | Climb action. Request: `{destination: OffsetCoordinatesFloat, origin: OffsetCoordinatesFloat, timestamp: u64, climb_type: i32}` |
| `player_climb_start` | `(ctx, request: PlayerClimbRequest) -> Result<(), String>` | Start-phase of climb (progressive action pattern) |
| `player_teleport_home` | `(ctx, _request: PlayerTeleportHomeRequest) -> Result<(), String>` | Teleport to home location. Request: `{dummy: i32}` |
| `player_teleport_home_start` | `(ctx, request: PlayerTeleportHomeRequest) -> Result<(), String>` | Start-phase of home teleport |
| `player_teleport_waystone` | `(ctx, request: PlayerTeleportWaystoneRequest) -> Result<(), String>` | Waystone teleport. Request: `{entity_id_from: u64, entity_id_to: u64}` |
| `player_teleport_waystone_start` | `(ctx, request: PlayerTeleportWaystoneRequest) -> Result<(), String>` | Start-phase of waystone teleport |
| `player_use_elevator` | `(ctx, platform_entity_id: u64) -> Result<(), String>` | Use building elevator |
| `player_region_crossover` | `(ctx) -> Result<(), String>` | Region boundary crossing |
| `deployable_move` | `(ctx, request: PlayerDeployableMoveRequest) -> Result<(), String>` | Move a deployable. Request: `{deployable_entity_id: u64, timestamp: u64, destination/origin: Option<OffsetCoordinatesFloat>, duration: f32}` |
| `deployable_follow` | `(ctx, request: PlayerDeployableMoveRequest) -> Result<(), String>` | Deployable follow mode |
| `deployable_mount` | `(ctx, request: PlayerDeployableMountRequest) -> Result<(), String>` | Mount a deployable (e.g., horse). Request: `{deployable_entity_id: u64}` |
| `deployable_dismount` | `(ctx, request: PlayerDeployableDismountRequest) -> Result<(), String>` | Dismount from deployable |
| `emote` | `(ctx, request: PlayerEmoteRequest) -> Result<(), String>` | Play emote. Request: `{emote_id: i32, face: Option<OffsetCoordinatesSmallMessage>}` |
| `emote_start` | `(ctx, request: PlayerEmoteRequest) -> Result<(), String>` | Start-phase of emote |
| `portal_enter` | `(ctx, request: PlayerPortalEnterRequest) -> Result<(), String>` | Enter a portal. Request: `{portal_entity_id: u64}` |

### Gathering System

Reducers for resource extraction (mining, foraging, harvesting) and prospecting.

**Typical invocation sequence:** `player_move` (to resource) -> `extract_start` -> `extract` -> (repeat for multi-hit resources)

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `extract` | `(ctx, request: PlayerExtractRequest) -> Result<(), String>` | Complete extraction. Request: `{recipe_id: i32, target_entity_id: u64, timestamp: u64, clear_from_claim: bool}` |
| `extract_start` | `(ctx, request: PlayerExtractRequest) -> Result<(), String>` | Start-phase of extraction (progressive action) |
| `prospect` | `(ctx, prospecting_id: i32, timestamp: u64) -> Result<(), String>` | Prospecting action |
| `prospect_start` | `(ctx, prospecting_id: i32, timestamp: u64) -> Result<(), String>` | Start-phase of prospecting |

### Crafting System

Reducers for active crafting, passive (background) crafting, and item conversion.

**Typical invocation sequence:** `player_move` (to building) -> `craft_initiate_start` -> `craft_initiate` -> `craft_continue_start` -> `craft_continue` (repeat) -> `craft_collect`

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `craft_initiate_start` | `(ctx, request: PlayerCraftInitiateRequest) -> Result<(), String>` | Start new craft. Request: `{recipe_id: i32, building_entity_id: u64, count: i32, timestamp: u64, is_public: bool}` |
| `craft_initiate` | `(ctx, request: PlayerCraftInitiateRequest) -> Result<(), String>` | Complete initiation phase |
| `craft_continue_start` | `(ctx, request: PlayerCraftContinueRequest) -> Result<(), String>` | Continue crafting. Request: `{progressive_action_entity_id: u64, timestamp: u64}` |
| `craft_continue` | `(ctx, request: PlayerCraftContinueRequest) -> Result<(), String>` | Complete continuation phase |
| `craft_collect` | `(ctx, request: PlayerCraftCollectRequest) -> Result<(), String>` | Collect finished items. Request: `{pocket_id: u64, recipe_id: i32}` |
| `craft_collect_all` | `(ctx, request: PlayerCraftCollectAllRequest) -> Result<(), String>` | Collect all finished items from building. Request: `{building_entity_id: u64}` |
| `craft_cancel` | `(ctx, request: PlayerCraftCancelRequest) -> Result<(), String>` | Cancel in-progress craft. Request: `{pocket_id: u64}` |
| `craft_set_public` | `(ctx, progressive_action_entity_id: u64, is_public: bool) -> Result<(), String>` | Toggle public craft access |
| `passive_craft_queue` | `(ctx, request: PlayerPassiveCraftQueueRequest) -> Result<(), String>` | Queue passive craft. Request: `{recipe_id: i32, building_entity_id: u64}` |
| `passive_craft_collect` | `(ctx, passive_craft_entity_id: u64) -> Result<(), String>` | Collect from passive craft |
| `passive_craft_collect_all` | `(ctx, building_entity_id: u64) -> Result<(), String>` | Collect all from building passive crafts |
| `passive_craft_cancel` | `(ctx, passive_craft_entity_id: u64) -> Result<(), String>` | Cancel passive craft |
| `item_convert` | `(ctx, request: PlayerItemConvertRequest) -> Result<(), String>` | Convert items. Request: `{conversion_recipe_id: u32, location_context: u32, count: u32, timestamp: u64}` |
| `item_convert_start` | `(ctx, request: PlayerItemConvertRequest) -> Result<(), String>` | Start item conversion |

### Combat System

Reducers for attacking, targeting, abilities, dueling, and death/respawn.

**Typical invocation sequence:** `target_update` -> `attack_start` -> `attack` -> (repeat) -> (server triggers `player_death_start` if HP reaches 0) -> `player_respawn`

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `attack_start` | `(ctx, request: EntityAttackRequest) -> Result<(), String>` | Start attack. Request: `{attacker_entity_id: u64, defender_entity_id: u64, combat_action_id: i32, attacker_type: EntityType, defender_type: EntityType}` |
| `attack` | `(ctx, request: EntityAttackRequest) -> Result<(), String>` | Execute attack |
| `target_update` | `(ctx, request: TargetUpdateRequest) -> Result<(), String>` | Update target. Request: `{owner_entity_id: u64, target_entity_id: u64, generate_aggro: bool}` |
| `player_respawn` | `(ctx, teleport_home: bool) -> Result<(), String>` | Respawn after death |
| `player_duel_initiate` | `(ctx, target_player_entity_id: u64) -> Result<(), String>` | Initiate player duel |
| `ability_custom_activate` | `(ctx, ability_custom_id: i32, target_entity_id: u64, timestamp: u64) -> Result<(), String>` | Activate custom ability |
| `ability_set` | `(ctx, action_bar_index: u8, local_ability_index: u8, ability: AbilityType) -> Result<(), String>` | Set ability on action bar |
| `ability_remove` | `(ctx, action_bar_index: u8, local_ability_index: u8) -> Result<(), String>` | Remove ability from action bar |
| `player_action_cancel` | `(ctx, client_cancel: bool) -> Result<(), String>` | Cancel current action |

### Building System

Reducers for building construction, deconstruction, repair, and project sites.

**Typical invocation sequence:** `project_site_place` -> `project_site_add_materials` -> `project_site_advance_project_start` -> `project_site_advance_project` (repeat) -> (building complete) -> `building_repair` / `building_deconstruct`

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `project_site_place` | `(ctx, request: PlayerProjectSitePlaceRequest) -> Result<(), String>` | Place construction project. Request: `{coordinates: OffsetCoordinatesSmallMessage, construction_recipe_id: i32, resource_placement_recipe_id: i32, facing_direction: i32}` |
| `project_site_add_materials` | `(ctx, request: PlayerProjectSiteAddMaterialsRequest) -> Result<(), String>` | Add materials to project. Request: `{owner_entity_id: u64, pockets: Vec<PocketKey>}` |
| `project_site_advance_project_start` | `(ctx, request: PlayerProjectSiteAdvanceProjectRequest) -> Result<(), String>` | Start advancing project. Request: `{owner_entity_id: u64, timestamp: u64}` |
| `project_site_advance_project` | `(ctx, request: PlayerProjectSiteAdvanceProjectRequest) -> Result<(), String>` | Complete advance phase |
| `project_site_cancel` | `(ctx, request: PlayerProjectSiteCancelRequest) -> Result<(), String>` | Cancel project. Request: `{owner_entity_id: u64}` |
| `building_deconstruct_start` | `(ctx, request: PlayerBuildingDeconstructRequest) -> Result<(), String>` | Start deconstruction. Request: `{building_entity_id: u64, timestamp: u64}` |
| `building_deconstruct` | `(ctx, request: PlayerBuildingDeconstructRequest) -> Result<(), String>` | Execute deconstruction |
| `building_repair_start` | `(ctx, request: PlayerBuildingRepairRequest) -> Result<(), String>` | Start repair. Request: `{building_entity_id: u64, timestamp: u64}` |
| `building_repair` | `(ctx, request: PlayerBuildingRepairRequest) -> Result<(), String>` | Execute repair |
| `building_move` | `(ctx, request: PlayerBuildingMoveRequest) -> Result<(), String>` | Move building. Request: `{building_entity_id: u64, new_coordinates: OffsetCoordinatesSmallMessage, facing_direction: i32}` |
| `building_set_nickname` | `(ctx, request: PlayerBuildingSetNicknameRequest) -> Result<(), String>` | Set building name. Request: `{building_entity_id: u64, nickname: String}` |
| `building_set_sign_text` | `(ctx, request: BuildingSetSignTextRequest) -> Result<(), String>` | Set sign text. Request: `{building_entity_id: u64, text: String}` |
| `paving_place_tile` | `(ctx, request: PlayerPavingPlaceTileRequest) -> Result<(), String>` | Place paving tile. Request: `{coordinates: OffsetCoordinatesSmallMessage, tile_type_id: i32, timestamp: u64}` |
| `paving_destroy_tile` | `(ctx, request: PlayerPavingDestroyTileRequest) -> Result<(), String>` | Destroy paving tile |
| `pillar_shaping_place_pillar` | `(ctx, request: PlayerPillarShapingPlaceRequest) -> Result<(), String>` | Place shaped pillar |
| `pillar_shaping_destroy` | `(ctx, request: PlayerPillarShapingDestroyRequest) -> Result<(), String>` | Destroy shaped pillar |
| `terraform_start` | `(ctx, request: PlayerTerraformRequest) -> Result<(), String>` | Start terraforming. Request: `{coordinates: OffsetCoordinatesLargeMessage, start_new: bool, timestamp: u64}` |
| `terraform` | `(ctx, request: PlayerTerraformRequest) -> Result<(), String>` | Execute terraform action |
| `terraform_set_final_target` | `(ctx, request: PlayerTerraformSetFinalTargetRequest) -> Result<(), String>` | Set terraform target height |
| `terraform_cancel` | `(ctx, request: PlayerTerraformCancelRequest) -> Result<(), String>` | Cancel terraforming |

### Trading System

Reducers for player-to-player trading, barter stalls, and market orders.

**Typical invocation sequence (P2P trade):** `trade_initiate_session` -> `trade_accept_session` -> `trade_add_item` (repeated) -> `trade_accept` -> (both players accept)

**Typical invocation sequence (Market):** `order_post_sell_order` / `order_post_buy_order` -> `order_collect`

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `trade_initiate_session` | `(ctx, request: PlayerTradeInitiateSessionRequest) -> Result<(), String>` | Start P2P trade. Request: `{acceptor_entity_id: u64}` |
| `trade_accept_session` | `(ctx, request: PlayerTradeAcceptSessionRequest) -> Result<(), String>` | Accept trade session. Request: `{session_entity_id: u64}` |
| `trade_decline_session` | `(ctx, request: PlayerTradeDeclineSessionRequest) -> Result<(), String>` | Decline trade session |
| `trade_add_item` | `(ctx, request: PlayerTradeAddItemRequest) -> Result<(), String>` | Add item to trade. Request: `{session_entity_id: u64, pocket_index: i32, inventory_pocket_index: i32, inventory_index: i32}` |
| `trade_remove_item` | `(ctx, request: PlayerTradeRemoveItemRequest) -> Result<(), String>` | Remove item from trade |
| `trade_swap_pockets` | `(ctx, request: PlayerTradeSwapPocketsRequest) -> Result<(), String>` | Swap trade pockets |
| `trade_accept` | `(ctx, request: PlayerTradeAcceptRequest) -> Result<(), String>` | Accept trade terms. Request: `{session_entity_id: u64}` |
| `trade_decline` | `(ctx, request: PlayerTradeDeclineRequest) -> Result<(), String>` | Decline trade |
| `order_post_sell_order` | `(ctx, request: PlayerPostOrderRequest) -> Result<(), String>` | Post market sell order. Request: `{building_entity_id: u64, item_id: i32, item_type: ItemType, max_unit_price: i32, quantity: i32, persist_order: bool, coins_spent: i32}` |
| `order_post_buy_order` | `(ctx, request: PlayerPostOrderRequest) -> Result<(), String>` | Post market buy order |
| `order_edit_sell_order` | `(ctx, request: PlayerEditOrderRequest) -> Result<(), String>` | Edit sell order |
| `order_edit_buy_order` | `(ctx, request: PlayerEditOrderRequest) -> Result<(), String>` | Edit buy order |
| `order_cancel` | `(ctx, request: PlayerOrderCancelRequest) -> Result<(), String>` | Cancel order. Request: `{building_entity_id: u64, auction_listing_entity_id: u64}` |
| `order_collect` | `(ctx, request: PlayerOrderCollectRequest) -> Result<(), String>` | Collect filled order |
| `closed_listing_collect` | `(ctx, request: PlayerClosedListingCollectRequest) -> Result<(), String>` | Collect closed listing |
| `barter_stall_order_create` | `(ctx, request: PlayerBarterStallOrderCreateRequest) -> Result<(), String>` | Create barter stall order. Request: `{shop_entity_id: u64, remaining_stock: i32, offer_items: Vec<ItemStack>, required_items: Vec<ItemStack>}` |
| `barter_stall_order_accept` | `(ctx, request: PlayerBarterStallOrderAccept) -> Result<(), String>` | Accept barter stall order |
| `barter_stall_order_delete` | `(ctx, request: PlayerBarterStallOrderDeleteRequest) -> Result<(), String>` | Delete barter stall order |

### Empire System

Reducers for empire/faction management, territory control, and siege warfare.

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `empire_claim_join` | `(ctx, building_entity_id: u64, empire_entity_id: u64) -> Result<(), String>` | Join claim to empire |
| `empire_collect_hexite_capsule` | `(ctx, request: EmpireCollectHexiteCapsuleRequest) -> Result<(), String>` | Collect hexite capsule |
| `empire_queue_supplies` | `(ctx, request: EmpireQueueSuppliesRequest) -> Result<(), String>` | Queue empire supplies |
| `empire_resupply_node` | `(ctx, request: EmpireResupplyNodeRequest) -> Result<(), String>` | Resupply empire node |
| `empire_resupply_node_start` | `(ctx, request: EmpireResupplyNodeRequest) -> Result<(), String>` | Start resupply |
| `empire_deploy_siege_engine` | `(ctx, request: EmpireStartSiegeRequest) -> Result<(), String>` | Deploy siege engine |
| `empire_deploy_siege_engine_start` | `(ctx, request: EmpireStartSiegeRequest) -> Result<(), String>` | Start siege deployment |
| `empire_add_siege_supplies` | `(ctx, request: EmpireAddSiegeSuppliesRequest) -> Result<(), String>` | Add supplies to siege |
| `empire_siege_depleted_watchtower` | `(ctx, request: EmpireStartSiegeRequest) -> Result<(), String>` | Handle depleted watchtower |

### Chat System

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `chat_post_message` | `(ctx, request: PlayerChatPostMessageRequest) -> Result<(), String>` | Post chat message. Request: `{text: String, channel_id: ChatChannel, target_id: u64, language_code: String}` |
| `report_chat_message` | `(ctx, request: ReportPlayerChatMessage) -> Result<(), String>` | Report a chat message |
| `report_player` | `(ctx, request: ReportPlayerMessage) -> Result<(), String>` | Report a player |
| `report_entity` | `(ctx, request: ReportEntityMessage) -> Result<(), String>` | Report an entity |

### Player Lifecycle

Reducers for sign in/out, character management, equipment, inventory, eating, sleeping, and settings.

**Typical invocation sequence (new session):** `player_queue_join` -> `sign_in` -> (gameplay) -> `sign_out`

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `sign_in` | `(ctx, _request: PlayerSignInRequest) -> Result<(), String>` | Sign in to game. Request: `{owner_entity_id: u64}`. Uses `ctx.sender` for identity. |
| `sign_out` | `(ctx)` | Sign out (no args beyond ctx). Note: void return (no `Result<(), String>`), unlike most reducers. |
| `player_queue_join` | `(ctx) -> Result<(), String>` | Join server queue |
| `player_queue_leave` | `(ctx) -> Result<(), String>` | Leave server queue |
| `player_respawn` | `(ctx, teleport_home: bool) -> Result<(), String>` | Respawn after death |
| `sleep` | `(ctx, _request: PlayerSleepRequest) -> Result<(), String>` | Sleep action. Request: `{dummy: i32}` |
| `eat` | `(ctx, request: PlayerEatRequest) -> Result<(), String>` | Eat food. Request: `{pocket_index: i32}` |
| `scroll_read` | `(ctx, request: PlayerScrollReadRequest) -> Result<(), String>` | Read a scroll. Request: `{pocket_index: i32}` |
| `set_home` | `(ctx, request: PlayerSetHomeRequest) -> Result<(), String>` | Set home location. Request: `{target_entity_id: u64}` |
| `equipment_add` | `(ctx, request: PlayerEquipmentAddRequest) -> Result<(), String>` | Equip item. Request: `{from_pocket: Option<PocketKey>}` |
| `equipment_remove` | `(ctx, request: PlayerEquipmentRemoveRequest) -> Result<(), String>` | Unequip item. Request: `{slot: i32, to_pocket: Option<PocketKey>}` |
| `item_drop` | `(ctx, request: PlayerItemDropRequest) -> Result<(), String>` | Drop item. Request: `{pocket: PocketKey}` |
| `item_pick_up` | `(ctx, request: PlayerDroppedInventoryPickUpRequest) -> Result<(), String>` | Pick up item |
| `item_use` | `(ctx, request: PlayerItemUseRequest) -> Result<(), String>` | Use item. Request: `{pocket_index: i32, arg_entity_id: u64}` |
| `item_use_start` | `(ctx, request: PlayerItemUseRequest) -> Result<(), String>` | Start item use (progressive) |
| `item_stack_move` | `(ctx, request: PlayerItemStackMoveRequest) -> Result<(), String>` | Move items between pockets. Request: `{from_pocket: PocketKey, to_pocket: PocketKey, quantity: i32}` |
| `item_stack_move_all` | `(ctx, request: PlayerItemStackMoveAllRequest) -> Result<(), String>` | Move all items between pockets |
| `item_stack_split` | `(ctx, request: PlayerItemStackSplitRequest) -> Result<(), String>` | Split item stack |
| `pocket_swap_contents` | `(ctx, request: PlayerPocketSwapContentsRequest) -> Result<(), String>` | Swap pocket contents |
| `inventory_sort` | `(ctx, target_entity_id: u64) -> Result<(), String>` | Sort inventory |
| `inventory_create_personal` | `(ctx, building_entity_id: u64) -> Result<(), String>` | Create personal inventory at building |
| `dropped_inventory_destroy` | `(ctx, dropped_inventory_entity_id: u64) -> Result<(), String>` | Destroy dropped inventory |
| `dropped_inventory_release` | `(ctx, dropped_inventory_entity_id: u64) -> Result<(), String>` | Release dropped inventory |
| `retrieve_lost_item` | `(ctx, request: PlayerRetrieveLostItemRequest) -> Result<(), String>` | Retrieve lost item |
| `player_settings_state_update` | `(ctx, player_settings_state: PlayerSettingsStateV2) -> Result<(), String>` | Update settings |
| `player_dismiss_alert` | `(ctx, request: PlayerDismissAlertRequest) -> Result<(), String>` | Dismiss alert |
| `player_set_default_deployable` | `(ctx, request: PlayerSetDefaultDeployableRequest) -> Result<(), String>` | Set default deployable |
| `synchronize_time` | `(_ctx, _client_time: f64) -> Result<(), String>` | Client time sync |
| `pause_play_timer` | `(ctx, request: PlayerPausePlayTimerRequest) -> Result<(), String>` | Pause/resume play timer |
| `discover_entities` | `(ctx, request: PlayerDiscoverEntitiesRequest) -> Result<(), String>` | Discover entities |
| `acquire_knowledge_from_entities` | `(ctx, request: PlayerAcquireKnowledgeFromEntitiesRequest) -> Result<(), String>` | Acquire knowledge |
| `collectible_activate` | `(ctx, request: PlayerCollectibleActivateRequest) -> Result<(), String>` | Activate collectible |
| `convert_collectible_to_deed` | `(ctx, request: PlayerConvertCollectibleToDeedRequest) -> Result<(), String>` | Convert collectible to deed |
| `convert_deed_to_collectible` | `(ctx, request: PlayerConvertDeedToCollectibleRequest) -> Result<(), String>` | Convert deed to collectible |
| `deployable_deploy` | `(ctx, request: DeployableDeployRequest) -> Result<(), String>` | Deploy collectible. Request: `{vault_index: i32, coord: OffsetCoordinatesSmallMessage, direction: i32}` |
| `deployable_deploy_start` | `(ctx, request: DeployableDeployRequest) -> Result<(), String>` | Start deployment |
| `deployable_store` | `(ctx, request: DeployableStoreRequest) -> Result<(), String>` | Store deployable. Request: `{deployable_entity_id: u64, remotely: bool}` |
| `deployable_store_start` | `(ctx, request: DeployableStoreRequest) -> Result<(), String>` | Start storing |
| `deployable_store_from_collectible_id` | `(ctx, collectible_id: i32) -> Result<(), String>` | Store by collectible ID |
| `deployable_toggle_auto_follow` | `(ctx, deployable_desc_id: i32) -> Result<(), String>` | Toggle auto-follow |
| `achievement_claim` | `(ctx, request: PlayerAchievementClaimRequest) -> Result<(), String>` | Claim achievement reward |
| `permission_edit` | `(ctx, request: PlayerPermissionEditRequest) -> Result<(), String>` | Edit permissions |

### Claim System (Land Ownership)

Reducers for claim management, membership, technology research, and treasury.

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `claim_take_ownership` | `(ctx, request: PlayerClaimTakeOwnershipRequest) -> Result<(), String>` | Take claim ownership. Request: `{claim_entity_id: u64}` |
| `claim_transfer_ownership` | `(ctx, request: PlayerClaimTransferOwnershipRequest) -> Result<(), String>` | Transfer ownership |
| `claim_add_member` | `(ctx, request: PlayerClaimAddMemberRequest) -> Result<(), String>` | Add member by name. Request: `{player_name: String, claim_entity_id: u64}` |
| `claim_remove_member` | `(ctx, request: PlayerClaimRemoveMemberRequest) -> Result<(), String>` | Remove member |
| `claim_set_member_permissions` | `(ctx, request: PlayerClaimSetMemberPermissionsRequest) -> Result<(), String>` | Set member permissions |
| `claim_leave` | `(ctx, request: PlayerClaimLeaveRequest) -> Result<(), String>` | Leave claim |
| `claim_add_tile` | `(ctx, request: PlayerClaimAddTileRequest) -> Result<(), String>` | Add territory tile |
| `claim_remove_tile` | `(ctx, request: PlayerClaimRemoveTileRequest) -> Result<(), String>` | Remove territory tile |
| `claim_rename` | `(ctx, request: PlayerClaimRenameRequest) -> Result<(), String>` | Rename claim |
| `claim_resupply` | `(ctx, request: ClaimResupplyRequest) -> Result<(), String>` | Resupply claim |
| `claim_resupply_start` | `(ctx, request: ClaimResupplyRequest) -> Result<(), String>` | Start resupply |
| `claim_tech_learn` | `(ctx, request: PlayerClaimTechLearnRequest) -> Result<(), String>` | Start tech research |
| `claim_tech_cancel` | `(ctx, request: PlayerClaimTechCancelRequest) -> Result<(), String>` | Cancel tech research |
| `claim_treasury_deposit` | `(ctx, request: PlayerClaimDepositToTreasuryRequest) -> Result<(), String>` | Deposit to treasury |
| `claim_withdraw_from_treasury` | `(ctx, request: PlayerClaimWithdrawFromTreasuryRequest) -> Result<(), String>` | Withdraw from treasury |
| `claim_add_recruitment` | `(ctx, request: PlayerClaimAddRecruitmentRequest) -> Result<(), String>` | Add recruitment listing |
| `claim_apply_for_recruitment` | `(ctx, request: PlayerClaimApplyForRecruitmentRequest) -> Result<(), String>` | Apply for recruitment |
| `claim_remove_recruitment` | `(ctx, request: PlayerClaimRemoveRecruitmentRequest) -> Result<(), String>` | Remove recruitment |
| `claim_set_protection_threshold` | `(ctx, building_entity_id: u64, hours: u32) -> Result<(), String>` | Set protection hours |
| `claim_set_purchase_supply_price` | `(ctx, request: ClaimSetPurchaseSupplyPriceRequest) -> Result<(), String>` | Set supply price |
| `claim_set_purchase_supply_threshold` | `(ctx, request: ClaimSetPurchaseSupplyThresholdRequest) -> Result<(), String>` | Set supply threshold |
| `claim_purchase_supplies_from_player` | `(ctx, request: ClaimPurchaseSuppliesFromPlayerRequest) -> Result<(), String>` | Purchase supplies from player |

### Administrative

Admin/GM reducers requiring elevated permissions. These check `has_role(ctx, &ctx.sender, Role::Gm)` before executing.

Selected key admin reducers (44 total, see source for complete list):

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `admin_sign_out` | `(ctx, identity: Identity) -> Result<(), String>` | Force sign out player |
| `admin_sign_out_string` | `(ctx, identity: String) -> Result<(), String>` | Force sign out by identity string |
| `admin_sign_out_all_region` | `(ctx) -> Result<(), String>` | Sign out all players in region |
| `admin_broadcast_msg_region` | `(ctx, title: String, message: String) -> Result<(), String>` | Broadcast message |
| `admin_restore_player_state` | `(ctx, ...) -> Result<(), String>` | Restore player state (multi-param) |
| `admin_grant_collectibles` | `(ctx, identity: String, collectibles: Vec<i32>) -> Result<(), String>` | Grant collectibles |
| `admin_create_building_spawns` | `(ctx, building_description_id: i32, commit: bool) -> Result<(), String>` | Create building spawns |

### Rental System

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `rent_add_listing` | `(ctx, request: RentAddListingRequest) -> Result<(), String>` | Add rental listing |
| `rent_add_tenant` | `(ctx, request: RentAddTenantRequest) -> Result<(), String>` | Add tenant |
| `rent_remove_tenant` | `(ctx, request: RentRemoveTenantRequest) -> Result<(), String>` | Remove tenant |
| `rent_set_daily_rate` | `(ctx, request: RentSetDailyRateRequest) -> Result<(), String>` | Set daily rate |
| `rent_deposit_coins` | `(ctx, request: RentDepositCoinsRequest) -> Result<(), String>` | Deposit coins |
| `rent_evict` | `(ctx, request: RentEvictRequest) -> Result<(), String>` | Evict tenant |
| `rent_terminate` | `(ctx, request: RentTerminateRequest) -> Result<(), String>` | Terminate rental |
| `rent_purchase` | `(ctx, request: RentPurchaseRequest) -> Result<(), String>` | Purchase rental |
| `rent_unlist` | `(ctx, request: RentUnlistRequest) -> Result<(), String>` | Unlist rental |

### Housing System

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `player_housing_enter` | `(ctx, request: PlayerHousingEnterRequest) -> Result<(), String>` | Enter house |
| `player_housing_request_access` | `(ctx, request: PlayerHousingRequestAccessRequest) -> Result<(), String>` | Request access |
| `player_housing_evict_player` | `(ctx, request: PlayerHousingEvictPlayerRequest) -> Result<(), String>` | Evict player from house |
| `player_housing_change_entrance` | `(ctx, building_entity_id: u64, expected_time_cost: i32) -> Result<(), String>` | Change entrance |
| `player_housing_update` | `(ctx, building_entity_id: u64) -> Result<(), String>` | Update housing |

### Quest/Onboarding System

| Reducer | Signature | Notes |
|---------|-----------|-------|
| `start_quest_chain` | `(ctx, id: i32) -> Result<(), String>` | Start a quest chain |
| `set_quest_chain_active` | `(ctx, id: i32) -> Result<(), String>` | Set active quest chain |
| `advance_quest_stage` | `(ctx, chain_id: i32) -> Result<(), String>` | Advance quest stage |
| `complete_quest_chain` | `(ctx, id: i32) -> Result<(), String>` | Complete quest chain |
| `request_stage_reward` | `(ctx, reward_id: i32) -> Result<(), String>` | Claim quest reward |
| `player_complete_task` | `(ctx, request: PlayerCompleteTaskRequest) -> Result<(), String>` | Complete NPC task |
| `start_onboarding_quest` | `(ctx, id: u16) -> Result<(), String>` | Start onboarding |
| `complete_onboarding_quest` | `(ctx, id: u16) -> Result<(), String>` | Complete onboarding quest |
| `complete_onboarding_state` | `(ctx, id: u16) -> Result<(), String>` | Complete onboarding state |
| `skip_onboarding` | `(ctx) -> Result<(), String>` | Skip onboarding |
| `reset_onboarding` | `(ctx) -> Result<(), String>` | Reset onboarding |

### Server-Side Agents (Background Tasks)

These are NOT player-callable. They run on scheduled timers.

| Agent | Timer Type | Purpose |
|-------|-----------|---------|
| `auto_logout_loop` | `AutoLogoutLoopTimer` | Auto-logout inactive players |
| `building_decay_agent_loop` | `BuildingDecayLoopTimer` | Building decay over time |
| `chat_cleanup_agent_loop` | `ChatCleanupTimer` | Clean up old chat messages |
| `crumb_tail_cleanup_agent_loop` | `CrumbTrailCleanupTimer` | Clean up exploration crumb trails |
| `day_night_agent_loop` | `DayNightLoopTimer` | Day/night cycle progression |
| `duel_agent_timer_loop` | `DuelAgentTimer` | Duel timeout management |
| `enemy_regen_agent_loop` | `EnemyRegenLoopTimer` | Enemy health regeneration |
| `environment_debuff_agent_loop` | `EnvironmentDebuffLoopTimer` | Environmental debuff processing |
| `growth_agent_loop` | `GrowthLoopTimer` | Resource/crop growth |
| `npc_ai_agent_loop` | `NpcAiLoopTimer` | NPC artificial intelligence |
| `player_housing_income_agent_loop` | `PlayerHousingIncomeLoopTimer` | Housing income processing |
| `player_regen_agent_loop` | `PlayerRegenLoopTimer` | Player health/stamina regeneration |
| `region_popuplation_agent_loop` | `RegionPopulationLoopTimer` | Region population tracking |
| `rent_collector_agent_loop` | `RentCollectorLoopTimer` | Collect rent payments |
| `resources_regen` | `ResourcesRegenLoopTimer` | Resource node respawning |
| `starving_agent_loop` | `StarvingLoopTimer` | Starvation damage processing |
| `storage_log_cleanup_loop` | `StorageLogCleanupLoopTimer` | Storage log cleanup |
| `teleportation_energy_regen_agent_loop` | `TeleportationEnergyRegenLoopTimer` | Teleportation energy regen |
| `trade_sessions_agent_loop` | `TradeSessionLoopTimer` | Trade session timeout |
| `traveler_task_agent_loop` | `TravelerTaskLoopTimer` | Traveler NPC task management |

### Data Loading (Import/Stage) Reducers

These reducers (~262 total) are used exclusively for loading static data and importing game state. They are called during server initialization, not during gameplay.

- **`import_*` reducers** (~176): Import records directly into tables. Pattern: `import_<table_name>(ctx, records: Vec<TableType>)`
- **`stage_*` reducers** (~88): Stage static data records for atomic commit. Pattern: `stage_<desc_name>(ctx, records: Vec<DescType>)`
- **`clear_staged_static_data`**: Clear all staged static data
- **`commit_staged_static_data`**: Atomically commit all staged static data

These are NOT relevant for gameplay skills or `client.publish()` calls.

---

## Identity Propagation

### SpacetimeDB Identity Model

SpacetimeDB assigns each connected client a unique `Identity` (256-bit hash). When a client calls a reducer via WebSocket, `ctx.sender` is automatically set to that client's `Identity`.

When a reducer is called via the **HTTP API** (as the BLS handler does), `ctx.sender` is set to the identity associated with the authentication token used in the `Authorization: Bearer <token>` header.

### How BitCraft Uses Identity

```rust
// game_state/mod.rs
pub fn actor_id(ctx: &ReducerContext, must_be_signed_in: bool) -> Result<u64, String> {
    match ctx.db.user_state().identity().find(&ctx.sender) {
        Some(user) => {
            if must_be_signed_in {
                ensure_signed_in(ctx, user.entity_id)?;
            }
            Ok(user.entity_id)
        }
        None => Err("Invalid sender".into()),
    }
}
```

Every player-facing reducer calls `game_state::actor_id(ctx, true/false)` to resolve the caller's `ctx.sender` identity into a player `entity_id`. The `user_state` table maps SpacetimeDB `Identity` values to player entity IDs.

### BLS Handler Identity Propagation

The current BLS handler (`packages/bitcraft-bls/src/handler.ts`) does the following:

1. Receives a Nostr event via ILP packet
2. Extracts the verified Nostr pubkey from `ctx.pubkey` (64-char hex)
3. Parses `event.content` as `{reducer, args}`
4. **Prepends the pubkey as the first argument:** `[ctx.pubkey, ...args]`
5. Calls SpacetimeDB reducer via HTTP API: `POST /database/bitcraft/call/{reducer}` with `Authorization: Bearer <admin_token>`

### BLOCKER-1 Analysis: Identity Propagation Mismatch

**The Problem:**

The BLS handler prepends the Nostr pubkey as the first reducer argument (`[pubkey, ...args]`), but BitCraft reducers do NOT accept an identity parameter. They use `ctx.sender` exclusively.

When the BLS handler calls a reducer via HTTP with the admin token, `ctx.sender` will be the **admin identity** -- NOT the player's identity. Therefore:

1. `game_state::actor_id()` will look up the admin identity in `user_state`, which will either not find a player entity (returning "Invalid sender" error) or find the admin's entity (acting as the admin, not the intended player).
2. The prepended Nostr pubkey argument will cause a **type mismatch** error because the reducer expects its first real argument (e.g., a `PlayerMoveRequest` struct), not a string.

**Resolution Options:**

| Option | Description | Complexity | Recommended |
|--------|-------------|------------|-------------|
| **A: Modify BitCraft reducers** | Add `identity: String` as first parameter to every player-facing reducer, use it instead of `ctx.sender` | HIGH (modify ~180 reducers) | No |
| **B: Per-player SpacetimeDB identity** | Create a SpacetimeDB identity for each player, use their individual token when calling via HTTP | MEDIUM (requires identity management) | Possible |
| **C: Identity-aware proxy** | Modify the BLS handler to NOT prepend pubkey, instead use a different mechanism to convey player identity to SpacetimeDB | MEDIUM | Yes (preferred) |
| **D: Custom SpacetimeDB module** | Add a wrapper reducer that accepts `(identity: String, reducer: String, args: Vec<u8>)` and dispatches internally after setting the appropriate context | MEDIUM-HIGH | Possible |

**Recommendation for Stories 5.4-5.8:**

For validation stories, the simplest approach is to call reducers directly via the SpacetimeDB WebSocket client (as a connected player) rather than through the BLS handler. This bypasses the identity propagation issue entirely and validates the reducer behavior itself. The BLS identity propagation issue should be resolved as a separate engineering task (likely requiring either Option B or Option C).

**Key Insight:** The architecture's BLOCKER-1 ("BitCraft reducers WILL be modified to accept `identity: String` as first parameter") is architecturally expensive and potentially unnecessary. The SpacetimeDB HTTP call API already identifies the caller via the authentication token. The more practical approach is to manage per-player SpacetimeDB tokens or to modify the BLS handler to use a different identity mechanism.

---

## Table-Reducer Relationships

### Key Entity Tables

| Table | PK Field | Type | Description |
|-------|----------|------|-------------|
| `user_state` | `identity: Identity` | Entity | Maps SpacetimeDB Identity to player entity_id |
| `player_state` | `entity_id: u64` | Entity | Player profile (name, signed_in, time_played, etc.) |
| `mobile_entity_state` | `entity_id: u64` | Entity | Position, movement state (location_x/z, destination_x/z, is_running) |
| `character_stats_state` | `entity_id: u64` | Entity | Player stats (movement speed, crafting speed, etc.) |
| `health_state` | `entity_id: u64` | Entity | Health points |
| `stamina_state` | `entity_id: u64` | Entity | Stamina for sprinting/actions |
| `inventory_state` | `entity_id: u64` | Entity | Player inventory (pockets with items) |
| `equipment_state` | `entity_id: u64` | Entity | Equipped items |
| `experience_state` | `entity_id: u64` | Entity | Skill experience and levels |
| `building_state` | `entity_id: u64` | Entity | Building instances |
| `resource_state` | `entity_id: u64` | Entity | Resource node instances |
| `resource_health_state` | `entity_id: u64` | Entity | Resource node health |
| `trade_order_state` | `entity_id: u64` | Entity | Market trade orders |
| `trade_session_state` | `entity_id: u64` | Entity | Active P2P trade sessions |
| `claim_state` | `entity_id: u64` | Entity | Land claims |
| `progressive_action_state` | `entity_id: u64` | Entity | In-progress crafting actions |
| `deployable_state` | `entity_id: u64` | Entity | Deployed collectibles/mounts |
| `vault_state` | `entity_id: u64` | Entity | Player collectible vault |
| `signed_in_player_state` | `entity_id: u64` | Entity | Currently signed-in players |

### Key Static Data Tables

| Table | PK Field | Type | Description |
|-------|----------|------|-------------|
| `item_desc` | `id: i32` | Static | Item definitions (name, type, properties) |
| `crafting_recipe_desc` | `id: i32` | Static | Crafting recipe definitions |
| `extraction_recipe_desc` | `id: i32` | Static | Extraction/gathering recipe definitions |
| `building_desc` | `id: i32` | Static | Building type definitions |
| `resource_desc` | `id: i32` | Static | Resource type definitions |
| `food_desc` | `item_id: i32` | Static | Food item effects |
| `tool_desc` | `id: i32` | Static | Tool definitions |
| `equipment_desc` | `id: i32` | Static | Equipment definitions |
| `deployable_desc_v4` | `id: i32` | Static | Deployable definitions |
| `quest_chain_desc` | `id: i32` | Static | Quest chain definitions |
| `skill_desc` | `id: i32` | Static | Skill tree definitions |

### Foreign Key Relationships (Reducer Arguments to Tables)

| # | Reducer Argument | Source Reducer | References Table | FK Column |
|---|-----------------|---------------|-----------------|-----------|
| 1 | `request.recipe_id` | `extract`, `extract_start` | `extraction_recipe_desc` | `id` |
| 2 | `request.target_entity_id` | `extract`, `extract_start` | `resource_state` | `entity_id` |
| 3 | `request.recipe_id` | `craft_initiate`, `craft_initiate_start` | `crafting_recipe_desc` | `id` |
| 4 | `request.building_entity_id` | `craft_initiate`, `building_repair`, `building_deconstruct` | `building_state` | `entity_id` |
| 5 | `request.pocket_id` | `craft_collect`, `craft_cancel` | `progressive_action_state` | `entity_id` |
| 6 | `request.progressive_action_entity_id` | `craft_continue`, `craft_continue_start` | `progressive_action_state` | `entity_id` |
| 7 | `request.session_entity_id` | `trade_accept_session`, `trade_add_item`, `trade_accept` | `trade_session_state` | `entity_id` |
| 8 | `request.acceptor_entity_id` | `trade_initiate_session` | `player_state` | `entity_id` |
| 9 | `request.claim_entity_id` | `claim_take_ownership`, `claim_add_tile`, `claim_rename` | `claim_state` | `entity_id` |
| 10 | `request.item_id` | `order_post_sell_order`, `order_post_buy_order` | `item_desc` | `id` |
| 11 | `request.pocket_index` | `eat`, `scroll_read` | `inventory_state` | pocket array index |
| 12 | `request.deployable_entity_id` | `deployable_mount`, `deployable_store`, `deployable_move` | `deployable_state` | `entity_id` |
| 13 | `request.building_entity_id` | `passive_craft_queue`, `inventory_create_personal` | `building_state` | `entity_id` |
| 14 | `request.portal_entity_id` | `portal_enter` | `portal_state` | `entity_id` |
| 15 | `request.alert_entity_id` | `player_dismiss_alert` | `alert_state` | `entity_id` |
| 16 | `request.construction_recipe_id` | `project_site_place` | `construction_recipe_desc` | `id` |
| 17 | `request.achievement_id` | `achievement_claim` | `achievement_desc` | `id` |
| 18 | `request.rent_entity_id` | `rent_set_daily_rate`, `rent_evict`, `rent_add_tenant` | `rent_state` | `entity_id` |

---

## Known Constraints

### Reducer Limitations

1. **Progressive Action Pattern:** Many actions use a two-phase pattern (`action_start` + `action`). The `_start` phase validates preconditions and schedules the action; the second call executes it. Both must be called in sequence with appropriate timing.

2. **Complex Request Types:** Most reducers accept SpacetimeDB `#[derive(SpacetimeType)]` structs, not simple primitives. The HTTP API accepts these as JSON arrays of field values in declaration order. Understanding the exact struct layout is critical for constructing valid calls.

3. **Coordinate System:** BitCraft uses a hex tile coordinate system with multiple granularities: `SmallHexTile`, `LargeHexTile`, `FloatHexTile`, `OffsetCoordinatesSmall`, `OffsetCoordinatesFloat`. Movement validation checks elevation differences, water depth, and terrain passability.

4. **Signed-In Requirement:** Most player-facing reducers call `game_state::actor_id(ctx, true)`, which requires the player to be signed in (`signed_in_player_state` table). The `sign_in` reducer must be called first.

5. **Stamina/Health Checks:** Actions like extraction and crafting check stamina and health state. Incapacitated players cannot perform most actions.

6. **Claim Permissions:** Building and resource interactions within claims check permission tables. Players need appropriate permissions (Usage, Build, etc.) to interact with claimed territory.

### Identity Model Limitations

1. **BLOCKER-1:** The BLS handler's identity propagation mechanism (prepending Nostr pubkey as first arg) is incompatible with unmodified BitCraft reducers. See Identity Propagation section for detailed analysis and recommendations.

2. **Admin Token Usage:** When calling reducers via HTTP with the SpacetimeDB admin token, all actions appear to come from the admin identity. There is no per-player identity delegation mechanism in the current architecture.

3. **No Nostr Integration:** The BitCraft server has no awareness of Nostr keys. The `user_state.identity` field is a SpacetimeDB `Identity`, not a Nostr public key.

### API Constraints

1. **HTTP Reducer Calls:** SpacetimeDB HTTP API format is `POST /database/{db}/call/{reducer}` with body `[arg1, arg2, ...]` as a JSON array. SpacetimeType structs are serialized as ordered arrays of their fields.

2. **No Reducer Return Values:** SpacetimeDB reducers can only return `Result<(), String>`. Success/failure is the only feedback. State changes must be observed through table subscriptions.

3. **Timer-Based Schedulers:** Server-side agents use `#[spacetimedb::reducer]` annotations with timer types. These are invoked by the scheduler, not by clients.

---

## Quick Reference

### Top Reducers for Stories 5.4-5.8

#### Story 5.4: Basic Action Round-Trip Validation

| Reducer | Purpose | Simplest Test |
|---------|---------|---------------|
| `synchronize_time` | Simplest reducer (no state changes) | Call with any f64, expect success |
| `sign_in` | Session establishment | Call with `{owner_entity_id: 0}` (if player exists) |
| `sign_out` | Session teardown | Call after sign_in |

#### Story 5.5: Player Lifecycle & Movement Validation

| Reducer | Purpose | Key Dependencies |
|---------|---------|-----------------|
| `player_queue_join` | Enter server queue | None (just ctx.sender must be valid user) |
| `sign_in` | Begin session | Must be in queue, must have `user_state` entry |
| `player_move` | Movement | Must be signed in, valid coordinates |
| `player_respawn` | Death recovery | Must be incapacitated |
| `sign_out` | End session | Must be signed in |

#### Story 5.6: Resource Gathering & Inventory Validation

| Reducer | Purpose | Key Dependencies |
|---------|---------|-----------------|
| `extract_start` | Begin gathering | Near resource, have tools/stamina |
| `extract` | Complete gathering | Active extraction action |
| `item_stack_move` | Manage inventory | Valid pocket indices |
| `eat` | Consume food | Food item in inventory |
| `equipment_add` | Equip item | Item in inventory |

#### Story 5.7: Multi-Step Crafting Loop Validation

| Reducer | Purpose | Key Dependencies |
|---------|---------|-----------------|
| `craft_initiate_start` | Begin crafting | Near building, have materials |
| `craft_initiate` | Complete initiation | Active craft action |
| `craft_continue_start` | Continue crafting | Ongoing progressive action |
| `craft_continue` | Complete continuation | Active craft action |
| `craft_collect` | Collect results | Completed progressive action |

#### Story 5.8: Error Scenarios & Graceful Degradation

| Scenario | Reducer | Expected Error |
|----------|---------|---------------|
| Not signed in | `player_move` | "Not signed in" |
| Invalid sender | Any player reducer | "Invalid sender" |
| No stamina | `extract_start` | "Not enough stamina!" |
| Too far from resource | `extract` | "You are too far." |
| Invalid recipe | `craft_initiate_start` | "Invalid recipe" |
| Building occupied | `craft_initiate_start` | "Every crafting slot... is busy" |
| Already signed in | `sign_in` | "Already signed in" |
| Incapacitated | `player_move` | Incapacitated check failure |

### Reducer -> Table Impact Matrix

| Reducer | Tables Read | Tables Written |
|---------|------------|----------------|
| `sign_in` | `user_state`, `player_state`, `signed_in_player_state`, `mobile_entity_state`, `inventory_state`, `active_buff_state` | `player_state`, `signed_in_player_state`, `inventory_state`, `active_buff_state`, `mobile_entity_state`, `player_action_state` |
| `player_move` | `player_state`, `mobile_entity_state`, `character_stats_state`, `stamina_state`, `terrain_chunk_state`, `paved_tile_state` | `mobile_entity_state`, `player_state`, `stamina_state`, `player_action_state`, `exploration_chunks_state` |
| `extract` | `resource_state`, `resource_health_state`, `character_stats_state`, `stamina_state`, `inventory_state`, `extraction_recipe_desc` | `resource_health_state`, `inventory_state`, `stamina_state`, `experience_state`, `extract_outcome_state` |
| `craft_initiate` | `crafting_recipe_desc`, `building_state`, `character_stats_state`, `inventory_state`, `progressive_action_state` | `progressive_action_state`, `inventory_state`, `experience_state`, `player_action_state` |
| `trade_accept` | `trade_session_state`, `inventory_state` | `trade_session_state`, `inventory_state` |

---

## Appendix: Reducer Naming Conventions

All reducer names follow these patterns:

- **snake_case**: All names use snake_case (e.g., `player_move`, `craft_initiate_start`)
- **Progressive action pattern**: `action_start` (validation/scheduling) + `action` (execution)
- **Admin prefix**: `admin_*` for GM-only reducers
- **Cheat prefix**: `cheat_*` for debug reducers
- **Import/Stage prefix**: `import_*` / `stage_*` for data loading
- **Agent suffix**: `*_agent_loop` for scheduled background tasks
- **Player prefix**: Many player actions use `player_*` prefix
- **Verb-first**: Most action reducers start with the verb (e.g., `eat`, `sleep`, `attack`, `extract`)
- **Underscore-prefixed parameters**: Parameters prefixed with `_` (e.g., `_request`, `_ctx`, `_client_time`) indicate the parameter is unused by the function body. This is a Rust convention to suppress unused-variable warnings. The parameter type is still significant for the API contract.

## Appendix: Progressive Action Pattern

Many game actions use a two-phase "start + complete" pattern:

```
1. Client calls: reducer_start(ctx, request)
   - Validates preconditions (permissions, distance, resources, stamina)
   - Creates a progressive_action_state entry with timing
   - Registers the player action type
   - Returns Ok(()) or Err("reason")

2. After delay, client calls: reducer(ctx, request)
   - Validates the action is still valid (timing, target still exists)
   - Executes the actual game logic (damage, item creation, etc.)
   - Updates player action state to success/complete
   - Returns Ok(()) or Err("reason")
```

Reducers using this pattern:
- `extract_start` / `extract`
- `craft_initiate_start` / `craft_initiate`
- `craft_continue_start` / `craft_continue`
- `building_deconstruct_start` / `building_deconstruct`
- `building_repair_start` / `building_repair`
- `paving_place_tile_start` / `paving_place_tile`
- `paving_destroy_tile_start` / `paving_destroy_tile`
- `pillar_shaping_place_pillar_start` / `pillar_shaping_place_pillar`
- `pillar_shaping_destroy_start` / `pillar_shaping_destroy`
- `terraform_start` / `terraform`
- `item_convert_start` / `item_convert`
- `item_use_start` / `item_use`
- `emote_start` / `emote`
- `player_climb_start` / `player_climb`
- `player_teleport_home_start` / `player_teleport_home`
- `player_teleport_waystone_start` / `player_teleport_waystone`
- `deployable_deploy_start` / `deployable_deploy`
- `deployable_store_start` / `deployable_store`
- `claim_resupply_start` / `claim_resupply`
- `empire_resupply_node_start` / `empire_resupply_node`
- `empire_deploy_siege_engine_start` / `empire_deploy_siege_engine`
- `project_site_advance_project_start` / `project_site_advance_project`
- `prospect_start` / `prospect`
- `ability_custom_activate_start` / `ability_custom_activate`
