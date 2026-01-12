use spacetimedb::{Identity, ReducerContext};

use crate::messages::{
    generic::HubItemType,
    global::granted_hub_item_state,
    inter_module::{GrantHubItemMsg, MessageContentsV3},
};

use super::send_inter_module_message;

pub fn send_message(
    ctx: &ReducerContext,
    player_identity: Identity,
    item_type: HubItemType,
    item_id: i32,
    quantity: u32,
    region_id: u8,
) -> Result<(), String> {
    let msg = GrantHubItemMsg {
        player_identity,
        item_type,
        item_id,
        quantity,
    };

    send_inter_module_message(
        ctx,
        MessageContentsV3::GrantHubItem(msg),
        super::InterModuleDestination::Region(region_id),
    );

    return Ok(());
}

pub fn handle_destination_result_on_sender(ctx: &ReducerContext, request: GrantHubItemMsg, error: Option<String>) {
    if error.is_some() {
        if let Some(mut granted_hub_item_state) = ctx
            .db
            .granted_hub_item_state()
            .identity_and_item_id()
            .filter((request.player_identity, request.item_id))
            .find(|x| x.item_type == request.item_type)
        {
            granted_hub_item_state.balance -= request.quantity;
            ctx.db.granted_hub_item_state().entity_id().update(granted_hub_item_state);
        }
    }
}
