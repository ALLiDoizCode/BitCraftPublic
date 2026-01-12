use spacetimedb::{log, ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{authentication::Role, components::*},
};

#[spacetimedb::reducer]
pub fn migrate_auto_attacks(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let mut count = 0;

    for action_bar_state in ctx.db.action_bar_state().iter() {
        if let Some(ability) = ctx.db.ability_state().entity_id().find(action_bar_state.ability_entity_id) {
            if ability.ability == AbilityType::AutoAttack {
                ctx.db.action_bar_state().delete(action_bar_state);
                count += 1;
            }
        }
    }

    log::info!("Migrated {} auto attacks", count);

    Ok(())
}
