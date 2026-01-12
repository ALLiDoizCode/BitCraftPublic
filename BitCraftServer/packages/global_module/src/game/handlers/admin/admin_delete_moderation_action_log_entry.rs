use spacetimedb::{ReducerContext, Table};

use crate::messages::components::{moderation_action_log_entry};
use crate::{game::handlers::authentication::has_role, messages::authentication::Role, unwrap_or_err};

#[spacetimedb::reducer]
pub fn admin_delete_moderation_action_log_entry(
    ctx: &ReducerContext,
    entity_id: u64,
) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Gm) {
        return Err("Unauthorized".into());
    }

    let action_log_entry = unwrap_or_err!(
        ctx.db.moderation_action_log_entry().entity_id().find(entity_id),
        "Moderation action log entry does not exist"
    );

    ctx.db.moderation_action_log_entry().delete(action_log_entry);

    Ok(())
}
