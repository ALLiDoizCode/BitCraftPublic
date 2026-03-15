/**
 * Reducer Validator
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Validates that skill files reference reducers that exist in the SpacetimeDB module
 * and that parameter types are compatible. Handles the identity parameter offset
 * where BitCraft reducers have `identity: String` as their first parameter
 * (auto-prepended by BLS handler, excluded from skill files).
 *
 * @module agent/reducer-validator
 */

import type { Skill } from './types.js';
import type {
  ModuleInfo,
  ModuleReducerInfo,
  ValidationCheckResult,
} from './config-validation-types.js';

/**
 * Detect whether a module reducer has an identity parameter as its first argument.
 * BitCraft reducers have `identity: String` as the first param (auto-prepended by BLS).
 * Non-BitCraft modules may not have this pattern.
 *
 * Detection: first param name is 'identity' or first param type is 'String'.
 *
 * Known limitation: The `type === 'String'` check can produce false positives for
 * non-BitCraft modules whose first parameter happens to be of type String but is not
 * an identity parameter. This is an intentional conservative choice for BitCraft
 * compatibility. See story 4.3 spec for rationale.
 *
 * @param reducer - Module reducer info
 * @returns true if the first param appears to be an identity parameter
 */
function hasIdentityParam(reducer: ModuleReducerInfo): boolean {
  if (reducer.params.length === 0) {
    return false;
  }
  const firstParam = reducer.params[0];
  return firstParam.name === 'identity' || firstParam.type === 'String';
}

/**
 * Validate that skills reference reducers that exist in the SpacetimeDB module
 * and that parameter types are compatible.
 *
 * Identity parameter handling:
 * - BitCraft reducers include `identity: String` as their first parameter
 * - Skill params do NOT include identity (it is auto-prepended by BLS handler)
 * - Validation offsets by 1 when comparing: skill.params[0] maps to moduleReducer.params[1]
 * - Identity detection: if first param name is 'identity' or type is 'String', offset by 1
 *
 * @param skills - Array of parsed Skill objects to validate
 * @param moduleInfo - SpacetimeDB module metadata
 * @returns Array of validation check results
 */
export function validateReducers(skills: Skill[], moduleInfo: ModuleInfo): ValidationCheckResult[] {
  const results: ValidationCheckResult[] = [];

  // Build a lookup map for fast reducer access
  const reducerMap = new Map<string, ModuleReducerInfo>();
  for (const reducer of moduleInfo.reducers) {
    reducerMap.set(reducer.name, reducer);
  }

  for (const skill of skills) {
    const moduleReducer = reducerMap.get(skill.reducer);

    if (!moduleReducer) {
      // Reducer not found in module
      results.push({
        passed: false,
        skillName: skill.name,
        checkType: 'reducer_exists',
        message: `Skill '${skill.name}' references reducer '${skill.reducer}' but SpacetimeDB module does not expose this reducer`,
      });
      continue;
    }

    // Reducer exists -- check passes
    results.push({
      passed: true,
      skillName: skill.name,
      checkType: 'reducer_exists',
      message: `Skill '${skill.name}' reducer '${skill.reducer}' exists in module`,
    });

    // Now check parameter compatibility
    const identityOffset = hasIdentityParam(moduleReducer) ? 1 : 0;
    const moduleParamCount = moduleReducer.params.length - identityOffset;
    const skillParamCount = skill.params.length;

    if (skillParamCount !== moduleParamCount) {
      results.push({
        passed: false,
        skillName: skill.name,
        checkType: 'param_compatibility',
        message: `Skill '${skill.name}' declares ${skillParamCount} params but reducer '${skill.reducer}' expects ${moduleParamCount} params (excluding identity)`,
        details: `Module reducer has ${moduleReducer.params.length} total params${identityOffset ? ' (including identity)' : ''}`,
      });
      continue;
    }

    // Check each param type
    let allParamsMatch = true;
    for (let i = 0; i < skillParamCount; i++) {
      const skillParam = skill.params[i];
      const moduleParam = moduleReducer.params[i + identityOffset];

      if (skillParam.type !== moduleParam.type) {
        allParamsMatch = false;
        results.push({
          passed: false,
          skillName: skill.name,
          checkType: 'param_compatibility',
          message: `Skill '${skill.name}' param '${skillParam.name}' has type '${skillParam.type}' but reducer '${skill.reducer}' expects type '${moduleParam.type}' at position ${i}`,
          details: `Skill param: ${skillParam.name}: ${skillParam.type}, Module param: ${moduleParam.name}: ${moduleParam.type}`,
        });
      }
    }

    if (allParamsMatch && skillParamCount > 0) {
      results.push({
        passed: true,
        skillName: skill.name,
        checkType: 'param_compatibility',
        message: `Skill '${skill.name}' params match reducer '${skill.reducer}' parameter types`,
      });
    } else if (allParamsMatch && skillParamCount === 0) {
      // Zero params, zero expected (excluding identity) -- passes
      results.push({
        passed: true,
        skillName: skill.name,
        checkType: 'param_compatibility',
        message: `Skill '${skill.name}' has zero params, reducer '${skill.reducer}' expects zero params (excluding identity)`,
      });
    }
  }

  return results;
}
