use crate::messages::static_data::EnemyType;

impl EnemyType {
    pub fn to_enum(value: i32) -> EnemyType {
        unsafe { std::mem::transmute(value) }
    }
}
