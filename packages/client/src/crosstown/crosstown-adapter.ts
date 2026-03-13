/**
 * Crosstown Client Adapter
 * Story 2.5: @crosstown/client Integration & Scaffolding Removal
 *
 * Adapter wrapping @crosstown/client CrosstownClient for use by SigilClient.
 * Handles lifecycle management, event publishing delegation, SSRF protection,
 * and error mapping from CrosstownClient errors to SigilError codes.
 *
 * SECURITY: secretKey is passed at construction and NEVER logged.
 */

import {
  CrosstownClient,
  CrosstownError,
  type CrosstownStartResult,
  type UnsignedEventTemplate,
  type PublishEventResult,
} from '@crosstown/client';
import { encodeEventToToon, decodeEventFromToon } from '@crosstown/relay';
import { getPublicKey } from 'nostr-tools/pure';
import { bytesToHex } from '@noble/hashes/utils';
import { SigilError } from '../nostr/nostr-client';
import type { ILPPacketResult } from '../publish/ilp-packet';

/**
 * CrosstownAdapter configuration
 */
export interface CrosstownAdapterConfig {
  /** 32-byte Nostr secret key (Uint8Array) */
  secretKey: Uint8Array;
  /** Crosstown connector HTTP URL */
  connectorUrl: string;
  /** Optional BTP WebSocket endpoint */
  btpEndpoint?: string;
}

/**
 * Unsigned event template type for the adapter
 *
 * Represents a content-only Nostr event template with kind, content, and tags.
 * CrosstownClient fills in pubkey, created_at, id, and sig from its secretKey.
 */
export type { UnsignedEventTemplate };

/**
 * Re-export CrosstownStartResult for consumers
 */
export type { CrosstownStartResult };

/**
 * CrosstownAdapter
 *
 * Wraps @crosstown/client CrosstownClient for SigilClient integration.
 * Manages lifecycle (start/stop), event publishing, and error mapping.
 *
 * @example
 * ```typescript
 * const adapter = new CrosstownAdapter({
 *   secretKey: keypair.privateKey,
 *   connectorUrl: 'http://localhost:4041',
 * });
 *
 * await adapter.start();
 * const result = await adapter.publishEvent(eventTemplate);
 * await adapter.stop();
 * ```
 */
export class CrosstownAdapter {
  private readonly client: CrosstownClient;
  private readonly pubkey: string;

  constructor(config: CrosstownAdapterConfig) {
    // Validate secretKey format (NEVER log the key itself)
    // Use ArrayBuffer.isView for cross-realm Uint8Array compatibility (ESM/CJS interop)
    const isValidKey =
      config.secretKey &&
      (config.secretKey instanceof Uint8Array || ArrayBuffer.isView(config.secretKey)) &&
      config.secretKey.length === 32;
    if (!isValidKey) {
      throw new SigilError(
        'Invalid private key format. Expected 32-byte Uint8Array.',
        'SIGNING_FAILED',
        'identity'
      );
    }
    // Ensure we have a proper Uint8Array for downstream consumers
    const secretKey = new Uint8Array(config.secretKey);

    // Validate connectorUrl with SSRF protection
    this.validateConnectorUrl(config.connectorUrl);

    // Derive public key from secretKey
    // getPublicKey from nostr-tools v2+ returns a hex string
    const pubkeyResult = getPublicKey(secretKey);
    this.pubkey = typeof pubkeyResult === 'string'
      ? pubkeyResult
      : bytesToHex(new Uint8Array(pubkeyResult));

    // Determine BTP endpoint: config > env > default
    const btpEndpoint =
      config.btpEndpoint ||
      (typeof process !== 'undefined' ? process.env.BTP_ENDPOINT : undefined) ||
      'ws://localhost:3000';

    // Validate BTP endpoint protocol (SECURITY: require wss:// in production)
    this.validateBtpEndpoint(btpEndpoint);

    // Build CrosstownClient instance
    this.client = new CrosstownClient({
      connectorUrl: config.connectorUrl,
      secretKey,
      ilpInfo: {
        pubkey: this.pubkey,
        ilpAddress: `g.crosstown.agent.${this.pubkey.slice(0, 8)}`,
        btpEndpoint,
      },
      toonEncoder: encodeEventToToon,
      toonDecoder: decodeEventFromToon,
    });
  }

  /**
   * Validate Crosstown connector URL
   *
   * SECURITY: SSRF protection ported from crosstown-connector.ts.
   *
   * Production mode (NODE_ENV=production):
   * - Only allow https:// protocol
   * - Block internal networks (10.*, 172.16-31.*, 192.168.*, 169.254.*, localhost)
   * - Reject URLs with embedded credentials
   *
   * Development mode:
   * - Allow http://localhost, http://127.0.0.1, http://172.* (Docker networks)
   * - Still reject embedded credentials and non-HTTP protocols
   *
   * @param urlString - URL to validate
   * @throws SigilError with code INVALID_CONFIG if URL is invalid or dangerous
   */
  private validateConnectorUrl(urlString: string): void {
    let url: URL;

    try {
      url = new URL(urlString);
    } catch {
      throw new SigilError(
        `Invalid Crosstown connector URL: ${urlString}`,
        'INVALID_CONFIG',
        'crosstown'
      );
    }

    // Reject URLs with embedded credentials
    if (url.username || url.password) {
      throw new SigilError(
        'Crosstown connector URL must not contain embedded credentials',
        'INVALID_CONFIG',
        'crosstown'
      );
    }

    // Reject non-HTTP protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new SigilError(
        `Invalid protocol: ${url.protocol}. Only http:// and https:// are allowed.`,
        'INVALID_CONFIG',
        'crosstown'
      );
    }

    const isProduction =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

    // Production: require https:// protocol
    if (isProduction && url.protocol !== 'https:') {
      throw new SigilError(
        'Crosstown connector URL must use https:// in production environments',
        'INVALID_CONFIG',
        'crosstown'
      );
    }

    // Production: block internal/private networks (SSRF protection)
    if (isProduction) {
      const hostname = url.hostname.toLowerCase();

      // Block localhost and loopback addresses (including 0.0.0.0 which binds all interfaces)
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
        throw new SigilError(
          'Crosstown connector URL cannot use localhost in production',
          'INVALID_CONFIG',
          'crosstown'
        );
      }

      // Block internal IP ranges (10.*, 172.16-31.*, 192.168.*, 169.254.*)
      const ipPatterns = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./, // Link-local
      ];

      for (const pattern of ipPatterns) {
        if (pattern.test(hostname)) {
          throw new SigilError(
            `Crosstown connector URL cannot use internal IP range: ${hostname}`,
            'INVALID_CONFIG',
            'crosstown'
          );
        }
      }
    }
  }

  /**
   * Validate BTP WebSocket endpoint
   *
   * SECURITY: Enforce wss:// in production to prevent unencrypted WebSocket connections.
   * In development, ws://localhost and ws://127.0.0.1 are permitted for local Docker stack.
   *
   * @param endpoint - BTP WebSocket URL to validate
   * @throws SigilError with code INVALID_CONFIG if endpoint is invalid or insecure
   */
  private validateBtpEndpoint(endpoint: string): void {
    let url: URL;

    try {
      url = new URL(endpoint);
    } catch {
      throw new SigilError(
        `Invalid BTP endpoint URL: ${endpoint}`,
        'INVALID_CONFIG',
        'crosstown'
      );
    }

    // Only allow WebSocket protocols (insecure for dev, secure for production)
    // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new SigilError(
        // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
        `Invalid BTP endpoint protocol: ${url.protocol}. Only WebSocket protocols are allowed.`,
        'INVALID_CONFIG',
        'crosstown'
      );
    }

    const isProduction =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

    // Production: require wss:// protocol
    if (isProduction && url.protocol !== 'wss:') {
      throw new SigilError(
        'BTP endpoint must use wss:// in production environments',
        'INVALID_CONFIG',
        'crosstown'
      );
    }
  }

  /**
   * Start the CrosstownClient
   *
   * Connects to the Crosstown connector and discovers peers.
   *
   * @returns CrosstownStartResult with peer discovery info
   */
  async start(): Promise<CrosstownStartResult> {
    try {
      return await this.client.start();
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Stop the CrosstownClient
   *
   * Gracefully shuts down the connection.
   */
  async stop(): Promise<void> {
    try {
      await this.client.stop();
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Publish an unsigned event template via CrosstownClient
   *
   * Receives a content-only event template (kind, content, tags).
   * CrosstownClient fills in pubkey, created_at, id, sig from its secretKey,
   * then TOON-encodes and ILP-routes the signed event.
   *
   * @param eventTemplate - Unsigned event template (kind, content, tags only)
   * @returns ILPPacketResult with eventId and confirmation details
   * @throws SigilError with mapped error codes
   */
  async publishEvent(eventTemplate: UnsignedEventTemplate): Promise<ILPPacketResult> {
    let result: PublishEventResult;
    try {
      result = await this.client.publishEvent(eventTemplate);
    } catch (error) {
      throw this.mapError(error);
    }

    if (!result.success) {
      throw new SigilError(
        `Crosstown publish failed: ${result.error || 'Unknown error'}`,
        'PUBLISH_FAILED',
        'crosstown'
      );
    }

    // Parse content to extract reducer and args
    let reducer = 'unknown';
    let args: unknown = null;
    try {
      const parsed = JSON.parse(eventTemplate.content) as { reducer?: string; args?: unknown };
      reducer = parsed.reducer || 'unknown';
      args = parsed.args;
    } catch {
      // Content parsing failed, use defaults
    }

    // Extract fee from tags
    const feeTag = eventTemplate.tags.find((tag) => tag[0] === 'fee');
    const fee = feeTag ? parseFloat(feeTag[1]) : 0;

    return {
      eventId: result.eventId,
      reducer,
      args,
      fee,
      pubkey: this.pubkey,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Get the Nostr public key (64-char hex)
   */
  getPublicKey(): string {
    return this.pubkey;
  }

  /**
   * Get the EVM address (EIP-55 checksummed 0x)
   *
   * NOTE: This is a simplified placeholder that truncates the x-only Nostr pubkey.
   * A proper implementation would derive the EVM address from the uncompressed
   * secp256k1 public key via keccak256 hash. This matches the upstream
   * @crosstown/client placeholder and will be replaced when the real package
   * provides a correct implementation.
   *
   * TODO: Replace with proper EVM address derivation when @crosstown/client
   * exposes a real getEvmAddress() method.
   */
  getEvmAddress(): string {
    return `0x${this.pubkey.slice(0, 40)}`;
  }

  /**
   * Map CrosstownClient errors to SigilError codes
   *
   * Preserves all existing error codes for backward compatibility:
   * - Connection refused / DNS -> NETWORK_ERROR (boundary: crosstown)
   * - Timeout / AbortError -> NETWORK_TIMEOUT (boundary: crosstown)
   * - ILP payment failure (F04, F06) -> PUBLISH_FAILED (boundary: crosstown)
   * - Signature failure -> SIGNING_FAILED (boundary: identity)
   * - Rate limit (429) -> RATE_LIMITED (boundary: crosstown)
   * - Invalid response -> INVALID_RESPONSE (boundary: crosstown)
   */
  private mapError(error: unknown): SigilError {
    // Already a SigilError - pass through
    if (error instanceof SigilError) {
      return error;
    }

    // CrosstownError with type info
    if (error instanceof CrosstownError) {
      switch (error.type) {
        case 'NETWORK_ERROR':
          return new SigilError(
            `Network error during Crosstown publish: ${error.message}`,
            'NETWORK_ERROR',
            'crosstown'
          );

        case 'TIMEOUT':
          return new SigilError(
            `Crosstown publish timed out: ${error.message}`,
            'NETWORK_TIMEOUT',
            'crosstown'
          );

        case 'ILP_FAILURE':
          return new SigilError(
            `Crosstown publish failed: ${error.message}`,
            'PUBLISH_FAILED',
            'crosstown'
          );

        case 'PUBLISH_FAILED':
          return new SigilError(
            `Crosstown publish failed: ${error.message}`,
            'PUBLISH_FAILED',
            'crosstown'
          );

        case 'SIGNING_FAILURE':
          return new SigilError(
            `Event signing failed: ${error.message}`,
            'SIGNING_FAILED',
            'identity'
          );

        case 'RATE_LIMITED':
          return new SigilError(
            `Rate limited by Crosstown connector: ${error.message}`,
            'RATE_LIMITED',
            'crosstown',
            error.statusCode ? { statusCode: error.statusCode } : undefined
          );

        case 'INVALID_RESPONSE':
          return new SigilError(
            `Invalid response from Crosstown connector: ${error.message}`,
            'INVALID_RESPONSE',
            'crosstown'
          );

        case 'NOT_STARTED':
          return new SigilError(
            `CrosstownClient not started: ${error.message}`,
            'CROSSTOWN_NOT_CONFIGURED',
            'crosstown'
          );

        default:
          return new SigilError(
            `Crosstown error: ${error.message}`,
            'NETWORK_ERROR',
            'crosstown'
          );
      }
    }

    // Generic Error
    const err = error instanceof Error ? error : new Error(String(error));

    // Check for abort/timeout
    if (err.name === 'AbortError') {
      return new SigilError(
        `Crosstown publish timed out: ${err.message}`,
        'NETWORK_TIMEOUT',
        'crosstown'
      );
    }

    // Check for signature errors
    if (err.message?.includes('signature') || err.message?.includes('sign')) {
      return new SigilError(
        `Event signing failed: ${err.message}`,
        'SIGNING_FAILED',
        'identity'
      );
    }

    // Default: network error
    return new SigilError(
      `Network error during Crosstown publish: ${err.message}`,
      'NETWORK_ERROR',
      'crosstown'
    );
  }
}
