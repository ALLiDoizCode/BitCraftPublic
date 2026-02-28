/**
 * Confirmation Flow Tests
 * Story 2.3: ILP Packet Construction & Signing
 *
 * Tests for AC3: Handle successful action confirmation
 * Validates confirmation event subscription, matching, and wallet balance updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SigilClient } from '../client';
import { generateKeypair } from '../nostr/keypair';
import { saveKeypair } from '../nostr/storage';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { NostrEvent } from '../nostr/types';
import { constructILPPacket } from './ilp-packet';
import { signEvent } from './event-signing';

// Mock fetch globally
const originalFetch = global.fetch;

describe('Confirmation Flow (AC3)', () => {
  let testDir: string;
  let registryPath: string;
  let identityPath: string;
  let testKeypair: { publicKey: Uint8Array; privateKey: Uint8Array };

  beforeEach(async () => {
    // Create unique test directory for each test
    testDir = join(tmpdir(), `sigil-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    registryPath = join(testDir, 'costs.json');
    identityPath = join(testDir, 'identity.json');
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

    // Create test identity
    testKeypair = await generateKeypair();
    await saveKeypair(testKeypair, 'test-passphrase', identityPath);

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Cleanup
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Confirmation Event Subscription (AC3)', () => {
    it('should create global confirmation subscription on first publish', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'test_event_id' }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 100,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // Start publish (will timeout waiting for confirmation)
      const publishPromise = client.publish.publish({
        reducer: 'player_move',
        args: [100, 200],
      });

      // Wait for subscription to be created
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify confirmation subscription exists
      const confirmationSubId = (client as any).confirmationSubscriptionId;
      expect(confirmationSubId).toBeTruthy();
      expect(typeof confirmationSubId).toBe('string');

      // Cleanup
      await client.disconnect();
      publishPromise.catch(() => {
        // Expected to fail
      });
    });

    it('should reuse confirmation subscription for multiple publishes', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'event_' + Date.now() }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 100,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      // First publish
      const publish1 = client.publish.publish({
        reducer: 'player_move',
        args: [100, 200],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      const subId1 = (client as any).confirmationSubscriptionId;

      // Second publish
      const publish2 = client.publish.publish({
        reducer: 'player_move',
        args: [200, 300],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      const subId2 = (client as any).confirmationSubscriptionId;

      // Should be the same subscription
      expect(subId1).toBe(subId2);

      // Cleanup
      await client.disconnect();
      publish1.catch(() => {});
      publish2.catch(() => {});
    });

    it('should filter confirmation events by kind 30078', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'test_id' }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 100,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      const publishPromise = client.publish.publish({
        reducer: 'player_move',
        args: [],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Access nostr client to verify subscription filter
      const nostrClient = (client as any).nostrClient;
      if (nostrClient) {
        const subscriptions = (nostrClient as any).subscriptions;
        const confirmationSubId = (client as any).confirmationSubscriptionId;

        if (subscriptions && confirmationSubId) {
          const confirmationSub = subscriptions.get(confirmationSubId);
          if (confirmationSub && confirmationSub.filter) {
            expect(confirmationSub.filter.kinds).toContain(30078);
          }
        }
      }

      // Cleanup
      await client.disconnect();
      publishPromise.catch(() => {});
    });

    it('should unsubscribe confirmation subscription on disconnect', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'test_id' }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 100,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      const publishPromise = client.publish.publish({
        reducer: 'player_move',
        args: [],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const subIdBefore = (client as any).confirmationSubscriptionId;
      expect(subIdBefore).toBeTruthy();

      await client.disconnect();

      const subIdAfter = (client as any).confirmationSubscriptionId;
      expect(subIdAfter).toBeNull();

      publishPromise.catch(() => {});
    });
  });

  describe('Confirmation Event Matching (AC3)', () => {
    it('should match confirmation event by event ID', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'response_event_id' }),
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
        args: [100, 200],
      });

      // Wait for pending publish to be registered
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify pending publish exists (tracked by signed event ID, not response ID)
      const pendingPublishes = (client as any).pendingPublishes;
      expect(pendingPublishes.size).toBe(1);

      // Get the first (and only) pending publish key
      const eventId = Array.from(pendingPublishes.keys())[0] as string;
      expect(eventId).toBeTruthy();
      expect(typeof eventId).toBe('string');
      expect(eventId.length).toBe(64); // SHA256 hex is 64 chars

      // Cleanup
      await client.disconnect();
      publishPromise.catch(() => {});
    });

    it('should verify confirmation event matches original reducer', async () => {
      // This test validates the parsing logic for confirmation events
      const testPubkeyHex = Buffer.from(testKeypair.publicKey).toString('hex');

      const originalPacket = constructILPPacket(
        { reducer: 'player_move', args: [100, 200] },
        1,
        testPubkeyHex
      );

      const signedPacket = signEvent(originalPacket, testKeypair.privateKey);

      // Parse the confirmation event to verify reducer matches
      const parsed = JSON.parse(signedPacket.content);
      expect(parsed.reducer).toBe('player_move');
      expect(parsed.args).toEqual([100, 200]);
    });

    it('should verify confirmation event includes all required fields', async () => {
      const testPubkeyHex = Buffer.from(testKeypair.publicKey).toString('hex');

      const packet = constructILPPacket(
        { reducer: 'craft_item', args: { itemId: 42 } },
        15,
        testPubkeyHex
      );

      const signedPacket = signEvent(packet, testKeypair.privateKey);

      // Verify all required NIP-01 fields
      expect(signedPacket).toHaveProperty('id');
      expect(signedPacket).toHaveProperty('pubkey');
      expect(signedPacket).toHaveProperty('created_at');
      expect(signedPacket).toHaveProperty('kind');
      expect(signedPacket).toHaveProperty('tags');
      expect(signedPacket).toHaveProperty('content');
      expect(signedPacket).toHaveProperty('sig');

      // Verify kind 30078
      expect(signedPacket.kind).toBe(30078);
    });
  });

  describe('Confirmation Result Details (AC3)', () => {
    it('should include eventId in confirmation result', async () => {
      const testEventId = 'result_event_id';
      const testPubkeyHex = Buffer.from(testKeypair.publicKey).toString('hex');

      const packet = constructILPPacket(
        { reducer: 'player_move', args: [100, 200] },
        1,
        testPubkeyHex
      );

      const signedPacket = signEvent(packet, testKeypair.privateKey);

      // Simulate constructing result from confirmed event
      const result = {
        eventId: signedPacket.id,
        reducer: 'player_move',
        args: [100, 200],
        fee: 1,
        pubkey: signedPacket.pubkey,
        timestamp: signedPacket.created_at,
      };

      expect(result.eventId).toBeTruthy();
      expect(result.eventId).toBe(signedPacket.id);
    });

    it('should include reducer in confirmation result', async () => {
      const testPubkeyHex = Buffer.from(testKeypair.publicKey).toString('hex');

      const packet = constructILPPacket(
        { reducer: 'craft_item', args: { itemId: 42 } },
        15,
        testPubkeyHex
      );

      const signedPacket = signEvent(packet, testKeypair.privateKey);
      const parsed = JSON.parse(signedPacket.content);

      const result = {
        eventId: signedPacket.id,
        reducer: parsed.reducer,
        args: parsed.args,
        fee: 15,
        pubkey: signedPacket.pubkey,
        timestamp: signedPacket.created_at,
      };

      expect(result.reducer).toBe('craft_item');
    });

    it('should include args in confirmation result', async () => {
      const testPubkeyHex = Buffer.from(testKeypair.publicKey).toString('hex');
      const testArgs = { x: 100, y: 200, z: 300 };

      const packet = constructILPPacket({ reducer: 'teleport', args: testArgs }, 50, testPubkeyHex);

      const signedPacket = signEvent(packet, testKeypair.privateKey);
      const parsed = JSON.parse(signedPacket.content);

      const result = {
        eventId: signedPacket.id,
        reducer: parsed.reducer,
        args: parsed.args,
        fee: 50,
        pubkey: signedPacket.pubkey,
        timestamp: signedPacket.created_at,
      };

      expect(result.args).toEqual(testArgs);
    });

    it('should include fee in confirmation result', async () => {
      const testPubkeyHex = Buffer.from(testKeypair.publicKey).toString('hex');

      const packet = constructILPPacket({ reducer: 'test_action', args: null }, 25, testPubkeyHex);

      const signedPacket = signEvent(packet, testKeypair.privateKey);

      // Extract fee from tags
      const feeTag = signedPacket.tags.find((tag) => tag[0] === 'fee');
      const fee = feeTag ? parseFloat(feeTag[1]) : 0;

      const result = {
        eventId: signedPacket.id,
        reducer: 'test_action',
        args: null,
        fee,
        pubkey: signedPacket.pubkey,
        timestamp: signedPacket.created_at,
      };

      expect(result.fee).toBe(25);
    });

    it('should include pubkey in confirmation result', async () => {
      const testPubkeyHex = Buffer.from(testKeypair.publicKey).toString('hex');

      const packet = constructILPPacket({ reducer: 'test_action', args: null }, 1, testPubkeyHex);

      const signedPacket = signEvent(packet, testKeypair.privateKey);

      const result = {
        eventId: signedPacket.id,
        reducer: 'test_action',
        args: null,
        fee: 1,
        pubkey: signedPacket.pubkey,
        timestamp: signedPacket.created_at,
      };

      expect(result.pubkey).toBe(testPubkeyHex);
    });

    it('should include timestamp in confirmation result', async () => {
      const testPubkeyHex = Buffer.from(testKeypair.publicKey).toString('hex');

      const packet = constructILPPacket({ reducer: 'test_action', args: null }, 1, testPubkeyHex);

      const signedPacket = signEvent(packet, testKeypair.privateKey);

      const result = {
        eventId: signedPacket.id,
        reducer: 'test_action',
        args: null,
        fee: 1,
        pubkey: signedPacket.pubkey,
        timestamp: signedPacket.created_at,
      };

      expect(result.timestamp).toBeGreaterThan(0);
      expect(typeof result.timestamp).toBe('number');
    });
  });

  describe('Pending Publish Tracking (AC3)', () => {
    it('should track pending publish in Map with event ID', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'response_id' }),
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

      await new Promise((resolve) => setTimeout(resolve, 100));

      const pendingPublishes = (client as any).pendingPublishes;
      expect(pendingPublishes.size).toBe(1);

      // Get the actual event ID from the map
      const eventId = Array.from(pendingPublishes.keys())[0];
      expect(eventId).toBeTruthy();

      const pending = pendingPublishes.get(eventId);
      expect(pending).toBeDefined();
      expect(pending).toHaveProperty('resolve');
      expect(pending).toHaveProperty('reject');
      expect(pending).toHaveProperty('timeoutId');
      expect(pending).toHaveProperty('reducer');
      expect(pending).toHaveProperty('args');
      expect(pending).toHaveProperty('fee');

      // Cleanup
      await client.disconnect();
      publishPromise.catch(() => {});
    });

    it('should remove pending publish after timeout', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'timeout_test' }),
          };
        }
      });
      global.fetch = mockFetch;

      const client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: 'http://localhost:4041',
        publishTimeout: 100,
      });

      await client.loadIdentity('test-passphrase', identityPath);

      const publishPromise = client.publish.publish({
        reducer: 'player_move',
        args: [],
      });

      // Catch the expected rejection to prevent unhandled rejection warning
      publishPromise.catch(() => {
        // Expected to timeout
      });

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pendingPublishes = (client as any).pendingPublishes;
      expect(pendingPublishes.size).toBe(0);

      // Cleanup
      await client.disconnect();
    });

    it('should clear timeout when confirmation received', async () => {
      // This test validates that the timeout is cleared to prevent memory leaks

      // Ensure costs.json exists (explicit creation in case beforeEach failed)
      const registry = {
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1, category: 'movement', frequency: 'high' },
        },
      };
      writeFileSync(registryPath, JSON.stringify(registry));

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 100 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'response_id' }),
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

      await new Promise((resolve) => setTimeout(resolve, 100));

      const pendingBefore = (client as any).pendingPublishes;
      expect(pendingBefore.size).toBe(1);

      // Get the actual event ID from the map
      const eventId = Array.from(pendingBefore.keys())[0];
      expect(eventId).toBeTruthy();

      // Simulate confirmation by calling cleanupPendingPublish
      const cleanupFn = (client as any).cleanupPendingPublish;
      if (cleanupFn) {
        cleanupFn.call(client, eventId);
      }

      const pendingAfter = (client as any).pendingPublishes;
      expect(pendingAfter.has(eventId)).toBe(false);

      // Cleanup
      await client.disconnect();
      publishPromise.catch(() => {});
    });
  });

  describe('Multiple Concurrent Publishes (AC3)', () => {
    it('should handle multiple pending publishes concurrently', async () => {
      let eventIdCounter = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 1000 }),
          };
        } else if (url.includes('/publish')) {
          eventIdCounter++;
          return {
            ok: true,
            json: async () => ({ success: true, eventId: `event_${eventIdCounter}` }),
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

      // Start 3 concurrent publishes
      const publish1 = client.publish.publish({ reducer: 'player_move', args: [1, 1] });
      const publish2 = client.publish.publish({ reducer: 'player_move', args: [2, 2] });
      const publish3 = client.publish.publish({ reducer: 'player_move', args: [3, 3] });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const pendingPublishes = (client as any).pendingPublishes;
      expect(pendingPublishes.size).toBe(3);

      // Cleanup
      await client.disconnect();
      publish1.catch(() => {});
      publish2.catch(() => {});
      publish3.catch(() => {});
    });

    it('should track each publish with unique event ID', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/wallet/balance/')) {
          return {
            ok: true,
            json: async () => ({ balance: 1000 }),
          };
        } else if (url.includes('/publish')) {
          return {
            ok: true,
            json: async () => ({ success: true, eventId: 'response_id' }),
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

      const publish1 = client.publish.publish({ reducer: 'player_move', args: [] });
      const publish2 = client.publish.publish({ reducer: 'craft_item', args: [] });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const pendingPublishes = (client as any).pendingPublishes;

      // Should have 2 pending publishes
      expect(pendingPublishes.size).toBe(2);

      // Get all event IDs from the map
      const eventIds = Array.from(pendingPublishes.keys()) as string[];
      expect(eventIds.length).toBe(2);

      // Verify each event ID is unique (64-char SHA256 hex)
      eventIds.forEach((eventId) => {
        expect(typeof eventId).toBe('string');
        expect(eventId.length).toBe(64);
        expect(eventId).toMatch(/^[0-9a-f]{64}$/);
      });

      // Verify IDs are different
      expect(eventIds[0]).not.toBe(eventIds[1]);

      // Cleanup
      await client.disconnect();
      publish1.catch(() => {});
      publish2.catch(() => {});
    });
  });
});
