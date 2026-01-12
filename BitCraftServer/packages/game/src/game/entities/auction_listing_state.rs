use spacetimedb::{ReducerContext, Table};

use crate::{
    game::game_state,
    messages::{
        components::{buy_order_state, closed_listing_state, sell_order_state, AuctionListingState, ClosedListingState},
        game_util::{ItemStack, ItemType},
    },
};

impl AuctionListingState {
    pub fn cancel_sell_order(&self, ctx: &ReducerContext) {
        let refunded_items = ClosedListingState {
            entity_id: game_state::create_entity(ctx),
            owner_entity_id: self.owner_entity_id,
            claim_entity_id: self.claim_entity_id,
            item_stack: ItemStack::new(ctx, self.item_id, ItemType::to_enum(self.item_type), self.quantity),
            timestamp: ctx.timestamp,
        };
        ctx.db.closed_listing_state().insert(refunded_items);
        ctx.db.sell_order_state().entity_id().delete(self.entity_id);
    }

    pub fn cancel_buy_order(&self, ctx: &ReducerContext) {
        // Refund coins
        let refunded_items = ClosedListingState {
            entity_id: game_state::create_entity(ctx),
            owner_entity_id: self.owner_entity_id,
            claim_entity_id: self.claim_entity_id,
            item_stack: ItemStack::hex_coins(self.stored_coins),
            timestamp: ctx.timestamp,
        };
        ctx.db.closed_listing_state().insert(refunded_items);
        ctx.db.buy_order_state().entity_id().delete(self.entity_id);
    }
}
