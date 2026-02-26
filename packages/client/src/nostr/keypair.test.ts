/**
 * Unit tests for Nostr keypair generation, import, and export
 *
 * TDD RED PHASE: These tests define expected behavior.
 * They will FAIL until implementation is complete (intentional).
 */

import { describe, it, expect } from 'vitest';
import { generateKeypair, importPrivateKey, importFromSeedPhrase, exportKeypair } from './keypair';
import {
  createValidHexPrivateKey,
  createValidNsecPrivateKey,
  createValid24WordSeedPhrase,
  createInvalidSeedPhrase,
} from './test-utils/keypair.factory';

describe('generateKeypair', () => {
  it('should return valid 32-byte Nostr keypair', async () => {
    // Given: No existing keypair
    // When: Generate new keypair
    const keypair = await generateKeypair();

    // Then: Keypair has correct structure and byte length
    expect(keypair).toBeDefined();
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.privateKey.length).toBe(32);
    expect(keypair.publicKey.length).toBe(32);
  });

  it('should return unique keypairs on each call', async () => {
    // Given: No existing keypair
    // When: Generate two keypairs
    const keypair1 = await generateKeypair();
    const keypair2 = await generateKeypair();

    // Then: Keypairs are different (cryptographically secure randomness)
    const key1Hex = Buffer.from(keypair1.privateKey).toString('hex');
    const key2Hex = Buffer.from(keypair2.privateKey).toString('hex');
    expect(key1Hex).not.toBe(key2Hex);
  });
});

describe('importPrivateKey', () => {
  it('should import valid hex private key (64 chars)', async () => {
    // Given: Valid 64-character hex private key
    const hexKey = createValidHexPrivateKey();

    // When: Import with hex format
    const keypair = await importPrivateKey(hexKey, 'hex');

    // Then: Keypair has valid structure
    expect(keypair).toBeDefined();
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.privateKey.length).toBe(32);
    expect(keypair.publicKey.length).toBe(32);
  });

  it('should import valid nsec format private key', async () => {
    // Given: Valid nsec-encoded private key
    const nsecKey = createValidNsecPrivateKey();

    // When: Import with nsec format
    const keypair = await importPrivateKey(nsecKey, 'nsec');

    // Then: Keypair has valid structure
    expect(keypair).toBeDefined();
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.privateKey.length).toBe(32);
  });

  it('should throw error for invalid hex length', async () => {
    // Given: Hex string with wrong length (not 64 chars)
    const invalidHex = '0'.repeat(32); // Only 32 chars instead of 64

    // When/Then: Import rejects with clear error
    await expect(importPrivateKey(invalidHex, 'hex')).rejects.toThrow(
      'Invalid hex private key: must be 64 characters'
    );
  });

  it('should throw error for invalid nsec encoding', async () => {
    // Given: Malformed nsec string
    const invalidNsec = 'nsec1invalid';

    // When/Then: Import rejects with clear error
    await expect(importPrivateKey(invalidNsec, 'nsec')).rejects.toThrow();
  });

  it('should throw error when nsec decodes to wrong type', async () => {
    // Given: Valid npub (public key) incorrectly passed as private key
    const npubNotNsec = 'npub1gg8jda85nkxkg0yxx9tngdt0camwuwqhfvxw7v2v85tf27xqvsyqgxgna7';

    // When/Then: Import rejects with clear error
    await expect(importPrivateKey(npubNotNsec, 'nsec')).rejects.toThrow(/Invalid/);
  });
});

describe('importFromSeedPhrase', () => {
  it('should derive keypair from valid 24-word BIP-39 phrase', async () => {
    // Given: Valid 24-word BIP-39 seed phrase
    const seedPhrase = createValid24WordSeedPhrase();

    // When: Import from seed phrase
    const keypair = await importFromSeedPhrase(seedPhrase);

    // Then: Keypair has valid structure
    expect(keypair).toBeDefined();
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.privateKey.length).toBe(32);
    expect(keypair.publicKey.length).toBe(32);
  });

  it('should derive same keypair for same seed (deterministic)', async () => {
    // Given: Same seed phrase used twice
    const seedPhrase = createValid24WordSeedPhrase();

    // When: Import twice
    const keypair1 = await importFromSeedPhrase(seedPhrase);
    const keypair2 = await importFromSeedPhrase(seedPhrase);

    // Then: Derived keypairs are identical (deterministic)
    const key1Hex = Buffer.from(keypair1.privateKey).toString('hex');
    const key2Hex = Buffer.from(keypair2.privateKey).toString('hex');
    expect(key1Hex).toBe(key2Hex);
  });

  it('should throw error for invalid word count (not 24)', async () => {
    // Given: Seed phrase with wrong word count (12 instead of 24)
    const invalidSeed = createInvalidSeedPhrase('wrong-word-count');

    // When/Then: Import rejects with clear error
    await expect(importFromSeedPhrase(invalidSeed)).rejects.toThrow(
      /incorrect format or word count/
    );
  });

  it('should throw error for invalid BIP-39 words', async () => {
    // Given: Seed phrase with invalid words (not in BIP-39 word list)
    const invalidSeed = createInvalidSeedPhrase('invalid-words');

    // When/Then: Import rejects with clear error
    await expect(importFromSeedPhrase(invalidSeed)).rejects.toThrow(/invalid words/);
  });

  it('should throw error for bad BIP-39 checksum', async () => {
    // Given: Seed phrase with invalid checksum
    const invalidSeed = createInvalidSeedPhrase('bad-checksum');

    // When/Then: Import rejects with clear error
    await expect(importFromSeedPhrase(invalidSeed)).rejects.toThrow(/checksum/);
  });
});

describe('exportKeypair', () => {
  it('should return all four formats (nsec, hex private, npub, hex public)', async () => {
    // Given: Valid keypair
    const keypair = await generateKeypair();

    // When: Export keypair
    const exported = exportKeypair(keypair);

    // Then: All four formats present
    expect(exported.privateKey.nsec).toBeDefined();
    expect(exported.privateKey.hex).toBeDefined();
    expect(exported.publicKey.npub).toBeDefined();
    expect(exported.publicKey.hex).toBeDefined();
    expect(typeof exported.privateKey.nsec).toBe('string');
    expect(typeof exported.privateKey.hex).toBe('string');
    expect(typeof exported.publicKey.npub).toBe('string');
    expect(typeof exported.publicKey.hex).toBe('string');
  });

  it('should encode nsec and npub correctly (bech32)', async () => {
    // Given: Valid keypair
    const keypair = await generateKeypair();

    // When: Export keypair
    const exported = exportKeypair(keypair);

    // Then: Bech32 encoding follows Nostr NIP-19 spec
    expect(exported.privateKey.nsec).toMatch(/^nsec1[a-z0-9]+$/);
    expect(exported.publicKey.npub).toMatch(/^npub1[a-z0-9]+$/);
  });

  it('should encode hex formats correctly (64 chars lowercase)', async () => {
    // Given: Valid keypair
    const keypair = await generateKeypair();

    // When: Export keypair
    const exported = exportKeypair(keypair);

    // Then: Hex encoding is lowercase and correct length
    expect(exported.privateKey.hex).toMatch(/^[0-9a-f]{64}$/);
    expect(exported.publicKey.hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('exported private key should re-import successfully (roundtrip)', async () => {
    // Given: Generated and exported keypair
    const original = await generateKeypair();
    const exported = exportKeypair(original);

    // When: Re-import exported hex key
    const reimported = await importPrivateKey(exported.privateKey.hex, 'hex');

    // Then: Reimported keypair matches original
    const originalHex = Buffer.from(original.privateKey).toString('hex');
    const reimportedHex = Buffer.from(reimported.privateKey).toString('hex');
    expect(reimportedHex).toBe(originalHex);
  });
});
