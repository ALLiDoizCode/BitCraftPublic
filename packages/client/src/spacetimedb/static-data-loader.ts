/**
 * Static Data Loader
 *
 * Loads all static data tables (*_desc) from SpacetimeDB on startup.
 * Builds in-memory lookup maps for efficient O(1) queries.
 *
 * Static data tables are read-only game definitions that don't change at runtime.
 * They are loaded once and cached persistently across reconnections.
 */

import { EventEmitter } from 'events';
import type { SpacetimeDBConnection } from './connection';
import type { SubscriptionManager } from './subscriptions';
import { STATIC_DATA_TABLES } from './static-data-tables';

/**
 * Loading state enum
 */
export type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Static data row type
 *
 * Generic type for static data table rows.
 */
export type StaticDataRow = Record<string, unknown>;

/**
 * Static data cache structure
 *
 * Maps table name → (row ID → row data)
 * Enables O(1) lookups by table and ID.
 */
export type StaticDataCache = Map<string, Map<string | number, StaticDataRow>>;

/**
 * Loading progress event
 */
export interface LoadingProgressEvent {
  loaded: number;
  total: number;
  tableName: string;
}

/**
 * Table snapshot event
 */
export interface TableSnapshotEvent {
  tableName: string;
  rows: StaticDataRow[];
}

/**
 * Loading metrics event
 */
export interface LoadingMetricsEvent {
  totalTime: number;
  tableCount: number;
  avgTimePerTable: number;
  failedTables: string[];
}

/**
 * Static Data Loader Metrics
 */
export interface StaticDataMetrics {
  loadTime: number;
  tableCount: number;
  cachedAt: Date;
  failedTables: string[];
}

/**
 * Static Data Loader
 *
 * Manages loading and caching of all static data tables.
 *
 * @example
 * ```typescript
 * const loader = new StaticDataLoader(connection, subscriptions);
 *
 * loader.on('loadingProgress', ({ loaded, total, tableName }) => {
 *   console.log(`Loading ${tableName} (${loaded}/${total})`);
 * });
 *
 * loader.on('staticDataLoaded', () => {
 *   console.log('All static data loaded');
 * });
 *
 * await loader.load();
 *
 * // Query data
 * const item = loader.get('item_desc', 1);
 * const allItems = loader.getAll('item_desc');
 * ```
 */
export class StaticDataLoader extends EventEmitter {
  private connection: SpacetimeDBConnection;
  private subscriptions: SubscriptionManager;
  private cache: StaticDataCache = new Map();
  private state: LoadingState = 'idle';
  private metrics: StaticDataMetrics | null = null;

  /** Maximum time to wait for static data loading (NFR6: 10 seconds) */
  private readonly LOADING_TIMEOUT_MS = 10000;

  /** Maximum time to wait for a single table snapshot (per-table timeout) */
  private readonly TABLE_TIMEOUT_MS = 5000;

  /** Number of tables to load in parallel (tuned for optimal throughput) */
  private readonly BATCH_SIZE = 30;

  /** Maximum retry attempts for failed table loads */
  private readonly MAX_RETRIES = 3;

  /** Exponential backoff base delay (ms) */
  private readonly RETRY_BASE_DELAY_MS = 100;

  /** Maximum cache size per table (prevent memory exhaustion) */
  private readonly MAX_ROWS_PER_TABLE = 50000;

  /** Maximum total cache size across all tables */
  private readonly MAX_TOTAL_CACHE_SIZE = 1000000;

  constructor(connection: SpacetimeDBConnection, subscriptions: SubscriptionManager) {
    super();
    this.connection = connection;
    this.subscriptions = subscriptions;
  }

  /**
   * Get current loading state
   */
  get loadingState(): LoadingState {
    return this.state;
  }

  /**
   * Check if cache is populated
   */
  isCached(): boolean {
    return this.cache.size > 0 && this.state === 'loaded';
  }

  /**
   * Load all static data tables
   *
   * Subscribes to each table, waits for snapshot, then unsubscribes.
   * Tables are loaded in parallel batches for performance.
   *
   * @throws Error if loading times out (>10s) or connection is not established
   */
  async load(): Promise<void> {
    // Guard: connection must be established
    if (this.connection.connectionState !== 'connected') {
      throw new Error('Cannot load static data: SpacetimeDB not connected.');
    }

    // Skip if already loaded (cache persistence)
    if (this.isCached()) {
      this.emit('staticDataLoaded', { cached: true });
      return;
    }

    // Transition state
    this.state = 'loading';
    const startTime = Date.now();
    const failedTables: string[] = [];

    try {
      // Load tables in parallel batches
      const tablesToLoad = [...STATIC_DATA_TABLES];
      const batches: string[][] = [];

      // Split into batches
      for (let i = 0; i < tablesToLoad.length; i += this.BATCH_SIZE) {
        batches.push(tablesToLoad.slice(i, i + this.BATCH_SIZE));
      }

      let loadedCount = 0;

      // Process each batch
      for (const batch of batches) {
        const batchPromises = batch.map(async (tableName) => {
          try {
            await this.loadTable(tableName);
            loadedCount++;
            this.emit('loadingProgress', {
              loaded: loadedCount,
              total: STATIC_DATA_TABLES.length,
              tableName,
            } as LoadingProgressEvent);
          } catch (error) {
            // Log warning but continue loading other tables
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to load static data table: ${tableName} - ${errorMessage}`);
            failedTables.push(tableName);
          }
        });

        await Promise.all(batchPromises);
      }

      // Calculate metrics
      const totalTime = Date.now() - startTime;
      const tableCount = STATIC_DATA_TABLES.length - failedTables.length;
      const avgTimePerTable = tableCount > 0 ? totalTime / tableCount : 0;

      this.metrics = {
        loadTime: totalTime,
        tableCount,
        cachedAt: new Date(),
        failedTables,
      };

      // Emit metrics
      this.emit('loadingMetrics', {
        totalTime,
        tableCount,
        avgTimePerTable,
        failedTables,
      } as LoadingMetricsEvent);

      // Check total cache size (security)
      const totalCacheSize = this.getTotalCacheSize();
      if (totalCacheSize > this.MAX_TOTAL_CACHE_SIZE) {
        console.warn(
          `Static data cache exceeds maximum size: ${totalCacheSize} rows > ${this.MAX_TOTAL_CACHE_SIZE} rows. ` +
            `Consider increasing MAX_TOTAL_CACHE_SIZE or reducing loaded tables.`
        );
      }

      // Warn if NFR6 violated (>10s)
      if (totalTime > this.LOADING_TIMEOUT_MS) {
        console.warn(
          `Static data loading exceeded NFR6 timeout: ${totalTime}ms > ${this.LOADING_TIMEOUT_MS}ms`
        );
      }

      // Transition state
      this.state = 'loaded';
      this.emit('staticDataLoaded', { cached: false, metrics: this.metrics });
    } catch (error) {
      this.state = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Static data loading failed: ${errorMessage}`);
    }
  }

  /**
   * Load a single static data table
   *
   * Subscribes, waits for snapshot, stores in cache, then unsubscribes.
   * Implements retry logic with exponential backoff.
   *
   * @param tableName - Name of table to load
   * @param retryCount - Current retry attempt (internal)
   * @throws Error if table fails to load after max retries
   */
  private async loadTable(tableName: string, retryCount = 0): Promise<void> {
    // Validate table name against allowlist (security)
    if (!this.isValidTableName(tableName)) {
      throw new TypeError(`Invalid table name: ${tableName}. Table names must end with '_desc'.`);
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let eventListener: ((event: TableSnapshotEvent) => void) | null = null;

    try {
      // Subscribe to table (no filter = all rows)
      const handle = await this.subscriptions.subscribe(tableName, {});

      // Wait for table snapshot event
      const rows = await new Promise<StaticDataRow[]>((resolve, reject) => {
        // Set up timeout for this specific table
        timeoutId = setTimeout(() => {
          // Clean up event listener on timeout
          if (eventListener) {
            this.subscriptions.removeListener('tableSnapshot', eventListener);
          }
          reject(new Error(`Timeout waiting for snapshot: ${tableName}`));
        }, this.TABLE_TIMEOUT_MS);

        // Set up event listener
        eventListener = (event: TableSnapshotEvent) => {
          if (event.tableName === tableName) {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            // Remove listener immediately after matching event
            if (eventListener) {
              this.subscriptions.removeListener('tableSnapshot', eventListener);
              eventListener = null;
            }
            resolve(event.rows);
          }
        };

        this.subscriptions.on('tableSnapshot', eventListener);
      });

      // Build lookup map for this table
      const lookupMap = this.buildLookupMap(tableName, rows);

      // Enforce cache size limits (security)
      if (lookupMap.size > this.MAX_ROWS_PER_TABLE) {
        console.warn(
          `Table ${tableName} exceeds max row limit (${lookupMap.size} > ${this.MAX_ROWS_PER_TABLE}). ` +
            `Loading first ${this.MAX_ROWS_PER_TABLE} rows only.`
        );
        // Trim to max size
        const trimmedMap = new Map(
          Array.from(lookupMap.entries()).slice(0, this.MAX_ROWS_PER_TABLE)
        );
        this.cache.set(tableName, trimmedMap);
      } else {
        this.cache.set(tableName, lookupMap);
      }

      // Unsubscribe immediately (static data doesn't need ongoing updates)
      handle.unsubscribe();
    } catch (error) {
      // Clean up event listener and timeout on error
      if (eventListener) {
        this.subscriptions.removeListener('tableSnapshot', eventListener);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Retry with exponential backoff
      if (retryCount < this.MAX_RETRIES) {
        const delay = this.RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.loadTable(tableName, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Validate table name against allowlist
   *
   * Ensures table name follows static data naming convention.
   * Prevents injection attacks and invalid table access.
   *
   * @param tableName - Name of table to validate
   * @returns True if valid, false otherwise
   */
  private isValidTableName(tableName: string): boolean {
    // Static data tables must end with '_desc' suffix
    return typeof tableName === 'string' && tableName.endsWith('_desc') && tableName.length > 5;
  }

  /**
   * Build lookup map for a table
   *
   * Determines primary key field and creates Map for O(1) lookups.
   *
   * @param tableName - Name of table
   * @param rows - Table rows
   * @returns Map keyed by primary ID
   */
  private buildLookupMap(
    tableName: string,
    rows: StaticDataRow[]
  ): Map<string | number, StaticDataRow> {
    const lookupMap = new Map<string | number, StaticDataRow>();

    for (const row of rows) {
      // Determine primary key field (common patterns)
      const primaryKey = this.getPrimaryKey(tableName, row);

      if (primaryKey !== null && primaryKey !== undefined) {
        // Warn if duplicate key detected
        if (lookupMap.has(primaryKey)) {
          console.warn(
            `Duplicate primary key in ${tableName}: ${primaryKey} (using latest value).`
          );
        }

        lookupMap.set(primaryKey, row);
      } else {
        console.warn(`Row in ${tableName} has no valid primary key.`, row);
      }
    }

    return lookupMap;
  }

  /**
   * Determine primary key for a row
   *
   * Tries common field names: id, desc_id, type_id, etc.
   *
   * @param tableName - Name of table (unused for now, but may be needed for special cases)
   * @param row - Table row
   * @returns Primary key value or null
   */
  private getPrimaryKey(tableName: string, row: StaticDataRow): string | number | null {
    // Try common primary key field names
    const keyFields = ['id', 'desc_id', 'type_id', `${tableName}_id`];

    for (const field of keyFields) {
      const value = row[field];
      if (value !== null && value !== undefined) {
        // Validate that the key is a string or number
        if (typeof value === 'string' || typeof value === 'number') {
          return value;
        }
      }
    }

    return null;
  }

  /**
   * Get a single row by ID
   *
   * @param tableName - Name of static data table
   * @param id - Primary key value
   * @returns Row data or undefined if not found
   * @throws Error if table not loaded or doesn't exist
   * @throws TypeError if table name is invalid
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T = any>(tableName: string, id: string | number): T | undefined {
    this.guardLoaded();
    this.guardValidTableName(tableName);
    this.guardTableExists(tableName);

    const lookupMap = this.cache.get(tableName);
    return lookupMap?.get(id) as T | undefined;
  }

  /**
   * Get all rows for a table
   *
   * @param tableName - Name of static data table
   * @returns Array of all rows
   * @throws Error if table not loaded or doesn't exist
   * @throws TypeError if table name is invalid
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAll<T = any>(tableName: string): T[] {
    this.guardLoaded();
    this.guardValidTableName(tableName);
    this.guardTableExists(tableName);

    const lookupMap = this.cache.get(tableName);
    return lookupMap ? (Array.from(lookupMap.values()) as T[]) : [];
  }

  /**
   * Query rows with a predicate function
   *
   * @param tableName - Name of static data table
   * @param predicate - Filter function
   * @returns Array of matching rows
   * @throws Error if table not loaded or doesn't exist
   * @throws TypeError if table name is invalid
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = any>(tableName: string, predicate: (row: T) => boolean): T[] {
    this.guardLoaded();
    this.guardValidTableName(tableName);
    this.guardTableExists(tableName);

    const allRows = this.getAll<T>(tableName);
    return allRows.filter(predicate);
  }

  /**
   * Force reload all static data
   *
   * Clears cache and reloads from SpacetimeDB.
   */
  async forceReload(): Promise<void> {
    this.clear();
    await this.load();
  }

  /**
   * Clear cache
   *
   * Resets cache and state to idle.
   */
  clear(): void {
    this.cache.clear();
    this.state = 'idle';
    this.metrics = null;
  }

  /**
   * Get loading metrics
   *
   * @returns Metrics or null if not loaded yet
   */
  getMetrics(): StaticDataMetrics | null {
    return this.metrics;
  }

  /**
   * Get total cache size (number of rows across all tables)
   *
   * @returns Total number of cached rows
   */
  getTotalCacheSize(): number {
    let total = 0;
    for (const lookupMap of this.cache.values()) {
      total += lookupMap.size;
    }
    return total;
  }

  /**
   * Guard: ensure data is loaded
   *
   * @throws Error if loading state is not 'loaded'
   */
  private guardLoaded(): void {
    if (this.state !== 'loaded') {
      throw new Error(`Static data not loaded. Current state: ${this.state}. Call load() first.`);
    }
  }

  /**
   * Guard: ensure table name is valid
   *
   * Validates table name against security allowlist.
   *
   * @param tableName - Table name to validate
   * @throws TypeError if table name is invalid
   */
  private guardValidTableName(tableName: string): void {
    if (!this.isValidTableName(tableName)) {
      throw new TypeError(
        `Invalid static data table name: ${tableName}. Table names must end with '_desc'.`
      );
    }
  }

  /**
   * Guard: ensure table exists in cache
   *
   * @param tableName - Table name to check
   * @throws TypeError if table doesn't exist in cache
   */
  private guardTableExists(tableName: string): void {
    if (!this.cache.has(tableName)) {
      throw new TypeError(`Static data table does not exist: ${tableName}`);
    }
  }
}
