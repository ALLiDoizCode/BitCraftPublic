/**
 * Handler Dispatch Tests (AC: 1, 2, 3, 4, 5)
 * Story 3.2: Game Action Handler (kind 30078)
 *
 * Tests for createGameActionHandler() factory function that creates the
 * game action handler dispatching to content parser and SpacetimeDB caller.
 *
 * Validates: AC1 (event decoding), AC2 (reducer call with identity),
 *            AC3 (invalid content), AC4 (SpacetimeDB errors), AC5 (zero silent failures)
 *
 * Test count: 10
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';
import { createGameActionHandler } from '../handler.js';

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

describe('Handler Dispatch (Story 3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event decoding (AC1)', () => {
    it('calls ctx.decode() to get the full NostrEvent', async () => {
      // Given a valid handler context with a decodable event
      const decodeFn = vi.fn().mockReturnValue({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
        sig: '0'.repeat(128),
      });

      const ctx = createHandlerContext({ decode: decodeFn });

      // When the handler processes the event
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      await handler(ctx);

      // Then ctx.decode() should have been called
      expect(decodeFn).toHaveBeenCalledOnce();
    });

    it('parses event.content to extract reducer and args', async () => {
      // Given an event with content containing reducer 'craft_item' and args
      const content = JSON.stringify({ reducer: 'craft_item', args: ['recipe_001', 5] });
      const ctx = createHandlerContext({
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content,
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then the reducer and args should be extracted from content
      // (verified indirectly by successful accept)
      expect(result.accepted).toBe(true);
    });
  });

  describe('Successful dispatch (AC2)', () => {
    it('prepends ctx.pubkey to args as first element', async () => {
      // Given an event with args [100, 200]
      // And ctx.pubkey is 'ab'.repeat(32)
      const pubkey = 'ab'.repeat(32);
      const ctx = createHandlerContext({
        pubkey,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      await handler(ctx);

      // Then callReducer should receive args: [pubkey, 100, 200]
      const { callReducer } = await import('../spacetimedb-caller.js');
      expect(callReducer).toHaveBeenCalledWith(expect.any(Object), 'player_move', [
        pubkey,
        100,
        200,
      ]);
    });

    it('returns ctx.accept({ eventId: event.id }) on success', async () => {
      // Given a valid event and successful SpacetimeDB call
      const eventId = 'a1b2c3d4'.repeat(8);
      const acceptFn = vi.fn().mockReturnValue({ accepted: true, metadata: { eventId } });
      const ctx = createHandlerContext({
        decode: () => ({
          id: eventId,
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'player_move', args: [] }),
          sig: '0'.repeat(128),
        }),
        accept: acceptFn,
      });

      // When the handler processes the event
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then it should return ctx.accept({ eventId: event.id })
      expect(result.accepted).toBe(true);
      expect(acceptFn).toHaveBeenCalledWith({ eventId });
    });
  });

  describe('Invalid content handling (AC3)', () => {
    it('returns ctx.reject("F06", ...) for invalid content', async () => {
      // Given an event with invalid JSON content
      const rejectFn = vi
        .fn()
        .mockReturnValue({ accepted: false, code: 'F06', message: 'Invalid event content' });
      const ctx = createHandlerContext({
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: 'not valid json',
          sig: '0'.repeat(128),
        }),
        reject: rejectFn,
      });

      // When the handler processes the event
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then it should return ctx.reject('F06', ...)
      expect(result.accepted).toBe(false);
      expect(rejectFn).toHaveBeenCalledWith(
        'F06',
        expect.stringContaining('Invalid event content')
      );
    });
  });

  describe('SpacetimeDB error handling (AC4)', () => {
    it('returns ctx.reject("T00", "Unknown reducer: {name}") on 404', async () => {
      // Given a valid event but SpacetimeDB returns 404 (unknown reducer)
      const { ReducerCallError } = await import('../spacetimedb-caller.js');
      const { callReducer } = await import('../spacetimedb-caller.js');
      vi.mocked(callReducer).mockRejectedValueOnce(
        new ReducerCallError('Unknown reducer: nonexistent_reducer', 'UNKNOWN_REDUCER', 404)
      );

      const rejectFn = vi
        .fn()
        .mockReturnValue({ accepted: false, code: 'T00', message: 'Unknown reducer' });
      const ctx = createHandlerContext({
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'nonexistent_reducer', args: [] }),
          sig: '0'.repeat(128),
        }),
        reject: rejectFn,
      });

      // When the handler processes the event
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      await handler(ctx);

      // Then it should return ctx.reject('T00', 'Unknown reducer: nonexistent_reducer')
      expect(rejectFn).toHaveBeenCalledWith(
        'T00',
        expect.stringContaining('Unknown reducer: nonexistent_reducer')
      );
    });

    it('returns ctx.reject("T00", "Reducer {name} failed: ...") on 400/500', async () => {
      // Given a valid event but SpacetimeDB returns 400
      const { ReducerCallError } = await import('../spacetimedb-caller.js');
      const { callReducer } = await import('../spacetimedb-caller.js');
      vi.mocked(callReducer).mockRejectedValueOnce(
        new ReducerCallError('Reducer player_move failed: Bad arguments', 'REDUCER_FAILED', 400)
      );

      const rejectFn = vi
        .fn()
        .mockReturnValue({ accepted: false, code: 'T00', message: 'Reducer failed' });
      const ctx = createHandlerContext({
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'player_move', args: ['bad_args'] }),
          sig: '0'.repeat(128),
        }),
        reject: rejectFn,
      });

      // When the handler processes the event and SpacetimeDB returns error
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      await handler(ctx);

      // Then it should return ctx.reject('T00', 'Reducer player_move failed: ...')
      expect(rejectFn).toHaveBeenCalledWith(
        'T00',
        expect.stringContaining('Reducer player_move failed')
      );
    });

    it('returns ctx.reject("T00", "Reducer {name} timed out") on timeout', async () => {
      // Given a valid event but SpacetimeDB call times out
      const { ReducerCallError } = await import('../spacetimedb-caller.js');
      const { callReducer } = await import('../spacetimedb-caller.js');
      vi.mocked(callReducer).mockRejectedValueOnce(
        new ReducerCallError('Reducer slow_reducer timed out after 30000ms', 'REDUCER_FAILED', 0)
      );

      const rejectFn = vi
        .fn()
        .mockReturnValue({ accepted: false, code: 'T00', message: 'timed out' });
      const ctx = createHandlerContext({
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'slow_reducer', args: [] }),
          sig: '0'.repeat(128),
        }),
        reject: rejectFn,
      });

      // When the handler processes the event and SpacetimeDB times out
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      await handler(ctx);

      // Then it should return ctx.reject('T00', 'Reducer slow_reducer timed out')
      expect(rejectFn).toHaveBeenCalledWith(
        'T00',
        expect.stringContaining('Reducer slow_reducer timed out')
      );
    });

    it('returns ctx.reject("T00", "Internal error: ...") on unexpected error', async () => {
      // Given a valid event but an unexpected error occurs
      const { callReducer } = await import('../spacetimedb-caller.js');
      vi.mocked(callReducer).mockRejectedValueOnce(new Error('Unexpected failure'));

      const rejectFn = vi
        .fn()
        .mockReturnValue({ accepted: false, code: 'T00', message: 'Internal error' });
      const ctx = createHandlerContext({
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'player_move', args: [] }),
          sig: '0'.repeat(128),
        }),
        reject: rejectFn,
      });

      // When an unexpected error occurs during processing
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      await handler(ctx);

      // Then it should return ctx.reject('T00', 'Internal error: ...')
      expect(rejectFn).toHaveBeenCalledWith('T00', expect.stringContaining('Internal error'));
    });
  });
});
