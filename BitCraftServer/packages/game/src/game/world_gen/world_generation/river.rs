use std::collections::HashMap;

pub struct River {
    pub source_lake_index: usize,
    pub target_lake_index: usize,
    pub length: i32,
    pub source_node_index: i32,
    pub target_node_index: i32,
    pub path: Option<Vec<i32>>,
    pub elevation_by_node_index: Option<HashMap<i32, i16>>,
    pub water_level_by_node_index: Option<HashMap<i32, i16>>,
}

impl River {
    pub fn new(source_lake_index: usize, target_lake_index: usize) -> Self {
        Self {
            source_lake_index,
            target_lake_index,
            length: i32::MAX,
            source_node_index: -1,
            target_node_index: -1,
            path: None,
            elevation_by_node_index: None,
            water_level_by_node_index: None,
        }
    }
}
