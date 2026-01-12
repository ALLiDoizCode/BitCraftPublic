use std::collections::HashMap;

use crate::game::handlers::authentication::has_role;
use crate::messages::authentication::Role;
use crate::messages::empire_shared::{empire_chunk_state, empire_state};
use spacetimedb::{log, ReducerContext, Table};

#[spacetimedb::reducer]
pub fn log_empire_leaderboard(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    let mut territory_counts: HashMap<u64, usize> = HashMap::new();

    ctx.db
        .empire_chunk_state()
        .iter()
        .filter_map(|c| {
            if c.empire_entity_id.len() == 1 {
                Some(c.empire_entity_id[0])
            } else {
                None
            }
        })
        .for_each(|empire_entity_id| {
            *territory_counts.entry(empire_entity_id).or_insert(0) += 1;
        });

    // Collect counts into a vector and sort by frequency (descending)
    let mut territory_counts: Vec<(u64, usize)> = territory_counts.into_iter().collect();
    territory_counts.sort_by(|a, b| b.1.cmp(&a.1));

    log::info!("Empire Ranking");
    log::info!("|        Empire Name        |  Territory Count  |");
    for (empire_entity_id, count) in territory_counts {
        if let Some(state) = ctx.db.empire_state().entity_id().find(&empire_entity_id) {
            if state.name.len() >= 26 {
                log::info!("| {}|{:18} |", &state.name[0..26], count);
            } else {
                log::info!("| {:26}|{:18} |", &state.name, count);
            }
        }
    }
    Ok(())
}
