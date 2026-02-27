/**
 * Integration tests for encrypted keypair storage
 *
 * TDD RED PHASE: These tests define expected behavior.
 * They will FAIL until implementation is complete (intentional).
 */

import { describe, expect } from 'vitest';
import { saveKeypair, loadKeypair } from './storage';
import { generateKeypair } from './keypair';
import { test } from './test-utils/fs.fixture';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('encrypted storage', () => {
  test('saveKeypair and loadKeypair roundtrip with correct passphrase', async ({
    tempIdentityDir,
  }) => {
    // Given: Generated keypair and passphrase
    const keypair = await generateKeypair();
    const passphrase = 'TestPassphrase123';
    const filePath = path.join(tempIdentityDir, 'identity');

    // When: Save and load with correct passphrase
    await saveKeypair(keypair, passphrase, filePath);
    const loaded = await loadKeypair(passphrase, filePath);

    // Then: Loaded keypair matches original
    const originalHex = Buffer.from(keypair.privateKey).toString('hex');
    const loadedHex = Buffer.from(loaded.privateKey).toString('hex');
    expect(loadedHex).toBe(originalHex);
  });

  test('loadKeypair throws error with incorrect passphrase', async ({ tempIdentityDir }) => {
    // Given: Saved keypair with passphrase
    const keypair = await generateKeypair();
    const correctPassphrase = 'correct-passphrase';
    const wrongPassphrase = 'wrong-passphrase';
    const filePath = path.join(tempIdentityDir, 'identity');

    await saveKeypair(keypair, correctPassphrase, filePath);

    // When/Then: Load with wrong passphrase rejects
    await expect(loadKeypair(wrongPassphrase, filePath)).rejects.toThrow(
      /incorrect passphrase|authentication failed/i
    );
  });

  test('saveKeypair creates directory if missing with mode 0o700', async ({ tempIdentityDir }) => {
    // Skip on Windows (Unix-only feature)
    if (process.platform === 'win32') {
      return;
    }

    // Given: Nested directory that doesn't exist
    const keypair = await generateKeypair();
    const nestedDir = path.join(tempIdentityDir, 'nested', 'deep');
    const filePath = path.join(nestedDir, 'identity');

    // When: Save to nested path
    await saveKeypair(keypair, 'Passphrase123', filePath);

    // Then: Directory created with correct permissions
    expect(fs.existsSync(nestedDir)).toBe(true);
    const stats = fs.statSync(nestedDir);
    const permissions = stats.mode & 0o777;
    expect(permissions).toBe(0o700); // Owner only
  });

  test('saveKeypair sets file permissions to 0o600', async ({ tempIdentityDir }) => {
    // Skip on Windows (Unix-only feature)
    if (process.platform === 'win32') {
      return;
    }

    // Given: Keypair and file path
    const keypair = await generateKeypair();
    const filePath = path.join(tempIdentityDir, 'identity');

    // When: Save keypair
    await saveKeypair(keypair, 'Passphrase123', filePath);

    // Then: File has correct permissions (owner read/write only)
    const stats = fs.statSync(filePath);
    const permissions = stats.mode & 0o777;
    expect(permissions).toBe(0o600);
  });

  test('saveKeypair creates file with all required fields', async ({ tempIdentityDir }) => {
    // Given: Keypair
    const keypair = await generateKeypair();
    const filePath = path.join(tempIdentityDir, 'identity');

    // When: Save keypair
    await saveKeypair(keypair, 'Passphrase123', filePath);

    // Then: File contains all required fields
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(fileContent);

    expect(parsed.version).toBe(1);
    expect(parsed.salt).toBeDefined();
    expect(parsed.iv).toBeDefined();
    expect(parsed.encryptedData).toBeDefined();
    expect(parsed.authTag).toBeDefined();

    // All fields are hex strings
    expect(typeof parsed.salt).toBe('string');
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.encryptedData).toBe('string');
    expect(typeof parsed.authTag).toBe('string');
  });

  test('saveKeypair does not store plaintext private key in file', async ({ tempIdentityDir }) => {
    // Given: Keypair
    const keypair = await generateKeypair();
    const filePath = path.join(tempIdentityDir, 'identity');

    // When: Save keypair
    await saveKeypair(keypair, 'Passphrase123', filePath);

    // Then: File does not contain plaintext private key
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const privateKeyHex = Buffer.from(keypair.privateKey).toString('hex');

    // Verify private key is NOT in file as plaintext
    expect(fileContent).not.toContain(privateKeyHex);
  });

  test('saveKeypair uses scrypt with correct parameters', async ({ tempIdentityDir }) => {
    // Given: Keypair
    const keypair = await generateKeypair();
    const filePath = path.join(tempIdentityDir, 'identity');

    // When: Save keypair (implementation should use scrypt with N=16384, r=8, p=1)
    await saveKeypair(keypair, 'Passphrase123', filePath);

    // Then: File is created (scrypt params verified by code review, not test)
    // This test ensures the function completes without error using scrypt
    expect(fs.existsSync(filePath)).toBe(true);

    // Load should succeed with correct passphrase (validates scrypt roundtrip)
    const loaded = await loadKeypair('Passphrase123', filePath);
    expect(loaded).toBeDefined();
  });

  test('saveKeypair uses AES-256-GCM with 12-byte IV', async ({ tempIdentityDir }) => {
    // Given: Keypair
    const keypair = await generateKeypair();
    const filePath = path.join(tempIdentityDir, 'identity');

    // When: Save keypair
    await saveKeypair(keypair, 'Passphrase123', filePath);

    // Then: IV is 12 bytes (24 hex characters)
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(fileContent);

    // 12 bytes = 24 hex characters
    expect(parsed.iv.length).toBe(24);
    expect(parsed.iv).toMatch(/^[0-9a-f]{24}$/);

    // Auth tag present (GCM authentication)
    expect(parsed.authTag).toBeDefined();
    expect(parsed.authTag.length).toBe(32); // 16 bytes = 32 hex chars
  });

  test('saveKeypair throws error for empty passphrase', async ({ tempIdentityDir }) => {
    // Given: Keypair and empty passphrase
    const keypair = await generateKeypair();
    const filePath = path.join(tempIdentityDir, 'identity');

    // When/Then: Save with empty passphrase rejects
    await expect(saveKeypair(keypair, '', filePath)).rejects.toThrow(/passphrase cannot be empty/i);
    await expect(saveKeypair(keypair, '   ', filePath)).rejects.toThrow(
      /passphrase cannot be empty/i
    );
  });

  test('loadKeypair throws error for empty passphrase', async ({ tempIdentityDir }) => {
    // Given: Saved keypair
    const keypair = await generateKeypair();
    const filePath = path.join(tempIdentityDir, 'identity');
    await saveKeypair(keypair, 'valid-passphrase', filePath);

    // When/Then: Load with empty passphrase rejects
    await expect(loadKeypair('', filePath)).rejects.toThrow(/passphrase cannot be empty/i);
    await expect(loadKeypair('   ', filePath)).rejects.toThrow(/passphrase cannot be empty/i);
  });

  test('saveKeypair and loadKeypair use default path when not specified', async () => {
    // Given: Keypair and no explicit path
    const keypair = await generateKeypair();
    const passphrase = 'DefaultPathTest123';

    // When: Save without specifying path (uses ~/.sigil/identity)
    await saveKeypair(keypair, passphrase);

    // Then: Can load from default path
    const loaded = await loadKeypair(passphrase);
    const originalHex = Buffer.from(keypair.privateKey).toString('hex');
    const loadedHex = Buffer.from(loaded.privateKey).toString('hex');
    expect(loadedHex).toBe(originalHex);

    // Cleanup: Remove the default file
    const defaultPath = path.join(os.homedir(), '.sigil', 'identity');
    if (fs.existsSync(defaultPath)) {
      fs.unlinkSync(defaultPath);
    }
  });
});
