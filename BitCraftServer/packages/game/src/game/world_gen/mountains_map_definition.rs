use super::super::unity_helpers::{animation_curve::AnimationCurve, vector2::Vector2};

#[derive(Debug)]
pub struct Mountain {
    pub center: Vector2,
    pub radius: f32,
    pub height: i32,
    pub peak_offset: Vector2,
    pub shape: AnimationCurve,
}

#[derive(Debug)]
pub struct MountainsMapDefinition {
    pub mountains: Vec<Mountain>,
}

impl MountainsMapDefinition {
    pub fn count(&self) -> i32 {
        self.mountains.len() as i32
    }

    pub fn get(&self, i: i32) -> &Mountain {
        &self.mountains[i as usize]
    }
}
