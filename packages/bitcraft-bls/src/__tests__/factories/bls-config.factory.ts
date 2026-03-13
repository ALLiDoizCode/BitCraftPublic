/**
 * BLS Config Test Factory
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Factory functions for generating BLSConfig objects and environment variable maps
 * for testing the BLS node configuration loading.
 */

import type { BLSConfig } from '../../config.js';

/**
 * Create a valid BLSConfig with sensible test defaults
 */
export function createBLSConfig(overrides: Partial<BLSConfig> = {}): BLSConfig {
  return {
    secretKey: 'ab'.repeat(32), // Valid 64-char hex
    spacetimedbUrl: 'http://localhost:3000',
    spacetimedbDatabase: 'bitcraft',
    spacetimedbToken: 'test-admin-token',
    ilpAddress: 'g.crosstown.bitcraft',
    kindPricing: { 30078: 100n },
    logLevel: 'info',
    port: 3001,
    ...overrides,
  };
}

/**
 * Create environment variables map for config loading tests
 */
export function createBLSConfigEnv(
  overrides: Partial<Record<string, string>> = {}
): Record<string, string> {
  return {
    SPACETIMEDB_URL: 'http://localhost:3000',
    SPACETIMEDB_DATABASE: 'bitcraft',
    SPACETIMEDB_TOKEN: 'test-admin-token',
    BLS_SECRET_KEY: 'ab'.repeat(32),
    BLS_LOG_LEVEL: 'info',
    BLS_PORT: '3001',
    BLS_ILP_ADDRESS: 'g.crosstown.bitcraft',
    ...overrides,
  };
}

/**
 * Create minimal required environment (only mandatory fields)
 */
export function createMinimalBLSConfigEnv(): Record<string, string> {
  return {
    SPACETIMEDB_TOKEN: 'test-admin-token',
  };
}
