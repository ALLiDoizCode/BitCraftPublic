use spacetimedb::{ReducerContext, Table};

use crate::messages::{authentication::*, components::*, inter_module::ReplaceIdentityMsg};

pub fn process_message_on_destination(ctx: &ReducerContext, msg: ReplaceIdentityMsg) -> Result<(), String> {
    let old_identity = msg.old_identity;
    let new_identity = msg.new_identity;
    spacetimedb::log::info!("Replacing identity {old_identity} -> {new_identity}");

    if let Some(mut v) = ctx.db.user_authentication_state().identity().find(old_identity) {
        ctx.db.user_authentication_state().identity().delete(old_identity);
        v.identity = new_identity;
        ctx.db.user_authentication_state().insert(v);
    }
    if let Some(mut v) = ctx.db.developer().identity().find(old_identity) {
        ctx.db.developer().identity().delete(old_identity);
        v.identity = new_identity;
        ctx.db.developer().insert(v);
    }
    if let Some(mut v) = ctx.db.identity_role().identity().find(old_identity) {
        ctx.db.identity_role().identity().delete(old_identity);
        v.identity = new_identity;
        ctx.db.identity_role().insert(v);
    }
    if let Some(mut v) = ctx.db.blocked_identity().identity().find(old_identity) {
        ctx.db.blocked_identity().identity().delete(old_identity);
        v.identity = new_identity;
        ctx.db.blocked_identity().insert(v);
    }
    if let Some(mut v) = ctx.db.user_state().identity().find(old_identity) {
        ctx.db.user_state().identity().delete(old_identity);
        v.identity = new_identity;
        ctx.db.user_state().insert(v);
    }
    if let Some(mut v) = ctx.db.unclaimed_shards_state().identity().find(old_identity) {
        ctx.db.unclaimed_shards_state().identity().delete(old_identity);
        v.identity = new_identity;
        ctx.db.unclaimed_shards_state().insert(v);
    }
    if let Some(mut v) = ctx.db.unclaimed_collectibles_state().identity().find(old_identity) {
        ctx.db.unclaimed_collectibles_state().identity().delete(old_identity);
        v.identity = new_identity;
        ctx.db.unclaimed_collectibles_state().insert(v);
    }
    if let Some(mut v) = ctx.db.user_previous_region_state().identity().find(old_identity) {
        ctx.db.user_previous_region_state().identity().delete(old_identity);
        v.identity = new_identity;
        ctx.db.user_previous_region_state().insert(v);
    }

    Ok(())
}
