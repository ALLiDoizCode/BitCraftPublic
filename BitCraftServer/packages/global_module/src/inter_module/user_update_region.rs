use spacetimedb::ReducerContext;

use crate::{
    messages::{global::user_region_state, inter_module::UserUpdateRegionMsg},
    unwrap_or_err,
};

pub fn process_message_on_destination(ctx: &ReducerContext, user_update_region_request: UserUpdateRegionMsg) -> Result<(), String> {
    let mut user_region_state = unwrap_or_err!(
        ctx.db.user_region_state().identity().find(user_update_region_request.identity),
        "UserRegionState does not exist for identity: {{0}}|~{}",
        user_update_region_request.identity
    );

    user_region_state.region_id = user_update_region_request.region_id;
    ctx.db.user_region_state().identity().update(user_region_state);

    Ok(())
}
