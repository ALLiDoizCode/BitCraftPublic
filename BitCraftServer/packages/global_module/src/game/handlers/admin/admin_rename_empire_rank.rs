use bitcraft_macro::shared_table_reducer;
use spacetimedb::{ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    inter_module::InterModuleDestination,
    messages::{
        authentication::Role,
        empire_shared::{empire_rank_state, empire_state, EmpireRankState},
    },
    unwrap_or_err,
};

#[spacetimedb::reducer]
pub fn admin_rename_empire_rank(ctx: &ReducerContext, empire_name: String, rank: u8, new_name: String) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Gm) {
        return Err("Unauthorized".into());
    }

    let name_lower = empire_name.to_lowercase();
    let entity_id = unwrap_or_err!(
        ctx.db.empire_state().iter().filter(|e| e.name.to_lowercase() == name_lower).next(),
        "Empire not found"
    )
    .entity_id;

    admin_rename_empire_rank_entity(ctx, entity_id, rank, new_name)
}

#[shared_table_reducer]
#[spacetimedb::reducer]
pub fn admin_rename_empire_rank_entity(ctx: &ReducerContext, empire_entity_id: u64, rank: u8, new_name: String) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Gm) {
        return Err("Unauthorized".into());
    }

    let mut empire = unwrap_or_err!(
        ctx.db.empire_rank_state().empire_rank().filter((empire_entity_id, rank)).next(),
        "Empire rank not found"
    );
    empire.title = new_name;
    EmpireRankState::update_shared(ctx, empire, InterModuleDestination::AllOtherRegions);

    Ok(())
}
