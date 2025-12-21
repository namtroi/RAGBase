// This file runs before each test file
// For unit tests, we don't need database cleanup
// For integration tests, this will clean the database

import { disconnectPrisma } from '@/services/database.js';
import { afterEach, beforeAll, vi } from 'vitest';

// Reset Prisma singleton to use testcontainers DATABASE_URL
// This ensures routes/services connect to the correct test database
beforeAll(async () => {
  await disconnectPrisma();
});

// Note: Migrated from @xenova/transformers to fastembed
// No longer need to mock sharp (fastembed has no image processing dependencies)

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
