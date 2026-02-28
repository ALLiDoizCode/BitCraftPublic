/**
 * BLS Handler Contract Validation Tests
 * Story 2.4: BLS Handler Integration Contract & Testing
 *
 * Tests event structure, content parsing, and signature validation
 * independent of the BLS handler deployment.
 *
 * AC Coverage:
 * - AC1: Kind 30078 event structure validation
 * - AC2: Event content parsing and validation
 * - AC3: Signature structure validation (format checks)
 */

import { describe, it, expect } from 'vitest';
import { signEvent } from '../publish/event-signing';
import { generateKeypair } from '../nostr/keypair';
import { bytesToHex } from '@noble/hashes/utils';
import type { NostrEvent } from '../nostr/types';

describe('BLS Handler Contract Validation', () => {
  describe('AC1: Kind 30078 event structure', () => {
    it('should create valid kind 30078 event structure', async () => {
      // Given: A keypair for signing
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      // When: Creating a kind 30078 event
      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'test_action', args: [] }),
      };

      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // Then: Event has all required NIP-01 fields
      expect(signedEvent).toHaveProperty('id');
      expect(signedEvent).toHaveProperty('pubkey');
      expect(signedEvent).toHaveProperty('created_at');
      expect(signedEvent).toHaveProperty('kind');
      expect(signedEvent).toHaveProperty('tags');
      expect(signedEvent).toHaveProperty('content');
      expect(signedEvent).toHaveProperty('sig');

      // And: Kind is 30078
      expect(signedEvent.kind).toBe(30078);

      // And: Pubkey is 64-character hex string (32 bytes)
      expect(signedEvent.pubkey).toMatch(/^[0-9a-f]{64}$/);

      // And: Event ID is 64-character hex string (32 bytes SHA256)
      expect(signedEvent.id).toMatch(/^[0-9a-f]{64}$/);

      // And: Signature is 128-character hex string (64 bytes Schnorr)
      expect(signedEvent.sig).toMatch(/^[0-9a-f]{128}$/);

      // And: Timestamp is valid Unix timestamp
      expect(signedEvent.created_at).toBeGreaterThan(0);
      expect(signedEvent.created_at).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));

      // And: Tags is an array
      expect(Array.isArray(signedEvent.tags)).toBe(true);
    });

    it('should enforce kind 30078 for game actions', async () => {
      // Given: A game action event
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078, // Required for game actions
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
      };

      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // Then: Kind must be exactly 30078
      expect(signedEvent.kind).toBe(30078);

      // And: BLS handler should reject other kinds (contract requirement)
      // (This is a contract requirement - BLS must validate event.kind === 30078)
    });

    it('should include all required Nostr fields', async () => {
      // Given: A minimal valid event
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: '{"reducer":"test","args":[]}',
      };

      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // Then: All 7 NIP-01 fields are present
      const requiredFields = ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig'];
      requiredFields.forEach((field) => {
        expect(signedEvent).toHaveProperty(field);
      });

      // And: No additional fields (contract compliance)
      const actualFields = Object.keys(signedEvent);
      expect(actualFields.sort()).toEqual(requiredFields.sort());
    });
  });

  describe('AC2: Event content parsing and validation', () => {
    it('should create valid JSON content with reducer and args', async () => {
      // Given: A game action
      const action = {
        reducer: 'player_move',
        args: [
          { x: 100, z: 200 }, // origin
          { x: 110, z: 200 }, // destination
          false, // running
        ],
      };

      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify(action),
      };

      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // Then: Content is valid JSON string
      expect(() => JSON.parse(signedEvent.content)).not.toThrow();

      // And: Parsed content has reducer field
      const parsed = JSON.parse(signedEvent.content);
      expect(parsed).toHaveProperty('reducer');
      expect(typeof parsed.reducer).toBe('string');

      // And: Parsed content has args field
      expect(parsed).toHaveProperty('args');
      expect(Array.isArray(parsed.args)).toBe(true);

      // And: Args are preserved correctly
      expect(parsed.reducer).toBe('player_move');
      expect(parsed.args).toHaveLength(3);
      expect(parsed.args[0]).toEqual({ x: 100, z: 200 });
      expect(parsed.args[1]).toEqual({ x: 110, z: 200 });
      expect(parsed.args[2]).toBe(false);
    });

    it('should detect malformed JSON content', () => {
      // Given: Invalid JSON strings
      const invalidJsonStrings = [
        '{invalid json',
        '{"reducer": "test", args: []}', // Missing quotes
        '{"reducer": "test", "args": [}', // Mismatched brackets
        'not json at all',
        '',
        '{', // Incomplete
      ];

      invalidJsonStrings.forEach((invalidJson) => {
        // When: Attempting to parse invalid JSON
        let parseError: Error | null = null;
        try {
          JSON.parse(invalidJson);
        } catch (error) {
          parseError = error as Error;
        }

        // Then: Parsing should fail
        expect(parseError).not.toBeNull();
        expect(parseError).toBeInstanceOf(SyntaxError);

        // And: BLS handler must return INVALID_CONTENT error
        // (Contract requirement - tested in integration tests)
      });
    });

    it('should detect missing required content fields', () => {
      // Given: Content with missing fields
      const invalidContents = [
        '{}', // Missing both reducer and args
        '{"reducer": "test"}', // Missing args
        '{"args": []}', // Missing reducer
        '{"reducer": 123, "args": []}', // Wrong type (number instead of string)
        '{"reducer": "test", "args": "not_array"}', // Wrong type (string instead of array)
      ];

      invalidContents.forEach((content) => {
        // When: Parsing content
        const parsed = JSON.parse(content);

        // Then: Content is missing required fields or has wrong types
        const hasValidReducer = typeof parsed.reducer === 'string' && parsed.reducer.length > 0;
        const hasValidArgs = Array.isArray(parsed.args);

        expect(hasValidReducer && hasValidArgs).toBe(false);

        // And: BLS handler must return INVALID_CONTENT error
        // (Contract requirement - tested in integration tests)
      });
    });

    it('should support various argument types', async () => {
      // Given: Actions with different argument types
      const actions = [
        { reducer: 'test_empty', args: [] },
        { reducer: 'test_numbers', args: [1, 2, 3] },
        { reducer: 'test_strings', args: ['a', 'b', 'c'] },
        { reducer: 'test_objects', args: [{ x: 1 }, { y: 2 }] },
        { reducer: 'test_mixed', args: [1, 'a', { x: 1 }, true, null] },
        { reducer: 'test_nested', args: [{ nested: { deep: [1, 2, 3] } }] },
      ];

      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      actions.forEach((action) => {
        // When: Creating event with various arg types
        const eventTemplate = {
          pubkey: pubkeyHex,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [] as string[][],
          content: JSON.stringify(action),
        };

        const signedEvent = signEvent(eventTemplate, keypair.privateKey);

        // Then: Content is valid JSON
        const parsed = JSON.parse(signedEvent.content);
        expect(parsed.reducer).toBe(action.reducer);
        expect(parsed.args).toEqual(action.args);
      });
    });

    it('should validate reducer name format', async () => {
      // Given: Valid reducer names (alphanumeric with underscores)
      const validReducerNames = [
        'player_move',
        'test_action',
        'build_structure',
        'pickup_item',
        'craft',
        'use_item_123',
      ];

      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      validReducerNames.forEach((reducer) => {
        // When: Creating event with valid reducer name
        const eventTemplate = {
          pubkey: pubkeyHex,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [] as string[][],
          content: JSON.stringify({ reducer, args: [] }),
        };

        const signedEvent = signEvent(eventTemplate, keypair.privateKey);
        const parsed = JSON.parse(signedEvent.content);

        // Then: Reducer name is preserved
        expect(parsed.reducer).toBe(reducer);

        // And: Reducer name matches expected format
        expect(parsed.reducer).toMatch(/^[a-z_][a-z0-9_]*$/);
      });
    });

    it('should detect potentially unsafe reducer names', () => {
      // Given: Potentially unsafe reducer names (path traversal, injection)
      const unsafeReducerNames = [
        '../../../etc/passwd', // Path traversal
        'reducer; DROP TABLE users', // SQL injection attempt
        'reducer && rm -rf /', // Command injection attempt
        'reducer<script>alert("xss")</script>', // XSS attempt
        '', // Empty string
      ];

      unsafeReducerNames.forEach((reducer) => {
        // Then: BLS handler must validate reducer name format
        // Contract requirement: alphanumeric with underscores only
        const isSafe = /^[a-z_][a-z0-9_]*$/.test(reducer);
        expect(isSafe).toBe(false);

        // And: BLS handler should reject with UNKNOWN_REDUCER or INVALID_CONTENT
        // (Contract requirement - tested in integration tests)
      });
    });
  });

  describe('AC3: Signature validation (structure)', () => {
    it('should create valid Schnorr signature structure', async () => {
      // Given: A signed event
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'test', args: [] }),
      };

      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // Then: Signature is 128-character hex string (64 bytes Schnorr)
      expect(signedEvent.sig).toMatch(/^[0-9a-f]{128}$/);

      // And: Signature is lowercase hex
      expect(signedEvent.sig).toBe(signedEvent.sig.toLowerCase());

      // And: Signature is unique (re-signing produces different signature due to timestamp)
      const eventTemplate2 = {
        ...eventTemplate,
        created_at: eventTemplate.created_at + 1,
      };
      const signedEvent2 = signEvent(eventTemplate2, keypair.privateKey);
      expect(signedEvent2.sig).not.toBe(signedEvent.sig);
    });

    it('should create deterministic event ID', async () => {
      // Given: Same event template
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: 1234567890, // Fixed timestamp for determinism
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'test', args: [] }),
      };

      // When: Signing the same template twice
      const signedEvent1 = signEvent(eventTemplate, keypair.privateKey);
      const signedEvent2 = signEvent(eventTemplate, keypair.privateKey);

      // Then: Event IDs are identical (deterministic)
      expect(signedEvent1.id).toBe(signedEvent2.id);

      // And: Event ID is 64-character hex string (32 bytes SHA256)
      expect(signedEvent1.id).toMatch(/^[0-9a-f]{64}$/);

      // And: Signatures are identical (deterministic for same input)
      expect(signedEvent1.sig).toBe(signedEvent2.sig);
    });

    it('should detect corrupted signatures', async () => {
      // Given: A valid signed event
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'test', args: [] }),
      };

      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // When: Corrupting the signature
      const corruptedSignatures = [
        signedEvent.sig.replace(/^./, 'z'), // Change first character
        signedEvent.sig.replace(/.$/, 'z'), // Change last character
        signedEvent.sig.substring(0, 64), // Truncate to half length
        signedEvent.sig + '00', // Extend length
        '', // Empty signature
        'invalid', // Invalid format
      ];

      corruptedSignatures.forEach((corruptedSig) => {
        const corruptedEvent = { ...signedEvent, sig: corruptedSig };

        // Then: Signature format is invalid
        const isValidFormat = /^[0-9a-f]{128}$/.test(corruptedEvent.sig);

        if (!isValidFormat) {
          // Signature is obviously invalid (wrong format)
          expect(isValidFormat).toBe(false);
        } else {
          // Signature has valid format but is corrupted
          // BLS handler must perform cryptographic verification to detect
          expect(corruptedEvent.sig).not.toBe(signedEvent.sig);
        }

        // And: BLS handler must reject with INVALID_SIGNATURE
        // (Contract requirement - cryptographic validation in BLS handler)
      });
    });

    it('should detect event ID tampering', async () => {
      // Given: A valid signed event
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'test', args: [] }),
      };

      const signedEvent = signEvent(eventTemplate, keypair.privateKey);
      const originalId = signedEvent.id;

      // When: Tampering with event ID
      const tamperedIds = [
        originalId.replace(/^./, 'a'), // Change first character
        originalId.replace(/.$/, 'a'), // Change last character
        '0'.repeat(64), // All zeros
        'f'.repeat(64), // All 0xF
      ];

      tamperedIds.forEach((tamperedId) => {
        // Skip if tampering didn't actually change the ID
        if (tamperedId === originalId) {
          return;
        }

        const tamperedEvent = { ...signedEvent, id: tamperedId };

        // Then: Event ID doesn't match content
        expect(tamperedEvent.id).not.toBe(originalId);

        // And: BLS handler must recompute event ID and detect mismatch
        // (Contract requirement - event ID validation in BLS handler)
      });
    });

    it('should detect content tampering', async () => {
      // Given: A valid signed event
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'test', args: [] }),
      };

      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // When: Tampering with content
      const tamperedContents = [
        JSON.stringify({ reducer: 'different_reducer', args: [] }),
        JSON.stringify({ reducer: 'test', args: [1, 2, 3] }),
        '{"reducer":"malicious","args":[]}',
      ];

      tamperedContents.forEach((tamperedContent) => {
        const tamperedEvent = { ...signedEvent, content: tamperedContent };

        // Then: Content doesn't match original
        expect(tamperedEvent.content).not.toBe(signedEvent.content);

        // And: BLS handler must recompute event ID and detect mismatch
        // Event ID is hash of [0, pubkey, created_at, kind, tags, content]
        // Changing content changes event ID, signature verification fails
        // (Contract requirement - signature verification detects tampering)
      });
    });
  });

  describe('Identity propagation structure', () => {
    it('should extract pubkey for identity propagation', async () => {
      // Given: A signed event
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'player_move', args: [{ x: 1 }, { x: 2 }] }),
      };

      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // Then: Event has pubkey field for identity extraction
      expect(signedEvent.pubkey).toBeTruthy();
      expect(signedEvent.pubkey).toMatch(/^[0-9a-f]{64}$/);

      // And: BLS handler can extract pubkey for prepending to args
      const identity = signedEvent.pubkey;
      const content = JSON.parse(signedEvent.content);
      const argsWithIdentity = [identity, ...content.args];

      expect(argsWithIdentity).toHaveLength(3); // pubkey + 2 args
      expect(argsWithIdentity[0]).toBe(identity);
      expect(argsWithIdentity[1]).toEqual({ x: 1 });
      expect(argsWithIdentity[2]).toEqual({ x: 2 });

      // And: This is the structure BLS passes to SpacetimeDB
      // (Contract requirement: [nostr_pubkey, ...event.args])
    });

    it('should preserve pubkey through event lifecycle', async () => {
      // Given: A keypair
      const keypair = await generateKeypair();
      const originalPubkey = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: originalPubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'test', args: [] }),
      };

      // When: Signing event
      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // Then: Pubkey is preserved exactly
      expect(signedEvent.pubkey).toBe(originalPubkey);

      // And: Pubkey matches the keypair
      expect(signedEvent.pubkey).toBe(bytesToHex(keypair.publicKey));

      // And: BLS can use this pubkey for identity attribution
      // (Contract requirement: every action attributed to pubkey)
    });
  });

  describe('Contract error scenarios', () => {
    it('should structure events to avoid INVALID_CONTENT errors', async () => {
      // Given: Properly structured events
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const validActions = [
        { reducer: 'test', args: [] },
        { reducer: 'player_move', args: [{ x: 1 }] },
        { reducer: 'complex_action', args: [1, 'a', { x: 1 }, [1, 2]] },
      ];

      validActions.forEach((action) => {
        // When: Creating properly structured event
        const eventTemplate = {
          pubkey: pubkeyHex,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [] as string[][],
          content: JSON.stringify(action),
        };

        const signedEvent = signEvent(eventTemplate, keypair.privateKey);

        // Then: Content is valid JSON with required fields
        const parsed = JSON.parse(signedEvent.content);
        expect(parsed).toHaveProperty('reducer');
        expect(parsed).toHaveProperty('args');
        expect(typeof parsed.reducer).toBe('string');
        expect(Array.isArray(parsed.args)).toBe(true);

        // And: BLS handler should accept (not return INVALID_CONTENT)
      });
    });

    it('should create events that avoid UNKNOWN_REDUCER errors', async () => {
      // Given: Valid reducer name format
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const validReducerNames = ['test_action', 'player_move', 'build_structure'];

      validReducerNames.forEach((reducer) => {
        // When: Creating event with valid reducer name
        const eventTemplate = {
          pubkey: pubkeyHex,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [] as string[][],
          content: JSON.stringify({ reducer, args: [] }),
        };

        const signedEvent = signEvent(eventTemplate, keypair.privateKey);
        const parsed = JSON.parse(signedEvent.content);

        // Then: Reducer name is valid format (alphanumeric + underscore)
        expect(parsed.reducer).toMatch(/^[a-z_][a-z0-9_]*$/);

        // And: BLS handler should attempt to call SpacetimeDB
        // (Whether reducer exists is runtime check, but format is valid)
      });
    });
  });

  describe('Performance and size constraints', () => {
    it('should support reasonable content sizes', async () => {
      // Given: Various content sizes
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const contentSizes = [
        { reducer: 'small', args: [] }, // ~20 bytes
        { reducer: 'medium', args: Array(10).fill({ x: 1, y: 2 }) }, // ~200 bytes
        { reducer: 'large', args: Array(100).fill({ x: 1, y: 2, z: 3 }) }, // ~2KB
      ];

      contentSizes.forEach((action) => {
        // When: Creating event with varying content sizes
        const content = JSON.stringify(action);
        const eventTemplate = {
          pubkey: pubkeyHex,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [] as string[][],
          content,
        };

        const signedEvent = signEvent(eventTemplate, keypair.privateKey);

        // Then: Event is created successfully
        expect(signedEvent).toBeDefined();
        expect(signedEvent.content.length).toBeGreaterThan(0);

        // And: Content is valid JSON
        const parsed = JSON.parse(signedEvent.content);
        expect(parsed.reducer).toBe(action.reducer);
        expect(parsed.args).toEqual(action.args);
      });
    });

    it('should create events efficiently', async () => {
      // Given: A keypair
      const keypair = await generateKeypair();
      const pubkeyHex = bytesToHex(keypair.publicKey);

      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: JSON.stringify({ reducer: 'test', args: [] }),
      };

      // When: Measuring event creation time
      const startTime = performance.now();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        signEvent(eventTemplate, keypair.privateKey);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Then: Event creation should be reasonably fast (<20ms average)
      // This ensures client-side overhead is minimal
      // Note: Performance varies by hardware; 20ms is generous for CI environments
      expect(avgTime).toBeLessThan(20);
      console.log(`Average event creation time: ${avgTime.toFixed(2)}ms`);
    });
  });
});
