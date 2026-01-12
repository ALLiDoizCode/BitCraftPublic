use spacetimedb::{log, ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::Role,
        components::{action_state, player_state, PlayerState},
    },
};

#[spacetimedb::reducer]
pub fn admin_migrate_action_state(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    let mut count = 0;

    // migrate all toolbars by re-equipping weapons
    for player in ctx.db.player_state().iter() {
        // get hunting weapon
        if let Some(weapon) = PlayerState::get_hunting_weapon(ctx, player.entity_id) {
            PlayerState::on_added_to_toolbelt(ctx, player.entity_id, weapon.item_id);
            count += 1;
        }
        if let Some(weapon) = PlayerState::get_combat_weapon(ctx, player.entity_id) {
            PlayerState::on_added_to_toolbelt(ctx, player.entity_id, weapon.item_id);
            count += 1;
        }
    }

    // delete all action_states
    let action_count = ctx.db.action_state().iter().count();
    for action in ctx.db.action_state().iter() {
        ctx.db.action_state().entity_id().delete(action.entity_id);
    }

    log::info!("Updated {count} toolbars");
    log::info!("Deleted {action_count} action_states");

    Ok(())
}
