use spacetimedb::ReducerContext;

use crate::messages::components::{user_moderation_state, UserModerationPolicy, UserModerationState};

impl UserModerationState {
    pub fn validate_chat_privileges(ctx: &ReducerContext, player_entity_id: u64, error_message: &str) -> Result<(), String> {
        for existing_state in ctx.db.user_moderation_state().target_entity_id().filter(player_entity_id) {
            if existing_state.user_moderation_policy == UserModerationPolicy::BlockChat && ctx.timestamp < existing_state.expiration_time {
                return Err(error_message.into());
            }
        }

        Ok(())
    }
}
