/**
 * Pricing Integration Tests (AC: 1-5)
 * Story 3.3: Pricing Configuration & Fee Schedule
 *
 * Integration tests requiring Docker (SpacetimeDB + Crosstown).
 * Tests the full handler flow with pricing enforcement end-to-end.
 *
 * Validates: AC1-5 (full pricing pipeline)
 *
 * Test count: 5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';
import { createGameActionHandler } from '../handler.js';
import type { FeeSchedule } from '../fee-schedule.js';

// Skip all tests in this file unless Docker is available
const shouldRun = process.env.RUN_INTEGRATION_TESTS && process.env.BLS_AVAILABLE;

describe.skipIf(!shouldRun)('Pricing Integration (Story 3.3)', () => {
  const nodePubkey = 'aa'.repeat(32);
  const otherPubkey = 'bb'.repeat(32);

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

  it('full handler flow with sufficient payment -- handler invoked, action succeeds', async () => {
    // Given a fee schedule and sufficient payment
    const config = createBLSConfig({ feeSchedule });
    const handler = createGameActionHandler(config, nodePubkey);

    const ctx = createHandlerContext({
      amount: 100n,
      pubkey: otherPubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: otherPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const result = await handler(ctx);

    // Then the action should succeed
    expect(result.accepted).toBe(true);
  });

  it('handler with insufficient payment for specific reducer -- F04 rejection before handler', async () => {
    // Given a fee schedule where empire_form costs 100
    const config = createBLSConfig({ feeSchedule });
    const handler = createGameActionHandler(config, nodePubkey);

    const ctx = createHandlerContext({
      amount: 50n,
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

    // Then it should reject with F04
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F04');
    }
  });

  // NOTE: SDK-level pricing test removed -- it's a pure unit test that belongs in
  // pricing-config.test.ts (already covered there under "createPricingValidator rejects
  // amount below configured price").

  it('per-reducer pricing: cheap action (player_move, cost 1) passes with small payment', async () => {
    // Given player_move costs 1
    const config = createBLSConfig({ feeSchedule });
    const handler = createGameActionHandler(config, nodePubkey);

    const ctx = createHandlerContext({
      amount: 1n,
      pubkey: otherPubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: otherPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
        sig: '0'.repeat(128),
      }),
    });

    const result = await handler(ctx);

    expect(result.accepted).toBe(true);
  });

  it('per-reducer pricing: expensive action (empire_form, cost 100) fails with small payment', async () => {
    // Given empire_form costs 100
    const config = createBLSConfig({ feeSchedule });
    const handler = createGameActionHandler(config, nodePubkey);

    const ctx = createHandlerContext({
      amount: 1n,
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

    const result = await handler(ctx);

    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F04');
    }
  });

  it('self-write bypass: node own pubkey processes action with zero payment', async () => {
    // Given node's own pubkey
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

    const result = await handler(ctx);

    // Self-write bypass: should accept with zero payment
    expect(result.accepted).toBe(true);
  });
});
