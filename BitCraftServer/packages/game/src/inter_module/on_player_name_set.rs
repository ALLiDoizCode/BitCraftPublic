use bitcraft_macro::event_table;
use spacetimedb::ReducerContext;

use crate::messages::{
    components::{player_lowercase_username_state, player_username_state},
    inter_module::OnPlayerNameSetMsg,
};

pub fn process_message_on_destination(ctx: &ReducerContext, request: OnPlayerNameSetMsg) -> Result<(), String> {
    let entity_id = request.player_entity_id;
    let username = request.name;

    let mut player_state = ctx.db.player_lowercase_username_state().entity_id().find(&entity_id).unwrap();
    player_state.username_lowercase = username.to_lowercase().into();
    ctx.db.player_lowercase_username_state().entity_id().update(player_state);

    let mut player_state = ctx.db.player_username_state().entity_id().find(&entity_id).unwrap();
    player_state.username = username.clone();
    ctx.db.player_username_state().entity_id().update(player_state);

    PlayerSetNameOutcomeEvent::new_event(ctx, entity_id);

    Ok(())
}

#[event_table(name = player_set_name_outcome_event)]
pub struct PlayerSetNameOutcomeEvent {
    pub player_entity_id: u64,
}
