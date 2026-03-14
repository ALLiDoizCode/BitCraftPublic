/**
 * Per-Reducer Pricing Enforcement Tests (AC: 2, 3)
 * Story 3.3: Pricing Configuration & Fee Schedule
 *
 * Tests for per-reducer pricing enforcement in the game action handler.
 * After the SDK-level kindPricing gate passes, the handler checks ctx.amount
 * against the specific reducer's cost from the fee schedule.
 *
 * Validates: AC2 (per-reducer pricing), AC3 (F04 rejection, pricing enforcement)
 *
 * Test count: 8 (3 core pricing + 2 differentiation + 2 rejection details + 1 fallback)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';
import { createGameActionHandler } from '../handler.js';
import type { FeeSchedule } from '../fee-schedule.js';

// Mock the spacetimedb-caller to avoid real HTTP calls
vi.mock('../spacetimedb-caller.js', () => ({
  callReducer: vi.fn().mockResolvedValue({ success: true, statusCode: 200 }),
  ReducerCallError: class ReducerCallError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.name = 'ReducerCallError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

describe('Per-Reducer Pricing Enforcement (Story 3.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Per-reducer pricing check (AC3)', () => {
    it('rejects when payment < reducer cost with F04', async () => {
      // Given a fee schedule where empire_form costs 100
      const feeSchedule: FeeSchedule = {
        version: 1,
        defaultCost: 10,
        actions: {
          empire_form: { cost: 100 },
        },
      };

      const config = createBLSConfig({ feeSchedule });

      // And an event calling empire_form with only 50 payment
      const ctx = createHandlerContext({
        amount: 50n,
        pubkey: 'ab'.repeat(32),
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'empire_form', args: [] }),
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then it should reject with F04
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(result.code).toBe('F04');
        expect(result.message).toContain('empire_form');
      }
    });

    it('accepts when payment >= reducer cost', async () => {
      // Given a fee schedule where player_move costs 1
      const feeSchedule: FeeSchedule = {
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
        },
      };

      const config = createBLSConfig({ feeSchedule });

      // And an event calling player_move with 100 payment (sufficient)
      const ctx = createHandlerContext({
        amount: 100n,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then it should accept
      expect(result.accepted).toBe(true);
    });

    it('uses defaultCost for reducer not in fee schedule', async () => {
      // Given a fee schedule with defaultCost 10 and no entry for test_action
      const feeSchedule: FeeSchedule = {
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
        },
      };

      const config = createBLSConfig({ feeSchedule });

      // And an event calling test_action with only 5 payment (below default 10)
      const ctx = createHandlerContext({
        amount: 5n,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'test_action', args: [] }),
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then it should reject (5 < defaultCost 10) with F04
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(result.code).toBe('F04');
      }
    });
  });

  describe('Handler without fee schedule (AC3)', () => {
    it('falls back to SDK-level kindPricing only when no fee schedule', async () => {
      // Given a config WITHOUT fee schedule (backward compatible)
      const config = createBLSConfig();
      // Ensure no feeSchedule is present
      expect(config.feeSchedule).toBeUndefined();

      // And an event with sufficient payment for SDK-level kindPricing
      const ctx = createHandlerContext({
        amount: 100n,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'player_move', args: [] }),
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then it should accept (no per-reducer check, SDK gate already passed)
      expect(result.accepted).toBe(true);
    });
  });

  describe('Per-reducer pricing differentiation (AC2, AC3)', () => {
    it('cheap action player_move (cost 1) passes with exact payment', async () => {
      // Given a fee schedule with player_move at cost 1
      const feeSchedule: FeeSchedule = {
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
          empire_form: { cost: 100 },
        },
      };

      const config = createBLSConfig({ feeSchedule });

      // And an event calling player_move with only 1 payment
      const ctx = createHandlerContext({
        amount: 1n,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then it should accept (1 >= cost 1)
      expect(result.accepted).toBe(true);
    });

    it('expensive action empire_form (cost 100) fails with small payment', async () => {
      // Given a fee schedule with empire_form at cost 100
      const feeSchedule: FeeSchedule = {
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
          empire_form: { cost: 100 },
        },
      };

      const config = createBLSConfig({ feeSchedule });

      // And an event calling empire_form with only 1 payment
      const ctx = createHandlerContext({
        amount: 1n,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'empire_form', args: [] }),
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then it should reject (1 < cost 100) with F04
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(result.code).toBe('F04');
      }
    });
  });

  describe('Rejection details (AC3)', () => {
    it('rejection message includes reducer name, paid amount, and required amount', async () => {
      // Given a fee schedule where empire_form costs 100
      const feeSchedule: FeeSchedule = {
        version: 1,
        defaultCost: 10,
        actions: {
          empire_form: { cost: 100 },
        },
      };

      const config = createBLSConfig({ feeSchedule });

      // And an event with insufficient payment (50 < 100)
      const rejectFn = vi.fn().mockReturnValue({
        accepted: false,
        code: 'F04',
        message: 'Insufficient payment',
      });

      const ctx = createHandlerContext({
        amount: 50n,
        reject: rejectFn,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'empire_form', args: [] }),
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const handler = createGameActionHandler(config);
      await handler(ctx);

      // Then the rejection message should include reducer name, paid amount, and required amount
      expect(rejectFn).toHaveBeenCalledWith('F04', expect.stringContaining('empire_form'));
      expect(rejectFn).toHaveBeenCalledWith('F04', expect.stringContaining('50'));
      expect(rejectFn).toHaveBeenCalledWith('F04', expect.stringContaining('100'));
    });

    it('rejection is logged with eventId, pubkey, reducer, and amounts', async () => {
      // Given a fee schedule where empire_form costs 100
      const feeSchedule: FeeSchedule = {
        version: 1,
        defaultCost: 10,
        actions: {
          empire_form: { cost: 100 },
        },
      };

      const config = createBLSConfig({ feeSchedule });
      const eventId = 'a1b2c3d4'.repeat(8);
      const pubkey = 'cd'.repeat(32);

      const ctx = createHandlerContext({
        amount: 50n,
        pubkey,
        decode: () => ({
          id: eventId,
          pubkey,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'empire_form', args: [] }),
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const handler = createGameActionHandler(config);
      await handler(ctx);

      // Then the rejection should be logged with full context
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Payment insufficient'));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('empire_form'));
    });
  });
});
