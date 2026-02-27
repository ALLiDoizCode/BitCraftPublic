/**
 * SpacetimeDB Subscription Manager
 *
 * Manages table subscriptions with real-time push updates.
 * Emits granular row events and aggregated game state updates.
 */

import { EventEmitter } from 'events';
import type { SpacetimeDBConnection } from './connection';

/** Delay in milliseconds before emitting initial table snapshot */
const SNAPSHOT_DELAY_MS = 100;

/** Maximum number of concurrent subscriptions to prevent DoS */
const MAX_SUBSCRIPTIONS = 100;

/** Maximum query string length to prevent ReDoS attacks */
const MAX_QUERY_LENGTH = 10000;

/**
 * Table query for subscriptions
 *
 * Empty object {} subscribes to all rows.
 * SQL-like query strings supported by SpacetimeDB SDK.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableQuery = Record<string, any> | string;

/**
 * Subscription handle with unsubscribe capability
 */
export interface SubscriptionHandle {
  /** Unique subscription ID */
  id: string;
  /** Table name */
  tableName: string;
  /** Query filter (for reconnection recovery) */
  query?: TableQuery;
  /** Unsubscribe from this subscription */
  unsubscribe: () => void;
}

/**
 * Table snapshot event (initial state)
 */
export interface TableSnapshotEvent {
  tableName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
}

/**
 * Row inserted event
 */
export interface RowInsertedEvent {
  tableName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any;
}

/**
 * Row updated event
 */
export interface RowUpdatedEvent {
  tableName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldRow: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newRow: any;
}

/**
 * Row deleted event
 */
export interface RowDeletedEvent {
  tableName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any;
}

/**
 * Subscription error event
 */
export interface SubscriptionErrorEvent {
  subscriptionId: string;
  tableName: string;
  error: Error;
}

/**
 * Subscription Manager
 *
 * Manages SpacetimeDB table subscriptions and emits row-level events.
 *
 * @example
 * ```typescript
 * const subscriptions = new SubscriptionManager(connection);
 *
 * subscriptions.on('tableSnapshot', ({ tableName, rows }) => {
 *   console.log(`Received ${rows.length} rows from ${tableName}`);
 * });
 *
 * subscriptions.on('rowInserted', ({ tableName, row }) => {
 *   console.log(`New row in ${tableName}:`, row);
 * });
 *
 * const handle = await subscriptions.subscribe('player_state', {});
 * ```
 */
export class SubscriptionManager extends EventEmitter {
  private connection: SpacetimeDBConnection;
  private subscriptions: Map<string, SubscriptionHandle> = new Map();
  private nextSubscriptionId = 1;

  constructor(connection: SpacetimeDBConnection) {
    super();
    this.connection = connection;
  }

  /**
   * Subscribe to table updates
   *
   * @param tableName - Name of table to subscribe to
   * @param query - Query filter (empty object {} for all rows, or SQL string)
   * @returns Promise resolving to subscription handle
   *
   * @example
   * ```typescript
   * // Subscribe to all rows
   * const handle1 = await subscriptions.subscribe('player_state', {});
   *
   * // Subscribe with SQL query
   * const handle2 = await subscriptions.subscribe(
   *   'player_state',
   *   'SELECT * FROM player_state WHERE level > 10'
   * );
   * ```
   */
  async subscribe(tableName: string, query: TableQuery): Promise<SubscriptionHandle> {
    // Security: Validate table name (prevent SQL injection)
    if (!tableName || tableName.trim() === '') {
      throw new TypeError('Table name cannot be empty');
    }

    // Table name allowlist: alphanumeric, underscores only (prevent injection)
    const tableNameRegex = /^[a-zA-Z0-9_]+$/;
    if (!tableNameRegex.test(tableName)) {
      throw new TypeError('Table name must contain only alphanumeric characters and underscores');
    }

    // Limit table name length (prevent buffer overflow)
    if (tableName.length > 64) {
      throw new TypeError('Table name must not exceed 64 characters');
    }

    // Security: Enforce subscription limit (prevent DoS)
    if (this.subscriptions.size >= MAX_SUBSCRIPTIONS) {
      throw new Error(
        `Maximum subscription limit reached (${MAX_SUBSCRIPTIONS}). Unsubscribe from existing subscriptions before creating new ones.`
      );
    }

    const dbConnection = this.connection.connection;
    if (!dbConnection) {
      throw new Error('Not connected to SpacetimeDB. Call connect() first.');
    }

    const subscriptionId = `sub_${this.nextSubscriptionId++}`;

    try {
      // Build query string with validation
      let queryString: string;
      if (typeof query === 'string') {
        // Security: Validate query string length (prevent ReDoS)
        if (query.length > MAX_QUERY_LENGTH) {
          throw new TypeError(
            `Query string exceeds maximum length of ${MAX_QUERY_LENGTH} characters`
          );
        }

        // Security: Basic SQL injection prevention - validate query structure
        // Only allow SELECT statements (SpacetimeDB subscriptions are read-only)
        if (!query.trim().toUpperCase().startsWith('SELECT ')) {
          throw new TypeError('Query must start with SELECT (subscriptions are read-only)');
        }

        queryString = query;
      } else {
        // Use parameterized query to prevent injection
        queryString = `SELECT * FROM ${tableName}`;
      }

      // Subscribe using SpacetimeDB SDK
      // The SDK's subscriptionBuilder() returns a builder with subscribe() method
      dbConnection.subscriptionBuilder().subscribe(queryString);

      // Create subscription handle
      const handle: SubscriptionHandle = {
        id: subscriptionId,
        tableName,
        query, // Store query for reconnection recovery
        unsubscribe: () => this.unsubscribe(subscriptionId),
      };

      // Store subscription
      this.subscriptions.set(subscriptionId, handle);

      // Set up table event listeners if not already set up
      this.setupTableListeners(tableName, dbConnection);

      return handle;
    } catch {
      // Security: Sanitize error message (don't leak SQL or internal details)
      const sanitizedError = new Error('Subscription failed. Check table name and query syntax.');
      this.emit('subscriptionError', {
        subscriptionId,
        tableName,
        error: sanitizedError,
      } as SubscriptionErrorEvent);
      throw sanitizedError;
    }
  }

  /**
   * Set up event listeners for a table
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setupTableListeners(tableName: string, dbConnection: any): void {
    // Check if we already set up listeners for this table
    if (!dbConnection.db?.[tableName]) {
      // Table might not exist in generated types yet
      // This is expected during development before types are generated
      return;
    }

    const table = dbConnection.db[tableName];

    // Only set up listeners once per table
    if (table._listenersSetUp) {
      return;
    }
    table._listenersSetUp = true;

    // Listen for inserts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table.onInsert?.((ctx: any, row: any) => {
      this.emit('rowInserted', {
        tableName,
        row,
      } as RowInsertedEvent);
    });

    // Listen for updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table.onUpdate?.((ctx: any, oldRow: any, newRow: any) => {
      this.emit('rowUpdated', {
        tableName,
        oldRow,
        newRow,
      } as RowUpdatedEvent);
    });

    // Listen for deletes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table.onDelete?.((ctx: any, row: any) => {
      this.emit('rowDeleted', {
        tableName,
        row,
      } as RowDeletedEvent);
    });

    // Emit initial snapshot
    // Note: SpacetimeDB SDK populates the table cache on subscription
    // We'll emit this after a small delay to let the cache populate
    setTimeout(() => {
      const rows = table.iter?.() ? Array.from(table.iter()) : [];
      this.emit('tableSnapshot', {
        tableName,
        rows,
      } as TableSnapshotEvent);
    }, SNAPSHOT_DELAY_MS);
  }

  /**
   * Unsubscribe from a specific subscription
   *
   * @param subscriptionId - Subscription ID to unsubscribe
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.subscriptions.delete(subscriptionId);
      // Note: SpacetimeDB SDK doesn't provide a way to unsubscribe from individual queries
      // All subscriptions share the same connection
      // To truly unsubscribe, we'd need to disconnect and reconnect with new queries
    }
  }

  /**
   * Unsubscribe from all subscriptions
   *
   * Called during disconnect to clean up all subscriptions.
   */
  unsubscribeAll(): void {
    this.subscriptions.clear();
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): SubscriptionHandle[] {
    return Array.from(this.subscriptions.values());
  }
}
