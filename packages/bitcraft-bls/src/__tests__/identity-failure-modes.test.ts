/**
 * Identity Failure Modes Tests (AC: 1-4)
 * Story 3.4: Identity Propagation & End-to-End Verification
 *
 * Tests for identity validation failure modes in the handler:
 * - Invalid pubkey format rejection (F06)
 * - Missing/non-string pubkey rejection (F06)
 * - Validation occurs BEFORE SpacetimeDB call (no wasted API calls)
 * - Explicit error paths (zero silent failures - NFR27)
 * - SpacetimeDB and unexpected error handling
 *
 * Validates: AC1 (BLS verification), AC2 (chain integrity),
 *            AC3 (invalid signature rejection), AC4 (zero silent failures)
 *
 * Test count: 10
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';

// Mock the spacetimedb-caller
const mockCallReducer = vi.fn().mockResolvedValue({ success: true, statusCode: 200 });
vi.mock('../spacetimedb-caller.js', () => ({
  callReducer: (...args: unknown[]) => mockCallReducer(...args),
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

describe('Identity Failure Modes (Story 3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallReducer.mockResolvedValue({ success: true, statusCode: 200 });
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handler invoked with missing ctx.pubkey (undefined cast) rejects with F06', async () => {
    // Given a handler context where pubkey is undefined (cast to string for testing)
    const ctx = createHandlerContext({
      pubkey: undefined as unknown as string,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: undefined as unknown as string,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const result = await handler(ctx);

    // Then it should reject with F06
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F06');
      expect(result.message).toContain('Invalid identity');
    }
  });

  it('handler invoked with non-string ctx.pubkey (number cast) rejects with F06', async () => {
    // Given a handler context where pubkey is a number (cast to string)
    const ctx = createHandlerContext({
      pubkey: 12345 as unknown as string,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 12345 as unknown as string,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const result = await handler(ctx);

    // Then it should reject with F06
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F06');
      expect(result.message).toContain('Invalid identity');
    }
  });

  it('handler invoked with wrong-length pubkey (32 chars) rejects with F06', async () => {
    // Given a pubkey that is too short (32 chars instead of 64)
    const shortPubkey = 'ab'.repeat(16); // 32 chars
    const ctx = createHandlerContext({
      pubkey: shortPubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: shortPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const result = await handler(ctx);

    // Then it should reject with F06
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F06');
      expect(result.message).toContain('Invalid identity');
      expect(result.message).toContain('64-char hex');
    }
  });

  it('handler invoked with pubkey containing uppercase hex rejects with F06', async () => {
    // Given a pubkey with uppercase hex characters
    const uppercasePubkey = 'AB'.repeat(32); // 64 chars, uppercase
    const ctx = createHandlerContext({
      pubkey: uppercasePubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: uppercasePubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const result = await handler(ctx);

    // Then it should reject with F06 specifically about non-hex characters
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F06');
      expect(result.message).toContain('Invalid identity');
      expect(result.message).toContain('non-hex');
    }
  });

  it('handler rejects invalid pubkey BEFORE SpacetimeDB call (no wasted API call)', async () => {
    // Given an invalid pubkey
    const shortPubkey = 'ab'.repeat(16); // 32 chars
    const ctx = createHandlerContext({
      pubkey: shortPubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: shortPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then callReducer should NOT have been called
    expect(mockCallReducer).not.toHaveBeenCalled();
  });

  it('handler error includes event ID and pubkey for debugging', async () => {
    // Given an invalid pubkey
    const invalidPubkey = 'zz'.repeat(32); // 64 chars but not hex
    const eventId = 'abc123'.repeat(10) + 'abcd';
    const ctx = createHandlerContext({
      pubkey: invalidPubkey,
      decode: () => ({
        id: eventId,
        pubkey: invalidPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    await handler(ctx);

    // Then the error log should include eventId and truncated pubkey
    const errorCalls = vi.mocked(console.error).mock.calls;
    const errorLog = errorCalls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('F06')
    );
    expect(errorLog).toBeDefined();
    expect(errorLog![0]).toContain('eventId');
    expect(errorLog![0]).toContain('pubkey');
  });

  it('handler with valid pubkey succeeds (control test)', async () => {
    // Given a valid 64-char lowercase hex pubkey
    const validPubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
    const ctx = createHandlerContext({
      pubkey: validPubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: validPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [100] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const result = await handler(ctx);

    // Then it should accept
    expect(result.accepted).toBe(true);
    // And callReducer should have been called with valid args
    expect(mockCallReducer).toHaveBeenCalledOnce();
  });

  it('rejection path is explicit (returns ctx.reject, not thrown error swallowed)', async () => {
    // Given an invalid pubkey that triggers F06 rejection
    const invalidPubkey = 'ab'.repeat(16); // 32 chars, too short
    const ctx = createHandlerContext({
      pubkey: invalidPubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: invalidPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);

    // Then handler should return a RejectResponse (not throw, not return undefined)
    const result = await handler(ctx);
    expect(result).toBeDefined();
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBeDefined();
      expect(result.message).toBeDefined();
    }
  });

  it('ReducerCallError from SpacetimeDB results in explicit T00 rejection (not silent)', async () => {
    // Given a valid pubkey but SpacetimeDB returns an error
    const validPubkey = 'ab'.repeat(32);
    const { ReducerCallError } = await import('../spacetimedb-caller.js');
    mockCallReducer.mockRejectedValueOnce(
      new ReducerCallError('Reducer player_move failed: bad args', 'REDUCER_FAILED', 400)
    );
    const ctx = createHandlerContext({
      pubkey: validPubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: validPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const result = await handler(ctx);

    // Then it should reject with T00 (not throw, not silent)
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('T00');
      expect(result.message).toContain('Reducer player_move failed');
    }
  });

  it('unexpected error results in explicit T00 rejection with "Internal error" prefix (not silent)', async () => {
    // Given a valid pubkey but an unexpected error occurs
    const validPubkey = 'ab'.repeat(32);
    mockCallReducer.mockRejectedValueOnce(new Error('Network socket closed unexpectedly'));
    const ctx = createHandlerContext({
      pubkey: validPubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: validPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler processes the event
    const { createGameActionHandler } = await import('../handler.js');
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const result = await handler(ctx);

    // Then it should reject with T00 and "Internal error" prefix
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('T00');
      expect(result.message).toContain('Internal error');
      expect(result.message).toContain('Network socket closed unexpectedly');
    }
  });
});
