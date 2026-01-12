use crate::game::world_gen::resources_log::ResourceClumpInfo;
use crate::messages::util::OffsetCoordinatesSmallMessage;
use spacetimedb::SpacetimeType;

#[derive(Debug, SpacetimeType, Clone, PartialEq, Copy)]
#[repr(i32)]
pub enum WorldPlacementType {
    Resource = 1,
    Building = 2,
}

#[derive(SpacetimeType, Default, Copy, Clone, Debug, PartialEq)]
pub struct ResourcePlacement {
    pub coordinates: OffsetCoordinatesSmallMessage,
    pub facing_direction: i32,
}

#[derive(SpacetimeType)]
pub struct WorldPlaceResourceRequest {
    pub resources: Vec<ResourcePlacement>,
    pub resource_clump_info: ResourceClumpInfo,
    pub dry_run: bool,
    pub add_to_resources_log: bool,
    pub log_results: bool,
    pub ignore_biome: bool,
}

#[derive(SpacetimeType, Default, Copy, Clone, Debug, PartialEq)]
pub struct BuildingPlacement {
    pub coordinates: OffsetCoordinatesSmallMessage,
    pub facing_direction: i32,
}

#[derive(SpacetimeType, Debug)]
pub struct WorldPlaceBuildingRequest {
    pub buildings: Vec<BuildingPlacement>,
    pub building_spawn_info: BuildingSpawnInfo,
    pub dry_run: bool,
    pub log_results: bool,
    pub ignore_claims: bool,
    pub clear_and_level_ground: bool,
    pub ignore_dimension_rules: bool,
    pub ignore_empire_checks: bool,
    pub ignore_biomes: bool,
}

#[derive(SpacetimeType, Default, Clone, Debug, PartialEq)]
pub struct BuildingSpawnInfo {
    pub construction_recipe_id: Option<i32>,
    pub building_description_id: i32,
    pub biomes: Vec<i32>,
}

#[derive(SpacetimeType, Clone, Debug)]
pub struct WorldEntityPlacement {
    pub entity_id: u64, //id of placed entity
    pub coordinates: OffsetCoordinatesSmallMessage,
    pub prototype_id: i32,
    pub placement_type: WorldPlacementType,
}

#[spacetimedb::table(name = world_entity_placement_results)]
#[derive(Clone, Debug)]
pub struct WorldEntityPlacementResults {
    #[primary_key]
    pub entity_id: u64,
    pub timestamp: i32,
    pub placements: Vec<WorldEntityPlacement>,
    pub dry_run: bool,
    pub add_to_resources_log: bool,
}
