/**
 * SigilClient Publish API Tests
 * Story 2.2: Action Cost Registry & Wallet Balance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SigilClient } from './client';
import { SigilError } from './nostr/nostr-client';
import type { ActionCostRegistry } from './publish/action-cost-registry';

describe('SigilClient - Cost Registry Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('loads cost registry at instantiation (AC1)', () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    expect(() => {
      new SigilClient({ actionCostRegistryPath: registryPath });
    }).not.toThrow();
  });

  it('throws error from constructor if registry loading fails (AC1)', () => {
    const registryPath = path.join(tempDir, 'nonexistent.json');

    expect(() => {
      new SigilClient({ actionCostRegistryPath: registryPath });
    }).toThrow('Failed to read action cost registry file');
  });

  it('sets registry to null if path not provided (AC1)', () => {
    const client = new SigilClient();

    expect(() => client.publish.getCost('player_move')).toThrow('Action cost registry not loaded');
  });

  it('getCost returns correct cost for known action (AC2)', () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
        craft_item: { cost: 15, category: 'crafting', frequency: 'medium' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    const client = new SigilClient({ actionCostRegistryPath: registryPath });

    expect(client.publish.getCost('player_move')).toBe(1);
    expect(client.publish.getCost('craft_item')).toBe(15);
  });

  it('getCost returns defaultCost for unknown action with warning (AC3)', () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    const client = new SigilClient({ actionCostRegistryPath: registryPath });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const cost = client.publish.getCost('unknown_action');

    expect(cost).toBe(10);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Action "unknown_action" not found in cost registry')
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('defaultCost: 10'));

    consoleWarnSpy.mockRestore();
  });

  it('getCost completes in <10ms (AC2)', () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    const client = new SigilClient({ actionCostRegistryPath: registryPath });

    // Measure getCost performance
    const start = performance.now();
    client.publish.getCost('player_move');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10);
  });

  it('throws REGISTRY_NOT_LOADED if registry not configured (AC3)', () => {
    const client = new SigilClient();

    expect(() => client.publish.getCost('player_move')).toThrow('Action cost registry not loaded');
    expect(() => client.publish.getCost('player_move')).toThrow(SigilError);
  });
});

describe('SigilClient - Wallet Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-test-'));
    delete process.env.SIGIL_WALLET_STUB;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('throws error if identity not loaded when accessing wallet (AC4)', () => {
    const client = new SigilClient();

    expect(() => client.wallet).toThrow('Identity not loaded. Call loadIdentity() first.');
  });

  it('initializes wallet client lazily with identity (AC4)', async () => {
    // Create a test keypair file
    const keypairPath = path.join(tempDir, 'keypair.json');
    const { generateKeypair } = await import('./nostr/keypair');
    const { saveKeypair } = await import('./nostr/storage');

    const keypair = await generateKeypair();
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    const client = new SigilClient({ crosstownConnectorUrl: 'http://localhost:4041' });
    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Mock fetch for wallet balance
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ balance: 10000 }),
    });

    const balance = await client.wallet.getBalance();

    expect(balance).toBe(10000);
  });

  it('uses default Crosstown URL if not provided (AC4)', async () => {
    // Create a test keypair file
    const keypairPath = path.join(tempDir, 'keypair.json');
    const { generateKeypair } = await import('./nostr/keypair');
    const { saveKeypair } = await import('./nostr/storage');

    const keypair = await generateKeypair();
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    const client = new SigilClient(); // No crosstownConnectorUrl
    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Mock fetch for wallet balance
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ balance: 10000 }),
    });

    const balance = await client.wallet.getBalance();

    expect(balance).toBe(10000);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:4041'),
      expect.anything()
    );
  });
});

describe('SigilClient - canAfford Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-test-'));
    delete process.env.SIGIL_WALLET_STUB;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns true if balance >= cost (AC6)', async () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // Create a test keypair file
    const keypairPath = path.join(tempDir, 'keypair.json');
    const { generateKeypair } = await import('./nostr/keypair');
    const { saveKeypair } = await import('./nostr/storage');

    const keypair = await generateKeypair();
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    const client = new SigilClient({
      actionCostRegistryPath: registryPath,
      crosstownConnectorUrl: 'http://localhost:4041',
    });
    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Mock fetch for wallet balance
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ balance: 10000 }),
    });

    const canAfford = await client.publish.canAfford('player_move');

    expect(canAfford).toBe(true);
  });

  it('returns false if balance < cost (AC6)', async () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        expensive_action: { cost: 100000, category: 'crafting', frequency: 'low' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // Create a test keypair file
    const keypairPath = path.join(tempDir, 'keypair.json');
    const { generateKeypair } = await import('./nostr/keypair');
    const { saveKeypair } = await import('./nostr/storage');

    const keypair = await generateKeypair();
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    const client = new SigilClient({
      actionCostRegistryPath: registryPath,
      crosstownConnectorUrl: 'http://localhost:4041',
    });
    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Mock fetch for wallet balance (low balance)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ balance: 100 }),
    });

    const canAfford = await client.publish.canAfford('expensive_action');

    expect(canAfford).toBe(false);
  });

  it('propagates error if getCost throws (AC6)', async () => {
    const client = new SigilClient(); // No registry

    await expect(client.publish.canAfford('player_move')).rejects.toThrow(
      'Action cost registry not loaded'
    );
  });

  it('propagates error if getBalance throws (AC6)', async () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // Create a test keypair file
    const keypairPath = path.join(tempDir, 'keypair.json');
    const { generateKeypair } = await import('./nostr/keypair');
    const { saveKeypair } = await import('./nostr/storage');

    const keypair = await generateKeypair();
    await saveKeypair(keypair, 'test-passphrase-12345', keypairPath);

    const client = new SigilClient({
      actionCostRegistryPath: registryPath,
      crosstownConnectorUrl: 'http://localhost:4041',
    });
    await client.loadIdentity('test-passphrase-12345', keypairPath);

    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(client.publish.canAfford('player_move')).rejects.toThrow('Network error');
  });
});
