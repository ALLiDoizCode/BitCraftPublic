use crate::game::handlers::cheats::cheat_type::{can_run_cheat, CheatType};
use crate::messages::action_request::CheatExperienceGrantRequest;
use crate::messages::components::ExperienceState;

use spacetimedb::ReducerContext;

#[spacetimedb::reducer]
pub fn cheat_experience_grant(ctx: &ReducerContext, request: CheatExperienceGrantRequest) -> Result<(), String> {
    if !can_run_cheat(ctx, &ctx.sender, CheatType::CheatExperienceGrant) {
        return Err("Unauthorized.".into());
    }

    ExperienceState::add_experience(ctx, request.owner_entity_id, request.skill_id, request.amount);

    Ok(())
}
