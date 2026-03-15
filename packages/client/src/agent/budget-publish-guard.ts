/**
 * Budget Publish Guard
 * Story 4.4: Budget Tracking & Limits
 *
 * Separates budget enforcement from the publish pipeline.
 * The guard's guard() method is called at the START of publishAction(),
 * BEFORE any async operations (wallet balance check, CrosstownAdapter interaction).
 *
 * Design rationale: The costLookup function decouples the guard from the
 * action cost registry implementation. In practice, it references
 * client.publish.getCost() from the ActionCostRegistry (Story 2.2).
 *
 * @module agent/budget-publish-guard
 */

import type { BudgetTracker } from './budget-tracker.js';

/**
 * Budget enforcement guard for the publish pipeline.
 *
 * Usage:
 * ```typescript
 * const guard = new BudgetPublishGuard(tracker, client.publish.getCost);
 * guard.guard('player_move');  // Throws BudgetExceededError if over budget
 * await client.publish.publish({ reducer: 'player_move', args: [100, 200] });
 * ```
 */
export class BudgetPublishGuard {
  private readonly budgetTracker: BudgetTracker;
  private readonly costLookup: (reducer: string) => number;

  /**
   * @param budgetTracker - The budget tracker instance (must not be null/undefined)
   * @param costLookup - Function to look up the cost of a reducer action (must not be null/undefined)
   * @throws Error if budgetTracker or costLookup is null/undefined
   */
  constructor(budgetTracker: BudgetTracker, costLookup: (reducer: string) => number) {
    if (!budgetTracker) {
      throw new Error('BudgetPublishGuard requires a BudgetTracker instance.');
    }
    if (!costLookup) {
      throw new Error('BudgetPublishGuard requires a costLookup function.');
    }
    this.budgetTracker = budgetTracker;
    this.costLookup = costLookup;
  }

  /**
   * Enforces budget for a reducer action.
   * Looks up the action cost and calls budgetTracker.checkAndRecord().
   * Synchronous -- must be called BEFORE any await in the publish pipeline.
   *
   * @param reducer - The reducer name to check and record
   * @throws BudgetExceededError if the action would exceed the budget
   */
  guard(reducer: string): void {
    const cost = this.costLookup(reducer);
    this.budgetTracker.checkAndRecord(reducer, cost);
  }

  /**
   * Non-mutating check: returns true if the action can be afforded.
   * Does NOT record any spend.
   * Returns false for invalid costs (negative, NaN, Infinity) to match
   * guard()'s behavior of rejecting invalid costs.
   *
   * @param reducer - The reducer name to check
   * @returns true if the action cost is valid and fits within the remaining budget
   */
  canAfford(reducer: string): boolean {
    const cost = this.costLookup(reducer);
    if (!Number.isFinite(cost) || cost < 0) {
      return false;
    }
    return this.budgetTracker.remaining >= cost;
  }
}
