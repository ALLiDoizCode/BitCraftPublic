use spacetimedb::{log, ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::Role,
        components::character_stats_state,
        static_data::{character_stat_desc, CharacterStatType},
    },
};

#[spacetimedb::reducer]
pub fn migrate_character_stats(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let construction_stat = ctx
        .db
        .character_stat_desc()
        .stat_type()
        .find(CharacterStatType::ConstructionPower as i32)
        .unwrap();
    let default_value = construction_stat.value;

    let mut count = 0;
    for mut character_stats_state in ctx.db.character_stats_state().iter() {
        if character_stats_state.values.len() <= CharacterStatType::ConstructionPower as usize {
            character_stats_state.values.push(default_value);
            ctx.db.character_stats_state().entity_id().update(character_stats_state);
            count += 1;
        }
    }
    log::info!("Migrated {count} players");

    Ok(())
}
