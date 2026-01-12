use super::super::unity_helpers::{rectint::RectInt, vector2::Vector2, vector2int::Vector2Int};
use super::noise_map::NoiseMap;
use super::noise_specs::NoiseSpecs;
use super::world_definition;
use crate::game::unity_helpers::float_helper::f32::{half_to_even, inverse_lerp};
use crate::messages::world_gen::WorldGenLandShapeDefinition;

#[derive(Debug)]
pub struct LandShapeDefinition {
    pub bounds: RectInt,
    pub land_threshold: f32,
    pub noise_specs: NoiseSpecs,

    water: Vec<Vec<bool>>,
    noise: NoiseMap,
}

impl LandShapeDefinition {
    pub fn new(land_shape_definition: &WorldGenLandShapeDefinition) -> Self {
        Self {
            bounds: land_shape_definition.bounds.clone(),
            land_threshold: land_shape_definition.land_threshold,
            noise_specs: NoiseSpecs::new(&land_shape_definition.noise_specs, 20000f32),
            water: Vec::new(),
            noise: NoiseMap::new(),
        }
    }

    pub fn compute(&mut self) {
        let step = world_definition::STEP;
        self.noise.compute(
            &self.noise_specs,
            step,
            Vector2Int {
                x: self.bounds.width,
                y: self.bounds.height,
            },
        );
        let (width, depth) = self.noise.get_array_dimensions();
        self.water = vec![vec![false; depth as usize]; width as usize]; //Is this really how you make 2d arrays?! (╥_╥)

        let h_width = width as f32 * 0.5;
        let h_depth = depth as f32 * 0.5;
        let r_width = 1.0 / (width as f32 * 0.4);
        let r_depth = 1.0 / (depth as f32 * 0.4);
        for i in 0..width {
            for j in 0..depth {
                let x = i as f32 - h_width;
                let y = j as f32 - h_depth;
                let dx = x * r_width;
                let dy = y * r_depth;
                let sqr_distance = dx * dx + dy * dy;

                let n = self.noise.get_at_index(i, j) - 0.4 * sqr_distance;

                if n < self.land_threshold {
                    self.water[i as usize][j as usize] = true;
                    self.noise.set_at_index(i, j, inverse_lerp(0.0, self.land_threshold, n));
                } else {
                    //self.water[i as usize][j as usize] = false;
                    self.noise.set_at_index(i, j, inverse_lerp(self.land_threshold, 1.0, n));
                }
            }
        }
    }

    pub fn is_water(&self, x: f32, y: f32) -> bool {
        if !self.noise.is_computed() {
            panic!("Need to compute first");
        }
        let i = half_to_even(x - self.bounds.x as f32) as i32 / self.noise.step;
        let j = half_to_even(y - self.bounds.y as f32) as i32 / self.noise.step;

        if i < 0 || i >= self.water.len() as i32 || j < 0 || j >= self.water[0].len() as i32 {
            return true;
        }

        self.water[i as usize][j as usize]
    }

    pub fn is_water_vec2(&self, position: Vector2) -> bool {
        self.is_water(position.x, position.y)
    }

    pub fn get(&self, x: f32, y: f32) -> f32 {
        self.noise.get(x - self.bounds.x as f32, y - self.bounds.y as f32)
    }

    pub fn get_vec2(&self, position: Vector2) -> f32 {
        self.get(position.x, position.y)
    }
}
