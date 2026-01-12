use bitcraft_macro::shared_table_reducer;
use spacetimedb::*;

use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::Role,
        generic::{region_connection_info, region_sign_in_parameters, RegionConnectionInfo, RegionSignInParameters},
    },
};

#[shared_table_reducer]
#[spacetimedb::reducer]
pub fn import_region_connection_info(ctx: &ReducerContext, records: Vec<RegionConnectionInfo>) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    for id in ctx.db.region_connection_info().iter().map(|item| item.id) {
        ctx.db.region_connection_info().id().delete(&id);
    }
    let len: usize = records.len();
    log::info!("Will insert {} records of type RegionConnectionInfo", len);
    for record in records {
        RegionConnectionInfo::insert_shared(ctx, record, crate::inter_module::InterModuleDestination::AllOtherRegions);
    }
    log::info!("Inserted {} records of type RegionConnectionInfo", len);
    Ok(())
}

#[shared_table_reducer]
#[spacetimedb::reducer]
pub fn import_region_sign_in_parameters(ctx: &ReducerContext, records: Vec<RegionSignInParameters>) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    for id in ctx.db.region_sign_in_parameters().iter().map(|item| item.region_id) {
        ctx.db.region_sign_in_parameters().region_id().delete(&id);
    }
    let len: usize = records.len();
    log::info!("Will insert {} records of type RegionSignInParameters", len);
    for record in records {
        RegionSignInParameters::insert_shared(ctx, record, crate::inter_module::InterModuleDestination::AllOtherRegions);
    }
    log::info!("Inserted {} records of type RegionSignInParameters", len);
    Ok(())
}
