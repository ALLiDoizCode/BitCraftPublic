/**
 * Error Mapping Tests (AC: 3, 4, 5)
 * Story 3.2: Game Action Handler (kind 30078)
 *
 * Tests for ILP error code mapping: handler errors are mapped to correct
 * ILP error codes (F06 for content errors, T00 for SpacetimeDB errors).
 *
 * Validates: AC3 (F06 for invalid content), AC4 (T00 for SpacetimeDB errors),
 *            AC5 (zero silent failures -- all errors include context)
 *
 * Test count: 5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';
import { createGameActionHandler } from '../handler.js';

// Mock the spacetimedb-caller to control errors
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

describe('Error Mapping (Story 3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invalid JSON content maps to F06 ILP error code', async () => {
    // Given an event with invalid JSON content
    const rejectFn = vi.fn().mockReturnValue({ accepted: false, code: 'F06', message: '' });
    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'not-json{{{',
        sig: '0'.repeat(128),
      }),
      reject: rejectFn,
    });

    // When the handler processes the event
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then ctx.reject should be called with code 'F06'
    expect(rejectFn).toHaveBeenCalledWith('F06', expect.any(String));
  });

  it('missing reducer/args maps to F06 ILP error code', async () => {
    // Given an event with JSON content missing the reducer field
    const rejectFn = vi.fn().mockReturnValue({ accepted: false, code: 'F06', message: '' });
    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ args: [1, 2, 3] }),
        sig: '0'.repeat(128),
      }),
      reject: rejectFn,
    });

    // When the handler processes the event
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then ctx.reject should be called with code 'F06'
    expect(rejectFn).toHaveBeenCalledWith(
      'F06',
      expect.stringContaining('missing reducer or args')
    );
  });

  it('SpacetimeDB 404 maps to T00 ILP error code', async () => {
    // Given a valid event but SpacetimeDB returns 404 (unknown reducer)
    const { ReducerCallError } = await import('../spacetimedb-caller.js');
    const { callReducer } = await import('../spacetimedb-caller.js');
    vi.mocked(callReducer).mockRejectedValueOnce(
      new ReducerCallError('Unknown reducer: unknown_reducer', 'UNKNOWN_REDUCER', 404)
    );

    const rejectFn = vi.fn().mockReturnValue({ accepted: false, code: 'T00', message: '' });
    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'unknown_reducer', args: [] }),
        sig: '0'.repeat(128),
      }),
      reject: rejectFn,
    });

    // When the handler processes the event and SpacetimeDB returns 404
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then ctx.reject should be called with code 'T00'
    expect(rejectFn).toHaveBeenCalledWith('T00', expect.stringContaining('Unknown reducer'));
  });

  it('SpacetimeDB 400/500 maps to T00 ILP error code', async () => {
    // Given a valid event but SpacetimeDB returns 400
    const { ReducerCallError } = await import('../spacetimedb-caller.js');
    const { callReducer } = await import('../spacetimedb-caller.js');
    vi.mocked(callReducer).mockRejectedValueOnce(
      new ReducerCallError('Reducer player_move failed: Bad arguments', 'REDUCER_FAILED', 400)
    );

    const rejectFn = vi.fn().mockReturnValue({ accepted: false, code: 'T00', message: '' });
    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: ['bad'] }),
        sig: '0'.repeat(128),
      }),
      reject: rejectFn,
    });

    // When the handler processes the event and SpacetimeDB returns error
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then ctx.reject should be called with code 'T00'
    expect(rejectFn).toHaveBeenCalledWith('T00', expect.stringContaining('failed'));
  });

  it('all errors include event ID, truncated pubkey, reducer name, and error reason', async () => {
    // Given an event that will cause an error
    const eventId = 'a1b2c3d4'.repeat(8);
    const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: eventId,
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'invalid-json',
        sig: '0'.repeat(128),
      }),
      reject: vi.fn().mockReturnValue({ accepted: false, code: 'F06', message: '' }),
    });

    // When the handler processes the event and fails
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then error log should include:
    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' '));
    const errorLog = allLogs.find((l) => l.includes('[BLS]'));
    expect(errorLog).toBeDefined();
    // - event ID
    expect(errorLog).toContain(eventId);
    // - pubkey (truncated: first 8 + last 4 chars)
    expect(errorLog).toContain(pubkey.slice(0, 8));
    expect(errorLog).toContain(pubkey.slice(-4));
    // - reducer name (defaults to 'unknown' when content parsing fails before extraction)
    expect(errorLog).toContain('reducer: unknown');
    // - error reason
    expect(errorLog).toContain('F06');
  });
});
