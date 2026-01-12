use crate::{ActionCooldown, CombatState};

impl CombatState {
    pub fn new(entity_id: u64, attack_ids: Vec<i32>) -> CombatState {
        let mut attack_cooldown = Vec::new();
        for _ in 0..attack_ids.len() {
            attack_cooldown.push(ActionCooldown {
                timestamp: 0,
                cooldown: 0.0,
            });
        }

        CombatState {
            entity_id,
            last_attacked_timestamp: 0,
            global_cooldown: Some(ActionCooldown {
                timestamp: 0,
                cooldown: 0.0,
            }),
            last_performed_action_entity_id: 0,
        }
    }
}
