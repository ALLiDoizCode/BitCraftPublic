use crate::messages::authentication::Role;
use crate::ThreatState;
use crate::{game::handlers::authentication::has_role, messages::action_request::EnemyClearAggroRequest};

use spacetimedb::ReducerContext;

#[spacetimedb::reducer]
pub fn enemy_clear_aggro(ctx: &ReducerContext, request: EnemyClearAggroRequest) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    if let Some(target) = request.aggro_entity_id {
        ThreatState::clear(ctx, request.entity_id, target);
    } else {
        ThreatState::clear_all(ctx, request.entity_id);
    }

    Ok(())
}
