/**
 * Nostr Client
 * Story 2.1: Crosstown Relay Connection & Event Subscriptions
 *
 * NIP-01 compliant Nostr relay client with reconnection and subscription management.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/01.md
 * @see _bmad-output/implementation-artifacts/prep-4-crosstown-relay-protocol.md
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import type {
  NostrRelayOptions,
  NostrConnectionState,
  Filter,
  NostrEvent,
  Subscription,
  ActionConfirmation,
  ILPPacket,
  NostrConnectionChangeEvent,
} from './types';

/**
 * Internal subscription metadata
 */
interface SubscriptionMetadata {
  id: string;
  filters: Filter[];
  handler: (event: NostrEvent) => void;
}

/**
 * Sigil-specific error codes
 */
export class SigilError extends Error {
  constructor(
    message: string,
    public code: string,
    public boundary: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SigilError';
  }
}

/**
 * Nostr Client
 *
 * NIP-01 compliant WebSocket client for Nostr relays with:
 * - Connection lifecycle management
 * - Subscription protocol (REQ/CLOSE)
 * - Message parsing and routing
 * - Exponential backoff reconnection
 * - Action confirmation detection (kind 30078)
 *
 * @example
 * ```typescript
 * const client = new NostrClient({ url: 'ws://localhost:4040' });
 *
 * client.on('connectionChange', (event) => {
 *   console.log('State:', event.state);
 * });
 *
 * client.on('actionConfirmed', (confirmation) => {
 *   console.log('Action:', confirmation.reducer, confirmation.args);
 * });
 *
 * await client.connect();
 *
 * const sub = client.subscribe([{ kinds: [30078] }], (event) => {
 *   console.log('Event:', event);
 * });
 *
 * // Later...
 * sub.unsubscribe();
 * await client.disconnect();
 * ```
 */
export class NostrClient extends EventEmitter {
  private options: Required<NostrRelayOptions>;
  private ws: WebSocket | null = null;
  private _state: NostrConnectionState = 'disconnected';
  private subscriptions = new Map<string, SubscriptionMetadata>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private manualDisconnect = false;
  private noticeRateLimiter = new Map<string, number>();
  private readonly NOTICE_RATE_LIMIT_MS = 60000; // 1 minute
  private readonly MAX_NOTICES_PER_MINUTE = 10;

  constructor(options?: NostrRelayOptions) {
    super();

    // Set defaults
    this.options = {
      url: options?.url || 'ws://localhost:4040',
      autoReconnect: options?.autoReconnect ?? true,
      maxReconnectAttempts: options?.maxReconnectAttempts ?? 0, // 0 = infinite
      initialDelay: options?.initialDelay || 1000,
      maxDelay: options?.maxDelay || 30000,
      jitterPercent: options?.jitterPercent || 10,
    };

    // Validate relay URL
    this.validateRelayUrl(this.options.url);
  }

  /**
   * Validate relay URL format
   * Security: A03:2021 - Injection prevention
   */
  private validateRelayUrl(url: string): void {
    // Must be ws:// or wss:// protocol
    if (!url.match(/^wss?:\/\/[a-zA-Z0-9.-]+(:[0-9]+)?(\/.*)?$/)) {
      throw new SigilError(
        `Invalid relay URL format: ${url}. Must be ws:// or wss://`,
        'INVALID_RELAY_URL',
        'nostr-relay'
      );
    }
  }

  /**
   * Get current connection state
   */
  get state(): NostrConnectionState {
    return this._state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Set connection state and emit event
   */
  private setState(newState: NostrConnectionState, error?: Error): void {
    const oldState = this._state;
    if (oldState === newState) return;

    this._state = newState;

    const event: NostrConnectionChangeEvent = {
      state: newState,
      error,
    };

    if (newState === 'reconnecting') {
      event.attemptNumber = this.reconnectAttempts;
      event.nextAttemptDelay = this.calculateBackoffDelay();
    }

    this.emit('connectionChange', event);
  }

  /**
   * Connect to Nostr relay
   *
   * Establishes WebSocket connection and sets up event handlers.
   *
   * @throws {SigilError} If connection fails or URL is invalid
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      return; // Already connected
    }

    this.manualDisconnect = false;
    this.setState('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.url);

        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.terminate();
            const error = new SigilError('Connection timeout', 'CONNECTION_TIMEOUT', 'nostr-relay');
            this.setState('failed', error);
            reject(error);
          }
        }, 10000); // 10 second timeout

        this.ws.on('error', (error: Error) => {
          clearTimeout(connectionTimeout);
          const sigilError = new SigilError(
            `WebSocket error: ${error.message}`,
            'WEBSOCKET_ERROR',
            'nostr-relay'
          );
          this.setState('failed', sigilError);
          reject(sigilError);
        });

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.reconnectAttempts = 0; // Reset on successful connection
          this.setState('connected');
          resolve();
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.handleClose(code, reason.toString());
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data.toString());
        });
      } catch (error) {
        const sigilError = new SigilError(
          `Failed to create WebSocket: ${error}`,
          'CONNECTION_FAILED',
          'nostr-relay'
        );
        this.setState('failed', sigilError);
        reject(sigilError);
      }
    });
  }

  /**
   * Disconnect from relay
   *
   * Closes WebSocket connection and clears all subscriptions.
   */
  async disconnect(): Promise<void> {
    this.manualDisconnect = true;
    this.cancelReconnection();

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.subscriptions.clear();
    this.setState('disconnected');
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: string): void {
    this.ws = null;
    const wasConnected = this._state === 'connected';

    // Normal close codes (1000, 1001) or manual disconnect
    if (code === 1000 || code === 1001 || this.manualDisconnect) {
      this.setState('disconnected');
      return;
    }

    // Abnormal close - trigger reconnection if enabled and previously connected
    // Only reconnect if we were in connected state to avoid reconnecting from failed initial connection
    if (this.options.autoReconnect && wasConnected) {
      this.setState('reconnecting');
      this.scheduleReconnection();
    } else {
      const error = new SigilError(
        `Connection closed: ${code} - ${reason}`,
        'CONNECTION_CLOSED',
        'nostr-relay'
      );
      this.setState('failed', error);
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   * Security: A04:2021 - Insecure design prevention (prevents tight reconnection loops)
   */
  private calculateBackoffDelay(): number {
    const exponentialDelay = Math.min(
      this.options.initialDelay * Math.pow(2, this.reconnectAttempts),
      this.options.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * (this.options.jitterPercent / 100);
    const randomJitter = (Math.random() * 2 - 1) * jitter;

    return Math.floor(exponentialDelay + randomJitter);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnection(): void {
    this.cancelReconnection();

    const delay = this.calculateBackoffDelay();
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;

      // Check max attempts (0 = infinite)
      if (
        this.options.maxReconnectAttempts > 0 &&
        this.reconnectAttempts > this.options.maxReconnectAttempts
      ) {
        const error = new SigilError(
          'Max reconnection attempts reached',
          'MAX_RECONNECT_ATTEMPTS',
          'nostr-relay'
        );
        this.setState('failed', error);
        return;
      }

      try {
        await this.connect();
        // Re-establish subscriptions after successful reconnection
        await this.reestablishSubscriptions();
      } catch {
        // Connection failed, will retry if autoReconnect still enabled
        if (this.options.autoReconnect) {
          this.setState('reconnecting');
          this.scheduleReconnection();
        }
      }
    }, delay);
  }

  /**
   * Cancel pending reconnection
   */
  private cancelReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Re-establish all active subscriptions after reconnection
   * Security: A04:2021 - Ensures subscription recovery after disconnect
   */
  private async reestablishSubscriptions(): Promise<void> {
    for (const sub of this.subscriptions.values()) {
      this.sendReqMessage(sub.id, sub.filters);
    }
  }

  /**
   * Subscribe to events matching filters
   *
   * @param filters - NIP-01 filters (ORed together)
   * @param handler - Callback for matching events
   * @returns Subscription object with unsubscribe method
   *
   * @example
   * ```typescript
   * const sub = client.subscribe([{ kinds: [30078] }], (event) => {
   *   console.log('Received:', event);
   * });
   *
   * // Later...
   * sub.unsubscribe();
   * ```
   */
  subscribe(filters: Filter[], handler: (event: NostrEvent) => void): Subscription {
    // Security: A01:2021 - Use cryptographically secure subscription IDs
    const subscriptionId = crypto.randomUUID();

    // Store subscription metadata
    const metadata: SubscriptionMetadata = {
      id: subscriptionId,
      filters,
      handler,
    };
    this.subscriptions.set(subscriptionId, metadata);

    // Send REQ message if connected
    if (this.isConnected()) {
      this.sendReqMessage(subscriptionId, filters);
    }

    // Return subscription object
    return {
      id: subscriptionId,
      filters,
      unsubscribe: () => this.unsubscribe(subscriptionId),
    };
  }

  /**
   * Unsubscribe from subscription
   *
   * Removes subscription from internal tracking and sends CLOSE message to relay.
   *
   * @param subscriptionId - Subscription identifier to unsubscribe
   */
  private unsubscribe(subscriptionId: string): void {
    if (!this.subscriptions.has(subscriptionId)) {
      return; // Already unsubscribed
    }

    // Remove from active subscriptions
    this.subscriptions.delete(subscriptionId);

    // Send CLOSE message if connected
    if (this.isConnected()) {
      this.sendCloseMessage(subscriptionId);
    }
  }

  /**
   * Send REQ message to relay
   *
   * Sends a NIP-01 compliant REQ message to subscribe to events matching the provided filters.
   * Format: ["REQ", <subscription_id>, <filter1>, <filter2>, ...]
   *
   * @param subscriptionId - Unique subscription identifier
   * @param filters - Array of NIP-01 filter objects
   */
  private sendReqMessage(subscriptionId: string, filters: Filter[]): void {
    if (!this.isConnected() || !this.ws) {
      return;
    }

    const reqMessage = ['REQ', subscriptionId, ...filters];
    this.ws.send(JSON.stringify(reqMessage));
  }

  /**
   * Send CLOSE message to relay
   *
   * Sends a NIP-01 compliant CLOSE message to unsubscribe from a subscription.
   * Format: ["CLOSE", <subscription_id>]
   *
   * @param subscriptionId - Subscription identifier to close
   */
  private sendCloseMessage(subscriptionId: string): void {
    if (!this.isConnected() || !this.ws) {
      return;
    }

    const closeMessage = ['CLOSE', subscriptionId];
    this.ws.send(JSON.stringify(closeMessage));
  }

  /**
   * Handle incoming WebSocket message
   * Security: A08:2021 - Software and data integrity (validates JSON structure)
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      if (!Array.isArray(message) || message.length === 0) {
        throw new SigilError(
          'Invalid message format: must be non-empty array',
          'INVALID_MESSAGE',
          'nostr-relay'
        );
      }

      const [messageType, ...args] = message;

      switch (messageType) {
        case 'EVENT':
          this.handleEventMessage(args);
          break;
        case 'EOSE':
          this.handleEoseMessage(args);
          break;
        case 'OK':
          this.handleOkMessage(args);
          break;
        case 'NOTICE':
          this.handleNoticeMessage(args);
          break;
        default:
          // Unknown message type - emit as error event instead of logging to console
          this.emit(
            'error',
            new SigilError(
              `Unknown message type: ${messageType}`,
              'UNKNOWN_MESSAGE_TYPE',
              'nostr-relay'
            )
          );
      }
    } catch (error) {
      if (error instanceof SigilError) {
        this.emit('error', error);
      } else {
        const sigilError = new SigilError(
          `Message parsing error: ${error}`,
          'INVALID_MESSAGE',
          'nostr-relay'
        );
        this.emit('error', sigilError);
      }
      // Connection remains open - continue processing messages
    }
  }

  /**
   * Handle EVENT message
   * Format: ["EVENT", <subscription_id>, <event>]
   */
  private handleEventMessage(args: unknown[]): void {
    if (args.length !== 2) {
      throw new SigilError('Invalid EVENT message format', 'INVALID_MESSAGE', 'nostr-relay');
    }

    const [subscriptionId, event] = args;

    if (typeof subscriptionId !== 'string') {
      throw new SigilError(
        'EVENT subscription_id must be string',
        'INVALID_MESSAGE',
        'nostr-relay'
      );
    }

    // Validate event structure (Security: A08:2021)
    this.validateEvent(event);

    const nostrEvent = event as NostrEvent;

    // Route to subscription handler
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      try {
        sub.handler(nostrEvent);
      } catch (error) {
        // Security: Error in handler should NOT crash client or affect other subscriptions
        // Emit error event instead of logging to console for proper error handling
        this.emit(
          'error',
          new SigilError(
            `Error in subscription handler ${subscriptionId}: ${error}`,
            'HANDLER_ERROR',
            'nostr-relay'
          )
        );
      }
    }

    // Check for action confirmation (kind 30078)
    if (nostrEvent.kind === 30078) {
      this.handleActionConfirmation(nostrEvent);
    }
  }

  /**
   * Validate event structure
   * Security: A08:2021 - Data integrity validation
   */
  private validateEvent(event: unknown): void {
    if (typeof event !== 'object' || event === null) {
      throw new SigilError('Event must be object', 'INVALID_MESSAGE', 'nostr-relay');
    }

    const e = event as Record<string, unknown>;
    const requiredFields = ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig'];

    for (const field of requiredFields) {
      if (!(field in e)) {
        throw new SigilError(
          `Event missing required field: ${field}`,
          'INVALID_MESSAGE',
          'nostr-relay'
        );
      }
    }

    // Type checks
    if (typeof e.id !== 'string') {
      throw new SigilError('Event id must be string', 'INVALID_MESSAGE', 'nostr-relay');
    }
    if (typeof e.pubkey !== 'string') {
      throw new SigilError('Event pubkey must be string', 'INVALID_MESSAGE', 'nostr-relay');
    }
    if (typeof e.created_at !== 'number') {
      throw new SigilError('Event created_at must be number', 'INVALID_MESSAGE', 'nostr-relay');
    }
    if (typeof e.kind !== 'number') {
      throw new SigilError('Event kind must be number', 'INVALID_MESSAGE', 'nostr-relay');
    }
    if (!Array.isArray(e.tags)) {
      throw new SigilError('Event tags must be array', 'INVALID_MESSAGE', 'nostr-relay');
    }
    if (typeof e.content !== 'string') {
      throw new SigilError('Event content must be string', 'INVALID_MESSAGE', 'nostr-relay');
    }
    if (typeof e.sig !== 'string') {
      throw new SigilError('Event sig must be string', 'INVALID_MESSAGE', 'nostr-relay');
    }
  }

  /**
   * Handle EOSE (End of Stored Events) message
   * Format: ["EOSE", <subscription_id>]
   */
  private handleEoseMessage(args: unknown[]): void {
    if (args.length !== 1) {
      throw new SigilError('Invalid EOSE message format', 'INVALID_MESSAGE', 'nostr-relay');
    }

    const [subscriptionId] = args;

    if (typeof subscriptionId !== 'string') {
      throw new SigilError('EOSE subscription_id must be string', 'INVALID_MESSAGE', 'nostr-relay');
    }

    this.emit('eose', subscriptionId);
  }

  /**
   * Handle OK message (for future Story 2.3 - event publishing)
   * Format: ["OK", <event_id>, <true|false>, <message>]
   */
  private handleOkMessage(args: unknown[]): void {
    if (args.length !== 3) {
      throw new SigilError('Invalid OK message format', 'INVALID_MESSAGE', 'nostr-relay');
    }

    const [eventId, success, message] = args;

    if (typeof eventId !== 'string') {
      throw new SigilError('OK event_id must be string', 'INVALID_MESSAGE', 'nostr-relay');
    }
    if (typeof success !== 'boolean') {
      throw new SigilError('OK success must be boolean', 'INVALID_MESSAGE', 'nostr-relay');
    }
    if (typeof message !== 'string') {
      throw new SigilError('OK message must be string', 'INVALID_MESSAGE', 'nostr-relay');
    }

    this.emit('publishResult', { eventId, success, message });
  }

  /**
   * Handle NOTICE message
   * Format: ["NOTICE", <message>]
   * Security: A09:2021 - Rate limit NOTICE events to prevent DoS
   */
  private handleNoticeMessage(args: unknown[]): void {
    if (args.length !== 1) {
      throw new SigilError('Invalid NOTICE message format', 'INVALID_MESSAGE', 'nostr-relay');
    }

    const [message] = args;

    if (typeof message !== 'string') {
      throw new SigilError('NOTICE message must be string', 'INVALID_MESSAGE', 'nostr-relay');
    }

    // Rate limit NOTICE events (max 10/minute)
    const now = Date.now();
    const recentNotices = Array.from(this.noticeRateLimiter.values()).filter(
      (timestamp) => now - timestamp < this.NOTICE_RATE_LIMIT_MS
    );

    if (recentNotices.length >= this.MAX_NOTICES_PER_MINUTE) {
      // Drop excess NOTICE events silently
      return;
    }

    this.noticeRateLimiter.set(message, now);
    this.emit('notice', message);

    // Clean up old entries
    for (const [msg, timestamp] of this.noticeRateLimiter.entries()) {
      if (now - timestamp > this.NOTICE_RATE_LIMIT_MS) {
        this.noticeRateLimiter.delete(msg);
      }
    }
  }

  /**
   * Handle action confirmation (kind 30078 events)
   *
   * Parses ILP packet from event content and emits actionConfirmed event.
   */
  private handleActionConfirmation(event: NostrEvent): void {
    try {
      const ilpPacket = this.parseILPPacket(event);
      if (ilpPacket) {
        const confirmation: ActionConfirmation = {
          eventId: event.id,
          reducer: ilpPacket.reducer,
          args: ilpPacket.args,
          fee: ilpPacket.fee,
          pubkey: event.pubkey,
          timestamp: event.created_at,
        };
        this.emit('actionConfirmed', confirmation);
      }
    } catch (error) {
      // Log warning but don't crash - malformed ILP packets are non-fatal
      // Emit as warning event instead of console.warn for proper error handling
      this.emit(
        'error',
        new SigilError(
          `Failed to parse ILP packet from event ${event.id}: ${error}`,
          'ILP_PARSE_ERROR',
          'nostr-relay'
        )
      );
    }
  }

  /**
   * Parse ILP packet from kind 30078 event content
   *
   * @param event - Nostr event (kind 30078)
   * @returns Parsed ILP packet or null if invalid
   */
  private parseILPPacket(event: NostrEvent): ILPPacket | null {
    if (event.kind !== 30078) {
      return null;
    }

    try {
      const packet = JSON.parse(event.content) as ILPPacket;

      // Validate required fields
      if (
        typeof packet.reducer !== 'string' ||
        packet.args === undefined ||
        typeof packet.fee !== 'number'
      ) {
        // Invalid packet structure - no logging needed (already handled in catch)
        return null;
      }

      return packet;
    } catch {
      // Failed to parse JSON - no logging needed (handled by catch in handleActionConfirmation)
      return null;
    }
  }

  /**
   * Dispose client and clean up resources
   */
  dispose(): void {
    this.disconnect();
    this.removeAllListeners();
  }
}
