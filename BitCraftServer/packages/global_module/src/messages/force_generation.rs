// NOTE: Our code on the client relies on some types that aren't used by either tables or reducer arguments.
// We probably could and should replace these types with our own C# types, but in the meantime I am creating
// a table that references all these types so that they will be generated on the client.

use crate::{ClaimPermission, HexDirection, ItemConversionLocationContext, TerrainCell};

use super::{
    empire_shared::EmpirePermission,
    util::{ChunkCoordinatesMessage, FloatHexTileMessage, LargeHexTileMessage},
};

#[spacetimedb::table(name = force_generate_types)]
pub struct ForceGenerateTypes {
    pub hex_direction: HexDirection,
    pub float_hex_tile: FloatHexTileMessage,
    pub chunk_coordinates_message: ChunkCoordinatesMessage,
    pub claim_permission: ClaimPermission,
    pub empire_permission: EmpirePermission,
    pub large_hex_tile_message: LargeHexTileMessage,
    pub terrain_cell: TerrainCell,
    pub item_conversion_locatin_context: ItemConversionLocationContext,
}
