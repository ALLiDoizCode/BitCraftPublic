/**
 * Nostr Client Integration Tests
 * Story 2.1: Crosstown Relay Connection & Event Subscriptions
 *
 * Tests against real Crosstown relay at ws://localhost:4040.
 * Requires Docker stack to be running.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { NostrClient } from '../nostr-client';
import type { NostrEvent, ActionConfirmation } from '../types';

// Only run integration tests if RUN_INTEGRATION_TESTS=true
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!runIntegrationTests)('Nostr Client Integration Tests', () => {
  let client: NostrClient;

  beforeEach(() => {
    client = new NostrClient({ url: 'ws://localhost:4040' });
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
      client.dispose();
    }
  });

  describe('AC1: WebSocket connection to Crosstown Nostr relay', () => {
    it('should connect to real Crosstown relay at ws://localhost:4040', async () => {
      await client.connect();

      expect(client.isConnected()).toBe(true);
      expect(client.state).toBe('connected');
    }, 10000);

    it('should emit connectionChange events on connect', async () => {
      const events: string[] = [];
      client.on('connectionChange', (event) => {
        events.push(event.state);
      });

      await client.connect();

      expect(events).toContain('connecting');
      expect(events).toContain('connected');
    }, 10000);
  });

  describe('AC2: NIP-01 compliant subscription with filters', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should subscribe with NIP-01 filters ({ kinds: [30078] })', async () => {
      const handler = vi.fn();
      const sub = client.subscribe([{ kinds: [30078] }], handler);

      expect(sub).toHaveProperty('id');
      expect(sub).toHaveProperty('filters');
      expect(sub).toHaveProperty('unsubscribe');
      expect(sub.filters).toEqual([{ kinds: [30078] }]);
    });

    it('should allow multiple subscriptions with different filters', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const sub1 = client.subscribe([{ kinds: [1] }], handler1);
      const sub2 = client.subscribe([{ kinds: [30078] }], handler2);

      expect(sub1.id).not.toBe(sub2.id);
    });
  });

  describe('AC3: EOSE (End of Stored Events) handling', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should receive EOSE message after subscription (Crosstown stub immediate EOSE)', async () => {
      const eosePromise = new Promise<string>((resolve) => {
        client.on('eose', (subscriptionId) => {
          resolve(subscriptionId);
        });
      });

      const sub = client.subscribe([{ kinds: [30078] }], vi.fn());

      // Crosstown stub should send EOSE immediately (<100ms)
      const receivedSubId = await Promise.race([
        eosePromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('EOSE timeout')), 1000)
        ),
      ]);

      expect(receivedSubId).toBe(sub.id);
    }, 2000);
  });

  describe('AC4: Action confirmation event detection', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should emit actionConfirmed event when kind 30078 event is published', async () => {
      const actionConfirmedPromise = new Promise<ActionConfirmation>((resolve) => {
        client.on('actionConfirmed', (confirmation) => {
          resolve(confirmation);
        });
      });

      // Subscribe to kind 30078 events
      client.subscribe([{ kinds: [30078] }], vi.fn());

      // Publish a kind 30078 event using a separate WebSocket client
      // This simulates the BLS handler publishing action confirmations
      const WebSocket = await import('ws');
      const publishClient = new WebSocket.default('ws://localhost:4040');

      await new Promise<void>((resolve) => {
        publishClient.on('open', () => resolve());
      });

      // Create and publish kind 30078 event with ILP packet
      const ilpContent = JSON.stringify({
        reducer: 'test_reducer',
        args: [1, 2, 3],
        fee: 500,
      });

      const event: NostrEvent = {
        id: 'test-event-' + Date.now(),
        pubkey: '0'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 30078,
        tags: [],
        content: ilpContent,
        sig: '0'.repeat(128),
      };

      publishClient.send(JSON.stringify(['EVENT', event]));

      // Wait for action confirmation
      const confirmation = await Promise.race([
        actionConfirmedPromise,
        new Promise<ActionConfirmation>((_, reject) =>
          setTimeout(() => reject(new Error('Action confirmation timeout')), 2000)
        ),
      ]);

      expect(confirmation.reducer).toBe('test_reducer');
      expect(confirmation.args).toEqual([1, 2, 3]);
      expect(confirmation.fee).toBe(500);

      publishClient.close();
    }, 5000);

    // Note: We can't easily verify BLS stub log output programmatically,
    // but the docker logs can be manually checked with:
    // docker compose -f docker/docker-compose.yml logs crosstown-node | grep "BLS STUB"
  });

  describe('AC5: Reconnection with exponential backoff', () => {
    it('should reconnect after forced disconnect', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Track connection state changes
      const stateChanges: string[] = [];
      client.on('connectionChange', (event) => {
        stateChanges.push(event.state);
      });

      // Force disconnect by accessing internal WebSocket (test-only)
      const ws = (client as unknown as { ws: import('ws').WebSocket | null }).ws;
      if (ws) {
        ws.close(1006); // Abnormal closure
      }

      // Wait for reconnection (should happen within 2 seconds - 1st backoff = 1s)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Should have gone through: disconnected → reconnecting → connected
      expect(stateChanges).toContain('disconnected');
      expect(stateChanges).toContain('reconnecting');
      expect(stateChanges).toContain('connected');
      expect(client.isConnected()).toBe(true);
    }, 10000);

    it('should re-establish subscriptions after reconnection', async () => {
      await client.connect();

      const events: NostrEvent[] = [];
      client.subscribe([{ kinds: [30078] }], (event) => {
        events.push(event);
      });

      // Force disconnect
      const ws = (client as unknown as { ws: import('ws').WebSocket | null }).ws;
      if (ws) {
        ws.close(1006);
      }

      // Wait for reconnection
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Subscription should be recovered - EOSE should be sent again
      const eoseReceived = await new Promise<boolean>((resolve) => {
        client.on('eose', () => resolve(true));
        setTimeout(() => resolve(false), 1000);
      });

      expect(eoseReceived).toBe(true);
    }, 10000);
  });

  describe('AC6: NIP-01 standard relay compatibility', () => {
    it('should work with Crosstown implementing NIP-01 baseline', async () => {
      await client.connect();

      // Test basic NIP-01 message flow
      const eoseReceived = await new Promise<boolean>((resolve) => {
        client.on('eose', () => resolve(true));
        client.subscribe([{ kinds: [1, 30078] }], vi.fn());
        setTimeout(() => resolve(false), 2000);
      });

      expect(eoseReceived).toBe(true);
    });
  });

  describe('AC7: Message parsing and error handling', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should handle subscription without crashing', async () => {
      // This test verifies the client remains stable
      const sub = client.subscribe([{ kinds: [30078] }], vi.fn());

      // Wait a bit to ensure no crashes
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(client.isConnected()).toBe(true);

      sub.unsubscribe();
    });
  });

  describe('AC8: Rate limiting awareness', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should continue operating after subscribing (rate limits not reached)', async () => {
      // Create a subscription (within rate limit)
      const sub = client.subscribe([{ kinds: [30078] }], vi.fn());

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Client should still be connected
      expect(client.isConnected()).toBe(true);

      sub.unsubscribe();
    });

    // Note: Testing actual rate limit (101 events/60s) would take too long for unit tests.
    // Rate limit behavior can be manually tested or tested in a dedicated stress test suite.
  });

  describe('Cleanup and disconnect', () => {
    it('should disconnect cleanly', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      await client.disconnect();
      expect(client.isConnected()).toBe(false);
      expect(client.state).toBe('disconnected');
    });
  });
});
