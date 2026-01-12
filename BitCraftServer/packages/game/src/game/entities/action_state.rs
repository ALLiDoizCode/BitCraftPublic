use spacetimedb::ReducerContext;

use crate::{game::game_state, ActionCooldown, ActionState};

impl ActionState {
    pub fn new(ctx: &ReducerContext, owner_entity_id: u64, action_id: i32) -> ActionState {
        let entity_id = game_state::create_entity(ctx);
        ActionState {
            entity_id,
            owner_entity_id,
            action_id,
            cooldown: ActionCooldown {
                timestamp: 0,
                cooldown: 0.0,
            },
        }
    }
}
