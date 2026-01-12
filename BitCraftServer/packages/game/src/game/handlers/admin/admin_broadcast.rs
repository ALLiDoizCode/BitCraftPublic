use spacetimedb::ReducerContext;

use crate::{
    game::handlers::authentication::has_role,
    messages::{authentication::Role, generic::admin_broadcast},
};

#[spacetimedb::reducer]
pub fn admin_broadcast_msg_region(ctx: &ReducerContext, title: String, message: String) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }
    reduce(ctx, title, message, false);
    Ok(())
}

pub fn reduce(ctx: &ReducerContext, title: String, message: String, sign_out: bool) {
    let mut broadcast = ctx.db.admin_broadcast().version().find(&0).unwrap();
    broadcast.title = title;
    broadcast.message = message;
    broadcast.sign_out = sign_out;
    broadcast.timestamp = ctx.timestamp;
    ctx.db.admin_broadcast().version().update(broadcast);
}
