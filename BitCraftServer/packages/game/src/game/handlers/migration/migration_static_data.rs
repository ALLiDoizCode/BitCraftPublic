use std::collections::HashMap;

use spacetimedb::{ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::Role,
        components::*,
        region::{migration_building_desc_params, MigrationBuildingDescParams},
        static_data::{building_desc, BuildingDesc},
    },
    unwrap_or_continue,
};

#[spacetimedb::reducer]
pub fn migration_set_building_desc_params(ctx: &ReducerContext, allow_building_health_change: bool) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    ctx.db.migration_building_desc_params().id().delete(0);
    ctx.db.migration_building_desc_params().insert(MigrationBuildingDescParams {
        id: 0,
        allow_building_health_change,
    });

    Ok(())
}

//This is called during static data upload
pub fn migrate_health_of_existing_buildings(ctx: &ReducerContext, old_descs: HashMap<i32, BuildingDesc>) -> Result<(), String> {
    let par = ctx
        .db
        .migration_building_desc_params()
        .iter()
        .next()
        .unwrap_or(MigrationBuildingDescParams {
            id: 0,
            allow_building_health_change: false,
        });
    ctx.db.migration_building_desc_params().id().delete(par.id);

    if par.allow_building_health_change {
        spacetimedb::log::info!("Migrating health of existing buildings...");
    }

    let mut has_errors = false;
    for new_desc in ctx.db.building_desc().iter() {
        if let Some(old_desc) = old_descs.get(&new_desc.id) {
            if old_desc.max_health != new_desc.max_health {
                if par.allow_building_health_change {
                    migrate_building_health(ctx, new_desc.id, old_desc.max_health, new_desc.max_health);
                } else {
                    has_errors = true;
                    spacetimedb::log::error!("  Building {}'s health was updated from {} to {}, but migration is disabled. If this update was intended, please call `migration_set_building_desc_params` reudcer before uploading static data", new_desc.id, old_desc.max_health, new_desc.max_health);
                }
            }
        }
    }

    if has_errors {
        return Err("Failed to migrate health of buildings".into());
    }
    if par.allow_building_health_change {
        spacetimedb::log::info!("Building health migrated");
    }

    Ok(())
}

fn migrate_building_health(ctx: &ReducerContext, building_id: i32, old_health: i32, new_health: i32) {
    if old_health == new_health {
        return;
    }

    spacetimedb::log::info!("  Migrating health of existing buildings of type {building_id} ({old_health} -> {new_health})");

    let delta = (new_health - old_health) as f32;
    let mut count = 0;
    for building_state in ctx.db.building_state().building_description_id().filter(building_id) {
        let eid = building_state.entity_id;
        let mut health_state = unwrap_or_continue!(
            ctx.db.health_state().entity_id().find(building_state.entity_id),
            "Building {eid} doesn't have a HealthState"
        );
        health_state.health += delta;
        ctx.db.health_state().entity_id().update(health_state);
        count += 1;
    }

    spacetimedb::log::info!("    {count} builddings migrated");
}
