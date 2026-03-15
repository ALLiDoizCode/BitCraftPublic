/**
 * Budget Metrics Tests (AC: 5)
 * Story 4.4: Budget Tracking & Limits
 *
 * Tests for BudgetTracker.getMetrics() accuracy, per-reducer breakdown,
 * utilization percentage, and snapshot isolation.
 *
 * Test count: 5
 */

import { describe, it, expect } from 'vitest';
import { BudgetTracker } from '../budget-tracker.js';
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

describe('Budget Metrics (Story 4.4)', () => {
  describe('AC5 - Queryable budget metrics', () => {
    it('getMetrics() after zero actions -> correct initial values', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 500 }));

      const metrics = tracker.getMetrics();

      expect(metrics.totalSpend).toBe(0);
      expect(metrics.actionCount).toBe(0);
      expect(metrics.remaining).toBe(500);
      expect(metrics.utilizationPercent).toBe(0);
      expect(metrics.status).toBe('active');
      expect(Object.keys(metrics.perActionCosts)).toHaveLength(0);
    });

    it('getMetrics() after 3 different reducer actions -> correct per-reducer breakdown', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 1000 }));

      tracker.checkAndRecord('player_move', 10);
      tracker.checkAndRecord('harvest_start', 20);
      tracker.checkAndRecord('craft_item', 30);

      const metrics = tracker.getMetrics();
      expect(metrics.actionCount).toBe(3);
      expect(metrics.totalSpend).toBe(60);
      expect(metrics.perActionCosts['player_move']).toEqual({ totalCost: 10, count: 1 });
      expect(metrics.perActionCosts['harvest_start']).toEqual({ totalCost: 20, count: 1 });
      expect(metrics.perActionCosts['craft_item']).toEqual({ totalCost: 30, count: 1 });
    });

    it('getMetrics() after 5 actions of same reducer -> count=5, totalCost=sum', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 1000 }));

      tracker.checkAndRecord('player_move', 10);
      tracker.checkAndRecord('player_move', 10);
      tracker.checkAndRecord('player_move', 10);
      tracker.checkAndRecord('player_move', 10);
      tracker.checkAndRecord('player_move', 10);

      const metrics = tracker.getMetrics();
      expect(metrics.perActionCosts['player_move']).toEqual({ totalCost: 50, count: 5 });
      expect(metrics.totalSpend).toBe(50);
      expect(metrics.actionCount).toBe(5);
    });

    it('utilizationPercent is 0 after reset, correct after actions', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 200 }));

      // Initial state
      expect(tracker.getMetrics().utilizationPercent).toBe(0);

      // After action
      tracker.checkAndRecord('player_move', 50);
      expect(tracker.getMetrics().utilizationPercent).toBe(25);

      // After reset
      tracker.reset();
      expect(tracker.getMetrics().utilizationPercent).toBe(0);
    });

    it('getMetrics() returns snapshot (mutating returned object does not affect tracker)', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 100 }));
      tracker.checkAndRecord('player_move', 10);

      // Get a snapshot
      const snapshot = tracker.getMetrics();

      // Mutate the snapshot
      snapshot.totalSpend = 9999;
      snapshot.perActionCosts['player_move'] = { totalCost: 0, count: 0 };
      snapshot.warningThresholds.push(0.5);
      snapshot.thresholdsTriggered.push(0.99);

      // Get a fresh snapshot -- should NOT be affected by mutations
      const freshMetrics = tracker.getMetrics();
      expect(freshMetrics.totalSpend).toBe(10);
      expect(freshMetrics.perActionCosts['player_move']).toEqual({ totalCost: 10, count: 1 });
      expect(freshMetrics.warningThresholds).toEqual([0.8, 0.9]);
      expect(freshMetrics.thresholdsTriggered).toEqual([]);
    });
  });
});
