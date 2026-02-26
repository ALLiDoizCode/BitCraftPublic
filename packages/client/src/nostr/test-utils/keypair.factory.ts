/**
 * Test data factories for Nostr keypair testing
 *
 * Provides mock data generation for unit and integration tests.
 * Uses deterministic values for test stability.
 */

import type { NostrKeypair } from '../keypair';

/**
 * Create a mock Nostr keypair for testing
 *
 * @param overrides - Optional overrides for privateKey or publicKey
 * @returns Mock NostrKeypair with valid structure
 */
export function createMockKeypair(overrides: Partial<NostrKeypair> = {}): NostrKeypair {
  const defaultPrivateKey = new Uint8Array(32).fill(1); // Deterministic test key
  const defaultPublicKey = new Uint8Array(32).fill(2); // Deterministic test key

  return {
    privateKey: defaultPrivateKey,
    publicKey: defaultPublicKey,
    ...overrides,
  };
}

/**
 * Generate a valid 64-character hex private key for testing
 *
 * @returns Valid hex string (64 chars, lowercase)
 */
export function createValidHexPrivateKey(): string {
  // Use a deterministic valid private key (cannot be all zeros)
  // This is a known valid test key
  return '0000000000000000000000000000000000000000000000000000000000000001';
}

/**
 * Generate a valid nsec-encoded private key for testing
 *
 * @returns Valid nsec string (bech32 format)
 */
export function createValidNsecPrivateKey(): string {
  // Use known valid nsec encoding for deterministic test key
  // This corresponds to hex: 0000000000000000000000000000000000000000000000000000000000000001
  return 'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgl';
}

/**
 * Generate a valid BIP-39 24-word seed phrase for testing
 *
 * @returns Valid 24-word BIP-39 phrase
 */
export function createValid24WordSeedPhrase(): string {
  // This is a valid BIP-39 test mnemonic
  const words = [
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'art',
  ];
  return words.join(' ');
}

/**
 * Generate invalid seed phrases for error testing
 *
 * @param type - Type of invalid phrase to generate
 * @returns Invalid seed phrase string
 */
export function createInvalidSeedPhrase(
  type: 'wrong-word-count' | 'invalid-words' | 'bad-checksum'
): string {
  switch (type) {
    case 'wrong-word-count':
      // Only 12 words instead of 24
      return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    case 'invalid-words':
      // Contains non-BIP-39 words
      return 'invalidword notaword fakephrase '.repeat(8);
    case 'bad-checksum':
      // 24 words but invalid checksum (last word wrong)
      return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    default:
      return '';
  }
}
