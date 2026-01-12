use std::collections::HashMap;

use spacetimedb::{log, ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::Role,
        components::{building_state, health_state},
        static_data::building_desc,
    },
};

#[spacetimedb::reducer]
pub fn admin_restore_all_buildings_health(ctx: &ReducerContext) {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        log::error!("Unauthorized.");
        return;
    }

    let mut buildings_max_health: HashMap<i32, i32> = HashMap::new();
    let mut count = 0;

    for mut health_state in ctx.db.health_state().iter() {
        if let Some(building) = ctx.db.building_state().entity_id().find(health_state.entity_id) {
            let max_health = buildings_max_health.entry(building.building_description_id).or_insert(
                ctx.db
                    .building_desc()
                    .id()
                    .find(building.building_description_id)
                    .unwrap()
                    .max_health,
            );
            if health_state.health < *max_health as f32 {
                health_state.health = *max_health as f32;
                ctx.db.health_state().entity_id().update(health_state);
                count += 1;
            }
        }
    }

    log::info!("Updated {count} buildings");
}
