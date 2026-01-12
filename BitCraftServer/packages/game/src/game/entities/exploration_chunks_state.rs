use spacetimedb::ReducerContext;

use crate::{
    game::dimensions,
    messages::generic::{world_region_state, WorldRegionState},
    ChunkCoordinates, ExplorationChunksState,
};

impl ExplorationChunksState {
    pub fn new(ctx: &ReducerContext, entity_id: u64, region: Option<WorldRegionState>) -> Self {
        let region = region.unwrap_or_else(|| ctx.db.world_region_state().id().find(&0).unwrap());
        let bifield_size = (region.world_chunk_count() + 63) / 64;
        return ExplorationChunksState {
            entity_id,
            bitmap: vec![0; bifield_size as usize],
            explored_chunks_count: 0,
        };
    }

    pub fn explore_chunk(&mut self, ctx: &ReducerContext, chunk: &ChunkCoordinates, world_width: Option<i32>) -> bool {
        if chunk.dimension != dimensions::OVERWORLD {
            panic!("Only overworld chunks can be explored");
        }
        let world_width = world_width.unwrap_or_else(|| ctx.db.world_region_state().id().find(&0).unwrap().world_width_chunks());
        let index = Self::index_for_chunk(chunk, world_width);
        return self.explore_chunk_internal(index);
    }

    pub fn explore_chunk_and_surroundings(&mut self, ctx: &ReducerContext, chunk: &ChunkCoordinates, world_width: Option<i32>) -> bool {
        if chunk.dimension != dimensions::OVERWORLD {
            panic!("Only overworld chunks can be explored");
        }
        let world_width = world_width.unwrap_or_else(|| ctx.db.world_region_state().id().find(&0).unwrap().world_width_chunks());
        let mut r = false;
        for c in chunk.surrounding_and_including(ctx) {
            let index = Self::index_for_chunk(&c, world_width);
            r |= self.explore_chunk_internal(index);
        }
        return r;
    }

    fn explore_chunk_internal(&mut self, (vec_index, bitmask): (usize, u64)) -> bool {
        let mut val = self.bitmap[vec_index];
        if (val & bitmask) == 0 {
            val |= bitmask;
            self.bitmap[vec_index] = val;
            self.explored_chunks_count += 1;
            return true;
        }
        return false;
    }

    fn index_for_chunk(chunk: &ChunkCoordinates, world_width: i32) -> (usize, u64) {
        let global_index = chunk.z * world_width + chunk.x;
        let vec_index = (global_index / 64) as usize;
        let bitmask = 1u64 << (global_index % 64);
        return (vec_index, bitmask);
    }
}
