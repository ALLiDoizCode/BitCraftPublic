/**
 * Configuration Validator
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Orchestrates the full validation pipeline: fetches module metadata,
 * validates reducers and tables, and produces a validation report.
 * Supports both online (live SpacetimeDB) and offline (pre-fetched) modes.
 *
 * @module agent/config-validator
 */

import type { ResolvedAgentConfig } from './agent-config-types.js';
import type {
  ModuleInfo,
  ModuleInfoProvider,
  ValidationReport,
  ValidationCheckResult,
} from './config-validation-types.js';
import { validateReducers } from './reducer-validator.js';
import { validateTables } from './table-validator.js';

/**
 * Validate an agent configuration against a live SpacetimeDB module.
 * Fetches module metadata via the provider, then validates all skills.
 *
 * Performance requirement: must complete within 1 second for 50 skills (NFR7).
 *
 * @param config - Resolved agent configuration with skill objects
 * @param moduleInfoProvider - Provider for fetching module metadata
 * @returns Validation report with all check results
 * @throws {ConfigValidationError} If module metadata cannot be fetched
 */
export async function validateAgentConfig(
  config: ResolvedAgentConfig,
  moduleInfoProvider: ModuleInfoProvider
): Promise<ValidationReport> {
  const startTime = performance.now();

  // Fetch module metadata -- may throw ConfigValidationError
  const moduleInfo = await moduleInfoProvider.getModuleInfo();

  // Run validation checks
  const reducerChecks = validateReducers(config.skills, moduleInfo);
  const tableChecks = validateTables(config.skills, moduleInfo);

  const endTime = performance.now();

  return buildReport(config, reducerChecks, tableChecks, startTime, endTime);
}

/**
 * Validate an agent configuration against pre-fetched module metadata.
 * Synchronous variant that does not require a live SpacetimeDB connection.
 *
 * Use cases:
 * 1. Development without Docker
 * 2. Fast re-validation with cached module info
 * 3. Unit testing with mock module info
 *
 * @param config - Resolved agent configuration with skill objects
 * @param moduleInfo - Pre-fetched module metadata
 * @returns Validation report with all check results
 */
export function validateAgentConfigOffline(
  config: ResolvedAgentConfig,
  moduleInfo: ModuleInfo
): ValidationReport {
  const startTime = performance.now();

  const reducerChecks = validateReducers(config.skills, moduleInfo);
  const tableChecks = validateTables(config.skills, moduleInfo);

  const endTime = performance.now();

  return buildReport(config, reducerChecks, tableChecks, startTime, endTime);
}

/**
 * Build a ValidationReport from check results.
 */
function buildReport(
  config: ResolvedAgentConfig,
  reducerChecks: ValidationCheckResult[],
  tableChecks: ValidationCheckResult[],
  startTime: number,
  endTime: number
): ValidationReport {
  const allChecks = [...reducerChecks, ...tableChecks];
  const passed = allChecks.length === 0 || allChecks.every((check) => check.passed);

  // Generate warnings for skills with zero subscriptions
  const warnings: string[] = [];
  for (const skill of config.skills) {
    if (skill.subscriptions.length === 0) {
      warnings.push(
        `Skill '${skill.name}' has zero subscriptions -- it will not receive any table data`
      );
    }
  }

  return {
    passed,
    checks: allChecks,
    warnings,
    timestamp: new Date().toISOString(),
    durationMs: Math.round((endTime - startTime) * 100) / 100,
    skillCount: config.skills.length,
  };
}

/**
 * Format a validation report as a human-readable string.
 *
 * @param report - Validation report to format
 * @returns Human-readable summary string
 */
export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [];

  const status = report.passed ? 'PASSED' : 'FAILED';
  lines.push(`Validation Report: ${status}`);
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push(`Duration: ${report.durationMs}ms`);
  lines.push(`Skills validated: ${report.skillCount}`);
  lines.push('');

  const passedChecks = report.checks.filter((c) => c.passed);
  const failedChecks = report.checks.filter((c) => !c.passed);

  lines.push(`Checks: ${passedChecks.length} passed, ${failedChecks.length} failed`);
  lines.push('');

  if (failedChecks.length > 0) {
    lines.push('Failed checks:');
    for (const check of failedChecks) {
      lines.push(`  - [${check.checkType}] ${check.message}`);
      if (check.details) {
        lines.push(`    Details: ${check.details}`);
      }
    }
    lines.push('');
  }

  if (passedChecks.length > 0) {
    lines.push('Passed checks:');
    for (const check of passedChecks) {
      lines.push(`  - [${check.checkType}] ${check.message}`);
      if (check.details) {
        lines.push(`    Details: ${check.details}`);
      }
    }
    lines.push('');
  }

  if (report.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of report.warnings) {
      lines.push(`  - ${warning}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
