use spacetimedb::ReducerContext;

use crate::{
    game::handlers::authentication::has_role,
    messages::{authentication::Role},
};
use crate::messages::components::{player_report_state};

#[spacetimedb::reducer]
pub fn admin_mark_user_report_as_actioned(ctx: &ReducerContext, entity_id: u64, actioned: bool) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    reduce(ctx, entity_id, actioned)
}

pub fn reduce(ctx: &ReducerContext, entity_id: u64, actioned: bool) -> Result<(), String> {
    if let Some(mut existing) = ctx.db.player_report_state().entity_id().find(entity_id) {
        existing.actioned = actioned;
        ctx.db.player_report_state().entity_id().update(existing);
        return Ok(());
    }

    Err("Could not find user report".into())
}
