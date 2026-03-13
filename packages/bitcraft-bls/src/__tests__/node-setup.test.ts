/**
 * Node Setup Tests (AC: 1, 2)
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Tests for createBLSNode() function that wraps @crosstown/sdk createNode()
 * with embedded connector mode, identity derivation, and configuration.
 *
 * Validates: AC1 (SDK dependency), AC2 (embedded connector mode), OWASP A02
 *
 * Test count: 12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBLSConfig } from './factories/bls-config.factory.js';
import { createFixedTestSecretKeyHex } from './factories/identity.factory.js';

// Mock @crosstown/sdk at module boundary
vi.mock('@crosstown/sdk', () => ({
  createNode: vi.fn(() => ({
    start: vi.fn().mockResolvedValue({ peerCount: 1, channelCount: 1, bootstrapResults: [] }),
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    identity: { pubkey: 'ab'.repeat(32), evmAddress: '0x' + 'ab'.repeat(20) },
    started: false,
    inFlightCount: 0,
    hasHandler: vi.fn().mockReturnValue(false),
    dispatch: vi.fn(),
  })),
  fromSecretKey: vi.fn(() => ({
    pubkey: 'ab'.repeat(32),
    evmAddress: '0x' + 'ab'.repeat(20),
  })),
  fromMnemonic: vi.fn(() => ({
    pubkey: 'cd'.repeat(32),
    evmAddress: '0x' + 'cd'.repeat(20),
    secretKey: new Uint8Array(32).fill(0xcd),
  })),
  generateMnemonic: vi.fn(
    () =>
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  ),
}));

describe('Node Setup (Story 3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls createNode with embedded connector config (not connectorUrl)', async () => {
    const { createBLSNode } = await import('../node.js');
    const { createNode } = await import('@crosstown/sdk');

    const config = createBLSConfig();
    createBLSNode(config);

    expect(createNode).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(createNode).mock.calls[0][0];
    expect(callArgs).toHaveProperty('connector');
    expect(callArgs).not.toHaveProperty('connectorUrl');
  });

  it('parses secretKey from hex string to Uint8Array', async () => {
    const { createBLSNode } = await import('../node.js');
    const { createNode } = await import('@crosstown/sdk');

    const secretKeyHex = createFixedTestSecretKeyHex();
    const config = createBLSConfig({ secretKey: secretKeyHex });
    createBLSNode(config);

    const callArgs = vi.mocked(createNode).mock.calls[0][0];
    expect(callArgs.secretKey).toBeInstanceOf(Uint8Array);
    expect(callArgs.secretKey.length).toBe(32);
  });

  it('converts hex secretKey to correct Uint8Array values', async () => {
    const { createBLSNode } = await import('../node.js');
    const { createNode } = await import('@crosstown/sdk');

    const config = createBLSConfig({ secretKey: 'ab'.repeat(32) });
    createBLSNode(config);

    const callArgs = vi.mocked(createNode).mock.calls[0][0];
    expect(callArgs.secretKey).toEqual(new Uint8Array(32).fill(0xab));
  });

  it('generates mnemonic when no secretKey provided', async () => {
    const { createBLSNode } = await import('../node.js');
    const { generateMnemonic, fromMnemonic } = await import('@crosstown/sdk');

    const config = createBLSConfig({ secretKey: undefined });
    createBLSNode(config);

    expect(generateMnemonic).toHaveBeenCalledOnce();
    expect(fromMnemonic).toHaveBeenCalledOnce();
  });

  it('derives identity from mnemonic via NIP-06 path', async () => {
    const { createBLSNode } = await import('../node.js');
    const { fromMnemonic, generateMnemonic } = await import('@crosstown/sdk');

    const config = createBLSConfig({ secretKey: undefined });
    createBLSNode(config);

    const mnemonic = vi.mocked(generateMnemonic).mock.results[0].value;
    expect(fromMnemonic).toHaveBeenCalledWith(mnemonic);
  });

  it('uses fromSecretKey when secretKey is provided', async () => {
    const { createBLSNode } = await import('../node.js');
    const { fromSecretKey, generateMnemonic } = await import('@crosstown/sdk');

    const config = createBLSConfig({ secretKey: 'ab'.repeat(32) });
    createBLSNode(config);

    expect(fromSecretKey).toHaveBeenCalledOnce();
    expect(generateMnemonic).not.toHaveBeenCalled();
  });

  it('configures ILP address from config', async () => {
    const { createBLSNode } = await import('../node.js');
    const { createNode } = await import('@crosstown/sdk');

    const config = createBLSConfig({ ilpAddress: 'g.crosstown.custom' });
    createBLSNode(config);

    const callArgs = vi.mocked(createNode).mock.calls[0][0];
    expect(callArgs.ilpAddress).toBe('g.crosstown.custom');
  });

  it('configures kindPricing with 30078 kind', async () => {
    const { createBLSNode } = await import('../node.js');
    const { createNode } = await import('@crosstown/sdk');

    const config = createBLSConfig();
    createBLSNode(config);

    const callArgs = vi.mocked(createNode).mock.calls[0][0];
    expect(callArgs.kindPricing).toEqual({ 30078: 100n });
  });

  it('returns node, identity, and config from createBLSNode', async () => {
    const { createBLSNode } = await import('../node.js');

    const config = createBLSConfig();
    const result = createBLSNode(config);

    expect(result).toHaveProperty('node');
    expect(result).toHaveProperty('identity');
    expect(result).toHaveProperty('config');
    expect(result.identity).toHaveProperty('pubkey');
    expect(result.identity).toHaveProperty('evmAddress');
    expect(result.identity.pubkey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('identity matches derived pubkey from fromSecretKey', async () => {
    const { createBLSNode } = await import('../node.js');

    const config = createBLSConfig({ secretKey: 'ab'.repeat(32) });
    const result = createBLSNode(config);

    // fromSecretKey mock returns 'ab'.repeat(32) as pubkey
    expect(result.identity.pubkey).toBe('ab'.repeat(32));
    expect(result.identity.evmAddress).toBe('0x' + 'ab'.repeat(20));
  });

  it('never logs secretKey in startup output (OWASP A02)', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { createBLSNode } = await import('../node.js');
    const secretKeyHex = 'deadbeef'.repeat(8); // 64 chars, recognizable
    const config = createBLSConfig({ secretKey: secretKeyHex });
    createBLSNode(config);

    const allLogCalls = consoleSpy.mock.calls.map((c) => c.join(' '));
    for (const logLine of allLogCalls) {
      expect(logLine).not.toContain(secretKeyHex);
      expect(logLine).not.toContain('deadbeef');
    }
  });

  it('never logs SPACETIMEDB_TOKEN in startup output (OWASP A02)', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { createBLSNode } = await import('../node.js');
    const config = createBLSConfig({ spacetimedbToken: 'super-secret-admin-token' });
    createBLSNode(config);

    const allLogCalls = consoleSpy.mock.calls.map((c) => c.join(' '));
    for (const logLine of allLogCalls) {
      expect(logLine).not.toContain('super-secret-admin-token');
    }
  });
});
