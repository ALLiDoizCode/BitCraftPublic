/**
 * Workspace Stub Contract Tests: @crosstown/sdk
 *
 * Validates that the @crosstown/sdk workspace stub exposes the expected
 * API surface that @sigil/bitcraft-bls consumers depend on. Fulfills
 * AGREEMENT-8 (Contract Tests for External Package APIs) from the Epic 2
 * retro and ACTION-E3-1 from the Epic 3 retro.
 *
 * When the real @crosstown/sdk ships on npm, run these tests against it
 * to detect API divergence immediately.
 *
 * Test count: 11
 */

import { describe, it, expect } from 'vitest';

describe('@crosstown/sdk stub contract', () => {
  describe('exports', () => {
    it('exports createNode function', async () => {
      const mod = await import('@crosstown/sdk');
      expect(typeof mod.createNode).toBe('function');
    });

    it('exports fromSecretKey function', async () => {
      const mod = await import('@crosstown/sdk');
      expect(typeof mod.fromSecretKey).toBe('function');
    });

    it('exports fromMnemonic function', async () => {
      const mod = await import('@crosstown/sdk');
      expect(typeof mod.fromMnemonic).toBe('function');
    });

    it('exports generateMnemonic function', async () => {
      const mod = await import('@crosstown/sdk');
      expect(typeof mod.generateMnemonic).toBe('function');
    });

    it('exports CrosstownNode class', async () => {
      const mod = await import('@crosstown/sdk');
      expect(typeof mod.CrosstownNode).toBe('function');
    });

    it('exports createMockHandlerContext function', async () => {
      const mod = await import('@crosstown/sdk');
      expect(typeof mod.createMockHandlerContext).toBe('function');
    });
  });

  describe('createNode() contract', () => {
    it('creates CrosstownNode with valid config', async () => {
      const { createNode, CrosstownNode } = await import('@crosstown/sdk');
      const node = createNode({
        secretKey: new Uint8Array(32).fill(1),
        connectorUrl: 'http://localhost:4041',
        ilpAddress: 'g.crosstown.test',
      });
      expect(node).toBeInstanceOf(CrosstownNode);
    });

    it('rejects invalid secretKey', async () => {
      const { createNode } = await import('@crosstown/sdk');
      expect(() => {
        createNode({
          secretKey: new Uint8Array(16),
          connectorUrl: 'http://localhost:4041',
        });
      }).toThrow();
    });
  });

  describe('CrosstownNode method signatures', () => {
    it('exposes on(), start(), stop(), dispatch(), identity, hasHandler()', async () => {
      const { createNode } = await import('@crosstown/sdk');
      const node = createNode({
        secretKey: new Uint8Array(32).fill(1),
        connectorUrl: 'http://localhost:4041',
      });
      expect(typeof node.on).toBe('function');
      expect(typeof node.start).toBe('function');
      expect(typeof node.stop).toBe('function');
      expect(typeof node.dispatch).toBe('function');
      expect(typeof node.hasHandler).toBe('function');

      // identity property returns { pubkey, evmAddress }
      const identity = node.identity;
      expect(identity).toHaveProperty('pubkey');
      expect(identity).toHaveProperty('evmAddress');
      expect(typeof identity.pubkey).toBe('string');
      expect(identity.pubkey).toHaveLength(64);
      expect(identity.pubkey).toMatch(/^[0-9a-f]{64}$/);
      expect(identity.evmAddress).toMatch(/^0x/);
    });
  });

  describe('HandlerContext contract', () => {
    it('createMockHandlerContext returns object with required properties and methods', async () => {
      const { createMockHandlerContext } = await import('@crosstown/sdk');
      const ctx = createMockHandlerContext();

      // Required properties
      expect(ctx).toHaveProperty('kind');
      expect(ctx).toHaveProperty('pubkey');
      expect(ctx).toHaveProperty('amount');
      expect(ctx).toHaveProperty('destination');
      expect(ctx).toHaveProperty('toon');

      // Required methods
      expect(typeof ctx.decode).toBe('function');
      expect(typeof ctx.accept).toBe('function');
      expect(typeof ctx.reject).toBe('function');

      // Method return shapes
      const accepted = ctx.accept({ eventId: 'test' });
      expect(accepted).toHaveProperty('accepted', true);

      const rejected = ctx.reject('F06', 'Invalid content');
      expect(rejected).toHaveProperty('accepted', false);
      expect(rejected).toHaveProperty('code', 'F06');
      expect(rejected).toHaveProperty('message', 'Invalid content');
    });
  });

  describe('Identity derivation contract', () => {
    it('fromSecretKey returns { pubkey, evmAddress }', async () => {
      const { fromSecretKey } = await import('@crosstown/sdk');
      const identity = fromSecretKey(new Uint8Array(32).fill(1));
      expect(identity).toHaveProperty('pubkey');
      expect(identity).toHaveProperty('evmAddress');
      expect(identity.pubkey).toHaveLength(64);
      expect(identity.pubkey).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
