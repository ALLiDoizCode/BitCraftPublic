use bitcraft_macro::shared_table_reducer;
use spacetimedb::ReducerContext;

use crate::{
    game::handlers::authentication::has_role,
    inter_module::InterModuleDestination,
    messages::{
        authentication::Role,
        generic::{region_sign_in_parameters, world_region_state, RegionSignInParameters},
    },
    unwrap_or_err,
};

#[shared_table_reducer]
#[spacetimedb::reducer]
pub fn admin_update_sign_in_parameters(
    ctx: &ReducerContext,
    region_sign_in_parameters: RegionSignInParameters,
    region: u8,
) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    if region > 0 {
        return update_sign_in_parameters(ctx, &region_sign_in_parameters, region);
    }

    let world_region_state = unwrap_or_err!(ctx.db.world_region_state().id().find(0), "Failed to WorldRegionState");
    for i in 1..=world_region_state.region_count {
        update_sign_in_parameters(ctx, &region_sign_in_parameters, i)?;
    }

    Ok(())
}

pub fn update_sign_in_parameters(
    ctx: &ReducerContext,
    region_sign_in_parameters: &RegionSignInParameters,
    region: u8,
) -> Result<(), String> {
    let mut existing = unwrap_or_err!(
        ctx.db.region_sign_in_parameters().region_id().find(region),
        "Failed to get SignInParameters for region with id: {}",
        region
    );

    existing.is_signing_in_blocked = region_sign_in_parameters.is_signing_in_blocked;
    existing.max_signed_in_players = region_sign_in_parameters.max_signed_in_players;
    existing.max_queue_length = region_sign_in_parameters.max_queue_length;
    existing.queue_length_tolerance = region_sign_in_parameters.queue_length_tolerance;
    existing.grace_period_seconds = region_sign_in_parameters.grace_period_seconds;

    RegionSignInParameters::update_shared(ctx, existing, InterModuleDestination::AllOtherRegions);

    Ok(())
}
