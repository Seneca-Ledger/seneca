import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir),
      '@bank-logos': path.resolve(rootDir, 'app/bank-logos'),
    },
  },
  test: {
    environment: 'jsdom',
    // The dev image sets NODE_ENV=development, which Vitest keeps; code that
    // branches on it (API base URL) must see the test value everywhere.
    env: { NODE_ENV: 'test' },
    globals: true,
    setupFiles: ['app/test/setup.ts', 'app/components/dashboard/test-setup.ts'],
  },
});
