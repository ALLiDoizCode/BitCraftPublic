use spacetimedb::{ReducerContext, Table};

use crate::{
    game::handlers::{authentication::has_role, claim::claim_tech_unlock_tech::unlock_claim_tech},
    messages::{authentication::Role, components::*},
};

#[spacetimedb::reducer]
pub fn migrate_claim_tech(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    crate::game::handlers::cheats::cheat_claim_totem::cheat_claims_complete_all_current_research(ctx)?;

    spacetimedb::log::info!("Migrating {} claim techs", ctx.db.claim_tech_state().count());
    for mut claim_tech in ctx.db.claim_tech_state().iter() {
        if claim_tech.learned.contains(&200) {
            //Tier 2
            unlock_claim_tech(ctx, &mut claim_tech, 748616905, false); //Town Bank
        }
        if claim_tech.learned.contains(&300) {
            //Tier 3
            unlock_claim_tech(ctx, &mut claim_tech, 1300921803, false); //Tier 3 Settlement
            unlock_claim_tech(ctx, &mut claim_tech, 611825682, false); //Large Houses
        }
        if claim_tech.learned.contains(&400) {
            //Tier 4
            unlock_claim_tech(ctx, &mut claim_tech, 1272742983, false); //Tier 4 Settlement
            unlock_claim_tech(ctx, &mut claim_tech, 2111626185, false); //Town Marketplace
        }
        if claim_tech.learned.contains(&500) {
            //Tier 5
            unlock_claim_tech(ctx, &mut claim_tech, 225112729, false); //Tier 5 Settlement
        }
        if claim_tech.learned.contains(&600) {
            //Tier 6
            unlock_claim_tech(ctx, &mut claim_tech, 1425977115, false); //Tier 6 Settlement
        }
        if claim_tech.learned.contains(&700) {
            //Tier 7
            unlock_claim_tech(ctx, &mut claim_tech, 315153795, false); //Tier 7 Settlement
        }
        if claim_tech.learned.contains(&800) {
            //Tier 8
            unlock_claim_tech(ctx, &mut claim_tech, 2029414118, false); //Tier 8 Settlement
        }
        if claim_tech.learned.contains(&900) {
            //Tier 9
            unlock_claim_tech(ctx, &mut claim_tech, 760073735, false); //Tier 9 Settlement
        }
        if claim_tech.learned.contains(&1000) {
            //Tier 10
            unlock_claim_tech(ctx, &mut claim_tech, 1091470477, false); //Tier 10 Settlement
        }

        ctx.db.claim_tech_state().entity_id().update(claim_tech);
    }
    spacetimedb::log::info!("Claim techs migrated");

    Ok(())
}
