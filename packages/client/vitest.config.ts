import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/test-utils/**'],
      // @ts-expect-error - 'all' is a valid option in vitest v4.0.18 but not in types
      all: true,
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
  },
});
