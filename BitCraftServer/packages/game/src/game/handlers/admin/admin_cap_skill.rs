use spacetimedb::{log, ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::Role,
        components::{experience_state, player_username_state},
        game_util::ExperienceStack,
    },
};

#[spacetimedb::reducer]
pub fn admin_cap_skill(ctx: &ReducerContext, skill_id: i32, level: i32, new_level: i32, commit: bool) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let target_xp = ExperienceStack::experience_for_level(new_level);

    for mut exp in ctx.db.experience_state().iter() {
        let current_level = exp.get_level(skill_id);
        if current_level > level {
            let username_state = ctx.db.player_username_state().entity_id().find(exp.entity_id).unwrap();
            for stack in &mut exp.experience_stacks {
                if stack.skill_id == skill_id {
                    stack.quantity = target_xp;
                    log::info!(
                        "[entity id: {}] Updating skill id {} for player '{}'. level {} -> {}",
                        exp.entity_id,
                        skill_id,
                        username_state.username,
                        current_level,
                        new_level
                    );
                    if commit {
                        ctx.db.experience_state().entity_id().update(exp);
                    }
                    break;
                }
            }
        }
    }

    Ok(())
}
