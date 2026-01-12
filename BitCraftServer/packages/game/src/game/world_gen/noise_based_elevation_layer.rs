use crate::{
    game::unity_helpers::vector2int::Vector2Int,
    messages::world_gen::{WorldGenNoiseBasedElevationLayer, WorldGenNoiseBasedElevationLayerBlendingMode},
};

use super::noise_specs::NoiseSpecs;

#[derive(Debug)]
pub struct NoiseBasedElevationLayer {
    pub blending_mode: BlendingMode,
    pub threshold: f32,
    pub range: Vector2Int,
    pub noise: NoiseSpecs,
}

impl NoiseBasedElevationLayer {
    pub fn new(noise_based_elevation_layer: WorldGenNoiseBasedElevationLayer) -> Self {
        Self {
            blending_mode: Self::convert_blending_mode(noise_based_elevation_layer.blending_mode),
            threshold: noise_based_elevation_layer.threshold,
            range: noise_based_elevation_layer.range,
            noise: NoiseSpecs::new(&noise_based_elevation_layer.noise, 100000f32),
        }
    }

    fn convert_blending_mode(blending_mode: WorldGenNoiseBasedElevationLayerBlendingMode) -> BlendingMode {
        match blending_mode {
            WorldGenNoiseBasedElevationLayerBlendingMode::Add => BlendingMode::Add,
            WorldGenNoiseBasedElevationLayerBlendingMode::Override => BlendingMode::Override,
        }
    }
}

#[derive(Debug)]
pub enum BlendingMode {
    Add,
    Override,
}
