/**
 * Static Data Tables
 *
 * List of all static data tables in BitCraft module.
 * All tables end with `_desc` suffix (naming convention).
 *
 * Static data tables contain read-only game definitions:
 * - Item descriptions and recipes
 * - Terrain types and biome definitions
 * - Building blueprints and upgrade paths
 * - NPC types and dialogue trees
 * - Game balance constants and skill trees
 *
 * These tables are loaded once at startup and cached in memory.
 * They do NOT change during runtime (server-side data, not user-generated).
 */

/**
 * Complete list of static data tables in BitCraft module.
 *
 * According to Story 1.5, there are 148 static data tables.
 * This list will be populated by introspecting the actual BitCraft module schema.
 *
 * For now, we include common categories based on game data patterns:
 *
 * ⚠️  IMPORTANT: This list is incomplete (34 of 148 tables).
 * TODO: Expand this list to include all 148 static data tables from BitCraft schema.
 * This is tracked as a known limitation in the story implementation notes.
 */
export const STATIC_DATA_TABLES = [
  // Items
  'item_desc',
  'item_category_desc',
  'item_rarity_desc',
  'item_slot_desc',
  'item_effect_desc',
  'item_attribute_desc',

  // Crafting
  'recipe_desc',
  'crafting_station_desc',
  'ingredient_desc',
  'crafting_skill_desc',

  // Terrain & Biomes
  'terrain_desc',
  'biome_desc',
  'resource_spawn_desc',
  'terrain_feature_desc',

  // Buildings
  'building_desc',
  'building_category_desc',
  'building_upgrade_desc',
  'building_requirement_desc',

  // NPCs & Quests
  'npc_desc',
  'npc_type_desc',
  'dialogue_desc',
  'quest_desc',
  'quest_objective_desc',
  'quest_reward_desc',

  // Skills & Progression
  'skill_desc',
  'skill_tree_desc',
  'skill_level_desc',
  'achievement_desc',

  // Combat & Stats
  'stat_desc',
  'damage_type_desc',
  'status_effect_desc',
  'combat_ability_desc',

  // Additional categories (placeholder - total should reach 148)
  // These will be populated from actual BitCraft schema
  'placeholder_1_desc',
  'placeholder_2_desc',
  // ... (add more as we discover actual tables)
] as const;

/**
 * Static data table names as a union type
 */
export type StaticDataTableName = (typeof STATIC_DATA_TABLES)[number];

/**
 * Categorized static data tables for documentation
 */
export const STATIC_DATA_CATEGORIES = {
  items: [
    'item_desc',
    'item_category_desc',
    'item_rarity_desc',
    'item_slot_desc',
    'item_effect_desc',
    'item_attribute_desc',
  ],
  crafting: ['recipe_desc', 'crafting_station_desc', 'ingredient_desc', 'crafting_skill_desc'],
  terrain: ['terrain_desc', 'biome_desc', 'resource_spawn_desc', 'terrain_feature_desc'],
  buildings: [
    'building_desc',
    'building_category_desc',
    'building_upgrade_desc',
    'building_requirement_desc',
  ],
  npcs: [
    'npc_desc',
    'npc_type_desc',
    'dialogue_desc',
    'quest_desc',
    'quest_objective_desc',
    'quest_reward_desc',
  ],
  skills: ['skill_desc', 'skill_tree_desc', 'skill_level_desc', 'achievement_desc'],
  combat: ['stat_desc', 'damage_type_desc', 'status_effect_desc', 'combat_ability_desc'],
} as const;

/**
 * Validate that a table name is a static data table
 */
export function isStaticDataTable(tableName: string): tableName is StaticDataTableName {
  return STATIC_DATA_TABLES.includes(tableName as StaticDataTableName);
}

/**
 * Get static data tables by category
 */
export function getStaticDataTablesByCategory(
  category: keyof typeof STATIC_DATA_CATEGORIES
): readonly string[] {
  return STATIC_DATA_CATEGORIES[category];
}

/**
 * Total count of static data tables
 *
 * NOTE: This should be 148 when all tables are identified.
 * Current count is a placeholder for development.
 */
export const STATIC_DATA_TABLE_COUNT = STATIC_DATA_TABLES.length;
