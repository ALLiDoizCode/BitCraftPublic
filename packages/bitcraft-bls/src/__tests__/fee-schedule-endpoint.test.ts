/**
 * Fee Schedule Endpoint Tests (AC: 4)
 * Story 3.3: Pricing Configuration & Fee Schedule
 *
 * Tests for the GET /fee-schedule endpoint on the health server.
 * Verifies that fee schedule data is publicly accessible and
 * NEVER includes tokens or keys.
 *
 * Validates: AC4 (client registry consistency, fee transparency)
 *
 * Test count: 5
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import http from 'node:http';
import { createHealthServer, closeHealthServer, type HealthServerState } from '../health.js';
import type { FeeSchedule } from '../fee-schedule.js';

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

describe('Fee Schedule Endpoint (Story 3.3)', () => {
  const servers: http.Server[] = [];

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
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
    state: HealthServerState,
    feeSchedule?: FeeSchedule
  ): Promise<{ port: number; server: http.Server }> {
    // Set fee schedule on state for /fee-schedule endpoint
    if (feeSchedule) {
      state.feeSchedule = feeSchedule;
    }
    const { server, listening } = createHealthServer(0, state);
    servers.push(server);
    await listening;
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return { port, server };
  }

  it('GET /fee-schedule returns JSON fee schedule', async () => {
    // Given a health server with a loaded fee schedule
    const feeSchedule: FeeSchedule = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1 },
        empire_form: { cost: 100 },
      },
    };
    const state = createTestState();
    const { port } = await startTestServer(state, feeSchedule);

    // When requesting GET /fee-schedule
    const { status, body, headers } = await httpGet(`http://127.0.0.1:${port}/fee-schedule`);

    // Then it should return 200 with JSON
    expect(status).toBe(200);
    expect(headers['content-type']).toBe('application/json');

    const json = JSON.parse(body);
    expect(json).toBeDefined();
  });

  it('response includes all reducer costs', async () => {
    // Given a fee schedule with multiple reducers
    const feeSchedule: FeeSchedule = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1 },
        craft_item: { cost: 15 },
        empire_form: { cost: 100 },
      },
    };
    const state = createTestState();
    const { port } = await startTestServer(state, feeSchedule);

    // When requesting GET /fee-schedule
    const { body } = await httpGet(`http://127.0.0.1:${port}/fee-schedule`);
    const json = JSON.parse(body);

    // Then all reducer costs should be present
    expect(json.actions).toBeDefined();
    expect(json.actions.player_move.cost).toBe(1);
    expect(json.actions.craft_item.cost).toBe(15);
    expect(json.actions.empire_form.cost).toBe(100);
  });

  it('response includes default cost', async () => {
    // Given a fee schedule with defaultCost 10
    const feeSchedule: FeeSchedule = {
      version: 1,
      defaultCost: 10,
      actions: {},
    };
    const state = createTestState();
    const { port } = await startTestServer(state, feeSchedule);

    // When requesting GET /fee-schedule
    const { body } = await httpGet(`http://127.0.0.1:${port}/fee-schedule`);
    const json = JSON.parse(body);

    // Then defaultCost should be present
    expect(json.defaultCost).toBe(10);
  });

  it('endpoint returns default when no fee schedule loaded', async () => {
    // Given a health server WITHOUT a loaded fee schedule
    const state = createTestState();
    const { port } = await startTestServer(state);

    // When requesting GET /fee-schedule
    const { status, body } = await httpGet(`http://127.0.0.1:${port}/fee-schedule`);

    // Then it should return a default response (from kindPricing)
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json.version).toBe(1);
    expect(json.defaultCost).toBe(100);
    expect(json.actions).toEqual({});
  });

  it('endpoint NEVER includes tokens or keys in response (OWASP A02)', async () => {
    // Given a health server with fee schedule AND sensitive data on state
    const feeSchedule: FeeSchedule = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1 },
      },
    };
    const state = createTestState();
    const { port } = await startTestServer(state, feeSchedule);

    // When requesting GET /fee-schedule
    const { body } = await httpGet(`http://127.0.0.1:${port}/fee-schedule`);

    // Then the response should NEVER contain sensitive values from HealthServerState
    // Check for the actual sensitive values, not generic substrings like "key"
    // (which could false-positive on action names like "key_exchange")
    expect(body).not.toContain('test-admin-token'); // SPACETIMEDB_TOKEN value
    expect(body).not.toContain('SPACETIMEDB_TOKEN');
    expect(body).not.toContain(state.pubkey); // Node pubkey should not leak
    expect(body).not.toContain(state.evmAddress); // EVM address should not leak
    expect(body).not.toContain('password');

    // Parse and verify only expected fields are present at the top level
    const json = JSON.parse(body);
    const allowedKeys = ['version', 'defaultCost', 'actions'];
    for (const topKey of Object.keys(json)) {
      expect(allowedKeys).toContain(topKey);
    }
  });
});
