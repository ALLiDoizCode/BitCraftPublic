/**
 * Encrypted Nostr Keypair Storage
 *
 * Provides secure encrypted storage for Nostr keypairs using AES-256-GCM.
 * Private keys are NEVER stored in plaintext on disk.
 *
 * Encryption algorithm:
 * - Key derivation: scrypt (N=16384, r=8, p=1) with 32-byte random salt
 * - Encryption: AES-256-GCM with 12-byte random IV
 * - Authentication: GCM auth tag (16 bytes)
 *
 * File permissions: 0o600 (owner read/write only) on Unix-like systems
 * Directory permissions: 0o700 (owner only) on Unix-like systems
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { NostrKeypair } from './keypair';

/**
 * Securely clear sensitive data from memory by overwriting with zeros
 *
 * This helps prevent sensitive data from lingering in memory after use.
 * Note: JavaScript/V8 may still have copies in memory, but this provides
 * a best-effort attempt to clear sensitive data.
 */
function secureClear(buffer: Buffer | Uint8Array): void {
  if (buffer instanceof Buffer) {
    buffer.fill(0);
  } else {
    buffer.fill(0);
  }
}

/**
 * Current file format version
 * Increment this when making breaking changes to the file format
 */
const FILE_FORMAT_VERSION = 1;

/**
 * Encrypted file format (all values hex-encoded)
 */
interface EncryptedIdentityFile {
  version: number; // Format version (currently 1)
  salt: string; // 32-byte salt (64 hex chars)
  iv: string; // 12-byte IV (24 hex chars)
  encryptedData: string; // Variable-length ciphertext (hex)
  authTag: string; // 16-byte GCM auth tag (32 hex chars)
  failedAttempts?: number; // Track failed decrypt attempts for rate limiting
  lastAttempt?: number; // Timestamp of last decrypt attempt (ms since epoch)
}

/**
 * Scrypt parameters for key derivation
 * These provide strong security while remaining practical for user experience.
 * N=16384 (2^14) provides good security with ~25MB memory usage, compatible with all environments.
 */
const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost (2^14) - ~25MB memory, good balance
  r: 8, // Block size
  p: 1, // Parallelization
  keylen: 32, // Output key length in bytes
} as const;

/**
 * Default identity file location
 */
function getDefaultIdentityPath(): string {
  return path.join(os.homedir(), '.sigil', 'identity');
}

/**
 * Validate passphrase meets minimum security requirements
 *
 * Security recommendations:
 * - Minimum 12 characters (enforced)
 * - Mix of uppercase, lowercase, numbers, and symbols (recommended)
 * - Avoid common words or patterns (recommended)
 * - Use a password manager to generate strong passphrases (recommended)
 */
function validatePassphrase(passphrase: string): void {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('Passphrase cannot be empty');
  }

  // Minimum length check for security - increased from 8 to 12 for better entropy
  if (passphrase.length < 12) {
    throw new Error('Passphrase must be at least 12 characters long for security');
  }

  // Check for basic complexity (at least 2 character types)
  const hasLower = /[a-z]/.test(passphrase);
  const hasUpper = /[A-Z]/.test(passphrase);
  const hasNumber = /[0-9]/.test(passphrase);
  const hasSymbol = /[^a-zA-Z0-9]/.test(passphrase);

  const complexityCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

  if (complexityCount < 2) {
    throw new Error(
      'Passphrase must contain at least 2 different character types (lowercase, uppercase, numbers, symbols)'
    );
  }

  // Warn against common weak patterns (all same character, sequential)
  if (/^(.)\1+$/.test(passphrase)) {
    throw new Error('Passphrase cannot be the same character repeated');
  }
}

/**
 * Derive encryption key from passphrase using scrypt
 */
async function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      passphrase,
      salt,
      SCRYPT_PARAMS.keylen,
      {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p,
      },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
}

/**
 * Save keypair to encrypted file
 *
 * Creates the directory if it doesn't exist, encrypts the keypair with the
 * provided passphrase, and saves it to disk with restrictive permissions.
 *
 * @param keypair - NostrKeypair to save
 * @param passphrase - User-provided passphrase for encryption
 * @param filePath - Optional custom file path (defaults to ~/.sigil/identity)
 *
 * @example
 * ```typescript
 * const keypair = await generateKeypair();
 * await saveKeypair(keypair, 'my-secure-passphrase');
 * ```
 */
export async function saveKeypair(
  keypair: NostrKeypair,
  passphrase: string,
  filePath?: string
): Promise<void> {
  // Validate passphrase meets security requirements
  validatePassphrase(passphrase);

  const targetPath = filePath || getDefaultIdentityPath();
  const dirPath = path.dirname(targetPath);

  // Create directory if needed with restricted permissions
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }

  // Set directory permissions (Unix-like systems only)
  if (process.platform !== 'win32') {
    fs.chmodSync(dirPath, 0o700);
  }

  // Generate random salt for this encryption
  const salt = crypto.randomBytes(32);

  // Derive encryption key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.randomBytes(12);

  // Prepare keypair data for encryption
  const keypairJson = JSON.stringify({
    privateKey: Buffer.from(keypair.privateKey).toString('hex'),
    publicKey: Buffer.from(keypair.publicKey).toString('hex'),
  });

  // Encrypt using AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(keypairJson, 'utf8'), cipher.final()]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Securely clear sensitive data from memory
  secureClear(key);

  // Prepare file content
  const fileContent: EncryptedIdentityFile = {
    version: FILE_FORMAT_VERSION,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    encryptedData: encrypted.toString('hex'),
    authTag: authTag.toString('hex'),
  };

  // Write to file
  fs.writeFileSync(targetPath, JSON.stringify(fileContent, null, 2), 'utf-8');

  // Set file permissions (Unix-like systems only)
  if (process.platform !== 'win32') {
    fs.chmodSync(targetPath, 0o600);

    // Verify permissions were set correctly (security verification)
    const stats = fs.statSync(targetPath);
    const actualPerms = stats.mode & 0o777;
    if (actualPerms !== 0o600) {
      // Attempt to fix if verification fails
      fs.chmodSync(targetPath, 0o600);
      const retryStats = fs.statSync(targetPath);
      const retryPerms = retryStats.mode & 0o777;
      if (retryPerms !== 0o600) {
        throw new Error(
          `Failed to set secure file permissions: expected 0600, got ${retryPerms.toString(8)}`
        );
      }
    }
  }
}

/**
 * Rate limit configuration for failed decryption attempts
 */
const RATE_LIMIT = {
  maxAttempts: 5, // Maximum failed attempts before delay
  delayMs: 3000, // Delay in milliseconds after max attempts reached
  resetWindowMs: 300000, // 5 minutes - time window to reset counter
} as const;

/**
 * Load keypair from encrypted file
 *
 * Reads the encrypted file, derives the decryption key from the passphrase,
 * and decrypts the keypair.
 *
 * Implements rate limiting to prevent brute-force attacks: after 5 failed
 * attempts, a 3-second delay is enforced. Counters reset after 5 minutes.
 *
 * @param passphrase - User-provided passphrase for decryption
 * @param filePath - Optional custom file path (defaults to ~/.sigil/identity)
 * @returns Promise resolving to decrypted NostrKeypair
 * @throws Error if file doesn't exist, passphrase is incorrect, or data is corrupted
 *
 * @example
 * ```typescript
 * const keypair = await loadKeypair('my-secure-passphrase');
 * ```
 */
export async function loadKeypair(passphrase: string, filePath?: string): Promise<NostrKeypair> {
  // Validate passphrase meets security requirements
  validatePassphrase(passphrase);

  const targetPath = filePath || getDefaultIdentityPath();

  // Check file exists
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Identity file not found: ${targetPath}`);
  }

  // Read and parse file
  const fileContent = fs.readFileSync(targetPath, 'utf-8');
  let parsed: EncryptedIdentityFile;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    throw new Error('Identity file is corrupted: invalid JSON');
  }

  // Validate file format
  if (!parsed.version || !parsed.salt || !parsed.iv || !parsed.encryptedData || !parsed.authTag) {
    throw new Error('Identity file is corrupted: missing required fields');
  }

  // Validate version (for future migration support)
  if (parsed.version !== FILE_FORMAT_VERSION) {
    throw new Error(
      `Unsupported file format version: ${parsed.version} (expected ${FILE_FORMAT_VERSION})`
    );
  }

  // Rate limiting: Check if too many failed attempts
  const now = Date.now();
  const failedAttempts = parsed.failedAttempts || 0;
  const lastAttempt = parsed.lastAttempt || 0;

  // Reset counter if outside the reset window
  if (now - lastAttempt > RATE_LIMIT.resetWindowMs) {
    parsed.failedAttempts = 0;
    parsed.lastAttempt = now;
  }

  // Enforce rate limit delay after max attempts
  if (failedAttempts >= RATE_LIMIT.maxAttempts) {
    const timeSinceLastAttempt = now - lastAttempt;
    if (timeSinceLastAttempt < RATE_LIMIT.delayMs) {
      const remainingDelay = RATE_LIMIT.delayMs - timeSinceLastAttempt;
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));
    }
  }

  // Convert hex strings to buffers
  const salt = Buffer.from(parsed.salt, 'hex');
  const iv = Buffer.from(parsed.iv, 'hex');
  const encryptedData = Buffer.from(parsed.encryptedData, 'hex');
  const authTag = Buffer.from(parsed.authTag, 'hex');

  // Validate buffer sizes to prevent malformed data attacks
  if (salt.length !== 32) {
    throw new Error(`Invalid salt length: expected 32 bytes, got ${salt.length}`);
  }
  if (iv.length !== 12) {
    throw new Error(`Invalid IV length: expected 12 bytes, got ${iv.length}`);
  }
  if (authTag.length !== 16) {
    throw new Error(`Invalid auth tag length: expected 16 bytes, got ${authTag.length}`);
  }
  if (encryptedData.length === 0 || encryptedData.length > 10000) {
    throw new Error(`Invalid encrypted data length: ${encryptedData.length} bytes`);
  }

  // Derive decryption key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Decrypt using AES-256-GCM
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

    // Parse decrypted JSON
    const keypairData = JSON.parse(decrypted.toString('utf8'));

    // Success! Reset failed attempt counter
    if (failedAttempts > 0) {
      parsed.failedAttempts = 0;
      parsed.lastAttempt = now;
      try {
        fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2), 'utf-8');
      } catch {
        // Ignore write errors for counter reset (not critical)
      }
    }

    const result = {
      privateKey: Uint8Array.from(Buffer.from(keypairData.privateKey, 'hex')),
      publicKey: Uint8Array.from(Buffer.from(keypairData.publicKey, 'hex')),
    };

    // Securely clear sensitive data from memory
    secureClear(key);
    secureClear(decrypted);

    return result;
  } catch {
    // Securely clear sensitive data even on error
    secureClear(key);

    // Increment failed attempt counter
    parsed.failedAttempts = (parsed.failedAttempts || 0) + 1;
    parsed.lastAttempt = now;
    try {
      fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch {
      // Ignore write errors for counter increment (not critical)
    }

    // Use constant-time error message to prevent timing attacks
    // Don't reveal whether it's wrong passphrase vs corrupted data
    throw new Error('Failed to decrypt identity file: incorrect passphrase or corrupted data');
  }
}
