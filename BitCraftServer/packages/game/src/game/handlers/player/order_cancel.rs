use spacetimedb::ReducerContext;

use crate::{
    game::game_state,
    messages::{
        action_request::PlayerOrderCancelRequest,
        components::{building_state, buy_order_state, sell_order_state, HealthState},
    },
    unwrap_or_err,
};

#[spacetimedb::reducer]
pub fn order_cancel(ctx: &ReducerContext, request: PlayerOrderCancelRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;
    HealthState::check_incapacitated(ctx, actor_id, true)?;

    let building = unwrap_or_err!(
        ctx.db.building_state().entity_id().find(request.building_entity_id),
        "Building does not exist"
    );

    let claim_entity_id = building.claim_entity_id;

    // Find all sell_orders matching the price and item id, and collect items from those, sorted by increasing price (with timestamp for tie-breaking)
    if let Some(order) = ctx.db.sell_order_state().entity_id().find(request.auction_listing_entity_id) {
        if order.claim_entity_id != claim_entity_id {
            return Err("You cannot cancel this listing from there".into());
        }

        if order.owner_entity_id != actor_id {
            return Err("You are not the owner of this listing".into());
        }

        // Refund "sold" items
        order.cancel_sell_order(ctx);
    } else if let Some(order) = ctx.db.buy_order_state().entity_id().find(request.auction_listing_entity_id) {
        if order.claim_entity_id != claim_entity_id {
            return Err("You cannot cancel this listing from there".into());
        }
        // Refund coins
        order.cancel_buy_order(ctx);
    }

    Ok(())
}
