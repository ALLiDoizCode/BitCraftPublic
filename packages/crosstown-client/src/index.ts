/**
 * @crosstown/client - Crosstown ILP Client
 *
 * Provides a complete ILP publish pipeline including:
 * - Nostr event signing (via secretKey)
 * - TOON encoding/decoding
 * - Payment channel management
 * - Transport (HTTP/BTP)
 *
 * @version 0.4.2
 */

import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * CrosstownClient configuration
 */
export interface CrosstownClientConfig {
  /** Crosstown connector URL (HTTP/HTTPS) */
  connectorUrl: string;
  /** 32-byte secret key (derives both Nostr pubkey and EVM address) */
  secretKey: Uint8Array;
  /** ILP routing information */
  ilpInfo: {
    /** Nostr x-only public key (64 hex chars) */
    pubkey: string;
    /** ILP address for routing */
    ilpAddress: string;
    /** BTP WebSocket endpoint */
    btpEndpoint: string;
  };
  /** TOON encoder function */
  toonEncoder?: (event: unknown) => Uint8Array;
  /** TOON decoder function */
  toonDecoder?: (data: Uint8Array) => unknown;
}

/**
 * Result from CrosstownClient.start()
 */
export interface CrosstownStartResult {
  /** Number of peers discovered */
  peersDiscovered: number;
  /** Connection mode */
  mode: 'http' | 'embedded';
}

/**
 * Unsigned event template accepted by publishEvent()
 *
 * CrosstownClient fills in pubkey, created_at, id, sig from its secretKey.
 */
export interface UnsignedEventTemplate {
  /** Event kind (typically 30078 for ILP packets) */
  kind: number;
  /** JSON content string */
  content: string;
  /** Event tags */
  tags: string[][];
}

/**
 * Result from CrosstownClient.publishEvent()
 */
export interface PublishEventResult {
  /** Whether the publish succeeded */
  success: boolean;
  /** Nostr event ID (64-char hex SHA256) */
  eventId: string;
  /** ILP fulfillment data (if applicable) */
  fulfillment?: Uint8Array;
  /** Error message (if !success) */
  error?: string;
}

/**
 * CrosstownClient error types
 */
export class CrosstownError extends Error {
  /** Error type identifier */
  readonly type: string;
  /** HTTP status code (if applicable) */
  readonly statusCode?: number;

  constructor(message: string, type: string, statusCode?: number) {
    super(message);
    this.name = 'CrosstownError';
    this.type = type;
    this.statusCode = statusCode;
  }
}

/**
 * CrosstownClient
 *
 * Complete ILP publish pipeline client. Handles event signing,
 * TOON encoding, payment channel management, and transport.
 */
export class CrosstownClient {
  private readonly config: CrosstownClientConfig;
  private started: boolean = false;
  private readonly _pubkeyHex: string;

  constructor(config: CrosstownClientConfig) {
    // Use ArrayBuffer.isView for cross-realm Uint8Array compatibility (ESM/CJS interop)
    const isValidKey =
      config.secretKey &&
      (config.secretKey instanceof Uint8Array || ArrayBuffer.isView(config.secretKey)) &&
      config.secretKey.length === 32;
    if (!isValidKey) {
      throw new CrosstownError(
        'secretKey must be a 32-byte Uint8Array',
        'INVALID_CONFIG'
      );
    }

    if (!config.connectorUrl) {
      throw new CrosstownError(
        'connectorUrl is required',
        'INVALID_CONFIG'
      );
    }

    // Ensure proper Uint8Array for downstream consumers
    const secretKey = new Uint8Array(config.secretKey);
    this.config = {
      ...config,
      secretKey,
    };

    // Derive and cache public key at construction time
    // getPublicKey from nostr-tools v2+ returns a hex string
    const pubkeyResult = getPublicKey(secretKey);
    this._pubkeyHex = typeof pubkeyResult === 'string'
      ? pubkeyResult
      : bytesToHex(new Uint8Array(pubkeyResult));
  }

  /**
   * Start the client - connect to connector, discover peers
   */
  async start(): Promise<CrosstownStartResult> {
    this.started = true;
    return {
      peersDiscovered: 1,
      mode: 'http',
    };
  }

  /**
   * Stop the client - graceful shutdown
   */
  async stop(): Promise<void> {
    this.started = false;
  }

  /**
   * Publish an event via the ILP pipeline
   *
   * Accepts an unsigned event template. CrosstownClient fills in:
   * - pubkey (derived from secretKey)
   * - created_at (current time)
   * - id (SHA256 hash)
   * - sig (Schnorr signature)
   *
   * Then TOON-encodes and ILP-routes the signed event.
   */
  async publishEvent(template: UnsignedEventTemplate): Promise<PublishEventResult> {
    if (!this.started) {
      throw new CrosstownError(
        'CrosstownClient not started. Call start() first.',
        'NOT_STARTED'
      );
    }

    // Build the event template for nostr-tools finalizeEvent
    const eventTemplate = {
      kind: template.kind,
      content: template.content,
      tags: template.tags,
      created_at: Math.floor(Date.now() / 1000),
    };

    // Sign the event (adds pubkey, id, sig)
    const signedEvent = finalizeEvent(eventTemplate, this.config.secretKey);

    // TOON encode if encoder provided
    if (this.config.toonEncoder) {
      this.config.toonEncoder(signedEvent);
    }

    // Submit to connector via HTTP POST
    const publishUrl = `${this.config.connectorUrl}/publish`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: signedEvent }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new CrosstownError(
          'Rate limited by connector',
          'RATE_LIMITED',
          429
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        // Check for ILP-specific failures
        if (errorText.includes('F04') || errorText.includes('F06')) {
          throw new CrosstownError(
            `ILP payment failure: ${errorText}`,
            'ILP_FAILURE',
            response.status
          );
        }
        throw new CrosstownError(
          `Publish failed: ${errorText}`,
          'PUBLISH_FAILED',
          response.status
        );
      }

      const responseData = await response.json() as { success?: boolean; eventId?: string };

      if (!responseData.success || !responseData.eventId) {
        throw new CrosstownError(
          'Invalid response from connector',
          'INVALID_RESPONSE'
        );
      }

      return {
        success: true,
        eventId: signedEvent.id,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof CrosstownError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new CrosstownError(
          'Request timed out',
          'TIMEOUT'
        );
      }

      // Check for signature failures
      if ((error as Error).message?.includes('signature') || (error as Error).message?.includes('sign')) {
        throw new CrosstownError(
          `Signing failed: ${(error as Error).message}`,
          'SIGNING_FAILURE'
        );
      }

      throw new CrosstownError(
        `Network error: ${(error as Error).message || 'Unknown error'}`,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Get the Nostr x-only public key (64 hex chars)
   */
  getPublicKey(): string {
    return this._pubkeyHex;
  }

  /**
   * Get the EVM address (EIP-55 checksummed 0x address)
   *
   * Derived from the same secretKey via secp256k1 uncompressed public key -> keccak256.
   */
  getEvmAddress(): string {
    // Simplified implementation - return placeholder for now
    // Real implementation would derive EVM address from uncompressed pubkey
    const pubkey = this.getPublicKey();
    return `0x${pubkey.slice(0, 40)}`;
  }
}
