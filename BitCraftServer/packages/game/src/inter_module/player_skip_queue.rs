use spacetimedb::ReducerContext;

use crate::{
    game::handlers::queue::{end_grace_period::end_grace_period_timer, player_queue},
    messages::{components::*, inter_module::PlayerSkipQueueMsg},
    unwrap_or_err,
};

pub fn process_message_on_destination(ctx: &ReducerContext, request: PlayerSkipQueueMsg) -> Result<(), String> {
    let user_state = unwrap_or_err!(ctx.db.user_state().identity().find(request.player_identity), "User doesn't exist");
    ctx.db.end_grace_period_timer().identity().delete(user_state.identity);
    player_queue::dequeue(ctx, user_state.entity_id);
    player_queue::allow_sign_in(ctx, user_state);
    Ok(())
}
