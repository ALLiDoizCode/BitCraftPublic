use crate::messages::static_data::{FootprintTile, FootprintType};

impl FootprintTile {
    pub fn is_compatible(existing: &FootprintType, new: &FootprintType) -> bool {
        match (*existing, *new) {
            (FootprintType::Hitbox, _) => false,
            (FootprintType::Walkable, _) => false,
            (FootprintType::WalkableResource, _) => true,
            (FootprintType::Perimeter, FootprintType::Hitbox) => false,
            (FootprintType::Perimeter, FootprintType::Walkable) => false,
            (FootprintType::Perimeter, FootprintType::Perimeter) => true,
            (FootprintType::Perimeter, FootprintType::WalkableResource) => true,
        }
    }
}
