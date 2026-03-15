/**
 * Budget Concurrency Tests (AC: 2, 4)
 * Story 4.4: Budget Tracking & Limits
 *
 * Tests verifying R4-003 mitigation: checkAndRecord() is synchronous,
 * no async gaps, concurrent publish attempts respect budget limits.
 *
 * Test count: 5
 */

import { describe, it, expect } from 'vitest';
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

describe('Budget Concurrency (Story 4.4 - R4-003 Mitigation)', () => {
  it('two rapid checkAndRecord() calls with total > budget -> second throws', () => {
    // Given a tracker with limit=100
    const tracker = new BudgetTracker(createTestConfig());

    // When two rapid calls are made with total > budget
    tracker.checkAndRecord('player_move', 60);

    // Then the second call throws BudgetExceededError
    expect(() => tracker.checkAndRecord('player_move', 60)).toThrow(BudgetExceededError);

    // And the first call's spend is recorded
    expect(tracker.getMetrics().totalSpend).toBe(60);
  });

  it('five sequential checkAndRecord() calls -> cumulative spend tracked accurately', () => {
    const tracker = new BudgetTracker(createTestConfig({ limit: 1000 }));

    // 5 sequential calls with different costs
    tracker.checkAndRecord('player_move', 10);
    tracker.checkAndRecord('harvest_start', 20);
    tracker.checkAndRecord('craft_item', 30);
    tracker.checkAndRecord('player_move', 10);
    tracker.checkAndRecord('harvest_start', 20);

    // Cumulative spend should be exactly 90
    expect(tracker.getMetrics().totalSpend).toBe(90);
    expect(tracker.remaining).toBe(910);
  });

  it('checkAndRecord() is synchronous: returns void, not a Promise', () => {
    const tracker = new BudgetTracker(createTestConfig());

    // checkAndRecord should be synchronous
    const result = tracker.checkAndRecord('player_move', 10);
    expect(result).toBeUndefined();

    // Verify it is NOT a Promise
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('budget exactly at limit after one action -> next checkAndRecord() throws immediately', () => {
    const tracker = new BudgetTracker(createTestConfig({ limit: 50 }));

    // Exhaust budget in one action
    tracker.checkAndRecord('player_move', 50);

    // Immediately throws on next call
    expect(() => tracker.checkAndRecord('player_move', 1)).toThrow(BudgetExceededError);
  });

  it('concurrent Promise.all publish attempts -> only budget-allowed number succeed', async () => {
    // Given a tracker with limit=50 and actions costing 10 each
    const tracker = new BudgetTracker(createTestConfig({ limit: 50 }));
    const costLookup = () => 10;
    const guard = new BudgetPublishGuard(tracker, costLookup);

    // Simulate 10 concurrent publish attempts via Promise.all
    // Each "publish" first calls guard() synchronously, then does async work
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => {
        return new Promise<{ success: boolean; index: number }>((resolve) => {
          try {
            guard.guard('player_move');
            // Simulate async publish work
            resolve({ success: true, index: i });
          } catch {
            resolve({ success: false, index: i });
          }
        });
      }),
    );

    // Exactly 5 should succeed (50 / 10 = 5 actions)
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes).toHaveLength(5);
    expect(failures).toHaveLength(5);
    expect(tracker.remaining).toBe(0);
  });
});
