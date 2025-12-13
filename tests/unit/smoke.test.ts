import { describe, it, expect } from 'vitest';

describe('Test Infrastructure Smoke Test', () => {
  it('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to test globals', () => {
    expect(expect).toBeDefined();
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
  });
});
