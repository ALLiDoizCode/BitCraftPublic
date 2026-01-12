use spacetimedb::Timestamp;
use crate::{game::game_state, messages::components::AttackOutcomeState};

impl AttackOutcomeState {
    pub fn new(entity_id: u64) -> AttackOutcomeState {
        AttackOutcomeState {
            entity_id,
            last_attacked_timestamp: 0,
            damage: 0,
            crit_result: false,
            dodge_result: false,
        }
    }

    pub fn set(&mut self, damage: i32, crit_result: bool, dodge_result: bool, now: Timestamp) {
        self.last_attacked_timestamp = game_state::unix_ms(now);
        self.damage = damage;
        self.crit_result = crit_result;
        self.dodge_result = dodge_result;
    }
}
