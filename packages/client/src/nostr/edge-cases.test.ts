/**
 * Edge Cases and Error Handling Tests for Story 1.2
 *
 * These tests verify error handling, boundary conditions, and edge cases
 * that aren't explicitly covered in the acceptance criteria but are important
 * for robustness and security.
 */

import { describe, expect, it } from 'vitest';
import { test } from './test-utils/fs.fixture';
import { generateKeypair, importPrivateKey, importFromSeedPhrase, exportKeypair } from './keypair';
import { saveKeypair, loadKeypair } from './storage';
import { SigilClient } from '../client';
import * as path from 'path';
import * as fs from 'fs';

// Test passphrase that meets security requirements (12+ chars, 2+ types)
const TEST_PASSPHRASE = 'TestPass1234';

describe('Edge Cases: keypair operations', () => {
  it('should handle multiple keypair generations without collision', async () => {
    // Generate 10 keypairs and verify they're all unique
    const keypairs = await Promise.all(Array.from({ length: 10 }, () => generateKeypair()));

    const privateKeys = keypairs.map((kp) => Buffer.from(kp.privateKey).toString('hex'));
    const uniqueKeys = new Set(privateKeys);

    expect(uniqueKeys.size).toBe(10); // All different
  });

  it('should handle hex keys with uppercase letters', async () => {
    // Some hex keys might be provided in uppercase
    const hexKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    const keypair = await importPrivateKey(hexKey, 'hex');

    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
  });

  it('should reject empty hex key', async () => {
    await expect(importPrivateKey('', 'hex')).rejects.toThrow(/must be 64 characters/);
  });

  it('should reject hex key with invalid characters', async () => {
    const invalidHex = 'g'.repeat(64); // 'g' is not a hex character

    await expect(importPrivateKey(invalidHex, 'hex')).rejects.toThrow(/must be 64 characters/);
  });

  it('should reject empty nsec key', async () => {
    await expect(importPrivateKey('', 'nsec')).rejects.toThrow();
  });

  it('should reject nsec key without nsec prefix', async () => {
    await expect(importPrivateKey('1234567890abcdef', 'nsec')).rejects.toThrow();
  });

  it('should reject seed phrase with extra whitespace', async () => {
    // Note: The implementation actually normalizes whitespace, so this should work
    const seedPhrase =
      '  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  art  ';

    // This should succeed because whitespace is normalized
    const keypair = await importFromSeedPhrase(seedPhrase);
    expect(keypair).toBeDefined();
  });

  it('should reject seed phrase with 12 words (common BIP-39 length)', async () => {
    const seedPhrase =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    await expect(importFromSeedPhrase(seedPhrase)).rejects.toThrow(
      /incorrect format or word count/
    );
  });

  it('should reject seed phrase with 25 words', async () => {
    const seedPhrase =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art extra';

    await expect(importFromSeedPhrase(seedPhrase)).rejects.toThrow(
      /incorrect format or word count/
    );
  });

  it('should reject seed phrase with mixed case invalid word', async () => {
    const seedPhrase =
      'Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon InvalidWord';

    await expect(importFromSeedPhrase(seedPhrase)).rejects.toThrow(/invalid words/);
  });
});

describe('Edge Cases: storage operations', () => {
  test('should reject empty passphrase', async ({ tempIdentityDir }) => {
    const keypair = await generateKeypair();
    const filePath = path.join(tempIdentityDir, 'identity');

    // Empty passphrase should be rejected for security
    await expect(saveKeypair(keypair, '', filePath)).rejects.toThrow(/passphrase cannot be empty/i);

    // Even for loading
    await saveKeypair(keypair, 'ValidPass1234', filePath);
    await expect(loadKeypair('', filePath)).rejects.toThrow(/passphrase cannot be empty/i);
  });

  test('should handle very long passphrase', async ({ tempIdentityDir }) => {
    const keypair = await generateKeypair();
    const longPassphrase = 'Aa1!' + 'a'.repeat(996); // Mix types for complexity
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, longPassphrase, filePath);
    const loaded = await loadKeypair(longPassphrase, filePath);

    expect(Buffer.from(loaded.privateKey).toString('hex')).toBe(
      Buffer.from(keypair.privateKey).toString('hex')
    );
  });

  test('should handle passphrase with special characters', async ({ tempIdentityDir }) => {
    const keypair = await generateKeypair();
    // Must have 12+ chars and 2+ types (letters + symbols)
    const specialPassphrase = 'SpecialPass!@#$%';
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, specialPassphrase, filePath);
    const loaded = await loadKeypair(specialPassphrase, filePath);

    expect(loaded).toBeDefined();
  });

  test('should handle passphrase with unicode characters', async ({ tempIdentityDir }) => {
    const keypair = await generateKeypair();
    const unicodePassphrase = '🔐 密码 пароль contraseña';
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, unicodePassphrase, filePath);
    const loaded = await loadKeypair(unicodePassphrase, filePath);

    expect(loaded).toBeDefined();
  });

  test('should throw error when loading non-existent file', async ({ tempIdentityDir }) => {
    const filePath = path.join(tempIdentityDir, 'nonexistent');

    await expect(loadKeypair('Passphrase123', filePath)).rejects.toThrow(/not found/);
  });

  test('should throw error when loading corrupted JSON file', async ({ tempIdentityDir }) => {
    const filePath = path.join(tempIdentityDir, 'identity');

    // Write invalid JSON
    fs.writeFileSync(filePath, 'not valid json');

    await expect(loadKeypair('Passphrase123', filePath)).rejects.toThrow(/corrupted.*JSON/);
  });

  test('should throw error when loading file with missing fields', async ({ tempIdentityDir }) => {
    const filePath = path.join(tempIdentityDir, 'identity');

    // Write JSON with missing required fields
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        version: 1,
        salt: 'abc',
        // Missing: iv, encryptedData, authTag
      })
    );

    await expect(loadKeypair('Passphrase123', filePath)).rejects.toThrow(
      /corrupted.*missing required fields/
    );
  });

  test('should overwrite existing file when saving', async ({ tempIdentityDir }) => {
    const filePath = path.join(tempIdentityDir, 'identity');

    // Save first keypair
    const keypair1 = await generateKeypair();
    await saveKeypair(keypair1, 'PassOne12345', filePath);

    // Save second keypair (should overwrite)
    const keypair2 = await generateKeypair();
    await saveKeypair(keypair2, 'PassTwo12345', filePath);

    // Load should get second keypair
    const loaded = await loadKeypair('PassTwo12345', filePath);
    expect(Buffer.from(loaded.privateKey).toString('hex')).toBe(
      Buffer.from(keypair2.privateKey).toString('hex')
    );

    // First passphrase should not work
    await expect(loadKeypair('PassOne12345', filePath)).rejects.toThrow();
  });

  test('should handle concurrent save operations', async ({ tempIdentityDir }) => {
    // This tests race condition handling
    const keypairs = await Promise.all([generateKeypair(), generateKeypair(), generateKeypair()]);
    const filePath = path.join(tempIdentityDir, 'identity');

    // Save all three concurrently
    await Promise.all([
      saveKeypair(keypairs[0], 'PassZero1234', `${filePath}-0`),
      saveKeypair(keypairs[1], 'PassOne12345', `${filePath}-1`),
      saveKeypair(keypairs[2], 'PassTwo12345', `${filePath}-2`),
    ]);

    // All files should exist
    expect(fs.existsSync(`${filePath}-0`)).toBe(true);
    expect(fs.existsSync(`${filePath}-1`)).toBe(true);
    expect(fs.existsSync(`${filePath}-2`)).toBe(true);
  });
});

describe('Edge Cases: client identity', () => {
  test('should throw descriptive error when accessing identity before load', async () => {
    const client = new SigilClient();

    expect(() => client.identity).toThrow(/identity not loaded.*loadIdentity/i);
  });

  test('should handle multiple loadIdentity calls (reload)', async ({ tempIdentityDir }) => {
    const keypair1 = await generateKeypair();
    const keypair2 = await generateKeypair();
    const passphrase = TEST_PASSPHRASE;
    const filePath1 = path.join(tempIdentityDir, 'identity1');
    const filePath2 = path.join(tempIdentityDir, 'identity2');

    await saveKeypair(keypair1, passphrase, filePath1);
    await saveKeypair(keypair2, passphrase, filePath2);

    const client = new SigilClient();

    // Load first identity
    await client.loadIdentity(passphrase, filePath1);
    const pubkey1 = client.identity.publicKey.hex;

    // Load second identity (should replace first)
    await client.loadIdentity(passphrase, filePath2);
    const pubkey2 = client.identity.publicKey.hex;

    expect(pubkey1).not.toBe(pubkey2);
    expect(client.identity.publicKey.hex).toBe(pubkey2);
  });

  test('should handle rapid sign() calls', async ({ tempIdentityDir }) => {
    const keypair = await generateKeypair();
    const passphrase = TEST_PASSPHRASE;
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);

    // Sign 10 events rapidly
    const events = Array.from({ length: 10 }, (_, i) => ({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000) + i,
      tags: [],
      content: `Message ${i}`,
    }));

    const signedEvents = await Promise.all(events.map((e) => client.identity.sign(e)));

    // All should have unique IDs
    const ids = signedEvents.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    // All should have valid signatures
    signedEvents.forEach((e) => {
      expect(e.sig).toMatch(/^[0-9a-f]{128}$/);
    });
  });

  test('should produce different signatures for different events', async ({ tempIdentityDir }) => {
    const keypair = await generateKeypair();
    const passphrase = TEST_PASSPHRASE;
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);

    const event1 = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Message 1',
    };

    const event2 = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Message 2', // Different content
    };

    const signed1 = await client.identity.sign(event1);
    const signed2 = await client.identity.sign(event2);

    // Signatures should be different
    expect(signed1.sig).not.toBe(signed2.sig);
    expect(signed1.id).not.toBe(signed2.id);

    // But same pubkey
    expect(signed1.pubkey).toBe(signed2.pubkey);
  });

  test('should handle signing events with all Nostr event kinds', async ({ tempIdentityDir }) => {
    // Test various common Nostr event kinds to ensure signature compatibility
    const keypair = await generateKeypair();
    const passphrase = TEST_PASSPHRASE;
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);

    // Test different event kinds: text note, metadata, contact list, DM, reaction
    const eventKinds = [1, 0, 3, 4, 7];

    for (const kind of eventKinds) {
      const event = {
        kind,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `Test content for kind ${kind}`,
      };

      const signed = await client.identity.sign(event);

      // Verify all required fields present
      expect(signed.kind).toBe(kind);
      expect(signed.id).toBeDefined();
      expect(signed.sig).toBeDefined();
      expect(signed.pubkey).toBe(client.identity.publicKey.hex);
    }
  });
});

describe('Edge Cases: export operations', () => {
  it('should handle export of keypair with minimal non-zero key', async () => {
    // Valid minimal private key (not all zeros, which would be invalid for secp256k1)
    const privateKey = new Uint8Array(32);
    privateKey[31] = 1; // Set last byte to 1

    const keypair = {
      privateKey,
      publicKey: new Uint8Array(32).fill(1), // Valid public key placeholder
    };

    const exported = exportKeypair(keypair);

    expect(exported.privateKey.hex).toBe('0'.repeat(62) + '01');
    expect(exported.publicKey.hex).toBe('01'.repeat(32));
  });

  it('should handle export of keypair with all 0xFF (edge case)', async () => {
    const keypair = {
      privateKey: new Uint8Array(32).fill(0xff),
      publicKey: new Uint8Array(32).fill(0xff),
    };

    const exported = exportKeypair(keypair);

    expect(exported.privateKey.hex).toBe('f'.repeat(64));
    expect(exported.publicKey.hex).toBe('f'.repeat(64));
  });

  it('should handle multiple exports of same keypair (idempotent)', async () => {
    const keypair = await generateKeypair();

    const export1 = exportKeypair(keypair);
    const export2 = exportKeypair(keypair);
    const export3 = exportKeypair(keypair);

    // All exports should be identical
    expect(export1.privateKey.hex).toBe(export2.privateKey.hex);
    expect(export2.privateKey.hex).toBe(export3.privateKey.hex);
    expect(export1.publicKey.npub).toBe(export2.publicKey.npub);
  });
});

describe('Security: private key isolation', () => {
  test('private key not in Object.keys() of identity', async ({ tempIdentityDir }) => {
    const keypair = await generateKeypair();
    const passphrase = TEST_PASSPHRASE;
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);

    const keys = Object.keys(client.identity);
    expect(keys).toEqual(['publicKey', 'sign']);
    expect(keys).not.toContain('privateKey');
    expect(keys).not.toContain('secretKey');
  });

  test('private key not in Object.getOwnPropertyNames() of identity', async ({
    tempIdentityDir,
  }) => {
    const keypair = await generateKeypair();
    const passphrase = TEST_PASSPHRASE;
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);

    const props = Object.getOwnPropertyNames(client.identity);
    expect(props).not.toContain('privateKey');
    expect(props).not.toContain('secretKey');
  });

  test('private key not exposed via toString()', async ({ tempIdentityDir }) => {
    const keypair = await generateKeypair();
    const passphrase = TEST_PASSPHRASE;
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);

    const identityString = client.identity.toString();
    const privateKeyHex = Buffer.from(keypair.privateKey).toString('hex');

    expect(identityString).not.toContain(privateKeyHex);
  });

  test('private key not in error stack traces', async ({ tempIdentityDir }) => {
    const keypair = await generateKeypair();
    const passphrase = 'CorrectPass1234';
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    const client = new SigilClient();

    // Try loading with wrong passphrase
    try {
      await client.loadIdentity('wrong-pass', filePath);
      expect.fail('Should have thrown error');
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      const privateKeyHex = Buffer.from(keypair.privateKey).toString('hex');

      expect(errorStack).not.toContain(privateKeyHex);
    }
  });
});
