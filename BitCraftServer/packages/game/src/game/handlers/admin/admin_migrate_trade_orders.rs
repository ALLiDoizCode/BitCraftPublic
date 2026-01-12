use crate::messages::authentication::Role;
use crate::messages::components::trade_order_state;
use crate::{game::handlers::authentication::has_role, messages::game_util::ItemStack};
use spacetimedb::{log, ReducerContext, Table};

#[spacetimedb::reducer]
pub fn admin_migrate_trade_orders(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }

    let mut count = 0;
    for mut trade_order in ctx.db.trade_order_state().iter() {
        let mut edited = false;
        for cargo_id in &trade_order.offer_cargo_id {
            edited = true;
            trade_order.offer_items.push(ItemStack::single_cargo(*cargo_id));
        }
        for cargo_id in &trade_order.required_cargo_id {
            edited = true;
            trade_order.required_items.push(ItemStack::single_cargo(*cargo_id));
        }

        if edited {
            count += 1;
            ctx.db.trade_order_state().entity_id().update(trade_order);
        }

        log::info!("Edited {count} trade orders");
    }

    Ok(())
}
