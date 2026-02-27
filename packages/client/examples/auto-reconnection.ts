/**
 * Auto-Reconnection Example
 * Story 1.6: Demonstrates automatic reconnection with exponential backoff
 *
 * This example shows how the Sigil client automatically reconnects
 * when the connection is lost unexpectedly.
 */

import { SigilClient } from '../src';

async function main() {
  console.log('=== Auto-Reconnection Example ===\n');

  // Create client with reconnection options
  const client = new SigilClient({
    spacetimedb: {
      host: 'localhost',
      port: 3000,
      database: 'bitcraft',
      protocol: 'ws',
    },
    reconnection: {
      autoReconnect: true,
      maxReconnectAttempts: 10,
      initialDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds max (NFR10)
      jitterPercent: 10, // ±10% randomization
    },
  });

  // Listen for reconnection state changes
  client.on('reconnectionChange', (event) => {
    console.log(`[Reconnection] Status: ${event.status}`);
    if (event.reason) {
      console.log(`  Reason: ${event.reason}`);
    }
    if (event.attemptNumber) {
      console.log(`  Attempt: ${event.attemptNumber}`);
      console.log(`  Next delay: ${event.nextAttemptDelay}ms`);
    }
    if (event.error) {
      console.log(`  Error: ${event.error.message}`);
    }
  });

  // Listen for subscription recovery
  client.on('subscriptionsRecovered', (event) => {
    console.log(`[Recovery] Subscriptions recovered:`);
    console.log(`  Total: ${event.totalSubscriptions}`);
    console.log(`  Successful: ${event.successfulSubscriptions}`);
    console.log(`  Failed: ${event.failedSubscriptions}`);
    console.log(`  Time: ${event.recoveryTimeMs}ms`);
  });

  // Listen for regular connection events
  client.on('connectionChange', (event) => {
    console.log(`[Connection] State: ${event.state}`);
  });

  try {
    console.log('Connecting to BitCraft server...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Get current state
    console.log(`Reconnection state: ${client.getReconnectionState()}`);

    // Get metrics
    const metrics = client.getReconnectionMetrics();
    if (metrics) {
      console.log('\nReconnection Metrics:');
      console.log(`  Attempt count: ${metrics.attemptCount}`);
      console.log(`  Successful reconnects: ${metrics.successfulReconnects}`);
      console.log(`  Failed reconnects: ${metrics.failedReconnects}`);
      console.log(`  Average reconnect time: ${metrics.avgReconnectTime}ms`);
    }

    // Note: In a real scenario, you would:
    // 1. Subscribe to tables
    // 2. Simulate a disconnect (kill server, network issue, etc.)
    // 3. Observe auto-reconnection behavior
    // 4. Verify subscriptions are restored

    console.log('\n=== Automatic reconnection is now active ===');
    console.log(
      'If the connection is lost, it will automatically reconnect with exponential backoff.'
    );
    console.log('Press Ctrl+C to exit.\n');

    // Keep the process alive
    await new Promise(() => {
      // Wait forever
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
