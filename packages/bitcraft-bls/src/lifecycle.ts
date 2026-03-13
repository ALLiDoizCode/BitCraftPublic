/**
 * Process Lifecycle & Graceful Shutdown
 *
 * Handles SIGTERM/SIGINT signals for graceful shutdown of the BLS node.
 * Waits for in-flight requests to complete before exiting.
 */

import type { Server } from 'node:http';
import type { CrosstownNode } from '@crosstown/sdk';
import { closeHealthServer } from './health.js';

/**
 * Options for shutdown handlers.
 */
export interface ShutdownOptions {
  /** Maximum time (ms) to wait for in-flight requests before forcing exit */
  drainTimeout?: number;
}

/**
 * Set up SIGTERM and SIGINT handlers for graceful shutdown.
 *
 * On signal:
 * 1. Set shuttingDown flag (prevents new request acceptance)
 * 2. Wait for in-flight requests to complete (with timeout)
 * 3. Call node.stop()
 * 4. Close health HTTP server
 * 5. Exit process
 *
 * @param node - The Crosstown node to shut down
 * @param healthServer - The health check HTTP server to close
 * @param options - Shutdown configuration
 * @returns Cleanup function to remove signal handlers (for testing)
 */
export function setupShutdownHandlers(
  node: CrosstownNode,
  healthServer: Server,
  options: ShutdownOptions = {}
): () => void {
  const drainTimeout = options.drainTimeout ?? 10_000;
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      console.log(`[BLS] Already shutting down, ignoring ${signal}`);
      return;
    }
    shuttingDown = true;

    console.log(`[BLS] Received ${signal}. Shutting down BLS node...`);

    // Wait for in-flight requests to complete
    const inFlight = node.inFlightCount;
    if (inFlight > 0) {
      console.log(`[BLS] In-flight requests: ${inFlight}. Waiting up to ${drainTimeout}ms...`);
      const start = Date.now();
      while (node.inFlightCount > 0 && Date.now() - start < drainTimeout) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (node.inFlightCount > 0) {
        console.log(`[BLS] Drain timeout reached. ${node.inFlightCount} requests still in flight.`);
      }
    }

    try {
      await node.stop();
      console.log('[BLS] BLS node stopped');
    } catch (err) {
      console.error('[BLS] Error stopping node:', err);
    }

    try {
      await closeHealthServer(healthServer);
      console.log('[BLS] Health check server closed');
    } catch (err) {
      console.error('[BLS] Error closing health server:', err);
    }

    console.log('[BLS] Shutdown complete');
    process.exit(0);
  };

  const sigTermHandler = () => {
    void shutdown('SIGTERM');
  };
  const sigIntHandler = () => {
    void shutdown('SIGINT');
  };

  process.on('SIGTERM', sigTermHandler);
  process.on('SIGINT', sigIntHandler);

  // Return cleanup function for testing
  return () => {
    process.removeListener('SIGTERM', sigTermHandler);
    process.removeListener('SIGINT', sigIntHandler);
  };
}
