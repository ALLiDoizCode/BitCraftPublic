use spacetimedb::{Identity, ReducerContext};

use crate::{
    messages::{
        components::{user_state, vault_state},
        inter_module::GrantHubItemMsg,
    },
    unwrap_or_err,
};

pub fn process_message_on_destination(ctx: &ReducerContext, request: GrantHubItemMsg) -> Result<(), String> {
    match request.item_type {
        crate::messages::generic::HubItemType::Collectible => {
            grant_collectible(ctx, request.player_identity, request.item_id, request.quantity)
        }
        _ => panic!("HubItemType {:?} is unhandled", request.item_type),
    }
}

fn grant_collectible(ctx: &ReducerContext, player_identity: Identity, item_id: i32, quantity: u32) -> Result<(), String> {
    let user_state = unwrap_or_err!(ctx.db.user_state().identity().find(player_identity), "Unknown user");
    let mut vault_state = unwrap_or_err!(ctx.db.vault_state().entity_id().find(user_state.entity_id), "Unknown vault state");

    for _i in 0..quantity {
        // When we grant hub items, we want to add locked collectibles even if already present
        match vault_state.add_collectible(ctx, item_id, true) {
            Err(err) => {
                if err == "Collectible doesn't exist" {
                    return Err(err);
                }
            }
            _ => (), // Locked duplicate or successful, doesn't matter if we try adding more than 1.
        };
    }

    ctx.db.vault_state().entity_id().update(vault_state);

    Ok(())
}
