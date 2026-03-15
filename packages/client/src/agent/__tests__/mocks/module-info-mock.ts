/**
 * Module Info Mock Factories
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Test factories for creating ModuleInfo, ModuleInfoProvider, and related
 * mock objects for unit testing validation logic without a live SpacetimeDB connection.
 *
 * @module agent/__tests__/mocks/module-info-mock
 */

import type {
  ModuleInfo,
  ModuleInfoProvider,
  ModuleReducerInfo,
} from '../../config-validation-types.js';

/**
 * Create a mock ModuleInfo with BitCraft-like reducers and tables.
 * Includes full parameter definitions for testing param compatibility.
 *
 * Default mock includes:
 * - Reducers: player_move (identity + target_x:i32 + target_y:i32),
 *             harvest_start (identity + resource_id:u64),
 *             craft_item (identity + recipe_id:u64 + quantity:u32)
 * - Tables: player_state, terrain, resource_node, inventory, item_desc, recipe_desc
 *
 * @param overrides - Optional partial overrides for the default mock
 * @returns Complete ModuleInfo object
 */
export function createMockModuleInfo(overrides?: Partial<ModuleInfo>): ModuleInfo {
  const defaultReducers: ModuleReducerInfo[] = [
    {
      name: 'player_move',
      params: [
        { name: 'identity', type: 'String' },
        { name: 'target_x', type: 'i32' },
        { name: 'target_y', type: 'i32' },
      ],
    },
    {
      name: 'harvest_start',
      params: [
        { name: 'identity', type: 'String' },
        { name: 'resource_id', type: 'u64' },
      ],
    },
    {
      name: 'craft_item',
      params: [
        { name: 'identity', type: 'String' },
        { name: 'recipe_id', type: 'u64' },
        { name: 'quantity', type: 'u32' },
      ],
    },
  ];

  const defaultTables: string[] = [
    'player_state',
    'terrain',
    'resource_node',
    'inventory',
    'item_desc',
    'recipe_desc',
  ];

  return {
    reducers: overrides?.reducers ?? defaultReducers,
    tables: overrides?.tables ?? defaultTables,
  };
}

/**
 * Create a mock ModuleInfoProvider that resolves with the given ModuleInfo.
 *
 * @param moduleInfo - Optional custom ModuleInfo (defaults to createMockModuleInfo())
 * @returns ModuleInfoProvider that resolves with the given module info
 */
export function createMockModuleInfoProvider(moduleInfo?: ModuleInfo): ModuleInfoProvider {
  const info = moduleInfo ?? createMockModuleInfo();
  return {
    getModuleInfo: async () => info,
  };
}

/**
 * Create a mock ModuleInfoProvider that throws on getModuleInfo().
 *
 * @param error - The error to throw when getModuleInfo() is called
 * @returns ModuleInfoProvider that always throws
 */
export function createFailingModuleInfoProvider(error: Error): ModuleInfoProvider {
  return {
    getModuleInfo: async () => {
      throw error;
    },
  };
}
