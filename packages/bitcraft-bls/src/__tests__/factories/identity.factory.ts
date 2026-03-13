/**
 * Identity Test Factory
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Factory functions for generating test Nostr keypairs, secret keys,
 * and BIP-39 mnemonics for BLS identity testing.
 */

/**
 * Generate a fixed test secret key hex (deterministic, for snapshot tests)
 */
export function createFixedTestSecretKeyHex(): string {
  return 'ab'.repeat(32); // 64 chars, deterministic
}

/**
 * Generate a fixed test secret key as Uint8Array
 */
export function createFixedTestSecretKeyBytes(): Uint8Array {
  return new Uint8Array(32).fill(0xab);
}

/**
 * Generate a valid BIP-39 mnemonic (12 words)
 * This is the standard test mnemonic used in many crypto projects.
 */
export function createTestMnemonic(): string {
  return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
}

/**
 * Create an invalid secret key hex (wrong length)
 */
export function createInvalidSecretKeyShort(): string {
  return 'ab'.repeat(16); // 32 chars, should be 64
}

/**
 * Create an invalid secret key hex (non-hex characters)
 */
export function createInvalidSecretKeyNonHex(): string {
  return 'zz'.repeat(32); // 64 chars but not valid hex
}
