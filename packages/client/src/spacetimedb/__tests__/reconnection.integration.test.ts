/**
 * Integration tests for ReconnectionManager with live BitCraft server
 * Story 1.6: Auto-Reconnection & State Recovery
 *
 * RED PHASE: These tests are intentionally failing to drive implementation
 *
 * PREREQUISITES:
 * - Docker stack must be running: `cd docker && docker compose up`
 * - BitCraft server must be accessible at ws://localhost:3000
 *
 * Run with: RUN_INTEGRATION_TESTS=true pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SigilClient } from '../../client';
import type { ConnectionChangeEvent, SubscriptionsRecoveredEvent } from '../reconnection-types';

describe('ReconnectionManager - Integration Tests', () => {
  let dockerAvailable = false;
  let client: SigilClient;

  beforeAll(async () => {
    // Check if Docker stack is running
    try {
      const response = await fetch('http://localhost:3000/health');
      dockerAvailable = response.ok;
    } catch (e) {
      console.warn('⚠️  Docker stack not available. Run: cd docker && docker compose up');
      console.warn('⚠️  Skipping integration tests');
    }
  });

  afterAll(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  beforeEach(async () => {
    if (dockerAvailable) {
      client = new SigilClient({
        spacetimedb: {
          host: 'localhost',
          port: 3000,
        },
        reconnection: {
          autoReconnect: true,
          maxReconnectAttempts: 10,
          initialDelay: 1000,
          maxDelay: 30000,
        },
      });
    }
  });

  describe('AC1: Connection loss detection and reconnection initiation', () => {
    it.skipIf(!dockerAvailable)(
      'should auto-reconnect to live BitCraft server after disconnect',
      async () => {
        await client.connect();

        const events: ConnectionChangeEvent[] = [];
        client.on('connectionChange', (event: ConnectionChangeEvent) => {
          events.push(event);
        });

        // Simulate unexpected disconnect by closing WebSocket
        (client as any).spacetimedb.connection.close();

        // Wait for reconnection
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const disconnectedEvent = events.find((e) => e.status === 'disconnected');
        expect(disconnectedEvent).toBeDefined();

        const reconnectingEvent = events.find((e) => e.status === 'reconnecting');
        expect(reconnectingEvent).toBeDefined();

        const connectedEvent = events.find((e) => e.status === 'connected');
        expect(connectedEvent).toBeDefined();
      },
      10000
    );

    it.skipIf(!dockerAvailable)(
      'should detect disconnect reason from WebSocket close event',
      async () => {
        await client.connect();

        const events: ConnectionChangeEvent[] = [];
        client.on('connectionChange', (event: ConnectionChangeEvent) => {
          events.push(event);
        });

        // Close with specific reason
        (client as any).spacetimedb.connection.close(1006, 'Network error');

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const disconnectedEvent = events.find((e) => e.status === 'disconnected');
        expect(disconnectedEvent).toBeDefined();
        expect(disconnectedEvent?.reason).toBeTruthy();
      },
      5000
    );
  });

  describe('AC2: Exponential backoff with cap', () => {
    it.skipIf(!dockerAvailable)(
      'should apply exponential backoff with observable delays',
      async () => {
        client = new SigilClient({
          spacetimedb: {
            host: 'localhost',
            port: 9999, // Invalid port to force failures
          },
          reconnection: {
            autoReconnect: true,
            maxReconnectAttempts: 5,
            initialDelay: 1000,
            maxDelay: 30000,
          },
        });

        const events: ConnectionChangeEvent[] = [];
        const timestamps: number[] = [];

        client.on('connectionChange', (event: ConnectionChangeEvent) => {
          if (event.status === 'reconnecting') {
            events.push(event);
            timestamps.push(Date.now());
          }
        });

        await client.connect().catch(() => {}); // Will fail

        // Wait for several attempts
        await new Promise((resolve) => setTimeout(resolve, 15000));

        // Verify exponential backoff pattern
        expect(events.length).toBeGreaterThanOrEqual(3);

        // Check delays between attempts (should roughly double)
        if (timestamps.length >= 3) {
          const delay1 = timestamps[1] - timestamps[0];
          const delay2 = timestamps[2] - timestamps[1];

          // Second delay should be roughly 2x first delay (with jitter tolerance)
          expect(delay2).toBeGreaterThan(delay1 * 1.5);
          expect(delay2).toBeLessThan(delay1 * 3);
        }
      },
      20000
    );

    it.skipIf(!dockerAvailable)(
      'should apply jitter to prevent simultaneous reconnections',
      async () => {
        client = new SigilClient({
          spacetimedb: {
            host: 'localhost',
            port: 9999, // Invalid port
          },
          reconnection: {
            autoReconnect: true,
            maxReconnectAttempts: 10,
            initialDelay: 1000,
            jitterPercent: 10,
          },
        });

        const delays: number[] = [];
        client.on('connectionChange', (event: ConnectionChangeEvent) => {
          if (event.status === 'reconnecting' && event.nextAttemptDelay) {
            delays.push(event.nextAttemptDelay);
          }
        });

        await client.connect().catch(() => {});

        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Verify delays have variance (not all identical)
        const uniqueDelays = new Set(delays);
        expect(uniqueDelays.size).toBeGreaterThan(1); // Should have variety due to jitter
      },
      10000
    );
  });

  describe('AC3: Successful reconnection and subscription recovery', () => {
    it.skipIf(!dockerAvailable)(
      'should restore player table subscription after reconnection',
      async () => {
        await client.connect();

        // Subscribe to player table
        await client.spacetimedb.subscribe('player', {});

        const events: ConnectionChangeEvent[] = [];
        client.on('connectionChange', (event: ConnectionChangeEvent) => {
          events.push(event);
        });

        // Disconnect
        (client as any).spacetimedb.connection.close();

        // Wait for reconnection
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const connectedEvent = events.find((e) => e.status === 'connected');
        expect(connectedEvent).toBeDefined();

        // Verify subscription was restored
        const subscriptions = (client as any).spacetimedb.subscriptions;
        expect(subscriptions.has('player')).toBe(true);
      },
      10000
    );

    it.skipIf(!dockerAvailable)(
      'should restore multiple subscriptions in parallel',
      async () => {
        await client.connect();

        // Subscribe to multiple tables
        await Promise.all([
          client.spacetimedb.subscribe('player', {}),
          client.spacetimedb.subscribe('inventory', {}),
          client.spacetimedb.subscribe('item_desc', {}),
        ]);

        const startTime = Date.now();
        let recoveryTime = 0;

        client.on('subscriptionsRecovered', (event: SubscriptionsRecoveredEvent) => {
          recoveryTime = Date.now() - startTime;
        });

        // Disconnect
        (client as any).spacetimedb.connection.close();

        // Wait for recovery
        await new Promise((resolve) => setTimeout(resolve, 8000));

        // Verify all subscriptions restored
        const subscriptions = (client as any).spacetimedb.subscriptions;
        expect(subscriptions.has('player')).toBe(true);
        expect(subscriptions.has('inventory')).toBe(true);
        expect(subscriptions.has('item_desc')).toBe(true);

        // Verify parallel restoration (should be faster than sequential)
        expect(recoveryTime).toBeLessThan(10000); // NFR23
      },
      15000
    );

    it.skipIf(!dockerAvailable)(
      'should emit subscriptionsRecovered with accurate metadata',
      async () => {
        await client.connect();

        await Promise.all([
          client.spacetimedb.subscribe('player', {}),
          client.spacetimedb.subscribe('inventory', {}),
        ]);

        const events: SubscriptionsRecoveredEvent[] = [];
        client.on('subscriptionsRecovered', (event: SubscriptionsRecoveredEvent) => {
          events.push(event);
        });

        // Disconnect and reconnect
        (client as any).spacetimedb.connection.close();

        await new Promise((resolve) => setTimeout(resolve, 5000));

        expect(events.length).toBeGreaterThan(0);
        expect(events[0].totalSubscriptions).toBe(2);
        expect(events[0].successfulSubscriptions).toBe(2);
        expect(events[0].failedSubscriptions).toBe(0);
        expect(events[0].recoveryTimeMs).toBeGreaterThan(0);
        expect(events[0].recoveryTimeMs).toBeLessThan(10000);
      },
      10000
    );
  });

  describe('AC4: State snapshot recovery', () => {
    it.skipIf(!dockerAvailable)(
      'should merge snapshot data with client state after reconnection',
      async () => {
        await client.connect();
        await client.spacetimedb.subscribe('player', {});

        // Get initial state
        const initialPlayers = client.spacetimedb.tables.player?.getAll() || [];

        // Disconnect
        (client as any).spacetimedb.connection.close();

        // Wait for reconnection
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Get state after recovery
        const recoveredPlayers = client.spacetimedb.tables.player?.getAll() || [];

        // State should be present (merged, not replaced with empty)
        expect(recoveredPlayers.length).toBeGreaterThanOrEqual(initialPlayers.length);
      },
      10000
    );

    it.skipIf(!dockerAvailable)(
      'should emit update events for rows changed during disconnect',
      async () => {
        await client.connect();
        await client.spacetimedb.subscribe('player', {});

        const updateEvents: any[] = [];
        client.on('tableUpdate', (event: any) => {
          if (event.tableName === 'player' && event.type === 'update') {
            updateEvents.push(event);
          }
        });

        // Disconnect
        (client as any).spacetimedb.connection.close();

        // Wait for reconnection and snapshot
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // If server state changed during disconnect, updates should be emitted
        // (This may be 0 if no changes occurred, but structure should be correct)
        updateEvents.forEach((event) => {
          expect(event.tableName).toBe('player');
          expect(event.type).toBe('update');
          expect(event.row).toBeDefined();
        });
      },
      10000
    );

    it.skipIf(!dockerAvailable)(
      'should preserve static data cache (no reload on reconnection)',
      async () => {
        await client.connect();

        let staticDataLoadCount = 0;
        client.on('staticDataLoaded', () => {
          staticDataLoadCount++;
        });

        // Initial static data load
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const initialLoadCount = staticDataLoadCount;

        // Disconnect and reconnect
        (client as any).spacetimedb.connection.close();
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Static data should NOT reload
        expect(staticDataLoadCount).toBe(initialLoadCount);

        // Verify static data cache still accessible
        const itemDesc = client.staticData?.get('item_desc', 1);
        expect(itemDesc).toBeDefined();
      },
      12000
    );
  });

  describe('AC5: Reconnection failure handling', () => {
    it.skipIf(!dockerAvailable)(
      'should fail after 10 reconnection attempts when server is down',
      async () => {
        client = new SigilClient({
          spacetimedb: {
            host: 'localhost',
            port: 9999, // Invalid port (server down)
          },
          reconnection: {
            autoReconnect: true,
            maxReconnectAttempts: 3, // Reduced for faster test
            initialDelay: 500,
          },
        });

        const events: ConnectionChangeEvent[] = [];
        client.on('connectionChange', (event: ConnectionChangeEvent) => {
          events.push(event);
        });

        await client.connect().catch(() => {}); // Will fail

        // Wait for all attempts
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const failedEvent = events.find((e) => e.status === 'failed');
        expect(failedEvent).toBeDefined();
        expect(failedEvent?.reason).toContain('Failed to reconnect after 3 attempts');
        expect(failedEvent?.error).toBeDefined();
      },
      10000
    );

    it.skipIf(!dockerAvailable)(
      'should successfully retry after manual retryConnection() call',
      async () => {
        client = new SigilClient({
          spacetimedb: {
            host: 'localhost',
            port: 9999, // Start with invalid port
          },
          reconnection: {
            autoReconnect: true,
            maxReconnectAttempts: 1,
            initialDelay: 500,
          },
        });

        const events: ConnectionChangeEvent[] = [];
        client.on('connectionChange', (event: ConnectionChangeEvent) => {
          events.push(event);
        });

        await client.connect().catch(() => {});

        // Wait for failure
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const failedEvent = events.find((e) => e.status === 'failed');
        expect(failedEvent).toBeDefined();

        // Change to valid port (simulate server recovery)
        (client as any).options.spacetimedb.port = 3000;

        // Manual retry
        await client.retryConnection();

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const connectedEvent = events.find((e) => e.status === 'connected');
        expect(connectedEvent).toBeDefined();
      },
      10000
    );
  });

  describe('NFR23: Performance validation', () => {
    it.skipIf(!dockerAvailable)(
      'should complete reconnection within 10 seconds (NFR23)',
      async () => {
        await client.connect();

        // Subscribe to multiple tables
        await Promise.all([
          client.spacetimedb.subscribe('player', {}),
          client.spacetimedb.subscribe('inventory', {}),
          client.spacetimedb.subscribe('item_desc', {}),
        ]);

        const startTime = Date.now();
        let endTime = 0;

        client.on('subscriptionsRecovered', (event: SubscriptionsRecoveredEvent) => {
          endTime = Date.now();
        });

        // Disconnect
        (client as any).spacetimedb.connection.close();

        // Wait for full recovery
        await new Promise((resolve) => setTimeout(resolve, 12000));

        const totalTime = endTime - startTime;
        expect(totalTime).toBeLessThan(10000); // NFR23: < 10 seconds
        expect(totalTime).toBeGreaterThan(0);
      },
      15000
    );
  });
});
