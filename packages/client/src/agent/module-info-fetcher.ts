/**
 * SpacetimeDB Module Info Fetcher
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Fetches module metadata (reducer names, parameter types, table names)
 * from the SpacetimeDB HTTP API for validation purposes.
 * Also provides an offline factory for testing and development without Docker.
 *
 * @module agent/module-info-fetcher
 */

import type {
  ModuleInfo,
  ModuleInfoProvider,
  ModuleReducerInfo,
} from './config-validation-types.js';
import { ConfigValidationError } from './config-validation-types.js';

/** Maximum response size in bytes (10MB) -- OWASP A03 DoS prevention */
const MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024;

/** Default timeout for HTTP requests in milliseconds */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Allowed URL schemes for SSRF protection */
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/** Valid database name pattern: alphanumeric, underscores, hyphens (1-128 chars) */
const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Configuration for SpacetimeDBModuleInfoFetcher.
 */
export interface ModuleInfoFetcherConfig {
  /** SpacetimeDB server URL (e.g., 'http://localhost:3000') */
  url: string;
  /** Database/module name (e.g., 'bitcraft') */
  database: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
}

/**
 * Fetches module metadata from the SpacetimeDB HTTP API.
 * Implements the ModuleInfoProvider interface for use with validation functions.
 *
 * Security:
 * - SSRF protection: validates URL scheme is http or https only
 * - Response size limit: rejects responses > 10MB
 * - Timeout: configurable, defaults to 10 seconds
 */
export class SpacetimeDBModuleInfoFetcher implements ModuleInfoProvider {
  private readonly url: string;
  private readonly database: string;
  private readonly timeoutMs: number;

  constructor(config: ModuleInfoFetcherConfig) {
    this.url = config.url;
    this.database = config.database;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // SSRF protection: validate URL scheme
    this.validateUrlScheme(this.url);

    // Input validation: database name must be safe for URL path interpolation
    this.validateDatabaseName(this.database);
  }

  /**
   * Fetch module metadata from SpacetimeDB HTTP API.
   * Endpoint: GET {url}/database/{database}/info
   *
   * @returns Parsed ModuleInfo with reducer and table metadata
   * @throws {ConfigValidationError} With appropriate error codes on failure
   */
  async getModuleInfo(): Promise<ModuleInfo> {
    const endpoint = `${this.url}/database/${this.database}/info`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new ConfigValidationError(
          `SpacetimeDB module info request failed with status ${response.status}: ${endpoint}`,
          'MODULE_FETCH_FAILED',
          undefined,
          `HTTP ${response.status} ${response.statusText}`
        );
      }

      // Check response size before reading body (OWASP A03)
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE_BYTES) {
        throw new ConfigValidationError(
          `SpacetimeDB module info response exceeds 10MB size limit`,
          'MODULE_FETCH_FAILED',
          undefined,
          `Content-Length: ${contentLength}`
        );
      }

      const text = await response.text();

      // Check actual response size
      if (Buffer.byteLength(text, 'utf-8') > MAX_RESPONSE_SIZE_BYTES) {
        throw new ConfigValidationError(
          `SpacetimeDB module info response exceeds 10MB size limit`,
          'MODULE_FETCH_FAILED',
          undefined,
          `Response size: ${Buffer.byteLength(text, 'utf-8')} bytes`
        );
      }

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new ConfigValidationError(
          `SpacetimeDB module info response is not valid JSON: ${endpoint}`,
          'MODULE_FETCH_FAILED',
          undefined,
          'Malformed JSON response'
        );
      }

      return this.parseModuleInfo(data);
    } catch (err: unknown) {
      if (err instanceof ConfigValidationError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new ConfigValidationError(
          `SpacetimeDB module info request timed out after ${this.timeoutMs}ms: ${endpoint}`,
          'VALIDATION_TIMEOUT',
          undefined,
          `Timeout: ${this.timeoutMs}ms`
        );
      }

      // Network errors (ECONNREFUSED, DNS failures, etc.)
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ConfigValidationError(
        `Failed to fetch SpacetimeDB module info: ${message}`,
        'MODULE_FETCH_FAILED',
        undefined,
        message
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Validate URL scheme for SSRF protection.
   * Only http and https are allowed.
   */
  private validateUrlScheme(url: string): void {
    try {
      const parsed = new URL(url);
      if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
        throw new ConfigValidationError(
          `Invalid URL scheme "${parsed.protocol}" -- only http: and https: are allowed`,
          'MODULE_FETCH_FAILED',
          undefined,
          `URL: ${url}`
        );
      }
    } catch (err: unknown) {
      if (err instanceof ConfigValidationError) {
        throw err;
      }
      throw new ConfigValidationError(
        `Invalid URL: ${url}`,
        'MODULE_FETCH_FAILED',
        undefined,
        `URL: ${url}`
      );
    }
  }

  /**
   * Validate database name for URL path safety.
   * Prevents path traversal (e.g., '../../admin') and URL injection.
   * Accepts alphanumeric characters, underscores, and hyphens (1-128 chars).
   */
  private validateDatabaseName(database: string): void {
    if (!DATABASE_NAME_PATTERN.test(database)) {
      throw new ConfigValidationError(
        `Invalid database name "${database}" -- must be 1-128 alphanumeric characters, underscores, or hyphens`,
        'MODULE_FETCH_FAILED',
        undefined,
        `Database: ${database}`
      );
    }
  }

  /**
   * Parse the SpacetimeDB /info endpoint response into ModuleInfo.
   * Defensively extracts reducer and table information from the response.
   *
   * The response shape may vary by SpacetimeDB version. This parser
   * handles the known response structure and falls back gracefully.
   */
  private parseModuleInfo(data: unknown): ModuleInfo {
    if (typeof data !== 'object' || data === null) {
      throw new ConfigValidationError(
        'SpacetimeDB module info response is not an object',
        'MODULE_FETCH_FAILED',
        undefined,
        'Expected JSON object at root'
      );
    }

    const obj = data as Record<string, unknown>;
    const reducers = this.extractReducers(obj);
    const tables = this.extractTables(obj);

    return { reducers, tables };
  }

  /**
   * Extract a property from the response, checking root level first,
   * then module_def (snake_case), then moduleDef (camelCase).
   */
  private extractProperty(obj: Record<string, unknown>, property: string): unknown {
    if (obj[property] !== undefined && obj[property] !== null) {
      return obj[property];
    }
    const moduleDef =
      typeof obj.module_def === 'object' && obj.module_def !== null
        ? (obj.module_def as Record<string, unknown>)
        : undefined;
    if (moduleDef?.[property] !== undefined && moduleDef?.[property] !== null) {
      return moduleDef[property];
    }
    const moduleDefCamel =
      typeof obj.moduleDef === 'object' && obj.moduleDef !== null
        ? (obj.moduleDef as Record<string, unknown>)
        : undefined;
    return moduleDefCamel?.[property];
  }

  /**
   * Extract reducer information from the module info response.
   * Handles multiple possible response structures defensively.
   */
  private extractReducers(obj: Record<string, unknown>): ModuleReducerInfo[] {
    const rawReducers = this.extractProperty(obj, 'reducers');

    if (!Array.isArray(rawReducers)) {
      // No reducer information found -- return empty list
      return [];
    }

    return rawReducers.map((raw: unknown) => {
      if (typeof raw !== 'object' || raw === null) {
        return { name: String(raw), params: [] };
      }

      const entry = raw as Record<string, unknown>;
      const name = String(entry.name ?? entry.reducer_name ?? '');

      // Extract params from various possible structures
      const rawParams = entry.params ?? entry.args ?? entry.parameters ?? [];
      const params = Array.isArray(rawParams)
        ? rawParams.map((p: unknown) => {
            if (typeof p !== 'object' || p === null) {
              return { name: '', type: String(p) };
            }
            const param = p as Record<string, unknown>;
            return {
              name: String(param.name ?? param.param_name ?? ''),
              type: String(param.type ?? param.algebraic_type ?? param.param_type ?? ''),
            };
          })
        : [];

      return { name, params };
    });
  }

  /**
   * Extract table names from the module info response.
   * Handles multiple possible response structures defensively.
   */
  private extractTables(obj: Record<string, unknown>): string[] {
    const rawTables = this.extractProperty(obj, 'tables');

    if (!Array.isArray(rawTables)) {
      // No table information found -- return empty list
      return [];
    }

    return rawTables.map((raw: unknown) => {
      if (typeof raw === 'string') {
        return raw;
      }
      if (typeof raw === 'object' && raw !== null) {
        const entry = raw as Record<string, unknown>;
        return String(entry.name ?? entry.table_name ?? '');
      }
      return String(raw);
    });
  }
}

/**
 * Create a ModuleInfo object for offline validation or simple testing.
 * Creates reducers with only names (empty params arrays) and the given table names.
 * For richer mocks with params, use createMockModuleInfo() from the test mocks.
 *
 * @param reducerNames - Array of reducer names to include
 * @param tableNames - Array of table names to include
 * @returns ModuleInfo with simple reducer entries and table names
 */
export function createOfflineModuleInfo(reducerNames: string[], tableNames: string[]): ModuleInfo {
  return {
    reducers: reducerNames.map((name) => ({ name, params: [] })),
    tables: tableNames,
  };
}
