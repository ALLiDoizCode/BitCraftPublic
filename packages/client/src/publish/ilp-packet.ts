/**
 * ILP Packet Construction
 * Story 2.3 (original), Story 2.5 (simplified)
 *
 * Constructs content-only event templates for kind 30078 ILP packets.
 * After Story 2.5, constructILPPacket returns only { kind, content, tags }.
 * CrosstownClient fills in pubkey, created_at, id, and sig from its secretKey.
 */

import type { NostrEvent } from '../nostr/types';
import { SigilError } from '../nostr/nostr-client';
import type { UnsignedEventTemplate } from '../crosstown/crosstown-adapter';

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
 * Construct an unsigned event template for a kind 30078 ILP packet
 *
 * Creates a content-only event template with kind, content, and tags.
 * CrosstownClient fills in pubkey, created_at, id, and sig from its secretKey.
 *
 * NOTE: Function name preserved for public API stability (Implementation Constraint 5).
 *
 * @param options - Reducer and args for the game action
 * @param fee - ILP cost for this action (from cost registry)
 * @returns Unsigned event template with kind, content, and tags only
 * @throws SigilError with code INVALID_ACTION if validation fails
 *
 * @example
 * ```typescript
 * const template = constructILPPacket(
 *   { reducer: 'player_move', args: [100, 200] },
 *   1
 * );
 * // template.kind = 30078
 * // template.content = '{"reducer":"player_move","args":[100,200]}'
 * // template.tags = [['d', 'player_move_...'], ['fee', '1']]
 * // No pubkey, created_at, id, or sig -- CrosstownClient adds those
 * ```
 */
export function constructILPPacket(
  options: ILPPacketOptions,
  fee: number
): UnsignedEventTemplate {
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

  // Construct content-only template for kind 30078 (NIP-78: Application-specific Data)
  // CrosstownClient fills in pubkey, created_at, id, and sig from its secretKey
  const template: UnsignedEventTemplate = {
    kind: 30078,
    tags: [
      // NIP-33: Parameterized replaceable events require a 'd' tag
      ['d', `${options.reducer}_${Date.now()}`],
      // Fee tag for relay filtering
      ['fee', fee.toString()],
    ],
    content: contentJson,
  };

  return template;
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
 */
export function extractFeeFromEvent(event: NostrEvent): number {
  const feeTag = event.tags.find((tag) => tag[0] === 'fee');
  if (!feeTag || !feeTag[1]) {
    return 0;
  }

  const fee = parseFloat(feeTag[1]);
  return Number.isFinite(fee) && fee >= 0 ? fee : 0;
}
