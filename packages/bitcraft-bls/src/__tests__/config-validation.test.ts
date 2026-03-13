/**
 * Config Validation Tests (AC: 2, 4)
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Tests for loadConfig() environment variable parsing and validation.
 * Validates: AC2 (Node initialization), OWASP A02 (secret key validation)
 *
 * Test count: 18
 */

import { describe, it, expect } from 'vitest';
import { loadConfig } from '../config.js';

describe('loadConfig', () => {
  const validEnv: Record<string, string> = {
    SPACETIMEDB_TOKEN: 'test-admin-token',
  };

  it('throws when SPACETIMEDB_TOKEN is missing', () => {
    expect(() => loadConfig({})).toThrow('SPACETIMEDB_TOKEN');
  });

  it('throws when SPACETIMEDB_TOKEN is empty string', () => {
    expect(() => loadConfig({ SPACETIMEDB_TOKEN: '' })).toThrow('SPACETIMEDB_TOKEN');
  });

  it('throws when BLS_SECRET_KEY has wrong length', () => {
    expect(() => loadConfig({ ...validEnv, BLS_SECRET_KEY: 'abcdef' })).toThrow(
      '64-character hex string'
    );
  });

  it('throws when BLS_SECRET_KEY has non-hex characters', () => {
    expect(() => loadConfig({ ...validEnv, BLS_SECRET_KEY: 'z'.repeat(64) })).toThrow(
      '64-character hex string'
    );
  });

  it('accepts valid 64-char hex BLS_SECRET_KEY', () => {
    const config = loadConfig({ ...validEnv, BLS_SECRET_KEY: 'a'.repeat(64) });
    expect(config.secretKey).toBe('a'.repeat(64));
  });

  it('applies default values for optional fields', () => {
    const config = loadConfig(validEnv);
    expect(config.spacetimedbUrl).toBe('http://localhost:3000');
    expect(config.spacetimedbDatabase).toBe('bitcraft');
    expect(config.ilpAddress).toBe('g.crosstown.bitcraft');
    expect(config.logLevel).toBe('info');
    expect(config.port).toBe(3001);
    expect(config.kindPricing[30078]).toBe(100n);
  });

  it('uses provided SPACETIMEDB_URL', () => {
    const config = loadConfig({ ...validEnv, SPACETIMEDB_URL: 'http://custom:9000' });
    expect(config.spacetimedbUrl).toBe('http://custom:9000');
  });

  it('uses provided SPACETIMEDB_DATABASE', () => {
    const config = loadConfig({ ...validEnv, SPACETIMEDB_DATABASE: 'mydb' });
    expect(config.spacetimedbDatabase).toBe('mydb');
  });

  it('uses provided BLS_PORT', () => {
    const config = loadConfig({ ...validEnv, BLS_PORT: '8080' });
    expect(config.port).toBe(8080);
  });

  it('throws for non-numeric BLS_PORT', () => {
    expect(() => loadConfig({ ...validEnv, BLS_PORT: 'abc' })).toThrow('valid port number');
  });

  it('throws for BLS_PORT=0 (below valid range)', () => {
    expect(() => loadConfig({ ...validEnv, BLS_PORT: '0' })).toThrow('valid port number');
  });

  it('throws for BLS_PORT exceeding 65535', () => {
    expect(() => loadConfig({ ...validEnv, BLS_PORT: '70000' })).toThrow('valid port number');
  });

  it('uses provided BLS_ILP_ADDRESS', () => {
    const config = loadConfig({ ...validEnv, BLS_ILP_ADDRESS: 'g.custom.address' });
    expect(config.ilpAddress).toBe('g.custom.address');
  });

  it('uses provided BLS_LOG_LEVEL', () => {
    const config = loadConfig({ ...validEnv, BLS_LOG_LEVEL: 'debug' });
    expect(config.logLevel).toBe('debug');
  });

  it('does not include secretKey when BLS_SECRET_KEY is absent', () => {
    const config = loadConfig(validEnv);
    expect(config.secretKey).toBeUndefined();
  });

  it('throws when SPACETIMEDB_URL is not a valid URL', () => {
    expect(() => loadConfig({ ...validEnv, SPACETIMEDB_URL: 'not-a-url' })).toThrow(
      'valid HTTP or HTTPS URL'
    );
  });

  it('throws when SPACETIMEDB_URL uses non-HTTP protocol', () => {
    expect(() => loadConfig({ ...validEnv, SPACETIMEDB_URL: 'ftp://example.com' })).toThrow(
      'valid HTTP or HTTPS URL'
    );
  });

  it('accepts HTTPS SPACETIMEDB_URL', () => {
    const config = loadConfig({ ...validEnv, SPACETIMEDB_URL: 'https://secure-db:3000' });
    expect(config.spacetimedbUrl).toBe('https://secure-db:3000');
  });
});
