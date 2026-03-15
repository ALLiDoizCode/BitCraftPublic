/**
 * Decision Log Types
 * Story 4.6: Structured Decision Logging
 *
 * Type definitions for the structured decision logging system. The DecisionLogger
 * captures the full agent decision cycle (perceive -> interpret -> decide -> act)
 * as JSONL log entries for research analysis, benchmarking, and reproducibility.
 *
 * These types define the contract consumed by downstream tooling:
 * - Story 8.2 (Agent Observation Mode in TUI)
 * - Story 11.4 (Comparative Decision Log Analysis)
 *
 * @module agent/decision-log-types
 */

import type { SemanticNarrative } from './event-interpreter-types.js';

/**
 * Result status for a decision log entry.
 */
export type DecisionLogResult = 'success' | 'failure' | 'skipped';

/**
 * A single structured decision log entry.
 *
 * Captures the full decision cycle: observation, interpretation, decision, action, and outcome.
 * Each entry is serialized as a single line of JSON in the JSONL log file.
 *
 * Schema defined in test design document (Section 4.5) and MUST be implemented exactly as specified.
 * Timestamp is ISO 8601 string (e.g., "2026-03-15T12:00:00.000Z"), distinct from
 * SemanticNarrative.timestamp which is a number (epoch ms).
 */
export interface DecisionLogEntry {
  /** ISO 8601 timestamp (e.g., "2026-03-15T12:00:00.000Z") */
  timestamp: string;
  /** Summary of observed game state */
  observation: string;
  /** Semantic events from EventInterpreter (Story 4.5) */
  semanticEvents: SemanticNarrative[];
  /** The skill selected for this decision (null if no skill matched) */
  skillTriggered: {
    name: string;
    description: string;
    /** Why this skill was selected */
    matchContext: string;
  } | null;
  /** The action payload sent to client.publish() (null if skipped) */
  action: {
    reducer: string;
    args: unknown[];
  } | null;
  /** Action cost from action cost registry (null if action was skipped) */
  cost: number | null;
  /** Outcome status */
  result: DecisionLogResult;
  /** Human-readable outcome description */
  outcome: string;
  /** Error details (present only on failure) */
  error?: {
    code: string;
    boundary: string;
    message: string;
  };
  /** Captured game state on failure */
  worldState?: Record<string, unknown>;
  /** Config snapshot for reproducibility (AC5) */
  agentConfig: {
    /** Hash or timestamp of the agent.md file */
    agentMdVersion: string;
    /** Active skill names */
    activeSkills: string[];
  };
  /** Timing metrics for eval (AC6) */
  metrics: {
    /** Time from observation to action decision */
    decisionLatencyMs: number;
    /** Time for publish round-trip (optional) */
    actionLatencyMs?: number;
  };
}

/**
 * Configuration for the DecisionLogger.
 */
export interface DecisionLoggerConfig {
  /** Path to the JSONL log file */
  filePath: string;
  /** Rotation threshold in bytes (default: 100 * 1024 * 1024 = 100MB) */
  maxFileSizeBytes: number;
  /** Whether to rotate logs (default: true) */
  rotationEnabled: boolean;
}

/**
 * Input to DecisionLogger.logDecision().
 *
 * Contains all the data needed to construct a DecisionLogEntry.
 * The logger adds the timestamp and structures the metrics field.
 */
export interface DecisionContext {
  /** Summary of observed game state */
  observation: string;
  /** Semantic events from EventInterpreter (Story 4.5) */
  semanticEvents: SemanticNarrative[];
  /** The skill selected for this decision */
  skillTriggered: DecisionLogEntry['skillTriggered'];
  /** The action payload sent to client.publish() */
  action: DecisionLogEntry['action'];
  /** Action cost from action cost registry */
  cost: number | null;
  /** Outcome status */
  result: DecisionLogResult;
  /** Human-readable outcome description */
  outcome: string;
  /** Error details (on failure) */
  error?: DecisionLogEntry['error'];
  /** Captured game state on failure */
  worldState?: Record<string, unknown>;
  /** Config snapshot for reproducibility */
  agentConfig: DecisionLogEntry['agentConfig'];
  /** Time from observation to action decision (ms) */
  decisionLatencyMs: number;
  /** Time for publish round-trip (ms, optional) */
  actionLatencyMs?: number;
}

/**
 * Per-skill metrics derived from decision log entries.
 *
 * Computed by computeMetrics() for eval-compatible analysis (AC6).
 */
export interface SkillMetrics {
  /** Skill name (or '(no skill)' for null skillTriggered entries) */
  skillName: string;
  /** Total times this skill was triggered */
  invocationCount: number;
  /** Times result === 'success' */
  successCount: number;
  /** Times result === 'failure' */
  failureCount: number;
  /** Times result === 'skipped' */
  skippedCount: number;
  /** successCount / invocationCount (0-1 range, 0 if invocationCount is 0) */
  triggerAccuracy: number;
  /** Sum of all action costs for this skill (null costs treated as 0) */
  totalCost: number;
  /** Average metrics.decisionLatencyMs */
  avgDecisionLatencyMs: number;
  /** Average metrics.actionLatencyMs (excludes entries without actionLatencyMs) */
  avgActionLatencyMs: number;
}

/**
 * Aggregate metrics derived from decision log entries.
 *
 * Computed by computeMetrics() for eval-compatible analysis (AC6).
 */
export interface AggregateMetrics {
  /** Total log entries analyzed */
  totalDecisions: number;
  /** Sum of all costs */
  totalCost: number;
  /** successCount / totalDecisions (0 if no entries) */
  overallSuccessRate: number;
  /** Per-skill breakdown */
  perSkill: Map<string, SkillMetrics>;
  /** Eval pass/fail tracking (populated by external eval tooling, not computeMetrics) */
  evalResults: EvalResult[];
}

/**
 * Eval pass/fail result for behavioral testing.
 *
 * Populated by external eval tooling (Story 11.4), not by computeMetrics().
 * The field exists in AggregateMetrics for schema compatibility.
 */
export interface EvalResult {
  /** Skill name */
  skillName: string;
  /** Eval test name */
  evalName: string;
  /** Whether the eval passed */
  passed: boolean;
  /** Explanation of the result */
  details: string;
}
