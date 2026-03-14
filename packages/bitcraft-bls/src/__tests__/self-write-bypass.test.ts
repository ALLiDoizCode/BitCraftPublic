/**
 * Self-Write Bypass Tests (AC: 3)
 * Story 3.3: Pricing Configuration & Fee Schedule
 *
 * Tests for the self-write bypass: the node's own pubkey can submit events
 * without paying. Both SDK-level and per-reducer pricing are bypassed.
 *
 * Validates: AC3 (self-write bypass consistent with SDK default behavior)
 *
 * Test count: 5
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

describe('Self-Write Bypass (Story 3.3)', () => {
  const nodePubkey = 'aa'.repeat(32); // 64-char hex
  const otherPubkey = 'bb'.repeat(32); // Different pubkey

  const feeSchedule: FeeSchedule = {
    version: 1,
    defaultCost: 10,
    actions: {
      player_move: { cost: 1 },
      empire_form: { cost: 100 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('per-reducer pricing bypassed for node own pubkey', async () => {
    // Given a fee schedule where empire_form costs 100
    // And the handler is created with the node's identity pubkey
    const config = createBLSConfig({ feeSchedule });
    const handler = createGameActionHandler(config, nodePubkey);

    // And an event from the node's own pubkey with zero payment
    const ctx = createHandlerContext({
      amount: 0n,
      pubkey: nodePubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: nodePubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'empire_form', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const result = await handler(ctx);

    // Then it should accept (self-write bypass)
    expect(result.accepted).toBe(true);
  });

  it('non-node pubkeys are subject to both SDK and per-reducer pricing', async () => {
    // Given the same fee schedule
    const config = createBLSConfig({ feeSchedule });
    const handler = createGameActionHandler(config, nodePubkey);

    // And an event from a different pubkey with insufficient payment
    const ctx = createHandlerContext({
      amount: 0n,
      pubkey: otherPubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: otherPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'empire_form', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const result = await handler(ctx);

    // Then it should reject (not self-write, insufficient payment)
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F04');
    }
  });

  it('self-write bypass works with zero-amount packets', async () => {
    // Given a fee schedule with expensive actions
    const config = createBLSConfig({ feeSchedule });
    const handler = createGameActionHandler(config, nodePubkey);

    // And an event from node's pubkey with amount = 0
    const ctx = createHandlerContext({
      amount: 0n,
      pubkey: nodePubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: nodePubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const result = await handler(ctx);

    // Then it should accept (self-write bypass, even with zero amount)
    expect(result.accepted).toBe(true);
  });

  it('self-write bypass logged at debug level', async () => {
    // Given a handler with node identity
    const config = createBLSConfig({ feeSchedule });
    const handler = createGameActionHandler(config, nodePubkey);

    const ctx = createHandlerContext({
      amount: 0n,
      pubkey: nodePubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: nodePubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'empire_form', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    await handler(ctx);

    // Then the self-write bypass should be logged
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Self-write bypass'));
  });

  it('SDK createPricingValidator allows free access for node own pubkey (SDK default)', async () => {
    // This tests the SDK-level behavior: the SDK's createPricingValidator
    // does not know about pubkeys (it only checks kind + amount). The
    // self-write bypass is handled at the node/handler level, not by
    // createPricingValidator. This test documents the architecture.
    //
    // Given kindPricing for kind 30078
    const { createPricingValidator } = await import('@crosstown/sdk');
    const validator = createPricingValidator({ 30078: 100n });

    // When validating with zero amount (self-write scenario)
    const result = validator(30078, 0n);

    // Then the SDK rejects it (SDK does not know about self-write)
    // Self-write bypass is handled at handler level, not SDK level
    expect(result.valid).toBe(false);
    expect(result.code).toBe('F04');
  });
});
