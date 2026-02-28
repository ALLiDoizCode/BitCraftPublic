/**
 * ILP Packet Construction
 * Story 2.3: ILP Packet Construction & Signing
 *
 * Constructs kind 30078 Nostr events containing game action ILP packets.
 */

import type { NostrEvent } from '../nostr/types';
import { SigilError } from '../nostr/nostr-client';

/**
 * ILP packet options for publish() call
 *
 * Specifies the game action (reducer) and arguments to execute.
 */
export interface ILPPacketOptions {
  /** SpacetimeDB reducer name (e.g., "player_move") */
  reducer: string;
  /** Reducer arguments (JSON-serializable) */
  args: unknown;
}

/**
 * ILP packet result (confirmation details)
 *
 * Returned when a publish() call succeeds and confirmation is received.
 */
export interface ILPPacketResult {
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
 * Construct an unsigned ILP packet as a kind 30078 Nostr event
 *
 * Creates the event structure before signing. The event content contains
 * JSON-serialized reducer and args. The id and sig fields are empty strings
 * (will be filled by signing function).
 *
 * @param options - Reducer and args for the game action
 * @param fee - ILP cost for this action (from cost registry)
 * @param pubkey - User's Nostr public key (hex format, 64 characters)
 * @returns Unsigned Nostr event ready for signing
 * @throws SigilError with code INVALID_ACTION if validation fails
 *
 * @example
 * ```typescript
 * const unsignedEvent = constructILPPacket(
 *   { reducer: 'player_move', args: [100, 200] },
 *   1,
 *   '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245'
 * );
 * // unsignedEvent.content = '{"reducer":"player_move","args":[100,200]}'
 * ```
 */
export function constructILPPacket(
  options: ILPPacketOptions,
  fee: number,
  pubkey: string
): Omit<NostrEvent, 'id' | 'sig'> {
  // Validation: reducer must be non-empty string
  if (!options.reducer || typeof options.reducer !== 'string') {
    throw new SigilError('Reducer name must be a non-empty string', 'INVALID_ACTION', 'publish');
  }

  // Validation: reducer must be between 1 and 64 characters
  if (options.reducer.length < 1 || options.reducer.length > 64) {
    throw new SigilError(
      `Reducer name length must be between 1 and 64 characters. Got: ${options.reducer.length}`,
      'INVALID_ACTION',
      'publish'
    );
  }

  // Validation: reducer must match pattern (alphanumeric + underscore only)
  const reducerPattern = /^[a-zA-Z0-9_]+$/;
  if (!reducerPattern.test(options.reducer)) {
    throw new SigilError(
      `Reducer name contains invalid characters: '${options.reducer}'. Only alphanumeric and underscore allowed.`,
      'INVALID_ACTION',
      'publish'
    );
  }

  // Validation: pubkey must be valid 64-character hex string (ISSUE-2 fix)
  if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) {
    throw new SigilError(
      `Public key must be a 64-character hex string. Got: ${typeof pubkey === 'string' ? pubkey.substring(0, 16) + '...' : typeof pubkey}`,
      'INVALID_ACTION',
      'publish'
    );
  }

  // Validation: fee must be non-negative number
  if (typeof fee !== 'number' || fee < 0 || !Number.isFinite(fee)) {
    throw new SigilError(
      `Fee must be a non-negative finite number. Got: ${fee}`,
      'INVALID_ACTION',
      'publish'
    );
  }

  // Validation: args must be JSON-serializable
  let contentJson: string;
  try {
    contentJson = JSON.stringify({ reducer: options.reducer, args: options.args });
  } catch (error) {
    throw new SigilError(
      `Arguments must be JSON-serializable. Error: ${error instanceof Error ? error.message : String(error)}`,
      'INVALID_ACTION',
      'publish'
    );
  }

  // Construct kind 30078 Nostr event (NIP-78: Application-specific Data)
  // Kind 30078 is a parameterized replaceable event (NIP-33)
  const event: Omit<NostrEvent, 'id' | 'sig'> = {
    pubkey, // 64-character hex public key
    created_at: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
    kind: 30078, // NIP-78: Application-specific Data
    tags: [
      // NIP-33: Parameterized replaceable events require a 'd' tag
      // Use reducer name + timestamp as unique identifier
      ['d', `${options.reducer}_${Date.now()}`],
      // Add fee as a tag for easy relay filtering
      ['fee', fee.toString()],
    ],
    content: contentJson, // JSON-serialized { reducer, args }
  };

  return event;
}

/**
 * Parse ILP packet from kind 30078 Nostr event content
 *
 * Extracts reducer and args from event content JSON. This function is used
 * to decode confirmation events received from the Nostr relay.
 *
 * DESIGN NOTE: Returns null instead of throwing to allow graceful handling
 * of malformed events from untrusted relays. Consumers should check for null
 * and handle appropriately.
 *
 * @param event - Nostr event (kind 30078)
 * @returns Parsed ILP packet options or null if parsing fails
 *
 * @example
 * ```typescript
 * const event = {
 *   kind: 30078,
 *   content: '{"reducer":"player_move","args":[100,200]}',
 *   // ... other fields
 * };
 *
 * const packet = parseILPPacket(event);
 * if (packet) {
 *   console.log('Reducer:', packet.reducer); // 'player_move'
 *   console.log('Args:', packet.args); // [100, 200]
 * }
 * ```
 */
export function parseILPPacket(event: NostrEvent): ILPPacketOptions | null {
  try {
    const parsed = JSON.parse(event.content) as { reducer?: string; args?: unknown };

    if (!parsed.reducer || typeof parsed.reducer !== 'string') {
      return null;
    }

    return {
      reducer: parsed.reducer,
      args: parsed.args,
    };
  } catch {
    return null;
  }
}

/**
 * Extract fee from kind 30078 event tags
 *
 * Searches for the 'fee' tag in the event tags array and parses the fee value.
 * Returns 0 if the fee tag is not found or the value is invalid.
 *
 * @param event - Nostr event with fee tag
 * @returns Fee amount (non-negative number) or 0 if not found
 *
 * @example
 * ```typescript
 * const event = {
 *   kind: 30078,
 *   tags: [['fee', '10'], ['d', 'player_move_123']],
 *   // ... other fields
 * };
 *
 * const fee = extractFeeFromEvent(event); // Returns 10
 * ```
 *
 * @example
 * ```typescript
 * const eventWithoutFee = {
 *   kind: 30078,
 *   tags: [['d', 'player_move_123']],
 *   // ... other fields
 * };
 *
 * const fee = extractFeeFromEvent(eventWithoutFee); // Returns 0
 * ```
 */
export function extractFeeFromEvent(event: NostrEvent): number {
  const feeTag = event.tags.find((tag) => tag[0] === 'fee');
  if (!feeTag || !feeTag[1]) {
    return 0;
  }

  const fee = parseFloat(feeTag[1]);
  return Number.isFinite(fee) && fee >= 0 ? fee : 0;
}
