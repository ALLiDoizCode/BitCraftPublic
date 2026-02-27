/**
 * Temporary file system fixture for test isolation
 *
 * Provides isolated temp directories for testing file operations
 * with automatic cleanup.
 */

import { test as base } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type FileSystemFixture = {
  tempIdentityDir: string;
};

/**
 * Extended test with temporary identity directory fixture
 *
 * Creates a unique temp directory for each test and cleans up automatically.
 */
export const test = base.extend<FileSystemFixture>({
  // eslint-disable-next-line no-empty-pattern
  tempIdentityDir: async ({}, use) => {
    // Setup: Create unique temp directory
    // Use crypto.randomBytes for better randomness (even in tests, to set good example)
    const { randomBytes } = await import('crypto');
    const randomHex = randomBytes(8).toString('hex');
    const tempDir = path.join(os.tmpdir(), `sigil-test-${Date.now()}-${randomHex}`);
    fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });

    // Provide temp directory to test
    await use(tempDir);

    // Cleanup: Remove temp directory and all contents
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  },
});
