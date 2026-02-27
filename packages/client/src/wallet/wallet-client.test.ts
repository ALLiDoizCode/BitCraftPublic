/**
 * Wallet Client Tests
 * Story 2.2: Action Cost Registry & Wallet Balance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletClient } from './wallet-client';
import { SigilError } from '../nostr/nostr-client';

describe('WalletClient', () => {
  const validUrl = 'http://localhost:4041';
  const validPubkey = 'abc123';

  beforeEach(() => {
    // Clear any environment variables
    delete process.env.SIGIL_WALLET_STUB;
  });

  afterEach(() => {
    // Reset all mocks
    vi.restoreAllMocks();
  });

  describe('constructor validation', () => {
    it('creates client with valid URL (AC4)', () => {
      expect(() => new WalletClient(validUrl, validPubkey)).not.toThrow();
    });

    it('throws INVALID_CONFIG for invalid URL', () => {
      expect(() => new WalletClient('not a url', validPubkey)).toThrow(
        'Invalid Crosstown connector URL'
      );
    });

    it('allows localhost in development (SSRF protection)', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';

        expect(() => new WalletClient('http://localhost:4041', validPubkey)).not.toThrow();
        expect(() => new WalletClient('http://127.0.0.1:4041', validPubkey)).not.toThrow();
        expect(() => new WalletClient('http://0.0.0.0:4041', validPubkey)).not.toThrow();
        expect(() => new WalletClient('http://172.17.0.1:4041', validPubkey)).not.toThrow();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('rejects localhost in production (SSRF protection)', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        expect(() => new WalletClient('http://localhost:4041', validPubkey)).toThrow(
          'cannot use localhost or internal IPs in production'
        );
        expect(() => new WalletClient('http://127.0.0.1:4041', validPubkey)).toThrow(
          'cannot use localhost or internal IPs in production'
        );
        expect(() => new WalletClient('http://172.17.0.1:4041', validPubkey)).toThrow(
          'cannot use localhost or internal IPs in production'
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('requires HTTPS in production', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        expect(() => new WalletClient('http://example.com:4041', validPubkey)).toThrow(
          'must use HTTPS in production'
        );
        expect(() => new WalletClient('https://example.com:4041', validPubkey)).not.toThrow();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('activates stub mode via SIGIL_WALLET_STUB env var', () => {
      process.env.SIGIL_WALLET_STUB = 'true';
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const client = new WalletClient(validUrl, validPubkey);

      expect(client.isStubMode()).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Wallet client stub mode activated')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getBalance', () => {
    it('returns balance from HTTP API (AC4)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ balance: 10000 }),
      });

      const balance = await client.getBalance();

      expect(balance).toBe(10000);
      expect(global.fetch).toHaveBeenCalledWith(
        `${validUrl}/wallet/balance/${validPubkey}`,
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('returns balance in reasonable time <500ms (AC4)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch with 50ms delay
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          json: async () => ({ balance: 10000 }),
        };
      });

      const start = performance.now();
      const balance = await client.getBalance();
      const duration = performance.now() - start;

      expect(balance).toBe(10000);
      expect(duration).toBeLessThan(500);
    });

    it('activates stub mode on 404 response (AC4)', async () => {
      const client = new WalletClient(validUrl, validPubkey);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock fetch with 404
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const balance = await client.getBalance();

      expect(balance).toBe(10000);
      expect(client.isStubMode()).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Crosstown balance API not available (HTTP 404)')
      );

      consoleWarnSpy.mockRestore();
    });

    it('activates stub mode on 501 response (AC4)', async () => {
      const client = new WalletClient(validUrl, validPubkey);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock fetch with 501
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 501,
        statusText: 'Not Implemented',
      });

      const balance = await client.getBalance();

      expect(balance).toBe(10000);
      expect(client.isStubMode()).toBe(true);

      consoleWarnSpy.mockRestore();
    });

    it('returns stub balance if stub mode active (AC4)', async () => {
      const client = new WalletClient(validUrl, validPubkey);
      client.enableStubMode(5000);

      const balance = await client.getBalance();

      expect(balance).toBe(5000);
    });

    it('throws NETWORK_ERROR on timeout (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch that respects abort signal
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ balance: 10000 }),
            });
          }, 1000);

          // Listen for abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new Error('AbortError'));
            });
          }
        });
      });

      await expect(client.getBalance()).rejects.toThrow(/timed out|AbortError/);
    });

    it('throws NETWORK_ERROR on HTTP error (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch with 500 error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.getBalance()).rejects.toThrow('HTTP 500');
      await expect(client.getBalance()).rejects.toThrow(SigilError);
    });

    it('throws INVALID_RESPONSE if response is not JSON (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch with invalid JSON
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(client.getBalance()).rejects.toThrow('invalid JSON');
      await expect(client.getBalance()).rejects.toThrow(SigilError);
    });

    it('throws INVALID_RESPONSE if balance field is missing (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch with missing balance field
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ notBalance: 10000 }),
      });

      await expect(client.getBalance()).rejects.toThrow('missing "balance" field');
      await expect(client.getBalance()).rejects.toThrow(SigilError);
    });

    it('throws INVALID_RESPONSE if balance is negative (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch with negative balance
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ balance: -100 }),
      });

      await expect(client.getBalance()).rejects.toThrow('invalid balance');
      await expect(client.getBalance()).rejects.toThrow(SigilError);
    });

    it('throws INVALID_RESPONSE if balance is not finite (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch with Infinity balance
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ balance: Infinity }),
      });

      await expect(client.getBalance()).rejects.toThrow('invalid balance');
      await expect(client.getBalance()).rejects.toThrow(SigilError);
    });

    it('throws NETWORK_ERROR on fetch failure (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch with network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(client.getBalance()).rejects.toThrow('Network error');
      await expect(client.getBalance()).rejects.toThrow(SigilError);
    });

    it('validates balance accuracy (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      // Mock fetch with specific balance
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ balance: 12345 }),
      });

      const balance = await client.getBalance();

      expect(balance).toBe(12345);
    });
  });

  describe('stub mode controls', () => {
    it('enables stub mode with custom balance', () => {
      const client = new WalletClient(validUrl, validPubkey);

      client.enableStubMode(5000);

      expect(client.isStubMode()).toBe(true);
    });

    it('disables stub mode', () => {
      const client = new WalletClient(validUrl, validPubkey);

      client.enableStubMode();
      expect(client.isStubMode()).toBe(true);

      client.disableStubMode();
      expect(client.isStubMode()).toBe(false);
    });
  });

  describe('edge cases and error messages', () => {
    it('provides clear error message for network timeout (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ balance: 10000 }),
            });
          }, 1000);

          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new Error('AbortError'));
            });
          }
        });
      });

      try {
        await client.getBalance();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        if (error instanceof SigilError) {
          expect(error.code).toBe('NETWORK_ERROR');
          expect(error.boundary).toBe('crosstown-connector');
        }
      }
    });

    it('handles zero balance correctly (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ balance: 0 }),
      });

      const balance = await client.getBalance();

      expect(balance).toBe(0);
    });

    it('validates balance is a number type (AC5)', async () => {
      const client = new WalletClient(validUrl, validPubkey);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ balance: '10000' }),
      });

      await expect(client.getBalance()).rejects.toThrow('balance" field must be a number');
      await expect(client.getBalance()).rejects.toThrow(SigilError);
    });
  });
});
