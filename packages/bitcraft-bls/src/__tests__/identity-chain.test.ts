/**
 * Identity Chain Verification Tests (AC: 1, 2)
 * Story 3.4: Identity Propagation & End-to-End Verification
 *
 * Tests for the identity chain verification module:
 * - verifyIdentityChain() validates pubkey format and chain integrity
 * - Handler integration with identity verification logging
 * - Zero silent failures audit
 *
 * Validates: AC1 (client signing through BLS verification),
 *            AC2 (cryptographic chain integrity)
 *
 * Test count: 10
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';

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

describe('Identity Chain Verification (Story 3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('verifyIdentityChain()', () => {
    it('with valid ctx.pubkey and matching first arg returns chainIntact: true', async () => {
      // Given a valid 64-char lowercase hex pubkey
      const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
      const argsWithIdentity = [pubkey, 100, 200];

      // When verifyIdentityChain is called
      const { verifyIdentityChain } = await import('../identity-chain.js');
      const result = verifyIdentityChain({ pubkey }, 'player_move', argsWithIdentity);

      // Then the chain should be intact
      expect(result.chainIntact).toBe(true);
      expect(result.pubkey).toBe(pubkey);
      expect(result.reducerCalled).toBe('player_move');
      expect(result.identityPropagated).toBe(true);
    });

    it('with mismatched pubkey and first arg throws IdentityChainError (IDENTITY_MISMATCH)', async () => {
      // Given ctx.pubkey and argsWithIdentity[0] that don't match
      const ctxPubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
      const differentPubkey = 'ab'.repeat(32);
      const argsWithIdentity = [differentPubkey, 100, 200];

      // When verifyIdentityChain is called
      const { verifyIdentityChain, IdentityChainError } = await import('../identity-chain.js');

      // Then it should throw IdentityChainError with IDENTITY_MISMATCH code
      let thrownError: unknown;
      try {
        verifyIdentityChain({ pubkey: ctxPubkey }, 'player_move', argsWithIdentity);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(IdentityChainError);
      expect((thrownError as InstanceType<typeof IdentityChainError>).code).toBe(
        'IDENTITY_MISMATCH'
      );
    });

    it('with invalid pubkey format (too short) throws IdentityChainError (IDENTITY_INVALID)', async () => {
      // Given a pubkey that is too short (32 chars instead of 64)
      const shortPubkey = 'ab'.repeat(16); // 32 chars
      const argsWithIdentity = [shortPubkey, 100];

      // When verifyIdentityChain is called
      const { verifyIdentityChain, IdentityChainError } = await import('../identity-chain.js');

      // Then it should throw IdentityChainError with IDENTITY_INVALID code
      let thrownError: unknown;
      try {
        verifyIdentityChain({ pubkey: shortPubkey }, 'player_move', argsWithIdentity);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(IdentityChainError);
      expect((thrownError as InstanceType<typeof IdentityChainError>).code).toBe(
        'IDENTITY_INVALID'
      );
    });

    it('with invalid pubkey format (non-hex chars) throws IdentityChainError (IDENTITY_INVALID)', async () => {
      // Given a pubkey containing non-hex characters
      const nonHexPubkey = 'zz'.repeat(32); // 64 chars but not hex
      const argsWithIdentity = [nonHexPubkey, 100];

      // When verifyIdentityChain is called
      const { verifyIdentityChain, IdentityChainError } = await import('../identity-chain.js');

      // Then it should throw IdentityChainError with IDENTITY_INVALID code
      let thrownError: unknown;
      try {
        verifyIdentityChain({ pubkey: nonHexPubkey }, 'player_move', argsWithIdentity);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(IdentityChainError);
      expect((thrownError as InstanceType<typeof IdentityChainError>).code).toBe(
        'IDENTITY_INVALID'
      );
    });

    it('with uppercase hex pubkey throws IdentityChainError (IDENTITY_INVALID)', async () => {
      // Given a pubkey with uppercase hex characters (pubkeys must be lowercase)
      const uppercasePubkey = '32E1827635450EBB3C5A7D12C1F8E7B2B514439AC10A67EEF3D9FD9C5C68E245';
      const argsWithIdentity = [uppercasePubkey, 100];

      // When verifyIdentityChain is called
      const { verifyIdentityChain, IdentityChainError } = await import('../identity-chain.js');

      // Then it should throw IdentityChainError with IDENTITY_INVALID code
      let thrownError: unknown;
      try {
        verifyIdentityChain({ pubkey: uppercasePubkey }, 'player_move', argsWithIdentity);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(IdentityChainError);
      expect((thrownError as InstanceType<typeof IdentityChainError>).code).toBe(
        'IDENTITY_INVALID'
      );
    });

    it('with empty pubkey throws IdentityChainError (IDENTITY_INVALID)', async () => {
      // Given an empty pubkey string
      const emptyPubkey = '';
      const argsWithIdentity = ['', 100];

      // When verifyIdentityChain is called
      const { verifyIdentityChain, IdentityChainError } = await import('../identity-chain.js');

      // Then it should throw IdentityChainError with IDENTITY_INVALID code
      let thrownError: unknown;
      try {
        verifyIdentityChain({ pubkey: emptyPubkey }, 'player_move', argsWithIdentity);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(IdentityChainError);
      expect((thrownError as InstanceType<typeof IdentityChainError>).code).toBe(
        'IDENTITY_INVALID'
      );
    });
  });

  describe('Handler identity integration', () => {
    it('handler receives ctx.pubkey and prepends it as first arg -- identity propagation verified', async () => {
      // Given a valid pubkey on the handler context
      const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
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
      const { createGameActionHandler } = await import('../handler.js');
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);
      const result = await handler(ctx);

      // Then the result should be accepted
      expect(result.accepted).toBe(true);

      // And callReducer should have received [pubkey, 100, 200]
      const { callReducer } = await import('../spacetimedb-caller.js');
      const callArgs = vi.mocked(callReducer).mock.calls[0][2];
      expect(callArgs[0]).toBe(pubkey);
      expect(callArgs).toEqual([pubkey, 100, 200]);
    });

    it('handler with valid ctx.pubkey logs identity propagation with eventId and truncated pubkey', async () => {
      // Given a valid pubkey
      const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
      const eventId = 'a1b2c3d4'.repeat(8);
      const ctx = createHandlerContext({
        pubkey,
        decode: () => ({
          id: eventId,
          pubkey,
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

      // Then identity propagation should be logged
      const logCalls = vi.mocked(console.log).mock.calls;
      const identityLog = logCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Identity propagated')
      );
      expect(identityLog).toBeDefined();
      // Log should include truncated pubkey (first 8 + last 4 chars)
      expect(identityLog![0]).toContain('32e18276');
      expect(identityLog![0]).toContain('e245');
    });

    it('handler with invalid ctx.pubkey format rejects with F06', async () => {
      // Given a pubkey with uppercase hex (invalid format)
      const invalidPubkey = '32E1827635450EBB3C5A7D12C1F8E7B2B514439AC10A67EEF3D9FD9C5C68E245';
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
      const result = await handler(ctx);

      // Then it should reject with F06
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(result.code).toBe('F06');
        expect(result.message).toContain('Invalid identity');
      }
    });

    it('every handler code path results in either ctx.accept() or ctx.reject() (zero silent failures)', async () => {
      // Given various handler scenarios that exercise all code paths
      const { createGameActionHandler } = await import('../handler.js');
      const config = createBLSConfig();
      const handler = createGameActionHandler(config);

      // Test 1: Valid action -> ctx.accept()
      const validCtx = createHandlerContext({
        pubkey: 'ab'.repeat(32),
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
      const validResult = await handler(validCtx);
      expect(validResult).toBeDefined();
      expect('accepted' in validResult).toBe(true);

      // Test 2: Invalid content -> ctx.reject()
      const invalidContentCtx = createHandlerContext({
        pubkey: 'ab'.repeat(32),
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: 'not json',
          sig: '0'.repeat(128),
        }),
      });
      const invalidResult = await handler(invalidContentCtx);
      expect(invalidResult).toBeDefined();
      expect('accepted' in invalidResult).toBe(true);
      expect(invalidResult.accepted).toBe(false);

      // All results are explicit AcceptResponse or RejectResponse -- no undefined, no null, no void
    });
  });
});
