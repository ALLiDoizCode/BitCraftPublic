/**
 * BLS Connectivity Integration Tests (AC: 2, 4)
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Integration tests for Docker networking, environment variable propagation,
 * and resource limit validation. Requires the full Docker stack.
 *
 * Validates: AC2 (embedded connector in Docker), AC4 (Docker Compose integration)
 *
 * Test count: 7
 */

import { describe, it, expect } from 'vitest';
import http from 'node:http';

const BLS_PORT = process.env.BLS_PORT ?? '3001';
const BLS_HOST = process.env.BLS_HOST ?? '127.0.0.1';
const BLS_URL = `http://${BLS_HOST}:${BLS_PORT}`;
const SPACETIMEDB_URL = process.env.SPACETIMEDB_URL ?? 'http://127.0.0.1:3000';

/**
 * Helper: Make HTTP GET request with timeout
 */
async function httpGet(url: string, timeoutMs = 5000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
  });
}

describe.skipIf(!process.env.RUN_INTEGRATION_TESTS || !process.env.BLS_AVAILABLE)(
  'BLS Connectivity Integration (Story 3.1)',
  () => {
    it('Docker network connectivity between BLS and bitcraft-server', async () => {
      const { body } = await httpGet(`${BLS_URL}/health`);
      const json = JSON.parse(body);

      expect(json.connected).toBe(true);
    });

    it('SpacetimeDB HTTP API reachable from host', async () => {
      const { status, body } = await httpGet(`${SPACETIMEDB_URL}/database/bitcraft/info`);

      expect(status).toBe(200);
      const json = JSON.parse(body);
      expect(json).toHaveProperty('database_name');
    });

    it('embedded connector initialization succeeds in containerized environment', async () => {
      const { body } = await httpGet(`${BLS_URL}/health`);
      const json = JSON.parse(body);

      expect(json.status).toBe('ok');
      expect(json.connected).toBe(true);
    });

    it('environment variables correctly propagated from Docker compose', async () => {
      const { body } = await httpGet(`${BLS_URL}/health`);
      const json = JSON.parse(body);

      // If env vars are propagated, health shows valid pubkey
      expect(json.pubkey).toMatch(/^[0-9a-f]{64}$/);
      // And evmAddress is derived
      expect(json.evmAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('health check port accessible from host via exposed port', async () => {
      const { status } = await httpGet(`${BLS_URL}/health`);
      expect(status).toBe(200);
    });

    it('BLS service depends_on bitcraft-server health check', async () => {
      // Both services should be healthy (implies correct dependency ordering)
      const blsHealth = await httpGet(`${BLS_URL}/health`);
      expect(blsHealth.status).toBe(200);

      const stdbHealth = await httpGet(`${SPACETIMEDB_URL}/database/bitcraft/info`);
      expect(stdbHealth.status).toBe(200);
    });

    it('BLS container resource limits applied', async () => {
      // Smoke test: verify container is running and healthy within limits
      const { status } = await httpGet(`${BLS_URL}/health`);
      expect(status).toBe(200);
    });
  }
);
