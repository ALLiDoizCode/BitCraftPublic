/**
 * Example: Subscribe to Game State
 *
 * Demonstrates SpacetimeDB connection and table subscriptions.
 *
 * Prerequisites:
 * - Docker stack from Story 1.3 must be running
 * - BitCraft server accessible at ws://localhost:3000
 *
 * Run with: tsx packages/client/examples/subscribe-to-game-state.ts
 */

import { SigilClient } from '../src/index';

async function main() {
  console.log('Creating Sigil client...');

  // Create client with SpacetimeDB configuration
  const client = new SigilClient({
    spacetimedb: {
      host: 'localhost',
      port: 3000,
      database: 'bitcraft',
      protocol: 'ws',
    },
  });

  // Listen for connection state changes
  client.on('connectionChange', ({ state, error }) => {
    console.log(`[Connection] State: ${state}`);
    if (error) {
      console.error(`[Connection] Error:`, error.message);
    }
  });

  // Listen for game state updates (aggregated)
  client.on('gameStateUpdate', (updates) => {
    console.log(`[Game State] Received ${updates.length} updates`);
  });

  // Listen for latency warnings
  client.spacetimedb.latency.on('updateLatency', ({ latency }) => {
    if (latency > 100) {
      console.log(`[Latency] Update latency: ${latency}ms`);
    }
  });

  try {
    // Connect to SpacetimeDB
    console.log('Connecting to SpacetimeDB at ws://localhost:3000...');
    await client.connect();
    console.log('Connected successfully!');

    // Subscribe to player_state table
    console.log('Subscribing to player_state table...');
    const playerHandle = await client.spacetimedb.subscribe('player_state', {});
    console.log(`Subscribed to player_state (ID: ${playerHandle.id})`);

    // Subscribe to entity_position table
    console.log('Subscribing to entity_position table...');
    const positionHandle = await client.spacetimedb.subscribe('entity_position', {});
    console.log(`Subscribed to entity_position (ID: ${positionHandle.id})`);

    // Subscribe to inventory table
    console.log('Subscribing to inventory table...');
    const inventoryHandle = await client.spacetimedb.subscribe('inventory', {});
    console.log(`Subscribed to inventory (ID: ${inventoryHandle.id})`);

    // Listen for table snapshots (initial data)
    client.spacetimedb.subscriptions.on('tableSnapshot', ({ tableName, rows }) => {
      console.log(`[Snapshot] ${tableName}: received ${rows.length} rows`);
    });

    // Listen for row insertions
    client.spacetimedb.subscriptions.on('rowInserted', ({ tableName, row }) => {
      console.log(`[Insert] ${tableName}:`, row);
    });

    // Listen for row updates
    client.spacetimedb.subscriptions.on('rowUpdated', ({ tableName, newRow }) => {
      console.log(`[Update] ${tableName}:`, newRow);
    });

    // Listen for row deletions
    client.spacetimedb.subscriptions.on('rowDeleted', ({ tableName, row }) => {
      console.log(`[Delete] ${tableName}:`, row);
    });

    // Wait a bit for initial snapshots
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Access cached data
    console.log('\nAccessing cached data via table accessors:');
    const players = client.spacetimedb.tables.player_state.getAll();
    console.log(`Total players in cache: ${players.length}`);

    const positions = client.spacetimedb.tables.entity_position.getAll();
    console.log(`Total entity positions in cache: ${positions.length}`);

    const items = client.spacetimedb.tables.inventory.getAll();
    console.log(`Total inventory items in cache: ${items.length}`);

    // Query with predicate
    const activePlayers = client.spacetimedb.tables.player_state.query(
      (player: any) => player.isActive === true
    );
    console.log(`Active players: ${activePlayers.length}`);

    // Display latency statistics
    const stats = client.spacetimedb.latency.getStats();
    console.log('\nLatency statistics:');
    console.log(`  Average: ${stats.avg}ms`);
    console.log(`  P50: ${stats.p50}ms`);
    console.log(`  P95: ${stats.p95}ms`);
    console.log(`  P99: ${stats.p99}ms`);
    console.log(`  Sample count: ${stats.count}`);

    // Run for 30 seconds, listening to updates
    console.log('\nListening for updates for 30 seconds...');
    console.log('(Make changes to the database to see real-time updates)');

    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Disconnect
    console.log('\nDisconnecting...');
    await client.disconnect();
    console.log('Disconnected. Example complete!');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
