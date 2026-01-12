use spacetimedb::ReducerContext;

use crate::{
    game::handlers::authentication::has_role,
    messages::{authentication::Role, components::resource_state},
};

#[spacetimedb::reducer]
pub fn admin_resources_delete_very_slow(ctx: &ReducerContext, resource_id: i32) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    for resource in ctx.db.resource_state().resource_id().filter(resource_id) {
        resource.despawn_self(ctx);
    }

    Ok(())
}
