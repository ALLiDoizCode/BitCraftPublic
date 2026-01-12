use std::time::Duration;

use spacetimedb::{ReducerContext, Table};

#[spacetimedb::table(name = on_durability_zero_timer, public, scheduled(on_durability_zero, at = scheduled_at), 
    index(name = player_entity_id, btree(columns = [player_entity_id])))]
pub struct OnDurabilityZeroTimer {
    #[primary_key]
    #[auto_inc]
    pub scheduled_id: u64,
    pub scheduled_at: spacetimedb::ScheduleAt,

    pub player_entity_id: u64,
    pub broken_item_id: i32,
    pub convert_into: i32,
    pub still_equipped: bool,
    pub added_to_inventory: bool,
}

impl OnDurabilityZeroTimer {
    pub fn schedule(
        ctx: &ReducerContext,
        player_entity_id: u64,
        broken_item_id: i32,
        convert_into: i32,
        still_equipped: bool,
        added_to_inventory: bool,
    ) {
        let timer = OnDurabilityZeroTimer {
            scheduled_id: 0,
            scheduled_at: (Duration::ZERO).into(),
            player_entity_id,
            broken_item_id,
            convert_into,
            still_equipped,
            added_to_inventory,
        };
        ctx.db.on_durability_zero_timer().insert(timer);
    }
}

#[spacetimedb::reducer]
pub fn on_durability_zero(_ctx: &ReducerContext, _timer: OnDurabilityZeroTimer) -> Result<(), String> {
    // This is only launched to get the required data on the client
    Ok(())
}
