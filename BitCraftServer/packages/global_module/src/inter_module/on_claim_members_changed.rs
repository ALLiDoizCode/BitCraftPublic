use spacetimedb::ReducerContext;

use crate::messages::{empire_shared::EmpireSettlementState, inter_module::OnClaimMembersChangedMsg};

pub fn process_message_on_destination(ctx: &ReducerContext, request: OnClaimMembersChangedMsg) -> Result<(), String> {
    EmpireSettlementState::update_donations(ctx, request.claim_entity_id, 0)?;

    Ok(())
}
