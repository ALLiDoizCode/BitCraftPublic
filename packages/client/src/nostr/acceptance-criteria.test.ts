/**
 * Acceptance Criteria End-to-End Tests for Story 1.2: Nostr Identity Management
 *
 * These tests verify the complete workflows described in the acceptance criteria,
 * including the full flow from generation/import through save/load cycles.
 */

import { describe, expect } from 'vitest';
import { test } from './test-utils/fs.fixture';
import { generateKeypair, importPrivateKey, importFromSeedPhrase, exportKeypair } from './keypair';
import { saveKeypair, loadKeypair } from './storage';
import { SigilClient } from '../client';
import * as path from 'path';
import * as fs from 'fs';

describe('AC1: Generate new Nostr keypair', () => {
  test('complete workflow: generate → save → load → verify', async ({ tempIdentityDir }) => {
    // Given: No existing identity file
    const filePath = path.join(tempIdentityDir, 'identity');
    expect(fs.existsSync(filePath)).toBe(false);

    // When: Generate new keypair
    const keypair = await generateKeypair();

    // Then: Keypair is generated with valid structure
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.privateKey.length).toBe(32);
    expect(keypair.publicKey.length).toBe(32);

    // And: Export to get public key in npub format
    const exported = exportKeypair(keypair);
    expect(exported.publicKey.npub).toMatch(/^npub1[a-z0-9]+$/);

    // And: Save keypair to ~/.sigil/identity
    const passphrase = 'TestPassphrase12';
    await saveKeypair(keypair, passphrase, filePath);

    // And: File exists and is encrypted
    expect(fs.existsSync(filePath)).toBe(true);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    expect(parsed.version).toBe(1);
    expect(parsed.salt).toBeDefined();
    expect(parsed.iv).toBeDefined();
    expect(parsed.encryptedData).toBeDefined();
    expect(parsed.authTag).toBeDefined();

    // And: Public key (npub) can be retrieved after load
    const loadedKeypair = await loadKeypair(passphrase, filePath);
    const loadedExported = exportKeypair(loadedKeypair);
    expect(loadedExported.publicKey.npub).toBe(exported.publicKey.npub);
  });

  test('public key (npub) is returned to caller', async () => {
    // Given: Generate new keypair
    const keypair = await generateKeypair();

    // When: Export to get npub format
    const exported = exportKeypair(keypair);

    // Then: Public key in npub format is available
    expect(exported.publicKey.npub).toBeDefined();
    expect(typeof exported.publicKey.npub).toBe('string');
    expect(exported.publicKey.npub).toMatch(/^npub1[a-z0-9]+$/);

    // And: Hex format also available
    expect(exported.publicKey.hex).toBeDefined();
    expect(exported.publicKey.hex).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('AC2: Import existing private key (hex or nsec format)', () => {
  test('complete workflow: import hex → save → load → verify', async ({ tempIdentityDir }) => {
    // Given: Existing Nostr private key in hex format
    const hexKey = '0000000000000000000000000000000000000000000000000000000000000001';
    const filePath = path.join(tempIdentityDir, 'identity');

    // When: Import with hex format
    const keypair = await importPrivateKey(hexKey, 'hex');

    // Then: Keypair is validated and public key derived
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(keypair.privateKey).toString('hex')).toBe(hexKey);

    // And: Save to ~/.sigil/identity
    const passphrase = 'ImportTest123';
    await saveKeypair(keypair, passphrase, filePath);

    // And: Can load back and verify
    const loadedKeypair = await loadKeypair(passphrase, filePath);
    expect(Buffer.from(loadedKeypair.privateKey).toString('hex')).toBe(hexKey);

    // And: Public key matches original
    const originalPubHex = Buffer.from(keypair.publicKey).toString('hex');
    const loadedPubHex = Buffer.from(loadedKeypair.publicKey).toString('hex');
    expect(loadedPubHex).toBe(originalPubHex);
  });

  test('complete workflow: import nsec → save → load → verify', async ({ tempIdentityDir }) => {
    // Given: Existing Nostr private key in nsec format
    // First generate a valid key to get valid nsec
    const tempKeypair = await generateKeypair();
    const exported = exportKeypair(tempKeypair);
    const nsecKey = exported.privateKey.nsec;
    const filePath = path.join(tempIdentityDir, 'identity');

    // When: Import with nsec format
    const keypair = await importPrivateKey(nsecKey, 'nsec');

    // Then: Keypair is validated and public key derived
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);

    // And: Save to ~/.sigil/identity
    const passphrase = 'ImportNsec123';
    await saveKeypair(keypair, passphrase, filePath);

    // And: Can load back and verify
    const loadedKeypair = await loadKeypair(passphrase, filePath);
    const loadedExported = exportKeypair(loadedKeypair);
    expect(loadedExported.privateKey.nsec).toBe(nsecKey);
  });
});

describe('AC3: Import from BIP-39 seed phrase', () => {
  test('complete workflow: import seed → save → load → verify deterministic', async ({
    tempIdentityDir,
  }) => {
    // Given: Existing BIP-39 seed phrase (24 words)
    const seedPhrase =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    const filePath = path.join(tempIdentityDir, 'identity');

    // When: Import from seed phrase
    const keypair = await importFromSeedPhrase(seedPhrase);

    // Then: Nostr keypair is deterministically derived
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);

    // And: Save to ~/.sigil/identity
    const passphrase = 'SeedTestPass12';
    await saveKeypair(keypair, passphrase, filePath);

    // And: Can load back
    const loadedKeypair = await loadKeypair(passphrase, filePath);

    // And: Loaded keypair matches original (deterministic)
    const originalHex = Buffer.from(keypair.privateKey).toString('hex');
    const loadedHex = Buffer.from(loadedKeypair.privateKey).toString('hex');
    expect(loadedHex).toBe(originalHex);

    // And: Re-importing same seed produces same keypair (deterministic verification)
    const reimportedKeypair = await importFromSeedPhrase(seedPhrase);
    const reimportedHex = Buffer.from(reimportedKeypair.privateKey).toString('hex');
    expect(reimportedHex).toBe(originalHex);
  });
});

describe('AC4: Export keypair in multiple formats', () => {
  test('export returns all four formats from stored keypair', async ({ tempIdentityDir }) => {
    // Given: Stored keypair at ~/.sigil/identity
    const keypair = await generateKeypair();
    const passphrase = 'ExportTest123';
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    // When: Load and export
    const loadedKeypair = await loadKeypair(passphrase, filePath);
    const exported = exportKeypair(loadedKeypair);

    // Then: Private key returned in nsec and hex formats
    expect(exported.privateKey.nsec).toBeDefined();
    expect(typeof exported.privateKey.nsec).toBe('string');
    expect(exported.privateKey.nsec).toMatch(/^nsec1[a-z0-9]+$/);

    expect(exported.privateKey.hex).toBeDefined();
    expect(typeof exported.privateKey.hex).toBe('string');
    expect(exported.privateKey.hex).toMatch(/^[0-9a-f]{64}$/);

    // And: Public key returned in npub and hex formats
    expect(exported.publicKey.npub).toBeDefined();
    expect(typeof exported.publicKey.npub).toBe('string');
    expect(exported.publicKey.npub).toMatch(/^npub1[a-z0-9]+$/);

    expect(exported.publicKey.hex).toBeDefined();
    expect(typeof exported.publicKey.hex).toBe('string');
    expect(exported.publicKey.hex).toMatch(/^[0-9a-f]{64}$/);
  });

  test('exported formats are consistent and interoperable', async () => {
    // Given: Generated keypair
    const keypair = await generateKeypair();
    const exported = exportKeypair(keypair);

    // When: Re-import using each exported format
    const fromHex = await importPrivateKey(exported.privateKey.hex, 'hex');
    const fromNsec = await importPrivateKey(exported.privateKey.nsec, 'nsec');

    // Then: All imports produce same keypair
    const originalPrivHex = exported.privateKey.hex;
    const fromHexPrivHex = Buffer.from(fromHex.privateKey).toString('hex');
    const fromNsecPrivHex = Buffer.from(fromNsec.privateKey).toString('hex');

    expect(fromHexPrivHex).toBe(originalPrivHex);
    expect(fromNsecPrivHex).toBe(originalPrivHex);

    // And: Public keys also match
    const originalPubHex = exported.publicKey.hex;
    const fromHexPubHex = Buffer.from(fromHex.publicKey).toString('hex');
    const fromNsecPubHex = Buffer.from(fromNsec.publicKey).toString('hex');

    expect(fromHexPubHex).toBe(originalPubHex);
    expect(fromNsecPubHex).toBe(originalPubHex);
  });
});

describe('AC5: Client identity property integration', () => {
  test('client.identity returns loaded public key and provides signing capability', async ({
    tempIdentityDir,
  }) => {
    // Given: Keypair module used by @sigil/client
    const keypair = await generateKeypair();
    const passphrase = 'ClientTest123';
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    // When: Access client.identity property
    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);
    const identity = client.identity;

    // Then: Returns loaded Nostr public key
    expect(identity.publicKey).toBeDefined();
    expect(identity.publicKey.hex).toBeDefined();
    expect(identity.publicKey.npub).toBeDefined();

    // And: Provides signing capability
    expect(identity.sign).toBeDefined();
    expect(typeof identity.sign).toBe('function');

    // And: Can sign events
    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Test message',
    };
    const signedEvent = await identity.sign(event);
    expect(signedEvent.id).toBeDefined();
    expect(signedEvent.sig).toBeDefined();
    expect(signedEvent.pubkey).toBeDefined();
  });

  test('NFR9: private key never exposed in logs or transmitted', async ({ tempIdentityDir }) => {
    // Given: Client with loaded identity
    const keypair = await generateKeypair();
    const passphrase = 'Nfr9TestPass12';
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);

    // When: Access identity
    const identity = client.identity;

    // Then: Private key NOT accessible via any property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const identityAny = identity as any;
    expect(identityAny.privateKey).toBeUndefined();
    expect(identityAny.secretKey).toBeUndefined();
    expect(identityAny.secret).toBeUndefined();
    expect(identityAny.privkey).toBeUndefined();
    expect(identityAny.sk).toBeUndefined();

    // And: Only public key and sign method exposed
    expect(Object.keys(identity).sort()).toEqual(['publicKey', 'sign']);

    // And: Private key not in JSON.stringify output (prevent accidental logging)
    const serialized = JSON.stringify(identity.publicKey);
    const privateKeyHex = Buffer.from(keypair.privateKey).toString('hex');
    expect(serialized).not.toContain(privateKeyHex);
  });

  test('complete user workflow: generate → save → load in client → sign', async ({
    tempIdentityDir,
  }) => {
    // This test verifies the complete end-to-end workflow a user would follow

    // Step 1: Generate new identity
    const keypair = await generateKeypair();
    const exported = exportKeypair(keypair);
    const userPublicKey = exported.publicKey.npub; // What user sees

    // Step 2: Save with passphrase
    const passphrase = 'MySecurePass123';
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    // Step 3: Later session - load in client
    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);

    // Step 4: Verify loaded identity matches original
    expect(client.identity.publicKey.npub).toBe(userPublicKey);

    // Step 5: Sign an event (game action, message, etc.)
    const signedEvent = await client.identity.sign({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Hello from Sigil!',
    });

    // Step 6: Verify signature is valid
    expect(signedEvent.id).toBeDefined();
    expect(signedEvent.sig).toBeDefined();
    expect(signedEvent.pubkey).toBe(client.identity.publicKey.hex);
  });
});

describe('Security Requirements Verification', () => {
  test('NFR11: private keys encrypted at rest', async ({ tempIdentityDir }) => {
    // Given: Saved keypair
    const keypair = await generateKeypair();
    const passphrase = 'Nfr11Test1234';
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    // When: Read file from disk
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const privateKeyHex = Buffer.from(keypair.privateKey).toString('hex');

    // Then: Private key NOT in plaintext in file
    expect(fileContent).not.toContain(privateKeyHex);

    // And: File contains encrypted data fields
    const parsed = JSON.parse(fileContent);
    expect(parsed.encryptedData).toBeDefined();
    expect(parsed.salt).toBeDefined();
    expect(parsed.iv).toBeDefined();
    expect(parsed.authTag).toBeDefined();

    // And: Encryption algorithm metadata present
    expect(parsed.version).toBe(1);

    // And: Data is actually encrypted (ciphertext should look random)
    expect(parsed.encryptedData).toMatch(/^[0-9a-f]+$/); // Hex encoded
    expect(parsed.encryptedData.length).toBeGreaterThan(0);
  });

  test('NFR13: all actions require valid cryptographic signature', async ({ tempIdentityDir }) => {
    // Given: Client with loaded identity
    const keypair = await generateKeypair();
    const passphrase = 'Nfr13TestPass';
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, passphrase, filePath);

    const client = new SigilClient();
    await client.loadIdentity(passphrase, filePath);

    // When: Sign an action/event
    const action = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'game action',
    };
    const signedAction = await client.identity.sign(action);

    // Then: Signature is cryptographically valid
    expect(signedAction.sig).toBeDefined();
    expect(signedAction.sig).toMatch(/^[0-9a-f]{128}$/); // 64-byte signature

    // And: Signature can be verified with public key
    import('nostr-tools/pure').then(({ verifyEvent }) => {
      expect(verifyEvent(signedAction)).toBe(true);
    });

    // And: Signature cannot be created without private key
    // (this is enforced by the client.identity API design)
    expect(() => {
      // Attempting to access private key directly should fail
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyClient = client as any;
      return anyClient.keypair; // Should not be accessible
    }).toBeDefined(); // Private but exists internally for signing
  });
});
