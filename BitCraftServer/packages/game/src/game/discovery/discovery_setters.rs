use spacetimedb::{log, ReducerContext, Table};

use super::Discovery;
use crate::{
    cargo_desc, construction_recipe_desc_v2, crafting_recipe_desc, extraction_recipe_desc, item_desc, item_list_desc,
    messages::{components::*, game_util::ItemType, static_data::pillar_shaping_desc},
    paving_tile_desc, resource_placement_recipe_desc_v2,
};

impl Discovery {
    pub(super) fn knowledge_entry_array_hash(entries: &Vec<KnowledgeEntry>) -> i32 {
        entries.iter().filter(|e| e.state == KnowledgeState::Acquired).count() as i32 * 10000
            + entries.iter().filter(|e| e.state == KnowledgeState::Discovered).count() as i32
    }

    pub(super) fn location_entry_array_hash(entries: &Vec<KnowledgeLocationEntry>) -> i32 {
        entries.iter().filter(|e| e.state == KnowledgeState::Acquired).count() as i32 * 10000
            + entries.iter().filter(|e| e.state == KnowledgeState::Discovered).count() as i32
    }

    #[allow(dead_code)]
    pub(super) fn entity_entry_array_hash(entries: &Vec<KnowledgeEntityEntry>) -> i32 {
        entries.iter().filter(|e| e.state == KnowledgeState::Acquired).count() as i32 * 10000
            + entries.iter().filter(|e| e.state == KnowledgeState::Discovered).count() as i32
    }

    pub(super) fn discover_construction_recipe_components(&mut self, ctx: &ReducerContext, recipe_id: i32) {
        if let Some(recipe) = ctx.db.construction_recipe_desc_v2().id().find(&recipe_id) {
            // discover produced building
            self.discover_building(ctx, recipe.building_description_id);
            // discover required items
            for i in &recipe.consumed_item_stacks {
                self.discover_item_and_item_list(ctx, i.item_id);
            }
            // discover required cargos
            for i in &recipe.consumed_cargo_stacks {
                self.discover_cargo(ctx, i.item_id);
            }
        }
    }

    pub(super) fn discover_resource_placement_recipe_components(&mut self, ctx: &ReducerContext, recipe_id: i32) {
        if let Some(recipe) = ctx.db.resource_placement_recipe_desc_v2().id().find(&recipe_id) {
            // discover produced resource
            self.discover_resource(ctx, recipe.resource_description_id);
            // discover required items
            for i in &recipe.consumed_item_stacks {
                self.discover_item_and_item_list(ctx, i.item_id);
            }
            // discover required cargos
            for i in &recipe.consumed_cargo_stacks {
                self.discover_cargo(ctx, i.item_id);
            }
        }
    }

    // discover crafting recipe required/comsumed elements
    pub(super) fn discover_craft_recipe_components(&mut self, ctx: &ReducerContext, recipe_id: i32) {
        if let Some(recipe) = ctx.db.crafting_recipe_desc().id().find(&recipe_id) {
            // discover produced items
            for i in &recipe.crafted_item_stacks {
                if i.item_type == ItemType::Cargo {
                    self.discover_cargo(ctx, i.item_id);
                } else {
                    self.discover_item_and_item_list(ctx, i.item_id);
                }
            }
            // discover required items and cargos
            for i in &recipe.consumed_item_stacks {
                if i.item_type == ItemType::Item {
                    self.discover_item_and_item_list(ctx, i.item_id);
                } else {
                    self.discover_cargo(ctx, i.item_id);
                }
            }
        }
    }

    // discover construction recipe required/comsumed elements
    pub(super) fn discover_extract_recipe_components(&mut self, ctx: &ReducerContext, recipe_id: i32) {
        if let Some(recipe) = ctx.db.extraction_recipe_desc().id().find(&recipe_id) {
            // discover all extracted items
            for i in &recipe.extracted_item_stacks {
                let item_stack = i.item_stack.as_ref().unwrap();
                if item_stack.item_type == ItemType::Cargo {
                    self.discover_cargo(ctx, item_stack.item_id);
                } else {
                    self.discover_item_and_item_list(ctx, item_stack.item_id);
                }
            }
            // discover consumed items/cargos
            for i in &recipe.consumed_item_stacks {
                if i.item_type == ItemType::Cargo {
                    self.discover_cargo(ctx, i.item_id);
                } else {
                    self.discover_item_and_item_list(ctx, i.item_id);
                }
            }
        }
    }

    // discover paving recipe required/comsumed elements (assuming it's discovered by a discovery trigger)
    pub(super) fn discover_paving_recipe_components(&mut self, ctx: &ReducerContext, recipe_id: i32) {
        if let Some(recipe) = ctx.db.paving_tile_desc().id().find(&recipe_id) {
            // discover all extracted items
            for i in &recipe.consumed_item_stacks {
                self.discover_item_and_item_list(ctx, i.item_id);
            }
            // discover consumed items/cargos
            if recipe.input_cargo_id != 0 {
                self.discover_cargo(ctx, recipe.input_cargo_id);
            }
        }
    }

    pub(super) fn discover_pillar_shaping_recipe_components(&mut self, ctx: &ReducerContext, recipe_id: i32) {
        if let Some(recipe) = ctx.db.pillar_shaping_desc().id().find(&recipe_id) {
            // discover all extracted items
            for i in &recipe.consumed_item_stacks {
                self.discover_item_and_item_list(ctx, i.item_id);
            }
            // discover consumed items/cargos
            if recipe.input_cargo_id != 0 {
                self.discover_cargo(ctx, recipe.input_cargo_id);
            }
        }
    }

    pub(super) fn on_item_acquired(&mut self, ctx: &ReducerContext, item_id: i32) {
        if let Some(recipe) = ctx.db.item_desc().id().find(&item_id) {
            // acquire secondary knowledge from acquiring an item
            if recipe.secondary_knowledge_id != 0 {
                self.acquire_secondary(ctx, recipe.secondary_knowledge_id);
            }
        }
    }

    pub(super) fn on_cargo_acquired(&mut self, ctx: &ReducerContext, cargo_id: i32) {
        if let Some(recipe) = ctx.db.cargo_desc().id().find(&cargo_id) {
            // acquire secondary knowledge from acquiring a cargo
            if recipe.secondary_knowledge_id != 0 {
                self.acquire_secondary(ctx, recipe.secondary_knowledge_id);
            }
        }
    }

    fn evaluate_craft_discoveries(&mut self, ctx: &ReducerContext) {
        for recipe in ctx.db.crafting_recipe_desc().iter() {
            if !self.has_discovered_craft(recipe.id) {
                let mut discover_recipe = false;

                // any discovery trigger overrides all
                for dt_id in &recipe.discovery_triggers {
                    if self.has_acquired_secondary(*dt_id) {
                        discover_recipe = true;
                    }
                }

                // player is missing mandatory secondary knowledge
                let mut has_all_required_knowledges = true;
                for k_id in &recipe.required_knowledges {
                    has_all_required_knowledges &= self.has_acquired_secondary(*k_id);
                }

                if has_all_required_knowledges {
                    // score all items discoveries
                    let mut max_score = 0;
                    let mut score = 0;
                    for item_stack in &recipe.consumed_item_stacks {
                        if item_stack.discovery_score > 0 {
                            max_score += item_stack.discovery_score;
                            if item_stack.item_type == ItemType::Item {
                                if self.has_acquired_item(item_stack.item_id) {
                                    score += item_stack.discovery_score;
                                }
                            } else {
                                if self.has_acquired_cargo(item_stack.item_id) {
                                    score += item_stack.discovery_score;
                                }
                            }
                        }
                    }

                    let max_value = recipe.full_discovery_score.min(max_score);
                    if max_value > 0 {
                        // discover recipe if enough discovery points is scored (capping to what's possible to get in the columns)
                        if score >= recipe.full_discovery_score.min(max_score) {
                            discover_recipe = true;
                        }
                    }
                }

                if discover_recipe {
                    self.discover_craft(ctx, recipe.id);
                }
            }
        }
    }

    fn evaluate_construction_discoveries(&mut self, ctx: &ReducerContext) {
        for recipe in ctx.db.construction_recipe_desc_v2().iter() {
            if !self.has_discovered_construction(recipe.id) {
                let mut discover_recipe = false;

                // any discovery trigger overrides all
                for dt_id in &recipe.discovery_triggers {
                    if self.has_acquired_secondary(*dt_id) {
                        discover_recipe = true;
                    }
                }

                // player is missing mandatory secondary knowledge
                let mut has_all_required_knowledges = true;
                for k_id in &recipe.required_knowledges {
                    has_all_required_knowledges &= self.has_acquired_secondary(*k_id);
                }

                if has_all_required_knowledges {
                    // score all items discoveries
                    let mut max_score = 0;
                    let mut score = 0;
                    for item_stack in &recipe.consumed_item_stacks {
                        if item_stack.discovery_score > 0 {
                            max_score += item_stack.discovery_score;
                            if self.has_acquired_item(item_stack.item_id) {
                                score += item_stack.discovery_score;
                            }
                        }
                    }
                    for cargo_stack in &recipe.consumed_cargo_stacks {
                        if cargo_stack.discovery_score > 0 {
                            max_score += cargo_stack.discovery_score;
                            if self.has_acquired_cargo(cargo_stack.item_id) {
                                score += cargo_stack.discovery_score;
                            }
                        }
                    }

                    let req_value = recipe.full_discovery_score.min(max_score);
                    if req_value > 0 {
                        // discover recipe if enough discovery points is scored (capping to what's possible to get in the columns)
                        if score >= req_value {
                            discover_recipe = true;
                        }
                    }
                }

                if discover_recipe {
                    self.discover_construction(ctx, recipe.id);
                }
            }
        }
    }

    fn evaluate_pillar_shaping_discoveries(&mut self, ctx: &ReducerContext) {
        for recipe in ctx.db.pillar_shaping_desc().iter() {
            if !self.has_discovered_pillar_shaping(recipe.id) {
                let mut discover_recipe = false;

                // any discovery trigger overrides all
                for dt_id in &recipe.discovery_triggers {
                    if self.has_acquired_secondary(*dt_id) {
                        discover_recipe = true;
                    }
                }

                // player is missing mandatory secondary knowledge
                let mut has_all_required_knowledges = true;
                for k_id in &recipe.required_knowledges {
                    has_all_required_knowledges &= self.has_acquired_secondary(*k_id);
                }

                if has_all_required_knowledges {
                    // score all items discoveries
                    let mut max_score = 0;
                    let mut score = 0;
                    for item_stack in &recipe.consumed_item_stacks {
                        if item_stack.discovery_score > 0 {
                            max_score += item_stack.discovery_score;
                            if item_stack.item_type == ItemType::Item {
                                if self.has_acquired_item(item_stack.item_id) {
                                    score += item_stack.discovery_score;
                                }
                            } else {
                                if self.has_acquired_cargo(item_stack.item_id) {
                                    score += item_stack.discovery_score;
                                }
                            }
                        }
                    }

                    let req_value = recipe.full_discovery_score.min(max_score);
                    if req_value > 0 {
                        // discover recipe if enough discovery points is scored (capping to what's possible to get in the columns)
                        if score >= req_value {
                            discover_recipe = true;
                        }
                    }
                }

                if discover_recipe {
                    self.discover_pillar_shaping(ctx, recipe.id);
                }
            }
        }
    }

    fn evaluate_resource_placement_discoveries(&mut self, ctx: &ReducerContext) {
        for recipe in ctx.db.resource_placement_recipe_desc_v2().iter() {
            if !self.has_discovered_resource_placement(recipe.id) {
                let mut discover_recipe = false;

                // any discovery trigger overrides all
                for dt_id in &recipe.discovery_triggers {
                    if self.has_acquired_secondary(*dt_id) {
                        discover_recipe = true;
                    }
                }

                // player is missing mandatory secondary knowledge
                let mut has_all_required_knowledges = true;
                for k_id in &recipe.required_knowledges {
                    has_all_required_knowledges &= self.has_acquired_secondary(*k_id);
                }

                if has_all_required_knowledges {
                    // score all items discoveries
                    let mut max_score = 0;
                    let mut score = 0;
                    for item_stack in &recipe.consumed_item_stacks {
                        if item_stack.discovery_score > 0 {
                            max_score += item_stack.discovery_score;
                            if self.has_acquired_item(item_stack.item_id) {
                                score += item_stack.discovery_score;
                            }
                        }
                    }
                    for cargo_stack in &recipe.consumed_cargo_stacks {
                        if cargo_stack.discovery_score > 0 {
                            max_score += cargo_stack.discovery_score;
                            if self.has_acquired_cargo(cargo_stack.item_id) {
                                score += cargo_stack.discovery_score;
                            }
                        }
                    }

                    let req_value = recipe.full_discovery_score.min(max_score);
                    if req_value > 0 {
                        // discover recipe if enough discovery points is scored (capping to what's possible to get in the columns)
                        if score >= req_value {
                            discover_recipe = true;
                        }
                    }
                }

                if discover_recipe {
                    self.discover_resource_placement(ctx, recipe.id);
                }
            }
        }
    }

    fn evaluate_extract_discoveries(&mut self, ctx: &ReducerContext) {
        for recipe in ctx.db.construction_recipe_desc_v2().iter() {
            if !self.has_discovered_extract(recipe.id) {
                // extraction is a special case. The discovery trigger teaches extraction instead of simply discovering it.
                for dt_id in &recipe.discovery_triggers {
                    if self.has_acquired_secondary(*dt_id) {
                        self.acquire_extract(ctx, recipe.id);
                        break;
                    }
                }
            }
        }
    }

    fn evaluate_paving_discoveries(&mut self, ctx: &ReducerContext) {
        for recipe in ctx.db.paving_tile_desc().iter() {
            if !self.has_discovered_paving(recipe.id) {
                let mut discover_recipe = false;

                // any discovery trigger overrides all
                for dt_id in &recipe.discovery_triggers {
                    if self.has_acquired_secondary(*dt_id) {
                        discover_recipe = true;
                    }
                }

                // player is missing mandatory secondary knowledge
                let mut has_all_required_knowledges = true;
                for k_id in &recipe.required_knowledges {
                    has_all_required_knowledges &= self.has_acquired_secondary(*k_id);
                }

                if has_all_required_knowledges {
                    // score all items discoveries
                    let mut max_score = 0;
                    let mut score = 0;
                    for item_stack in &recipe.consumed_item_stacks {
                        if item_stack.discovery_score > 0 {
                            max_score += item_stack.discovery_score;
                            if self.has_acquired_item(item_stack.item_id) {
                                score += item_stack.discovery_score;
                            }
                        }
                    }
                    if recipe.input_cargo_discovery_score > 0 {
                        max_score += recipe.input_cargo_discovery_score;
                        if self.has_acquired_cargo(recipe.input_cargo_id) {
                            score += recipe.input_cargo_discovery_score;
                        }
                    }

                    let req_value = recipe.full_discovery_score.min(max_score);
                    if req_value > 0 {
                        // discover recipe if enough discovery points is scored (capping to what's possible to get in the columns)
                        if score >= req_value {
                            discover_recipe = true;
                        }
                    }
                }

                if discover_recipe {
                    self.discover_paving(ctx, recipe.id);
                }
            }
        }
    }

    // discover every action that could result from
    pub(super) fn on_knowledge_acquired(&mut self, ctx: &ReducerContext) {
        // in order to limit the amount of transactions and to avoid browsing through all uncommitted transactions, creating an horrendous exponential loop of lag,
        // we will make mutable copies of all existing knowledge arrays and update them directly, then commit the ones that were modified as a result of the
        // knowledge acquisition

        self.evaluate_craft_discoveries(ctx);
        self.evaluate_construction_discoveries(ctx);
        self.evaluate_resource_placement_discoveries(ctx);
        self.evaluate_extract_discoveries(ctx);
        self.evaluate_paving_discoveries(ctx);
        self.evaluate_pillar_shaping_discoveries(ctx);
    }

    // Refresh all auto-discovered recipes
    pub fn refresh_knowledges(ctx: &ReducerContext, player_entity_id: u64) {
        let mut discovery = Discovery::new(player_entity_id);
        discovery.initialize(ctx);
        discovery.on_knowledge_acquired(ctx);
        discovery.commit(ctx);
    }

    pub fn discover_item_and_item_list(&mut self, ctx: &ReducerContext, item_id: i32) {
        if let Some(item_list) = ctx.db.item_desc().id().find(&item_id) {
            let item_list_id = item_list.item_list_id;
            if item_list_id != 0 {
                let item_list = ctx.db.item_list_desc().id().find(&item_list_id).unwrap();
                for possibility in item_list.possibilities {
                    for item in possibility.items {
                        if item.item_type == ItemType::Item {
                            self.discover_item_and_item_list(ctx, item.item_id);
                        } else {
                            self.discover_cargo(ctx, item.item_id);
                        }
                    }
                }
            }
            self.discover_item(ctx, item_id);
        } else {
            log::error!("Trying to discover unknown item id {}", item_id);
        }
    }
}
