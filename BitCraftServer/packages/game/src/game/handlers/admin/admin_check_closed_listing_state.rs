use spacetimedb::{ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{authentication::Role, components::closed_listing_state},
};

#[spacetimedb::reducer]
pub fn admin_check_closed_listing_states(ctx: &ReducerContext, max_value: u64) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    for cl in ctx.db.closed_listing_state().iter() {
        if cl.item_stack.quantity < 0 {
            spacetimedb::log::info!(
                "Closed listing {} has negative quantity ({}) of item {} (claim {}, owner {})",
                cl.entity_id,
                cl.item_stack.quantity,
                cl.item_stack.item_id,
                cl.claim_entity_id,
                cl.owner_entity_id
            );
        }
        if cl.item_stack.quantity > max_value as i32 {
            spacetimedb::log::info!(
                "Closed listing {} has large quantity ({}) of item {} (claim {}, owner {})",
                cl.entity_id,
                cl.item_stack.quantity,
                cl.item_stack.item_id,
                cl.claim_entity_id,
                cl.owner_entity_id
            );
        }
    }

    Ok(())
}
