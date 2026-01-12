use crate::game::autogen::_delete_entity::delete_entity;
use crate::game::coordinates::*;
use crate::game::handlers::cheats::cheat_type::{can_run_cheat, CheatType};
use crate::game::terrain_chunk::TerrainChunkCache;
use crate::messages::components::PavedTileState;
use crate::messages::util::OffsetCoordinatesSmallMessage;
use spacetimedb::ReducerContext;

// Similar to paving_destroy::reduce()
#[spacetimedb::reducer]
pub fn cheat_paving_destroy(ctx: &ReducerContext, x: i32, z: i32, dimension: u32) -> Result<(), String> {
    if !can_run_cheat(ctx, &ctx.sender, CheatType::CheatPavingDestroy) {
        return Err("Unauthorized.".into());
    }

    let coordinates: SmallHexTile = OffsetCoordinatesSmallMessage { x, z, dimension }.into();

    let target_coord = coordinates;

    let mut terrain_cache = TerrainChunkCache::empty();
    if terrain_cache.get_terrain_cell(ctx, &target_coord.parent_large_tile()).is_none() {
        return Err("Invalid coordinates".into());
    }

    let paving = PavedTileState::get_at_location(ctx, &target_coord);
    if paving.is_none() {
        return Err("Tile is not paved".into());
    }

    let paving_entity_id = paving.unwrap().entity_id;
    delete_entity(ctx, paving_entity_id);

    Ok(())
}
