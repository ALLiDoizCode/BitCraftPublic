/**
 * Decision Log Metrics Utilities
 * Story 4.6: Structured Decision Logging
 *
 * Provides utilities for computing aggregate metrics from decision log entries
 * and parsing JSONL decision log files. These utilities enable eval-compatible
 * analysis (AC6) for researcher benchmarking and skill behavioral testing.
 *
 * The `computeMetrics()` function processes an array of DecisionLogEntry objects
 * and produces AggregateMetrics with per-skill breakdowns. The `parseJsonlFile()`
 * function parses raw JSONL content into typed DecisionLogEntry arrays.
 *
 * @module agent/decision-log-metrics
 */

import type { DecisionLogEntry, SkillMetrics, AggregateMetrics } from './decision-log-types.js';

/**
 * Internal accumulator for building SkillMetrics incrementally.
 */
interface SkillAccumulator {
  skillName: string;
  invocationCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  totalCost: number;
  totalDecisionLatencyMs: number;
  totalActionLatencyMs: number;
  actionLatencyCount: number;
}

/**
 * Computes aggregate metrics from an array of decision log entries.
 *
 * Groups entries by `skillTriggered.name` (entries with null skillTriggered
 * are grouped under `'(no skill)'`). Computes per-skill metrics including
 * invocation count, success/failure/skipped counts, trigger accuracy,
 * total cost, and average latencies.
 *
 * The `evalResults` field is always returned as an empty array -- eval
 * pass/fail tracking is populated by external eval tooling (Story 11.4),
 * not by `computeMetrics()`.
 *
 * @param entries - Array of DecisionLogEntry objects to analyze
 * @returns AggregateMetrics with per-skill breakdown
 *
 * @example
 * ```typescript
 * const content = await readFile('decisions.jsonl', 'utf-8');
 * const entries = parseJsonlFile(content);
 * const metrics = computeMetrics(entries);
 *
 * for (const [name, skill] of metrics.perSkill) {
 *   console.log(`${name}: ${skill.invocationCount} invocations, ${skill.triggerAccuracy * 100}% accuracy`);
 * }
 * ```
 */
export function computeMetrics(entries: DecisionLogEntry[]): AggregateMetrics {
  if (entries.length === 0) {
    return {
      totalDecisions: 0,
      totalCost: 0,
      overallSuccessRate: 0,
      perSkill: new Map(),
      evalResults: [],
    };
  }

  const accumulators = new Map<string, SkillAccumulator>();
  let totalSuccessCount = 0;
  let totalCost = 0;

  for (const entry of entries) {
    const skillName = entry.skillTriggered?.name ?? '(no skill)';

    // Get or create accumulator
    let acc = accumulators.get(skillName);
    if (!acc) {
      acc = {
        skillName,
        invocationCount: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        totalCost: 0,
        totalDecisionLatencyMs: 0,
        totalActionLatencyMs: 0,
        actionLatencyCount: 0,
      };
      accumulators.set(skillName, acc);
    }

    // Count invocations and results
    acc.invocationCount += 1;
    if (entry.result === 'success') {
      acc.successCount += 1;
      totalSuccessCount += 1;
    } else if (entry.result === 'failure') {
      acc.failureCount += 1;
    } else if (entry.result === 'skipped') {
      acc.skippedCount += 1;
    }

    // Accumulate cost (null costs treated as 0)
    const entryCost = entry.cost ?? 0;
    acc.totalCost += entryCost;
    totalCost += entryCost;

    // Accumulate latencies
    acc.totalDecisionLatencyMs += entry.metrics.decisionLatencyMs;

    if (entry.metrics.actionLatencyMs !== undefined) {
      acc.totalActionLatencyMs += entry.metrics.actionLatencyMs;
      acc.actionLatencyCount += 1;
    }
  }

  // Build per-skill metrics from accumulators
  const perSkill = new Map<string, SkillMetrics>();
  for (const [name, acc] of accumulators) {
    const triggerAccuracy = acc.invocationCount > 0 ? acc.successCount / acc.invocationCount : 0;

    const avgDecisionLatencyMs =
      acc.invocationCount > 0 ? acc.totalDecisionLatencyMs / acc.invocationCount : 0;

    const avgActionLatencyMs =
      acc.actionLatencyCount > 0 ? acc.totalActionLatencyMs / acc.actionLatencyCount : 0;

    perSkill.set(name, {
      skillName: acc.skillName,
      invocationCount: acc.invocationCount,
      successCount: acc.successCount,
      failureCount: acc.failureCount,
      skippedCount: acc.skippedCount,
      triggerAccuracy,
      totalCost: acc.totalCost,
      avgDecisionLatencyMs,
      avgActionLatencyMs,
    });
  }

  return {
    totalDecisions: entries.length,
    totalCost,
    overallSuccessRate: entries.length > 0 ? totalSuccessCount / entries.length : 0,
    perSkill,
    evalResults: [],
  };
}

/**
 * Parses JSONL content into an array of DecisionLogEntry objects.
 *
 * Splits content by newlines, filters out empty lines, and parses each
 * line as JSON. Throws an Error with line number context on parse failure.
 *
 * @param content - Raw JSONL file content (string)
 * @returns Array of DecisionLogEntry objects
 * @throws Error with line number context on JSON parse failure
 *
 * @example
 * ```typescript
 * const content = await readFile('decisions.jsonl', 'utf-8');
 * const entries = parseJsonlFile(content);
 * console.log(`Loaded ${entries.length} decision log entries`);
 * ```
 */
export function parseJsonlFile(content: string): DecisionLogEntry[] {
  const lines = content.split('\n');
  const entries: DecisionLogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;

    try {
      const entry = JSON.parse(line) as DecisionLogEntry;
      entries.push(entry);
    } catch {
      throw new Error(`Failed to parse JSONL at line ${i + 1}: invalid JSON`);
    }
  }

  return entries;
}
