/**
 * Availability Validator Unit Tests
 */

import { describe, expect, it } from 'vitest';
import {
  BulkToggleAvailabilitySchema,
  DocumentIdParamsSchema,
  ToggleAvailabilitySchema,
} from '@/validators/availability-validator.js';

describe('ToggleAvailabilitySchema', () => {
  it('should validate isActive = true', () => {
    const result = ToggleAvailabilitySchema.safeParse({ isActive: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it('should validate isActive = false', () => {
    const result = ToggleAvailabilitySchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });

  it('should reject non-boolean isActive', () => {
    const result = ToggleAvailabilitySchema.safeParse({ isActive: 'true' });
    expect(result.success).toBe(false);
  });

  it('should reject missing isActive', () => {
    const result = ToggleAvailabilitySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('BulkToggleAvailabilitySchema', () => {
  it('should validate documentIds array with valid UUIDs', () => {
    const result = BulkToggleAvailabilitySchema.safeParse({
      documentIds: ['550e8400-e29b-41d4-a716-446655440000'],
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('should validate documentIds array with multiple UUIDs', () => {
    const result = BulkToggleAvailabilitySchema.safeParse({
      documentIds: [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ],
      isActive: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentIds).toHaveLength(2);
    }
  });

  it('should reject empty documentIds array', () => {
    const result = BulkToggleAvailabilitySchema.safeParse({
      documentIds: [],
      isActive: true,
    });
    expect(result.success).toBe(false);
  });

  it('should reject documentIds array with more than 100 items', () => {
    const ids = Array.from({ length: 101 }, (_, i) => 
      `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`
    );
    const result = BulkToggleAvailabilitySchema.safeParse({
      documentIds: ids,
      isActive: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Maximum 100 documents per request');
    }
  });

  it('should reject invalid UUIDs in array', () => {
    const result = BulkToggleAvailabilitySchema.safeParse({
      documentIds: ['not-a-uuid'],
      isActive: true,
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing isActive', () => {
    const result = BulkToggleAvailabilitySchema.safeParse({
      documentIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(false);
  });
});

describe('DocumentIdParamsSchema', () => {
  it('should validate valid UUID', () => {
    const result = DocumentIdParamsSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    const result = DocumentIdParamsSchema.safeParse({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});
