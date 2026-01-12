use spacetimedb::{ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::Role,
        components::{buy_order_state, closed_listing_state, inventory_state, sell_order_state},
        game_util::ItemType,
    },
};

use super::admin_find_players_with_item::quantity_of_item;

#[spacetimedb::reducer]
pub fn admin_find_items_in_inventories(ctx: &ReducerContext, item_id: i32, is_cargo: bool, min_threshold: u64) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let item_type = if is_cargo { ItemType::Cargo } else { ItemType::Item };
    for inv in ctx.db.inventory_state().iter() {
        let q = quantity_of_item(&inv, item_id, item_type);
        if q >= min_threshold {
            spacetimedb::log::info!(
                "Inventory id {} (owner {}, player_owner {}) has {} of item {}",
                inv.entity_id,
                inv.owner_entity_id,
                inv.player_owner_entity_id,
                q,
                item_id
            );
        }
    }

    Ok(())
}

#[spacetimedb::reducer]
pub fn admin_find_items_in_trades(ctx: &ReducerContext, item_id: i32, is_cargo: bool, min_threshold: u64) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let item_type = if is_cargo { ItemType::Cargo } else { ItemType::Item };
    for l in ctx.db.closed_listing_state().iter() {
        if l.item_stack.item_id == item_id && l.item_stack.item_type == item_type && l.item_stack.quantity >= min_threshold as i32 {
            spacetimedb::log::info!(
                "Closed listing id {} (owner {}, claim {}) has {} of item {}",
                l.entity_id,
                l.owner_entity_id,
                l.claim_entity_id,
                l.item_stack.quantity,
                item_id
            );
        }
    }

    for l in ctx.db.sell_order_state().iter() {
        if l.item_id == item_id && l.item_type == item_type as i32 && l.quantity >= min_threshold as i32 {
            spacetimedb::log::info!(
                "Sell order id {} (owner {}, claim {}) has {} of item {}",
                l.entity_id,
                l.owner_entity_id,
                l.claim_entity_id,
                l.quantity,
                item_id
            );
        }
    }

    if item_id == 1 && !is_cargo {
        for l in ctx.db.buy_order_state().iter() {
            if l.stored_coins >= min_threshold as i32 {
                spacetimedb::log::info!(
                    "Buy order id {} (owner {}, claim {}) has {} coins",
                    l.entity_id,
                    l.owner_entity_id,
                    l.claim_entity_id,
                    l.stored_coins
                );
            }
        }
    }

    Ok(())
}
