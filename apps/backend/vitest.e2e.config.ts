import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/prisma-test.test.ts'],
    // E2E tests manage their own setup/teardown per suite
    // No global setup needed
    // IMPORTANT: E2E tests must run sequentially because each file spins up its own containers
    fileParallelism: false,
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
      '@tests': path.resolve(__dirname, 'tests'),
      '@prisma/client': path.resolve(__dirname, 'node_modules/@prisma/client'),
    },
    extensions: ['.ts', '.js', '.mjs', '.json'],
  },
  esbuild: {
    target: 'node18',
  },
});
