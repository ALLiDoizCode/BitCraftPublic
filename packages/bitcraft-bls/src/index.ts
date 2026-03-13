/**
 * @sigil/bitcraft-bls - BitCraft BLS Game Action Handler
 *
 * Entry point for the BLS node service. Creates a Crosstown node using
 * @crosstown/sdk with embedded connector mode for processing ILP-routed
 * game actions.
 *
 * This module:
 * 1. Loads configuration from environment variables
 * 2. Creates the BLS node (wrapping @crosstown/sdk)
 * 3. Starts the health check HTTP server
 * 4. Sets up graceful shutdown handlers
 * 5. Starts the node
 *
 * Handler registration for kind 30078 (game actions) is done in Story 3.2.
 */

// Re-export public API for library consumers
export { loadConfig, type BLSConfig } from './config.js';
export { createBLSNode, type BLSNodeResult } from './node.js';
export {
  createHealthServer,
  closeHealthServer,
  type HealthStatus,
  type HealthServerState,
} from './health.js';
export { setupShutdownHandlers, type ShutdownOptions } from './lifecycle.js';

import { loadConfig } from './config.js';
import { createBLSNode } from './node.js';
import { createHealthServer, type HealthServerState } from './health.js';
import { setupShutdownHandlers } from './lifecycle.js';

/**
 * Main entry point. Called when running `node dist/index.js`.
 */
async function main(): Promise<void> {
  console.log('[BLS] Starting BitCraft BLS Game Action Handler...');

  // 1. Load configuration
  const config = loadConfig();

  // 2. Create BLS node
  const { node, identity } = createBLSNode(config);

  // 3. Start health check server
  const healthState: HealthServerState = {
    pubkey: identity.pubkey,
    evmAddress: identity.evmAddress,
    connected: false,
    startTime: Date.now(),
  };
  const { server: healthServer, listening } = createHealthServer(config.port, healthState);
  await listening;

  // 4. Set up shutdown handlers
  setupShutdownHandlers(node, healthServer);

  // 5. Start the node
  let result;
  try {
    result = await node.start();
  } catch (err) {
    healthState.error = true;
    throw err;
  }
  healthState.connected = true;

  console.log('[BLS] BLS node started successfully');
  console.log(`[BLS]   Pubkey: ${identity.pubkey}`);
  console.log(`[BLS]   EVM Address: ${identity.evmAddress}`);
  console.log(`[BLS]   ILP Address: ${config.ilpAddress}`);
  console.log(`[BLS]   Peers: ${result.peerCount}, Channels: ${result.channelCount}`);
  console.log('[BLS] Ready to process game actions');
}

// Only run main() when this file is executed directly (not imported as a library).
// import.meta.url is only available in ESM; in CJS builds it is empty, so
// fileURLToPath would throw — the try/catch ensures the CJS bundle simply
// skips direct execution (CJS consumers use the library API, not the CLI).
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

let isDirectExecution = false;
try {
  isDirectExecution =
    typeof process !== 'undefined' &&
    process.argv[1] !== undefined &&
    import.meta.url !== '' &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url);
} catch {
  // CJS build: import.meta.url is empty, fileURLToPath throws — not direct execution
}

if (isDirectExecution) {
  main().catch((err: unknown) => {
    console.error('[BLS] Fatal error:', err);
    process.exit(1);
  });
}
