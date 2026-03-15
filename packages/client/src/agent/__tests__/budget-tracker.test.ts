/**
 * Budget Tracker Unit Tests (AC: 1, 2, 3, 4, 5)
 * Story 4.4: Budget Tracking & Limits
 *
 * Tests for BudgetTracker class: initialization, spend tracking,
 * limit enforcement, reset, adjustLimit, and factory function.
 *
 * Test count: 28
 */

import { describe, it, expect } from 'vitest';
import { BudgetTracker, createBudgetTrackerFromConfig } from '../budget-tracker.js';
import { BudgetExceededError } from '../budget-types.js';
import type { BudgetTrackerConfig } from '../budget-types.js';
import type { AgentBudgetConfig } from '../agent-config-types.js';

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

describe('BudgetTracker (Story 4.4)', () => {
  describe('AC1 - Budget initialization', () => {
    it('initializes with totalSpend = 0 and remaining = limit', () => {
      // Given a valid BudgetTrackerConfig
      const config = createTestConfig({ limit: 500 });

      // When the tracker is created
      const tracker = new BudgetTracker(config);

      // Then spend is zero and remaining equals the limit
      const metrics = tracker.getMetrics();
      expect(metrics.totalSpend).toBe(0);
      expect(metrics.remaining).toBe(500);
      expect(metrics.totalLimit).toBe(500);
      expect(metrics.actionCount).toBe(0);
      expect(tracker.remaining).toBe(500);
    });

    it('rejects negative budget limit in constructor', () => {
      // Given a config with a negative limit
      const config = createTestConfig({ limit: -10 });

      // When the tracker is created -> error
      expect(() => new BudgetTracker(config)).toThrow('Invalid budget limit');
    });

    it('rejects NaN budget limit in constructor', () => {
      const config = createTestConfig({ limit: NaN });
      expect(() => new BudgetTracker(config)).toThrow('Invalid budget limit');
    });

    it('rejects Infinity budget limit in constructor', () => {
      const config = createTestConfig({ limit: Infinity });
      expect(() => new BudgetTracker(config)).toThrow('Invalid budget limit');
    });

    it('accepts limit of zero (edge case: no budget)', () => {
      // Given a config with limit=0
      const tracker = new BudgetTracker(createTestConfig({ limit: 0, warningThresholds: [] }));

      // Then remaining is 0 and status is exhausted immediately
      expect(tracker.remaining).toBe(0);
      expect(tracker.getStatus()).toBe('exhausted');

      // And zero-cost actions succeed
      expect(() => tracker.checkAndRecord('free_action', 0)).not.toThrow();

      // But any positive-cost action throws
      expect(() => tracker.checkAndRecord('player_move', 1)).toThrow(BudgetExceededError);
    });

    it('rejects warning thresholds outside (0, 1) range', () => {
      expect(() => new BudgetTracker(createTestConfig({ warningThresholds: [0] }))).toThrow(
        'Invalid warning threshold',
      );
      expect(() => new BudgetTracker(createTestConfig({ warningThresholds: [1] }))).toThrow(
        'Invalid warning threshold',
      );
      expect(() => new BudgetTracker(createTestConfig({ warningThresholds: [-0.5] }))).toThrow(
        'Invalid warning threshold',
      );
      expect(() => new BudgetTracker(createTestConfig({ warningThresholds: [1.5] }))).toThrow(
        'Invalid warning threshold',
      );
    });
  });

  describe('AC2 - checkAndRecord spend tracking', () => {
    it('records spend when cost < remaining', () => {
      // Given a tracker with limit=100
      const tracker = new BudgetTracker(createTestConfig());

      // When an action with cost 30 is recorded
      tracker.checkAndRecord('player_move', 30);

      // Then spend is tracked and remaining decremented
      expect(tracker.remaining).toBe(70);
      const metrics = tracker.getMetrics();
      expect(metrics.totalSpend).toBe(30);
      expect(metrics.actionCount).toBe(1);
    });

    it('throws BudgetExceededError when cost > remaining', () => {
      // Given a tracker with limit=100 and 90 already spent
      const tracker = new BudgetTracker(createTestConfig());
      tracker.checkAndRecord('player_move', 90);

      // When an action with cost 20 is attempted (remaining=10)
      let thrownError: unknown;
      try {
        tracker.checkAndRecord('harvest_start', 20);
      } catch (e) {
        thrownError = e;
      }

      // Then BudgetExceededError is thrown with correct fields
      expect(thrownError).toBeInstanceOf(BudgetExceededError);
      const err = thrownError as BudgetExceededError;
      expect(err.code).toBe('BUDGET_EXCEEDED');
      expect(err.reducer).toBe('harvest_start');
      expect(err.actionCost).toBe(20);
      expect(err.remaining).toBe(10);
      expect(err.limit).toBe(100);
      expect(err.name).toBe('BudgetExceededError');
    });

    it('records spend when cost == remaining (budget exactly exhausted)', () => {
      // Given a tracker with limit=100 and 90 already spent
      const tracker = new BudgetTracker(createTestConfig());
      tracker.checkAndRecord('player_move', 90);

      // When an action with cost exactly equal to remaining (10) is recorded
      tracker.checkAndRecord('player_move', 10);

      // Then spend is recorded and budget is exactly exhausted
      expect(tracker.remaining).toBe(0);
      expect(tracker.getStatus()).toBe('exhausted');
    });

    it('records zero-cost action and tracks it in metrics', () => {
      // Given a tracker with limit=100
      const tracker = new BudgetTracker(createTestConfig());

      // When a zero-cost action is recorded
      tracker.checkAndRecord('free_action', 0);

      // Then the action is counted but spend is unchanged
      const metrics = tracker.getMetrics();
      expect(metrics.actionCount).toBe(1);
      expect(metrics.totalSpend).toBe(0);
      expect(metrics.remaining).toBe(100);
      expect(metrics.perActionCosts['free_action']).toEqual({ totalCost: 0, count: 1 });
    });

    it('rejects negative cost (prevents budget bypass)', () => {
      // Given a tracker with limit=100
      const tracker = new BudgetTracker(createTestConfig());

      // When a negative cost is attempted -> should throw
      expect(() => tracker.checkAndRecord('player_move', -10)).toThrow('Invalid action cost');

      // And no spend is recorded
      expect(tracker.getMetrics().totalSpend).toBe(0);
    });

    it('rejects NaN cost', () => {
      const tracker = new BudgetTracker(createTestConfig());
      expect(() => tracker.checkAndRecord('player_move', NaN)).toThrow('Invalid action cost');
    });

    it('rejects Infinity cost', () => {
      const tracker = new BudgetTracker(createTestConfig());
      expect(() => tracker.checkAndRecord('player_move', Infinity)).toThrow('Invalid action cost');
    });

    it('rejects -Infinity cost', () => {
      const tracker = new BudgetTracker(createTestConfig());
      expect(() => tracker.checkAndRecord('player_move', -Infinity)).toThrow('Invalid action cost');
    });
  });

  describe('AC4 - Budget exhaustion', () => {
    it('emits budgetExhausted event when budget reaches zero', () => {
      // Given a tracker with limit=50
      const tracker = new BudgetTracker(createTestConfig({ limit: 50 }));
      let exhaustedPayload: unknown;
      tracker.on('budgetExhausted', (payload) => {
        exhaustedPayload = payload;
      });

      // When an action exhausts the budget
      tracker.checkAndRecord('player_move', 50);

      // Then budgetExhausted event is emitted with metrics payload
      expect(exhaustedPayload).toBeDefined();
      expect((exhaustedPayload as { totalSpend: number }).totalSpend).toBe(50);
      expect((exhaustedPayload as { remaining: number }).remaining).toBe(0);
    });
  });

  describe('AC5 - getMetrics', () => {
    it('returns correct totals after multiple actions', () => {
      // Given a tracker with limit=1000
      const tracker = new BudgetTracker(createTestConfig({ limit: 1000 }));

      // When multiple actions are recorded
      tracker.checkAndRecord('player_move', 50);
      tracker.checkAndRecord('harvest_start', 100);
      tracker.checkAndRecord('player_move', 50);

      // Then metrics reflect correct totals
      const metrics = tracker.getMetrics();
      expect(metrics.totalSpend).toBe(200);
      expect(metrics.remaining).toBe(800);
      expect(metrics.actionCount).toBe(3);
      expect(metrics.utilizationPercent).toBe(20);
      expect(metrics.totalLimit).toBe(1000);
    });

    it('tracks per-reducer cost breakdown correctly', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 1000 }));
      tracker.checkAndRecord('player_move', 10);
      tracker.checkAndRecord('harvest_start', 20);
      tracker.checkAndRecord('player_move', 10);

      const metrics = tracker.getMetrics();
      expect(metrics.perActionCosts['player_move']).toEqual({ totalCost: 20, count: 2 });
      expect(metrics.perActionCosts['harvest_start']).toEqual({ totalCost: 20, count: 1 });
    });

    it('calculates utilizationPercent correctly', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 200 }));
      tracker.checkAndRecord('player_move', 50);

      expect(tracker.getMetrics().utilizationPercent).toBe(25);
    });
  });

  describe('getStatus', () => {
    it('returns active when under all thresholds', () => {
      const tracker = new BudgetTracker(createTestConfig());
      tracker.checkAndRecord('player_move', 10);
      expect(tracker.getStatus()).toBe('active');
    });

    it('returns warning when threshold exceeded but budget not exhausted', () => {
      const tracker = new BudgetTracker(createTestConfig());
      tracker.checkAndRecord('player_move', 85);
      expect(tracker.getStatus()).toBe('warning');
    });

    it('returns exhausted when totalSpend >= limit', () => {
      const tracker = new BudgetTracker(createTestConfig());
      tracker.checkAndRecord('player_move', 100);
      expect(tracker.getStatus()).toBe('exhausted');
    });
  });

  describe('reset', () => {
    it('clears all tracked spend and resets to initial state', () => {
      // Given a tracker with some spend recorded
      const tracker = new BudgetTracker(createTestConfig());
      tracker.checkAndRecord('player_move', 90);
      expect(tracker.getStatus()).toBe('warning');

      // When reset is called
      tracker.reset();

      // Then all state is cleared
      const metrics = tracker.getMetrics();
      expect(metrics.totalSpend).toBe(0);
      expect(metrics.remaining).toBe(100);
      expect(metrics.actionCount).toBe(0);
      expect(metrics.status).toBe('active');
      expect(Object.keys(metrics.perActionCosts)).toHaveLength(0);
      expect(metrics.thresholdsTriggered).toHaveLength(0);
    });
  });

  describe('adjustLimit', () => {
    it('updates the budget limit', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 100 }));
      tracker.checkAndRecord('player_move', 50);

      tracker.adjustLimit(200);

      expect(tracker.remaining).toBe(150);
      expect(tracker.getMetrics().totalLimit).toBe(200);
    });

    it('rejects invalid new limit (NaN, negative, Infinity)', () => {
      const tracker = new BudgetTracker(createTestConfig());
      expect(() => tracker.adjustLimit(-1)).toThrow('Invalid budget limit');
      expect(() => tracker.adjustLimit(NaN)).toThrow('Invalid budget limit');
      expect(() => tracker.adjustLimit(Infinity)).toThrow('Invalid budget limit');
    });

    it('adjusting limit below current spend -> remaining is 0, status exhausted', () => {
      // Given a tracker with limit=100 and 60 already spent
      const tracker = new BudgetTracker(createTestConfig({ limit: 100 }));
      tracker.checkAndRecord('player_move', 60);

      // When the limit is reduced below current spend
      tracker.adjustLimit(30);

      // Then remaining is 0 (clamped by Math.max) and status is exhausted
      expect(tracker.remaining).toBe(0);
      expect(tracker.getStatus()).toBe('exhausted');
      expect(() => tracker.checkAndRecord('player_move', 1)).toThrow(BudgetExceededError);
    });

    it('recovers from exhaustion when limit is increased (AC4)', () => {
      // Given a tracker with limit=50 that is exhausted
      const tracker = new BudgetTracker(createTestConfig({ limit: 50 }));
      tracker.checkAndRecord('player_move', 50);
      expect(tracker.getStatus()).toBe('exhausted');
      expect(tracker.remaining).toBe(0);

      // When the limit is increased significantly (utilization drops below thresholds)
      tracker.adjustLimit(200);

      // Then the tracker reflects live status based on current utilization (50/200 = 25%)
      expect(tracker.remaining).toBe(150);
      expect(tracker.getStatus()).toBe('active');

      // And further actions are allowed
      expect(() => tracker.checkAndRecord('player_move', 10)).not.toThrow();
      expect(tracker.remaining).toBe(140);
    });
  });

  describe('remaining getter', () => {
    it('returns Math.max(0, limit - totalSpend)', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 50 }));
      tracker.checkAndRecord('player_move', 50);

      // remaining should be 0, not negative
      expect(tracker.remaining).toBe(0);
    });
  });

  describe('createBudgetTrackerFromConfig factory', () => {
    it('creates correct tracker from AgentBudgetConfig', () => {
      // Given an AgentBudgetConfig (from Story 4.2)
      const budgetConfig: AgentBudgetConfig = {
        limit: 100,
        unit: 'ILP',
        period: 'session',
        raw: '100 ILP/session',
      };

      // When createBudgetTrackerFromConfig is called
      const tracker = createBudgetTrackerFromConfig(budgetConfig);

      // Then the tracker is configured correctly
      const metrics = tracker.getMetrics();
      expect(metrics.totalLimit).toBe(100);
      expect(metrics.unit).toBe('ILP');
      expect(metrics.period).toBe('session');
      expect(metrics.warningThresholds).toEqual([0.8, 0.9]);
      expect(metrics.totalSpend).toBe(0);
    });
  });
});
