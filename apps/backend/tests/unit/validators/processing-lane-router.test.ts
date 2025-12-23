import { getProcessingLane, LANE_CONFIG } from '@/validators/processing-lane-router.js';
import type { FileFormat } from '@prisma/client';
import { describe, expect, it } from 'vitest';

describe('getProcessingLane', () => {
  describe('all formats use heavy lane', () => {
    it.each(['json', 'txt', 'md', 'pdf'] as FileFormat[])('should route %s to heavy lane', (format) => {
      const lane = getProcessingLane(format);
      expect(lane).toBe('heavy');
    });
  });
});

describe('LANE_CONFIG', () => {
  it('should have all formats in heavy lane', () => {
    expect(LANE_CONFIG.heavy).toContain('json');
    expect(LANE_CONFIG.heavy).toContain('txt');
    expect(LANE_CONFIG.heavy).toContain('md');
    expect(LANE_CONFIG.heavy).toContain('pdf');
  });
});
