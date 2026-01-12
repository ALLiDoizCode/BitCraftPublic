use spacetimedb::{log, ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::Role,
        components::{player_housing_moving_cost_state, player_housing_state, PlayerHousingMovingCostState},
    },
};

#[spacetimedb::reducer]
pub fn admin_patch_housing_costs(ctx: &ReducerContext) {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        log::error!("Unauthorized.");
        return;
    }

    for mut player_housing in ctx.db.player_housing_state().iter() {
        if ctx
            .db
            .player_housing_moving_cost_state()
            .entity_id()
            .find(player_housing.entity_id)
            .is_none()
        {
            ctx.db.player_housing_moving_cost_state().insert(PlayerHousingMovingCostState {
                entity_id: player_housing.entity_id,
                moving_time_cost_minutes: 0,
            });
            player_housing.update_is_empty_flag_self(ctx);
            ctx.db.player_housing_state().entity_id().update(player_housing);
        }
    }
}
