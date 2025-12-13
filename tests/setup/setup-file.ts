// This file runs before each test file
// For unit tests, we don't need database cleanup
// For integration tests, this will clean the database

import { vi } from 'vitest';

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
