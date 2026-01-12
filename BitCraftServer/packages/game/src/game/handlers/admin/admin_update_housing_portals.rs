use spacetimedb::{ReducerContext, Table};

use crate::{
    game::handlers::{authentication::has_role, player::player_housing_change_entrance},
    messages::{
        authentication::Role,
        components::{player_housing_state, portal_state},
    },
};

#[spacetimedb::reducer]
pub fn admin_update_housing_portals(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    for housing in ctx.db.player_housing_state().iter() {
        if let Some(portal) = ctx.db.portal_state().entity_id().find(housing.exit_portal_entity_id) {
            let _ = player_housing_change_entrance::update_portal_position(ctx, portal);
        }
    }

    Ok(())
}
