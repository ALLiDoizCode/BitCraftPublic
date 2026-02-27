/**
 * Action Cost Registry
 * Story 2.2: Action Cost Registry & Wallet Balance
 *
 * Static JSON configuration for game action ILP costs. Researchers edit costs
 * between experiments for economic tuning.
 *
 * @see _bmad-output/planning-artifacts/architecture/8-action-cost-registry.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { SigilError } from '../nostr/nostr-client';

/**
 * Action cost category
 *
 * Categorizes actions by game mechanic type for analysis and cost balancing.
 */
export type CategoryEnum =
  | 'movement'
  | 'combat'
  | 'resource'
  | 'building'
  | 'economy'
  | 'social'
  | 'governance'
  | 'crafting';

/**
 * Action execution frequency
 *
 * Expected frequency of action execution for cost modeling and balance tuning.
 */
export type FrequencyEnum = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

/**
 * Action cost entry
 *
 * Defines the ILP cost, category, and frequency for a single game action (reducer).
 */
export interface ActionCostEntry {
  /** ILP cost in game currency units (non-negative number) */
  cost: number;
  /** Action category for analysis */
  category: CategoryEnum;
  /** Expected execution frequency */
  frequency: FrequencyEnum;
}

/**
 * Action cost registry schema (Version 1)
 *
 * JSON configuration mapping reducer names to action costs.
 *
 * @example
 * ```json
 * {
 *   "version": 1,
 *   "defaultCost": 10,
 *   "actions": {
 *     "player_move": { "cost": 1, "category": "movement", "frequency": "high" },
 *     "craft_item": { "cost": 15, "category": "crafting", "frequency": "medium" }
 *   }
 * }
 * ```
 */
export interface ActionCostRegistry {
  /** Schema version (currently only version 1 is supported) */
  version: number;
  /** Default cost for unmapped actions (non-negative number) */
  defaultCost: number;
  /** Map of reducer names to cost entries */
  actions: Record<string, ActionCostEntry>;
}

/**
 * Action cost registry loader options
 */
export interface ActionCostRegistryOptions {
  /** Path to JSON registry file (absolute or relative to process.cwd()) */
  path: string;
}

/**
 * Allowed cost categories
 */
const COST_CATEGORIES: readonly CategoryEnum[] = [
  'movement',
  'combat',
  'resource',
  'building',
  'economy',
  'social',
  'governance',
  'crafting',
];

/**
 * Allowed cost frequencies
 */
const COST_FREQUENCIES: readonly FrequencyEnum[] = [
  'very_low',
  'low',
  'medium',
  'high',
  'very_high',
];

/**
 * Validate action cost registry JSON
 *
 * @param data - Parsed JSON data
 * @returns Validated ActionCostRegistry
 * @throws SigilError with code INVALID_CONFIG for validation failures
 * @throws SigilError with code UNSUPPORTED_VERSION for unsupported versions
 */
export function validateRegistry(data: unknown): ActionCostRegistry {
  if (typeof data !== 'object' || data === null) {
    throw new SigilError(
      'Action cost registry must be a JSON object',
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  const registry = data as Record<string, unknown>;

  // Validate version field
  if (!('version' in registry)) {
    throw new SigilError(
      'Action cost registry missing required field: version',
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  const version = registry.version;
  if (typeof version !== 'number') {
    throw new SigilError(
      'Action cost registry version must be a number',
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  if (!Number.isInteger(version)) {
    throw new SigilError(
      `Action cost registry version must be an integer, got: ${version}`,
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  if (version <= 0) {
    throw new SigilError(
      `Action cost registry version must be >= 1, got: ${version}`,
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  if (version !== 1) {
    throw new SigilError(
      `Unsupported registry version ${version}. Supported versions: 1`,
      'UNSUPPORTED_VERSION',
      'action-cost-registry'
    );
  }

  // Validate defaultCost field
  if (!('defaultCost' in registry)) {
    throw new SigilError(
      'Action cost registry missing required field: defaultCost',
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  const defaultCost = registry.defaultCost;
  if (typeof defaultCost !== 'number') {
    throw new SigilError(
      'Action cost registry defaultCost must be a number',
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  if (defaultCost < 0 || !Number.isFinite(defaultCost)) {
    throw new SigilError(
      `Action cost registry defaultCost must be non-negative and finite, got: ${defaultCost}`,
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  // Validate actions field
  if (!('actions' in registry)) {
    throw new SigilError(
      'Action cost registry missing required field: actions',
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  const actions = registry.actions;
  if (typeof actions !== 'object' || actions === null || Array.isArray(actions)) {
    throw new SigilError(
      'Action cost registry actions must be an object',
      'INVALID_CONFIG',
      'action-cost-registry'
    );
  }

  const actionsObj = actions as Record<string, unknown>;

  // Validate each action entry
  for (const [actionName, entry] of Object.entries(actionsObj)) {
    if (typeof entry !== 'object' || entry === null) {
      throw new SigilError(
        `Action "${actionName}" entry must be an object`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    const entryObj = entry as Record<string, unknown>;

    // Validate cost field
    if (!('cost' in entryObj)) {
      throw new SigilError(
        `Action "${actionName}" missing required field: cost`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    const cost = entryObj.cost;
    if (typeof cost !== 'number') {
      throw new SigilError(
        `Action "${actionName}" cost must be a number`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    if (cost < 0 || !Number.isFinite(cost)) {
      throw new SigilError(
        `Action "${actionName}" cost must be non-negative and finite, got: ${cost}`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    // Validate category field
    if (!('category' in entryObj)) {
      throw new SigilError(
        `Action "${actionName}" missing required field: category`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    const category = entryObj.category;
    if (typeof category !== 'string') {
      throw new SigilError(
        `Action "${actionName}" category must be a string`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    if (!COST_CATEGORIES.includes(category as CategoryEnum)) {
      throw new SigilError(
        `Action "${actionName}" category must be one of: ${COST_CATEGORIES.join(', ')}. Got: ${category}`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    // Validate frequency field
    if (!('frequency' in entryObj)) {
      throw new SigilError(
        `Action "${actionName}" missing required field: frequency`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    const frequency = entryObj.frequency;
    if (typeof frequency !== 'string') {
      throw new SigilError(
        `Action "${actionName}" frequency must be a string`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    if (!COST_FREQUENCIES.includes(frequency as FrequencyEnum)) {
      throw new SigilError(
        `Action "${actionName}" frequency must be one of: ${COST_FREQUENCIES.join(', ')}. Got: ${frequency}`,
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }
  }

  return registry as unknown as ActionCostRegistry;
}

/**
 * Action cost registry loader
 *
 * Loads and validates action cost registry from JSON file.
 */
export class ActionCostRegistryLoader {
  private cachedRegistry: ActionCostRegistry | null = null;

  /**
   * Load action cost registry from JSON file
   *
   * @param filePath - Path to JSON file (absolute or relative to process.cwd())
   * @returns Validated ActionCostRegistry
   * @throws SigilError with code INVALID_CONFIG for path traversal or validation failures
   * @throws SigilError with code FILE_NOT_FOUND if file does not exist or is not readable
   * @throws SigilError with code INVALID_JSON if JSON parsing fails
   * @throws SigilError with code UNSUPPORTED_VERSION for unsupported registry versions
   */
  load(filePath: string): ActionCostRegistry {
    // Return cached registry if already loaded
    if (this.cachedRegistry) {
      return this.cachedRegistry;
    }

    // Normalize the path to check for path traversal patterns before resolution
    const normalizedInput = path.normalize(filePath);

    // Detect path traversal attempts in the input (before resolution)
    // This catches patterns like '../../../etc/passwd' or '..\/..\/file'
    const hasTraversalPattern = normalizedInput.split(path.sep).some((segment) => segment === '..');

    if (hasTraversalPattern) {
      throw new SigilError(
        'Path traversal not allowed in action cost registry path',
        'INVALID_CONFIG',
        'action-cost-registry'
      );
    }

    // Resolve relative paths from process.cwd()
    const projectRoot = process.cwd();
    // deepcode ignore PT: Path traversal is validated above (lines 336-348) and in production mode (lines 357-365)
    const resolvedPath = path.isAbsolute(filePath)
      ? path.resolve(filePath) // nosemgrep
      : path.resolve(projectRoot, filePath); // nosemgrep

    // In production, enforce that paths must be within project directory
    if (process.env.NODE_ENV === 'production') {
      if (!resolvedPath.startsWith(projectRoot + path.sep) && resolvedPath !== projectRoot) {
        const sanitizedPath = path.basename(resolvedPath);
        throw new SigilError(
          `Action cost registry path must be within project directory in production. Got: ${sanitizedPath}`,
          'INVALID_CONFIG',
          'action-cost-registry'
        );
      }
    }

    // Read file
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    } catch {
      const sanitizedPath =
        process.env.NODE_ENV === 'production' ? path.basename(resolvedPath) : resolvedPath;
      throw new SigilError(
        `Failed to read action cost registry file: ${sanitizedPath}`,
        'FILE_NOT_FOUND',
        'action-cost-registry'
      );
    }

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(fileContent);
    } catch (error) {
      const sanitizedPath =
        process.env.NODE_ENV === 'production' ? path.basename(resolvedPath) : resolvedPath;
      const errorMessage = error instanceof Error ? error.message : 'Unknown JSON parse error';
      throw new SigilError(
        `Failed to parse action cost registry JSON: ${sanitizedPath}. Error: ${errorMessage}`,
        'INVALID_JSON',
        'action-cost-registry'
      );
    }

    // Validate registry
    const registry = validateRegistry(data);

    // Cache and return
    this.cachedRegistry = registry;
    return registry;
  }

  /**
   * Clear cached registry (for testing)
   */
  clearCache(): void {
    this.cachedRegistry = null;
  }
}
