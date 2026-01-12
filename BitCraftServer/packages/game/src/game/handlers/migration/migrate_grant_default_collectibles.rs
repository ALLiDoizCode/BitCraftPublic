use spacetimedb::{log, ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{authentication::Role, components::*, static_data::collectible_desc},
};

#[spacetimedb::reducer]
pub fn migrate_grant_default_collectibles(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    log::info!("Granting default collectibles to all players...");
    let cid: Vec<i32> = ctx
        .db
        .collectible_desc()
        .iter()
        .filter(|c| c.starting_loadout)
        .map(|c| c.id)
        .collect();

    let mut player_count = 0;
    for mut vault in ctx.db.vault_state().iter() {
        let player_id = vault.entity_id;
        let mut c = 0;

        for &id in &cid {
            if !vault.has_collectible(id) {
                if let Err(e) = vault.add_collectible(ctx, id, false) {
                    spacetimedb::log::error!("Error adding collectible {id} to player {player_id}: {e}");
                } else {
                    c += 1;
                }
            }
        }

        if c > 0 {
            player_count += 1;
            spacetimedb::log::info!("  Granted {c} collectibles to player {player_id}");
            ctx.db.vault_state().entity_id().update(vault);
        }
    }

    log::info!("Granted default collectibles to {player_count} players");

    Ok(())
}
