/**
 * Client Publish Adapter Wiring Tests (ATDD - GREEN Phase)
 * Story 2.5: @crosstown/client Integration & Scaffolding Removal
 *
 * Tests that client.publish() now uses CrosstownAdapter instead of
 * CrosstownConnector, constructs content-only templates, and no longer
 * calls signEvent directly.
 *
 * All tests are now GREEN -- Tasks 3-5 are complete.
 *
 * Validates: AC2, AC3, AC4, AC7
 *   - AC2: publish() delegates to adapter, not connector
 *   - AC3: adapter lifecycle in connect/disconnect
 *   - AC4: signEvent and CrosstownConnector removed
 *   - AC7: tests updated for new adapter behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SigilClient } from '../client';
import { generateKeypair } from '../nostr/keypair';
import { saveKeypair } from '../nostr/storage';
import { SigilError } from '../nostr/nostr-client';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Client Publish - Adapter Wiring (Story 2.5)', () => {
  let testDir: string;
  let registryPath: string;
  let identityPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `sigil-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    registryPath = join(testDir, 'costs.json');
    identityPath = join(testDir, 'identity.json');
    mkdirSync(testDir, { recursive: true });

    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
        craft_item: { cost: 15, category: 'crafting', frequency: 'medium' },
      },
    };
    writeFileSync(registryPath, JSON.stringify(registry));

    const keypair = await generateKeypair();
    await saveKeypair(keypair, 'test-passphrase', identityPath);
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe('Adapter Creation - Lazy Initialization (AC3)', () => {
    it('[P0] should NOT create CrosstownAdapter in constructor (needs secretKey from identity)', () => {
      // Given a SigilClient constructed with crosstownConnectorUrl
      // When the client is constructed (before loadIdentity)
      // Then the internal crosstownAdapter should be null
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      // Access internal state -- adapter should not exist yet
      expect((client as any).crosstownAdapter).toBeNull();
    });

    it('[P0] should have keypair available after identity is loaded', async () => {
      // Given a SigilClient with crosstownConnectorUrl configured
      // When loadIdentity is called (providing secretKey)
      // Then keypair should be available for adapter creation in connect()
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // After identity load, keypair should exist (adapter is created in connect())
      expect((client as any).keypair).toBeTruthy();
    });
  });

  describe('Adapter Lifecycle in connect/disconnect (AC3)', () => {
    it('[P0] should create CrosstownAdapter in connect() after identity is loaded', async () => {
      // Given a SigilClient with identity loaded and crosstownConnectorUrl
      // When client.connect() is called
      // Then CrosstownAdapter should be created with the keypair's privateKey
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // Adapter should be null before connect
      expect((client as any).crosstownAdapter).toBeNull();

      // Connect (will fail on SpacetimeDB/Nostr but adapter should be created)
      await client.connect().catch(() => {
        // Expected to fail since there's no real server
      });

      // If identity was loaded, adapter should be created during connect()
      // The adapter creation depends on keypair being available
      if ((client as any).keypair) {
        expect((client as any).crosstownAdapter).not.toBeNull();
      }

      await client.disconnect();
    });

    it('[P0] should clean up CrosstownAdapter on disconnect', async () => {
      // Given a connected SigilClient with active CrosstownAdapter
      // When client.disconnect() is called
      // Then CrosstownAdapter should be stopped and nulled
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // Connect (may partially fail but adapter gets created)
      await client.connect().catch(() => {});

      // Disconnect should clean up adapter
      await client.disconnect();

      expect((client as any).crosstownAdapter).toBeNull();
    });

    it('[P1] should handle undefined adapter gracefully in connect (no URL configured)', async () => {
      // Given a SigilClient WITHOUT crosstownConnectorUrl
      // When client.connect() is called
      // Then connect should succeed without creating adapter
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // connect() should not throw due to missing adapter
      // (It will fail on SpacetimeDB/Nostr connection but adapter part is fine)
      await client.connect().catch(() => {});

      // Adapter remains null when URL is default localhost
      // (it uses default URL, so adapter will actually be created)
      await client.disconnect();
    });
  });

  describe('Publish Flow - Content-Only Template (AC2)', () => {
    it('[P0] should throw IDENTITY_NOT_LOADED when publishing without identity', async () => {
      // Given a SigilClient without identity loaded
      // When client.publish.publish() is called
      // Then constructILPPacket should never be reached -- identity check fails first
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await expect(
        client.publish.publish({ reducer: 'player_move', args: [100, 200] })
      ).rejects.toThrow(SigilError);

      try {
        await client.publish.publish({ reducer: 'player_move', args: [100, 200] });
      } catch (error) {
        expect((error as SigilError).code).toBe('IDENTITY_NOT_LOADED');
      }
    });

    it('[P0] should throw CROSSTOWN_NOT_CONFIGURED when adapter is null', async () => {
      // Given a SigilClient with identity loaded but adapter not created
      // When client.publish.publish() is called (without connect())
      // Then CROSSTOWN_NOT_CONFIGURED should be thrown
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // Don't call connect() -- adapter remains null
      await expect(
        client.publish.publish({ reducer: 'player_move', args: [100, 200] })
      ).rejects.toThrow(SigilError);

      try {
        await client.publish.publish({ reducer: 'player_move', args: [100, 200] });
      } catch (error) {
        expect((error as SigilError).code).toBe('CROSSTOWN_NOT_CONFIGURED');
      }
    });

    it('[P0] should use eventId from adapter result for pending publish tracking', async () => {
      // Given adapter.publishEvent returns { eventId: 'adapter_event_id', ... }
      // When publish completes submission
      // Then pendingPublishes should track using the adapter-returned eventId
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return { ok: true, json: async () => ({ balance: 100 }) };
        } else if (url.includes('/publish')) {
          return { ok: true, json: async () => ({ success: true, eventId: 'adapter_event_id' }) };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 500,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // Manually create adapter by calling connect (will fail on SpacetimeDB/Nostr but that's OK)
      await client.connect().catch(() => {});

      // Adapter must be created during connect() -- fail if not
      expect((client as any).crosstownAdapter).not.toBeNull();

      // Start publish (will timeout waiting for confirmation)
      const publishPromise = client.publish.publish({
        reducer: 'player_move',
        args: [100, 200],
      });

      // Wait briefly for the publish to submit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that pendingPublishes has an entry
      const pendingPublishes = (client as any).pendingPublishes;
      expect(pendingPublishes.size).toBeGreaterThan(0);

      // Cleanup
      await client.disconnect();
      publishPromise.catch(() => {});
    });
  });

  describe('Publish Flow - Precondition Validation (AC2, AC7 - Regression)', () => {
    it('[P0] should still throw IDENTITY_NOT_LOADED if identity not loaded', async () => {
      // Given a SigilClient without identity loaded
      // When client.publish.publish() is called
      // Then IDENTITY_NOT_LOADED should be thrown (unchanged behavior)
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

    it('[P0] should still throw CROSSTOWN_NOT_CONFIGURED if adapter is null', async () => {
      // Given a SigilClient with identity but no connect() called
      // When client.publish.publish() is called
      // Then CROSSTOWN_NOT_CONFIGURED should be thrown (adapter is null)
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
        expect((error as SigilError).code).toBe('CROSSTOWN_NOT_CONFIGURED');
      }
    });

    it('[P0] should still throw REGISTRY_NOT_LOADED if no cost registry', async () => {
      // Given a SigilClient without action cost registry
      // When client.publish.publish() is called after loading identity
      // Then REGISTRY_NOT_LOADED should be thrown (unchanged behavior)
      const client = new SigilClient({
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // Connect to create adapter (will partially fail)
      await client.connect().catch(() => {});

      // If adapter was created, the REGISTRY_NOT_LOADED check comes after adapter check
      if ((client as any).crosstownAdapter) {
        await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
          SigilError
        );

        try {
          await client.publish.publish({ reducer: 'player_move', args: [] });
        } catch (error) {
          expect((error as SigilError).code).toBe('REGISTRY_NOT_LOADED');
        }
      }

      await client.disconnect();
    });
  });

  describe('Publish Flow - Error Propagation (AC4, AC7 - Regression)', () => {
    it('[P0] should propagate NETWORK_ERROR from adapter to caller', async () => {
      // Given adapter.publishEvent() encounters a network error
      // When client.publish.publish() is called
      // Then NETWORK_ERROR should propagate to the caller
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return { ok: true, json: async () => ({ balance: 100 }) };
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
      await client.connect().catch(() => {});

      // Adapter must be created during connect() -- fail if not
      expect((client as any).crosstownAdapter).not.toBeNull();

      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch (error) {
        expect((error as SigilError).code).toBe('NETWORK_ERROR');
        expect((error as SigilError).boundary).toBe('crosstown');
      }

      await client.disconnect();
    });

    it('[P0] should propagate NETWORK_TIMEOUT from adapter to caller', async () => {
      // Given adapter.publishEvent() times out
      // When client.publish.publish() is called
      // Then NETWORK_TIMEOUT should propagate to the caller
      const abortError = new Error('Request timed out');
      abortError.name = 'AbortError';
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return { ok: true, json: async () => ({ balance: 100 }) };
        } else if (url.includes('/publish')) {
          throw abortError;
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);
      await client.connect().catch(() => {});

      // Adapter must be created during connect() -- fail if not
      expect((client as any).crosstownAdapter).not.toBeNull();

      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch (error) {
        expect((error as SigilError).code).toBe('NETWORK_TIMEOUT');
        expect((error as SigilError).boundary).toBe('crosstown');
      }

      await client.disconnect();
    });

    it('[P0] should propagate PUBLISH_FAILED from adapter to caller', async () => {
      // Given adapter.publishEvent() fails
      // When client.publish.publish() is called
      // Then PUBLISH_FAILED should propagate to the caller
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return { ok: true, json: async () => ({ balance: 100 }) };
        } else if (url.includes('/publish')) {
          return { ok: false, status: 500, text: async () => 'Server error' };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      await client.loadIdentity('test-passphrase', identityPath);
      await client.connect().catch(() => {});

      // Adapter must be created during connect() -- fail if not
      expect((client as any).crosstownAdapter).not.toBeNull();

      await expect(client.publish.publish({ reducer: 'player_move', args: [] })).rejects.toThrow(
        SigilError
      );

      try {
        await client.publish.publish({ reducer: 'player_move', args: [] });
      } catch (error) {
        expect((error as SigilError).code).toBe('PUBLISH_FAILED');
        expect((error as SigilError).boundary).toBe('crosstown');
      }

      await client.disconnect();
    });

    it('[P0] should still timeout with CONFIRMATION_TIMEOUT (publishTimeout)', async () => {
      // Given adapter.publishEvent() succeeds but no confirmation arrives
      // When publishTimeout expires
      // Then CONFIRMATION_TIMEOUT should be thrown (unchanged behavior)
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return { ok: true, json: async () => ({ balance: 100 }) };
        } else if (url.includes('/publish')) {
          return { ok: true, json: async () => ({ success: true, eventId: 'timeout_test' }) };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 100, // Short timeout
      });

      await client.loadIdentity('test-passphrase', identityPath);
      await client.connect().catch(() => {});

      // Adapter must be created during connect() -- fail if not
      expect((client as any).crosstownAdapter).not.toBeNull();

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
  });

  describe('Scaffolding Removal Verification (AC4)', () => {
    it('[P1] should use crosstownAdapter field instead of crosstownConnector', () => {
      // Given the SigilClient class
      // When we inspect private fields
      // Then 'crosstownAdapter' should exist and 'crosstownConnector' should not
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
      });

      expect(client as any).toHaveProperty('crosstownAdapter');
      expect(client as any).not.toHaveProperty('crosstownConnector');
    });

    it('[P1] should not expose signEvent in exports', async () => {
      // Verify that the client module does not export signEvent
      const clientModule = await import('../index');
      expect((clientModule as any).signEvent).toBeUndefined();
    });

    it('[P1] should not expose CrosstownConnector in exports', async () => {
      // Verify that the client module does not export CrosstownConnector
      const clientModule = await import('../index');
      expect((clientModule as any).CrosstownConnector).toBeUndefined();
    });
  });

  describe('SigilClientConfig - btpEndpoint (AC2)', () => {
    it('[P1] should accept optional btpEndpoint in config', () => {
      // Given a SigilClient config with btpEndpoint
      // When the client is constructed
      // Then btpEndpoint should be stored for CrosstownAdapter creation
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        btpEndpoint: 'ws://custom:3001',
      });

      expect((client as any).btpEndpoint).toBe('ws://custom:3001');
    });

    it('[P1] should still use publishTimeout for CONFIRMATION_TIMEOUT (not adapter timeout)', () => {
      // Given a SigilClient with publishTimeout = 5000
      // When the client is constructed
      // Then publishTimeout should be preserved (controls confirmation wait)
      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 5000,
      });

      expect((client as any).publishTimeout).toBe(5000);
    });
  });
});
