use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::Role,
        components::{claim_local_state, claim_tech_state},
    },
};
use spacetimedb::{log, ReducerContext, Table};

#[spacetimedb::reducer]
pub fn admin_grant_all_claim_supplies(ctx: &ReducerContext, days_of_supplies: i32, dry_run: bool) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    let seconds = days_of_supplies * 24 * 60 * 60;

    for claim in ctx.db.claim_local_state().iter() {
        let max_supplies = ctx
            .db
            .claim_tech_state()
            .entity_id()
            .find(claim.entity_id)
            .unwrap()
            .max_supplies(ctx);
        let supplies = claim.supplies as f32;

        let resupply_value = (claim.get_required_supplies_for_seconds(ctx, seconds) as f32).min(max_supplies - supplies);

        if resupply_value > 0.0 {
            log::info!("Supplied claim {} for {} supplies", claim.entity_id, resupply_value);
            if !dry_run {
                let _ = claim.update_supplies_and_commit(ctx, resupply_value, false);
            }
        }
    }
    Ok(())
}
