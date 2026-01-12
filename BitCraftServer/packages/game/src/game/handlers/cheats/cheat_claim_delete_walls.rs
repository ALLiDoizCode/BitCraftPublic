use spacetimedb::ReducerContext;

use crate::{
    game::{
        handlers::cheats::cheat_type::{can_run_cheat, CheatType},
        reducer_helpers::building_helpers,
    },
    messages::{
        components::building_state,
        static_data::{building_desc, BuildingCategory},
    },
    unwrap_or_err,
};

#[spacetimedb::reducer]
pub fn cheat_claim_delete_walls(ctx: &ReducerContext, claim_entity_id: u64) -> Result<(), String> {
    if !can_run_cheat(ctx, &ctx.sender, CheatType::CheatClaimDeleteWalls) {
        return Err("Unauthorized".into());
    }

    for building_state in ctx.db.building_state().claim_entity_id().filter(claim_entity_id) {
        let building_desc = unwrap_or_err!(
            ctx.db.building_desc().id().find(building_state.building_description_id),
            "Unkown building desc"
        );

        if building_desc.has_category(ctx, BuildingCategory::Wall) {
            building_helpers::delete_building(ctx, 0, building_state.entity_id, None, false, false);
        }
    }

    Ok(())
}
