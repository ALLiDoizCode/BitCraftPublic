/**
 * ILP Packet Construction Tests
 * Story 2.3 (original), Story 2.5 (simplified to content-only)
 *
 * Tests for constructILPPacket function and validation.
 * After Story 2.5, constructILPPacket takes 2 args (options, fee) -- no pubkey.
 * Returns { kind, content, tags } only (no pubkey, created_at, id, sig).
 */

import { describe, it, expect } from 'vitest';
import { constructILPPacket, parseILPPacket, extractFeeFromEvent } from './ilp-packet';
import type { NostrEvent } from '../nostr/types';
import { SigilError } from '../nostr/nostr-client';

describe('ILP Packet Construction', () => {
  describe('constructILPPacket - Content-Only Template (AC2, AC4)', () => {
    it('should construct valid kind 30078 content-only template', () => {
      const template = constructILPPacket({ reducer: 'player_move', args: [100, 200] }, 10);

      expect(template.kind).toBe(30078);
      expect(template.content).toBe('{"reducer":"player_move","args":[100,200]}');
      expect(template.tags).toBeInstanceOf(Array);
    });

    it('should return template WITHOUT pubkey field', () => {
      const template = constructILPPacket({ reducer: 'player_move', args: [] }, 1);

      expect(template).not.toHaveProperty('pubkey');
    });

    it('should return template WITHOUT created_at field', () => {
      const template = constructILPPacket({ reducer: 'player_move', args: [] }, 1);

      expect(template).not.toHaveProperty('created_at');
    });

    it('should return template WITHOUT id or sig fields', () => {
      const template = constructILPPacket({ reducer: 'player_move', args: [] }, 1);

      expect(template).not.toHaveProperty('id');
      expect(template).not.toHaveProperty('sig');
    });

    it('should return ONLY kind, content, and tags', () => {
      const template = constructILPPacket({ reducer: 'test', args: null }, 1);
      const keys = Object.keys(template).sort();
      expect(keys).toEqual(['content', 'kind', 'tags']);
    });

    it('should serialize content as JSON with reducer and args', () => {
      const args = { x: 100, y: 200, z: 300 };
      const template = constructILPPacket({ reducer: 'teleport', args }, 50);

      const parsed = JSON.parse(template.content);
      expect(parsed).toEqual({ reducer: 'teleport', args });
    });

    it('should include d tag for parameterized replaceable events (NIP-33)', () => {
      const template = constructILPPacket({ reducer: 'player_move', args: [] }, 1);

      const dTag = template.tags.find((tag) => tag[0] === 'd');
      expect(dTag).toBeDefined();
      expect(dTag?.[1]).toMatch(/^player_move_\d+$/);
    });

    it('should include fee tag for relay filtering', () => {
      const template = constructILPPacket({ reducer: 'test', args: null }, 42);

      const feeTag = template.tags.find((tag) => tag[0] === 'fee');
      expect(feeTag).toBeDefined();
      expect(feeTag?.[1]).toBe('42');
    });

    it('should handle complex nested args', () => {
      const complexArgs = {
        player: { id: 123, name: 'Alice' },
        items: [
          { id: 1, qty: 5 },
          { id: 2, qty: 10 },
        ],
        meta: { timestamp: Date.now() },
      };

      const template = constructILPPacket({ reducer: 'complex_action', args: complexArgs }, 1);
      const parsed = JSON.parse(template.content);

      expect(parsed.args).toEqual(complexArgs);
    });

    it('should handle zero fee', () => {
      const template = constructILPPacket({ reducer: 'free_action', args: null }, 0);

      const feeTag = template.tags.find((tag) => tag[0] === 'fee');
      expect(feeTag?.[1]).toBe('0');
    });

    it('should handle float fee', () => {
      const template = constructILPPacket({ reducer: 'partial_fee', args: null }, 1.5);

      const feeTag = template.tags.find((tag) => tag[0] === 'fee');
      expect(feeTag?.[1]).toBe('1.5');
    });
  });

  describe('constructILPPacket - Validation Errors', () => {
    it('should throw INVALID_ACTION for empty reducer name', () => {
      expect(() => {
        constructILPPacket({ reducer: '', args: null }, 1);
      }).toThrow(SigilError);

      try {
        constructILPPacket({ reducer: '', args: null }, 1);
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('INVALID_ACTION');
        expect((error as SigilError).boundary).toBe('publish');
      }
    });

    it('should throw INVALID_ACTION for non-string reducer', () => {
      expect(() => {
        constructILPPacket({ reducer: 123 as unknown as string, args: null }, 1);
      }).toThrow(SigilError);
    });

    it('should throw INVALID_ACTION for reducer with invalid characters', () => {
      expect(() => {
        constructILPPacket({ reducer: 'player-move', args: null }, 1);
      }).toThrow(SigilError);

      try {
        constructILPPacket({ reducer: 'player-move', args: null }, 1);
      } catch (error) {
        expect((error as SigilError).message).toContain('invalid characters');
      }
    });

    it('should throw INVALID_ACTION for reducer exceeding 64 characters', () => {
      const longReducer = 'a'.repeat(65);
      expect(() => {
        constructILPPacket({ reducer: longReducer, args: null }, 1);
      }).toThrow(SigilError);
    });

    it('should throw INVALID_ACTION for negative fee', () => {
      expect(() => {
        constructILPPacket({ reducer: 'test', args: null }, -1);
      }).toThrow(SigilError);
    });

    it('should throw INVALID_ACTION for non-finite fee', () => {
      expect(() => {
        constructILPPacket({ reducer: 'test', args: null }, NaN);
      }).toThrow(SigilError);

      expect(() => {
        constructILPPacket({ reducer: 'test', args: null }, Infinity);
      }).toThrow(SigilError);
    });

    it('should throw INVALID_ACTION for non-JSON-serializable args', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(() => {
        constructILPPacket({ reducer: 'test', args: circular }, 1);
      }).toThrow(SigilError);
    });

    it('should accept valid reducer with underscores and numbers', () => {
      const template = constructILPPacket({ reducer: 'player_move_123', args: null }, 1);

      expect(template.content).toContain('player_move_123');
    });
  });

  describe('parseILPPacket', () => {
    it('should parse valid ILP packet from event content', () => {
      const event: NostrEvent = {
        id: 'abc123',
        pubkey: '0'.repeat(64),
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
        pubkey: '0'.repeat(64),
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
        pubkey: '0'.repeat(64),
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
        pubkey: '0'.repeat(64),
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
        pubkey: '0'.repeat(64),
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
        pubkey: '0'.repeat(64),
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
