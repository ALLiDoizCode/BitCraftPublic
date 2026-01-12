use spacetimedb::{ReducerContext, Table};
use crate::game::game_state::{create_entity, unix};
use crate::game::handlers::authentication::has_role;
use crate::messages::authentication::Role;
use crate::messages::global::{direct_message_state, DirectMessageState};

#[spacetimedb::reducer]
pub fn admin_create_direct_chat_message(
    ctx: &ReducerContext,
    username: String,
    title_id: i32,
    receiver_id: u64,
    new_message_text: String,
) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Gm) {
        return Err("Unauthorized".into());
    }

    let message_entity_id = create_entity(ctx);
    if ctx
        .db
        .direct_message_state()
        .try_insert(DirectMessageState {
            entity_id: message_entity_id,
            username,
            title_id,
            text: new_message_text,
            timestamp: unix(ctx.timestamp),
            sender_entity_id: 0,
            receiver_entity_id: receiver_id,
            language_code: None
        })
        .is_err()
    {
        return Err("Failed to insert direct chat message".into());
    }

    Ok(())
}