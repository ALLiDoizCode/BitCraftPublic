/**
 * Wallet Balance Client
 * Story 2.2: Action Cost Registry & Wallet Balance
 *
 * HTTP client for querying ILP wallet balance from Crosstown connector.
 *
 * @see _bmad-output/implementation-artifacts/2-2-action-cost-registry-and-wallet-balance.md
 */

import { SigilError } from '../nostr/nostr-client';

/**
 * Crosstown wallet balance API response
 *
 * Expected structure: { balance: number }
 * Note: Defined for documentation purposes, not directly used in type assertions
 */

/**
 * Wallet balance client
 *
 * Queries ILP wallet balance from Crosstown connector via HTTP API.
 *
 * @example
 * ```typescript
 * const client = new WalletClient(
 *   'http://localhost:4041',
 *   'npub1abc...'
 * );
 *
 * const balance = await client.getBalance(); // Returns 10000
 * ```
 */
export class WalletClient {
  private crosstownConnectorUrl: string;
  private identityPublicKey: string;
  private stubMode = false;
  private stubBalance = 10000;

  /**
   * Create wallet balance client
   *
   * @param crosstownConnectorUrl - Crosstown connector HTTP URL
   * @param identityPublicKey - User's Nostr public key (hex format)
   * @throws SigilError with code INVALID_CONFIG if URL validation fails
   */
  constructor(crosstownConnectorUrl: string, identityPublicKey: string) {
    // Validate Crosstown connector URL
    let url: URL;
    try {
      url = new URL(crosstownConnectorUrl);
    } catch {
      throw new SigilError(
        `Invalid Crosstown connector URL: ${crosstownConnectorUrl}`,
        'INVALID_CONFIG',
        'wallet-client'
      );
    }

    // SSRF protection: validate URL hostname
    const hostname = url.hostname.toLowerCase();

    // In development, allow localhost and Docker internal IPs
    if (process.env.NODE_ENV !== 'production') {
      const allowedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
      const isDockerInternal = hostname.startsWith('172.'); // Docker default bridge network
      const isAllowed = allowedHosts.includes(hostname) || isDockerInternal;

      if (!isAllowed && !url.protocol.match(/^https?:$/)) {
        throw new SigilError(
          `Invalid protocol for Crosstown connector URL: ${url.protocol}`,
          'INVALID_CONFIG',
          'wallet-client'
        );
      }
    } else {
      // In production, reject localhost and internal IPs (SSRF protection)
      const deniedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
      const isDockerInternal =
        hostname.startsWith('172.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.');
      const isDenied = deniedHosts.includes(hostname) || isDockerInternal;

      if (isDenied) {
        throw new SigilError(
          'Crosstown connector URL cannot use localhost or internal IPs in production',
          'INVALID_CONFIG',
          'wallet-client'
        );
      }

      // Require HTTPS in production
      if (url.protocol !== 'https:') {
        throw new SigilError(
          'Crosstown connector URL must use HTTPS in production',
          'INVALID_CONFIG',
          'wallet-client'
        );
      }
    }

    this.crosstownConnectorUrl = crosstownConnectorUrl;
    this.identityPublicKey = identityPublicKey;

    // Check for stub mode feature flag
    if (process.env.SIGIL_WALLET_STUB === 'true') {
      this.stubMode = true;
      console.warn(
        'Wallet client stub mode activated via SIGIL_WALLET_STUB=true. Using fixed balance: 10000'
      );
    }
  }

  /**
   * Get wallet balance
   *
   * Queries current ILP wallet balance from Crosstown connector.
   *
   * If Crosstown balance API is not implemented (HTTP 404/501), activates
   * stub mode and returns fixed balance (10000) with warning log.
   *
   * @returns Promise resolving to balance (non-negative integer, game currency units)
   * @throws SigilError with code NETWORK_ERROR on timeout or network failure
   * @throws SigilError with code INVALID_RESPONSE if response is invalid
   */
  async getBalance(): Promise<number> {
    // Return stub balance if stub mode is active
    if (this.stubMode) {
      return this.stubBalance;
    }

    // Construct balance API endpoint URL
    const endpoint = `${this.crosstownConnectorUrl}/wallet/balance/${this.identityPublicKey}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);

    try {
      // Make HTTP GET request
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      // Check for 404 or 501 (API not implemented) - activate stub mode
      if (response.status === 404 || response.status === 501) {
        this.stubMode = true;
        console.warn(
          `Crosstown balance API not available (HTTP ${response.status}). ` +
            `Using stub balance: ${this.stubBalance}. ` +
            'See Story 2.5 for full integration.'
        );
        return this.stubBalance;
      }

      // Check for other HTTP errors
      if (!response.ok) {
        throw new SigilError(
          `Crosstown balance API returned HTTP ${response.status}: ${response.statusText}`,
          'NETWORK_ERROR',
          'crosstown-connector'
        );
      }

      // Parse JSON response
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new SigilError(
          'Crosstown balance API returned invalid JSON',
          'INVALID_RESPONSE',
          'crosstown-connector'
        );
      }

      // Validate response structure
      if (typeof data !== 'object' || data === null) {
        throw new SigilError(
          'Crosstown balance API response must be a JSON object',
          'INVALID_RESPONSE',
          'crosstown-connector'
        );
      }

      const responseObj = data as Record<string, unknown>;

      if (!('balance' in responseObj)) {
        throw new SigilError(
          'Crosstown balance API response missing "balance" field',
          'INVALID_RESPONSE',
          'crosstown-connector'
        );
      }

      const balance = responseObj.balance;

      if (typeof balance !== 'number') {
        throw new SigilError(
          'Crosstown balance API "balance" field must be a number',
          'INVALID_RESPONSE',
          'crosstown-connector'
        );
      }

      if (balance < 0 || !Number.isFinite(balance)) {
        throw new SigilError(
          `Crosstown balance API returned invalid balance: ${balance}`,
          'INVALID_RESPONSE',
          'crosstown-connector'
        );
      }

      return balance;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SigilError(
          'Crosstown balance API request timed out (>500ms)',
          'NETWORK_ERROR',
          'crosstown-connector'
        );
      }

      // Re-throw SigilError instances
      if (error instanceof SigilError) {
        throw error;
      }

      // Handle fetch network errors
      throw new SigilError(
        `Crosstown balance API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        'crosstown-connector'
      );
    }
  }

  /**
   * Enable stub mode (for testing)
   *
   * Forces the client to return a fixed balance instead of querying the API.
   *
   * @param balance - Stub balance to return (default: 10000)
   */
  enableStubMode(balance: number = 10000): void {
    this.stubMode = true;
    this.stubBalance = balance;
  }

  /**
   * Disable stub mode (for testing)
   */
  disableStubMode(): void {
    this.stubMode = false;
  }

  /**
   * Check if stub mode is active
   */
  isStubMode(): boolean {
    return this.stubMode;
  }
}
