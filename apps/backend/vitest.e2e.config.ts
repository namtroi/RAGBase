import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['../../tests/e2e/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // E2E tests manage their own setup/teardown per suite
    // No global setup needed
    testTimeout: 120000, // 2 minutes for E2E tests
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, '../../tests'),
    },
  },
});
