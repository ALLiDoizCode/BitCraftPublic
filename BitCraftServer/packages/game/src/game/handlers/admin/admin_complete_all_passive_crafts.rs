use spacetimedb::{log, ReducerContext, Table};

use crate::{game::handlers::authentication::has_role, messages::authentication::Role, passive_craft_state, PassiveCraftStatus};

#[spacetimedb::reducer]
pub fn admin_complete_all_passive_crafts(ctx: &ReducerContext) {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        log::error!("Unauthorized.");
        return;
    }

    for mut passive_craft in ctx.db.passive_craft_state().iter() {
        if passive_craft.status != PassiveCraftStatus::Complete {
            passive_craft.status = PassiveCraftStatus::Complete;
            passive_craft.slot = None;
            passive_craft.timestamp = ctx.timestamp;
            ctx.db.passive_craft_state().entity_id().update(passive_craft);
        }
    }
}
