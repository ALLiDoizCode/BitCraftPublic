use spacetimedb::ReducerContext;

use crate::{
    game::discovery::Discovery,
    messages::{empire_shared::EmpireState, inter_module::OnPlayerJoinedEmpireMsg},
};

pub fn process_message_on_destination(ctx: &ReducerContext, request: OnPlayerJoinedEmpireMsg) -> Result<(), String> {
    // Grant "Empire" secondary knowledge to added player
    let mut discovery = Discovery::new(request.player_entity_id);
    discovery.acquire_secondary(ctx, 100002); // 100002 is Empire knowledge
    discovery.commit(ctx);

    EmpireState::update_cloak_availability(ctx, request.player_entity_id, true);

    Ok(())
}
