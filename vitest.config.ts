import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/*.integration.test.ts',
      'test-story-1-1-integration.test.ts',
      'test-story-1-3-integration.test.ts',
    ],
    testTimeout: 120000, // 2 minutes for integration tests that run builds
    hookTimeout: 120000,
  },
});
