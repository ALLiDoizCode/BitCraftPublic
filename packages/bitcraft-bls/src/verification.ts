/**
 * Verification Logging Module
 * Story 3.4: Identity Propagation & End-to-End Verification
 *
 * Provides observability into the SDK's verification pipeline.
 * The SDK handles actual Nostr signature verification (secp256k1 Schnorr);
 * this module adds logging context for Story 3.4's verification requirements.
 *
 * SECURITY (OWASP A02, A09):
 * - Never logs private keys, secret keys, or tokens
 * - Pubkey truncated in logs (8+4 chars) to limit exposure
 * - Logs event ID and verification result for audit trail
 *
 * @module verification
 */

import { truncatePubkey } from './utils.js';

/**
 * Configuration for verification logging behavior.
 */
export interface VerificationConfig {
  /** Whether to reject packets with invalid signatures (default: true in production) */
  rejectInvalidSignatures: boolean;
  /** Whether to log rejection events (default: true) */
  logRejections: boolean;
}

/** Default verification config: log all events. */
const DEFAULT_CONFIG: VerificationConfig = {
  rejectInvalidSignatures: true,
  logRejections: true,
};

/**
 * Log a verification event (signature verified or rejected by the SDK pipeline).
 *
 * @param eventId - The Nostr event ID
 * @param pubkey - The claimed pubkey (will be truncated in logs)
 * @param verified - Whether the SDK's verification pipeline accepted the signature
 * @param config - Optional verification config (defaults to logging all events)
 */
export function logVerificationEvent(
  eventId: string,
  pubkey: string,
  verified: boolean,
  config: VerificationConfig = DEFAULT_CONFIG
): void {
  const truncated = truncatePubkey(pubkey);

  if (verified) {
    console.log(`[BLS] Signature verified | eventId: ${eventId} | pubkey: ${truncated}`);
  } else if (config.logRejections) {
    console.error(
      `[BLS] Signature rejected | eventId: ${eventId} | pubkey: ${truncated} | SDK rejected before handler invocation`
    );
  }
}
