use crate::{
    inter_module::player_create::send_message,
    messages::{
        generic::{region_population_info, region_sign_in_parameters, world_region_state},
        global::{user_creation_timestamp_state, user_region_state, UserCreationTimestampState, UserRegionState},
    },
    unwrap_or_err,
};
use spacetimedb::{log, ReducerContext, Table};

#[spacetimedb::reducer]
pub fn player_create(ctx: &ReducerContext) -> Result<(), String> {
    if ctx.db.user_region_state().identity().find(ctx.sender).is_some() {
        return Err("Player already exists".into());
    }

    let region_id = get_best_region_for_new_player(ctx)?;
    send_message(ctx, region_id)?;

    //Insert this right away, to prevent attempting to create multiple characters (if the target region is unavailable)
    ctx.db.user_region_state().insert(UserRegionState {
        identity: ctx.sender,
        region_id: region_id,
    });
    ctx.db.user_creation_timestamp_state().insert(UserCreationTimestampState {
        identity: ctx.sender,
        timestamp: ctx.timestamp,
    });

    log::info!("Assigning new player to region {}", region_id);

    Ok(())
}

const MAX_POPULATION_INCREMENT: u32 = 500;

fn get_best_region_for_new_player(ctx: &ReducerContext) -> Result<u8, String> {
    let region_count = unwrap_or_err!(ctx.db.world_region_state().id().find(0), "Failed to get WorldRegionState").region_count;

    let center = (region_count / 2, region_count / 2);
    let mut candidates: Vec<RegionInfo> = vec![];

    for id in 1..=region_count {
        let region_sign_in_parameters = unwrap_or_err!(
            ctx.db.region_sign_in_parameters().region_id().find(id),
            "Failed to get RegionSignInParameters"
        );

        if region_sign_in_parameters.is_signing_in_blocked {
            continue;
        }

        let region_population_info = unwrap_or_err!(
            ctx.db.region_population_info().region_id().find(id),
            "Failed to get RegionPopulationInfo"
        );

        let index = id - 1;
        let x = index % region_count;
        let y = index / region_count;
        let distance_from_center = ((x as i32 - center.0 as i32).abs() + (y as i32 - center.1 as i32).abs()) as u8;

        candidates.push(RegionInfo {
            id,
            distance_from_center,
            players_in_queue: 0.max(region_population_info.players_in_queue - region_sign_in_parameters.queue_length_tolerance),
            signed_in_players: region_population_info.signed_in_players,
            total_accounts: ctx.db.user_region_state().region_id().filter(id).count() as u32,
        });
    }

    candidates.sort_by(|a, b| {
        a.players_in_queue
            .cmp(&b.players_in_queue)
            .then((a.total_accounts / MAX_POPULATION_INCREMENT).cmp(&(b.total_accounts / MAX_POPULATION_INCREMENT)))
            .then(a.distance_from_center.cmp(&b.distance_from_center))
            .then(b.signed_in_players.cmp(&a.signed_in_players))
            .then(a.id.cmp(&b.id))
    });

    if let Some(first) = candidates.first() {
        return Ok(first.id);
    }

    Err("Unable to create a new player at this time, please try again later.".into())
}

#[derive(Debug)]
struct RegionInfo {
    id: u8,
    distance_from_center: u8,
    players_in_queue: u32,
    signed_in_players: u32,
    total_accounts: u32,
}
