/**
 * Story 2.5 Acceptance Criteria Coverage Tests
 * @crosstown/client Integration & Scaffolding Removal
 *
 * This file covers acceptance criteria that are NOT already tested in the
 * dedicated test files. It focuses on:
 * - AC1: Dependency verification (package.json checks)
 * - AC4: File deletion verification (scaffolding removed)
 * - AC5: WalletClient retention (regression)
 * - AC7: Test file existence verification
 *
 * AC2 (template construction, adapter delegation) is covered by:
 *   - ilp-packet.test.ts
 *   - crosstown-adapter.test.ts
 *
 * AC3 (lifecycle) is covered by:
 *   - crosstown-adapter.test.ts
 *   - client-publish-adapter.test.ts
 *
 * AC4 (error code preservation) is covered by:
 *   - crosstown-adapter.test.ts (mapError direct tests)
 *
 * AC6 (signing guarantees, FR4/FR5) is covered by:
 *   - crosstown-adapter.test.ts (identity accessors, publish result pubkey)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { SigilClient } from '../client';
import { generateKeypair } from '../nostr/keypair';
import { saveKeypair } from '../nostr/storage';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Locate package.json relative to the test file
const packageJsonPath = resolve(__dirname, '../../package.json');

describe('Story 2.5 - AC1: @crosstown/client and @crosstown/relay are production dependencies', () => {
  it('should have @crosstown/client listed in dependencies (not devDependencies)', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies['@crosstown/client']).toBeDefined();
    expect(pkg.dependencies['@crosstown/client']).toMatch(/\^?0\.4\.2/);

    // Must NOT be in devDependencies
    if (pkg.devDependencies) {
      expect(pkg.devDependencies['@crosstown/client']).toBeUndefined();
    }
  });

  it('should have @crosstown/relay listed in dependencies (not devDependencies)', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies['@crosstown/relay']).toBeDefined();
    expect(pkg.dependencies['@crosstown/relay']).toMatch(/\^?0\.4\.2/);

    // Must NOT be in devDependencies
    if (pkg.devDependencies) {
      expect(pkg.devDependencies['@crosstown/relay']).toBeUndefined();
    }
  });

  it('should be importable at runtime (TypeScript types resolve)', async () => {
    // Verify that imports from @crosstown/client resolve
    const crosstownClient = await import('@crosstown/client');
    expect(crosstownClient.CrosstownClient).toBeDefined();
    expect(crosstownClient.CrosstownError).toBeDefined();

    // Verify that imports from @crosstown/relay resolve
    const crosstownRelay = await import('@crosstown/relay');
    expect(crosstownRelay.encodeEventToToon).toBeDefined();
    expect(crosstownRelay.decodeEventFromToon).toBeDefined();
  });
});

describe('Story 2.5 - AC4: Custom scaffolding is removed', () => {
  describe('Deleted files', () => {
    it('should have deleted event-signing.ts', () => {
      const filePath = resolve(__dirname, './event-signing.ts');
      expect(existsSync(filePath)).toBe(false);
    });

    it('should have deleted event-signing.test.ts', () => {
      const filePath = resolve(__dirname, './event-signing.test.ts');
      expect(existsSync(filePath)).toBe(false);
    });

    it('should have deleted crosstown-connector.ts', () => {
      const filePath = resolve(__dirname, '../crosstown/crosstown-connector.ts');
      expect(existsSync(filePath)).toBe(false);
    });

    it('should have deleted crosstown-connector.test.ts', () => {
      const filePath = resolve(__dirname, '../crosstown/crosstown-connector.test.ts');
      expect(existsSync(filePath)).toBe(false);
    });
  });

  describe('Exports updated correctly', () => {
    it('should export CrosstownAdapter from the package', async () => {
      const clientModule = await import('../index');
      expect(clientModule.CrosstownAdapter).toBeDefined();
      expect(typeof clientModule.CrosstownAdapter).toBe('function');
    });

    it('should NOT export CrosstownConnector from the package', async () => {
      const clientModule = await import('../index');
      expect((clientModule as any).CrosstownConnector).toBeUndefined();
    });

    it('should NOT export signEvent from the package', async () => {
      const clientModule = await import('../index');
      expect((clientModule as any).signEvent).toBeUndefined();
    });

    it('should NOT export redactPrivateKey from the package', async () => {
      const clientModule = await import('../index');
      expect((clientModule as any).redactPrivateKey).toBeUndefined();
    });

    it('SigilClient should have crosstownAdapter field, not crosstownConnector', () => {
      const client = new SigilClient({
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      expect(client).toHaveProperty('crosstownAdapter');
      expect(client).not.toHaveProperty('crosstownConnector');
    });

    it('should still export parseILPPacket and extractFeeFromEvent (unchanged utilities)', async () => {
      const clientModule = await import('../index');
      expect(clientModule.parseILPPacket).toBeDefined();
      expect(typeof clientModule.parseILPPacket).toBe('function');
      expect(clientModule.extractFeeFromEvent).toBeDefined();
      expect(typeof clientModule.extractFeeFromEvent).toBe('function');
    });

    it('should still export constructILPPacket (function name preserved for API stability)', async () => {
      const clientModule = await import('../index');
      expect(clientModule.constructILPPacket).toBeDefined();
      expect(typeof clientModule.constructILPPacket).toBe('function');
    });
  });

  describe('New adapter file exists', () => {
    it('should have crosstown-adapter.ts file', () => {
      const filePath = resolve(__dirname, '../crosstown/crosstown-adapter.ts');
      expect(existsSync(filePath)).toBe(true);
    });
  });
});

describe('Story 2.5 - AC5: Wallet balance query retains WalletClient', () => {
  let testDir: string;
  let identityPath: string;
  let registryPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `sigil-ac5-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    identityPath = join(testDir, 'identity.json');
    registryPath = join(testDir, 'costs.json');
    mkdirSync(testDir, { recursive: true });

    const keypair = await generateKeypair();
    await saveKeypair(keypair, 'test-passphrase', identityPath);

    const registry = {
      version: 1,
      defaultCost: 10,
      actions: { player_move: { cost: 1, category: 'movement', frequency: 'high' } },
    };
    writeFileSync(registryPath, JSON.stringify(registry));
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    vi.restoreAllMocks();
  });

  it('should export WalletClient from the package (retained, not replaced)', async () => {
    const clientModule = await import('../index');
    expect(clientModule.WalletClient).toBeDefined();
  });

  it('client.publish.canAfford() should work correctly after Story 2.5 refactoring', async () => {
    // Mock fetch to return a balance
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ balance: 50 }),
    });

    const client = new SigilClient({
      actionCostRegistryPath: registryPath,
      crosstownConnectorUrl: 'http://localhost:4041',
    });

    await client.loadIdentity('test-passphrase', identityPath);

    // canAfford uses WalletClient internally
    const canAffordMove = await client.publish.canAfford('player_move'); // cost=1, balance=50
    expect(canAffordMove).toBe(true);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ balance: 0 }),
    });

    const canAffordWithZero = await client.publish.canAfford('player_move'); // cost=1, balance=0
    expect(canAffordWithZero).toBe(false);
  });

  it('client.publish.getCost() should work correctly after Story 2.5 refactoring', async () => {
    const client = new SigilClient({
      actionCostRegistryPath: registryPath,
      crosstownConnectorUrl: 'http://localhost:4041',
    });

    // getCost does not require identity or connection
    const cost = client.publish.getCost('player_move');
    expect(cost).toBe(1);
  });
});

describe('Story 2.5 - AC7: All tests updated for new adapter behavior', () => {
  it('crosstown-adapter.test.ts should exist (replaces crosstown-connector.test.ts)', () => {
    const adapterTestPath = resolve(__dirname, '../crosstown/crosstown-adapter.test.ts');
    expect(existsSync(adapterTestPath)).toBe(true);
  });

  it('crosstown-connector.test.ts should NOT exist (deleted scaffolding test)', () => {
    const connectorTestPath = resolve(__dirname, '../crosstown/crosstown-connector.test.ts');
    expect(existsSync(connectorTestPath)).toBe(false);
  });

  it('event-signing.test.ts should NOT exist (deleted scaffolding test)', () => {
    const signingTestPath = resolve(__dirname, './event-signing.test.ts');
    expect(existsSync(signingTestPath)).toBe(false);
  });

  it('client-publish-adapter.test.ts should exist (ATDD tests un-skipped)', () => {
    const adapterWiringTestPath = resolve(__dirname, './client-publish-adapter.test.ts');
    expect(existsSync(adapterWiringTestPath)).toBe(true);
  });

  it('crosstown-adapter.integration.test.ts should exist (integration test created)', () => {
    const integrationTestPath = resolve(
      __dirname,
      '../integration-tests/crosstown-adapter.integration.test.ts'
    );
    expect(existsSync(integrationTestPath)).toBe(true);
  });
});
