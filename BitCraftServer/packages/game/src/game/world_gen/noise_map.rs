use super::super::unity_helpers::vector2int::Vector2Int;
use super::noise_helper;
use super::noise_specs::NoiseSpecs;
use crate::game::unity_helpers::float_helper::f32::half_to_even;

#[derive(Default, Debug)]
pub struct NoiseMap {
    pub size: Vector2Int,
    pub step: i32,

    is_computed: bool,
    noise: Vec<Vec<f32>>,
}

impl NoiseMap {
    pub fn new() -> Self {
        Self {
            is_computed: false,
            ..Default::default()
        }
    }

    pub fn is_computed(&self) -> bool {
        self.is_computed
    }

    pub fn compute(&mut self, specs: &NoiseSpecs, step: i32, size: Vector2Int) {
        self.is_computed = true;
        self.size = size;
        self.step = step;

        let (width, depth) = self.get_array_dimensions();

        self.noise = noise_helper::get_map(
            width,
            depth,
            specs.seed,
            specs.scale * step as f32,
            specs.octaves,
            specs.persistance,
            specs.lacunarity,
            specs.offset,
        );
    }

    pub fn get_array_dimensions(&self) -> (i32, i32) {
        (self.size.x / self.step, self.size.y / self.step)
    }

    pub fn get(&self, x: f32, y: f32) -> f32 {
        if !self.is_computed {
            panic!("Need to compute first");
        }
        let i = half_to_even(x) as i32 / self.step;
        let j = half_to_even(y) as i32 / self.step;

        if i < 0 || i >= self.noise.len() as i32 || j < 0 || j >= self.noise[0].len() as i32 {
            return 0f32;
        }

        self.noise[i as usize][j as usize]
    }

    pub fn get_at_index(&self, x: i32, y: i32) -> f32 {
        if !self.is_computed {
            panic!("Need to compute first");
        }
        self.noise[x as usize][y as usize]
    }

    pub fn set_at_index(&mut self, x: i32, y: i32, val: f32) {
        if !self.is_computed {
            panic!("Need to compute first");
        }
        self.noise[x as usize][y as usize] = val;
    }
}
