use spacetimedb::{rand::Rng, ReducerContext};

use crate::messages::game_util::{ItemStack, ProbabilisticItemStack};

impl ProbabilisticItemStack {
    pub fn roll(&self, ctx: &ReducerContext, count: i32) -> Option<ItemStack> {
        // Items gained is proportional to damage done (factoring crit and tool power)
        if let Some(item_stack) = &self.item_stack {
            let increment = item_stack.quantity;
            let mut quantity = 0;

            for _ in 0..count {
                let roll = ctx.rng().gen_range(0.0..=1.0);
                if roll <= self.probability {
                    quantity += increment;
                }
            }
            return if quantity > 0 {
                // We assume a non damaged item stack when rolled from a probabilistic item stack
                Some(ItemStack::new(ctx, item_stack.item_id, item_stack.item_type, quantity))
            } else {
                None
            };
        }
        None
    }
}
