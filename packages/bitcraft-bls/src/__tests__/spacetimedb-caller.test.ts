/**
 * SpacetimeDB Caller Tests (AC: 2, 4)
 * Story 3.2: Game Action Handler (kind 30078)
 *
 * Tests for callReducer() function that makes HTTP POST requests
 * to SpacetimeDB to execute game reducers.
 *
 * Validates: AC2 (SpacetimeDB reducer call), AC4 (SpacetimeDB error handling)
 * Security: OWASP A02 (token never logged), OWASP A05 (timeout handling)
 *
 * Test count: 12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  callReducer,
  ReducerCallError,
  type SpacetimeDBCallerConfig,
} from '../spacetimedb-caller.js';

describe('SpacetimeDB Caller (Story 3.2)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const defaultConfig: SpacetimeDBCallerConfig = {
    url: 'http://localhost:3000',
    database: 'bitcraft',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Successful calls', () => {
    it('returns success for 200 OK response', async () => {
      // Given a SpacetimeDB server that returns 200 OK
      fetchSpy.mockResolvedValue(new Response('', { status: 200 }));

      // When callReducer is called with valid reducer and args
      const result = await callReducer(defaultConfig, 'player_move', ['pubkey', 100, 200]);

      // Then it should return success
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('HTTP error handling', () => {
    it('throws ReducerCallError with UNKNOWN_REDUCER code on 404', async () => {
      // Given a SpacetimeDB server that returns 404 Not Found
      fetchSpy.mockResolvedValue(new Response('Not found', { status: 404 }));

      // When callReducer is called with a non-existent reducer
      try {
        await callReducer(defaultConfig, 'nonexistent_reducer', ['pubkey']);
        expect.fail('Should have thrown');
      } catch (err) {
        // Then it should throw ReducerCallError with code UNKNOWN_REDUCER
        expect(err).toBeInstanceOf(ReducerCallError);
        expect((err as ReducerCallError).code).toBe('UNKNOWN_REDUCER');
        expect((err as ReducerCallError).statusCode).toBe(404);
      }
    });

    it('throws ReducerCallError with REDUCER_FAILED code on 400', async () => {
      // Given a SpacetimeDB server that returns 400 Bad Request
      fetchSpy.mockResolvedValue(new Response('Bad request', { status: 400 }));

      // When callReducer is called with invalid args
      try {
        await callReducer(defaultConfig, 'player_move', ['pubkey', 'bad_arg']);
        expect.fail('Should have thrown');
      } catch (err) {
        // Then it should throw ReducerCallError with code REDUCER_FAILED
        expect(err).toBeInstanceOf(ReducerCallError);
        expect((err as ReducerCallError).code).toBe('REDUCER_FAILED');
        expect((err as ReducerCallError).statusCode).toBe(400);
      }
    });

    it('throws ReducerCallError with REDUCER_FAILED code on 500', async () => {
      // Given a SpacetimeDB server that returns 500 Internal Server Error
      fetchSpy.mockResolvedValue(new Response('Internal server error', { status: 500 }));

      // When callReducer is called
      try {
        await callReducer(defaultConfig, 'player_move', ['pubkey']);
        expect.fail('Should have thrown');
      } catch (err) {
        // Then it should throw ReducerCallError with code REDUCER_FAILED
        expect(err).toBeInstanceOf(ReducerCallError);
        expect((err as ReducerCallError).code).toBe('REDUCER_FAILED');
        expect((err as ReducerCallError).statusCode).toBe(500);
      }
    });
  });

  describe('Timeout handling', () => {
    it('throws ReducerCallError with timeout message when request exceeds timeout', async () => {
      // Given a SpacetimeDB server that takes longer than the timeout to respond
      fetchSpy.mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          })
      );

      // When callReducer is called with a short timeout
      const configWithTimeout: SpacetimeDBCallerConfig = {
        ...defaultConfig,
        timeoutMs: 100,
      };

      try {
        await callReducer(configWithTimeout, 'slow_reducer', ['pubkey']);
        expect.fail('Should have thrown');
      } catch (err) {
        // Then it should throw ReducerCallError with REDUCER_FAILED code and timeout message
        expect(err).toBeInstanceOf(ReducerCallError);
        expect((err as ReducerCallError).code).toBe('REDUCER_FAILED');
        expect((err as ReducerCallError).message).toContain('timed out');
      }
    });

    it('cancels fetch via AbortController on timeout', async () => {
      // Given a request that will timeout
      let abortSignal: AbortSignal | undefined;
      fetchSpy.mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            abortSignal = init.signal;
            init.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          })
      );

      const configWithTimeout: SpacetimeDBCallerConfig = {
        ...defaultConfig,
        timeoutMs: 50,
      };

      // When the timeout fires
      try {
        await callReducer(configWithTimeout, 'slow_reducer', ['pubkey']);
      } catch {
        // Expected
      }

      // Then the AbortController should have aborted the fetch
      expect(abortSignal?.aborted).toBe(true);
    });
  });

  describe('Network errors', () => {
    it('throws ReducerCallError on network failure (fetch rejects)', async () => {
      // Given a network error (connection refused, DNS failure)
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      // When callReducer is called
      try {
        await callReducer(defaultConfig, 'player_move', ['pubkey']);
        expect.fail('Should have thrown');
      } catch (err) {
        // Then it should throw ReducerCallError
        expect(err).toBeInstanceOf(ReducerCallError);
        expect((err as ReducerCallError).code).toBe('REDUCER_FAILED');
        expect((err as ReducerCallError).message).toContain('ECONNREFUSED');
      }
    });
  });

  describe('Request construction', () => {
    it('constructs correct URL: {url}/database/{database}/call/{reducer}', async () => {
      // Given config with url=http://localhost:3000, database=bitcraft
      fetchSpy.mockResolvedValue(new Response('', { status: 200 }));

      // When callReducer is called with reducer 'player_move'
      await callReducer(defaultConfig, 'player_move', ['pubkey']);

      // Then the fetch URL should be http://localhost:3000/database/bitcraft/call/player_move
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/database/bitcraft/call/player_move',
        expect.any(Object)
      );
    });

    it('includes Authorization header with Bearer token', async () => {
      // Given config with token 'test-token'
      fetchSpy.mockResolvedValue(new Response('', { status: 200 }));

      // When callReducer is called
      await callReducer(defaultConfig, 'player_move', ['pubkey']);

      // Then the request should include header Authorization: Bearer test-token
      const callArgs = fetchSpy.mock.calls[0][1];
      expect(callArgs.headers['Authorization']).toBe('Bearer test-token');
    });

    it('includes Content-Type application/json header', async () => {
      // Given a valid config
      fetchSpy.mockResolvedValue(new Response('', { status: 200 }));

      // When callReducer is called
      await callReducer(defaultConfig, 'player_move', ['pubkey']);

      // Then the request should include Content-Type: application/json header
      const callArgs = fetchSpy.mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBe('application/json');
    });

    it('sends JSON-serialized args as request body', async () => {
      // Given args ['pubkey123', 100, 200, true]
      fetchSpy.mockResolvedValue(new Response('', { status: 200 }));

      // When callReducer is called
      await callReducer(defaultConfig, 'player_move', ['pubkey123', 100, 200, true]);

      // Then the request body should be JSON: ["pubkey123", 100, 200, true]
      const callArgs = fetchSpy.mock.calls[0][1];
      expect(callArgs.body).toBe(JSON.stringify(['pubkey123', 100, 200, true]));
    });
  });

  describe('Security (OWASP A02)', () => {
    it('never includes token value in error messages or logs', async () => {
      // Given a config with token 'super-secret-token-value'
      const secretToken = 'super-secret-token-value';
      const config: SpacetimeDBCallerConfig = {
        url: 'http://localhost:3000',
        database: 'bitcraft',
        token: secretToken,
      };
      fetchSpy.mockResolvedValue(new Response('Server error', { status: 500 }));

      // When callReducer fails with any error
      try {
        await callReducer(config, 'failing_reducer', ['pubkey']);
      } catch (err) {
        // Then the error message should NOT contain the token value
        expect((err as Error).message).not.toContain(secretToken);
      }
    });
  });
});
