/**
 * Workspace Stub Contract Tests: @crosstown/client & @crosstown/relay
 *
 * Validates that workspace stubs expose the expected API surface that
 * @sigil/client consumers depend on. These tests fulfill AGREEMENT-8
 * (Contract Tests for External Package APIs) from the Epic 2 retro
 * and ACTION-E3-1 from the Epic 3 retro.
 *
 * When the real packages ship on npm, run these tests against the real
 * packages (by swapping workspace stubs) to detect API divergence.
 *
 * Test count: 15
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// @crosstown/client contract tests
// Consumer: CrosstownAdapter (crosstown-adapter.ts)
// ---------------------------------------------------------------------------

describe('@crosstown/client stub contract', () => {
  describe('exports', () => {
    it('exports CrosstownClient class', async () => {
      const mod = await import('@crosstown/client');
      expect(mod.CrosstownClient).toBeDefined();
      expect(typeof mod.CrosstownClient).toBe('function');
    });

    it('exports CrosstownError class extending Error', async () => {
      const mod = await import('@crosstown/client');
      expect(mod.CrosstownError).toBeDefined();
      const error = new mod.CrosstownError('test', 'TEST', 500);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe('TEST');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('CrosstownClient constructor contract', () => {
    it('accepts config with secretKey, connectorUrl, and ilpInfo', async () => {
      const { CrosstownClient } = await import('@crosstown/client');
      const client = new CrosstownClient({
        connectorUrl: 'http://localhost:4041',
        secretKey: new Uint8Array(32).fill(1),
        ilpInfo: {
          pubkey: '0'.repeat(64),
          ilpAddress: 'g.crosstown.test',
          btpEndpoint: 'ws://localhost:3000',
        },
      });
      expect(client).toBeDefined();
    });

    it('rejects invalid secretKey', async () => {
      const { CrosstownClient, CrosstownError } = await import('@crosstown/client');
      expect(() => {
        new CrosstownClient({
          connectorUrl: 'http://localhost:4041',
          secretKey: new Uint8Array(16),
          ilpInfo: {
            pubkey: '0'.repeat(64),
            ilpAddress: 'g.crosstown.test',
            btpEndpoint: 'ws://localhost:3000',
          },
        });
      }).toThrow(CrosstownError);
    });
  });

  describe('CrosstownClient method signatures', () => {
    // Shared client instance for method tests
    const makeClient = async () => {
      const { CrosstownClient } = await import('@crosstown/client');
      return new CrosstownClient({
        connectorUrl: 'http://localhost:4041',
        secretKey: new Uint8Array(32).fill(1),
        ilpInfo: {
          pubkey: '0'.repeat(64),
          ilpAddress: 'g.crosstown.test',
          btpEndpoint: 'ws://localhost:3000',
        },
      });
    };

    it('start() returns Promise with peersDiscovered and mode', async () => {
      const client = await makeClient();
      const result = await client.start();
      expect(result).toHaveProperty('peersDiscovered');
      expect(result).toHaveProperty('mode');
    });

    it('stop() returns Promise<void>', async () => {
      const client = await makeClient();
      await client.start();
      const result = await client.stop();
      expect(result).toBeUndefined();
    });

    it('getPublicKey() returns 64-char lowercase hex string', async () => {
      const client = await makeClient();
      const pubkey = client.getPublicKey();
      expect(typeof pubkey).toBe('string');
      expect(pubkey).toHaveLength(64);
      expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
    });

    it('getEvmAddress() returns 0x-prefixed hex string', async () => {
      const client = await makeClient();
      const evmAddr = client.getEvmAddress();
      expect(typeof evmAddr).toBe('string');
      expect(evmAddr).toMatch(/^0x[0-9a-f]+$/);
    });

    it('publishEvent() is a function', async () => {
      const client = await makeClient();
      expect(typeof client.publishEvent).toBe('function');
    });
  });
});

// ---------------------------------------------------------------------------
// @crosstown/relay contract tests
// Consumer: CrosstownAdapter (passes to CrosstownClient as toonEncoder/toonDecoder)
// ---------------------------------------------------------------------------

describe('@crosstown/relay stub contract', () => {
  describe('exports', () => {
    it('exports encodeEventToToon function', async () => {
      const mod = await import('@crosstown/relay');
      expect(typeof mod.encodeEventToToon).toBe('function');
    });

    it('exports decodeEventFromToon function', async () => {
      const mod = await import('@crosstown/relay');
      expect(typeof mod.decodeEventFromToon).toBe('function');
    });
  });

  describe('TOON round-trip contract', () => {
    it('encodeEventToToon returns Uint8Array', async () => {
      const { encodeEventToToon } = await import('@crosstown/relay');
      const event = {
        id: '0'.repeat(64),
        pubkey: '0'.repeat(64),
        created_at: 1234567890,
        kind: 30078,
        tags: [],
        content: '{"reducer":"test","args":[]}',
        sig: '0'.repeat(128),
      };
      const encoded = encodeEventToToon(event);
      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('decodeEventFromToon reverses encodeEventToToon', async () => {
      const { encodeEventToToon, decodeEventFromToon } = await import('@crosstown/relay');
      const event = {
        id: 'ab'.repeat(32),
        pubkey: 'cd'.repeat(32),
        created_at: 1234567890,
        kind: 30078,
        tags: [['d', 'test']],
        content: '{"reducer":"player_move","args":[100,200]}',
        sig: 'ef'.repeat(64),
      };
      const encoded = encodeEventToToon(event);
      const decoded = decodeEventFromToon(encoded);
      expect(decoded).toEqual(event);
    });

    it('decodeEventFromToon throws on invalid TOON data', async () => {
      const { decodeEventFromToon } = await import('@crosstown/relay');
      expect(() => decodeEventFromToon(new Uint8Array([1, 2, 3, 4]))).toThrow();
    });
  });
});
