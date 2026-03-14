/**
 * Identity Chain Verification Module
 * Story 3.4: Identity Propagation & End-to-End Verification
 *
 * Verifies the cryptographic identity chain from SDK-verified pubkey
 * through handler identity prepend to SpacetimeDB reducer args.
 *
 * Defense-in-depth: The SDK's createVerificationPipeline is the PRIMARY
 * security gate (validates Nostr signatures). This module provides
 * SECONDARY validation of pubkey format and chain integrity.
 *
 * SECURITY (OWASP A01, A03):
 * - Validates pubkey as 64-char lowercase hex (prevents injection)
 * - Verifies identity chain consistency (prevents mis-attribution)
 * - Never logs private keys or tokens (OWASP A02)
 *
 * @module identity-chain
 */

import { truncatePubkey, PUBKEY_REGEX } from './utils.js';

/**
 * Result of identity chain verification.
 */
export interface IdentityChainResult {
  /** The verified pubkey (64-char lowercase hex) */
  pubkey: string;
  /** The reducer that was called */
  reducerCalled: string;
  /** Whether identity was successfully propagated to reducer args */
  identityPropagated: boolean;
  /** Whether the full chain is intact: pubkey matches first reducer arg */
  chainIntact: boolean;
}

/**
 * Error thrown when identity chain verification fails.
 * Follows the ContentParseError and FeeScheduleError pattern.
 */
export class IdentityChainError extends Error {
  /** Error code: 'IDENTITY_INVALID' or 'IDENTITY_MISMATCH' */
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'IdentityChainError';
    this.code = code;
  }
}

/**
 * Validate that a pubkey is a valid 64-char lowercase hex string.
 * Accepts `unknown` for runtime safety -- callers may pass non-string values
 * through type casts or untyped boundaries.
 *
 * @param pubkey - The pubkey to validate (accepts unknown for runtime defense-in-depth)
 * @throws {IdentityChainError} If pubkey format is invalid
 */
function validatePubkeyFormat(pubkey: unknown): void {
  if (typeof pubkey !== 'string' || pubkey.length !== 64) {
    throw new IdentityChainError(
      `Invalid identity: pubkey must be 64-char hex (got ${typeof pubkey === 'string' ? `${pubkey.length} chars` : typeof pubkey})`,
      'IDENTITY_INVALID'
    );
  }

  if (!PUBKEY_REGEX.test(pubkey)) {
    throw new IdentityChainError(
      `Invalid identity: pubkey contains non-hex characters (${truncatePubkey(pubkey)})`,
      'IDENTITY_INVALID'
    );
  }
}

/**
 * Verify the identity chain: ctx.pubkey must be valid and match argsWithIdentity[0].
 *
 * @param ctx - Object with pubkey field (from HandlerContext)
 * @param reducerName - The reducer being called
 * @param argsWithIdentity - The args array with pubkey prepended as first element
 * @returns IdentityChainResult on success
 * @throws {IdentityChainError} If pubkey is invalid or chain is broken
 */
export function verifyIdentityChain(
  ctx: { pubkey: string },
  reducerName: string,
  argsWithIdentity: unknown[]
): IdentityChainResult {
  // Validate pubkey format (64-char lowercase hex)
  validatePubkeyFormat(ctx.pubkey);

  // Verify chain integrity: first arg must match ctx.pubkey
  const firstArg = argsWithIdentity[0];
  if (firstArg !== ctx.pubkey) {
    throw new IdentityChainError(
      `Identity chain broken: ctx.pubkey (${truncatePubkey(ctx.pubkey)}) does not match first reducer arg (${typeof firstArg === 'string' ? truncatePubkey(firstArg) : String(firstArg)})`,
      'IDENTITY_MISMATCH'
    );
  }

  return {
    pubkey: ctx.pubkey,
    reducerCalled: reducerName,
    identityPropagated: true,
    chainIntact: true,
  };
}
