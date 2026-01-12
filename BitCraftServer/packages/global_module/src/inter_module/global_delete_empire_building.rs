use spacetimedb::ReducerContext;

use crate::{game::handlers::empires::empires::delete_empire_building, messages::inter_module::GlobalDeleteEmpireBuildingMsg};

pub fn process_message_on_destination(ctx: &ReducerContext, request: GlobalDeleteEmpireBuildingMsg) -> Result<(), String> {
    delete_empire_building(ctx, request.player_entity_id, request.building_entity_id, true);

    Ok(())
}
