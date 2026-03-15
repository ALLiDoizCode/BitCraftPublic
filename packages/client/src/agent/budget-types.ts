/**
 * Budget Tracking Types
 * Story 4.4: Budget Tracking & Limits
 *
 * Type definitions for budget tracking, enforcement, metrics, and error handling.
 * The budget tracker enforces per-agent budget limits at the client level
 * before any Crosstown interaction occurs.
 *
 * @module agent/budget-types
 */

/**
 * Configuration for initializing a BudgetTracker.
 * Created from AgentBudgetConfig (Story 4.2) via createBudgetTrackerFromConfig().
 */
export interface BudgetTrackerConfig {
  /** Total budget limit in the configured unit */
  limit: number;
  /** Currency unit (e.g., 'ILP', 'USD') */
  unit: string;
  /** Time period (e.g., 'session', 'hour') */
  period: string;
  /** Utilization percentages at which to emit warning events (default: [0.8, 0.9]) */
  warningThresholds: number[];
}

/**
 * Current budget status.
 * - 'active': under all thresholds
 * - 'warning': one or more thresholds crossed but budget not exhausted
 * - 'exhausted': totalSpend >= limit
 */
export type BudgetStatus = 'active' | 'warning' | 'exhausted';

/**
 * Snapshot of budget metrics at a point in time.
 * Returned by BudgetTracker.getMetrics().
 */
export interface BudgetMetrics {
  /** Configured budget limit */
  totalLimit: number;
  /** Cumulative spend so far */
  totalSpend: number;
  /** Remaining budget (totalLimit - totalSpend) */
  remaining: number;
  /** Utilization as a percentage (totalSpend / totalLimit * 100) */
  utilizationPercent: number;
  /** Current budget state */
  status: BudgetStatus;
  /** Total number of actions tracked */
  actionCount: number;
  /** Per-reducer cost breakdown */
  perActionCosts: Record<string, { totalCost: number; count: number }>;
  /** Configured warning thresholds */
  warningThresholds: number[];
  /** Which thresholds have already fired */
  thresholdsTriggered: number[];
  /** Currency unit */
  unit: string;
  /** Time period */
  period: string;
}

/**
 * Payload emitted with the 'budgetWarning' event when utilization
 * crosses a configured threshold for the first time.
 */
export interface BudgetWarningEvent {
  /** Threshold that was crossed (e.g., 0.8) */
  threshold: number;
  /** Current utilization as a percentage */
  utilizationPercent: number;
  /** Cumulative spend */
  totalSpend: number;
  /** Remaining budget */
  remaining: number;
  /** Total limit */
  limit: number;
}

/**
 * Error thrown when a budget check fails.
 * Follows the same pattern as SkillParseError (Story 4.1),
 * AgentConfigError (Story 4.2), and ConfigValidationError (Story 4.3).
 */
export class BudgetExceededError extends Error {
  /** Error code for programmatic handling */
  readonly code = 'BUDGET_EXCEEDED' as const;
  /** The reducer that was attempted */
  readonly reducer: string;
  /** The cost of the attempted action */
  readonly actionCost: number;
  /** Remaining budget at time of rejection */
  readonly remaining: number;
  /** Total budget limit */
  readonly limit: number;

  constructor(
    message: string,
    reducer: string,
    actionCost: number,
    remaining: number,
    limit: number,
  ) {
    super(message);
    this.name = 'BudgetExceededError';
    this.reducer = reducer;
    this.actionCost = actionCost;
    this.remaining = remaining;
    this.limit = limit;
  }
}
