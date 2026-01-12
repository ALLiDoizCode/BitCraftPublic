use crate::game::coordinates::SmallHexTile;
use crate::game::game_state::game_state_filters;
use crate::game::handlers::cheats::cheat_type::{can_run_cheat, CheatType};
use spacetimedb::ReducerContext;

use crate::messages::components::DroppedInventoryState;
use crate::messages::game_util::{ItemStack, ItemType};

#[spacetimedb::reducer]
pub fn cheat_drop_item_on_entity(
    ctx: &ReducerContext,
    entity_id: u64,
    item_id: i32,
    quantity: i32,
    is_cargo: bool,
    owner_entity_id: u64,
) -> Result<(), String> {
    if !can_run_cheat(ctx, &ctx.sender, CheatType::CheatItemStackGrant) {
        return Err("Unauthorized.".into());
    }

    let item_stack = ItemStack::new(ctx, item_id, if is_cargo { ItemType::Cargo } else { ItemType::Item }, quantity);
    let coordinates = game_state_filters::coordinates_any(ctx, entity_id);

    reduce(ctx, owner_entity_id, item_stack, coordinates);

    Ok(())
}

#[spacetimedb::reducer]
pub fn cheat_drop_item_on_tile(
    ctx: &ReducerContext,
    coord: SmallHexTile,
    item_id: i32,
    quantity: i32,
    is_cargo: bool,
    owner_entity_id: u64,
) -> Result<(), String> {
    if !can_run_cheat(ctx, &ctx.sender, CheatType::CheatItemStackGrant) {
        return Err("Unauthorized.".into());
    }

    let item_stack = ItemStack::new(ctx, item_id, if is_cargo { ItemType::Cargo } else { ItemType::Item }, quantity);

    reduce(ctx, owner_entity_id, item_stack, coord);

    Ok(())
}

pub fn reduce(ctx: &ReducerContext, owner_entity_id: u64, item_stack: ItemStack, coord: SmallHexTile) {
    DroppedInventoryState::update_from_items(ctx, owner_entity_id, coord, vec![item_stack], None);
}
