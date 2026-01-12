use spacetimedb::ReducerContext;

use crate::{
    game::coordinates::SmallHexTile,
    messages::game_util::{ItemStack, ItemType},
    DroppedInventoryState,
};

pub fn spawn_cargo(ctx: &ReducerContext, owner_entity_id: u64, coordinates: SmallHexTile, cargo_id: i32, quantity: i32) {
    // Note: this used to be DELAY spawn. See if setting this in a different transaction is still needed.
    let item_stacks = vec![ItemStack::new_ignore_durability(cargo_id, ItemType::Cargo, quantity)];
    DroppedInventoryState::update_from_items(ctx, owner_entity_id, coordinates, item_stacks, None);
}
