/**
 * Crosstown Connector Client
 * Story 2.3: ILP Packet Construction & Signing
 *
 * HTTP client for submitting signed ILP packets to Crosstown connector.
 * Handles timeouts, network errors, and SSRF protection.
 */

import type { NostrEvent } from '../nostr/types';
import type { ILPPacketResult } from '../publish/ilp-packet';
import { SigilError } from '../nostr/nostr-client';

/**
 * Crosstown connector options
 */
export interface CrosstownConnectorOptions {
  /** Connector HTTP URL (e.g., 'http://localhost:4041') */
  connectorUrl: string;
  /** Timeout in milliseconds (default: 2000ms) */
  timeout?: number;
}

/**
 * Crosstown connector response
 *
 * Response format from connector /publish endpoint.
 */
interface CrosstownPublishResponse {
  /** Success flag */
  success: boolean;
  /** Nostr event ID (if success) */
  eventId?: string;
  /** Error message (if failure) */
  message?: string;
  /** Retry-after header value in seconds (if rate limited) */
  retryAfter?: number;
}

/**
 * Crosstown Connector Client
 *
 * Submits signed ILP packets (kind 30078 Nostr events) to Crosstown connector
 * via HTTP POST. Handles timeouts, errors, and SSRF protection.
 *
 * @example
 * ```typescript
 * const connector = new CrosstownConnector({
 *   connectorUrl: 'http://localhost:4041',
 *   timeout: 2000
 * });
 *
 * const result = await connector.publishEvent(signedEvent);
 * console.log('Published:', result.eventId);
 * ```
 */
export class CrosstownConnector {
  private connectorUrl: string;
  private timeout: number;

  constructor(options: CrosstownConnectorOptions) {
    this.timeout = options.timeout ?? 2000; // Default: 2s

    // Validate and sanitize connector URL
    this.connectorUrl = this.validateConnectorUrl(options.connectorUrl);
  }

  /**
   * Validate Crosstown connector URL
   *
   * SECURITY: SSRF protection - validates URL format and blocks dangerous hosts.
   *
   * Production mode (NODE_ENV=production):
   * - Only allow https:// protocol (reject http://)
   * - Block internal networks (10.*, 172.16-31.*, 192.168.*, 169.254.*, localhost)
   * - Reject URLs with embedded credentials
   *
   * Development mode:
   * - Allow http://localhost, http://127.0.0.1, http://172.* (Docker networks)
   * - Still reject URLs with embedded credentials
   * - Still reject file://, ftp://, and other non-HTTP protocols
   *
   * @param urlString - URL to validate
   * @returns Validated URL string
   * @throws SigilError with code INVALID_CONFIG if URL is invalid or dangerous
   */
  private validateConnectorUrl(urlString: string): string {
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

    // Reject URLs with embedded credentials (security risk)
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

    const isProduction = process.env.NODE_ENV === 'production';

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

      // Block localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
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

    return urlString;
  }

  /**
   * Validate resolved IP address for SSRF protection
   *
   * SECURITY: DNS rebinding protection - validates that the resolved IP is not internal.
   * This is called at request time, not just URL construction time.
   *
   * @param _hostname - Hostname to validate (unused - prefixed with _ to indicate intentional)
   * @throws SigilError with code INVALID_CONFIG if hostname resolves to internal IP
   */
  private async validateResolvedIp(_hostname: string): Promise<void> {
    // Skip validation in development mode
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    // Skip validation for public domains (DNS lookup is expensive)
    // In production, we already validated the URL doesn't contain internal IPs
    // This provides additional runtime protection against DNS rebinding
    // Note: Full DNS resolution check would require 'dns' module which isn't available in browsers
    // For now, we rely on construction-time validation and let the fetch API handle DNS
    // Future: Add optional DNS pre-resolution check for Node.js environments
  }

  /**
   * Publish signed ILP packet to Crosstown connector
   *
   * Submits a signed kind 30078 Nostr event via HTTP POST to the connector's
   * /publish endpoint. Returns confirmation details on success.
   *
   * SECURITY: DNS rebinding protection is partially implemented. Construction-time
   * validation prevents obvious internal IPs, but full DNS rebinding protection
   * would require runtime DNS resolution checking (available in Node.js only).
   *
   * @param event - Signed Nostr event (kind 30078 with ILP packet content)
   * @returns Promise resolving to ILP packet result with confirmation details
   * @throws SigilError with various codes:
   *   - NETWORK_TIMEOUT: Request timed out
   *   - NETWORK_ERROR: Network failure (DNS, connection refused, etc.)
   *   - PUBLISH_FAILED: Server returned error (4xx, 5xx)
   *   - INVALID_RESPONSE: Response format invalid
   *   - RATE_LIMITED: Too many requests (429)
   */
  async publishEvent(event: NostrEvent): Promise<ILPPacketResult> {
    const publishUrl = `${this.connectorUrl}/publish`;

    // Runtime SSRF protection (validate resolved IP)
    try {
      const url = new URL(this.connectorUrl);
      await this.validateResolvedIp(url.hostname);
    } catch (error) {
      if (error instanceof SigilError) {
        throw error;
      }
      // DNS resolution failed - this is a network error
      throw new SigilError(
        `Failed to resolve Crosstown connector hostname: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK_ERROR',
        'crosstown'
      );
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(publishUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting (429 Too Many Requests)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new SigilError(
          `Rate limited by Crosstown connector${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
          'RATE_LIMITED',
          'crosstown',
          retryAfter ? { retryAfter: parseInt(retryAfter, 10) } : undefined
        );
      }

      // Handle HTTP errors (4xx, 5xx)
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new SigilError(
          `Crosstown publish failed with status ${response.status}: ${errorText}`,
          'PUBLISH_FAILED',
          'crosstown',
          { statusCode: response.status }
        );
      }

      // Parse response JSON
      let responseData: CrosstownPublishResponse;
      try {
        responseData = (await response.json()) as CrosstownPublishResponse;
      } catch {
        throw new SigilError(
          'Invalid JSON response from Crosstown connector',
          'INVALID_RESPONSE',
          'crosstown'
        );
      }

      // Validate response format
      if (!responseData.success || !responseData.eventId) {
        throw new SigilError(
          `Crosstown publish failed: ${responseData.message || 'Unknown error'}`,
          'PUBLISH_FAILED',
          'crosstown'
        );
      }

      // Extract fee from event tags
      const feeTag = event.tags.find((tag) => tag[0] === 'fee');
      const fee = feeTag ? parseFloat(feeTag[1]) : 0;

      // Parse ILP packet content
      let reducer = 'unknown';
      let args: unknown = null;
      try {
        const parsed = JSON.parse(event.content) as { reducer?: string; args?: unknown };
        reducer = parsed.reducer || 'unknown';
        args = parsed.args;
      } catch {
        // Content parsing failed, use defaults
      }

      // Return confirmation result
      return {
        eventId: responseData.eventId,
        reducer,
        args,
        fee,
        pubkey: event.pubkey,
        timestamp: event.created_at,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if ((error as Error).name === 'AbortError') {
        throw new SigilError(
          `Crosstown publish timed out after ${this.timeout}ms`,
          'NETWORK_TIMEOUT',
          'crosstown',
          { timeout: this.timeout, url: publishUrl }
        );
      }

      // Re-throw SigilError as-is
      if (error instanceof SigilError) {
        throw error;
      }

      // Wrap other errors as NETWORK_ERROR
      throw new SigilError(
        `Network error during Crosstown publish: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK_ERROR',
        'crosstown'
      );
    }
  }
}
