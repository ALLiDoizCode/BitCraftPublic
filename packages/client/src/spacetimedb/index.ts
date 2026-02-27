/**
 * SpacetimeDB Surface
 *
 * Main entry point for SpacetimeDB integration.
 * Provides connection, subscriptions, tables, and latency monitoring.
 */

import { EventEmitter } from 'events';
import {
  SpacetimeDBConnection,
  type SpacetimeDBConnectionOptions,
  type ConnectionState,
  type ConnectionChangeEvent,
} from './connection';
import { SubscriptionManager, type TableQuery, type SubscriptionHandle } from './subscriptions';
import { TableManager, type TableAccessors } from './tables';
import { LatencyMonitor, type LatencyStats } from './latency';

/** Delay in milliseconds for batching game state updates */
const GAME_STATE_UPDATE_BATCH_MS = 50;

/**
 * SpacetimeDB Surface
 *
 * Provides unified interface for all SpacetimeDB functionality:
 * - Connection management
 * - Table subscriptions
 * - Type-safe table accessors
 * - Latency monitoring
 */
export interface SpacetimeDBSurface extends EventEmitter {
  /** Connection manager */
  connection: SpacetimeDBConnection;
  /** Subscription manager */
  subscriptions: SubscriptionManager;
  /** Type-safe table accessors */
  tables: TableAccessors;
  /** Latency monitor */
  latency: LatencyMonitor;
  /** Subscribe to a table (convenience method) */
  subscribe(tableName: string, query: TableQuery): Promise<SubscriptionHandle>;
}

/**
 * Create SpacetimeDB surface
 *
 * Initializes all SpacetimeDB components and wires them together.
 *
 * @param options - Connection options
 * @param eventEmitter - Event emitter for forwarding events
 * @returns SpacetimeDB surface
 *
 * @internal
 */
export function createSpacetimeDBSurface(
  options: SpacetimeDBConnectionOptions | undefined,
  eventEmitter: EventEmitter
): SpacetimeDBSurface {
  // Create components
  const connection = new SpacetimeDBConnection(options);
  const subscriptions = new SubscriptionManager(connection);
  const tableManager = new TableManager(subscriptions);
  const latency = new LatencyMonitor();

  // Forward connection events to main event emitter
  connection.on('connectionChange', (event: ConnectionChangeEvent) => {
    eventEmitter.emit('connectionChange', event);
  });

  // Forward latency events
  latency.on('updateLatency', (event) => {
    eventEmitter.emit('updateLatency', event);
  });

  // Aggregate row events into gameStateUpdate events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pendingUpdates: any[] = [];
  let updateTimer: NodeJS.Timeout | null = null;

  const flushUpdates = () => {
    if (pendingUpdates.length > 0) {
      eventEmitter.emit('gameStateUpdate', pendingUpdates);
      pendingUpdates = [];
    }
    updateTimer = null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordUpdate = (type: string, data: any) => {
    const updateTimestamp = Date.now();
    pendingUpdates.push({ type, data, timestamp: updateTimestamp });

    // Batch updates within configured window
    if (!updateTimer) {
      updateTimer = setTimeout(flushUpdates, GAME_STATE_UPDATE_BATCH_MS);
    }

    // Record latency if timestamp available
    // Note: SpacetimeDB SDK doesn't provide commit timestamp in v1.3.3
    // We approximate by measuring client-side processing time
    if (data.commitTimestamp) {
      const latencyMs = Date.now() - data.commitTimestamp;
      latency.recordLatency(latencyMs, data.tableName);
    }
  };

  subscriptions.on('tableSnapshot', (data) => recordUpdate('snapshot', data));
  subscriptions.on('rowInserted', (data) => recordUpdate('insert', data));
  subscriptions.on('rowUpdated', (data) => recordUpdate('update', data));
  subscriptions.on('rowDeleted', (data) => recordUpdate('delete', data));

  // Create extended surface with convenience methods
  const surfaceEmitter = Object.assign(eventEmitter, {
    connection,
    subscriptions,
    tables: tableManager.accessors,
    latency,
    subscribe: (tableName: string, query: TableQuery) => subscriptions.subscribe(tableName, query),
    _clearTableCache: () => tableManager.clearAll(),
  });

  return surfaceEmitter as unknown as SpacetimeDBSurface;
}

// Re-export types
export type {
  SpacetimeDBConnectionOptions,
  ConnectionState,
  ConnectionChangeEvent,
  TableQuery,
  SubscriptionHandle,
  TableAccessors,
  LatencyStats,
};

export { SpacetimeDBConnection, SubscriptionManager, TableManager, LatencyMonitor };
