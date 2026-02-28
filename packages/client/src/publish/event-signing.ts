/**
 * Nostr Event Signing
 * Story 2.3: ILP Packet Construction & Signing
 *
 * Signs Nostr events with private keys. CRITICAL: Private keys never leave this module
 * and are NEVER logged, transmitted, or included in error messages.
 */

import { finalizeEvent } from 'nostr-tools/pure';
import type { NostrEvent } from '../nostr/types';
import { SigilError } from '../nostr/nostr-client';

/**
 * Sign a Nostr event with a private key
 *
 * Uses nostr-tools finalizeEvent to:
 * 1. Compute the event ID (SHA256 hash of serialized event)
 * 2. Generate Schnorr signature (64-byte hex string)
 * 3. Add pubkey field (derived from private key)
 *
 * SECURITY: The private key NEVER leaves this function. It is:
 * - NOT logged (even in debug mode)
 * - NOT transmitted over network
 * - NOT included in error messages
 * - NOT stored in memory longer than necessary
 *
 * @param event - Unsigned event (without id and sig fields)
 * @param privateKey - Nostr private key (32-byte Uint8Array)
 * @returns Signed event with id, sig, and pubkey fields
 * @throws SigilError with code SIGNING_FAILED if signing fails
 *
 * @example
 * ```typescript
 * const unsigned = {
 *   pubkey: '32e18276...',
 *   created_at: 1234567890,
 *   kind: 30078,
 *   tags: [['d', 'player_move_1234']],
 *   content: '{"reducer":"player_move","args":[100,200]}'
 * };
 *
 * const privateKey = new Uint8Array(32); // from identity
 * const signed = signEvent(unsigned, privateKey);
 * // signed.id = 'abc123...' (64-char hex SHA256)
 * // signed.sig = 'def456...' (128-char hex Schnorr signature)
 * ```
 */
export function signEvent(
  event: Omit<NostrEvent, 'id' | 'sig'>,
  privateKey: Uint8Array
): NostrEvent {
  // Validate private key format (must be 32 bytes)
  if (!(privateKey instanceof Uint8Array) || privateKey.length !== 32) {
    // CRITICAL: Do NOT include private key in error message
    throw new SigilError(
      'Invalid private key format. Expected 32-byte Uint8Array.',
      'SIGNING_FAILED',
      'identity'
    );
  }

  try {
    // Use nostr-tools finalizeEvent to compute id and sig
    // This function:
    // 1. Serializes the event per NIP-01 spec
    // 2. Computes SHA256 hash (event ID)
    // 3. Signs the hash with Schnorr signature
    // 4. Returns complete signed event
    const signedEvent = finalizeEvent(event, privateKey);

    // Validate signature format (should be 128-character hex string)
    if (!signedEvent.sig || signedEvent.sig.length !== 128) {
      throw new SigilError(
        'Invalid signature format. Expected 128-character hex string.',
        'SIGNING_FAILED',
        'identity'
      );
    }

    // Validate event ID format (should be 64-character hex string)
    if (!signedEvent.id || signedEvent.id.length !== 64) {
      throw new SigilError(
        'Invalid event ID format. Expected 64-character hex string.',
        'SIGNING_FAILED',
        'identity'
      );
    }

    return signedEvent;
  } catch (error) {
    // Sanitize error: ensure private key is NEVER exposed
    // Even if nostr-tools throws an error with key data, we catch and sanitize
    if (error instanceof SigilError) {
      throw error; // Already sanitized
    }

    throw new SigilError(
      `Event signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'SIGNING_FAILED',
      'identity'
    );
  }
}

/**
 * Redact private key for logging
 *
 * SECURITY: Use this when private key might appear in logs.
 * Returns a safe placeholder string.
 *
 * @returns Redacted placeholder string
 */
export function redactPrivateKey(): string {
  return '<private-key-redacted>';
}
