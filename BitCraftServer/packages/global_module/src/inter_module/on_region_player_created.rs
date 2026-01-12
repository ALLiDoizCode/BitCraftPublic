use spacetimedb::{ReducerContext, Table};

use crate::messages::{
    components::{player_lowercase_username_state, player_username_state, PlayerLowercaseUsernameState, PlayerUsernameState},
    global::{player_shard_state, PlayerShardState},
    inter_module::OnRegionPlayerCreatedMsg,
};

pub fn process_message_on_destination(ctx: &ReducerContext, request: OnRegionPlayerCreatedMsg) -> Result<(), String> {
    ctx.db.player_shard_state().insert(PlayerShardState {
        entity_id: request.player_entity_id,
        shards: 0,
        last_shard_claim: 0,
    });

    let username = format!("player{}", request.player_entity_id).to_string();
    ctx.db.player_username_state().insert(PlayerUsernameState {
        entity_id: request.player_entity_id,
        username: username.clone(),
    });
    ctx.db.player_lowercase_username_state().insert(PlayerLowercaseUsernameState {
        entity_id: request.player_entity_id,
        username_lowercase: username,
    });

    Ok(())
}
