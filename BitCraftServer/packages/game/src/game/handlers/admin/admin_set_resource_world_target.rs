use spacetimedb::{log, ReducerContext};

use crate::{
    game::{handlers::authentication::has_role, world_gen::resources_log::resources_log},
    messages::authentication::Role,
    unwrap_or_err,
};

#[spacetimedb::reducer]
pub fn admin_set_resource_world_target(ctx: &ReducerContext, resource_id: i32, world_target: i32) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let mut resources_log = unwrap_or_err!(ctx.db.resources_log().version().find(0), "Failed to get resources log");

    for resource_info in resources_log.resources.iter_mut() {
        if resource_info.resource_id == resource_id {
            log::info!(
                "Updating world_target for resource_id {} from {} to {}",
                resource_id,
                resource_info.world_target,
                world_target
            );

            resource_info.world_target = world_target;
            ctx.db.resources_log().version().update(resources_log);
            break;
        }
    }

    Ok(())
}
