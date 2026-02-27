/**
 * SigilClient Nostr Integration Tests
 * Story 2.1: Task 7 - Integration with SigilClient
 *
 * Tests dual connection (SpacetimeDB + Nostr relay) functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SigilClient } from '../client';

// Only run integration tests if RUN_INTEGRATION_TESTS=true
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!runIntegrationTests)('SigilClient Nostr Integration', () => {
  let client: SigilClient;

  beforeEach(() => {
    client = new SigilClient({
      spacetimedb: {
        host: 'localhost',
        port: 3000,
        database: 'bitcraft',
        protocol: 'ws',
      },
      nostrRelay: {
        url: 'ws://localhost:4040',
      },
      autoLoadStaticData: false, // Skip static data loading for faster tests
    });
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  describe('AC1: client.nostr accessible before connect', () => {
    it('should have nostr property available after instantiation', () => {
      expect(client.nostr).toBeDefined();
      expect(typeof client.nostr.connect).toBe('function');
      expect(typeof client.nostr.subscribe).toBe('function');
    });

    it('should have nostr in disconnected state before connect', () => {
      expect(client.nostr.state).toBe('disconnected');
      expect(client.nostr.isConnected()).toBe(false);
    });
  });

  describe('AC1: Dual connection (SpacetimeDB + Nostr)', () => {
    it('should connect both SpacetimeDB and Nostr relay on client.connect()', async () => {
      const nostrConnectionChanges: string[] = [];
      client.on('nostrConnectionChange', (event) => {
        nostrConnectionChanges.push(event.state);
      });

      await client.connect();

      // Check SpacetimeDB connection
      expect(client.spacetimedb.connection.connectionState).toBe('connected');

      // Check Nostr connection
      expect(client.nostr.isConnected()).toBe(true);
      expect(client.nostr.state).toBe('connected');

      // Verify connection events were emitted
      expect(nostrConnectionChanges).toContain('connecting');
      expect(nostrConnectionChanges).toContain('connected');
    }, 10000);

    it('should disconnect both connections on client.disconnect()', async () => {
      await client.connect();

      expect(client.spacetimedb.connection.connectionState).toBe('connected');
      expect(client.nostr.isConnected()).toBe(true);

      await client.disconnect();

      expect(client.spacetimedb.connection.connectionState).toBe('disconnected');
      expect(client.nostr.isConnected()).toBe(false);
    }, 10000);
  });

  describe('Event forwarding from Nostr to SigilClient', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should forward actionConfirmed events from Nostr client', async () => {
      const actionConfirmedPromise = new Promise<unknown>((resolve) => {
        client.on('actionConfirmed', (confirmation) => {
          resolve(confirmation);
        });
      });

      // Subscribe to kind 30078 events
      client.nostr.subscribe([{ kinds: [30078] }], () => {});

      // Publish a test event (using separate WebSocket client)
      const WebSocket = await import('ws');
      const publishClient = new WebSocket.default('ws://localhost:4040');

      await new Promise<void>((resolve) => {
        publishClient.on('open', () => resolve());
      });

      const event = {
        id: 'test-' + Date.now(),
        pubkey: '0'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 30078,
        tags: [],
        content: JSON.stringify({ reducer: 'test', args: [], fee: 100 }),
        sig: '0'.repeat(128),
      };

      publishClient.send(JSON.stringify(['EVENT', event]));

      const confirmation = await Promise.race([
        actionConfirmedPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
      ]);

      expect(confirmation).toBeDefined();
      publishClient.close();
    }, 5000);

    it('should forward nostr connection change events', async () => {
      // Events should have been forwarded during connect
      const events: string[] = [];
      client.on('nostrConnectionChange', (event) => {
        events.push(event.state);
      });

      // Force a state change by disconnecting
      await client.nostr.disconnect();

      expect(events).toContain('disconnected');
    });
  });

  describe('Configurable relay URL', () => {
    it('should use default relay URL if not configured', () => {
      const defaultClient = new SigilClient();
      expect(defaultClient.nostr['options'].url).toBe('ws://localhost:4040');
    });

    it('should use custom relay URL if configured', () => {
      const customClient = new SigilClient({
        nostrRelay: { url: 'wss://relay.example.com' },
      });
      expect(customClient.nostr['options'].url).toBe('wss://relay.example.com');
    });
  });
});
