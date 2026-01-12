use crate::game::autogen::_delete_entity::delete_entity;
use crate::game::handlers::cheats::cheat_type::{can_run_cheat, CheatType};

use spacetimedb::ReducerContext;

#[spacetimedb::reducer]
pub fn cheat_remove_entity_enemy(ctx: &ReducerContext, enemy_entity_id: u64) -> Result<(), String> {
    if !can_run_cheat(ctx, &ctx.sender, CheatType::CheatRemoveEntityEnemy) {
        return Err("Unauthorized.".into());
    }

    delete_entity(ctx, enemy_entity_id);

    Ok(())
}
