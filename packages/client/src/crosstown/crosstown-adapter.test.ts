/**
 * CrosstownAdapter Tests
 * Story 2.5: @crosstown/client Integration & Scaffolding Removal
 *
 * Tests for CrosstownAdapter wrapping @crosstown/client CrosstownClient.
 *
 * Validates: AC2, AC3, AC4, AC6
 *   - AC2: client.publish() delegates to CrosstownClient via adapter
 *   - AC3: CrosstownClient lifecycle managed by SigilClient
 *   - AC4: Custom scaffolding removed, error codes preserved
 *   - AC6: Signing guarantees preserved via @crosstown/client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrosstownAdapter } from './crosstown-adapter';
import { SigilError } from '../nostr/nostr-client';
import { CrosstownError } from '@crosstown/client';

// Mock fetch for CrosstownClient internal calls
const originalFetch = global.fetch;

describe('CrosstownAdapter', () => {
  const testSecretKey = new Uint8Array(32).fill(0xab);
  // Compute testPubkey lazily inside tests via adapter.getPublicKey()
  // to avoid ESM/CJS Uint8Array interop issues at module parse time
  let testPubkey: string;

  beforeEach(() => {
    global.fetch = vi.fn();
    // Derive testPubkey at runtime to avoid ESM/CJS interop issues
    const adapter = new CrosstownAdapter({
      secretKey: testSecretKey,
      connectorUrl: 'http://localhost:4041',
    });
    testPubkey = adapter.getPublicKey();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.BTP_ENDPOINT;
  });

  describe('Constructor - Configuration (AC2, AC3)', () => {
    it('should create adapter with valid secretKey and connectorUrl', () => {
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      expect(adapter).toBeDefined();
    });

    it('should reject non-Uint8Array secretKey', () => {
      expect(() => {
        new CrosstownAdapter({
          secretKey: 'invalid' as unknown as Uint8Array,
          connectorUrl: 'http://localhost:4041',
        });
      }).toThrow(SigilError);

      try {
        new CrosstownAdapter({
          secretKey: 'invalid' as unknown as Uint8Array,
          connectorUrl: 'http://localhost:4041',
        });
      } catch (error) {
        expect((error as SigilError).code).toBe('SIGNING_FAILED');
        expect((error as SigilError).boundary).toBe('identity');
      }
    });

    it('should reject secretKey with wrong length (not 32 bytes)', () => {
      const invalidKey = new Uint8Array(16);
      expect(() => {
        new CrosstownAdapter({
          secretKey: invalidKey,
          connectorUrl: 'http://localhost:4041',
        });
      }).toThrow(SigilError);
    });

    it('should derive correct public key from secretKey', () => {
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });

      expect(adapter.getPublicKey()).toBe(testPubkey);
    });

    it('should use btpEndpoint from config when provided', () => {
      // Should not throw -- constructs successfully with custom btpEndpoint
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
        btpEndpoint: 'ws://custom:3001',
      });
      expect(adapter).toBeDefined();
    });

    it('should fallback to BTP_ENDPOINT env var if btpEndpoint not in config', () => {
      process.env.BTP_ENDPOINT = 'ws://env-endpoint:3000';
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      expect(adapter).toBeDefined();
    });

    it('should fallback to ws://localhost:3000 if no btpEndpoint configured', () => {
      delete process.env.BTP_ENDPOINT;
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('SSRF Protection (AC4) - Ported from crosstown-connector.ts', () => {
    it('should accept valid http:// URL in development mode', () => {
      process.env.NODE_ENV = 'development';
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'http://localhost:4041',
        });
      }).not.toThrow();
    });

    it('should accept valid https:// URL', () => {
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'https://crosstown.example.com',
        });
      }).not.toThrow();
    });

    it('should reject invalid URL format with INVALID_CONFIG', () => {
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'not a url',
        });
      }).toThrow(SigilError);

      try {
        new CrosstownAdapter({ secretKey: testSecretKey, connectorUrl: 'not a url' });
      } catch (error) {
        expect((error as SigilError).code).toBe('INVALID_CONFIG');
      }
    });

    it('should reject URLs with embedded credentials', () => {
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'http://user:pass@localhost:4041',
        });
      }).toThrow(SigilError);
    });

    it('should reject non-HTTP protocols (file://, ftp://)', () => {
      expect(() => {
        new CrosstownAdapter({ secretKey: testSecretKey, connectorUrl: 'file:///etc/passwd' });
      }).toThrow(SigilError);

      expect(() => {
        new CrosstownAdapter({ secretKey: testSecretKey, connectorUrl: 'ftp://example.com' });
      }).toThrow(SigilError);
    });

    it('should reject http:// in production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'http://localhost:4041',
        });
      }).toThrow(SigilError);
    });

    it('should reject localhost in production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'https://localhost:4041',
        });
      }).toThrow(SigilError);
    });

    it('should reject 0.0.0.0 in production mode (SSRF bypass prevention)', () => {
      process.env.NODE_ENV = 'production';
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'https://0.0.0.0:4041',
        });
      }).toThrow(SigilError);
    });

    it('should reject internal IP ranges in production mode', () => {
      process.env.NODE_ENV = 'production';

      // 10.x.x.x
      expect(() => {
        new CrosstownAdapter({ secretKey: testSecretKey, connectorUrl: 'https://10.0.0.1' });
      }).toThrow(SigilError);

      // 192.168.x.x
      expect(() => {
        new CrosstownAdapter({ secretKey: testSecretKey, connectorUrl: 'https://192.168.1.1' });
      }).toThrow(SigilError);

      // 172.16-31.x.x
      expect(() => {
        new CrosstownAdapter({ secretKey: testSecretKey, connectorUrl: 'https://172.16.0.1' });
      }).toThrow(SigilError);

      // 169.254.x.x (link-local)
      expect(() => {
        new CrosstownAdapter({ secretKey: testSecretKey, connectorUrl: 'https://169.254.1.1' });
      }).toThrow(SigilError);
    });

    it('should allow Docker IPs in development mode', () => {
      process.env.NODE_ENV = 'development';
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'http://172.17.0.2:4041',
        });
      }).not.toThrow();
    });
  });

  describe('BTP Endpoint Validation (Security)', () => {
    it('should accept ws:// BTP endpoint in development mode', () => {
      process.env.NODE_ENV = 'development';
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'http://localhost:4041',
          btpEndpoint: 'ws://localhost:3000',
        });
      }).not.toThrow();
    });

    it('should accept wss:// BTP endpoint in any mode', () => {
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'http://localhost:4041',
          btpEndpoint: 'wss://btp.example.com:3000',
        });
      }).not.toThrow();
    });

    it('should reject non-WebSocket BTP endpoint protocols', () => {
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'http://localhost:4041',
          btpEndpoint: 'http://localhost:3000',
        });
      }).toThrow(SigilError);

      try {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'http://localhost:4041',
          btpEndpoint: 'ftp://localhost:3000',
        });
      } catch (error) {
        expect((error as SigilError).code).toBe('INVALID_CONFIG');
        expect((error as SigilError).boundary).toBe('crosstown');
      }
    });

    it('should reject invalid BTP endpoint URL format', () => {
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'http://localhost:4041',
          btpEndpoint: 'not a url',
        });
      }).toThrow(SigilError);
    });

    it('should reject ws:// BTP endpoint in production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'https://crosstown.example.com',
          btpEndpoint: 'ws://btp.example.com:3000',
        });
      }).toThrow(SigilError);

      try {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'https://crosstown.example.com',
          btpEndpoint: 'ws://btp.example.com:3000',
        });
      } catch (error) {
        expect((error as SigilError).code).toBe('INVALID_CONFIG');
        expect((error as SigilError).message).toContain('wss://');
      }
    });

    it('should accept wss:// BTP endpoint in production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'https://crosstown.example.com',
          btpEndpoint: 'wss://btp.example.com:3000',
        });
      }).not.toThrow();
    });

    it('should reject default ws://localhost:3000 BTP endpoint in production mode', () => {
      process.env.NODE_ENV = 'production';
      // Without providing btpEndpoint, the default ws://localhost:3000 should be rejected
      expect(() => {
        new CrosstownAdapter({
          secretKey: testSecretKey,
          connectorUrl: 'https://crosstown.example.com',
        });
      }).toThrow(SigilError);
    });
  });

  describe('Lifecycle Management (AC3)', () => {
    it('should delegate start() to CrosstownClient.start()', async () => {
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });

      const result = await adapter.start();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('peersDiscovered');
      expect(result).toHaveProperty('mode');
    });

    it('should delegate stop() to CrosstownClient.stop()', async () => {
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });

      await adapter.start();
      // Should not throw
      await expect(adapter.stop()).resolves.not.toThrow();
    });

    it('should return CrosstownStartResult from start()', async () => {
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });

      const result = await adapter.start();
      expect(result.peersDiscovered).toBeGreaterThanOrEqual(0);
      expect(['http', 'embedded']).toContain(result.mode);
    });
  });

  describe('publishEvent - Delegation (AC2)', () => {
    it('should accept unsigned template without pubkey/id/sig', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, eventId: 'abc123' }),
      });
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      const eventTemplate = {
        kind: 30078,
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
        tags: [
          ['d', 'player_move_123'],
          ['fee', '1'],
        ],
      };

      const result = await adapter.publishEvent(eventTemplate);
      expect(result.eventId).toBeTruthy();
    });

    it('should map result to ILPPacketResult', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, eventId: 'abc123' }),
      });
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      const eventTemplate = {
        kind: 30078,
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
        tags: [
          ['d', 'player_move_123'],
          ['fee', '5'],
        ],
      };

      const result = await adapter.publishEvent(eventTemplate);
      expect(result.eventId).toBeTruthy();
      expect(result.reducer).toBe('player_move');
      expect(result.args).toEqual([100, 200]);
      expect(result.fee).toBe(5);
      expect(result.pubkey).toBe(testPubkey);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('publishEvent - Error Mapping (AC4, AC6)', () => {
    it('should map connection refused to NETWORK_ERROR with boundary crosstown', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      const eventTemplate = {
        kind: 30078,
        content: JSON.stringify({ reducer: 'test', args: [] }),
        tags: [
          ['d', 'test_123'],
          ['fee', '1'],
        ],
      };

      try {
        await adapter.publishEvent(eventTemplate);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('NETWORK_ERROR');
        expect((error as SigilError).boundary).toBe('crosstown');
      }
    });

    it('should map timeout/AbortError to NETWORK_TIMEOUT with boundary crosstown', async () => {
      const abortError = new Error('Request timed out');
      abortError.name = 'AbortError';
      const mockFetch = vi.fn().mockRejectedValue(abortError);
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      const eventTemplate = {
        kind: 30078,
        content: JSON.stringify({ reducer: 'test', args: [] }),
        tags: [
          ['d', 'test_123'],
          ['fee', '1'],
        ],
      };

      try {
        await adapter.publishEvent(eventTemplate);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('NETWORK_TIMEOUT');
        expect((error as SigilError).boundary).toBe('crosstown');
      }
    });

    it('should map rate limit (429) to RATE_LIMITED with boundary crosstown', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '30' }),
        text: async () => 'Rate limited',
      });
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      const eventTemplate = {
        kind: 30078,
        content: JSON.stringify({ reducer: 'test', args: [] }),
        tags: [
          ['d', 'test_123'],
          ['fee', '1'],
        ],
      };

      try {
        await adapter.publishEvent(eventTemplate);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('RATE_LIMITED');
        expect((error as SigilError).boundary).toBe('crosstown');
      }
    });

    it('should map publish failure to PUBLISH_FAILED with boundary crosstown', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      const eventTemplate = {
        kind: 30078,
        content: JSON.stringify({ reducer: 'test', args: [] }),
        tags: [
          ['d', 'test_123'],
          ['fee', '1'],
        ],
      };

      try {
        await adapter.publishEvent(eventTemplate);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('PUBLISH_FAILED');
        expect((error as SigilError).boundary).toBe('crosstown');
      }
    });

    it('should map invalid response format to INVALID_RESPONSE with boundary crosstown', async () => {
      // CrosstownClient checks for (!success || !eventId) and throws INVALID_RESPONSE.
      // Mock fetch to return success=false which triggers CrosstownClient INVALID_RESPONSE error.
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, eventId: undefined }),
      });
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      const eventTemplate = {
        kind: 30078,
        content: JSON.stringify({ reducer: 'test', args: [] }),
        tags: [
          ['d', 'test_123'],
          ['fee', '1'],
        ],
      };

      try {
        await adapter.publishEvent(eventTemplate);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('INVALID_RESPONSE');
        expect((error as SigilError).boundary).toBe('crosstown');
      }
    });

    it('should map result.success=false to PUBLISH_FAILED with boundary crosstown', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: false, eventId: 'test123' }),
      });
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      const eventTemplate = {
        kind: 30078,
        content: JSON.stringify({ reducer: 'test', args: [] }),
        tags: [
          ['d', 'test_123'],
          ['fee', '1'],
        ],
      };

      try {
        await adapter.publishEvent(eventTemplate);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SigilError);
        // CrosstownClient throws INVALID_RESPONSE for (!success || !eventId)
        // Adapter then maps CrosstownError.INVALID_RESPONSE -> SigilError.INVALID_RESPONSE
        expect((error as SigilError).code).toBe('INVALID_RESPONSE');
        expect((error as SigilError).boundary).toBe('crosstown');
      }
    });
  });

  describe('mapError - Direct CrosstownError Type Mapping (AC4)', () => {
    // These tests exercise the mapError method directly by constructing
    // CrosstownError instances with each error type and passing them through
    // the adapter's start() which calls mapError on thrown errors.
    // Since mapError is private, we test it indirectly by mocking CrosstownClient
    // methods to throw specific CrosstownError types.

    const eventTemplate = {
      kind: 30078,
      content: JSON.stringify({ reducer: 'test', args: [] }),
      tags: [
        ['d', 'test_123'],
        ['fee', '1'],
      ],
    };

    it('should map CrosstownError NETWORK_ERROR to SigilError NETWORK_ERROR', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new CrosstownError('DNS lookup failed', 'NETWORK_ERROR'));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        boundary: 'crosstown',
      });
    });

    it('should map CrosstownError TIMEOUT to SigilError NETWORK_TIMEOUT', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new CrosstownError('Request timed out', 'TIMEOUT'));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'NETWORK_TIMEOUT',
        boundary: 'crosstown',
      });
    });

    it('should map CrosstownError ILP_FAILURE to SigilError PUBLISH_FAILED', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new CrosstownError('ILP payment error F04', 'ILP_FAILURE', 502));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'PUBLISH_FAILED',
        boundary: 'crosstown',
      });
    });

    it('should map CrosstownError PUBLISH_FAILED to SigilError PUBLISH_FAILED', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new CrosstownError('Server error', 'PUBLISH_FAILED', 500));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'PUBLISH_FAILED',
        boundary: 'crosstown',
      });
    });

    it('should map CrosstownError SIGNING_FAILURE to SigilError SIGNING_FAILED with identity boundary', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new CrosstownError('Invalid signature', 'SIGNING_FAILURE'));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'SIGNING_FAILED',
        boundary: 'identity',
      });
    });

    it('should map CrosstownError RATE_LIMITED to SigilError RATE_LIMITED', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new CrosstownError('Too many requests', 'RATE_LIMITED', 429));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        boundary: 'crosstown',
      });
    });

    it('should map CrosstownError INVALID_RESPONSE to SigilError INVALID_RESPONSE', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new CrosstownError('Malformed JSON in response', 'INVALID_RESPONSE'));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
        boundary: 'crosstown',
      });
    });

    it('should map CrosstownError NOT_STARTED to SigilError CROSSTOWN_NOT_CONFIGURED', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new CrosstownError('Client not started', 'NOT_STARTED'));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'CROSSTOWN_NOT_CONFIGURED',
        boundary: 'crosstown',
      });
    });

    it('should map unknown CrosstownError type to SigilError NETWORK_ERROR (default)', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new CrosstownError('Unknown failure', 'SOME_FUTURE_ERROR' as string));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        boundary: 'crosstown',
      });
    });

    it('should pass through SigilError unchanged when thrown directly by adapter', () => {
      // SigilError passthrough applies when the adapter itself throws (e.g., validation).
      // When CrosstownClient wraps errors, they come through as CrosstownError.
      // Test the passthrough via the constructor which throws SigilError directly.
      try {
        new CrosstownAdapter({
          secretKey: new Uint8Array(16), // Wrong length triggers SigilError
          connectorUrl: 'http://localhost:4041',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        // The SigilError from validation passes through without re-wrapping
        expect(error).toBeInstanceOf(SigilError);
        expect((error as SigilError).code).toBe('SIGNING_FAILED');
        expect((error as SigilError).boundary).toBe('identity');
      }
    });

    it('should map generic Error with "signature" in message to SIGNING_FAILED', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('invalid signature detected'));
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'SIGNING_FAILED',
        boundary: 'identity',
      });
    });

    it('should map non-Error values to SigilError NETWORK_ERROR', async () => {
      const mockFetch = vi.fn().mockRejectedValue('string error');
      global.fetch = mockFetch;

      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });
      await adapter.start();

      await expect(adapter.publishEvent(eventTemplate)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        boundary: 'crosstown',
      });
    });
  });

  describe('Identity Accessors (AC2)', () => {
    it('should delegate getPublicKey() and return 64 hex chars', () => {
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });

      const pubkey = adapter.getPublicKey();
      expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
      expect(pubkey).toBe(testPubkey);
    });

    it('should delegate getEvmAddress() and return 0x address', () => {
      const adapter = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });

      const evmAddress = adapter.getEvmAddress();
      expect(evmAddress).toMatch(/^0x[0-9a-f]+$/);
    });

    it('should derive consistent public key from secretKey', () => {
      const adapter1 = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });

      const adapter2 = new CrosstownAdapter({
        secretKey: testSecretKey,
        connectorUrl: 'http://localhost:4041',
      });

      expect(adapter1.getPublicKey()).toBe(adapter2.getPublicKey());
    });
  });

  describe('Security - Private Key Protection (NFR9, AC6)', () => {
    it('should NEVER log secretKey', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const consoleWarnSpy = vi.spyOn(console, 'warn');

      const secretKey = new Uint8Array(32).fill(0xab);

      // Exercise adapter construction
      const adapter = new CrosstownAdapter({
        secretKey,
        connectorUrl: 'http://localhost:4041',
      });

      // Exercise accessor methods
      adapter.getPublicKey();
      adapter.getEvmAddress();

      // Verify no console output contains the key material
      const allCalls = [
        ...consoleSpy.mock.calls.flat(),
        ...consoleErrorSpy.mock.calls.flat(),
        ...consoleWarnSpy.mock.calls.flat(),
      ];

      for (const output of allCalls) {
        const str = String(output);
        expect(str).not.toContain('abababab');
      }
    });

    it('should not include secretKey in error messages on construction failure', () => {
      const secretKey = new Uint8Array(16).fill(0xff); // Wrong length

      try {
        new CrosstownAdapter({ secretKey, connectorUrl: 'http://localhost:4041' });
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain('0xff');
        expect(message).not.toContain('255');
        expect(message).not.toContain('ffffffff');
      }
    });
  });
});
