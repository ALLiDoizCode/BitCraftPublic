/**
 * Shared Utility Functions
 *
 * Common utility functions used across the BLS handler package.
 * Centralized to prevent code duplication and ensure consistency.
 *
 * @module utils
 */

/**
 * Regex for valid pubkey: exactly 64 lowercase hex characters (32 bytes).
 */
export const PUBKEY_REGEX = /^[0-9a-f]{64}$/;

/**
 * Truncate a pubkey for logging: first 8 + last 4 hex chars.
 * Example: "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"
 *       -> "32e18276...e245"
 *
 * Safely handles non-string inputs (converts to string first) to prevent
 * crashes in catch blocks when ctx.pubkey is malformed (NFR27: zero silent failures).
 *
 * SECURITY (OWASP A02): This truncation ensures full pubkeys are never
 * exposed in log aggregation systems.
 */
export function truncatePubkey(pubkey: unknown): string {
  const str = typeof pubkey === 'string' ? pubkey : String(pubkey ?? 'unknown');
  if (str.length <= 12) return str;
  return `${str.slice(0, 8)}...${str.slice(-4)}`;
}
