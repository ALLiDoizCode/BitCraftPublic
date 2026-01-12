use crate::game::game_state;
use crate::game::handlers::admin::admin_shared::build_player_report;
use crate::messages::action_request::CreatePlayerReportRequest;
use crate::messages::components::{player_report_state, player_report_state_timestamp, PlayerReportStateTimestamp};
use spacetimedb::{ReducerContext, Table};

#[spacetimedb::reducer]
pub fn admin_create_player_report(ctx: &ReducerContext, request: CreatePlayerReportRequest) -> Result<(), String> {
    let row = build_player_report(ctx, request)?;
    let entity_id = row.entity_id;

    ctx.db.player_report_state().entity_id().try_insert_or_update(row)?;
    ctx.db.player_report_state_timestamp().try_insert(PlayerReportStateTimestamp {
        entity_id,
        timestamp: game_state::unix(ctx.timestamp),
    })?;
    Ok(())
}
