/**
 * Acceptance Criteria Coverage Gap Tests
 * Story 3.4: Identity Propagation & End-to-End Verification
 *
 * Tests identified by TEA testarch-automate workflow that fill gaps
 * in the existing test suite. Each test is tagged with the AC it validates
 * and the specific gap it addresses.
 *
 * Gaps filled:
 * - AC1/AC3: logVerificationEvent() logs verified signatures at info level
 * - AC1/AC3: logVerificationEvent() logs rejected signatures at error level with SDK context
 * - AC1/AC3: logVerificationEvent() truncates pubkey in logs (OWASP A02)
 * - AC1/AC3: logVerificationEvent() includes eventId in both verified and rejected logs
 * - AC2: IdentityChainError class sets name property correctly
 * - AC2: IdentityChainError class is instanceof Error
 * - AC2: IdentityChainError preserves code and message
 * - AC2: index.ts re-exports identity-chain and verification modules
 * - AC4: decode() exception produces explicit T00 rejection (not silent)
 * - AC4: handler does NOT log "Identity propagated" when pubkey is invalid
 * - AC4: handler validation order: content parse -> pricing -> pubkey validation -> propagation
 * - AC2: verifyIdentityChain with non-string first arg throws IDENTITY_MISMATCH
 *
 * Test count: 14
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
  // AC1/AC3 Gap: logVerificationEvent() has zero test coverage
  // The verification.ts module provides observability into SDK signature
  // verification but was never tested.
  // ---------------------------------------------------------------------------

  describe('[AC1/AC3] logVerificationEvent() coverage', () => {
    it('logs verified signature at info level (console.log)', async () => {
      // Given a verified signature event
      const eventId = 'a1b2c3d4'.repeat(8);
      const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';

      // When logVerificationEvent is called with verified=true
      const { logVerificationEvent } = await import('../verification.js');
      logVerificationEvent(eventId, pubkey, true);

      // Then it should log at info level (console.log)
      expect(console.log).toHaveBeenCalledOnce();
      expect(console.error).not.toHaveBeenCalled();

      // And the log should contain "Signature verified"
      const logCall = vi.mocked(console.log).mock.calls[0][0] as string;
      expect(logCall).toContain('Signature verified');
      expect(logCall).toContain('[BLS]');
    });

    it('logs rejected signature at error level (console.error) with SDK context', async () => {
      // Given a rejected signature event
      const eventId = 'deadbeef'.repeat(8);
      const pubkey = 'ab'.repeat(32);

      // When logVerificationEvent is called with verified=false
      const { logVerificationEvent } = await import('../verification.js');
      logVerificationEvent(eventId, pubkey, false);

      // Then it should log at error level (console.error)
      expect(console.error).toHaveBeenCalledOnce();
      expect(console.log).not.toHaveBeenCalled();

      // And the log should contain rejection context
      const errorCall = vi.mocked(console.error).mock.calls[0][0] as string;
      expect(errorCall).toContain('Signature rejected');
      expect(errorCall).toContain('[BLS]');
      expect(errorCall).toContain('SDK rejected before handler invocation');
    });

    it('truncates pubkey in logs to first 8 + last 4 chars (OWASP A02)', async () => {
      // Given a full 64-char pubkey
      const eventId = '0'.repeat(64);
      const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';

      // When logVerificationEvent is called
      const { logVerificationEvent } = await import('../verification.js');
      logVerificationEvent(eventId, pubkey, true);

      // Then the log should contain truncated pubkey (first 8 + last 4)
      const logCall = vi.mocked(console.log).mock.calls[0][0] as string;
      expect(logCall).toContain('32e18276');
      expect(logCall).toContain('e245');
      // And should NOT contain the full pubkey
      expect(logCall).not.toContain(pubkey);
    });

    it('includes eventId in both verified and rejected logs', async () => {
      // Given specific event IDs
      const verifiedEventId = 'aaaa'.repeat(16);
      const rejectedEventId = 'bbbb'.repeat(16);
      const pubkey = 'cc'.repeat(32);

      // When logging both verified and rejected events
      const { logVerificationEvent } = await import('../verification.js');
      logVerificationEvent(verifiedEventId, pubkey, true);
      logVerificationEvent(rejectedEventId, pubkey, false);

      // Then each log should include its respective eventId
      const verifiedLog = vi.mocked(console.log).mock.calls[0][0] as string;
      expect(verifiedLog).toContain(verifiedEventId);

      const rejectedLog = vi.mocked(console.error).mock.calls[0][0] as string;
      expect(rejectedLog).toContain(rejectedEventId);
    });
  });

  // ---------------------------------------------------------------------------
  // AC2 Gap: IdentityChainError class properties
  // The error class follows ContentParseError and FeeScheduleError pattern
  // but class-level behavior was never verified independently.
  // ---------------------------------------------------------------------------

  describe('[AC2] IdentityChainError class properties', () => {
    it('sets name property to "IdentityChainError"', async () => {
      // Given an IdentityChainError instance
      const { IdentityChainError } = await import('../identity-chain.js');

      // When constructed
      const error = new IdentityChainError('test message', 'IDENTITY_INVALID');

      // Then name should be "IdentityChainError"
      expect(error.name).toBe('IdentityChainError');
    });

    it('is instanceof Error', async () => {
      // Given an IdentityChainError instance
      const { IdentityChainError } = await import('../identity-chain.js');

      // When constructed
      const error = new IdentityChainError('test message', 'IDENTITY_MISMATCH');

      // Then it should be instanceof Error
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(IdentityChainError);
    });

    it('preserves code and message properties', async () => {
      // Given specific code and message values
      const { IdentityChainError } = await import('../identity-chain.js');

      // When constructing with IDENTITY_INVALID code
      const invalidError = new IdentityChainError('pubkey must be 64-char hex', 'IDENTITY_INVALID');
      expect(invalidError.code).toBe('IDENTITY_INVALID');
      expect(invalidError.message).toBe('pubkey must be 64-char hex');

      // And when constructing with IDENTITY_MISMATCH code
      const mismatchError = new IdentityChainError(
        'pubkey does not match first arg',
        'IDENTITY_MISMATCH'
      );
      expect(mismatchError.code).toBe('IDENTITY_MISMATCH');
      expect(mismatchError.message).toBe('pubkey does not match first arg');
    });
  });

  // ---------------------------------------------------------------------------
  // AC2 Gap: index.ts re-exports identity-chain and verification modules
  // Story 3.4 added exports to index.ts but no test verifies they are accessible.
  // ---------------------------------------------------------------------------

  describe('[AC2] index.ts module exports', () => {
    it('exports verifyIdentityChain, IdentityChainError, and IdentityChainResult from index', async () => {
      // When importing from the package index
      const indexModule = await import('../index.js');

      // Then identity-chain exports should be available
      expect(indexModule.verifyIdentityChain).toBeDefined();
      expect(typeof indexModule.verifyIdentityChain).toBe('function');
      expect(indexModule.IdentityChainError).toBeDefined();
      expect(typeof indexModule.IdentityChainError).toBe('function');
    });

    it('exports logVerificationEvent and VerificationConfig from index', async () => {
      // When importing from the package index
      const indexModule = await import('../index.js');

      // Then verification exports should be available
      expect(indexModule.logVerificationEvent).toBeDefined();
      expect(typeof indexModule.logVerificationEvent).toBe('function');
    });
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

  // ---------------------------------------------------------------------------
  // AC2 Gap: verifyIdentityChain with non-string first arg
  // If argsWithIdentity[0] is a non-string value (e.g. number, undefined),
  // it should throw IDENTITY_MISMATCH since it cannot match a string pubkey.
  // ---------------------------------------------------------------------------

  describe('[AC2] verifyIdentityChain non-string first arg edge case', () => {
    it('verifyIdentityChain with numeric first arg throws IDENTITY_MISMATCH', async () => {
      // Given a valid pubkey but argsWithIdentity[0] is a number
      const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
      const argsWithIdentity = [42, 100, 200]; // number, not string

      // When verifyIdentityChain is called
      const { verifyIdentityChain, IdentityChainError } = await import('../identity-chain.js');

      // Then it should throw IdentityChainError with IDENTITY_MISMATCH code
      let thrownError: unknown;
      try {
        verifyIdentityChain({ pubkey }, 'player_move', argsWithIdentity);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(IdentityChainError);
      expect((thrownError as InstanceType<typeof IdentityChainError>).code).toBe(
        'IDENTITY_MISMATCH'
      );
    });
  });
});
