/**
 * Budget Tracker
 * Story 4.4: Budget Tracking & Limits
 *
 * Core budget tracking class that enforces per-agent budget limits.
 * Extends EventEmitter to emit 'budgetWarning' and 'budgetExhausted' events.
 *
 * Concurrency model (R4-003 mitigation):
 * - checkAndRecord() is fully synchronous (no async gaps)
 * - Node.js single-threaded execution ensures atomicity within an event loop tick
 * - The guard must be called BEFORE any await in the publish pipeline
 *
 * @module agent/budget-tracker
 */

import { EventEmitter } from 'node:events';
import type {
  BudgetTrackerConfig,
  BudgetStatus,
  BudgetMetrics,
  BudgetWarningEvent,
} from './budget-types.js';
import { BudgetExceededError } from './budget-types.js';
import type { AgentBudgetConfig } from './agent-config-types.js';

/**
 * Budget tracker that enforces per-agent budget limits with threshold warnings.
 *
 * Events:
 * - 'budgetWarning': emitted when utilization crosses a configured threshold
 * - 'budgetExhausted': emitted when budget reaches zero remaining
 */
export class BudgetTracker extends EventEmitter {
  private readonly config: BudgetTrackerConfig;
  private _limit: number;
  private totalSpend: number = 0;
  private actionCount: number = 0;
  private perActionCosts: Map<string, { totalCost: number; count: number }> = new Map();
  private thresholdsTriggered: Set<number> = new Set();

  constructor(config: BudgetTrackerConfig) {
    super();
    this.validateConfig(config);
    this.config = { ...config, warningThresholds: [...config.warningThresholds] };
    this._limit = config.limit;
  }

  /**
   * Validates the budget tracker configuration.
   * Rejects negative, NaN, Infinity limits and invalid thresholds.
   */
  private validateConfig(config: BudgetTrackerConfig): void {
    if (!Number.isFinite(config.limit) || config.limit < 0) {
      throw new Error(
        `Invalid budget limit: ${config.limit}. Must be a non-negative finite number.`
      );
    }
    for (const threshold of config.warningThresholds) {
      if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
        throw new Error(
          `Invalid warning threshold: ${threshold}. Must be a finite number between 0 and 1 (exclusive).`
        );
      }
    }
  }

  /**
   * Checks if the action would exceed the budget and throws if so.
   * PRIVATE to enforce that callers always use checkAndRecord() for atomicity.
   */
  private checkBudget(reducer: string, cost: number): void {
    if (this.totalSpend + cost > this._limit) {
      throw new BudgetExceededError(
        `Budget exceeded for action '${reducer}': cost ${cost} exceeds remaining budget ${this.remaining} (limit: ${this._limit} ${this.config.unit}/${this.config.period})`,
        reducer,
        cost,
        this.remaining,
        this._limit
      );
    }
  }

  /**
   * Records spend and checks for threshold warnings.
   * PRIVATE to enforce that callers always use checkAndRecord() for atomicity.
   */
  private recordSpend(reducer: string, cost: number): void {
    this.totalSpend += cost;
    this.actionCount += 1;

    // Update per-action costs
    const existing = this.perActionCosts.get(reducer);
    if (existing) {
      existing.totalCost += cost;
      existing.count += 1;
    } else {
      this.perActionCosts.set(reducer, { totalCost: cost, count: 1 });
    }

    // Check threshold warnings (guard against division by zero when limit is 0)
    const utilization = this._limit > 0 ? this.totalSpend / this._limit : 0;
    for (const threshold of this.config.warningThresholds) {
      if (utilization >= threshold && !this.thresholdsTriggered.has(threshold)) {
        this.thresholdsTriggered.add(threshold);
        const warningEvent: BudgetWarningEvent = {
          threshold,
          utilizationPercent: utilization * 100,
          totalSpend: this.totalSpend,
          remaining: this.remaining,
          limit: this._limit,
        };
        this.emit('budgetWarning', warningEvent);
      }
    }

    // Check budget exhaustion
    if (this.totalSpend >= this._limit) {
      this.emit('budgetExhausted', this.getMetrics());
    }
  }

  /**
   * The ONLY public mutation method. Atomically checks budget and records spend.
   * Synchronous to prevent R4-003 budget bypass via concurrency.
   *
   * @param reducer - The reducer name being invoked
   * @param cost - The cost of the action (must be non-negative and finite)
   * @throws BudgetExceededError if the action would exceed the budget
   * @throws Error if cost is negative, NaN, or Infinity
   */
  checkAndRecord(reducer: string, cost: number): void {
    if (!Number.isFinite(cost) || cost < 0) {
      throw new Error(`Invalid action cost: ${cost}. Must be a non-negative finite number.`);
    }
    this.checkBudget(reducer, cost);
    this.recordSpend(reducer, cost);
  }

  /**
   * Returns a snapshot of current budget metrics.
   * The returned object is a copy -- mutating it does not affect the tracker.
   */
  getMetrics(): BudgetMetrics {
    const perActionCosts: Record<string, { totalCost: number; count: number }> = {};
    for (const [key, value] of this.perActionCosts) {
      perActionCosts[key] = { totalCost: value.totalCost, count: value.count };
    }

    return {
      totalLimit: this._limit,
      totalSpend: this.totalSpend,
      remaining: this.remaining,
      utilizationPercent: this._limit > 0 ? (this.totalSpend / this._limit) * 100 : 0,
      status: this.getStatus(),
      actionCount: this.actionCount,
      perActionCosts,
      warningThresholds: [...this.config.warningThresholds],
      thresholdsTriggered: [...this.thresholdsTriggered],
      unit: this.config.unit,
      period: this.config.period,
    };
  }

  /**
   * Returns the current budget status based on current utilization.
   * Status reflects the live state, not historical threshold triggers.
   * - 'exhausted': totalSpend >= limit
   * - 'warning': current utilization exceeds at least one configured threshold
   * - 'active': under all thresholds
   */
  getStatus(): BudgetStatus {
    if (this.totalSpend >= this._limit) {
      return 'exhausted';
    }
    const utilization = this._limit > 0 ? this.totalSpend / this._limit : 0;
    for (const threshold of this.config.warningThresholds) {
      if (utilization >= threshold) {
        return 'warning';
      }
    }
    return 'active';
  }

  /**
   * Resets all tracked spend and thresholds to initial state.
   */
  reset(): void {
    this.totalSpend = 0;
    this.actionCount = 0;
    this.perActionCosts = new Map();
    this.thresholdsTriggered = new Set();
  }

  /**
   * Updates the budget limit. Validates the new limit using the same rules as the constructor.
   * @param newLimit - The new budget limit (must be non-negative and finite)
   */
  adjustLimit(newLimit: number): void {
    if (!Number.isFinite(newLimit) || newLimit < 0) {
      throw new Error(`Invalid budget limit: ${newLimit}. Must be a non-negative finite number.`);
    }
    this._limit = newLimit;
  }

  /**
   * Returns the remaining budget (never negative).
   */
  get remaining(): number {
    return Math.max(0, this._limit - this.totalSpend);
  }
}

/**
 * Factory function that creates a BudgetTracker from AgentBudgetConfig (Story 4.2).
 *
 * Maps AgentBudgetConfig fields to BudgetTrackerConfig:
 * - budgetConfig.limit -> config.limit
 * - budgetConfig.unit -> config.unit
 * - budgetConfig.period -> config.period
 * - budgetConfig.raw is intentionally NOT mapped (display/debug only)
 *
 * Default warning thresholds: [0.8, 0.9]
 */
export function createBudgetTrackerFromConfig(budgetConfig: AgentBudgetConfig): BudgetTracker {
  return new BudgetTracker({
    limit: budgetConfig.limit,
    unit: budgetConfig.unit,
    period: budgetConfig.period,
    warningThresholds: [0.8, 0.9],
  });
}
