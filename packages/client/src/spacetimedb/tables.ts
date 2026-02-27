/**
 * SpacetimeDB Table Accessors
 *
 * Type-safe in-memory cache for subscribed table data.
 * Provides get, getAll, and query methods for each table.
 */

import { EventEmitter } from 'events';
import type { SubscriptionManager } from './subscriptions';

/**
 * Common ID field names used in BitCraft tables for row identification
 */
const ID_FIELD_NAMES = ['id', 'entity_id', 'player_id'] as const;

/**
 * Maximum cache size per table (prevent memory exhaustion)
 */
const MAX_CACHE_SIZE_PER_TABLE = 10000;

/**
 * Generic table accessor with query methods
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TableAccessor<T = any> {
  private tableName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache: Map<any, T> = new Map();

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get a single row by ID
   *
   * @param id - Row ID
   * @returns Row data or undefined if not found
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(id: any): T | undefined {
    return this.cache.get(id);
  }

  /**
   * Get all cached rows
   *
   * @returns Array of all rows in cache
   */
  getAll(): T[] {
    return Array.from(this.cache.values());
  }

  /**
   * Query rows with a predicate function
   *
   * @param predicate - Filter function
   * @returns Array of matching rows
   *
   * @example
   * ```typescript
   * const highLevelPlayers = tables.player_state.query(
   *   (player) => player.level > 50
   * );
   * ```
   */
  query(predicate: (row: T) => boolean): T[] {
    return this.getAll().filter(predicate);
  }

  /**
   * Update cache with new row (insert or update)
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsert(id: any, row: T): void {
    if (row === undefined || row === null) {
      throw new TypeError('Cannot upsert null or undefined row');
    }

    // Security: Enforce cache size limit (prevent memory exhaustion)
    if (!this.cache.has(id) && this.cache.size >= MAX_CACHE_SIZE_PER_TABLE) {
      // Evict oldest entry (simple FIFO strategy)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(id, row);
  }

  /**
   * Remove row from cache
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete(id: any): void {
    if (id === undefined || id === null) {
      return; // Silently ignore invalid deletes
    }
    this.cache.delete(id);
  }

  /**
   * Clear all cached data
   * @internal
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Set multiple rows (for initial snapshot)
   * @internal
   */
  setAll(rows: T[]): void {
    if (!Array.isArray(rows)) {
      throw new TypeError('setAll() requires an array of rows');
    }

    this.cache.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows.forEach((row: any) => {
      if (!row || typeof row !== 'object') {
        return; // Skip invalid rows
      }
      // Try to extract ID from common field names
      const id = this.extractRowId(row);
      this.cache.set(id, row);
    });
  }

  /**
   * Extract row ID from common field names
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractRowId(row: any): any {
    for (const fieldName of ID_FIELD_NAMES) {
      if (row[fieldName] !== undefined && row[fieldName] !== null) {
        return row[fieldName];
      }
    }
    // Fallback: use entire row as key (for tables without standard ID field)
    return row;
  }
}

/**
 * Table accessors interface
 *
 * Provides type-safe accessors for all BitCraft tables.
 * Common tables that should exist after type generation:
 * - player_state
 * - entity_position
 * - inventory
 * - etc.
 */
export interface TableAccessors {
  [tableName: string]: TableAccessor;
  // Common tables (will exist after codegen)
  player_state: TableAccessor;
  entity_position: TableAccessor;
  inventory: TableAccessor;
}

/**
 * Table Manager
 *
 * Manages table accessors and synchronizes cache with subscriptions.
 *
 * @internal
 */
export class TableManager extends EventEmitter {
  private subscriptions: SubscriptionManager;
  private tables: Map<string, TableAccessor> = new Map();
  private _tableAccessors: TableAccessors;

  constructor(subscriptions: SubscriptionManager) {
    super();
    this.subscriptions = subscriptions;

    // Create proxy for dynamic table access
    this._tableAccessors = new Proxy({} as TableAccessors, {
      get: (target, prop: string) => {
        if (typeof prop === 'string') {
          // Security: Prevent prototype pollution attacks
          if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') {
            return undefined;
          }

          // Security: Validate property name (table name)
          const tableNameRegex = /^[a-zA-Z0-9_]+$/;
          if (!tableNameRegex.test(prop)) {
            return undefined;
          }

          return this.getOrCreateTable(prop);
        }
        return undefined;
      },
    });

    // Set up subscription event listeners
    this.setupSubscriptionListeners();
  }

  /**
   * Get table accessors
   */
  get accessors(): TableAccessors {
    return this._tableAccessors;
  }

  /**
   * Get or create a table accessor
   */
  private getOrCreateTable(tableName: string): TableAccessor {
    let table = this.tables.get(tableName);
    if (!table) {
      table = new TableAccessor(tableName);
      this.tables.set(tableName, table);
    }
    return table;
  }

  /**
   * Set up listeners for subscription events to update cache
   */
  private setupSubscriptionListeners(): void {
    // Update cache on table snapshot
    this.subscriptions.on('tableSnapshot', ({ tableName, rows }) => {
      const table = this.getOrCreateTable(tableName);
      table.setAll(rows);
    });

    // Update cache on row insert
    this.subscriptions.on('rowInserted', ({ tableName, row }) => {
      const table = this.getOrCreateTable(tableName);
      const id = this.extractRowId(row);
      table.upsert(id, row);
    });

    // Update cache on row update
    this.subscriptions.on('rowUpdated', ({ tableName, newRow }) => {
      const table = this.getOrCreateTable(tableName);
      const id = this.extractRowId(newRow);
      table.upsert(id, newRow);
    });

    // Remove from cache on row delete
    this.subscriptions.on('rowDeleted', ({ tableName, row }) => {
      const table = this.getOrCreateTable(tableName);
      const id = this.extractRowId(row);
      table.delete(id);
    });
  }

  /**
   * Extract row ID from common field names
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractRowId(row: any): any {
    if (!row || typeof row !== 'object') {
      return row;
    }
    for (const fieldName of ID_FIELD_NAMES) {
      if (row[fieldName] !== undefined && row[fieldName] !== null) {
        return row[fieldName];
      }
    }
    return row;
  }

  /**
   * Clear all table caches
   *
   * Called on disconnect to clean up cached data.
   */
  clearAll(): void {
    this.tables.forEach((table) => table.clear());
    this.tables.clear();
  }
}
