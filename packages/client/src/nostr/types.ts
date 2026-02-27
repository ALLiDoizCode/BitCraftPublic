/**
 * Nostr Client Types
 * Story 2.1: Crosstown Relay Connection & Event Subscriptions
 *
 * Implements NIP-01 compliant types for Nostr relay communication.
 */

/**
 * Nostr Event (NIP-01)
 *
 * Represents a signed Nostr event with all required fields.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/01.md
 */
export interface NostrEvent {
  /** 32-byte lowercase hex SHA256 of serialized event */
  id: string;
  /** 32-byte lowercase hex public key (author) */
  pubkey: string;
  /** Unix timestamp in seconds */
  created_at: number;
  /** Event type (0-65535) */
  kind: number;
  /** Array of tag arrays (e.g., [["d", "value"], ["e", "event_id"]]) */
  tags: string[][];
  /** Arbitrary string payload */
  content: string;
  /** 64-byte Schnorr signature */
  sig: string;
}

/**
 * Nostr Filter (NIP-01)
 *
 * Used in REQ messages to subscribe to events matching filter criteria.
 * All fields are optional. Fields within a filter are ANDed together.
 * Multiple filters in a REQ message are ORed together.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/01.md
 */
export interface Filter {
  /** Event IDs to match */
  ids?: string[];
  /** Author public keys to match */
  authors?: string[];
  /** Event kinds to match */
  kinds?: number[];
  /** Timestamp lower bound (inclusive) */
  since?: number;
  /** Timestamp upper bound (inclusive) */
  until?: number;
  /** Maximum number of events to return */
  limit?: number;
  /** Match events with 'e' tag containing these event IDs */
  '#e'?: string[];
  /** Match events with 'p' tag containing these pubkeys */
  '#p'?: string[];
  /** Match events with 'd' tag containing these identifiers */
  '#d'?: string[];
}

/**
 * Subscription interface
 *
 * Returned by NostrClient.subscribe(). Provides control over active subscriptions.
 */
export interface Subscription {
  /** Unique subscription ID (generated via crypto.randomUUID()) */
  id: string;
  /** Filters used for this subscription */
  filters: Filter[];
  /** Unsubscribe from relay (sends CLOSE message) */
  unsubscribe(): void;
}

/**
 * ILP Packet (Sigil-Specific)
 *
 * Payload structure for kind 30078 events.
 * The content field of a kind 30078 Nostr event contains JSON-serialized ILP packet.
 *
 * @example
 * ```typescript
 * const ilpPacket: ILPPacket = {
 *   reducer: 'player_move',
 *   args: [100, 200],
 *   fee: 1000,
 *   timestamp: Math.floor(Date.now() / 1000),
 *   nonce: crypto.randomUUID()
 * };
 * ```
 */
export interface ILPPacket {
  /** SpacetimeDB reducer name */
  reducer: string;
  /** Reducer arguments (JSON-serializable) */
  args: unknown;
  /** ILP cost in smallest unit (e.g., satoshis) */
  fee: number;
  /** Optional Unix timestamp (seconds) */
  timestamp?: number;
  /** Optional nonce for idempotency */
  nonce?: string;
}

/**
 * Action Confirmation Event
 *
 * Emitted when a kind 30078 action confirmation event is received from relay.
 */
export interface ActionConfirmation {
  /** Nostr event ID */
  eventId: string;
  /** SpacetimeDB reducer name */
  reducer: string;
  /** Reducer arguments */
  args: unknown;
  /** ILP fee paid */
  fee: number;
  /** Author public key (hex) */
  pubkey: string;
  /** Event timestamp (Unix seconds) */
  timestamp: number;
}

/**
 * Nostr Relay Connection Options
 */
export interface NostrRelayOptions {
  /** Relay WebSocket URL (default: ws://localhost:4040) */
  url?: string;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 10, 0 for infinite) */
  maxReconnectAttempts?: number;
  /** Initial reconnection delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  maxDelay?: number;
  /** Jitter percentage for backoff (default: 10) */
  jitterPercent?: number;
}

/**
 * Connection state
 */
export type NostrConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

/**
 * Connection change event
 */
export interface NostrConnectionChangeEvent {
  state: NostrConnectionState;
  /** Attempt number (for reconnecting state) */
  attemptNumber?: number;
  /** Next attempt delay in ms (for reconnecting state) */
  nextAttemptDelay?: number;
  /** Reason for disconnection/failure */
  reason?: string;
  /** Error object (if applicable) */
  error?: Error;
}
