/**
 * SpacetimeDB Subscription and State Verification Helpers
 * Story 5.4: Basic Action Round-Trip Validation (AC2, AC6)
 *
 * Provides helpers for subscribing to SpacetimeDB tables and
 * verifying state changes via subscription callbacks.
 *
 * Tables required for Story 5.4:
 * - user_state: Maps SpacetimeDB Identity to player entity_id
 * - player_state: Player profile, signed_in status
 * - signed_in_player_state: Currently signed-in players (insert/delete on sign_in/sign_out)
 *
 * @integration
 */

import type { SpacetimeDBTestConnection } from './spacetimedb-connection';

/** Default timeout for waiting on subscription updates (ms) */
const DEFAULT_WAIT_TIMEOUT_MS = 5000; // NFR5: subscription update < 500ms; generous timeout for reliability

/**
 * Wait for a table update matching a predicate
 *
 * Listens for insert/update events on the specified table
 * and resolves when a row matching the predicate is received.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param tableName - Name of the table to watch (e.g., 'signed_in_player_state')
 * @param predicate - Function that returns true when the desired row is found
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms, generous for reliability)
 * @returns Promise resolving to the matching row
 * @throws Error with descriptive message if timeout is reached
 */
export async function waitForTableInsert<T = unknown>(
  testConnection: SpacetimeDBTestConnection,
  tableName: string,
  predicate: (row: T) => boolean = () => true,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ row: T; elapsedMs: number }> {
  const start = performance.now();

  return new Promise((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(
          new Error(
            `waitForTableInsert('${tableName}') timed out after ${timeoutMs}ms. ` +
              'No matching row was inserted. Check that the reducer executed successfully ' +
              'and the subscription includes this table.'
          )
        );
      }
    }, timeoutMs);

    try {
      const db = testConnection.connection?.db;
      if (!db) {
        settled = true;
        clearTimeout(timeoutId);
        reject(new Error('SpacetimeDB connection has no db property. Is the connection active?'));
        return;
      }

      const table = db[tableName];
      if (!table) {
        settled = true;
        clearTimeout(timeoutId);
        reject(
          new Error(
            `Table '${tableName}' not found on connection.db. ` +
              'Available tables: ' +
              Object.keys(db).join(', ')
          )
        );
        return;
      }

      if (typeof table.onInsert !== 'function') {
        settled = true;
        clearTimeout(timeoutId);
        reject(
          new Error(
            `Table '${tableName}' does not have an onInsert method. ` +
              'Ensure subscriptions include this table.'
          )
        );
        return;
      }

      // Register listener. The `settled` flag prevents stale callbacks from
      // firing after the promise has already resolved or rejected (e.g., on timeout).
      // This is important for reuse by Stories 5.5-5.8 where connections may be long-lived.
      table.onInsert((row: T) => {
        if (!settled && predicate(row)) {
          settled = true;
          clearTimeout(timeoutId);
          const elapsedMs = performance.now() - start;
          resolve({ row, elapsedMs });
        }
      });
    } catch (error) {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        reject(
          new Error(
            `waitForTableInsert('${tableName}') setup failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }
  });
}

/**
 * Wait for a table row deletion matching a predicate
 *
 * Listens for delete events on the specified table
 * and resolves when a row matching the predicate is deleted.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param tableName - Name of the table to watch
 * @param predicate - Function that returns true when the desired deletion is detected
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms)
 * @returns Promise resolving to the deleted row and elapsed time
 * @throws Error with descriptive message if timeout is reached
 */
export async function waitForTableDelete<T = unknown>(
  testConnection: SpacetimeDBTestConnection,
  tableName: string,
  predicate: (row: T) => boolean = () => true,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS
): Promise<{ row: T; elapsedMs: number }> {
  const start = performance.now();

  return new Promise((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(
          new Error(
            `waitForTableDelete('${tableName}') timed out after ${timeoutMs}ms. ` +
              'No matching row was deleted.'
          )
        );
      }
    }, timeoutMs);

    try {
      const db = testConnection.connection?.db;
      if (!db) {
        settled = true;
        clearTimeout(timeoutId);
        reject(new Error('SpacetimeDB connection has no db property. Is the connection active?'));
        return;
      }

      const table = db[tableName];
      if (!table) {
        settled = true;
        clearTimeout(timeoutId);
        reject(new Error(`Table '${tableName}' not found on connection.db.`));
        return;
      }

      if (typeof table.onDelete !== 'function') {
        settled = true;
        clearTimeout(timeoutId);
        reject(new Error(`Table '${tableName}' does not have an onDelete method.`));
        return;
      }

      // Register listener. The `settled` flag prevents stale callbacks from
      // firing after the promise has already resolved or rejected (e.g., on timeout).
      table.onDelete((row: T) => {
        if (!settled && predicate(row)) {
          settled = true;
          clearTimeout(timeoutId);
          const elapsedMs = performance.now() - start;
          resolve({ row, elapsedMs });
        }
      });
    } catch (error) {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        reject(
          new Error(
            `waitForTableDelete('${tableName}') setup failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }
  });
}

/**
 * Assert current state of a table matches expectations
 *
 * Queries the client-side cached table state (populated by subscriptions)
 * and verifies rows match the expected conditions.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param tableName - Name of the table to query
 * @param predicate - Function that returns true for rows that should exist
 * @returns Array of matching rows
 * @throws Error if table not found or not subscribed
 */
export function queryTableState<T = unknown>(
  testConnection: SpacetimeDBTestConnection,
  tableName: string,
  predicate?: (row: T) => boolean
): T[] {
  const db = testConnection.connection?.db;
  if (!db) {
    throw new Error('SpacetimeDB connection has no db property. Is the connection active?');
  }

  const table = db[tableName];
  if (!table) {
    throw new Error(
      `Table '${tableName}' not found on connection.db. ` +
        'Available tables: ' +
        Object.keys(db).join(', ')
    );
  }

  // SpacetimeDB SDK tables typically have an iter() or getAll() method
  // to retrieve all cached rows
  let rows: T[] = [];

  if (typeof table.iter === 'function') {
    rows = Array.from(table.iter()) as T[];
  } else if (typeof table.getAll === 'function') {
    rows = table.getAll() as T[];
  } else if (typeof table[Symbol.iterator] === 'function') {
    rows = Array.from(table) as T[];
  } else {
    throw new Error(
      `Table '${tableName}' does not have iter(), getAll(), or Symbol.iterator. ` +
        'Cannot query table state.'
    );
  }

  if (predicate) {
    return rows.filter(predicate);
  }

  return rows;
}

/**
 * Subscribe to tables using the SpacetimeDB SDK
 *
 * Uses SubscriptionBuilderImpl from the SDK to set up subscriptions.
 * The SDK ^1.3.3 API: new SubscriptionBuilderImpl(conn).subscribe(queries)
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param queries - SQL subscription queries (default: Story 5.4 minimum tables)
 * @returns Promise that resolves when subscription is applied
 */
export async function subscribeToTables(
  testConnection: SpacetimeDBTestConnection,
  queries: string[] = STORY_54_TABLES
): Promise<void> {
  const conn = testConnection.connection;
  if (!conn) {
    throw new Error('No active SpacetimeDB connection');
  }

  // SDK ^1.3.3 uses SubscriptionBuilderImpl to subscribe to tables.
  // The builder is instantiated with the connection and queries are passed to .subscribe()
  const { SubscriptionBuilderImpl } = await import('@clockworklabs/spacetimedb-sdk');

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      // Resolve even on timeout -- subscription may have been applied silently.
      // Log a warning so test failures downstream are easier to diagnose.
      // Timeout: 3000ms chosen as generous upper bound for subscription setup;
      // most subscriptions apply within a few hundred ms.
      console.warn(
        `subscribeToTables: onApplied callback not received within 3000ms for queries: ${queries.join(', ')}. ` +
          'Proceeding anyway -- subscription may have been applied silently.'
      );
      resolve();
    }, 3000);

    try {
      new SubscriptionBuilderImpl(conn)
        .onApplied(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onError((ctx: any) => {
          clearTimeout(timeoutId);
          // SDK ErrorContextInterface has event?: Error property
          const errorMsg =
            ctx?.event?.message ||
            ctx?.error?.message ||
            ctx?.message ||
            'Unknown subscription error';
          reject(new Error(`Subscription failed: ${errorMsg}`));
        })
        .subscribe(queries);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(
        new Error(
          `Subscription setup failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  });
}

/** Default tables for Story 5.4 */
const STORY_54_TABLES = [
  'SELECT * FROM user_state',
  'SELECT * FROM player_state',
  'SELECT * FROM signed_in_player_state',
];

/**
 * Subscribe to the minimum tables required for Story 5.4
 *
 * Subscribes to: user_state, player_state, signed_in_player_state
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns Promise that resolves when subscription is applied
 */
export async function subscribeToStory54Tables(
  testConnection: SpacetimeDBTestConnection
): Promise<void> {
  return subscribeToTables(testConnection, STORY_54_TABLES);
}
