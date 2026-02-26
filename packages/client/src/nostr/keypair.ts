/**
 * Nostr Keypair Management
 *
 * Provides functions for generating, importing, and exporting Nostr keypairs.
 * Nostr keypairs are Sigil's sole identity mechanism.
 *
 * SECURITY WARNING: Private keys must NEVER be logged, transmitted over network,
 * or stored in plaintext. Use storage.ts for encrypted persistence.
 */

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/**
 * Nostr keypair structure
 *
 * Both keys are always 32-byte Uint8Arrays. Use exportKeypair() to get
 * hex or bech32 string encodings.
 */
export interface NostrKeypair {
  privateKey: Uint8Array; // 32 bytes
  publicKey: Uint8Array; // 32 bytes
}

/**
 * Exported keypair with all encoding formats
 */
export interface ExportedKeypair {
  privateKey: {
    nsec: string; // bech32 encoded
    hex: string; // 64-character hex string
  };
  publicKey: {
    npub: string; // bech32 encoded
    hex: string; // 64-character hex string
  };
}

/**
 * Generate a new Nostr keypair
 *
 * Uses cryptographically secure randomness to generate a new private key
 * and derives the corresponding public key.
 *
 * @returns Promise resolving to a new NostrKeypair
 *
 * @example
 * ```typescript
 * const keypair = await generateKeypair();
 * // Use keypair.publicKey for operations
 * // NEVER log private keys!
 * ```
 */
export async function generateKeypair(): Promise<NostrKeypair> {
  const privateKey = generateSecretKey(); // Uint8Array (32 bytes)
  const publicKeyHex = getPublicKey(privateKey); // hex string
  const publicKey = hexToBytes(publicKeyHex); // Convert to Uint8Array

  return {
    privateKey,
    publicKey,
  };
}

/**
 * Import a private key from hex or nsec format
 *
 * Validates the key format and derives the corresponding public key.
 *
 * @param key - Private key in hex (64 chars) or nsec (bech32) format
 * @param format - Key format: 'hex' or 'nsec'
 * @returns Promise resolving to NostrKeypair
 * @throws Error if key is invalid or wrong format
 *
 * @example
 * ```typescript
 * // Import from hex
 * const keypair1 = await importPrivateKey('0a1b2c...', 'hex');
 *
 * // Import from nsec
 * const keypair2 = await importPrivateKey('nsec1...', 'nsec');
 * ```
 */
export async function importPrivateKey(key: string, format: 'hex' | 'nsec'): Promise<NostrKeypair> {
  let privateKey: Uint8Array;

  if (format === 'hex') {
    // Validate hex format
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error('Invalid hex private key: must be 64 characters');
    }
    privateKey = hexToBytes(key);
  } else if (format === 'nsec') {
    // Decode nsec format
    try {
      const decoded = nip19.decode(key);
      if (decoded.type !== 'nsec') {
        throw new Error(`Invalid key type: expected nsec, got ${decoded.type}`);
      }
      privateKey = decoded.data as Uint8Array;
    } catch (error) {
      throw new Error(
        `Invalid nsec private key: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    throw new Error(`Invalid format: ${format}`);
  }

  // Derive public key
  const publicKeyHex = getPublicKey(privateKey);
  const publicKey = hexToBytes(publicKeyHex);

  return {
    privateKey,
    publicKey,
  };
}

/**
 * Import keypair from BIP-39 seed phrase
 *
 * Derives a deterministic Nostr keypair from a BIP-39 mnemonic.
 * The same seed phrase will always produce the same keypair.
 *
 * @param seedPhrase - BIP-39 seed phrase (24 words)
 * @returns Promise resolving to NostrKeypair
 * @throws Error if seed phrase is invalid
 *
 * @example
 * ```typescript
 * const phrase = 'abandon abandon abandon ... art';
 * const keypair = await importFromSeedPhrase(phrase);
 * ```
 */
export async function importFromSeedPhrase(seedPhrase: string): Promise<NostrKeypair> {
  // Normalize whitespace
  const normalized = seedPhrase.trim().replace(/\s+/g, ' ');
  const words = normalized.split(' ');

  // Validate word count (avoid revealing exact expected count to attackers)
  if (words.length !== 24) {
    throw new Error('Invalid seed phrase: incorrect format or word count');
  }

  // Validate mnemonic using BIP-39 word list and checksum
  if (!validateMnemonic(normalized, wordlist)) {
    // Check if invalid words or bad checksum
    const allWordsValid = words.every((word) => wordlist.includes(word));
    if (!allWordsValid) {
      throw new Error('Invalid seed phrase: contains invalid words');
    } else {
      throw new Error('Invalid seed phrase: bad checksum');
    }
  }

  // Derive seed from mnemonic
  const seed = mnemonicToSeedSync(normalized, ''); // 64 bytes

  // Use first 32 bytes as Nostr private key
  if (seed.length < 32) {
    throw new Error('Derived seed is too short (expected at least 32 bytes)');
  }
  const privateKey = seed.slice(0, 32);

  // Derive public key
  const publicKeyHex = getPublicKey(privateKey);
  const publicKey = hexToBytes(publicKeyHex);

  return {
    privateKey,
    publicKey,
  };
}

/**
 * Export keypair in all supported formats
 *
 * SECURITY WARNING: Never share private keys. This function is for backup only.
 * Store the exported keys in a secure location (encrypted, offline storage).
 *
 * @param keypair - NostrKeypair to export
 * @returns ExportedKeypair with all encoding formats
 *
 * @example
 * ```typescript
 * const keypair = await generateKeypair();
 * const exported = exportKeypair(keypair);
 * // Store exported keys securely (encrypted backup only)
 * // Public key can be shared: exported.publicKey.npub
 * ```
 */
export function exportKeypair(keypair: NostrKeypair): ExportedKeypair {
  // Convert public key to hex string for encoding
  const publicKeyHex = bytesToHex(keypair.publicKey);

  return {
    privateKey: {
      nsec: nip19.nsecEncode(keypair.privateKey),
      hex: bytesToHex(keypair.privateKey),
    },
    publicKey: {
      npub: nip19.npubEncode(publicKeyHex),
      hex: publicKeyHex,
    },
  };
}
