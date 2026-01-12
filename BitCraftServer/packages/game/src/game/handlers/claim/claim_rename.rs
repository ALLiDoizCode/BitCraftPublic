use bitcraft_macro::shared_table_reducer;
use spacetimedb::{log, ReducerContext};

use crate::{
    game::{game_state, reducer_helpers::user_text_input_helpers::is_user_text_input_valid},
    messages::{action_request::PlayerClaimRenameRequest, components::*},
    unwrap_or_err,
};

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn claim_rename(ctx: &ReducerContext, request: PlayerClaimRenameRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;
    PlayerTimestampState::refresh(ctx, actor_id, ctx.timestamp);

    UserModerationState::validate_chat_privileges(ctx, actor_id, "Your naming priveleges have been suspended")?;

    let claim = unwrap_or_err!(ctx.db.claim_state().entity_id().find(&request.claim_entity_id), "No such claim.");
    if !claim.has_owner_permissions(actor_id) {
        return Err("Only the owner can rename the claim.".into());
    }

    reduce(ctx, request)
}

pub fn reduce(ctx: &ReducerContext, request: PlayerClaimRenameRequest) -> Result<(), String> {
    let mut claim = unwrap_or_err!(ctx.db.claim_state().entity_id().find(&request.claim_entity_id), "No such claim.");

    if let Err(msg) = is_user_text_input_valid(&request.claim_name, 35, true) {
        log::info!("Failed to rename {msg}");
        return Err("Failed to rename Claim".into());
    }

    BuildingNicknameState::set_nickname(ctx, claim.owner_building_entity_id, request.claim_name.clone());

    claim.name = request.claim_name;
    ClaimState::update_shared(ctx, claim, crate::inter_module::InterModuleDestination::Global);

    Ok(())
}
