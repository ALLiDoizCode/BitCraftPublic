use spacetimedb::ReducerContext;

use crate::game::game_state;
use crate::messages::components::{player_settings_state_v2, PlayerSettingsStateV2};

#[spacetimedb::reducer]
pub fn player_settings_state_update(ctx: &ReducerContext, player_settings_state: PlayerSettingsStateV2) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    if player_settings_state.entity_id != actor_id {
        return Err("Invalid player".into());
    }

    ctx.db
        .player_settings_state_v2()
        .entity_id()
        .insert_or_update(player_settings_state);

    Ok(())
}
