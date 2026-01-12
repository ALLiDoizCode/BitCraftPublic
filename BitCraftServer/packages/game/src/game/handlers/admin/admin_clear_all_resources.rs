use spacetimedb::{log, ReducerContext, Table};

use crate::{
    game::{coordinates::ChunkCoordinates, dimensions, handlers::authentication::has_role},
    messages::{
        authentication::Role,
        components::{location_state, resource_state, terrain_chunk_state, TerrainChunkState},
    },
};

#[spacetimedb::table(name = admin_clear_resource_timer, scheduled(admin_clear_chunk_resources, at = scheduled_at))]
pub struct AdminClearResourceTimer {
    #[primary_key]
    #[auto_inc]
    pub scheduled_id: u64,
    pub scheduled_at: spacetimedb::ScheduleAt,
    pub chunk_index: u64,
}

#[spacetimedb::reducer]
pub fn admin_clear_all_resources(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let chunk_index = TerrainChunkState::chunk_index_from_coords(&ChunkCoordinates {
        x: 0,
        z: 0,
        dimension: dimensions::OVERWORLD,
    });

    ctx.db.admin_clear_resource_timer().insert(AdminClearResourceTimer {
        scheduled_id: 0,
        scheduled_at: ctx.timestamp.into(),
        chunk_index,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn admin_clear_chunk_resources(ctx: &ReducerContext, timer: AdminClearResourceTimer) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let chunk_index = timer.chunk_index;
    let mut chunk_coord = TerrainChunkState::chunk_coord_from_chunk_index(chunk_index);

    log::info!("clearing resources for chunk {:?}", chunk_coord);

    for location_state in ctx.db.location_state().chunk_index().filter(chunk_index) {
        if let Some(resource) = ctx.db.resource_state().entity_id().find(location_state.entity_id) {
            resource.despawn_self(ctx);
        }
    }

    log::info!("done clearing resources for chunk {:?}", chunk_coord);

    chunk_coord.x += 1;

    let next_chunk_index = TerrainChunkState::chunk_index_from_coords(&chunk_coord);
    if ctx.db.terrain_chunk_state().chunk_index().find(next_chunk_index).is_some() {
        ctx.db.admin_clear_resource_timer().insert(AdminClearResourceTimer {
            scheduled_id: 0,
            scheduled_at: ctx.timestamp.into(),
            chunk_index: next_chunk_index,
        });
        return Ok(());
    }

    chunk_coord.x = 0;
    chunk_coord.z += 1;

    let next_chunk_index = TerrainChunkState::chunk_index_from_coords(&chunk_coord);
    if ctx.db.terrain_chunk_state().chunk_index().find(next_chunk_index).is_some() {
        ctx.db.admin_clear_resource_timer().insert(AdminClearResourceTimer {
            scheduled_id: 0,
            scheduled_at: ctx.timestamp.into(),
            chunk_index: next_chunk_index,
        });
        return Ok(());
    }

    log::info!("done clearing resources for all chunks");

    Ok(())
}
