use spacetimedb::spacetimedb_lib::ScheduleAt;
use spacetimedb::{TimeDuration, Timestamp};
use std::time::Duration;

pub fn now_plus_secs(secs: u64, now: Timestamp) -> ScheduleAt {
    (now + TimeDuration::from(Duration::from_secs(secs))).into()
}

pub fn now_plus_millis(millis: u64, now: Timestamp) -> ScheduleAt {
    (now + TimeDuration::from(Duration::from_millis(millis))).into()
}

pub fn now_plus_secs_f32(secs: f32, now: Timestamp) -> ScheduleAt {
    (now + TimeDuration::from(Duration::from_secs_f32(secs))).into()
}

pub fn now_plus_duration(duration: Duration, now: Timestamp) -> ScheduleAt {
    (now + TimeDuration::from(duration)).into()
}
