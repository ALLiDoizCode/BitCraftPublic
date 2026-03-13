/**
 * Health Check Tests (AC: 3)
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Tests for the health check HTTP endpoint using Node.js built-in http module.
 *
 * Validates: AC3 (health check endpoint), AC5 (server shutdown)
 *
 * Test count: 10
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createHealthServer, closeHealthServer, type HealthServerState } from '../health.js';

/** Helper to make HTTP GET requests */
async function httpGet(
  url: string
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
      })
      .on('error', reject);
  });
}

describe('Health Check Endpoint (Story 3.1)', () => {
  const servers: http.Server[] = [];

  beforeEach(() => {
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Clean up all servers started during tests
    for (const server of servers) {
      await closeHealthServer(server).catch(() => {});
    }
    servers.length = 0;
    vi.restoreAllMocks();
  });

  function createTestState(overrides: Partial<HealthServerState> = {}): HealthServerState {
    return {
      pubkey: 'ab'.repeat(32),
      evmAddress: '0x' + 'ab'.repeat(20),
      connected: true,
      startTime: Date.now(),
      ...overrides,
    };
  }

  async function startTestServer(
    state: HealthServerState
  ): Promise<{ port: number; server: http.Server }> {
    // Use port 0 for random available port
    const { server, listening } = createHealthServer(0, state);
    servers.push(server);
    await listening;
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return { port, server };
  }

  it('GET /health returns JSON with required fields', async () => {
    const state = createTestState();
    const { port } = await startTestServer(state);

    const { status, body } = await httpGet(`http://127.0.0.1:${port}/health`);
    const json = JSON.parse(body);

    expect(status).toBe(200);
    expect(json).toHaveProperty('status');
    expect(json).toHaveProperty('pubkey');
    expect(json).toHaveProperty('evmAddress');
    expect(json).toHaveProperty('connected');
    expect(json).toHaveProperty('uptime');
    expect(json).toHaveProperty('version');
  });

  it('reports connected: false before node.start()', async () => {
    const state = createTestState({ connected: false });
    const { port } = await startTestServer(state);

    const { body } = await httpGet(`http://127.0.0.1:${port}/health`);
    const json = JSON.parse(body);

    expect(json.connected).toBe(false);
    expect(json.status).toBe('starting');
  });

  it('reports connected: true after node.start()', async () => {
    const state = createTestState({ connected: true });
    const { port } = await startTestServer(state);

    const { body } = await httpGet(`http://127.0.0.1:${port}/health`);
    const json = JSON.parse(body);

    expect(json.connected).toBe(true);
    expect(json.status).toBe('ok');
  });

  it('returns pubkey matching configured identity', async () => {
    const expectedPubkey = 'cd'.repeat(32);
    const state = createTestState({ pubkey: expectedPubkey });
    const { port } = await startTestServer(state);

    const { body } = await httpGet(`http://127.0.0.1:${port}/health`);
    const json = JSON.parse(body);

    expect(json.pubkey).toBe(expectedPubkey);
    expect(json.pubkey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns 404 for non-/health endpoints', async () => {
    const state = createTestState();
    const { port } = await startTestServer(state);

    const { status: statusRoot } = await httpGet(`http://127.0.0.1:${port}/`);
    expect(statusRoot).toBe(404);

    const { status: statusDebug } = await httpGet(`http://127.0.0.1:${port}/debug`);
    expect(statusDebug).toBe(404);

    const { status: statusAdmin } = await httpGet(`http://127.0.0.1:${port}/admin`);
    expect(statusAdmin).toBe(404);
  });

  it('server starts on configured port', async () => {
    const state = createTestState();
    const { port } = await startTestServer(state);

    expect(port).toBeGreaterThan(0);

    const { status } = await httpGet(`http://127.0.0.1:${port}/health`);
    expect(status).toBe(200);
  });

  it('server closes during shutdown', async () => {
    const state = createTestState();
    const { port, server } = await startTestServer(state);

    // Server should be responsive
    const { status } = await httpGet(`http://127.0.0.1:${port}/health`);
    expect(status).toBe(200);

    // Close the server
    await closeHealthServer(server);
    // Remove from cleanup list since we closed it manually
    const idx = servers.indexOf(server);
    if (idx >= 0) servers.splice(idx, 1);

    // Server should no longer be responsive
    await expect(httpGet(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  });

  it('includes version and uptime in response', async () => {
    const state = createTestState({ startTime: Date.now() - 5000 }); // 5 seconds ago
    const { port } = await startTestServer(state);

    const { body } = await httpGet(`http://127.0.0.1:${port}/health`);
    const json = JSON.parse(body);

    expect(json.version).toBe('0.1.0');
    expect(typeof json.uptime).toBe('number');
    expect(json.uptime).toBeGreaterThanOrEqual(4); // At least 4 seconds
  });

  it('returns Content-Type: application/json header', async () => {
    const state = createTestState();
    const { port } = await startTestServer(state);

    const { headers } = await httpGet(`http://127.0.0.1:${port}/health`);

    expect(headers['content-type']).toBe('application/json');
  });

  it('returns Content-Type: application/json for 404 responses', async () => {
    const state = createTestState();
    const { port } = await startTestServer(state);

    const { status, headers } = await httpGet(`http://127.0.0.1:${port}/unknown`);

    expect(status).toBe(404);
    expect(headers['content-type']).toBe('application/json');
  });
});
