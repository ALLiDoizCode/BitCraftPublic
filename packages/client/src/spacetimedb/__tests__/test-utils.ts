/**
 * Test Utilities for SpacetimeDB Tests
 *
 * Common helpers, mocks, and fixtures used across test files.
 */

import { vi } from 'vitest';

/**
 * Mock SpacetimeDB SDK client
 */
export function createMockSpacetimeDBClient() {
  const subscriptions = new Map<string, any>();
  const eventHandlers = new Map<string, Set<Function>>();

  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),

    subscribe: vi.fn((tableName: string, query: any) => {
      const id = `sub-${Math.random().toString(36).substr(2, 9)}`;
      const subscription = {
        id,
        tableName,
        query,
        unsubscribe: vi.fn(() => {
          subscriptions.delete(id);
        }),
      };
      subscriptions.set(id, subscription);
      return subscription;
    }),

    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    }),

    off: vi.fn((event: string, handler: Function) => {
      eventHandlers.get(event)?.delete(handler);
    }),

    emit: vi.fn((event: string, ...args: any[]) => {
      const handlers = eventHandlers.get(event);
      if (handlers) {
        handlers.forEach((handler) => handler(...args));
      }
    }),

    // Test helpers
    _getSubscriptions: () => subscriptions,
    _getEventHandlers: () => eventHandlers,
    _simulateSnapshot: (tableName: string, rows: any[]) => {
      const handlers = eventHandlers.get('tableSnapshot');
      handlers?.forEach((h) => h({ tableName, rows }));
    },
    _simulateRowInserted: (tableName: string, row: any) => {
      const handlers = eventHandlers.get('rowInserted');
      handlers?.forEach((h) => h({ tableName, row }));
    },
    _simulateRowUpdated: (tableName: string, oldRow: any, newRow: any) => {
      const handlers = eventHandlers.get('rowUpdated');
      handlers?.forEach((h) => h({ tableName, oldRow, newRow }));
    },
    _simulateRowDeleted: (tableName: string, row: any) => {
      const handlers = eventHandlers.get('rowDeleted');
      handlers?.forEach((h) => h({ tableName, row }));
    },
  };
}

/**
 * Create a mock WebSocket
 */
export function createMockWebSocket() {
  const eventHandlers = new Map<string, Set<Function>>();

  return {
    readyState: 1, // OPEN

    send: vi.fn(),
    close: vi.fn(),

    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    }),

    removeEventListener: vi.fn((event: string, handler: Function) => {
      eventHandlers.get(event)?.delete(handler);
    }),

    // Test helpers
    _trigger: (event: string, data?: any) => {
      const handlers = eventHandlers.get(event);
      handlers?.forEach((h) => h(data));
    },
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Wait for an event to be emitted
 */
export async function waitForEvent(emitter: any, event: string, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for event '${event}' after ${timeout}ms`));
    }, timeout);

    emitter.once(event, (data: any) => {
      clearTimeout(timeoutId);
      resolve(data);
    });
  });
}

/**
 * Create test data for player state
 */
export function createMockPlayerState(overrides?: Partial<any>) {
  return {
    id: Math.floor(Math.random() * 10000),
    name: `Player${Math.floor(Math.random() * 1000)}`,
    level: Math.floor(Math.random() * 50) + 1,
    isActive: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create test data for entity position
 */
export function createMockEntityPosition(overrides?: Partial<any>) {
  return {
    id: Math.floor(Math.random() * 10000),
    entityId: Math.floor(Math.random() * 10000),
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    z: Math.random() * 100,
    ...overrides,
  };
}

/**
 * Create test data for inventory item
 */
export function createMockInventoryItem(overrides?: Partial<any>) {
  return {
    id: Math.floor(Math.random() * 10000),
    playerId: Math.floor(Math.random() * 1000),
    itemId: Math.floor(Math.random() * 500),
    quantity: Math.floor(Math.random() * 99) + 1,
    slot: Math.floor(Math.random() * 40),
    ...overrides,
  };
}

/**
 * Measure execution time of a function
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * Generate a large dataset for performance testing
 */
export function generateLargeDataset(size: number, factory: () => any): any[] {
  return Array.from({ length: size }, factory);
}

/**
 * Assert that a value is defined (TypeScript type guard)
 */
export function assertDefined<T>(value: T | undefined | null): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error('Expected value to be defined');
  }
}

/**
 * Create a promise that resolves after a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects after a delay
 */
export function timeout(ms: number, message = 'Timeout'): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

/**
 * Capture console output
 */
export function captureConsole() {
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = vi.fn((...args) => logs.push(args.join(' ')));
  console.warn = vi.fn((...args) => warns.push(args.join(' ')));
  console.error = vi.fn((...args) => errors.push(args.join(' ')));

  return {
    logs,
    warns,
    errors,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
}

/**
 * Check if Docker stack is running (for integration tests)
 */
export async function isDockerStackRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:3000/database/bitcraft/info');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelay = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        const delayMs = initialDelay * Math.pow(2, attempt);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Create a deferred promise (can be resolved/rejected externally)
 */
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

/**
 * Mock connection options for testing
 */
export const DEFAULT_TEST_CONNECTION_OPTIONS = {
  host: 'localhost',
  port: 3000,
  database: 'bitcraft',
  protocol: 'ws' as const,
  timeout: 10000,
};

/**
 * Common table names used in tests
 */
export const TEST_TABLE_NAMES = {
  PLAYER_STATE: 'player_state',
  ENTITY_POSITION: 'entity_position',
  INVENTORY: 'inventory',
  CRAFTING: 'crafting',
  BUILDING: 'building',
} as const;
