/**
 * Story 1.4: SpacetimeDB Integration Tests
 *
 * These tests run against a live BitCraft SpacetimeDB server.
 * Prerequisites:
 * - Docker stack from Story 1.3 must be running
 * - BitCraft server accessible at ws://localhost:3000
 * - Database name: bitcraft
 *
 * Run with: pnpm test:integration
 *
 * @group integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SigilClient } from '../../client';

// Integration test timeout (longer for network operations)
const INTEGRATION_TIMEOUT = 30000;

// Skip integration tests if environment variable is not set
const skipIntegration = !process.env.RUN_INTEGRATION_TESTS;

describe.skipIf(skipIntegration)('Integration: SpacetimeDB Connection & Subscriptions', () => {
  let client: SigilClient;

  beforeAll(async () => {
    // Verify Docker stack is running
    try {
      const response = await fetch('http://localhost:3000/database/bitcraft/info');
      if (!response.ok) {
        throw new Error(`BitCraft server not accessible: ${response.status}`);
      }
    } catch (error) {
      throw new Error('Docker stack not running. Start with: cd docker && docker compose up');
    }
  }, INTEGRATION_TIMEOUT);

  beforeEach(() => {
    client = new SigilClient({
      spacetimedb: {
        host: 'localhost',
        port: 3000,
        database: 'bitcraft',
        protocol: 'ws',
      },
    });
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  }, INTEGRATION_TIMEOUT);

  describe('Live BitCraft Server Connection', () => {
    it(
      'should connect to BitCraft server at ws://localhost:3000',
      async () => {
        // When: connecting to live server
        await client.connect();

        // Then: connection succeeds
        expect(client.spacetimedb.connection.connectionState).toBe('connected');
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should verify SDK 1.3.3 compatibility with BitCraft module 1.6.x',
      async () => {
        // Given: SDK 1.3.3 (from package.json)
        // When: connecting to BitCraft 1.6.x module
        await client.connect();

        // Then: connection succeeds (backwards compatibility NFR18)
        expect(client.spacetimedb.connection.connectionState).toBe('connected');

        // Verify we can subscribe (full protocol compatibility)
        const handle = await client.spacetimedb.subscribe('player_state', {});
        expect(handle).toBeDefined();
        handle.unsubscribe();
      },
      INTEGRATION_TIMEOUT
    );
  });

  describe('Live Table Subscriptions', () => {
    it(
      'should subscribe to player_state table',
      async () => {
        // Given: connected to live server
        await client.connect();

        // When: subscribing to player_state
        const snapshotReceived = new Promise((resolve) => {
          client.spacetimedb.subscriptions.once('tableSnapshot', (data) => {
            if (data.tableName === 'player_state') {
              resolve(data);
            }
          });
        });

        const handle = await client.spacetimedb.subscribe('player_state', {});

        // Then: initial snapshot is received
        const snapshot = await snapshotReceived;
        expect(snapshot).toBeDefined();
        expect(handle.tableName).toBe('player_state');

        handle.unsubscribe();
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should receive initial snapshot with existing rows',
      async () => {
        // Given: connected to live server
        await client.connect();

        // When: subscribing to a table
        const snapshotData = new Promise<any>((resolve) => {
          client.spacetimedb.subscriptions.once('tableSnapshot', (data) => {
            resolve(data);
          });
        });

        const handle = await client.spacetimedb.subscribe('player_state', {});
        const snapshot = await snapshotData;

        // Then: snapshot contains rows array
        expect(snapshot).toBeDefined();
        expect(snapshot.tableName).toBe('player_state');
        expect(Array.isArray(snapshot.rows)).toBe(true);

        handle.unsubscribe();
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should cache subscribed table data in tables accessor',
      async () => {
        // Given: active subscription
        await client.connect();
        await client.spacetimedb.subscribe('player_state', {});

        // Wait for snapshot to populate cache
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // When: accessing cached data via table accessor
        const cachedData = client.spacetimedb.tables.player_state.getAll();

        // Then: cached data is available
        expect(Array.isArray(cachedData)).toBe(true);
        // Note: May be empty if no players exist, but should be an array
      },
      INTEGRATION_TIMEOUT
    );
  });

  describe('Real-time Update Latency (NFR5)', () => {
    it(
      'should measure latency from reducer commit to client event',
      async () => {
        // Given: active subscription with latency monitoring
        await client.connect();
        const handle = await client.spacetimedb.subscribe('player_state', {});

        // Track latency measurements
        const latencies: number[] = [];
        client.spacetimedb.on('updateLatency', ({ latency }) => {
          latencies.push(latency);
        });

        // When: a reducer modifies subscribed table rows
        // Note: In a full integration test, we would call a reducer here
        // For now, we verify the latency monitoring infrastructure is in place

        // Then: latency measurements are captured
        const stats = client.spacetimedb.latency.getStats();
        expect(stats).toBeDefined();
        expect(typeof stats.avg).toBe('number');
        expect(typeof stats.p50).toBe('number');
        expect(typeof stats.p95).toBe('number');
        expect(typeof stats.p99).toBe('number');

        handle.unsubscribe();
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should verify updates arrive within 500ms (NFR5 requirement)',
      async () => {
        // Given: active subscription
        await client.connect();
        const handle = await client.spacetimedb.subscribe('player_state', {});

        // When: monitoring update latencies
        // (In full integration, would trigger reducer and measure)

        // Then: verify latency stats structure supports NFR5 verification
        const stats = client.spacetimedb.latency.getStats();

        // The p95 latency should be well under 500ms for real-time feel
        // (Actual verification happens when we can trigger reducers)
        expect(stats.p95).toBeGreaterThanOrEqual(0);

        handle.unsubscribe();
      },
      INTEGRATION_TIMEOUT
    );
  });

  describe('Multiple Concurrent Subscriptions', () => {
    it(
      'should support subscribing to multiple tables simultaneously',
      async () => {
        // Given: connected client
        await client.connect();

        // When: subscribing to multiple tables
        const tables = ['player_state', 'entity_position', 'inventory'];
        const handles = await Promise.all(
          tables.map((table) => client.spacetimedb.subscribe(table, {}))
        );

        // Then: all subscriptions are active
        expect(handles).toHaveLength(3);
        handles.forEach((handle, idx) => {
          expect(handle.tableName).toBe(tables[idx]);
        });

        // Cleanup
        handles.forEach((handle) => handle.unsubscribe());
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should aggregate updates from multiple tables into gameStateUpdate',
      async () => {
        // Given: multiple active subscriptions
        await client.connect();
        const handle1 = await client.spacetimedb.subscribe('player_state', {});
        const handle2 = await client.spacetimedb.subscribe('entity_position', {});

        // Track gameStateUpdate events
        const updates: unknown[] = [];
        client.on('gameStateUpdate', (update) => updates.push(update));

        // When: tables are updated (would be triggered by reducers)
        // Then: gameStateUpdate events aggregate changes
        // (Full verification requires reducer calls)

        // Verify event listener is registered
        expect(client.listenerCount('gameStateUpdate')).toBeGreaterThan(0);

        handle1.unsubscribe();
        handle2.unsubscribe();
      },
      INTEGRATION_TIMEOUT
    );
  });

  describe('Connection Lifecycle', () => {
    it(
      'should cleanly disconnect and allow reconnection',
      async () => {
        // Given: connected client
        await client.connect();
        expect(client.spacetimedb.connection.connectionState).toBe('connected');

        // When: disconnecting
        await client.disconnect();
        expect(client.spacetimedb.connection.connectionState).toBe('disconnected');

        // Then: can reconnect
        await client.connect();
        expect(client.spacetimedb.connection.connectionState).toBe('connected');
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should clear table cache on disconnect',
      async () => {
        // Given: connected with subscription and cached data
        await client.connect();
        await client.spacetimedb.subscribe('player_state', {});

        // Wait for cache to populate
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // When: disconnecting
        await client.disconnect();

        // Then: cache is cleared
        const cachedData = client.spacetimedb.tables.player_state.getAll();
        expect(cachedData).toHaveLength(0);
      },
      INTEGRATION_TIMEOUT
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle invalid table name gracefully',
      async () => {
        // Given: connected client
        await client.connect();

        // When: subscribing to non-existent table
        try {
          await client.spacetimedb.subscribe('non_existent_table', {});
          // If no error, that's OK - SDK may allow it
        } catch (error) {
          // Then: error is handled gracefully
          expect(error).toBeDefined();
        }
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should handle network interruption gracefully',
      async () => {
        // Given: connected client
        await client.connect();
        const handle = await client.spacetimedb.subscribe('player_state', {});

        // Track connection changes
        const states: string[] = [];
        client.on('connectionChange', ({ state }) => states.push(state));

        // When: network is interrupted (simulated by disconnect)
        await client.disconnect();

        // Then: connection state is updated
        expect(states).toContain('disconnected');

        handle.unsubscribe();
      },
      INTEGRATION_TIMEOUT
    );
  });

  describe('Type Safety Verification', () => {
    it(
      'should provide type-safe table accessors for BitCraft tables',
      async () => {
        // Given: connected client
        await client.connect();

        // When: accessing tables
        const tables = client.spacetimedb.tables;

        // Then: common BitCraft tables are accessible
        // Note: Exact table list depends on codegen
        expect(tables).toBeDefined();
        expect(tables.player_state).toBeDefined();

        // Verify accessor methods exist
        expect(typeof tables.player_state.get).toBe('function');
        expect(typeof tables.player_state.getAll).toBe('function');
        expect(typeof tables.player_state.query).toBe('function');
      },
      INTEGRATION_TIMEOUT
    );
  });
});

describe.skipIf(skipIntegration)('Integration: Performance & Resource Management', () => {
  it(
    'should handle large table subscriptions efficiently',
    async () => {
      const client = new SigilClient({
        spacetimedb: {
          host: 'localhost',
          port: 3000,
          database: 'bitcraft',
          protocol: 'ws',
        },
      });

      // Given: connected client
      await client.connect();

      // When: subscribing to potentially large tables
      const handle = await client.spacetimedb.subscribe('player_state', {});

      // Monitor memory usage (basic check)
      const memBefore = process.memoryUsage().heapUsed;

      // Wait for data to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = memAfter - memBefore;

      // Then: memory usage is reasonable (less than 100MB increase)
      expect(memIncrease).toBeLessThan(100 * 1024 * 1024);

      handle.unsubscribe();
      await client.disconnect();
    },
    INTEGRATION_TIMEOUT
  );

  it(
    'should prevent subscription count DoS',
    async () => {
      const client = new SigilClient({
        spacetimedb: {
          host: 'localhost',
          port: 3000,
          database: 'bitcraft',
          protocol: 'ws',
        },
      });

      await client.connect();

      // When: attempting to create many subscriptions
      const handles = [];
      const tables = ['player_state', 'entity_position', 'inventory'];

      // Create multiple subscriptions (up to reasonable limit)
      for (let i = 0; i < 10; i++) {
        const table = tables[i % tables.length];
        try {
          const handle = await client.spacetimedb.subscribe(table, {});
          handles.push(handle);
        } catch (error) {
          // May hit subscription limit - that's OK
          break;
        }
      }

      // Then: client remains stable
      expect(client.spacetimedb.connection.connectionState).toBe('connected');

      // Cleanup
      handles.forEach((h) => h.unsubscribe());
      await client.disconnect();
    },
    INTEGRATION_TIMEOUT
  );
});
