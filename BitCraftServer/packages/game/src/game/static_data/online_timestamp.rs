use spacetimedb::Timestamp;
use crate::{game::game_state::unix, messages::game_util::OnlineTimestamp};

impl OnlineTimestamp {
    pub fn start(&mut self, now: Timestamp) {
        self.value = unix(now);
    }

    pub fn pause(&mut self, now: Timestamp) {
        if self.value != 0 {
            let new_value = unix(now) - self.value;

            // if new_value == 0 then pause was called within a second of start().
            // A value of 0 is indistinguishable from a missing value in protobuf.
            // To keep the information that this was a true 0 we set to -1 (this is sad)
            self.value = if new_value == 0 { -1 } else { new_value };
        }
    }

    pub fn restart(&mut self, now: Timestamp) {
        self.value = match self.value {
            0 => 0,
            -1 => unix(now),
            _ => unix(now) - self.value,
        };
    }
}
