/**
 * Table Validator
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Validates that skill files reference tables that exist in the SpacetimeDB module.
 * Each skill's subscriptions are checked against the module's available tables.
 *
 * @module agent/table-validator
 */

import type { Skill } from './types.js';
import type { ModuleInfo, ValidationCheckResult } from './config-validation-types.js';

/**
 * Validate that skills reference tables that exist in the SpacetimeDB module.
 *
 * For each skill, iterates over its subscriptions and checks that each
 * required table exists in the module's table list.
 *
 * Skills with zero subscriptions produce no table checks (valid -- some skills
 * may not need subscriptions).
 *
 * @param skills - Array of parsed Skill objects to validate
 * @param moduleInfo - SpacetimeDB module metadata
 * @returns Array of validation check results
 */
export function validateTables(skills: Skill[], moduleInfo: ModuleInfo): ValidationCheckResult[] {
  const results: ValidationCheckResult[] = [];

  // Build a lookup set for fast table access
  const tableSet = new Set<string>(moduleInfo.tables);

  for (const skill of skills) {
    for (const subscription of skill.subscriptions) {
      if (tableSet.has(subscription.table)) {
        results.push({
          passed: true,
          skillName: skill.name,
          checkType: 'table_exists',
          message: `Skill '${skill.name}' required table '${subscription.table}' exists in module`,
        });
      } else {
        results.push({
          passed: false,
          skillName: skill.name,
          checkType: 'table_exists',
          message: `Skill '${skill.name}' requires table '${subscription.table}' but SpacetimeDB module does not expose this table`,
        });
      }
    }
  }

  return results;
}
