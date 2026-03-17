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

/**
 * Tables required for Story 5.5: Player Lifecycle & Movement Validation
 *
 * Extends Story 5.4 tables with movement, health, stamina, and action state.
 * See BitCraft Game Reference Subscription Quick Reference.
 */
const STORY_55_TABLES = [
  'SELECT * FROM user_state',
  'SELECT * FROM player_state',
  'SELECT * FROM signed_in_player_state',
  'SELECT * FROM mobile_entity_state',
  'SELECT * FROM health_state',
  'SELECT * FROM stamina_state',
  'SELECT * FROM player_action_state',
];

/**
 * Subscribe to the 7 tables required for Story 5.5
 *
 * Subscribes to: user_state, player_state, signed_in_player_state,
 * mobile_entity_state, health_state, stamina_state, player_action_state
 *
 * Designed for reuse by Stories 5.6-5.8 which need the same base tables.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns Promise that resolves when subscription is applied
 */
export async function subscribeToStory55Tables(
  testConnection: SpacetimeDBTestConnection
): Promise<void> {
  return subscribeToTables(testConnection, STORY_55_TABLES);
}

/**
 * Additional tables required for Story 5.6: Resource Gathering & Inventory Validation
 *
 * These 6 tables extend Story 5.5's 7 tables to provide the 13 tables needed
 * for resource gathering, extraction, and inventory verification.
 * See BitCraft Game Reference Subscription Quick Reference.
 */
export const STORY_56_TABLES = [
  'SELECT * FROM inventory_state',
  'SELECT * FROM resource_state',
  'SELECT * FROM resource_health_state',
  'SELECT * FROM progressive_action_state',
  'SELECT * FROM experience_state',
  'SELECT * FROM extract_outcome_state',
];

/**
 * Subscribe to all 13 tables required for Story 5.6
 *
 * Subscribes to: all 7 from Story 5.5 (user_state, player_state,
 * signed_in_player_state, mobile_entity_state, health_state, stamina_state,
 * player_action_state) PLUS inventory_state, resource_state,
 * resource_health_state, progressive_action_state, experience_state,
 * extract_outcome_state
 *
 * Designed for reuse by Stories 5.7-5.8 which need the same base tables.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns Promise that resolves when subscription is applied
 */
export async function subscribeToStory56Tables(
  testConnection: SpacetimeDBTestConnection
): Promise<void> {
  return subscribeToTables(testConnection, [...STORY_55_TABLES, ...STORY_56_TABLES]);
}

/**
 * Additional tables required for Story 5.7: Multi-Step Crafting Loop Validation
 *
 * These 6 tables extend Story 5.5's 7 tables to provide the 13 tables needed
 * for crafting loop validation including building discovery, progressive action
 * tracking, passive crafts, and public craft visibility.
 * See BitCraft Game Reference Subscription Quick Reference.
 *
 * Note: inventory_state and progressive_action_state are shared with Story 5.6.
 * building_state, passive_craft_state, public_progressive_action_state are NEW.
 * experience_state is shared with Story 5.6.
 */
export const STORY_57_TABLES = [
  'SELECT * FROM inventory_state',
  'SELECT * FROM building_state',
  'SELECT * FROM progressive_action_state',
  'SELECT * FROM passive_craft_state',
  'SELECT * FROM experience_state',
  'SELECT * FROM public_progressive_action_state',
];

/**
 * Subscribe to all 13 tables required for Story 5.7
 *
 * Subscribes to: all 7 from Story 5.5 (user_state, player_state,
 * signed_in_player_state, mobile_entity_state, health_state, stamina_state,
 * player_action_state) PLUS inventory_state, building_state,
 * progressive_action_state, passive_craft_state, experience_state,
 * public_progressive_action_state
 *
 * Designed for reuse by Story 5.8 which may need the same crafting tables.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns Promise that resolves when subscription is applied
 */
export async function subscribeToStory57Tables(
  testConnection: SpacetimeDBTestConnection
): Promise<void> {
  return subscribeToTables(testConnection, [...STORY_55_TABLES, ...STORY_57_TABLES]);
}

/**
 * Additional tables required for Story 5.8: Error Scenarios & Graceful Degradation
 *
 * These 2 tables extend Story 5.5's 7 tables to provide the 9 tables needed
 * for error scenario testing, including inventory state verification and chat
 * message error testing.
 * See BitCraft Game Reference Subscription Quick Reference.
 *
 * Note: inventory_state is shared with Stories 5.6 and 5.7.
 * chat_message_state is NEW for Story 5.8.
 */
export const STORY_58_TABLES = [
  'SELECT * FROM inventory_state',
  'SELECT * FROM chat_message_state',
];

/**
 * Subscribe to all 9 tables required for Story 5.8
 *
 * Subscribes to: all 7 from Story 5.5 (user_state, player_state,
 * signed_in_player_state, mobile_entity_state, health_state, stamina_state,
 * player_action_state) PLUS inventory_state, chat_message_state
 *
 * Designed for error scenario testing: unknown reducers, invalid arguments,
 * precondition violations, and connection loss recovery.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @returns Promise that resolves when subscription is applied
 */
export async function subscribeToStory58Tables(
  testConnection: SpacetimeDBTestConnection
): Promise<void> {
  return subscribeToTables(testConnection, [...STORY_55_TABLES, ...STORY_58_TABLES]);
}

/**
 * Wait for a table row update (modification) matching a predicate
 *
 * SpacetimeDB SDK may emit row modifications as a delete+insert pair rather than
 * a direct update callback. This helper handles both patterns:
 * 1. If the table has an `onUpdate` callback, use it directly
 * 2. Otherwise, listen for a `onDelete` followed by `onInsert` on the same table
 *
 * This is critical for `mobile_entity_state` which is UPDATED (not inserted/deleted)
 * when a player moves. See risk R5-016 in Story 5.5 Dev Notes.
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param tableName - Name of the table to watch (e.g., 'mobile_entity_state')
 * @param predicate - Function that returns true when the desired updated row is found
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms)
 * @returns Promise resolving to the old row (if available), new row, and elapsed time
 * @throws Error with descriptive message if timeout is reached
 */
export async function waitForTableUpdate<T = unknown>(
  testConnection: SpacetimeDBTestConnection,
  tableName: string,
  predicate: (newRow: T) => boolean = () => true,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS
): Promise<{ oldRow: T | null; newRow: T; elapsedMs: number }> {
  const start = performance.now();

  return new Promise((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(
          new Error(
            `waitForTableUpdate('${tableName}') timed out after ${timeoutMs}ms. ` +
              'No matching row update was detected. Check that the reducer executed ' +
              'successfully and the subscription includes this table.'
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

      // Strategy 1: Use onUpdate if available (preferred, more efficient).
      // This is EXCLUSIVE -- if onUpdate exists, we register it and return immediately
      // without falling through to Strategy 2. If the onUpdate callback never fires,
      // the timeout above will reject the promise.
      if (typeof table.onUpdate === 'function') {
        table.onUpdate((oldRow: T, newRow: T) => {
          if (!settled && predicate(newRow)) {
            settled = true;
            clearTimeout(timeoutId);
            const elapsedMs = performance.now() - start;
            resolve({ oldRow, newRow, elapsedMs });
          }
        });
        return;
      }

      // Strategy 2: Fallback to delete+insert pair detection
      // SpacetimeDB SDK may emit updates as delete-then-insert sequences.
      // We track deletions matching the predicate so oldRow is correctly paired.
      let deletedRow: T | null = null;

      if (typeof table.onDelete === 'function') {
        table.onDelete((row: T) => {
          if (!settled && predicate(row)) {
            deletedRow = row;
          }
        });
      }

      if (typeof table.onInsert === 'function') {
        table.onInsert((row: T) => {
          if (!settled && predicate(row)) {
            settled = true;
            clearTimeout(timeoutId);
            const elapsedMs = performance.now() - start;
            resolve({ oldRow: deletedRow, newRow: row, elapsedMs });
          }
        });
      } else {
        settled = true;
        clearTimeout(timeoutId);
        reject(
          new Error(
            `Table '${tableName}' does not have onUpdate or onInsert methods. ` +
              'Cannot detect row updates.'
          )
        );
      }
    } catch (error) {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        reject(
          new Error(
            `waitForTableUpdate('${tableName}') setup failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }
  });
}
