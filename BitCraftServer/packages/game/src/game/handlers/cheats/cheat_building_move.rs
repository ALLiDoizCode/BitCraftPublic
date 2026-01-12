use crate::game::handlers::cheats::cheat_type::{can_run_cheat, CheatType};
use crate::game::reducer_helpers::building_helpers::move_building_unsafe;
use crate::messages::action_request::PlayerBuildingMoveRequest;
use bitcraft_macro::shared_table_reducer;
use spacetimedb::ReducerContext;

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn cheat_building_move(ctx: &ReducerContext, request: PlayerBuildingMoveRequest) -> Result<(), String> {
    if !can_run_cheat(ctx, &ctx.sender, CheatType::CheatBuildingMove) {
        return Err("Unauthorized.".into());
    }

    move_building_unsafe(ctx, request.building_entity_id, request.new_coordinates, request.facing_direction)
}
