/**
 * Identity Prepend Tests (AC: 2)
 * Story 3.2: Game Action Handler (kind 30078)
 *
 * Tests for identity propagation: the handler prepends ctx.pubkey (64-char hex)
 * as the first argument to all SpacetimeDB reducer calls.
 *
 * Validates: AC2 (SpacetimeDB reducer call with identity propagation)
 *
 * Test count: 6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';
import { createGameActionHandler } from '../handler.js';

// Mock the spacetimedb-caller to capture args
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

describe('Identity Prepend (Story 3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pubkey is prepended as first element (not appended)', async () => {
    // Given an event with args [100, 200, true]
    // And ctx.pubkey is a valid 64-char hex string
    const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
    const originalArgs = [100, 200, true];
    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: originalArgs }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then callReducer should receive [pubkey, 100, 200, true]
    const { callReducer } = await import('../spacetimedb-caller.js');
    const callArgs = vi.mocked(callReducer).mock.calls[0][2];
    expect(callArgs[0]).toBe(pubkey);
    expect(callArgs).toEqual([pubkey, 100, 200, true]);
  });

  it('original args array is preserved unchanged', async () => {
    // Given an event with original args [{ x: 100, z: 200 }, 'run']
    const pubkey = 'ab'.repeat(32);
    const originalArgs = [{ x: 100, z: 200 }, 'run'];
    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: originalArgs }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then the original args should be preserved unchanged after the pubkey
    const { callReducer } = await import('../spacetimedb-caller.js');
    const callArgs = vi.mocked(callReducer).mock.calls[0][2];
    expect(callArgs).toEqual([pubkey, { x: 100, z: 200 }, 'run']);
  });

  it('pubkey is 64-char hex string format (not npub)', async () => {
    // Given ctx.pubkey in 64-char hex format
    const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then the first arg to callReducer should match /^[0-9a-f]{64}$/
    const { callReducer } = await import('../spacetimedb-caller.js');
    const callArgs = vi.mocked(callReducer).mock.calls[0][2];
    const firstArg = callArgs[0] as string;
    expect(firstArg).toMatch(/^[0-9a-f]{64}$/);
    // AND should NOT be npub format (npub1...)
    expect(firstArg).not.toMatch(/^npub1/);
  });

  it('empty args array results in [pubkey] only', async () => {
    // Given an event with empty args []
    const pubkey = 'ab'.repeat(32);
    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'get_status', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then callReducer should receive args: [pubkey]
    const { callReducer } = await import('../spacetimedb-caller.js');
    const callArgs = vi.mocked(callReducer).mock.calls[0][2];
    expect(callArgs).toEqual([pubkey]);
  });

  it('multi-element args produce [pubkey, arg1, arg2, arg3]', async () => {
    // Given an event with args ['arg1', 'arg2', 'arg3']
    const pubkey = 'ab'.repeat(32);
    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'complex_action', args: ['arg1', 'arg2', 'arg3'] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then callReducer should receive args: [pubkey, 'arg1', 'arg2', 'arg3']
    const { callReducer } = await import('../spacetimedb-caller.js');
    const callArgs = vi.mocked(callReducer).mock.calls[0][2];
    expect(callArgs).toEqual([pubkey, 'arg1', 'arg2', 'arg3']);
  });

  it('nested object args are preserved: [pubkey, { x: 100, z: 200 }, ...]', async () => {
    // Given an event with nested object args
    const pubkey = 'ab'.repeat(32);
    const nestedArgs = [{ x: 100, z: 200 }, [1, 2, 3], 'simple'];
    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'complex_action', args: nestedArgs }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then callReducer should receive args: [pubkey, { x: 100, z: 200 }, [1, 2, 3], 'simple']
    const { callReducer } = await import('../spacetimedb-caller.js');
    const callArgs = vi.mocked(callReducer).mock.calls[0][2];
    expect(callArgs).toEqual([pubkey, { x: 100, z: 200 }, [1, 2, 3], 'simple']);
  });
});
