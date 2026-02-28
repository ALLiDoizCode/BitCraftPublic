/**
 * ILP Packet Construction Tests
 * Story 2.3: ILP Packet Construction & Signing
 *
 * Tests for constructILPPacket function and validation.
 * Validates AC1: Construct and sign ILP packet for game action.
 */

import { describe, it, expect } from 'vitest';
import { constructILPPacket, parseILPPacket, extractFeeFromEvent } from './ilp-packet';
import type { NostrEvent } from '../nostr/types';
import { SigilError } from '../nostr/nostr-client';

describe('ILP Packet Construction', () => {
  const testPubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';

  describe('constructILPPacket - Valid Cases (AC1)', () => {
    it('should construct valid kind 30078 event with reducer and args', () => {
      const event = constructILPPacket(
        { reducer: 'player_move', args: [100, 200] },
        10,
        testPubkey
      );

      expect(event.kind).toBe(30078);
      expect(event.pubkey).toBe(testPubkey);
      expect(event.created_at).toBeGreaterThan(0);
      expect(event.content).toBe('{"reducer":"player_move","args":[100,200]}');
      expect(event.tags).toBeInstanceOf(Array);
    });

    it('should include all required NIP-01 fields except id and sig (AC1)', () => {
      const event = constructILPPacket(
        { reducer: 'craft_item', args: { itemId: 42 } },
        15,
        testPubkey
      );

      expect(event).toHaveProperty('pubkey');
      expect(event).toHaveProperty('created_at');
      expect(event).toHaveProperty('kind');
      expect(event).toHaveProperty('tags');
      expect(event).toHaveProperty('content');
      expect(event).not.toHaveProperty('id');
      expect(event).not.toHaveProperty('sig');
    });

    it('should serialize content as JSON with reducer and args (AC1)', () => {
      const args = { x: 100, y: 200, z: 300 };
      const event = constructILPPacket({ reducer: 'teleport', args }, 50, testPubkey);

      const parsed = JSON.parse(event.content);
      expect(parsed).toEqual({ reducer: 'teleport', args });
    });

    it('should set pubkey field to provided public key (AC1)', () => {
      const customPubkey = 'abc123def456' + '0'.repeat(52); // Pad to 64 characters
      const event = constructILPPacket({ reducer: 'test_action', args: [] }, 1, customPubkey);

      expect(event.pubkey).toBe(customPubkey);
    });

    it('should set created_at to current Unix timestamp within 5s tolerance (AC1)', () => {
      const before = Math.floor(Date.now() / 1000);
      const event = constructILPPacket({ reducer: 'test', args: null }, 1, testPubkey);
      const after = Math.floor(Date.now() / 1000);

      expect(event.created_at).toBeGreaterThanOrEqual(before);
      expect(event.created_at).toBeLessThanOrEqual(after + 5);
    });

    it('should include d tag for parameterized replaceable events (NIP-33)', () => {
      const event = constructILPPacket({ reducer: 'player_move', args: [] }, 1, testPubkey);

      const dTag = event.tags.find((tag) => tag[0] === 'd');
      expect(dTag).toBeDefined();
      expect(dTag?.[1]).toMatch(/^player_move_\d+$/);
    });

    it('should include fee tag for relay filtering', () => {
      const event = constructILPPacket({ reducer: 'test', args: null }, 42, testPubkey);

      const feeTag = event.tags.find((tag) => tag[0] === 'fee');
      expect(feeTag).toBeDefined();
      expect(feeTag?.[1]).toBe('42');
    });

    it('should handle complex nested args (AC1 robustness)', () => {
      const complexArgs = {
        player: { id: 123, name: 'Alice' },
        items: [
          { id: 1, qty: 5 },
          { id: 2, qty: 10 },
        ],
        meta: { timestamp: Date.now() },
      };

      const event = constructILPPacket(
        { reducer: 'complex_action', args: complexArgs },
        1,
        testPubkey
      );
      const parsed = JSON.parse(event.content);

      expect(parsed.args).toEqual(complexArgs);
    });

    it('should handle zero fee (AC1 edge case)', () => {
      const event = constructILPPacket({ reducer: 'free_action', args: null }, 0, testPubkey);

      const feeTag = event.tags.find((tag) => tag[0] === 'fee');
      expect(feeTag?.[1]).toBe('0');
    });

    it('should handle float fee (AC1 edge case)', () => {
      const event = constructILPPacket({ reducer: 'partial_fee', args: null }, 1.5, testPubkey);

      const feeTag = event.tags.find((tag) => tag[0] === 'fee');
      expect(feeTag?.[1]).toBe('1.5');
    });
  });

  describe('constructILPPacket - Validation Errors (AC1)', () => {
    it('should throw INVALID_ACTION for empty reducer name', () => {
      expect(() => {
        constructILPPacket({ reducer: '', args: null }, 1, testPubkey);
      }).toThrow(SigilError);

      try {
        constructILPPacket({ reducer: '', args: null }, 1, testPubkey);
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('INVALID_ACTION');
        expect((error as SigilError).boundary).toBe('publish');
      }
    });

    it('should throw INVALID_ACTION for non-string reducer', () => {
      expect(() => {
        constructILPPacket({ reducer: 123 as unknown as string, args: null }, 1, testPubkey);
      }).toThrow(SigilError);
    });

    it('should throw INVALID_ACTION for reducer with invalid characters', () => {
      expect(() => {
        constructILPPacket({ reducer: 'player-move', args: null }, 1, testPubkey);
      }).toThrow(SigilError);

      try {
        constructILPPacket({ reducer: 'player-move', args: null }, 1, testPubkey);
      } catch (error) {
        expect((error as SigilError).message).toContain('invalid characters');
      }
    });

    it('should throw INVALID_ACTION for reducer exceeding 64 characters', () => {
      const longReducer = 'a'.repeat(65);
      expect(() => {
        constructILPPacket({ reducer: longReducer, args: null }, 1, testPubkey);
      }).toThrow(SigilError);

      try {
        constructILPPacket({ reducer: longReducer, args: null }, 1, testPubkey);
      } catch (error) {
        expect((error as SigilError).message).toContain('length must be between 1 and 64');
      }
    });

    it('should throw INVALID_ACTION for negative fee', () => {
      expect(() => {
        constructILPPacket({ reducer: 'test', args: null }, -1, testPubkey);
      }).toThrow(SigilError);

      try {
        constructILPPacket({ reducer: 'test', args: null }, -1, testPubkey);
      } catch (error) {
        expect((error as SigilError).message).toContain('non-negative');
      }
    });

    it('should throw INVALID_ACTION for non-finite fee', () => {
      expect(() => {
        constructILPPacket({ reducer: 'test', args: null }, NaN, testPubkey);
      }).toThrow(SigilError);

      expect(() => {
        constructILPPacket({ reducer: 'test', args: null }, Infinity, testPubkey);
      }).toThrow(SigilError);
    });

    it('should throw INVALID_ACTION for non-JSON-serializable args', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular; // Circular reference

      expect(() => {
        constructILPPacket({ reducer: 'test', args: circular }, 1, testPubkey);
      }).toThrow(SigilError);

      try {
        constructILPPacket({ reducer: 'test', args: circular }, 1, testPubkey);
      } catch (error) {
        expect((error as SigilError).message).toContain('JSON-serializable');
      }
    });

    it('should throw INVALID_ACTION for invalid pubkey format (ISSUE-2 fix)', () => {
      expect(() => {
        constructILPPacket({ reducer: 'test', args: null }, 1, 'invalid_pubkey');
      }).toThrow(SigilError);

      try {
        constructILPPacket({ reducer: 'test', args: null }, 1, 'abc123');
      } catch (error) {
        expect((error as SigilError).message).toContain('64-character hex string');
        expect((error as SigilError).code).toBe('INVALID_ACTION');
      }
    });

    it('should throw INVALID_ACTION for non-string pubkey', () => {
      expect(() => {
        constructILPPacket({ reducer: 'test', args: null }, 1, 123 as unknown as string);
      }).toThrow(SigilError);
    });

    it('should accept valid reducer with underscores and numbers', () => {
      const event = constructILPPacket({ reducer: 'player_move_123', args: null }, 1, testPubkey);

      expect(event.content).toContain('player_move_123');
    });
  });

  describe('parseILPPacket', () => {
    it('should parse valid ILP packet from event content', () => {
      const event: NostrEvent = {
        id: 'abc123',
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: '{"reducer":"player_move","args":[100,200]}',
        sig: 'def456',
      };

      const packet = parseILPPacket(event);

      expect(packet).not.toBeNull();
      expect(packet?.reducer).toBe('player_move');
      expect(packet?.args).toEqual([100, 200]);
    });

    it('should return null for malformed JSON', () => {
      const event: NostrEvent = {
        id: 'abc123',
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: 'not json',
        sig: 'def456',
      };

      const packet = parseILPPacket(event);
      expect(packet).toBeNull();
    });

    it('should return null for missing reducer field', () => {
      const event: NostrEvent = {
        id: 'abc123',
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: '{"args":[1,2,3]}',
        sig: 'def456',
      };

      const packet = parseILPPacket(event);
      expect(packet).toBeNull();
    });
  });

  describe('extractFeeFromEvent', () => {
    it('should extract fee from event tags', () => {
      const event: NostrEvent = {
        id: 'abc123',
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 30078,
        tags: [['fee', '42']],
        content: '{}',
        sig: 'def456',
      };

      const fee = extractFeeFromEvent(event);
      expect(fee).toBe(42);
    });

    it('should return 0 for missing fee tag', () => {
      const event: NostrEvent = {
        id: 'abc123',
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: '{}',
        sig: 'def456',
      };

      const fee = extractFeeFromEvent(event);
      expect(fee).toBe(0);
    });

    it('should return 0 for invalid fee value', () => {
      const event: NostrEvent = {
        id: 'abc123',
        pubkey: testPubkey,
        created_at: 1234567890,
        kind: 30078,
        tags: [['fee', 'invalid']],
        content: '{}',
        sig: 'def456',
      };

      const fee = extractFeeFromEvent(event);
      expect(fee).toBe(0);
    });
  });
});
