/**
 * Wallet Balance Integration Tests
 * Story 2.2: Action Cost Registry & Wallet Balance
 *
 * These tests require Docker stack running:
 * - docker compose -f docker/docker-compose.yml up -d
 *
 * If Crosstown balance API is not yet implemented (Story 2.2 timeframe),
 * tests will verify stub mode behavior. Full API validation deferred to Story 2.5.
 *
 * @integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SigilClient } from '../../client';
import { generateKeypair } from '../../nostr/keypair';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Wallet Balance Integration Tests', () => {
  let crosstownHealthy = false;
  let tempDir: string;

  beforeAll(async () => {
    // Check Crosstown connector health
    try {
      const response = await fetch('http://localhost:4041/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        crosstownHealthy = true;
      }
    } catch (error) {
      console.warn(
        'Crosstown connector not available. Skipping wallet balance integration tests.',
        error instanceof Error ? error.message : error
      );
    }

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-integration-'));
  });

  afterAll(() => {
    // Clean up temporary directory
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    if (!crosstownHealthy) {
      console.warn('Skipping test: Crosstown connector not healthy');
    }
  });

  it('queries wallet balance from real Crosstown connector (AC4)', async () => {
    if (!crosstownHealthy) {
      console.warn('Test skipped: Crosstown connector not healthy');
      console.warn(
        'To run this test, start Docker stack: docker compose -f docker/docker-compose.yml up -d'
      );
      return;
    }

    // Create test identity
    const keypairPath = path.join(tempDir, 'test-keypair.json');
    const keypair = await generateKeypair();
    const { saveKeypair } = await import('../../nostr/storage');
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    // Create client
    const client = new SigilClient({
      crosstownConnectorUrl: 'http://localhost:4041',
    });

    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Query balance
    try {
      const balance = await client.wallet.getBalance();

      // If we get here, the API is implemented
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(balance)).toBe(true);
    } catch (error) {
      // If 404, verify stub mode activated
      if (error instanceof Error && error.message.includes('not available')) {
        expect(client.wallet.isStubMode()).toBe(true);
        console.warn(
          'Crosstown balance API returned 404. Stub mode activated. Full integration deferred to Story 2.5.'
        );
      } else {
        throw error;
      }
    }
  });

  it('activates stub mode on 404 response (AC4)', async () => {
    if (!crosstownHealthy) {
      console.warn('Test skipped: Crosstown connector not healthy');
      return;
    }

    // Create test identity
    const keypairPath = path.join(tempDir, 'test-keypair-2.json');
    const keypair = await generateKeypair();
    const { saveKeypair } = await import('../../nostr/storage');
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    // Create client
    const client = new SigilClient({
      crosstownConnectorUrl: 'http://localhost:4041',
    });

    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Query balance
    const balance = await client.wallet.getBalance();

    // Either real balance or stub balance
    if (client.wallet.isStubMode()) {
      expect(balance).toBe(10000); // Stub balance
      console.warn('Stub mode activated (expected if Crosstown API not implemented)');
    } else {
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
      console.log('Real balance retrieved:', balance);
    }
  });

  it('completes balance query within 500ms (AC4)', async () => {
    if (!crosstownHealthy) {
      console.warn('Test skipped: Crosstown connector not healthy');
      return;
    }

    // Create test identity
    const keypairPath = path.join(tempDir, 'test-keypair-3.json');
    const keypair = await generateKeypair();
    const { saveKeypair } = await import('../../nostr/storage');
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    // Create client
    const client = new SigilClient({
      crosstownConnectorUrl: 'http://localhost:4041',
    });

    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Measure performance
    const start = performance.now();
    await client.wallet.getBalance();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });

  it('verifies balance accuracy (AC5)', async () => {
    if (!crosstownHealthy) {
      console.warn('Test skipped: Crosstown connector not healthy');
      return;
    }

    // Create test identity
    const keypairPath = path.join(tempDir, 'test-keypair-4.json');
    const keypair = await generateKeypair();
    const { saveKeypair } = await import('../../nostr/storage');
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    // Create client
    const client = new SigilClient({
      crosstownConnectorUrl: 'http://localhost:4041',
    });

    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Query balance twice
    const balance1 = await client.wallet.getBalance();
    const balance2 = await client.wallet.getBalance();

    // Balance should be consistent (no phantom funds)
    expect(balance1).toBe(balance2);

    // Balance should be non-negative
    expect(balance1).toBeGreaterThanOrEqual(0);
  });

  it('integrates with canAfford API (AC6)', async () => {
    if (!crosstownHealthy) {
      console.warn('Test skipped: Crosstown connector not healthy');
      return;
    }

    // Create test cost registry
    const registryPath = path.join(tempDir, 'test-registry.json');
    fs.writeFileSync(
      registryPath,
      JSON.stringify({
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1, category: 'movement', frequency: 'high' },
          expensive_action: { cost: 1000000, category: 'crafting', frequency: 'low' },
        },
      })
    );

    // Create test identity
    const keypairPath = path.join(tempDir, 'test-keypair-5.json');
    const keypair = await generateKeypair();
    const { saveKeypair } = await import('../../nostr/storage');
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    // Create client
    const client = new SigilClient({
      actionCostRegistryPath: registryPath,
      crosstownConnectorUrl: 'http://localhost:4041',
    });

    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Check affordability
    const canAffordCheap = await client.publish.canAfford('player_move');
    const canAffordExpensive = await client.publish.canAfford('expensive_action');

    // Should be able to afford cheap action (cost 1)
    expect(canAffordCheap).toBe(true);

    // Unlikely to afford very expensive action (cost 1000000)
    // Note: If stub mode, balance is 10000, so cannot afford
    expect(canAffordExpensive).toBe(false);
  });
});
