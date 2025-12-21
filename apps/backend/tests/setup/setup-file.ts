// This file runs before each test file
// For unit tests, we don't need database cleanup
// For integration tests, this will clean the database

import { afterEach, vi } from 'vitest';

// Note: Migrated from @xenova/transformers to fastembed
// No longer need to mock sharp (fastembed has no image processing dependencies)

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
