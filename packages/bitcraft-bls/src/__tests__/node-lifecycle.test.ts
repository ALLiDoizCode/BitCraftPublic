/**
 * Node Lifecycle Tests (AC: 2, 5)
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Tests for BLS node lifecycle management: start, stop, SIGTERM/SIGINT handling,
 * graceful shutdown with in-flight request tracking.
 *
 * Validates: AC2 (node startup), AC5 (graceful shutdown)
 *
 * Test count: 12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { setupShutdownHandlers } from '../lifecycle.js';
import { createHealthServer, closeHealthServer } from '../health.js';
import {
  createNode,
  CrosstownNode,
  type StartResult,
  type EmbeddedConnector,
} from '@crosstown/sdk';

describe('Node Lifecycle (Story 3.1)', () => {
  let testNode: CrosstownNode;
  let testServer: http.Server;
  let cleanupShutdown: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Suppress process.exit for tests
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    // Create a real CrosstownNode from the stub
    const connector: EmbeddedConnector = {
      async start() {},
      async stop() {},
    };
    testNode = createNode({
      secretKey: new Uint8Array(32).fill(0xab),
      connector,
      ilpAddress: 'g.crosstown.test',
    });

    // Create a minimal test server
    testServer = http.createServer();
  });

  afterEach(async () => {
    // Clean up shutdown handlers
    if (cleanupShutdown) {
      cleanupShutdown();
      cleanupShutdown = undefined;
    }

    // Close test server if listening
    await new Promise<void>((resolve) => {
      testServer.close(() => resolve());
    }).catch(() => {});

    vi.restoreAllMocks();
  });

  it('node.start() resolves and returns StartResult', async () => {
    const result = await testNode.start();

    expect(result).toHaveProperty('peerCount');
    expect(result).toHaveProperty('channelCount');
    expect(result).toHaveProperty('bootstrapResults');
    expect(typeof result.peerCount).toBe('number');
    expect(typeof result.channelCount).toBe('number');
    expect(Array.isArray(result.bootstrapResults)).toBe(true);
  });

  it('node.stop() resolves cleanly', async () => {
    await testNode.start();
    await expect(testNode.stop()).resolves.toBeUndefined();
  });

  it('SIGTERM triggers node.stop()', async () => {
    await testNode.start();
    const stopSpy = vi.spyOn(testNode, 'stop');

    cleanupShutdown = setupShutdownHandlers(testNode, testServer);

    // Emit SIGTERM
    process.emit('SIGTERM', 'SIGTERM');

    // Allow async shutdown to proceed
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(stopSpy).toHaveBeenCalledOnce();
  });

  it('SIGINT triggers node.stop()', async () => {
    await testNode.start();
    const stopSpy = vi.spyOn(testNode, 'stop');

    cleanupShutdown = setupShutdownHandlers(testNode, testServer);

    // Emit SIGINT
    process.emit('SIGINT', 'SIGINT');

    // Allow async shutdown to proceed
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(stopSpy).toHaveBeenCalledOnce();
  });

  it('double start is safe (idempotent)', async () => {
    const result1 = await testNode.start();
    const result2 = await testNode.start();

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    // Second call returns empty result (already started)
    expect(result2.peerCount).toBe(0);
  });

  it('double stop is safe (idempotent)', async () => {
    await testNode.start();
    await testNode.stop();
    await expect(testNode.stop()).resolves.toBeUndefined();
  });

  it('shutdown closes health server', async () => {
    await testNode.start();

    // Start server on random port
    await new Promise<void>((resolve) => {
      testServer.listen(0, '127.0.0.1', () => resolve());
    });

    const closeSpy = vi.spyOn(testServer, 'close');

    cleanupShutdown = setupShutdownHandlers(testNode, testServer);

    process.emit('SIGTERM', 'SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('shutdown logs messages', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await testNode.start();

    cleanupShutdown = setupShutdownHandlers(testNode, testServer);

    process.emit('SIGTERM', 'SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));

    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allLogs).toContain('Shutting down');
    expect(allLogs).toContain('BLS node stopped');
  });

  it('duplicate signal handling is safe', async () => {
    await testNode.start();
    const stopSpy = vi.spyOn(testNode, 'stop');

    cleanupShutdown = setupShutdownHandlers(testNode, testServer);

    // Emit SIGTERM twice rapidly
    process.emit('SIGTERM', 'SIGTERM');
    process.emit('SIGTERM', 'SIGTERM');

    await new Promise((resolve) => setTimeout(resolve, 300));

    // stop() should only be called once (shuttingDown flag prevents second)
    expect(stopSpy).toHaveBeenCalledOnce();
  });

  it('cleanup function removes signal handlers', async () => {
    await testNode.start();

    const cleanup = setupShutdownHandlers(testNode, testServer);

    // Get listener count before cleanup
    const countBefore = process.listenerCount('SIGTERM');

    // Clean up
    cleanup();

    const countAfter = process.listenerCount('SIGTERM');
    expect(countAfter).toBeLessThan(countBefore);
  });

  it('error during node.start() propagates correctly', async () => {
    // Create a node with a connector that fails on start
    const failConnector: EmbeddedConnector = {
      async start() {
        throw new Error('Connector initialization failed');
      },
      async stop() {},
    };
    const failNode = createNode({
      secretKey: new Uint8Array(32).fill(0xab),
      connector: failConnector,
      ilpAddress: 'g.crosstown.test',
    });

    await expect(failNode.start()).rejects.toThrow('Connector initialization failed');
  });

  it('SIGTERM triggers process.exit(0) after shutdown', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    await testNode.start();

    cleanupShutdown = setupShutdownHandlers(testNode, testServer);

    process.emit('SIGTERM', 'SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
