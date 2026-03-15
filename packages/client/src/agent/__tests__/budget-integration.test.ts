/**
 * Budget Integration-Style Unit Tests (AC: 2, 4)
 * Story 4.4: Budget Tracking & Limits
 *
 * Simulates the budget guard integration with a mock publish pipeline.
 * Verifies pre-Crosstown enforcement, budget exhaustion behavior,
 * and reset recovery.
 *
 * Test count: 7
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

describe('Budget Integration (Story 4.4)', () => {
  describe('Publish pipeline simulation', () => {
    it('5 successful actions (cost 10 each) -> totalSpend=50, remaining=50', () => {
      // Given a budget tracker with limit=100 and a publish guard
      const tracker = new BudgetTracker(createTestConfig());
      const costLookup = () => 10;
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // When 5 actions are executed
      for (let i = 0; i < 5; i++) {
        guard.guard('player_move');
      }

      // Then totalSpend=50, remaining=50
      expect(tracker.getMetrics().totalSpend).toBe(50);
      expect(tracker.remaining).toBe(50);
    });

    it('action exceeding budget -> BudgetExceededError thrown', () => {
      const tracker = new BudgetTracker(createTestConfig());
      const costLookup = () => 10;
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // Spend 100 (exhaust budget)
      for (let i = 0; i < 10; i++) {
        guard.guard('player_move');
      }

      // 11th action throws
      expect(() => guard.guard('player_move')).toThrow(BudgetExceededError);
    });

    it('error thrown BEFORE mock publish function is called (pre-Crosstown enforcement)', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 15 }));
      const costLookup = () => 10;
      const guard = new BudgetPublishGuard(tracker, costLookup);
      const mockPublish = vi.fn().mockResolvedValue({ eventId: 'test' });

      // Spend 10 (remaining 5)
      guard.guard('player_move');

      // Next action: guard throws BEFORE mockPublish is called
      try {
        guard.guard('player_move'); // cost 10 > remaining 5
        mockPublish(); // Should never reach here
      } catch {
        // Expected
      }

      // Verify mock publish was never called
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('after budget exhaustion, all subsequent guard() calls throw', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 10 }));
      const costLookup = () => 10;
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // Exhaust budget
      guard.guard('player_move');

      // All subsequent calls throw
      expect(() => guard.guard('player_move')).toThrow(BudgetExceededError);
      expect(() => guard.guard('harvest_start')).toThrow(BudgetExceededError);
      expect(() => guard.guard('craft_item')).toThrow(BudgetExceededError);
    });

    it('budgetExhausted event emitted when guard() exhausts budget (AC4)', () => {
      // Given a budget tracker with limit=20 and a guard
      const tracker = new BudgetTracker(createTestConfig({ limit: 20 }));
      const costLookup = () => 10;
      const guard = new BudgetPublishGuard(tracker, costLookup);
      let exhaustedPayload: unknown;
      tracker.on('budgetExhausted', (payload) => {
        exhaustedPayload = payload;
      });

      // When actions exhaust the budget via the guard
      guard.guard('player_move'); // spend 10, remaining 10
      expect(exhaustedPayload).toBeUndefined(); // Not yet exhausted

      guard.guard('player_move'); // spend 10, remaining 0 -> exhausted

      // Then the budgetExhausted event is emitted with correct metrics
      expect(exhaustedPayload).toBeDefined();
      const metrics = exhaustedPayload as { totalSpend: number; remaining: number; status: string };
      expect(metrics.totalSpend).toBe(20);
      expect(metrics.remaining).toBe(0);
      expect(metrics.status).toBe('exhausted');
    });

    it('adjustLimit() recovery after exhaustion via guard (AC4)', () => {
      // Given a tracker exhausted via the guard
      const tracker = new BudgetTracker(createTestConfig({ limit: 10 }));
      const costLookup = () => 10;
      const guard = new BudgetPublishGuard(tracker, costLookup);

      guard.guard('player_move'); // Exhaust budget
      expect(tracker.getStatus()).toBe('exhausted');
      expect(() => guard.guard('player_move')).toThrow(BudgetExceededError);

      // When the limit is increased
      tracker.adjustLimit(30);

      // Then the guard allows actions again and status reflects current utilization
      expect(tracker.remaining).toBe(20);
      expect(tracker.getStatus()).toBe('active'); // 10/30 = 33% -> below thresholds
      expect(() => guard.guard('player_move')).not.toThrow();
      expect(tracker.remaining).toBe(10);
    });

    it('reset() after exhaustion -> budget available again, guard() succeeds', () => {
      const tracker = new BudgetTracker(createTestConfig({ limit: 20 }));
      const costLookup = () => 10;
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // Exhaust budget
      guard.guard('player_move');
      guard.guard('player_move');
      expect(tracker.getStatus()).toBe('exhausted');

      // Reset
      tracker.reset();
      expect(tracker.getStatus()).toBe('active');
      expect(tracker.remaining).toBe(20);

      // Guard succeeds again
      expect(() => guard.guard('player_move')).not.toThrow();
      expect(tracker.remaining).toBe(10);
    });
  });
});
