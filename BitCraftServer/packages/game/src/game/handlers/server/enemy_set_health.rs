use crate::{
    game::handlers::authentication::has_role,
    messages::{action_request::EnemySetHealthRequest, authentication::Role},
};
use spacetimedb::ReducerContext;

#[spacetimedb::reducer]
pub fn enemy_set_health(ctx: &ReducerContext, request: EnemySetHealthRequest) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    reduce(ctx, request);

    Ok(())
}

#[spacetimedb::reducer]
pub fn enemy_set_health_batch(ctx: &ReducerContext, requests: Vec<EnemySetHealthRequest>) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    for request in requests {
        reduce(ctx, request);
    }

    Ok(())
}

fn reduce(_ctx: &ReducerContext, _request: EnemySetHealthRequest) {}
