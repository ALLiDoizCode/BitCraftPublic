/**
 * Static Data Loading Example
 *
 * Demonstrates how to load and query static data tables.
 *
 * Prerequisites:
 * - Docker stack running (from Story 1.3): cd docker && docker compose up
 * - BitCraft server accessible at ws://localhost:3000
 *
 * Run:
 * ```bash
 * tsx packages/client/examples/load-static-data.ts
 * ```
 */

import { SigilClient } from '../src/index';

async function main() {
  console.log('=== Static Data Loading Example ===\n');

  // Create client with auto-load enabled (default)
  const client = new SigilClient({
    spacetimedb: {
      host: 'localhost',
      port: 3000,
      database: 'bitcraft',
      protocol: 'ws',
    },
    autoLoadStaticData: true, // Default: true
  });

  // Listen for loading progress
  client.on('loadingProgress', ({ loaded, total, tableName }) => {
    console.log(`Loading: ${tableName} (${loaded}/${total})`);
  });

  // Listen for loading complete
  client.on('staticDataLoaded', ({ cached, metrics }) => {
    if (cached) {
      console.log('\n✓ Static data loaded from cache');
    } else {
      console.log('\n✓ Static data loaded successfully');
      if (metrics) {
        console.log(`  - Load time: ${metrics.loadTime}ms`);
        console.log(`  - Tables loaded: ${metrics.tableCount}`);
        console.log(`  - Failed tables: ${metrics.failedTables.length}`);
      }
    }
  });

  // Listen for metrics
  client.on('loadingMetrics', ({ totalTime, tableCount, avgTimePerTable }) => {
    console.log('\n📊 Loading Metrics:');
    console.log(`  - Total time: ${totalTime}ms`);
    console.log(`  - Table count: ${tableCount}`);
    console.log(`  - Avg time per table: ${avgTimePerTable.toFixed(2)}ms`);
  });

  try {
    // Connect (static data loads automatically)
    console.log('Connecting to SpacetimeDB...\n');
    await client.connect();

    console.log('\n✓ Connected to SpacetimeDB');
    console.log(`✓ Static data loaded: ${client.isStaticDataLoaded}\n`);

    // Example 1: Get a single item by ID
    console.log('=== Example 1: Get item by ID ===');
    try {
      const item = client.staticData.get('item_desc', 1);
      if (item) {
        console.log('Item #1:', JSON.stringify(item, null, 2));
      } else {
        console.log('Item #1 not found (table may not exist in current schema)');
      }
    } catch (error) {
      console.log('Note: item_desc table may not exist in current BitCraft schema');
      console.log('Error:', (error as Error).message);
    }

    // Example 2: Get all items
    console.log('\n=== Example 2: Get all items ===');
    try {
      const allItems = client.staticData.getAll('item_desc');
      console.log(`Total items: ${allItems.length}`);
      if (allItems.length > 0) {
        console.log('First 3 items:', allItems.slice(0, 3));
      }
    } catch (error) {
      console.log('Note: item_desc table may not exist in current BitCraft schema');
      console.log('Error:', (error as Error).message);
    }

    // Example 3: Query items with filter
    console.log('\n=== Example 3: Query items (filter by rarity) ===');
    try {
      const legendaryItems = client.staticData.query(
        'item_desc',
        (item: any) => item.rarity === 'legendary'
      );
      console.log(`Legendary items: ${legendaryItems.length}`);
    } catch (error) {
      console.log('Note: item_desc table may not exist in current BitCraft schema');
      console.log('Error:', (error as Error).message);
    }

    // Example 4: Check metrics
    console.log('\n=== Example 4: Check loading metrics ===');
    const metrics = client.staticData.getMetrics();
    if (metrics) {
      console.log('Metrics:', {
        loadTime: `${metrics.loadTime}ms`,
        tableCount: metrics.tableCount,
        cachedAt: metrics.cachedAt.toISOString(),
        failedTables: metrics.failedTables.length,
      });
    }

    // Example 5: Test cache persistence
    console.log('\n=== Example 5: Test cache persistence ===');
    console.log('Disconnecting...');
    await client.disconnect();

    console.log('Reconnecting...');
    await client.connect();

    console.log('✓ Reconnected');
    console.log(
      '✓ Cache persisted:',
      client.staticData.isCached() ? 'Yes (no reload)' : 'No (reloaded)'
    );

    // Example 6: Force reload
    console.log('\n=== Example 6: Force reload ===');
    console.log('Forcing reload...');
    await client.staticData.forceReload();
    console.log('✓ Static data reloaded');

    // Clean up
    console.log('\n=== Cleanup ===');
    await client.disconnect();
    console.log('✓ Disconnected');

    console.log('\n✓ Example complete!\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('\n📋 Troubleshooting:');
    console.error('  1. Ensure Docker stack is running: cd docker && docker compose up');
    console.error('  2. Verify BitCraft server is accessible at ws://localhost:3000');
    console.error('  3. Check that the database name is correct (default: "bitcraft")');
    console.error('  4. Verify network connectivity and firewall settings');
    console.error('  5. Check server logs for errors: docker compose logs bitcraft-server');
    console.error(
      '  6. Try manual loading: set autoLoadStaticData: false and call client.staticData.load()'
    );
    console.error('\n💡 Common Issues:');
    console.error('  - Connection refused: Server not running');
    console.error('  - Timeout: Network latency or server overload');
    console.error('  - Missing tables: Schema mismatch or incomplete deployment');
    console.error('  - Memory errors: Reduce BATCH_SIZE or MAX_ROWS_PER_TABLE\n');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
