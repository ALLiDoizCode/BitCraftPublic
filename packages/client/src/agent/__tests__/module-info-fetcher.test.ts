/**
 * Module Info Fetcher Tests (AC: 1, 3)
 * Story 4.3: Configuration Validation Against SpacetimeDB
 *
 * Tests for SpacetimeDBModuleInfoFetcher class and createOfflineModuleInfo factory.
 * Uses mocked global fetch to test HTTP request handling, error mapping,
 * SSRF protection, response size limits, and timeout behavior.
 *
 * Validates: AC1 (reducer existence), AC3 (table subscription validation)
 * Security: OWASP A03 (SSRF protection, response size limit)
 *
 * Test count: 11
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpacetimeDBModuleInfoFetcher, createOfflineModuleInfo } from '../module-info-fetcher.js';
import { ConfigValidationError } from '../config-validation-types.js';

// Mock global fetch
const mockFetch = vi.fn();

/**
 * Helper to create a mock Response object.
 */
function createMockResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers({
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(text, 'utf-8')),
    }),
    text: async () => text,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  } as unknown as Response;
}

describe('SpacetimeDBModuleInfoFetcher (Story 4.3)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('Successful fetch', () => {
    it('getModuleInfo() with mocked successful fetch -> returns parsed ModuleInfo', async () => {
      // Given a successful API response with reducers and tables
      const responseBody = {
        reducers: [
          {
            name: 'player_move',
            params: [
              { name: 'identity', type: 'String' },
              { name: 'target_x', type: 'i32' },
            ],
          },
        ],
        tables: [{ name: 'player_state' }, { name: 'terrain' }],
      };
      mockFetch.mockResolvedValue(createMockResponse(responseBody));

      const fetcher = new SpacetimeDBModuleInfoFetcher({
        url: 'http://localhost:3000',
        database: 'bitcraft',
      });

      // When getModuleInfo is called
      const moduleInfo = await fetcher.getModuleInfo();

      // Then it should return parsed ModuleInfo
      expect(moduleInfo.reducers).toHaveLength(1);
      expect(moduleInfo.reducers[0].name).toBe('player_move');
      expect(moduleInfo.reducers[0].params).toHaveLength(2);
      expect(moduleInfo.tables).toHaveLength(2);
      expect(moduleInfo.tables).toContain('player_state');
      expect(moduleInfo.tables).toContain('terrain');

      // Verify the correct endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/database/bitcraft/info',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('Response structure parsing', () => {
    it('getModuleInfo() parses module_def nested response structure', async () => {
      // Given a response with reducers/tables nested under module_def (snake_case variant)
      const responseBody = {
        module_def: {
          reducers: [
            {
              name: 'harvest_start',
              params: [
                { name: 'identity', type: 'String' },
                { name: 'resource_id', type: 'u64' },
              ],
            },
          ],
          tables: [{ name: 'resource_node' }, { name: 'inventory' }],
        },
      };
      mockFetch.mockResolvedValue(createMockResponse(responseBody));

      const fetcher = new SpacetimeDBModuleInfoFetcher({
        url: 'http://localhost:3000',
        database: 'bitcraft',
      });

      // When getModuleInfo is called
      const moduleInfo = await fetcher.getModuleInfo();

      // Then it should extract reducers and tables from nested structure
      expect(moduleInfo.reducers).toHaveLength(1);
      expect(moduleInfo.reducers[0].name).toBe('harvest_start');
      expect(moduleInfo.reducers[0].params).toHaveLength(2);
      expect(moduleInfo.tables).toContain('resource_node');
      expect(moduleInfo.tables).toContain('inventory');
    });

    it('getModuleInfo() parses moduleDef camelCase response structure', async () => {
      // Given a response with reducers/tables nested under moduleDef (camelCase variant)
      const responseBody = {
        moduleDef: {
          reducers: [
            {
              name: 'craft_item',
              params: [
                { name: 'identity', type: 'String' },
                { name: 'recipe_id', type: 'u64' },
                { name: 'quantity', type: 'u32' },
              ],
            },
          ],
          tables: [{ name: 'item_desc' }, { name: 'recipe_desc' }],
        },
      };
      mockFetch.mockResolvedValue(createMockResponse(responseBody));

      const fetcher = new SpacetimeDBModuleInfoFetcher({
        url: 'http://localhost:3000',
        database: 'bitcraft',
      });

      // When getModuleInfo is called
      const moduleInfo = await fetcher.getModuleInfo();

      // Then it should extract reducers and tables from camelCase nested structure
      expect(moduleInfo.reducers).toHaveLength(1);
      expect(moduleInfo.reducers[0].name).toBe('craft_item');
      expect(moduleInfo.reducers[0].params).toHaveLength(3);
      expect(moduleInfo.tables).toContain('item_desc');
      expect(moduleInfo.tables).toContain('recipe_desc');
    });
  });

  describe('Error handling', () => {
    it('getModuleInfo() with mocked 500 response -> throws MODULE_FETCH_FAILED', async () => {
      // Given a 500 error response
      mockFetch.mockResolvedValue(
        createMockResponse('Internal Server Error', 500, 'Internal Server Error')
      );

      const fetcher = new SpacetimeDBModuleInfoFetcher({
        url: 'http://localhost:3000',
        database: 'bitcraft',
      });

      // When getModuleInfo is called
      // Then it should throw ConfigValidationError with MODULE_FETCH_FAILED
      try {
        await fetcher.getModuleInfo();
        expect.fail('Should have thrown ConfigValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationError);
        const err = e as ConfigValidationError;
        expect(err.code).toBe('MODULE_FETCH_FAILED');
        expect(err.message).toContain('500');
      }
    });

    it('getModuleInfo() with mocked network error -> throws MODULE_FETCH_FAILED', async () => {
      // Given a network error
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const fetcher = new SpacetimeDBModuleInfoFetcher({
        url: 'http://localhost:3000',
        database: 'bitcraft',
      });

      // When getModuleInfo is called
      // Then it should throw ConfigValidationError with MODULE_FETCH_FAILED
      try {
        await fetcher.getModuleInfo();
        expect.fail('Should have thrown ConfigValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationError);
        const err = e as ConfigValidationError;
        expect(err.code).toBe('MODULE_FETCH_FAILED');
        expect(err.message).toContain('ECONNREFUSED');
      }
    });

    it('getModuleInfo() with mocked timeout (AbortError) -> throws VALIDATION_TIMEOUT', async () => {
      // Given a timeout via AbortError
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockFetch.mockRejectedValue(abortError);

      const fetcher = new SpacetimeDBModuleInfoFetcher({
        url: 'http://localhost:3000',
        database: 'bitcraft',
        timeoutMs: 100,
      });

      // When getModuleInfo is called
      // Then it should throw ConfigValidationError with VALIDATION_TIMEOUT
      try {
        await fetcher.getModuleInfo();
        expect.fail('Should have thrown ConfigValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationError);
        const err = e as ConfigValidationError;
        expect(err.code).toBe('VALIDATION_TIMEOUT');
        expect(err.message).toContain('timed out');
      }
    });

    it('getModuleInfo() with mocked malformed JSON response -> throws MODULE_FETCH_FAILED', async () => {
      // Given a non-JSON response
      const response = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-length': '20' }),
        text: async () => 'this is not json!!!',
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      const fetcher = new SpacetimeDBModuleInfoFetcher({
        url: 'http://localhost:3000',
        database: 'bitcraft',
      });

      // When getModuleInfo is called
      // Then it should throw ConfigValidationError with MODULE_FETCH_FAILED
      try {
        await fetcher.getModuleInfo();
        expect.fail('Should have thrown ConfigValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationError);
        const err = e as ConfigValidationError;
        expect(err.code).toBe('MODULE_FETCH_FAILED');
        expect(err.message).toContain('not valid JSON');
      }
    });
  });

  describe('Security', () => {
    it('SSRF protection: URL with ftp:// scheme -> throws MODULE_FETCH_FAILED', () => {
      // Given an ftp:// URL
      // When creating the fetcher
      // Then it should throw ConfigValidationError on construction
      try {
        new SpacetimeDBModuleInfoFetcher({
          url: 'ftp://evil-server.com',
          database: 'bitcraft',
        });
        expect.fail('Should have thrown ConfigValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationError);
        const err = e as ConfigValidationError;
        expect(err.code).toBe('MODULE_FETCH_FAILED');
        expect(err.message).toContain('ftp:');
      }
    });

    it('database name with path traversal characters -> throws MODULE_FETCH_FAILED on construction', () => {
      // Given a database name containing path traversal
      // When creating the fetcher
      // Then it should throw ConfigValidationError on construction
      try {
        new SpacetimeDBModuleInfoFetcher({
          url: 'http://localhost:3000',
          database: '../../admin',
        });
        expect.fail('Should have thrown ConfigValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationError);
        const err = e as ConfigValidationError;
        expect(err.code).toBe('MODULE_FETCH_FAILED');
        expect(err.message).toContain('Invalid database name');
      }
    });

    it('response size limit: mocked response > 10MB -> throws MODULE_FETCH_FAILED', async () => {
      // Given a response with content-length exceeding 10MB
      const response = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-length': String(11 * 1024 * 1024), // 11MB
        }),
        text: async () => '{}',
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      const fetcher = new SpacetimeDBModuleInfoFetcher({
        url: 'http://localhost:3000',
        database: 'bitcraft',
      });

      // When getModuleInfo is called
      // Then it should throw due to size limit
      try {
        await fetcher.getModuleInfo();
        expect.fail('Should have thrown ConfigValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationError);
        const err = e as ConfigValidationError;
        expect(err.code).toBe('MODULE_FETCH_FAILED');
        expect(err.message).toContain('10MB');
      }
    });
  });
});

describe('createOfflineModuleInfo (Story 4.3)', () => {
  it('creates valid ModuleInfo with given reducer names and table names', () => {
    // Given reducer and table names
    const reducerNames = ['player_move', 'harvest_start'];
    const tableNames = ['player_state', 'terrain'];

    // When createOfflineModuleInfo is called
    const moduleInfo = createOfflineModuleInfo(reducerNames, tableNames);

    // Then it should create a valid ModuleInfo
    expect(moduleInfo.reducers).toHaveLength(2);
    expect(moduleInfo.reducers[0].name).toBe('player_move');
    expect(moduleInfo.reducers[0].params).toEqual([]);
    expect(moduleInfo.reducers[1].name).toBe('harvest_start');
    expect(moduleInfo.reducers[1].params).toEqual([]);
    expect(moduleInfo.tables).toEqual(['player_state', 'terrain']);
  });
});
