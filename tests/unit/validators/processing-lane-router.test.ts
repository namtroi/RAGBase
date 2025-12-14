import { describe, it, expect } from 'vitest';
import { getProcessingLane, LANE_CONFIG } from '@/validators/processing-lane-router';
import type { FileFormat } from '@prisma/client';

describe('getProcessingLane', () => {
  describe('fast lane formats', () => {
    it.each(['json', 'txt', 'md'] as FileFormat[])('should route %s to fast lane', (format) => {
      const lane = getProcessingLane(format);
      expect(lane).toBe('fast');
    });
  });

  describe('heavy lane formats', () => {
    it('should route pdf to heavy lane', () => {
      const lane = getProcessingLane('pdf');
      expect(lane).toBe('heavy');
    });
  });
});

describe('LANE_CONFIG', () => {
  it('should have fast lane formats defined', () => {
    expect(LANE_CONFIG.fast).toContain('json');
    expect(LANE_CONFIG.fast).toContain('txt');
    expect(LANE_CONFIG.fast).toContain('md');
  });

  it('should have heavy lane formats defined', () => {
    expect(LANE_CONFIG.heavy).toContain('pdf');
  });

  it('should not have overlapping formats', () => {
    const fastSet = new Set(LANE_CONFIG.fast);
    const heavySet = new Set(LANE_CONFIG.heavy);
    const intersection = [...fastSet].filter(f => heavySet.has(f));
    expect(intersection).toHaveLength(0);
  });
});
