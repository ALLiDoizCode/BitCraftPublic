use spacetimedb::{rand::Rng, ReducerContext};

use crate::messages::{
    game_util::{ItemStack, ItemType},
    static_data::LootTableDesc,
};

impl LootTableDesc {
    pub fn roll(&self, ctx: &ReducerContext, verbose: bool) -> Vec<ItemStack> {
        let mut items: Vec<ItemStack> = Vec::new();

        for loot_item_stack in &self.loot_item_stacks {
            if verbose {
                spacetimedb::log::debug!(
                    "---- Loot Item Roll id: {}, probability: {}",
                    loot_item_stack.item_stack.as_ref().unwrap().item_id,
                    loot_item_stack.probability
                );
            }

            if ctx.rng().gen_range(0.0..1.0) <= loot_item_stack.probability {
                let item_stack = loot_item_stack.item_stack.as_ref().unwrap();
                items.push(ItemStack::new(ctx, item_stack.item_id, ItemType::Item, item_stack.quantity));

                if verbose {
                    spacetimedb::log::debug!("-- Loot Item Roll selected id: {}", item_stack.item_id);
                }
            }
        }

        items
    }
}
