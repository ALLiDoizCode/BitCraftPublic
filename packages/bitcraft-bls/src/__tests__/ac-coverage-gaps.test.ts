/**
 * Acceptance Criteria Coverage Gap Tests
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Tests identified by TEA testarch-automate workflow that fill gaps
 * in the existing test suite. Each test is tagged with the AC it validates
 * and the specific gap it addresses.
 *
 * Test count: 16
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createNode,
  type EmbeddedConnector,
  type HandlerContext,
  type AcceptResponse,
  type RejectResponse,
} from '@crosstown/sdk';
import { createHealthServer, closeHealthServer, type HealthServerState } from '../health.js';
import { setupShutdownHandlers } from '../lifecycle.js';

// ---------------------------------------------------------------------------
// AC1: @crosstown/sdk is a project dependency
// Gap: No test verifies the package.json dependency listing
// ---------------------------------------------------------------------------

describe('[AC1] Package dependency verification', () => {
  it('package.json lists @crosstown/sdk as a dependency', () => {
    // Given the @sigil/bitcraft-bls package.json
    const pkgPath = resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    // When we check its dependencies
    // Then @crosstown/sdk is listed
    expect(pkg.dependencies).toHaveProperty('@crosstown/sdk');
    expect(pkg.dependencies['@crosstown/sdk']).toMatch(/^workspace:/);
  });

  it('package.json has correct package name @sigil/bitcraft-bls', () => {
    // Given the bitcraft-bls package.json
    const pkgPath = resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    // Then the name follows @sigil/* convention
    expect(pkg.name).toBe('@sigil/bitcraft-bls');
  });

  it('package.json is type: module', () => {
    // Given the bitcraft-bls package.json
    const pkgPath = resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    // Then it uses ESM
    expect(pkg.type).toBe('module');
  });
});

// ---------------------------------------------------------------------------
// AC2: Node initialization uses embedded connector mode
// Gap: No test verifies connector.start() is called during node.start()
// ---------------------------------------------------------------------------

describe('[AC2] Embedded connector initialization', () => {
  it('node.start() calls connector.start() for embedded mode', async () => {
    // Given a node created with an embedded connector
    const connectorStartSpy = vi.fn().mockResolvedValue(undefined);
    const connector: EmbeddedConnector = {
      start: connectorStartSpy,
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const node = createNode({
      secretKey: new Uint8Array(32).fill(0xab),
      connector,
      ilpAddress: 'g.crosstown.test',
    });

    // When the node starts
    await node.start();

    // Then the embedded connector's start() is invoked
    expect(connectorStartSpy).toHaveBeenCalledOnce();

    // Cleanup
    await node.stop();
  });

  it('node.stop() calls connector.stop() for embedded mode', async () => {
    // Given a started node with an embedded connector
    const connectorStopSpy = vi.fn().mockResolvedValue(undefined);
    const connector: EmbeddedConnector = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: connectorStopSpy,
    };

    const node = createNode({
      secretKey: new Uint8Array(32).fill(0xab),
      connector,
      ilpAddress: 'g.crosstown.test',
    });

    await node.start();

    // When the node stops
    await node.stop();

    // Then the embedded connector's stop() is invoked
    expect(connectorStopSpy).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// AC3: Health check endpoint
// Gap: No test verifies health does NOT expose secretKey or token
// Gap: No test verifies evmAddress format (0x-prefixed)
// Gap: No test verifies pubkey and ILP address are logged on startup
// ---------------------------------------------------------------------------

describe('[AC3] Health check security and format', () => {
  const servers: http.Server[] = [];

  beforeEach(() => {
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    for (const server of servers) {
      await closeHealthServer(server).catch(() => {});
    }
    servers.length = 0;
    vi.restoreAllMocks();
  });

  async function startTestServer(
    state: HealthServerState
  ): Promise<{ port: number; server: http.Server }> {
    const { server, listening } = createHealthServer(0, state);
    servers.push(server);
    await listening;
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return { port, server };
  }

  async function httpGet(url: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      http
        .get(url, (res) => {
          let body = '';
          res.on('data', (chunk: string) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        })
        .on('error', reject);
    });
  }

  it('health response does NOT contain secretKey or token (OWASP A05)', async () => {
    // Given a health server with identity info
    const state: HealthServerState = {
      pubkey: 'ab'.repeat(32),
      evmAddress: '0x' + 'ab'.repeat(20),
      connected: true,
      startTime: Date.now(),
    };
    const { port } = await startTestServer(state);

    // When we query the health endpoint
    const { body } = await httpGet(`http://127.0.0.1:${port}/health`);

    // Then the response does not contain sensitive fields
    expect(body).not.toContain('secretKey');
    expect(body).not.toContain('secret_key');
    expect(body).not.toContain('token');
    expect(body).not.toContain('mnemonic');
    expect(body).not.toContain('password');

    // And the JSON object does not have secret-related keys
    const json = JSON.parse(body);
    const keys = Object.keys(json);
    expect(keys).not.toContain('secretKey');
    expect(keys).not.toContain('token');
    expect(keys).not.toContain('spacetimedbToken');
    expect(keys).not.toContain('mnemonic');
  });

  it('health response returns evmAddress in 0x-prefixed format', async () => {
    // Given a health server
    const state: HealthServerState = {
      pubkey: 'ab'.repeat(32),
      evmAddress: '0x' + 'cd'.repeat(20),
      connected: true,
      startTime: Date.now(),
    };
    const { port } = await startTestServer(state);

    // When we query the health endpoint
    const { body } = await httpGet(`http://127.0.0.1:${port}/health`);
    const json = JSON.parse(body);

    // Then evmAddress is 0x-prefixed and correct length
    expect(json.evmAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('health response status field is one of: ok, starting, error', async () => {
    // Given a connected health server
    const state: HealthServerState = {
      pubkey: 'ab'.repeat(32),
      evmAddress: '0x' + 'ab'.repeat(20),
      connected: true,
      startTime: Date.now(),
    };
    const { port } = await startTestServer(state);

    // When we query health
    const { body } = await httpGet(`http://127.0.0.1:${port}/health`);
    const json = JSON.parse(body);

    // Then status is one of the expected values
    expect(['ok', 'starting', 'error']).toContain(json.status);
  });
});

describe('[AC3] Startup logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('node creation logs identity source on startup', async () => {
    // Given a console spy
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // When we create a BLS node (dynamic import to get fresh module with mocks)
    const { createBLSNode } = await import('../node.js');
    const { createBLSConfig } = await import('./factories/bls-config.factory.js');
    const config = createBLSConfig();
    createBLSNode(config);

    // Then the logs contain identity derivation source and SpacetimeDB target
    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allLogs).toContain('Identity derived');
    expect(allLogs).toContain('Node created');
  });

  it('node creation logs SpacetimeDB target on startup', async () => {
    // Given a console spy
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // When we create a BLS node
    const { createBLSNode } = await import('../node.js');
    const { createBLSConfig } = await import('./factories/bls-config.factory.js');
    const config = createBLSConfig({
      spacetimedbUrl: 'http://test:3000',
      spacetimedbDatabase: 'mydb',
    });
    createBLSNode(config);

    // Then the logs contain the SpacetimeDB target
    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allLogs).toContain('http://test:3000');
    expect(allLogs).toContain('mydb');
  });
});

// ---------------------------------------------------------------------------
// AC4: Docker Compose integration
// Gap: No unit test validates docker-compose.yml structure
// Gap: No unit test validates Dockerfile structure
// ---------------------------------------------------------------------------

describe('[AC4] Docker configuration validation', () => {
  it('docker-compose.yml contains bitcraft-bls service', () => {
    // Given the docker-compose.yml file
    const composePath = resolve(import.meta.dirname, '../../../../docker/docker-compose.yml');
    const composeContent = readFileSync(composePath, 'utf-8');

    // Then it contains the bitcraft-bls service definition
    expect(composeContent).toContain('bitcraft-bls:');
    expect(composeContent).toContain('sigil-bitcraft-bls');
  });

  it('bitcraft-bls service depends on bitcraft-server health', () => {
    // Given the docker-compose.yml file
    const composePath = resolve(import.meta.dirname, '../../../../docker/docker-compose.yml');
    const composeContent = readFileSync(composePath, 'utf-8');

    // Then it has the depends_on with service_healthy condition
    expect(composeContent).toContain('depends_on:');
    expect(composeContent).toContain('condition: service_healthy');
  });

  it('bitcraft-bls service has a health check configured', () => {
    // Given the docker-compose.yml file
    const composePath = resolve(import.meta.dirname, '../../../../docker/docker-compose.yml');
    const composeContent = readFileSync(composePath, 'utf-8');

    // Then it has a health check that hits the /health endpoint
    expect(composeContent).toContain('http://localhost:3001/health');
  });

  it('Dockerfile uses non-root user (OWASP A05)', () => {
    // Given the Dockerfile
    const dockerfilePath = resolve(import.meta.dirname, '../../Dockerfile');
    const dockerfileContent = readFileSync(dockerfilePath, 'utf-8');

    // Then it switches to non-root user
    expect(dockerfileContent).toContain('USER bls');
    // And creates the user
    expect(dockerfileContent).toContain('useradd');
  });
});

// ---------------------------------------------------------------------------
// AC5: Graceful shutdown
// Gap: No test verifies in-flight request drain during shutdown
// Gap: No test verifies error during node.stop() is handled gracefully
// ---------------------------------------------------------------------------

describe('[AC5] Graceful shutdown - in-flight drain and error handling', () => {
  let cleanupShutdown: (() => void) | undefined;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  });

  afterEach(async () => {
    if (cleanupShutdown) {
      cleanupShutdown();
      cleanupShutdown = undefined;
    }
    vi.restoreAllMocks();
  });

  it('shutdown waits for in-flight requests before stopping', async () => {
    // Given a node with a slow handler registered and an in-flight request
    const connector: EmbeddedConnector = {
      async start() {},
      async stop() {},
    };
    const node = createNode({
      secretKey: new Uint8Array(32).fill(0xab),
      connector,
      ilpAddress: 'g.crosstown.test',
    });

    let handlerResolve: (() => void) | undefined;
    const handlerPromise = new Promise<void>((resolve) => {
      handlerResolve = resolve;
    });

    // Register a slow handler
    node.on(30078, async (ctx: HandlerContext): Promise<AcceptResponse> => {
      await handlerPromise;
      return ctx.accept();
    });

    await node.start();

    // Dispatch a request (creates in-flight)
    const { createMockHandlerContext } = await import('@crosstown/sdk');
    const dispatchPromise = node.dispatch(createMockHandlerContext({ kind: 30078 }));

    // Verify in-flight count > 0
    expect(node.inFlightCount).toBe(1);

    // Set up shutdown and trigger SIGTERM
    const testServer = http.createServer();
    cleanupShutdown = setupShutdownHandlers(node, testServer, { drainTimeout: 2000 });
    process.emit('SIGTERM', 'SIGTERM');

    // Allow a brief moment for shutdown to start
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Node should NOT have stopped yet (still draining in-flight)
    // The in-flight count is still 1
    expect(node.inFlightCount).toBe(1);

    // Now resolve the handler (simulating request completion)
    handlerResolve!();
    await dispatchPromise;

    // Allow shutdown to complete
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Node should have stopped after in-flight drained
    expect(node.started).toBe(false);
  });

  it('error during node.stop() does not crash the shutdown process', async () => {
    // Given a node whose stop() rejects
    const connector: EmbeddedConnector = {
      async start() {},
      async stop() {
        throw new Error('Connector stop failure');
      },
    };
    const node = createNode({
      secretKey: new Uint8Array(32).fill(0xab),
      connector,
      ilpAddress: 'g.crosstown.test',
    });

    await node.start();

    // Set up shutdown with a test server
    const testServer = http.createServer();
    cleanupShutdown = setupShutdownHandlers(node, testServer, { drainTimeout: 1000 });

    // When SIGTERM is sent, the shutdown should not crash even though stop() throws
    process.emit('SIGTERM', 'SIGTERM');

    // Allow shutdown to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // The error should be logged but process.exit should still be called
    const errorSpy = vi.mocked(console.error);
    const errorLogs = errorSpy.mock.calls.map((c) => String(c[0]));
    expect(errorLogs.some((l) => l.includes('Error stopping node'))).toBe(true);
  });
});
