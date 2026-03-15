/**
 * Budget Warning Event Tests (AC: 3)
 * Story 4.4: Budget Tracking & Limits
 *
 * Tests for threshold warning event emission: configurable thresholds,
 * one-time firing, BudgetWarningEvent payload structure.
 *
 * Test count: 8
 */

import { describe, it, expect, vi } from 'vitest';
import { BudgetTracker } from '../budget-tracker.js';
import type { BudgetTrackerConfig, BudgetWarningEvent } from '../budget-types.js';

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

describe('Budget Warning Events (Story 4.4)', () => {
  describe('AC3 - Threshold warning events', () => {
    it('no warning at 79% utilization', () => {
      // Given a tracker with default thresholds [0.8, 0.9]
      const tracker = new BudgetTracker(createTestConfig());
      const warningHandler = vi.fn();
      tracker.on('budgetWarning', warningHandler);

      // When spend reaches 79%
      tracker.checkAndRecord('player_move', 79);

      // Then no warning is emitted
      expect(warningHandler).not.toHaveBeenCalled();
    });

    it('emits budgetWarning at 80% utilization with threshold 0.8', () => {
      // Given a tracker with default thresholds [0.8, 0.9]
      const tracker = new BudgetTracker(createTestConfig());
      const warningHandler = vi.fn();
      tracker.on('budgetWarning', warningHandler);

      // When spend reaches 80%
      tracker.checkAndRecord('player_move', 80);

      // Then warning is emitted with threshold 0.8
      expect(warningHandler).toHaveBeenCalledTimes(1);
      const event: BudgetWarningEvent = warningHandler.mock.calls[0][0];
      expect(event.threshold).toBe(0.8);
    });

    it('emits budgetWarning at 90% utilization with threshold 0.9', () => {
      // Given a tracker with default thresholds
      const tracker = new BudgetTracker(createTestConfig());
      const warningHandler = vi.fn();
      tracker.on('budgetWarning', warningHandler);

      // When spend reaches 90% (in one call)
      tracker.checkAndRecord('player_move', 90);

      // Then both 0.8 and 0.9 thresholds fire
      expect(warningHandler).toHaveBeenCalledTimes(2);
      const events = warningHandler.mock.calls.map(
        (call) => (call[0] as BudgetWarningEvent).threshold,
      );
      expect(events).toContain(0.8);
      expect(events).toContain(0.9);
    });

    it('warning emitted only ONCE per threshold (no re-emit on subsequent actions)', () => {
      // Given a tracker at 80% utilization
      const tracker = new BudgetTracker(createTestConfig());
      const warningHandler = vi.fn();
      tracker.on('budgetWarning', warningHandler);

      // When spend crosses 80% threshold
      tracker.checkAndRecord('player_move', 80);
      expect(warningHandler).toHaveBeenCalledTimes(1);

      // And another action is recorded (still above 80%)
      tracker.checkAndRecord('player_move', 5);

      // Then no additional warning for 0.8 threshold
      // (only the 0.9 threshold fires because 85% < 90%)
      expect(warningHandler).toHaveBeenCalledTimes(1);
    });

    it('both 80% and 90% thresholds triggered in sequence', () => {
      const tracker = new BudgetTracker(createTestConfig());
      const thresholdsFired: number[] = [];
      tracker.on('budgetWarning', (event: BudgetWarningEvent) => {
        thresholdsFired.push(event.threshold);
      });

      // Cross 80% threshold
      tracker.checkAndRecord('player_move', 80);
      expect(thresholdsFired).toEqual([0.8]);

      // Cross 90% threshold
      tracker.checkAndRecord('player_move', 10);
      expect(thresholdsFired).toEqual([0.8, 0.9]);
    });

    it('custom thresholds trigger at configured percentages', () => {
      // Given custom thresholds [0.5, 0.75, 0.95]
      const tracker = new BudgetTracker(
        createTestConfig({ warningThresholds: [0.5, 0.75, 0.95] }),
      );
      const thresholdsFired: number[] = [];
      tracker.on('budgetWarning', (event: BudgetWarningEvent) => {
        thresholdsFired.push(event.threshold);
      });

      tracker.checkAndRecord('player_move', 50); // 50%
      expect(thresholdsFired).toEqual([0.5]);

      tracker.checkAndRecord('player_move', 25); // 75%
      expect(thresholdsFired).toEqual([0.5, 0.75]);

      tracker.checkAndRecord('player_move', 20); // 95%
      expect(thresholdsFired).toEqual([0.5, 0.75, 0.95]);
    });

    it('BudgetWarningEvent payload includes all required fields', () => {
      const tracker = new BudgetTracker(createTestConfig());
      let warningEvent: BudgetWarningEvent | undefined;
      tracker.on('budgetWarning', (event: BudgetWarningEvent) => {
        warningEvent = event;
      });

      tracker.checkAndRecord('player_move', 85);

      expect(warningEvent).toBeDefined();
      expect(warningEvent!.threshold).toBe(0.8);
      expect(warningEvent!.utilizationPercent).toBe(85);
      expect(warningEvent!.totalSpend).toBe(85);
      expect(warningEvent!.remaining).toBe(15);
      expect(warningEvent!.limit).toBe(100);
    });

    it('no warning events when no thresholds configured (empty array)', () => {
      const tracker = new BudgetTracker(createTestConfig({ warningThresholds: [] }));
      const warningHandler = vi.fn();
      tracker.on('budgetWarning', warningHandler);

      tracker.checkAndRecord('player_move', 95);

      expect(warningHandler).not.toHaveBeenCalled();
    });
  });
});
