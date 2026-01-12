use crate::messages::static_data::EquipmentSlot;

impl EquipmentSlot {
    pub fn item_id(&self) -> i32 {
        if let Some(item) = self.item {
            return item.item_id;
        }
        0
    }
}
