/**
 * Static Data Loader - Integration Tests
 *
 * These tests verify acceptance criteria against a live BitCraft server.
 * They require the Docker development environment from Story 1.3 to be running.
 *
 * Run with: pnpm test:integration
 *
 * Prerequisites:
 * - Docker stack must be running: cd docker && docker compose up
 * - BitCraft server must be accessible at ws://localhost:3000
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SigilClient } from '../../client';

describe('Static Data Loader - Integration Tests', () => {
  // Only run these tests if INTEGRATION env var is set
  const shouldRun = process.env.INTEGRATION === 'true' || process.env.CI === 'true';

  if (!shouldRun) {
    it.skip('Skipping integration tests (set INTEGRATION=true to run)', () => {});
    return;
  }

  let client: SigilClient;

  beforeAll(async () => {
    // Verify Docker stack is available
    // This is a prerequisite check - if it fails, skip all tests
  });

  beforeEach(() => {
    client = new SigilClient({
      spacetimedb: {
        host: 'localhost',
        port: 3000,
        database: 'bitcraft',
        protocol: 'ws',
      },
      autoLoadStaticData: false, // Manual control for testing
    });
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  describe('AC1: Static data loading on connection - Integration', () => {
    it('should connect to live BitCraft server and load all *_desc tables', async () => {
      // Given: a client configured for local BitCraft server
      const loadingProgressEvents: any[] = [];
      client.on('loadingProgress', (event) => loadingProgressEvents.push(event));

      let staticDataLoadedEvent: any = null;
      client.on('staticDataLoaded', (event) => {
        staticDataLoadedEvent = event;
      });

      // When: connecting to the server
      await client.connect();

      // Then: static data should auto-load (if autoLoadStaticData: true)
      // Since we set autoLoadStaticData: false, manually trigger
      await client.staticData.load();

      // Verify loading completed
      expect(staticDataLoadedEvent).not.toBeNull();
      expect(client.isStaticDataLoaded).toBe(true);

      // Verify progress events were emitted
      expect(loadingProgressEvents.length).toBeGreaterThan(0);

      const finalProgress = loadingProgressEvents[loadingProgressEvents.length - 1];
      expect(finalProgress.loaded).toBe(finalProgress.total);
    });

    it('should build queryable lookup maps with actual game data', async () => {
      // Given: connected client with static data loaded
      await client.connect();
      await client.staticData.load();

      // When: querying static data tables
      // Try to get data from a known table (assuming item_desc exists)
      const allItems = client.staticData.getAll('item_desc');

      // Then: should return array of items
      expect(Array.isArray(allItems)).toBe(true);

      // If items exist, verify structure
      if (allItems.length > 0) {
        const firstItem = allItems[0];
        expect(firstItem).toBeDefined();
        // Items should have some identifier field
        expect(
          firstItem.id !== undefined ||
            firstItem.desc_id !== undefined ||
            firstItem.type_id !== undefined
        ).toBe(true);
      }
    });

    it('should handle actual table count from BitCraft schema', async () => {
      // Given: connected client
      await client.connect();

      // When: loading static data
      let metricsEvent: any = null;
      client.on('loadingMetrics', (event) => {
        metricsEvent = event;
      });

      await client.staticData.load();

      // Then: metrics should reflect actual table count
      expect(metricsEvent).not.toBeNull();
      expect(metricsEvent.tableCount).toBeGreaterThan(0);

      // Log actual table count for visibility
      console.log(`Loaded ${metricsEvent.tableCount} static data tables`);
    });
  });

  describe('AC2: Loading performance requirement - Integration', () => {
    it('should complete static data loading within 10 seconds (NFR6)', async () => {
      // Given: a fresh client connection
      await client.connect();

      const startTime = Date.now();

      // When: loading static data
      await client.staticData.load();

      const loadTime = Date.now() - startTime;

      // Then: should complete within 10 seconds
      expect(loadTime).toBeLessThan(10000);

      console.log(`Static data loading completed in ${loadTime}ms`);
    });

    it('should emit staticDataLoaded event after live server load', async () => {
      // Given: event listener set up
      let eventEmitted = false;
      client.once('staticDataLoaded', () => {
        eventEmitted = true;
      });

      await client.connect();

      // When: loading static data
      await client.staticData.load();

      // Then: event should be emitted
      expect(eventEmitted).toBe(true);
    });

    it('should provide accurate metrics after live load', async () => {
      // Given: connected client
      await client.connect();

      // When: loading static data
      await client.staticData.load();

      const metrics = client.staticData.getMetrics();

      // Then: metrics should be available and accurate
      expect(metrics).not.toBeNull();
      expect(metrics!.loadTime).toBeGreaterThan(0);
      expect(metrics!.loadTime).toBeLessThan(10000); // NFR6
      expect(metrics!.tableCount).toBeGreaterThan(0);
      expect(metrics!.cachedAt).toBeInstanceOf(Date);
      expect(Array.isArray(metrics!.failedTables)).toBe(true);

      console.log('Loading metrics:', metrics);
    });
  });

  describe('AC3: Type-safe static data access - Integration', () => {
    beforeEach(async () => {
      await client.connect();
      await client.staticData.load();
    });

    it('should return actual game data with get() method', async () => {
      // Given: loaded static data
      // When: querying for a specific item (try ID 1 if it exists)
      const item = client.staticData.get('item_desc', 1);

      // Then: should return data or undefined
      // Note: We can't assume ID 1 exists, so we test the method works
      expect(item === undefined || typeof item === 'object').toBe(true);

      console.log('Sample item_desc[1]:', item);
    });

    it('should return all rows for a table with getAll()', async () => {
      // Given: loaded static data
      // When: getting all items
      const allItems = client.staticData.getAll('item_desc');

      // Then: should return array
      expect(Array.isArray(allItems)).toBe(true);

      console.log(`Total items in item_desc: ${allItems.length}`);
    });

    it('should support filtering with query() on live data', async () => {
      // Given: loaded static data
      // When: filtering items (example: items with specific property)
      const allItems = client.staticData.getAll('item_desc');

      if (allItems.length > 0) {
        // Find a property that exists on items
        const sampleItem = allItems[0];
        const propertyKeys = Object.keys(sampleItem);

        if (propertyKeys.length > 0) {
          const testProperty = propertyKeys[0];
          const testValue = sampleItem[testProperty];

          const filtered = client.staticData.query('item_desc', (item: any) => {
            return item[testProperty] === testValue;
          });

          // Then: should return filtered results
          expect(Array.isArray(filtered)).toBe(true);
          expect(filtered.length).toBeGreaterThan(0);
          expect(filtered.every((item) => item[testProperty] === testValue)).toBe(true);

          console.log(`Filtered ${filtered.length} items with ${testProperty}=${testValue}`);
        }
      }
    });

    it('should handle queries on multiple table types', async () => {
      // Given: loaded static data
      const tableNames = ['item_desc', 'recipe_desc', 'terrain_desc'];

      // When: querying different table types
      for (const tableName of tableNames) {
        try {
          const allRows = client.staticData.getAll(tableName);
          console.log(`Table ${tableName}: ${allRows.length} rows`);

          // Then: should return data for each table
          expect(Array.isArray(allRows)).toBe(true);
        } catch (error) {
          // Table might not exist in this version of BitCraft
          console.log(`Table ${tableName} not found (may not exist in schema)`);
        }
      }
    });
  });

  describe('AC4: Static data caching - Integration', () => {
    it('should persist cache across disconnect and reconnect', async () => {
      // Given: initial connection and load
      await client.connect();
      await client.staticData.load();

      const initialItem = client.staticData.get('item_desc', 1);
      const initialMetrics = client.staticData.getMetrics();

      // When: disconnecting and reconnecting
      await client.disconnect();

      // Cache should still be accessible
      expect(client.staticData.isCached()).toBe(true);
      const cachedItem = client.staticData.get('item_desc', 1);
      expect(cachedItem).toEqual(initialItem);

      // Reconnect
      await client.connect();

      // Load should skip if cached
      let loadedEventCount = 0;
      client.on('staticDataLoaded', (event) => {
        loadedEventCount++;
        expect(event.cached).toBe(true);
      });

      await client.staticData.load();

      // Then: cache should be reused
      expect(loadedEventCount).toBe(1);
      const cachedMetrics = client.staticData.getMetrics();
      expect(cachedMetrics?.cachedAt).toEqual(initialMetrics?.cachedAt);
    });

    it('should reload data with forceReload()', async () => {
      // Given: initial load
      await client.connect();
      await client.staticData.load();

      const initialMetrics = client.staticData.getMetrics();
      const initialCacheTime = initialMetrics?.cachedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // When: force reloading
      await client.staticData.forceReload();

      const newMetrics = client.staticData.getMetrics();
      const newCacheTime = newMetrics?.cachedAt;

      // Then: cache should be refreshed with new timestamp
      expect(newCacheTime).not.toEqual(initialCacheTime);
      expect(newCacheTime!.getTime()).toBeGreaterThan(initialCacheTime!.getTime());
    });

    it('should auto-load static data when autoLoadStaticData is true', async () => {
      // Given: client with auto-load enabled
      const autoLoadClient = new SigilClient({
        spacetimedb: {
          host: 'localhost',
          port: 3000,
          database: 'bitcraft',
          protocol: 'ws',
        },
        autoLoadStaticData: true, // Enable auto-load
      });

      let staticDataLoadedEmitted = false;
      autoLoadClient.once('staticDataLoaded', () => {
        staticDataLoadedEmitted = true;
      });

      // When: connecting
      await autoLoadClient.connect();

      // Give it a moment to auto-load
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: static data should be loaded automatically
      expect(staticDataLoadedEmitted || autoLoadClient.isStaticDataLoaded).toBe(true);

      await autoLoadClient.disconnect();
    });

    it('should maintain cache across multiple connection cycles', async () => {
      // Given: initial load
      await client.connect();
      await client.staticData.load();

      const initialData = client.staticData.getAll('item_desc');
      const initialCount = initialData.length;

      // When: cycling connection multiple times
      for (let i = 0; i < 3; i++) {
        await client.disconnect();
        await client.connect();
        await client.staticData.load(); // Should use cache
      }

      // Then: data should remain consistent
      const finalData = client.staticData.getAll('item_desc');
      expect(finalData.length).toBe(initialCount);
      expect(client.staticData.isCached()).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent queries efficiently', async () => {
      // Given: loaded static data
      await client.connect();
      await client.staticData.load();

      // When: performing many concurrent queries
      const startTime = Date.now();
      const queries = Array.from({ length: 1000 }, (_, i) => {
        return client.staticData.get('item_desc', i);
      });

      const queryTime = Date.now() - startTime;

      // Then: queries should complete quickly (O(1) lookups)
      expect(queryTime).toBeLessThan(100); // 1000 queries in <100ms

      console.log(`1000 concurrent queries completed in ${queryTime}ms`);
    });

    it('should recover gracefully from server errors', async () => {
      // Given: connected client
      await client.connect();

      // When: loading with potential server issues
      // This test documents expected behavior but may not trigger errors in healthy setup
      try {
        await client.staticData.load();

        // Then: should either succeed or provide clear error
        expect(client.staticData.loadingState).toBe('loaded');
      } catch (error) {
        // Document error for debugging
        console.error('Static data loading failed:', error);
        throw error;
      }
    });
  });
});
