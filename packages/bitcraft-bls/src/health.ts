/**
 * Health Check HTTP Server
 *
 * Provides a lightweight health endpoint using Node.js built-in http module.
 * Reports node status, identity, and connectivity.
 * Story 3.3: Added GET /fee-schedule endpoint for fee transparency (NFR12).
 *
 * SECURITY: NEVER exposes secret keys or admin tokens (OWASP A02).
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import type { FeeSchedule } from './fee-schedule.js';

/** Package version read from package.json (cached at module load) */
const PACKAGE_VERSION: string = (() => {
  try {
    // Use createRequire for CJS-compatible JSON loading (avoids import.meta in CJS builds)
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
})();

/**
 * Health status information.
 */
export interface HealthStatus {
  status: 'ok' | 'starting' | 'error';
  pubkey: string;
  evmAddress: string;
  connected: boolean;
  uptime: number;
  version: string;
}

/**
 * Health check server state.
 */
export interface HealthServerState {
  pubkey: string;
  evmAddress: string;
  connected: boolean;
  startTime: number;
  /** Set to true if the node encountered a fatal error during startup */
  error?: boolean;
  /** Loaded fee schedule for /fee-schedule endpoint (Story 3.3) */
  feeSchedule?: FeeSchedule;
}

/**
 * Create and start the health check HTTP server.
 *
 * @param port - Port to listen on
 * @param state - Mutable state object (connected flag updated externally)
 * @param host - Host to bind to (default: '127.0.0.1' for security; use '0.0.0.0' in Docker)
 * @returns The HTTP server instance (and a promise that resolves when listening)
 */
export function createHealthServer(
  port: number,
  state: HealthServerState,
  host?: string
): { server: Server; listening: Promise<void> } {
  const bindHost = host ?? (process.env.BLS_BIND_HOST || '127.0.0.1');

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Only respond to GET /health
    if (req.method === 'GET' && req.url === '/health') {
      const uptimeMs = Date.now() - state.startTime;
      const uptimeSeconds = Math.floor(uptimeMs / 1000);

      const status: HealthStatus['status'] = state.error
        ? 'error'
        : state.connected
          ? 'ok'
          : 'starting';

      const health: HealthStatus = {
        status,
        pubkey: state.pubkey,
        evmAddress: state.evmAddress,
        connected: state.connected,
        uptime: uptimeSeconds,
        version: PACKAGE_VERSION,
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
      return;
    }

    // GET /fee-schedule -- publicly verifiable fee data (Story 3.3, NFR12)
    // SECURITY: returns ONLY fee data, NEVER tokens or keys (OWASP A02)
    if (req.method === 'GET' && req.url === '/fee-schedule') {
      const feeData = state.feeSchedule
        ? {
            version: state.feeSchedule.version,
            defaultCost: state.feeSchedule.defaultCost,
            actions: state.feeSchedule.actions,
          }
        : { version: 1, defaultCost: 100, actions: {} };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(feeData));
      return;
    }

    // 404 for everything else
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  // Set timeouts to mitigate slowloris-type attacks
  server.headersTimeout = 10_000; // 10s to receive headers
  server.requestTimeout = 10_000; // 10s for entire request

  const listening = new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, bindHost, () => {
      console.log(`[BLS] Health check server listening on ${bindHost}:${port}`);
      resolve();
    });
  });

  return { server, listening };
}

/**
 * Close the health check server gracefully.
 */
export function closeHealthServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
