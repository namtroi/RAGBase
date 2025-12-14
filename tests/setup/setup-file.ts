// This file runs before each test file
// For unit tests, we don't need database cleanup
// For integration tests, this will clean the database

import { vi } from 'vitest';

// Mock sharp globally to prevent native module loading errors
// Sharp is a dependency of @xenova/transformers but we don't need it in tests
vi.mock('sharp', () => ({
  default: vi.fn(),
}));

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
