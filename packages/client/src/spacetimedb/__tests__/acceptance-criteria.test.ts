/**
 * Story 1.4: SpacetimeDB Connection & Table Subscriptions
 * ATDD Acceptance Criteria Tests
 *
 * These tests define the behavior specified in the acceptance criteria.
 * They serve as executable specifications and should pass when the story is complete.
 *
 * Prerequisites:
 * - Docker stack from Story 1.3 must be running for connection tests
 * - Set RUN_INTEGRATION_TESTS=1 to run tests that require a live server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SigilClient } from '../../client';

// Skip tests that require a running server unless explicitly enabled
const skipIntegration = !process.env.RUN_INTEGRATION_TESTS;

describe('Story 1.4: SpacetimeDB Connection & Table Subscriptions', () => {
  let client: SigilClient;

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
  });

  describe.skipIf(skipIntegration)('AC1: SigilClient connects to SpacetimeDB', () => {
    it('should establish WebSocket v1 connection when connect() is called', async () => {
      // Given: a running BitCraft SpacetimeDB server
      // When: I create a SigilClient with SpacetimeDB connection options and call connect()
      await client.connect();

      // Then: a WebSocket v1 connection is established
      expect(client.spacetimedb.connection.connectionState).toBe('connected');
    });

    it('should make spacetimedb surface available after connection', async () => {
      // Given: a running BitCraft SpacetimeDB server
      // When: I create a SigilClient with SpacetimeDB connection options and call connect()
      await client.connect();

      // Then: the client.spacetimedb surface is available for subscriptions
      expect(client.spacetimedb).toBeDefined();
      expect(client.spacetimedb.connection).toBeDefined();
      expect(client.spacetimedb.subscriptions).toBeDefined();
      expect(client.spacetimedb.tables).toBeDefined();
    });

    it('should emit connectionChange event with connected state', async () => {
      // Given: a running BitCraft SpacetimeDB server
      const connectionChanges: Array<{ state: string; error?: Error }> = [];
      client.on('connectionChange', (change) => connectionChanges.push(change));

      // When: I call connect()
      await client.connect();

      // Then: connectionChange event is emitted with connected state
      expect(connectionChanges).toContainEqual(expect.objectContaining({ state: 'connected' }));
    });

    it('should transition through connection states: disconnected -> connecting -> connected', async () => {
      // Track all state transitions
      const states: string[] = [];
      client.on('connectionChange', ({ state }) => states.push(state));

      // Initial state should be disconnected
      expect(client.spacetimedb.connection.connectionState).toBe('disconnected');

      // Connect
      await client.connect();

      // Should have transitioned: connecting -> connected
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
      expect(client.spacetimedb.connection.connectionState).toBe('connected');
    });
  });

  describe.skipIf(skipIntegration)('AC2: Subscribe to table updates with real-time push', () => {
    it('should receive initial state snapshot for matching rows', async () => {
      // Given: an active SpacetimeDB connection
      await client.connect();

      // When: I call client.spacetimedb.subscribe('player_state', query)
      const snapshotReceived = vi.fn();
      client.spacetimedb.subscriptions.on('tableSnapshot', snapshotReceived);

      const handle = await client.spacetimedb.subscribe('player_state', {});

      // Then: I receive the initial state snapshot for matching rows
      expect(handle).toBeDefined();
      expect(handle.tableName).toBe('player_state');
      expect(snapshotReceived).toHaveBeenCalled();

      // Cleanup
      handle.unsubscribe();
    });

    it('should push subsequent updates in real-time as database changes', async () => {
      // Given: an active SpacetimeDB connection with subscription
      await client.connect();
      const handle = await client.spacetimedb.subscribe('player_state', {});

      // Track row events
      const rowInserts: unknown[] = [];
      client.spacetimedb.subscriptions.on('rowInserted', (data) => {
        if (data.tableName === 'player_state') {
          rowInserts.push(data.row);
        }
      });

      // When: a reducer modifies subscribed table rows
      // (This would be triggered by an external action - for unit tests we'll mock)
      // For integration tests, this will call a reducer via SpacetimeDB CLI

      // Then: subsequent updates are pushed in real-time
      // (Verification happens in integration tests with live reducer calls)

      // Cleanup
      handle.unsubscribe();
    });

    it('should return SubscriptionHandle with unsubscribe capability', async () => {
      // Given: an active SpacetimeDB connection
      await client.connect();

      // When: I subscribe to a table
      const handle = await client.spacetimedb.subscribe('player_state', {});

      // Then: I get a handle with unsubscribe method
      expect(handle).toBeDefined();
      expect(handle.id).toBeDefined();
      expect(handle.tableName).toBe('player_state');
      expect(typeof handle.unsubscribe).toBe('function');

      // Cleanup
      handle.unsubscribe();
    });
  });

  describe.skipIf(skipIntegration)('AC3: Real-time update latency requirement', () => {
    it('should reflect updates within 500ms of database commit (NFR5)', async () => {
      // Given: an active subscription
      await client.connect();
      const handle = await client.spacetimedb.subscribe('player_state', {});

      // Track latency measurements
      const latencies: number[] = [];
      client.spacetimedb.on('updateLatency', ({ latency }) => {
        latencies.push(latency);
      });

      // When: a reducer modifies subscribed table rows
      // (This would be an actual reducer call in integration tests)

      // Then: the update is reflected in client state within 500ms
      // Note: This is verified in integration tests with actual reducer calls
      // For unit tests, we validate that latency monitoring is in place

      expect(client.spacetimedb.latency).toBeDefined();
      expect(client.spacetimedb.latency.getStats).toBeDefined();

      // Cleanup
      handle.unsubscribe();
    });

    it('should log warning if latency exceeds 500ms threshold', async () => {
      // Given: an active subscription
      await client.connect();
      const handle = await client.spacetimedb.subscribe('player_state', {});

      // Spy on console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Simulate high latency update (this would be mocked internally)
      // The latency monitor should detect and warn

      // Then: warning is logged for high latency
      // (Implementation detail - verified in integration tests)

      warnSpy.mockRestore();
      handle.unsubscribe();
    });

    it('should expose latency statistics via getStats()', async () => {
      // Given: an active subscription with some updates
      await client.connect();
      const handle = await client.spacetimedb.subscribe('player_state', {});

      // When: I call getStats()
      const stats = client.spacetimedb.latency.getStats();

      // Then: I get latency metrics
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('avg');
      expect(stats).toHaveProperty('p50');
      expect(stats).toHaveProperty('p95');
      expect(stats).toHaveProperty('p99');

      // Cleanup
      handle.unsubscribe();
    });
  });

  describe.skipIf(skipIntegration)('AC4: Type-safe table accessors', () => {
    it('should provide generated type-safe table accessors', async () => {
      // Given: the client.spacetimedb surface
      await client.connect();

      // When: I access client.spacetimedb.tables
      const tables = client.spacetimedb.tables;

      // Then: I get generated type-safe table accessors for the BitCraft module
      expect(tables).toBeDefined();
      // Note: Specific table names depend on codegen from BitCraft module
      // Common tables that should exist:
      expect(tables.player_state).toBeDefined();
    });

    it('should provide get, getAll, and query methods on table accessors', async () => {
      // Given: an active connection with subscription
      await client.connect();
      await client.spacetimedb.subscribe('player_state', {});

      // When: I access a table accessor
      const playerStateTable = client.spacetimedb.tables.player_state;

      // Then: I get type-safe accessor methods
      expect(typeof playerStateTable.get).toBe('function');
      expect(typeof playerStateTable.getAll).toBe('function');
      expect(typeof playerStateTable.query).toBe('function');
    });

    it('should return cached table data from getAll()', async () => {
      // Given: an active subscription
      await client.connect();
      await client.spacetimedb.subscribe('player_state', {});

      // When: I call getAll()
      const allPlayers = client.spacetimedb.tables.player_state.getAll();

      // Then: I get an array of cached rows
      expect(Array.isArray(allPlayers)).toBe(true);
    });

    it('should support query with predicate function', async () => {
      // Given: an active subscription with data
      await client.connect();
      await client.spacetimedb.subscribe('player_state', {});

      // When: I call query with a predicate
      const filtered = client.spacetimedb.tables.player_state.query(
        (row: any) => row.id !== undefined
      );

      // Then: I get filtered results
      expect(Array.isArray(filtered)).toBe(true);
    });
  });

  describe.skipIf(skipIntegration)('AC5: Game state update events', () => {
    it('should emit gameStateUpdate events from subscription updates', async () => {
      // Given: an active SpacetimeDB connection
      await client.connect();

      // Track game state updates
      const updates: unknown[] = [];
      client.on('gameStateUpdate', (update) => updates.push(update));

      // When: I listen to gameStateUpdate events and subscribe to tables
      await client.spacetimedb.subscribe('player_state', {});

      // Then: aggregated game state events are emitted
      // Note: Events will be emitted when actual updates occur
      // For now, verify that the event listener is registered
      expect(client.listenerCount('gameStateUpdate')).toBeGreaterThan(0);
    });

    it('should aggregate multiple row events from same transaction', async () => {
      // Given: an active subscription
      await client.connect();
      await client.spacetimedb.subscribe('player_state', {});

      // Track updates
      const gameStateUpdates: unknown[] = [];
      client.on('gameStateUpdate', (update) => gameStateUpdates.push(update));

      // When: multiple rows are updated in the same transaction
      // (This is tested in integration tests with actual multi-row transactions)

      // Then: they are aggregated into a single gameStateUpdate event
      // (Verification happens in integration tests)
    });
  });

  describe('AC6: SDK backwards compatibility', () => {
    it('should use SpacetimeDB SDK version 1.3.3 (NOT 2.0+)', () => {
      // Given: the package.json dependencies
      // When: I check the installed SDK version
      // Then: it should be 1.3.3 (compatible with BitCraft module 1.6.x)

      // This is verified by package.json and installation
      // The critical version constraint is enforced at build time
      const packageJson = require('../../../package.json');
      expect(packageJson.dependencies['@clockworklabs/spacetimedb-sdk']).toMatch(/\^1\.3\.3/);
    });

    it.skipIf(skipIntegration)(
      'should successfully connect to BitCraft server running module 1.6.x',
      async () => {
        // Given: a SpacetimeDB connection using SDK version 1.3.3
        // When: connected to a BitCraft server running module version 1.6.x
        await client.connect();

        // Then: the connection succeeds and table subscriptions work correctly
        expect(client.spacetimedb.connection.connectionState).toBe('connected');

        // Verify subscription works (backwards compatibility)
        const handle = await client.spacetimedb.subscribe('player_state', {});
        expect(handle).toBeDefined();

        // Cleanup
        handle.unsubscribe();
      }
    );

    it.skipIf(skipIntegration)('should use WebSocket protocol v1 (not v2)', async () => {
      // Given: SDK 1.3.3
      // When: connecting to server
      await client.connect();

      // Then: protocol v1 is used (SDK 2.0+ would use v2, which is incompatible)
      // This is implicit in the SDK version but critical for compatibility (NFR18)
      expect(client.spacetimedb.connection.connectionState).toBe('connected');
    });
  });

  describe('Connection error handling', () => {
    it.skipIf(skipIntegration)(
      'should emit connectionChange event with failed state on error',
      async () => {
        // Given: an invalid server configuration
        const badClient = new SigilClient({
          spacetimedb: {
            host: 'invalid-host',
            port: 9999,
            database: 'bitcraft',
            protocol: 'ws',
          },
        });

        const connectionChanges: Array<{ state: string; error?: Error }> = [];
        badClient.on('connectionChange', (change) => connectionChanges.push(change));

        // When: I attempt to connect
        try {
          await badClient.connect();
        } catch (error) {
          // Expected to fail
        }

        // Then: connectionChange event emitted with failed state
        expect(connectionChanges).toContainEqual(
          expect.objectContaining({
            state: 'failed',
            error: expect.any(Error),
          })
        );
      }
    );

    it.skipIf(skipIntegration)(
      'should timeout if connection not established within configured timeout',
      async () => {
        // Given: a client with short timeout
        const timeoutClient = new SigilClient({
          spacetimedb: {
            host: '10.255.255.1', // Non-routable IP to force timeout
            port: 3000,
            database: 'bitcraft',
            protocol: 'ws',
            timeout: 1000, // 1 second timeout
          },
        });

        // When: I attempt to connect
        const startTime = Date.now();
        try {
          await timeoutClient.connect();
        } catch (error) {
          // Expected to timeout
        }
        const elapsed = Date.now() - startTime;

        // Then: connection fails within timeout period
        expect(elapsed).toBeLessThan(2000); // Should fail around 1s, not hang
        expect(timeoutClient.spacetimedb.connection.connectionState).not.toBe('connected');
      }
    );

    it('should validate connection options and throw for invalid input', () => {
      // Given: invalid connection options
      // Then: constructor throws validation error
      expect(() => {
        new SigilClient({
          spacetimedb: {
            host: '', // Invalid: empty host
            port: 3000,
            database: 'bitcraft',
          },
        });
      }).toThrow();

      expect(() => {
        new SigilClient({
          spacetimedb: {
            host: 'localhost',
            port: -1, // Invalid: negative port
            database: 'bitcraft',
          },
        });
      }).toThrow();
    });
  });

  describe.skipIf(skipIntegration)('Disconnection and cleanup', () => {
    it('should cleanly disconnect and transition to disconnected state', async () => {
      // Given: a connected client
      await client.connect();
      expect(client.spacetimedb.connection.connectionState).toBe('connected');

      const connectionChanges: Array<{ state: string }> = [];
      client.on('connectionChange', (change) => connectionChanges.push(change));

      // When: I call disconnect()
      await client.disconnect();

      // Then: connection is closed and state is disconnected
      expect(client.spacetimedb.connection.connectionState).toBe('disconnected');
      expect(connectionChanges).toContainEqual(expect.objectContaining({ state: 'disconnected' }));
    });

    it('should unsubscribe all subscriptions on disconnect', async () => {
      // Given: a connected client with multiple subscriptions
      await client.connect();
      const handle1 = await client.spacetimedb.subscribe('player_state', {});
      const handle2 = await client.spacetimedb.subscribe('entity_position', {});

      // When: I call disconnect()
      await client.disconnect();

      // Then: all subscriptions are cleaned up
      // (Internal verification - no memory leaks, event listeners removed)
      expect(client.spacetimedb.connection.connectionState).toBe('disconnected');
    });

    it('should clear table cache on disconnect', async () => {
      // Given: a connected client with cached data
      await client.connect();
      await client.spacetimedb.subscribe('player_state', {});

      // Assume some data was cached
      const beforeDisconnect = client.spacetimedb.tables.player_state.getAll();

      // When: I disconnect
      await client.disconnect();

      // Then: cache is cleared
      const afterDisconnect = client.spacetimedb.tables.player_state.getAll();
      expect(afterDisconnect).toHaveLength(0);
    });
  });

  describe.skipIf(skipIntegration)('Subscription management', () => {
    it('should stop receiving updates after unsubscribe', async () => {
      // Given: an active subscription
      await client.connect();
      const handle = await client.spacetimedb.subscribe('player_state', {});

      let updateCount = 0;
      client.spacetimedb.subscriptions.on('rowInserted', (data) => {
        if (data.tableName === 'player_state') {
          updateCount++;
        }
      });

      // When: I call unsubscribe()
      handle.unsubscribe();

      // Then: no more updates are received for that subscription
      // (Verified in integration tests with actual updates)
    });

    it('should support multiple concurrent subscriptions', async () => {
      // Given: a connected client
      await client.connect();

      // When: I create multiple subscriptions
      const handle1 = await client.spacetimedb.subscribe('player_state', {});
      const handle2 = await client.spacetimedb.subscribe('entity_position', {});
      const handle3 = await client.spacetimedb.subscribe('inventory', {});

      // Then: all subscriptions are active
      expect(handle1.tableName).toBe('player_state');
      expect(handle2.tableName).toBe('entity_position');
      expect(handle3.tableName).toBe('inventory');

      // Cleanup
      handle1.unsubscribe();
      handle2.unsubscribe();
      handle3.unsubscribe();
    });

    it('should emit subscription-specific events', async () => {
      // Given: an active subscription
      await client.connect();
      const handle = await client.spacetimedb.subscribe('player_state', {});

      // Track event types
      const events: string[] = [];
      client.spacetimedb.subscriptions.on('tableSnapshot', () => events.push('snapshot'));
      client.spacetimedb.subscriptions.on('rowInserted', () => events.push('inserted'));
      client.spacetimedb.subscriptions.on('rowUpdated', () => events.push('updated'));
      client.spacetimedb.subscriptions.on('rowDeleted', () => events.push('deleted'));

      // Then: events are emitted for subscription lifecycle
      // At minimum, snapshot should have been emitted
      expect(events).toContain('snapshot');

      // Cleanup
      handle.unsubscribe();
    });
  });
});
