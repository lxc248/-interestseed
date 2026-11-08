import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL('./tests/obsidian-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
    isolate: true,
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 71,
        branches: 65,
        functions: 79,
        lines: 73,
      },
    },
  },
});
