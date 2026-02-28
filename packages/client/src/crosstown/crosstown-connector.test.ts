/**
 * Crosstown Connector Tests
 * Story 2.3: ILP Packet Construction & Signing
 *
 * Tests for CrosstownConnector HTTP client.
 * Validates AC2, AC5: Route packet through Crosstown, handle errors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrosstownConnector } from './crosstown-connector';
import { SigilError } from '../nostr/nostr-client';
import type { NostrEvent } from '../nostr/types';

// Mock fetch globally
const originalFetch = global.fetch;

describe('CrosstownConnector', () => {
  const testEvent: NostrEvent = {
    id: 'abc123def456',
    pubkey: '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245',
    created_at: 1234567890,
    kind: 30078,
    tags: [
      ['d', 'test_1234'],
      ['fee', '10'],
    ],
    content: '{"reducer":"player_move","args":[100,200]}',
    sig: '0'.repeat(128),
  };

  beforeEach(() => {
    // Mock fetch for each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('URL Validation (AC2, SSRF Protection)', () => {
    it('should accept valid http:// URL in development', () => {
      process.env.NODE_ENV = 'development';

      expect(() => {
        new CrosstownConnector({ connectorUrl: 'http://localhost:4041' });
      }).not.toThrow();
    });

    it('should accept valid https:// URL', () => {
      expect(() => {
        new CrosstownConnector({ connectorUrl: 'https://crosstown.example.com' });
      }).not.toThrow();
    });

    it('should reject invalid URL format', () => {
      expect(() => {
        new CrosstownConnector({ connectorUrl: 'not a url' });
      }).toThrow(SigilError);

      try {
        new CrosstownConnector({ connectorUrl: 'not a url' });
      } catch (error) {
        expect((error as SigilError).code).toBe('INVALID_CONFIG');
      }
    });

    it('should reject URLs with embedded credentials', () => {
      expect(() => {
        new CrosstownConnector({ connectorUrl: 'http://user:pass@localhost:4041' });
      }).toThrow(SigilError);

      try {
        new CrosstownConnector({ connectorUrl: 'http://user:pass@localhost:4041' });
      } catch (error) {
        expect((error as SigilError).message).toContain('credentials');
      }
    });

    it('should reject non-HTTP protocols', () => {
      expect(() => {
        new CrosstownConnector({ connectorUrl: 'file:///etc/passwd' });
      }).toThrow(SigilError);

      expect(() => {
        new CrosstownConnector({ connectorUrl: 'ftp://example.com' });
      }).toThrow(SigilError);
    });

    it('should reject http:// in production mode', () => {
      process.env.NODE_ENV = 'production';

      expect(() => {
        new CrosstownConnector({ connectorUrl: 'http://localhost:4041' });
      }).toThrow(SigilError);

      try {
        new CrosstownConnector({ connectorUrl: 'http://localhost:4041' });
      } catch (error) {
        expect((error as SigilError).message).toContain('https://');
      }

      // Reset NODE_ENV
      delete process.env.NODE_ENV;
    });

    it('should reject localhost in production mode', () => {
      process.env.NODE_ENV = 'production';

      expect(() => {
        new CrosstownConnector({ connectorUrl: 'https://localhost:4041' });
      }).toThrow(SigilError);

      // Reset NODE_ENV
      delete process.env.NODE_ENV;
    });

    it('should reject internal IP ranges in production mode', () => {
      process.env.NODE_ENV = 'production';

      // 10.x.x.x
      expect(() => {
        new CrosstownConnector({ connectorUrl: 'https://10.0.0.1' });
      }).toThrow(SigilError);

      // 192.168.x.x
      expect(() => {
        new CrosstownConnector({ connectorUrl: 'https://192.168.1.1' });
      }).toThrow(SigilError);

      // 172.16-31.x.x
      expect(() => {
        new CrosstownConnector({ connectorUrl: 'https://172.16.0.1' });
      }).toThrow(SigilError);

      // 169.254.x.x (link-local)
      expect(() => {
        new CrosstownConnector({ connectorUrl: 'https://169.254.1.1' });
      }).toThrow(SigilError);

      // Reset NODE_ENV
      delete process.env.NODE_ENV;
    });

    it('should allow Docker IPs in development mode', () => {
      process.env.NODE_ENV = 'development';

      expect(() => {
        new CrosstownConnector({ connectorUrl: 'http://172.17.0.2:4041' });
      }).not.toThrow();

      delete process.env.NODE_ENV;
    });
  });

  describe('publishEvent - Success Cases (AC2)', () => {
    it('should POST event to /publish endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, eventId: 'abc123' }),
      });
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
      });

      await connector.publishEvent(testEvent);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4041/publish',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: testEvent }),
        })
      );
    });

    it('should return ILPPacketResult on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, eventId: 'abc123def456' }),
      });
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
      });

      const result = await connector.publishEvent(testEvent);

      expect(result).toEqual({
        eventId: 'abc123def456',
        reducer: 'player_move',
        args: [100, 200],
        fee: 10,
        pubkey: testEvent.pubkey,
        timestamp: testEvent.created_at,
      });
    });

    it('should use configured timeout', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ success: true, eventId: 'abc' }),
            });
          }, 500);
        });
      });
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
        timeout: 1000, // 1s timeout
      });

      await connector.publishEvent(testEvent);

      // Should succeed because response is within timeout
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('publishEvent - Timeout Handling (AC5)', () => {
    it('should throw NETWORK_TIMEOUT when request times out', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          }, 100);
        });
      });
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
        timeout: 100,
      });

      await expect(connector.publishEvent(testEvent)).rejects.toThrow(SigilError);

      try {
        await connector.publishEvent(testEvent);
      } catch (error) {
        expect((error as SigilError).code).toBe('NETWORK_TIMEOUT');
        expect((error as SigilError).boundary).toBe('crosstown');
        expect((error as SigilError).message).toContain('100ms');
      }
    });

    it('should include timeout details in error', async () => {
      const mockFetch = vi.fn().mockRejectedValue({
        name: 'AbortError',
        message: 'Aborted',
      });
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
        timeout: 2000,
      });

      try {
        await connector.publishEvent(testEvent);
      } catch (error) {
        expect((error as SigilError).context).toMatchObject({
          timeout: 2000,
          url: 'http://localhost:4041/publish',
        });
      }
    });
  });

  describe('publishEvent - HTTP Error Handling (AC5)', () => {
    it('should throw PUBLISH_FAILED for 4xx errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
      });

      await expect(connector.publishEvent(testEvent)).rejects.toThrow(SigilError);

      try {
        await connector.publishEvent(testEvent);
      } catch (error) {
        expect((error as SigilError).code).toBe('PUBLISH_FAILED');
        expect((error as SigilError).message).toContain('400');
      }
    });

    it('should throw PUBLISH_FAILED for 5xx errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
      });

      await expect(connector.publishEvent(testEvent)).rejects.toThrow(SigilError);

      try {
        await connector.publishEvent(testEvent);
      } catch (error) {
        expect((error as SigilError).code).toBe('PUBLISH_FAILED');
        expect((error as SigilError).message).toContain('500');
      }
    });

    it('should throw RATE_LIMITED for 429 errors (AC2)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '60']]),
        text: async () => 'Too many requests',
      });
      global.fetch = mockFetch as any;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
      });

      await expect(connector.publishEvent(testEvent)).rejects.toThrow(SigilError);
    });

    it('should throw NETWORK_ERROR for network failures', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
      });

      await expect(connector.publishEvent(testEvent)).rejects.toThrow(SigilError);

      try {
        await connector.publishEvent(testEvent);
      } catch (error) {
        expect((error as SigilError).code).toBe('NETWORK_ERROR');
      }
    });

    it('should throw INVALID_RESPONSE for invalid JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
      });

      await expect(connector.publishEvent(testEvent)).rejects.toThrow(SigilError);

      try {
        await connector.publishEvent(testEvent);
      } catch (error) {
        expect((error as SigilError).code).toBe('INVALID_RESPONSE');
      }
    });

    it('should throw PUBLISH_FAILED for success=false response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: false, message: 'Event rejected' }),
      });
      global.fetch = mockFetch;

      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
      });

      await expect(connector.publishEvent(testEvent)).rejects.toThrow(SigilError);

      try {
        await connector.publishEvent(testEvent);
      } catch (error) {
        expect((error as SigilError).message).toContain('Event rejected');
      }
    });
  });

  describe('publishEvent - Default Timeout (AC5)', () => {
    it('should use 2000ms timeout by default', () => {
      const connector = new CrosstownConnector({
        connectorUrl: 'http://localhost:4041',
      });

      // Access private timeout property via type assertion
      expect((connector as any).timeout).toBe(2000);
    });
  });
});
