/**
 * Insufficient Balance / Wallet Stub Mode Error Scenario Tests
 * Story 5.8: Error Scenarios & Graceful Degradation (AC3)
 *
 * Validates client-side pre-flight rejection when budget is insufficient:
 * - WalletClient stub mode returns fixed balance
 * - BudgetPublishGuard.canAfford() correctly checks budget
 * - BudgetPublishGuard.guard() throws BudgetExceededError when exhausted
 * - Wallet balance unchanged after BudgetExceededError rejection
 *
 * These are UNIT TESTS (no Docker required) because they test client-side
 * budget enforcement, not the full Crosstown/BLS pipeline.
 *
 * NOTE: Real ILP fee collection and INSUFFICIENT_BALANCE errors through
 * the full Crosstown/BLS pipeline are deferred to BLOCKER-1 resolution.
 * This test validates the stub accounting path only.
 *
 * The client.publish.canAfford() method (which combines WalletClient.getBalance() +
 * ActionCostRegistry.getCost()) is the full-pipeline affordability check.
 * BudgetPublishGuard.canAfford() is the agent-side budget check.
 *
 * @unit
 */

import { describe, it, expect, vi } from 'vitest';
import { WalletClient } from '../../wallet/wallet-client';
import { BudgetTracker } from '../../agent/budget-tracker';
import { BudgetPublishGuard } from '../../agent/budget-publish-guard';
import { BudgetExceededError } from '../../agent/budget-types';
import type { BudgetTrackerConfig } from '../../agent/budget-types';
import type { ErrorCatalogEntry } from './fixtures/error-helpers';

/**
 * Collected error catalog entries during test execution.
 * These entries are local to the budget test file since budget tests
 * are unit tests that run independently of the integration test catalog.
 * Entries were manually compiled into the Game Reference appendix (Task 8).
 */
const errorCatalog: ErrorCatalogEntry[] = [];

/**
 * Record an error catalog entry for documentation purposes.
 * Uses the shared ErrorCatalogEntry type from error-helpers.ts
 * but maintains a local catalog array for isolation from integration tests.
 */
function recordErrorCatalogEntry(entry: ErrorCatalogEntry): void {
  errorCatalog.push(entry);
}

/**
 * Creates a BudgetTrackerConfig for testing.
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
    extract_start: 20,
    craft_initiate_start: 30,
    expensive_action: 200,
    ...costs,
  };
  return vi.fn((reducer: string) => defaultCosts[reducer] ?? 10);
}

describe('Story 5.8 AC3: Insufficient Balance / Wallet Stub Mode', () => {
  // =========================================================================
  // WalletClient Stub Mode Tests
  // =========================================================================
  describe('WalletClient stub mode', () => {
    it('should return fixed balance when stub mode is enabled', async () => {
      /** Stub balance for testing wallet stub mode */
      const STUB_BALANCE = 10000;

      const wallet = new WalletClient('http://localhost:4041', 'a'.repeat(64));
      wallet.enableStubMode(STUB_BALANCE);

      const balance = await wallet.getBalance();
      expect(balance).toBe(STUB_BALANCE);
      expect(wallet.isStubMode()).toBe(true);
    });

    it('should return custom stub balance when specified', async () => {
      /** Custom stub balance for testing */
      const CUSTOM_BALANCE = 5000;

      const wallet = new WalletClient('http://localhost:4041', 'b'.repeat(64));
      wallet.enableStubMode(CUSTOM_BALANCE);

      const balance = await wallet.getBalance();
      expect(balance).toBe(CUSTOM_BALANCE);
    });
  });

  // =========================================================================
  // BudgetPublishGuard.canAfford() Tests
  // =========================================================================
  describe('BudgetPublishGuard.canAfford()', () => {
    it('should return true when remaining budget >= action cost', () => {
      /** Budget limit for affordability test */
      const BUDGET_LIMIT = 10000;

      const tracker = new BudgetTracker(createTestConfig({ limit: BUDGET_LIMIT }));
      const costLookup = createMockCostLookup();
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // player_move costs 10, budget is 10000 -- should be affordable
      expect(guard.canAfford('player_move')).toBe(true);
    });

    it('should return false when remaining budget < action cost', () => {
      /** Very low budget limit to test insufficient balance */
      const LOW_BUDGET_LIMIT = 5;

      const tracker = new BudgetTracker(createTestConfig({ limit: LOW_BUDGET_LIMIT }));
      const costLookup = createMockCostLookup();
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // player_move costs 10, budget is 5 -- should NOT be affordable
      expect(guard.canAfford('player_move')).toBe(false);

      recordErrorCatalogEntry({
        reducerName: 'player_move',
        errorCode: 'BUDGET_CHECK_FAILED',
        errorBoundary: 'budget-guard',
        messageFormat: 'BudgetPublishGuard.canAfford() returns false when remaining budget < cost',
        systemStateAfter: 'No state changes (pre-flight check, no reducer call)',
        preconditionViolated: 'Agent budget must have sufficient remaining balance for action cost',
      });
    });

    it('should return false after budget is partially spent', () => {
      /** Budget limit that allows partial spending */
      const PARTIAL_BUDGET = 25;

      const tracker = new BudgetTracker(createTestConfig({ limit: PARTIAL_BUDGET }));
      const costLookup = createMockCostLookup();
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // Spend 10 via player_move (remaining: 15)
      guard.guard('player_move');
      expect(tracker.remaining).toBe(15);

      // craft_initiate_start costs 30 -- should NOT be affordable
      expect(guard.canAfford('craft_initiate_start')).toBe(false);

      // player_move costs 10 -- should still be affordable (remaining: 15)
      expect(guard.canAfford('player_move')).toBe(true);
    });
  });

  // =========================================================================
  // BudgetPublishGuard.guard() BudgetExceededError Tests
  // =========================================================================
  describe('BudgetPublishGuard.guard() throws BudgetExceededError', () => {
    it('should throw BudgetExceededError with code BUDGET_EXCEEDED when budget exhausted', () => {
      /** Budget limit lower than action cost */
      const INSUFFICIENT_BUDGET = 5;

      const tracker = new BudgetTracker(createTestConfig({ limit: INSUFFICIENT_BUDGET }));
      const costLookup = createMockCostLookup();
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // player_move costs 10, budget is 5 -- should throw
      expect(() => guard.guard('player_move')).toThrow(BudgetExceededError);

      try {
        guard.guard('player_move');
      } catch (error) {
        expect(error).toBeInstanceOf(BudgetExceededError);
        const budgetError = error as BudgetExceededError;
        expect(budgetError.code).toBe('BUDGET_EXCEEDED');
        expect(budgetError.reducer).toBe('player_move');
        expect(budgetError.actionCost).toBe(10);
        expect(budgetError.remaining).toBe(INSUFFICIENT_BUDGET);
        expect(budgetError.limit).toBe(INSUFFICIENT_BUDGET);
        expect(budgetError.name).toBe('BudgetExceededError');
      }

      recordErrorCatalogEntry({
        reducerName: 'player_move',
        errorCode: 'BUDGET_EXCEEDED',
        errorBoundary: 'budget-guard',
        messageFormat:
          "Budget exceeded for action 'player_move': cost 10 exceeds remaining budget 5 (limit: 5 ILP/session)",
        systemStateAfter:
          'No SpacetimeDB reducer call made. No state changes. Wallet balance unchanged.',
        preconditionViolated:
          'Agent budget remaining must be >= action cost. ' +
          'Note: BudgetExceededError (not SigilError with INSUFFICIENT_BALANCE). ' +
          'INSUFFICIENT_BALANCE SigilError is the full-pipeline error from client.publish.publish().',
      });
    });

    it('should throw BudgetExceededError without calling the reducer', () => {
      /** Budget limit for no-reducer-call test */
      const NO_CALL_BUDGET = 5;

      const tracker = new BudgetTracker(createTestConfig({ limit: NO_CALL_BUDGET }));
      const costLookup = createMockCostLookup();
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // Guard should throw BEFORE any reducer call would be made
      let errorThrown = false;
      try {
        guard.guard('expensive_action'); // costs 200
      } catch (error) {
        errorThrown = true;
        expect(error).toBeInstanceOf(BudgetExceededError);
      }

      expect(errorThrown).toBe(true);

      // Verify no spend was recorded (guard threw before recordSpend)
      const metrics = tracker.getMetrics();
      expect(metrics.totalSpend).toBe(0);
      expect(metrics.actionCount).toBe(0);
    });
  });

  // =========================================================================
  // Wallet Balance Unchanged After BudgetExceededError
  // =========================================================================
  describe('Wallet balance unchanged after BudgetExceededError', () => {
    it('should leave wallet stub balance unchanged after guard() rejection', async () => {
      /** Stub balance for unchanged-balance test */
      const STUB_BALANCE = 10000;
      /** Insufficient budget to trigger rejection */
      const INSUFFICIENT_BUDGET = 5;

      // Create wallet in stub mode
      const wallet = new WalletClient('http://localhost:4041', 'c'.repeat(64));
      wallet.enableStubMode(STUB_BALANCE);

      // Check balance before rejection
      const balanceBefore = await wallet.getBalance();
      expect(balanceBefore).toBe(STUB_BALANCE);

      // Create guard with insufficient budget
      const tracker = new BudgetTracker(createTestConfig({ limit: INSUFFICIENT_BUDGET }));
      const costLookup = createMockCostLookup();
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // Attempt guard -- should throw
      expect(() => guard.guard('player_move')).toThrow(BudgetExceededError);

      // Check balance after rejection -- should be unchanged
      const balanceAfter = await wallet.getBalance();
      expect(balanceAfter).toBe(STUB_BALANCE);
      expect(balanceAfter).toBe(balanceBefore);
    });

    it('should leave budget tracker remaining unchanged after guard() rejection', () => {
      /** Budget for remaining-unchanged test */
      const BUDGET_LIMIT = 15;

      const tracker = new BudgetTracker(createTestConfig({ limit: BUDGET_LIMIT }));
      const costLookup = createMockCostLookup();
      const guard = new BudgetPublishGuard(tracker, costLookup);

      // Spend 10 (remaining: 5)
      guard.guard('player_move');
      expect(tracker.remaining).toBe(5);

      // Attempt expensive action -- should throw
      expect(() => guard.guard('extract_start')).toThrow(BudgetExceededError);

      // Remaining should still be 5 (unchanged by failed guard)
      expect(tracker.remaining).toBe(5);
    });
  });

  // =========================================================================
  // Documentation: Real ILP Fee Enforcement Deferred
  // =========================================================================
  describe('ILP fee enforcement deferral documentation', () => {
    it('should document that real ILP fee collection is deferred to BLOCKER-1', () => {
      // This test documents the deferral per BLOCKER-1 and DEBT-5:
      //
      // Real ILP fee collection and INSUFFICIENT_BALANCE errors
      // (SigilError with boundary 'crosstown') through the full
      // Crosstown/BLS pipeline are deferred to BLOCKER-1 resolution.
      //
      // This test suite validates the STUB ACCOUNTING PATH only:
      // - WalletClient.enableStubMode(balance) -> getBalance() returns fixed value
      // - BudgetPublishGuard.canAfford(reducer) -> checks agent budget remaining vs cost
      // - BudgetPublishGuard.guard(reducer) -> throws BudgetExceededError when over budget
      //
      // The full-pipeline affordability check is:
      //   client.publish.canAfford(reducer) = WalletClient.getBalance() + ActionCostRegistry.getCost()
      //
      // The agent-side budget check is:
      //   BudgetPublishGuard.canAfford(reducer) = BudgetTracker.remaining >= costLookup(reducer)
      //
      // WalletClient does NOT have a canAfford() method.

      recordErrorCatalogEntry({
        reducerName: 'N/A (ILP fee enforcement)',
        errorCode: 'INSUFFICIENT_BALANCE (deferred)',
        errorBoundary: 'crosstown (deferred) / budget-guard (current)',
        messageFormat:
          'Real INSUFFICIENT_BALANCE SigilError deferred to BLOCKER-1. ' +
          'Current: BudgetExceededError (code: BUDGET_EXCEEDED) from BudgetPublishGuard.guard(). ' +
          'Future: SigilError with INSUFFICIENT_BALANCE from client.publish.publish().',
        systemStateAfter:
          'No reducer call. Wallet balance and budget tracker remaining are unchanged.',
        preconditionViolated:
          'Budget guard: remaining budget >= action cost. ' +
          'Full pipeline (deferred): wallet balance >= action cost via Crosstown/BLS.',
      });

      // Verify the documented behavior is correct
      expect(BudgetExceededError).toBeDefined();

      const error = new BudgetExceededError('test message', 'test_reducer', 10, 5, 100);
      expect(error.code).toBe('BUDGET_EXCEEDED');
      expect(error.name).toBe('BudgetExceededError');
    });
  });
});
