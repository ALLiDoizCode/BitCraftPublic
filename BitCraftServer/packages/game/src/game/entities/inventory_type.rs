#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum InventoryType {
    Player,
    Building,
    Deployable,
    LootChest,
    Dropped,
}
