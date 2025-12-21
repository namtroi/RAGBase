import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,  // Run test files sequentially to avoid DB race conditions
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['tests/setup/setup-file.ts'],
    // Global setup for integration tests (starts testcontainers)
    globalSetup: ['tests/setup/global-setup.ts'],
    server: {
      deps: {
        inline: ['bullmq'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, 'tests'),
      // Fix Prisma resolution for shared tests
      '@prisma/client': path.resolve(__dirname, 'node_modules/@prisma/client'),
      'bullmq': path.resolve(__dirname, 'node_modules/bullmq'),
      'ioredis': path.resolve(__dirname, 'node_modules/ioredis'),
    },
  },
});
