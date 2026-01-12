#[derive(spacetimedb::SpacetimeType, Clone, Copy, PartialEq, Debug)]
#[sats(name = "PlayerVoteType")]
#[repr(i32)]
pub enum PlayerVoteType {
    Duel,
}

#[derive(spacetimedb::SpacetimeType, Clone, Copy, PartialEq, Debug)]
#[sats(name = "PlayerVoteAnswer")]
#[repr(i32)]
pub enum PlayerVoteAnswer {
    None,
    No,
    Yes,
}

#[spacetimedb::table(name = player_vote_state, public)]
#[derive(Clone)]
pub struct PlayerVoteState {
    #[primary_key]
    pub entity_id: u64,

    pub vote_type: PlayerVoteType,
    pub initiator_entity_id: u64,
    pub participants_entity_id: Vec<u64>,
    pub answers: Vec<PlayerVoteAnswer>,
    pub initiator_name: String,
    pub pass_threshold: f32,
    pub outcome: PlayerVoteAnswer,
    //DAB Note: These arguments should be in separate tables (one per vote_type). This will allow them to have better names and
    //  make sure that votes don't get mis-interpreted (right now there's nothing stopping you from using JoinEmpire vote as if it were TeleportRequest)
    pub argument1: u64,
    pub argument2: u64,
    pub outcome_str: String,
}

#[spacetimedb::table(name = migration_achievements_params)]
pub struct MigrationAchievementsParams {
    #[primary_key]
    pub id: i32,
    pub allow_destructive: bool,
    pub grant_if_already_owned: bool,
}

#[spacetimedb::table(name = migration_building_desc_params)]
pub struct MigrationBuildingDescParams {
    #[primary_key]
    pub id: i32,
    pub allow_building_health_change: bool,
}
