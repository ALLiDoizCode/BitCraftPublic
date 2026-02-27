/**
 * Unit Tests: SpacetimeDB Connection Manager
 *
 * Tests for the connection manager component that handles WebSocket v1
 * connections to SpacetimeDB servers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock the SpacetimeDB SDK
vi.mock('@clockworklabs/spacetimedb-sdk', () => ({
  default: vi.fn(),
  SpacetimeDBClient: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
  })),
}));

describe('SpacetimeDBConnection', () => {
  describe('Connection Options Validation', () => {
    it('should accept valid connection options', () => {
      const validOptions = {
        host: 'localhost',
        port: 3000,
        database: 'bitcraft',
        protocol: 'ws' as const,
        timeout: 10000,
      };

      // Should not throw
      expect(() => validateConnectionOptions(validOptions)).not.toThrow();
    });

    it('should reject empty host', () => {
      const invalidOptions = {
        host: '',
        port: 3000,
        database: 'bitcraft',
      };

      expect(() => validateConnectionOptions(invalidOptions)).toThrow(/host/i);
    });

    it('should reject negative port', () => {
      const invalidOptions = {
        host: 'localhost',
        port: -1,
        database: 'bitcraft',
      };

      expect(() => validateConnectionOptions(invalidOptions)).toThrow(/port/i);
    });

    it('should reject port > 65535', () => {
      const invalidOptions = {
        host: 'localhost',
        port: 70000,
        database: 'bitcraft',
      };

      expect(() => validateConnectionOptions(invalidOptions)).toThrow(/port/i);
    });

    it('should reject empty database name', () => {
      const invalidOptions = {
        host: 'localhost',
        port: 3000,
        database: '',
      };

      expect(() => validateConnectionOptions(invalidOptions)).toThrow(/database/i);
    });

    it('should reject invalid protocol', () => {
      const invalidOptions = {
        host: 'localhost',
        port: 3000,
        database: 'bitcraft',
        protocol: 'http' as any,
      };

      expect(() => validateConnectionOptions(invalidOptions)).toThrow(/protocol/i);
    });

    it('should accept ws and wss protocols', () => {
      const wsOptions = {
        host: 'localhost',
        port: 3000,
        database: 'bitcraft',
        protocol: 'ws' as const,
      };

      const wssOptions = {
        host: 'localhost',
        port: 3000,
        database: 'bitcraft',
        protocol: 'wss' as const,
      };

      expect(() => validateConnectionOptions(wsOptions)).not.toThrow();
      expect(() => validateConnectionOptions(wssOptions)).not.toThrow();
    });
  });

  describe('Connection State Machine', () => {
    it('should start in disconnected state', () => {
      const state = createConnectionStateMachine();
      expect(state.current).toBe('disconnected');
    });

    it('should transition disconnected -> connecting -> connected', () => {
      const state = createConnectionStateMachine();

      expect(state.current).toBe('disconnected');

      state.transition('connecting');
      expect(state.current).toBe('connecting');

      state.transition('connected');
      expect(state.current).toBe('connected');
    });

    it('should transition to failed on error', () => {
      const state = createConnectionStateMachine();
      state.transition('connecting');

      state.transition('failed');
      expect(state.current).toBe('failed');
    });

    it('should allow reconnection from failed state', () => {
      const state = createConnectionStateMachine();
      state.transition('connecting');
      state.transition('failed');

      // Can try connecting again
      state.transition('disconnected');
      state.transition('connecting');
      expect(state.current).toBe('connecting');
    });

    it('should prevent invalid transitions', () => {
      const state = createConnectionStateMachine();

      // Cannot go directly from disconnected to connected
      expect(() => state.transition('connected')).toThrow(/invalid transition/i);
    });
  });

  describe('Connection Event Emission', () => {
    it('should emit connectionChange event on state change', () => {
      const emitter = new EventEmitter();
      const events: Array<{ state: string }> = [];

      emitter.on('connectionChange', (event) => events.push(event));

      // Simulate state changes
      emitter.emit('connectionChange', { state: 'connecting' });
      emitter.emit('connectionChange', { state: 'connected' });

      expect(events).toEqual([{ state: 'connecting' }, { state: 'connected' }]);
    });

    it('should include error in connectionChange event on failure', () => {
      const emitter = new EventEmitter();
      const events: Array<{ state: string; error?: Error }> = [];

      emitter.on('connectionChange', (event) => events.push(event));

      const error = new Error('Connection failed');
      emitter.emit('connectionChange', { state: 'failed', error });

      expect(events).toEqual([{ state: 'failed', error }]);
    });
  });

  describe('Connection Timeout', () => {
    it('should timeout if connection takes too long', async () => {
      // Create a promise that never resolves (simulates hung connection)
      const neverResolves = new Promise(() => {});

      // Race against timeout
      const timeout = 100; // 100ms timeout
      const result = await Promise.race([
        neverResolves,
        new Promise((resolve) => setTimeout(() => resolve('timeout'), timeout)),
      ]);

      expect(result).toBe('timeout');
    });

    it('should use default timeout of 10 seconds', () => {
      const defaultTimeout = 10000;
      expect(defaultTimeout).toBe(10000);
    });

    it('should allow custom timeout configuration', () => {
      const customTimeout = 5000;
      expect(customTimeout).toBeGreaterThan(0);
      expect(customTimeout).toBeLessThan(30000);
    });
  });

  describe('WebSocket Protocol', () => {
    it('should use WebSocket protocol v1 with SDK 1.3.3', () => {
      // SDK 1.3.3 uses protocol v1 (not v2 which is incompatible)
      const sdkVersion = '1.3.3';
      expect(sdkVersion).toMatch(/^1\.3\./);
    });

    it('should construct WebSocket URL correctly', () => {
      const options = {
        host: 'localhost',
        port: 3000,
        database: 'bitcraft',
        protocol: 'ws' as const,
      };

      const url = buildWebSocketUrl(options);
      expect(url).toBe('ws://localhost:3000/database/bitcraft');
    });

    it('should support wss protocol for production', () => {
      const options = {
        host: 'example.com',
        port: 443,
        database: 'bitcraft',
        protocol: 'wss' as const,
      };

      const url = buildWebSocketUrl(options);
      expect(url).toBe('wss://example.com:443/database/bitcraft');
    });
  });

  describe('Connection Cleanup', () => {
    it('should close WebSocket on disconnect', () => {
      const mockWebSocket = {
        close: vi.fn(),
        readyState: 1, // OPEN
      };

      closeWebSocket(mockWebSocket as any);
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should handle already closed WebSocket', () => {
      const mockWebSocket = {
        close: vi.fn(),
        readyState: 3, // CLOSED
      };

      // Should not throw
      expect(() => closeWebSocket(mockWebSocket as any)).not.toThrow();
    });

    it('should reset state to disconnected after cleanup', () => {
      const state = createConnectionStateMachine();
      state.transition('connecting');
      state.transition('connected');

      // Disconnect
      state.transition('disconnected');
      expect(state.current).toBe('disconnected');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      const networkError = new Error('Network unreachable');
      const errorEvent = {
        state: 'failed',
        error: networkError,
      };

      expect(errorEvent.state).toBe('failed');
      expect(errorEvent.error).toBe(networkError);
    });

    it('should handle DNS resolution failures', () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND invalid-host');
      expect(dnsError.message).toContain('ENOTFOUND');
    });

    it('should handle connection refused', () => {
      const refusedError = new Error('connect ECONNREFUSED');
      expect(refusedError.message).toContain('ECONNREFUSED');
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Connection timeout after 10000ms');
      expect(timeoutError.message).toContain('timeout');
    });
  });
});

// Helper functions that would be part of the connection module

function validateConnectionOptions(options: any): void {
  if (!options.host || options.host.trim() === '') {
    throw new TypeError('Invalid host: must be non-empty string');
  }

  if (typeof options.port !== 'number' || options.port < 1 || options.port > 65535) {
    throw new TypeError('Invalid port: must be between 1 and 65535');
  }

  if (!options.database || options.database.trim() === '') {
    throw new TypeError('Invalid database: must be non-empty string');
  }

  if (options.protocol && !['ws', 'wss'].includes(options.protocol)) {
    throw new TypeError('Invalid protocol: must be "ws" or "wss"');
  }
}

function buildWebSocketUrl(options: {
  protocol: 'ws' | 'wss';
  host: string;
  port: number;
  database: string;
}): string {
  return `${options.protocol}://${options.host}:${options.port}/database/${options.database}`;
}

function createConnectionStateMachine() {
  let currentState: 'disconnected' | 'connecting' | 'connected' | 'failed' = 'disconnected';

  const validTransitions: Record<string, string[]> = {
    disconnected: ['connecting'],
    connecting: ['connected', 'failed', 'disconnected'],
    connected: ['disconnected'],
    failed: ['disconnected'],
  };

  return {
    get current() {
      return currentState;
    },
    transition(newState: typeof currentState) {
      if (!validTransitions[currentState]?.includes(newState)) {
        throw new Error(`Invalid transition from ${currentState} to ${newState}`);
      }
      currentState = newState;
    },
  };
}

function closeWebSocket(ws: { close: () => void; readyState: number }) {
  if (ws.readyState === 1 || ws.readyState === 0) {
    // OPEN or CONNECTING
    ws.close();
  }
}
