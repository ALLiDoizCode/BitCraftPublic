use bitcraft_macro::shared_table_reducer;
use spacetimedb::{log, ReducerContext};

use crate::{
    game::{handlers::authentication::has_role, reducer_helpers::building_helpers},
    messages::{authentication::Role, components::*},
};

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn admin_create_building_spawns(ctx: &ReducerContext, building_description_id: i32, commit: bool) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let building_entity_ids: Vec<u64> = ctx
        .db
        .building_state()
        .building_description_id()
        .filter(building_description_id)
        .map(|x| x.entity_id)
        .collect();
    let count = building_entity_ids.len();

    log::info!("Found {} buildings with building_description_id {}", count, building_description_id);

    if commit {
        for building_entity_id in building_entity_ids {
            building_helpers::create_building_spawns(ctx, building_entity_id);
        }

        log::info!("Finished creating building spawns for {} buildings", count);
    }

    Ok(())
}
