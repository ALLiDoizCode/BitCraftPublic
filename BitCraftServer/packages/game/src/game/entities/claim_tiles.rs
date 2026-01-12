use spacetimedb::ReducerContext;

use crate::claim_tile_state;
use crate::game::coordinates::*;
use crate::messages::components::{ClaimTileState, LocationState};

impl ClaimTileState {
    pub fn get_at_location(ctx: &ReducerContext, coordinates: &SmallHexTile) -> Option<ClaimTileState> {
        LocationState::select_all(ctx, coordinates)
            .filter_map(|ls| ctx.db.claim_tile_state().entity_id().find(ls.entity_id))
            .next()
    }
}
