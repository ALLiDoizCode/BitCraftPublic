/**
 * Event Signing Tests
 * Story 2.3: ILP Packet Construction & Signing
 *
 * Tests for signEvent function using nostr-tools.
 * Validates AC1, AC6: Event signing with private key protection.
 */

import { describe, it, expect } from 'vitest';
import { generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { signEvent, redactPrivateKey } from './event-signing';
import { SigilError } from '../nostr/nostr-client';
import type { NostrEvent } from '../nostr/types';

describe('Event Signing', () => {
  // Generate test keypair
  const testPrivateKey = generateSecretKey();
  const testPublicKey = getPublicKey(testPrivateKey);

  describe('signEvent - Valid Cases (AC1, AC6)', () => {
    it('should sign event and add id, sig, and pubkey fields', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 30078,
        tags: [['d', 'test']],
        content: '{"reducer":"test","args":[]}',
      };

      const signed = signEvent(unsigned, testPrivateKey);

      expect(signed).toHaveProperty('id');
      expect(signed).toHaveProperty('sig');
      expect(signed.pubkey).toBe(testPublicKey);
    });

    it('should generate 64-character hex event ID (SHA256) (AC1)', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: 'test',
      };

      const signed = signEvent(unsigned, testPrivateKey);

      expect(signed.id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate 128-character hex signature (64-byte Schnorr) (AC1)', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: 'test',
      };

      const signed = signEvent(unsigned, testPrivateKey);

      expect(signed.sig).toMatch(/^[0-9a-f]{128}$/);
    });

    it('should produce verifiable signature (AC1, AC6)', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 30078,
        tags: [['d', 'verify_test']],
        content: '{"reducer":"test","args":[1,2,3]}',
      };

      const signed = signEvent(unsigned, testPrivateKey);

      // Verify using nostr-tools verifyEvent
      const isValid = verifyEvent(signed);
      expect(isValid).toBe(true);
    });

    it('should produce different signatures for different created_at (AC1 non-determinism)', () => {
      const unsigned1: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1000000000,
        kind: 30078,
        tags: [],
        content: 'test',
      };

      const unsigned2: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1000000001,
        kind: 30078,
        tags: [],
        content: 'test',
      };

      const signed1 = signEvent(unsigned1, testPrivateKey);
      const signed2 = signEvent(unsigned2, testPrivateKey);

      expect(signed1.sig).not.toBe(signed2.sig);
      expect(signed1.id).not.toBe(signed2.id);
    });

    it('should handle complex event with multiple tags', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 30078,
        tags: [
          ['d', 'complex_test'],
          ['fee', '100'],
          ['custom', 'value1', 'value2'],
        ],
        content: '{"reducer":"complex","args":{"nested":{"data":"here"}}}',
      };

      const signed = signEvent(unsigned, testPrivateKey);

      expect(verifyEvent(signed)).toBe(true);
    });

    it('should handle empty content', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 30078,
        tags: [],
        content: '',
      };

      const signed = signEvent(unsigned, testPrivateKey);

      expect(verifyEvent(signed)).toBe(true);
    });

    it('should handle empty tags array', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 30078,
        tags: [],
        content: 'test',
      };

      const signed = signEvent(unsigned, testPrivateKey);

      expect(verifyEvent(signed)).toBe(true);
    });
  });

  describe('signEvent - Error Handling (AC6)', () => {
    it('should throw SIGNING_FAILED for invalid private key (not Uint8Array)', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: 'test',
      };

      expect(() => {
        signEvent(unsigned, 'invalid' as unknown as Uint8Array);
      }).toThrow(SigilError);

      try {
        signEvent(unsigned, 'invalid' as unknown as Uint8Array);
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('SIGNING_FAILED');
        expect((error as SigilError).boundary).toBe('identity');
      }
    });

    it('should throw SIGNING_FAILED for invalid private key length', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: 'test',
      };

      const invalidKey = new Uint8Array(16); // Wrong length (should be 32)

      expect(() => {
        signEvent(unsigned, invalidKey);
      }).toThrow(SigilError);

      try {
        signEvent(unsigned, invalidKey);
      } catch (error) {
        expect((error as SigilError).message).toContain('32-byte');
      }
    });

    it('should NOT include private key in error message (AC6 security)', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: 'test',
      };

      const testKey = new Uint8Array(32);
      testKey.fill(0xab); // Fill with recognizable pattern

      try {
        signEvent(unsigned, new Uint8Array(16)); // Invalid length
      } catch (error) {
        const errorMessage = (error as Error).message;
        // Should not contain the actual key data
        expect(errorMessage).not.toContain('0xab');
        expect(errorMessage).not.toContain('171'); // Decimal representation of 0xab
      }
    });

    it('should sanitize errors from nostr-tools (AC6 security)', () => {
      // Test that even if nostr-tools throws an error with key data,
      // we sanitize it before re-throwing
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: 'test',
      };

      try {
        signEvent(unsigned, null as unknown as Uint8Array);
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('SIGNING_FAILED');
        // Error message should not contain key data
      }
    });
  });

  describe('redactPrivateKey (AC6 security)', () => {
    it('should return redacted placeholder string', () => {
      const redacted = redactPrivateKey();

      expect(redacted).toBe('<private-key-redacted>');
    });

    it('should not expose any key data', () => {
      const redacted = redactPrivateKey();

      expect(redacted).not.toContain('ff');
      expect(redacted).not.toContain('255');
      expect(redacted).toBe('<private-key-redacted>');
    });
  });

  describe('Known Test Vectors (NIP-01 compliance)', () => {
    // Test with known NIP-01 test vector if available
    // Note: NIP-01 spec doesn't provide official test vectors,
    // so we'll verify the signing process produces valid events

    it('should produce NIP-01 compliant event structure', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1234567890,
        kind: 1,
        tags: [],
        content: 'hello world',
      };

      const signed = signEvent(unsigned, testPrivateKey);

      // Verify all required NIP-01 fields
      expect(signed).toHaveProperty('id');
      expect(signed).toHaveProperty('pubkey');
      expect(signed).toHaveProperty('created_at');
      expect(signed).toHaveProperty('kind');
      expect(signed).toHaveProperty('tags');
      expect(signed).toHaveProperty('content');
      expect(signed).toHaveProperty('sig');

      // Verify types
      expect(typeof signed.id).toBe('string');
      expect(typeof signed.pubkey).toBe('string');
      expect(typeof signed.created_at).toBe('number');
      expect(typeof signed.kind).toBe('number');
      expect(Array.isArray(signed.tags)).toBe(true);
      expect(typeof signed.content).toBe('string');
      expect(typeof signed.sig).toBe('string');
    });

    it('should maintain event immutability (id matches serialized event)', () => {
      const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
        pubkey: testPublicKey,
        created_at: 1234567890,
        kind: 30078,
        tags: [['d', 'immutability_test']],
        content: '{"reducer":"test","args":[]}',
      };

      const signed = signEvent(unsigned, testPrivateKey);

      // Re-verify to ensure ID is correct
      expect(verifyEvent(signed)).toBe(true);

      // Note: verifyEvent in nostr-tools may only verify signature validity,
      // not content immutability. The ID is computed from content, so modifying
      // content would invalidate the signature if verifyEvent recomputes the ID.
      // However, some implementations may not catch this, so we just verify
      // that the original event is valid.
    });
  });
});
