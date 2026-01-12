use crate::game::handlers::cheats::cheat_type::{can_run_cheat, CheatType};
use crate::{game::game_state::game_state_filters, messages::components::ResourceState};

use spacetimedb::ReducerContext;

#[spacetimedb::reducer]
pub fn cheat_remove_entity_resource(ctx: &ReducerContext, target_entity_id: u64) -> Result<(), String> {
    if !can_run_cheat(ctx, &ctx.sender, CheatType::CheatRemoveEntityResource) {
        return Err("Unauthorized.".into());
    }

    let coordinates = game_state_filters::coordinates(ctx, target_entity_id);
    if let Some(deposit) = ResourceState::get_at_location(ctx, &coordinates) {
        deposit.despawn_self(ctx);
    }

    Ok(())
}
