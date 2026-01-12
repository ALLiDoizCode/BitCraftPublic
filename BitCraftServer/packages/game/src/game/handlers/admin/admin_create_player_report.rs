use crate::game::handlers::admin::admin_shared::build_player_report;
use crate::messages::action_request::CreatePlayerReportRequest;
use crate::messages::components::{player_report_state, PlayerReportState};
use bitcraft_macro::shared_table_reducer;
use spacetimedb::ReducerContext;

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn admin_create_player_report(ctx: &ReducerContext, request: CreatePlayerReportRequest) -> Result<(), String> {
    let row = build_player_report(ctx, request)?;
    let entity_id = row.entity_id;

    // send to Global
    PlayerReportState::insert_shared(ctx, row, crate::inter_module::InterModuleDestination::Global);

    // remove local copy
    ctx.db.player_report_state().entity_id().delete(entity_id);

    Ok(())
}
