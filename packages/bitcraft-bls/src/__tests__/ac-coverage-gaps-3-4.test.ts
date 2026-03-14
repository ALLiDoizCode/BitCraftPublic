/**
 * Acceptance Criteria Coverage Gap Tests
 * Story 3.4: Identity Propagation & End-to-End Verification
 *
 * Tests identified by TEA testarch-automate workflow that fill gaps
 * in the existing test suite. Each test is tagged with the AC it validates
 * and the specific gap it addresses.
 *
 * Gaps filled:
 * - AC4: decode() exception produces explicit T00 rejection (not silent)
 * - AC4: handler does NOT log "Identity propagated" when pubkey is invalid
 * - AC4: handler validation order: content parse -> pricing -> pubkey validation -> propagation
 *
 * Note: Tests for verifyIdentityChain() and logVerificationEvent() were removed
 * as part of PREP-E4-2 (dead code cleanup per AGREEMENT-11). The handler performs
 * identical pubkey validation inline.
 *
 * Test count: 5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';

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

describe('Story 3.4 AC Coverage Gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC4 Gap: decode() exception produces explicit rejection
  // If ctx.decode() throws, the handler should return ctx.reject('T00', ...)
  // rather than allowing the exception to propagate silently.
  // ---------------------------------------------------------------------------

  describe('[AC4] decode() exception handling (zero silent failures)', () => {
    it('decode() throwing an exception produces explicit T00 rejection', async () => {
      // Given a handler context where decode() throws
      const ctx = createHandlerContext({
        pubkey: 'ab'.repeat(32),
        decode: () => {
          throw new Error('TOON decode failure: invalid base64');
        },
      });

      // When the handler processes the event
      const { createGameActionHandler } = await import('../handler.js');
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then it should return an explicit rejection (not throw, not undefined)
      expect(result).toBeDefined();
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(result.code).toBe('T00');
        expect(result.message).toContain('TOON decode failure');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // AC4 Gap: "Identity propagated" log does NOT appear for invalid pubkeys
  // This confirms the validation happens BEFORE propagation logging --
  // important for audit trail integrity and zero-silent-failures.
  // ---------------------------------------------------------------------------

  describe('[AC4] Validation ordering guarantees', () => {
    it('handler does NOT log "Identity propagated" when pubkey format is invalid', async () => {
      // Given a handler context with an invalid pubkey (too short)
      const invalidPubkey = 'ab'.repeat(16); // 32 chars
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
      await handler(ctx);

      // Then "Identity propagated" should NOT appear in any log
      const allLogCalls = vi.mocked(console.log).mock.calls;
      const identityLog = allLogCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Identity propagated')
      );
      expect(identityLog).toBeUndefined();

      // And an error log for F06 should be present
      const errorCalls = vi.mocked(console.error).mock.calls;
      const errorLog = errorCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('F06')
      );
      expect(errorLog).toBeDefined();
    });

    it('handler does NOT log "Identity propagated" when pubkey has non-hex chars', async () => {
      // Given a handler context with a pubkey containing non-hex chars
      const nonHexPubkey = 'zz'.repeat(32); // 64 chars, not hex
      const ctx = createHandlerContext({
        pubkey: nonHexPubkey,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: nonHexPubkey,
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

      // Then "Identity propagated" should NOT appear in any log
      const allLogCalls = vi.mocked(console.log).mock.calls;
      const identityLog = allLogCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Identity propagated')
      );
      expect(identityLog).toBeUndefined();
    });

    it('handler validates content BEFORE pubkey format (content parse error -> F06, not F06 for identity)', async () => {
      // Given a handler context with BOTH invalid content AND invalid pubkey
      const invalidPubkey = 'ab'.repeat(16); // 32 chars, too short
      const ctx = createHandlerContext({
        pubkey: invalidPubkey,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: invalidPubkey,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: 'not json at all', // Invalid content
          sig: '0'.repeat(128),
        }),
      });

      // When the handler processes the event
      const { createGameActionHandler } = await import('../handler.js');
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then the CONTENT parse error should be returned (not identity error),
      // proving content validation happens before pubkey validation
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(result.code).toBe('F06');
        // The message should reference content parsing, NOT identity
        expect(result.message).not.toContain('Invalid identity');
      }
    });
  });
});
