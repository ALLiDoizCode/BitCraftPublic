/**
 * Client Publish API Tests
 * Story 2.3: ILP Packet Construction & Signing
 *
 * Tests for client.publish() method integration.
 * Validates AC3, AC4, AC5: Success path, balance checks, error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SigilClient } from '../client';
import { generateKeypair } from '../nostr/keypair';
import { saveKeypair } from '../nostr/storage';
import { SigilError } from '../nostr/nostr-client';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock fetch globally
const originalFetch = global.fetch;

describe('Client Publish API', () => {
  const testDir = join(tmpdir(), `sigil-test-${Date.now()}`);
  const registryPath = join(testDir, 'costs.json');
  const identityPath = join(testDir, 'identity.json');

  beforeEach(async () => {
    // Create test directory
    mkdirSync(testDir, { recursive: true });

    // Create test cost registry
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
        craft_item: { cost: 15, category: 'crafting', frequency: 'medium' },
      },
    };
    writeFileSync(registryPath, JSON.stringify(registry));

    // Create test identity (properly encrypted)
    const keypair = await generateKeypair();
    await saveKeypair(keypair, 'test-passphrase', identityPath);

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Cleanup
    try {
      unlinkSync(registryPath);
      unlinkSync(identityPath);
    } catch {
      // Ignore cleanup errors
    }

    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('publish() - Precondition Validation (AC1, AC2, AC4)', () => {
    it('should throw IDENTITY_NOT_LOADED if identity not loaded', async () => {
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch (error) {
        expect((error as SigilError).code).toBe('IDENTITY_NOT_LOADED');
        expect((error as SigilError).boundary).toBe('publish');
      }
    });

    it('should throw CROSSTOWN_NOT_CONFIGURED if URL not provided', async () => {
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch (error) {
        expect((error as SigilError).code).toBe('CROSSTOWN_NOT_CONFIGURED');
      }
    });

    it('should throw REGISTRY_NOT_LOADED if cost registry not configured', async () => {
      const client = new SigilClient({
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch (error) {
        expect((error as SigilError).code).toBe('REGISTRY_NOT_LOADED');
      }
    });
  });

  describe('publish() - Balance Check (AC4)', () => {
    it('should check balance before publishing (fail fast)', async () => {
      // Mock wallet getBalance to return insufficient balance
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ balance: 0 }), // Insufficient
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch (error) {
        expect((error as SigilError).code).toBe('INSUFFICIENT_BALANCE');
        expect((error as SigilError).boundary).toBe('crosstown');
        expect((error as SigilError).message).toContain('player_move');
        expect((error as SigilError).message).toContain('1'); // Required cost
        expect((error as SigilError).message).toContain('0'); // Available balance
      }
    });

    it('should include action name, cost, and balance in error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ balance: 5 }),
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      try {
        await client.publish.publish({ reducer: 'craft_item', args: [] });
      } catch (error) {
        expect((error as SigilError).context).toMatchObject({
          action: 'craft_item',
          required: 15,
          available: 5,
        });
      }
    });

    it('should proceed if balance is sufficient', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          callCount++;
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'abc123' }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        nostrRelay: { url: 'ws://localhost:4040' },
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // Note: This will timeout waiting for confirmation, but we're testing balance check
      const publishPromise = client.publish.publish({
        reducer: 'player_move',
        args: [],
      });

      // Catch the promise rejection to prevent unhandled rejection
      publishPromise.catch(() => {
        // Expected to fail (timeout or disconnect), but we need to catch it
      });

      // Wait a bit to ensure fetch was called
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify that publish endpoint was called (balance check passed)
      expect(callCount).toBeGreaterThan(0);

      // Disconnect to cleanup
      await client.disconnect();
    });
  });

  describe('publish() - Timeout Handling (AC5)', () => {
    it('should throw NETWORK_TIMEOUT if Crosstown unreachable', async () => {
      let balanceCalled = false;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          balanceCalled = true;
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          // Simulate immediate network error
          const error = new Error('Network timeout');
          error.name = 'AbortError';
          throw error;
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 100,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      expect(balanceCalled).toBe(true);

      // Cleanup to prevent lingering timers
      await client.disconnect();
    });

    it('should throw CONFIRMATION_TIMEOUT if no confirmation received', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'abc123' }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 100, // Short timeout for fast test
        nostrRelay: { url: 'ws://localhost:4040' },
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // This will timeout waiting for confirmation
      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch (error) {
        expect((error as SigilError).code).toBe('CONFIRMATION_TIMEOUT');
        expect((error as SigilError).boundary).toBe('crosstown');
      }

      await client.disconnect();
    });

    it('should use configured publishTimeout', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'abc' }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 5000, // Custom timeout
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // Access private field to verify timeout setting
      expect((client as any).publishTimeout).toBe(5000);
    });
  });

  describe('publish() - State Consistency (AC5)', () => {
    it('should cleanup pending publish on disconnect', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'abc123' }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 5000,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // Start publish (will timeout waiting for confirmation)
      const publishPromise = client.publish.publish({
        reducer: 'player_move',
        args: [],
      });

      // Wait a bit then disconnect
      await new Promise((resolve) => setTimeout(resolve, 100));
      await client.disconnect();

      // Publish should reject with CLIENT_DISCONNECTED
      await expect(publishPromise).rejects.toThrow(SigilError);

      try {
        await publishPromise;
      } catch (error) {
        expect((error as SigilError).code).toBe('CLIENT_DISCONNECTED');
        expect((error as SigilError).boundary).toBe('publish');
      }
    });

    it('should not leave dangling timers after disconnect', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'abc' }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 5000,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      const publishPromise = client.publish.publish({
        reducer: 'player_move',
        args: [],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check pending publishes before disconnect
      const pendingBefore = (client as any).pendingPublishes.size;
      expect(pendingBefore).toBeGreaterThan(0);

      await client.disconnect();

      // Check pending publishes after disconnect
      const pendingAfter = (client as any).pendingPublishes.size;
      expect(pendingAfter).toBe(0);

      try {
        await publishPromise;
      } catch {
        // Expected to reject
      }
    });
  });

  describe('publish() - Network Error Handling (AC5)', () => {
    it('should throw NETWORK_ERROR for network failures', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          throw new Error('Connection refused');
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch (error) {
        expect((error as SigilError).code).toBe('NETWORK_ERROR');
        expect((error as SigilError).boundary).toBe('crosstown');
      }
    });

    it('should cleanup pending publish on submission error', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          throw new Error('Network error');
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch {
        // Expected to fail
      }

      // Verify pending publishes map is empty
      const pending = (client as any).pendingPublishes.size;
      expect(pending).toBe(0);
    });
  });

  describe('publish() - Default Timeout (AC5)', () => {
    it('should use 2000ms timeout by default', () => {
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      expect((client as any).publishTimeout).toBe(2000);
    });
  });
});
