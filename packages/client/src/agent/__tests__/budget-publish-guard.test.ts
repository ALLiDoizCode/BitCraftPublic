/**
 * Budget Publish Guard Unit Tests (AC: 2, 4)
 * Story 4.4: Budget Tracking & Limits
 *
 * Tests for BudgetPublishGuard class: guard() enforcement,
 * canAfford() non-mutating checks, error fields, and boundary conditions.
 *
 * Test count: 17
 */

import { describe, it, expect, vi } from 'vitest';
import { BudgetTracker } from '../budget-tracker.js';
import { BudgetPublishGuard } from '../budget-publish-guard.js';
import { BudgetExceededError } from '../budget-types.js';
import type { BudgetTrackerConfig } from '../budget-types.js';

/**
 * Creates a default BudgetTrackerConfig for testing.
 */
function createTestConfig(overrides?: Partial<BudgetTrackerConfig>): BudgetTrackerConfig {
  return {
    limit: 100,
    unit: 'ILP',
    period: 'session',
    warningThresholds: [0.8, 0.9],
    ...overrides,
  };
}

/**
 * Creates a mock cost lookup function.
 */
function createMockCostLookup(costs: Record<string, number> = {}): (reducer: string) => number {
  const defaultCosts: Record<string, number> = {
    player_move: 10,
    harvest_start: 20,
    craft_item: 30,
    ...costs,
  };
  return vi.fn((reducer: string) => defaultCosts[reducer] ?? 10);
}

describe('BudgetPublishGuard (Story 4.4)', () => {
  describe('constructor validation', () => {
    it('rejects null budgetTracker', () => {
      expect(
        () => new BudgetPublishGuard(null as unknown as BudgetTracker, createMockCostLookup()),
      ).toThrow('BudgetPublishGuard requires a BudgetTracker instance');
    });

    it('rejects undefined budgetTracker', () => {
      expect(
        () => new BudgetPublishGuard(undefined as unknown as BudgetTracker, createMockCostLookup()),
      ).toThrow('BudgetPublishGuard requires a BudgetTracker instance');
    });

    it('rejects null costLookup', () => {
      const tracker = new BudgetTracker(createTestConfig());
      expect(
        () => new BudgetPublishGuard(tracker, null as unknown as (reducer: string) => number),
      ).toThrow('BudgetPublishGuard requires a costLookup function');
    });
  });

  describe('guard() - budget enforcement', () => {
    it('succeeds with affordable action -> no error, spend recorded', () => {
      // Given a tracker with limit=100 and guard with cost lookup
      const tracker = new BudgetTracker(createTestConfig());
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      // When guard is called with an affordable action
      expect(() => guard.guard('player_move')).not.toThrow();

      // Then spend is recorded
      expect(tracker.remaining).toBe(90); // 100 - 10
    });

    it('throws BudgetExceededError with unaffordable action', () => {
      // Given a tracker with limit=15 and an action costing 20
      const tracker = new BudgetTracker(createTestConfig({ limit: 15 }));
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      // When guard is called with an unaffordable action (harvest_start costs 20)
      let thrownError: unknown;
      try {
        guard.guard('harvest_start');
      } catch (e) {
        thrownError = e;
      }

      // Then BudgetExceededError is thrown
      expect(thrownError).toBeInstanceOf(BudgetExceededError);
    });

    it('error includes correct fields: reducer, actionCost, remaining, limit', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 25 }));
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      let thrownError: unknown;
      try {
        guard.guard('craft_item'); // costs 30, limit 25
      } catch (e) {
        thrownError = e;
      }

      const err = thrownError as BudgetExceededError;
      expect(err.reducer).toBe('craft_item');
      expect(err.actionCost).toBe(30);
      expect(err.remaining).toBe(25);
      expect(err.limit).toBe(25);
    });

    it('error code field is BUDGET_EXCEEDED', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 5 }));
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      let thrownError: unknown;
      try {
        guard.guard('player_move'); // costs 10, limit 5
      } catch (e) {
        thrownError = e;
      }

      expect((thrownError as BudgetExceededError).code).toBe('BUDGET_EXCEEDED');
    });

    it('guard() is synchronous (no async gap between check and record)', () => {
      // Verify guard() returns void (synchronous), not a Promise
      const tracker = new BudgetTracker(createTestConfig());
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      const result = guard.guard('player_move');
      expect(result).toBeUndefined(); // Synchronous void return
    });

    it('sequential guard() calls decrement budget correctly', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 100 }));
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      // 5 sequential calls: each costs 10 (player_move)
      guard.guard('player_move');
      guard.guard('player_move');
      guard.guard('player_move');
      guard.guard('player_move');
      guard.guard('player_move');

      expect(tracker.remaining).toBe(50); // 100 - 5*10
    });

    it('throws for any cost > 0 when budget is exactly zero', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 10 }));
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      // Exhaust the budget
      guard.guard('player_move'); // costs 10, budget now 0

      // Any further action should throw
      expect(() => guard.guard('player_move')).toThrow(BudgetExceededError);
    });

    it('succeeds with zero-cost action when budget is at zero', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 10 }));
      const costLookup = vi.fn(() => 0);
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // Spend all budget
      tracker.checkAndRecord('player_move', 10);
      expect(tracker.remaining).toBe(0);

      // Zero-cost action should succeed even at zero budget
      expect(() => guard.guard('free_action')).not.toThrow();
    });

    it('uses whatever costLookup returns for unknown reducers', () => {
      const costLookup = vi.fn(() => 42);
      const tracker = new BudgetTracker(createTestConfig({ limit: 100 }));
      const guard = new BudgetPublishGuard(tracker, costLookup);

      guard.guard('unknown_reducer');

      expect(costLookup).toHaveBeenCalledWith('unknown_reducer');
      expect(tracker.remaining).toBe(58); // 100 - 42
    });
  });

  describe('canAfford() - non-mutating check', () => {
    it('returns true when remaining >= cost', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 100 }));
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      expect(guard.canAfford('player_move')).toBe(true); // 10 <= 100
    });

    it('returns false when remaining < cost', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 5 }));
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      expect(guard.canAfford('player_move')).toBe(false); // 10 > 5
    });

    it('returns false when costLookup returns negative value', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 100 }));
      const costLookup = vi.fn(() => -5);
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // canAfford should return false for invalid (negative) costs
      expect(guard.canAfford('player_move')).toBe(false);
    });

    it('returns false when costLookup returns NaN', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 100 }));
      const costLookup = vi.fn(() => NaN);
      const guard = new BudgetPublishGuard(tracker, costLookup);

      expect(guard.canAfford('player_move')).toBe(false);
    });

    it('does NOT record spend (non-mutating)', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 100 }));
      const guard = new BudgetPublishGuard(tracker, createMockCostLookup());

      // Call canAfford multiple times
      guard.canAfford('player_move');
      guard.canAfford('player_move');
      guard.canAfford('player_move');

      // Remaining should be unchanged
      expect(tracker.remaining).toBe(100);
      expect(tracker.getMetrics().actionCount).toBe(0);
    });
  });
});
