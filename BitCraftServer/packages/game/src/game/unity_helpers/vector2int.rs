use crate::messages::world_gen::WorldGenVector2Int;

pub type Vector2Int = WorldGenVector2Int;

impl std::ops::Add<Vector2Int> for Vector2Int {
    type Output = Vector2Int;

    fn add(self, other: Vector2Int) -> Vector2Int {
        Vector2Int {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

impl std::ops::Add<&Vector2Int> for Vector2Int {
    type Output = Vector2Int;

    fn add(self, other: &Vector2Int) -> Vector2Int {
        Vector2Int {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

impl std::ops::Sub<Vector2Int> for Vector2Int {
    type Output = Vector2Int;

    fn sub(self, other: Vector2Int) -> Vector2Int {
        Vector2Int {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}

impl std::ops::Sub<&Vector2Int> for Vector2Int {
    type Output = Vector2Int;

    fn sub(self, other: &Vector2Int) -> Vector2Int {
        Vector2Int {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}

impl std::ops::Mul<i32> for Vector2Int {
    type Output = Vector2Int;

    fn mul(self, other: i32) -> Vector2Int {
        Vector2Int {
            x: self.x * other,
            y: self.y * other,
        }
    }
}

impl std::ops::Mul<Vector2Int> for Vector2Int {
    type Output = Vector2Int;

    fn mul(self, other: Vector2Int) -> Vector2Int {
        Vector2Int {
            x: self.x * other.x,
            y: self.y * other.y,
        }
    }
}

impl std::ops::Div<i32> for Vector2Int {
    type Output = Vector2Int;

    fn div(self, other: i32) -> Vector2Int {
        Vector2Int {
            x: self.x / other,
            y: self.y / other,
        }
    }
}

impl std::marker::Copy for Vector2Int {}

impl Vector2Int {
    pub fn new(x: i32, y: i32) -> Self {
        Self { x, y }
    }
}
