use spacetimedb::ReducerContext;

use crate::{
    game::{
        handlers::buildings::building_deconstruct::grant_deconstructed_items_for_entity,
        reducer_helpers::{building_helpers::delete_building, player_action_helpers},
    },
    messages::{components::building_state, inter_module::OnEmpireBuildingDeletedMsg},
};

pub fn process_message_on_destination(ctx: &ReducerContext, request: OnEmpireBuildingDeletedMsg) -> Result<(), String> {
    //Make sure building wasn't already deconstructed
    if ctx.db.building_state().entity_id().find(request.building_entity_id).is_some() {
        delete_building(
            ctx,
            request.player_entity_id,
            request.building_entity_id,
            None,
            request.ignore_portals,
            request.drop_items,
        );
    }

    if request.player_entity_id > 0 {
        grant_deconstructed_items_for_entity(ctx, request.player_entity_id, request.building_entity_id);
        player_action_helpers::post_reducer_update_cargo(ctx, request.player_entity_id);
    }

    Ok(())
}
