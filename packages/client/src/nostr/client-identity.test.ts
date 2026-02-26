/**
 * Integration tests for client.identity property
 *
 * TDD RED PHASE: These tests define expected behavior.
 * They will FAIL until implementation is complete (intentional).
 */

import { describe, expect } from 'vitest';
import { test } from './test-utils/fs.fixture';
import { generateKeypair } from './keypair';
import { saveKeypair } from './storage';
import { SigilClient } from '../client';
import { verifyEvent } from 'nostr-tools/pure';
import * as path from 'path';

// Client constructor
async function createClient(): Promise<SigilClient> {
  return new SigilClient();
}

describe('client.identity property integration', () => {
  test('client.identity.publicKey returns correct hex format (64 chars lowercase)', async ({
    tempIdentityDir,
  }) => {
    // Given: Saved keypair and loaded client
    const keypair = await generateKeypair();
    const passphrase = 'TestPassphrase12';
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, passphrase, filePath);

    const client = await createClient();
    await client.loadIdentity(passphrase, filePath);

    // When: Access client.identity.publicKey.hex
    const publicKeyHex = client.identity.publicKey.hex;

    // Then: Hex format is correct (64 chars, lowercase)
    expect(publicKeyHex).toBeDefined();
    expect(publicKeyHex).toMatch(/^[0-9a-f]{64}$/);

    // Matches original public key
    const expectedHex = Buffer.from(keypair.publicKey).toString('hex');
    expect(publicKeyHex).toBe(expectedHex);
  });

  test('client.identity.publicKey returns correct npub format (bech32)', async ({
    tempIdentityDir,
  }) => {
    // Given: Saved keypair and loaded client
    const keypair = await generateKeypair();
    const passphrase = 'TestPassphrase12';
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, passphrase, filePath);

    const client = await createClient();
    await client.loadIdentity(passphrase, filePath);

    // When: Access client.identity.publicKey.npub
    const publicKeyNpub = client.identity.publicKey.npub;

    // Then: Bech32 format is correct (npub1...)
    expect(publicKeyNpub).toBeDefined();
    expect(publicKeyNpub).toMatch(/^npub1[a-z0-9]+$/);
  });

  test('client.identity.sign() produces valid Nostr signature', async ({ tempIdentityDir }) => {
    // Given: Loaded client with identity
    const keypair = await generateKeypair();
    const passphrase = 'TestPassphrase12';
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, passphrase, filePath);

    const client = await createClient();
    await client.loadIdentity(passphrase, filePath);

    // When: Sign a Nostr event
    const unsignedEvent = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Hello, Nostr!',
    };

    const signedEvent = await client.identity.sign(unsignedEvent);

    // Then: Signed event has required fields
    expect(signedEvent).toBeDefined();
    expect(signedEvent.id).toBeDefined();
    expect(signedEvent.sig).toBeDefined();
    expect(signedEvent.pubkey).toBeDefined();
    expect(typeof signedEvent.sig).toBe('string');
  });

  test('client.identity.sign() signature is verifiable by nostr-tools', async ({
    tempIdentityDir,
  }) => {
    // Given: Loaded client with identity
    const keypair = await generateKeypair();
    const passphrase = 'TestPassphrase12';
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, passphrase, filePath);

    const client = await createClient();
    await client.loadIdentity(passphrase, filePath);

    // When: Sign and verify event
    const unsignedEvent = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Hello, Nostr!',
    };

    const signedEvent = await client.identity.sign(unsignedEvent);

    // Then: Signature is cryptographically valid
    expect(signedEvent.sig).toMatch(/^[0-9a-f]{128}$/); // 64-byte signature = 128 hex chars

    // Verify signature using nostr-tools
    const isValid = verifyEvent(signedEvent);
    expect(isValid).toBe(true);
  });

  test('client.identity does NOT expose private key property', async ({ tempIdentityDir }) => {
    // Given: Loaded client with identity
    const keypair = await generateKeypair();
    const passphrase = 'TestPassphrase12';
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, passphrase, filePath);

    const client = await createClient();
    await client.loadIdentity(passphrase, filePath);

    // When: Access client.identity
    const identity = client.identity;

    // Then: No private key property exposed
    expect(identity).toBeDefined();
    expect(identity.publicKey).toBeDefined();
    expect(identity.sign).toBeDefined();

    // Private key NOT accessible (TypeScript + runtime check)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((identity as any).privateKey).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((identity as any).secretKey).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((identity as any).secret).toBeUndefined();
  });

  test('client.identity never logs private key in error messages', async ({ tempIdentityDir }) => {
    // Given: Client with invalid passphrase
    const keypair = await generateKeypair();
    const correctPassphrase = 'correct-pass';
    const wrongPassphrase = 'WrongPass1234';
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, correctPassphrase, filePath);

    const client = await createClient();

    // When: Attempt to load with wrong passphrase
    let errorMessage = '';
    try {
      await client.loadIdentity(wrongPassphrase, filePath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      errorMessage = error.message || String(error);
    }

    // Then: Error message does NOT contain private key material
    const privateKeyHex = Buffer.from(keypair.privateKey).toString('hex');
    expect(errorMessage).not.toContain(privateKeyHex);

    // Error message should be generic
    expect(errorMessage).toMatch(/incorrect passphrase|authentication failed/i);
  });

  test('client.identity.sign() throws error if keypair not loaded', async () => {
    // Given: Client without loaded identity
    const client = await createClient();

    // When/Then: Accessing identity without loading throws error
    expect(() => client.identity).toThrow(/identity not loaded/i);
  });

  test('client.loadIdentity propagates storage errors correctly', async ({ tempIdentityDir }) => {
    // Given: Client and non-existent file
    const client = await createClient();
    const nonExistentPath = path.join(tempIdentityDir, 'does-not-exist');

    // When/Then: loadIdentity with non-existent file throws appropriate error
    await expect(client.loadIdentity('Passphrase123', nonExistentPath)).rejects.toThrow(
      /not found/i
    );

    // And: Client identity remains unloaded
    expect(() => client.identity).toThrow(/identity not loaded/i);
  });

  test('client.loadIdentity propagates decryption errors correctly', async ({
    tempIdentityDir,
  }) => {
    // Given: Saved keypair and client
    const keypair = await generateKeypair();
    const correctPassphrase = 'correct-pass';
    const wrongPassphrase = 'WrongPass1234';
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, correctPassphrase, filePath);

    const client = await createClient();

    // When/Then: loadIdentity with wrong passphrase throws appropriate error
    await expect(client.loadIdentity(wrongPassphrase, filePath)).rejects.toThrow(
      /incorrect passphrase|authentication failed/i
    );

    // And: Client identity remains unloaded
    expect(() => client.identity).toThrow(/identity not loaded/i);
  });
});
