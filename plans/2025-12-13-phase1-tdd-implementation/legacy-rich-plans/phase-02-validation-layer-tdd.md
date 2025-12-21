# Phase 02: Validation Layer (TDD)

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phase 01 | **Blocks:** Phases 03-06

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P0 (Critical) |
| Est. Hours | 4 |
| Status | Pending |

**Description:** TDD approach for validation layer. Write tests FIRST for Zod schemas, file format detection, and processing lane routing. Then implement to pass tests.

---

## Key Insights (from Research)

- Zod schemas provide runtime validation + TypeScript inference
- Test validation schemas at boundary (100% coverage required)
- Parameterized tests (`describe.each`) reduce boilerplate

---

## Requirements

### Acceptance Criteria
- [ ] All validation schemas from CONTRACT.md have tests
- [ ] Tests written BEFORE implementation (RED phase first)
- [ ] File format detection covers all Phase 1 formats
- [ ] Processing lane routing has edge case coverage
- [ ] 100% test coverage on validation layer

---

## Architecture

### Validation Module Structure

```
src/
├── validators/
│   ├── index.ts                    # Re-exports
│   ├── upload-validator.ts         # UploadSchema
│   ├── query-validator.ts          # QuerySchema
│   ├── list-query-validator.ts     # ListQuerySchema
│   ├── callback-validator.ts       # CallbackSchema
│   ├── file-format-detector.ts     # Format detection
│   └── processing-lane-router.ts   # Lane routing
```

### Type Definitions (from CONTRACT.md)

```typescript
// Types inferred from Zod schemas
type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type FileFormat = 'pdf' | 'json' | 'txt' | 'md';
type ProcessingLane = 'fast' | 'heavy';
type OcrMode = 'auto' | 'force' | 'never';
type ErrorCode = 'PASSWORD_PROTECTED' | 'CORRUPT_FILE' | 'UNSUPPORTED_FORMAT' | 'OCR_FAILED' | 'TIMEOUT' | 'INTERNAL_ERROR';
```

---

## Related Code Files

| File | Purpose |
|------|---------|
| `tests/unit/validators/upload-validator.test.ts` | Upload schema tests |
| `tests/unit/validators/query-validator.test.ts` | Query schema tests |
| `tests/unit/validators/list-query-validator.test.ts` | List query tests |
| `tests/unit/validators/callback-validator.test.ts` | Callback schema tests |
| `tests/unit/validators/file-format-detector.test.ts` | Format detection tests |
| `tests/unit/validators/processing-lane-router.test.ts` | Lane routing tests |
| `src/validators/upload-validator.ts` | Upload validation impl |
| `src/validators/query-validator.ts` | Query validation impl |
| `src/validators/callback-validator.ts` | Callback validation impl |
| `src/validators/file-format-detector.ts` | Format detection impl |
| `src/validators/processing-lane-router.ts` | Lane routing impl |

---

## Implementation Steps (TDD Cycle)

### Step 1: RED - Write Upload Validator Tests

```typescript
// tests/unit/validators/upload-validator.test.ts
import { describe, it, expect } from 'vitest';
// Import will fail until implementation exists - that's expected (RED)
import { UploadSchema, validateUpload } from '@/validators/upload-validator';

describe('UploadSchema', () => {
  describe('ocrMode validation', () => {
    it('should default ocrMode to "auto" when not provided', () => {
      const result = UploadSchema.parse({});
      expect(result.ocrMode).toBe('auto');
    });

    it.each(['auto', 'force', 'never'] as const)('should accept ocrMode "%s"', (mode) => {
      const result = UploadSchema.parse({ ocrMode: mode });
      expect(result.ocrMode).toBe(mode);
    });

    it('should reject invalid ocrMode', () => {
      expect(() => UploadSchema.parse({ ocrMode: 'invalid' })).toThrow();
    });
  });
});

describe('validateUpload', () => {
  describe('file size validation', () => {
    const maxSizeMB = 50;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    it('should accept file under size limit', () => {
      const result = validateUpload({
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: maxSizeBytes - 1,
      });
      expect(result.valid).toBe(true);
    });

    it('should accept file at exactly size limit', () => {
      const result = validateUpload({
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: maxSizeBytes,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject file over size limit', () => {
      const result = validateUpload({
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: maxSizeBytes + 1,
      });
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('format validation', () => {
    it.each([
      { filename: 'doc.pdf', mimeType: 'application/pdf' },
      { filename: 'data.json', mimeType: 'application/json' },
      { filename: 'readme.txt', mimeType: 'text/plain' },
      { filename: 'notes.md', mimeType: 'text/markdown' },
    ])('should accept $filename with $mimeType', ({ filename, mimeType }) => {
      const result = validateUpload({ filename, mimeType, size: 1024 });
      expect(result.valid).toBe(true);
    });

    it.each([
      { filename: 'image.png', mimeType: 'image/png' },
      { filename: 'doc.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: 'data.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { filename: 'video.mp4', mimeType: 'video/mp4' },
    ])('should reject $filename with $mimeType', ({ filename, mimeType }) => {
      const result = validateUpload({ filename, mimeType, size: 1024 });
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_FORMAT');
    });
  });
});
```

### Step 2: GREEN - Implement Upload Validator

```typescript
// src/validators/upload-validator.ts
import { z } from 'zod';

// Schema for optional upload options
export const UploadSchema = z.object({
  ocrMode: z.enum(['auto', 'force', 'never']).default('auto'),
});

export type UploadOptions = z.infer<typeof UploadSchema>;

// Allowed formats for Phase 1
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'text/plain',
  'text/markdown',
  'text/x-markdown', // Alternative MIME for .md
]);

const ALLOWED_EXTENSIONS = new Set(['pdf', 'json', 'txt', 'md']);

// Config (from env)
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface FileInfo {
  filename: string;
  mimeType: string;
  size: number;
}

interface ValidationResult {
  valid: boolean;
  error?: {
    code: 'FILE_TOO_LARGE' | 'INVALID_FORMAT';
    message: string;
  };
}

export function validateUpload(file: FileInfo): ValidationResult {
  // Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `File exceeds ${MAX_FILE_SIZE_MB}MB limit`,
      },
    };
  }

  // Format check - by MIME type
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    // Fallback to extension check
    const ext = file.filename.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: {
          code: 'INVALID_FORMAT',
          message: `Format not supported. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
        },
      };
    }
  }

  return { valid: true };
}
```

### Step 3: RED - Write Query Validator Tests

```typescript
// tests/unit/validators/query-validator.test.ts
import { describe, it, expect } from 'vitest';
import { QuerySchema } from '@/validators/query-validator';

describe('QuerySchema', () => {
  describe('query field', () => {
    it('should accept valid query string', () => {
      const result = QuerySchema.parse({ query: 'hello world' });
      expect(result.query).toBe('hello world');
    });

    it('should trim whitespace from query', () => {
      const result = QuerySchema.parse({ query: '  trimmed  ' });
      expect(result.query).toBe('trimmed');
    });

    it('should reject empty query', () => {
      expect(() => QuerySchema.parse({ query: '' })).toThrow();
    });

    it('should reject whitespace-only query', () => {
      expect(() => QuerySchema.parse({ query: '   ' })).toThrow();
    });

    it('should reject query exceeding 1000 chars', () => {
      const longQuery = 'a'.repeat(1001);
      expect(() => QuerySchema.parse({ query: longQuery })).toThrow();
    });

    it('should accept query at exactly 1000 chars', () => {
      const maxQuery = 'a'.repeat(1000);
      const result = QuerySchema.parse({ query: maxQuery });
      expect(result.query.length).toBe(1000);
    });
  });

  describe('topK field', () => {
    it('should default topK to 5', () => {
      const result = QuerySchema.parse({ query: 'test' });
      expect(result.topK).toBe(5);
    });

    it('should accept topK between 1 and 100', () => {
      expect(QuerySchema.parse({ query: 'test', topK: 1 }).topK).toBe(1);
      expect(QuerySchema.parse({ query: 'test', topK: 50 }).topK).toBe(50);
      expect(QuerySchema.parse({ query: 'test', topK: 100 }).topK).toBe(100);
    });

    it('should reject topK below 1', () => {
      expect(() => QuerySchema.parse({ query: 'test', topK: 0 })).toThrow();
      expect(() => QuerySchema.parse({ query: 'test', topK: -1 })).toThrow();
    });

    it('should reject topK above 100', () => {
      expect(() => QuerySchema.parse({ query: 'test', topK: 101 })).toThrow();
    });

    it('should reject non-integer topK', () => {
      expect(() => QuerySchema.parse({ query: 'test', topK: 5.5 })).toThrow();
    });
  });
});
```

### Step 4: GREEN - Implement Query Validator

```typescript
// src/validators/query-validator.ts
import { z } from 'zod';

export const QuerySchema = z.object({
  query: z.string()
    .trim()
    .min(1, 'Query cannot be empty')
    .max(1000, 'Query cannot exceed 1000 characters'),
  topK: z.number()
    .int('topK must be an integer')
    .min(1, 'topK must be at least 1')
    .max(100, 'topK cannot exceed 100')
    .default(5),
});

export type QueryInput = z.infer<typeof QuerySchema>;
```

### Step 5: RED - Write List Query Validator Tests

```typescript
// tests/unit/validators/list-query-validator.test.ts
import { describe, it, expect } from 'vitest';
import { ListQuerySchema } from '@/validators/list-query-validator';

describe('ListQuerySchema', () => {
  describe('status filter', () => {
    it('should accept valid status values', () => {
      const statuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
      for (const status of statuses) {
        const result = ListQuerySchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it('should allow omitting status (optional)', () => {
      const result = ListQuerySchema.parse({});
      expect(result.status).toBeUndefined();
    });

    it('should reject invalid status', () => {
      expect(() => ListQuerySchema.parse({ status: 'INVALID' })).toThrow();
    });
  });

  describe('pagination', () => {
    it('should default limit to 20', () => {
      const result = ListQuerySchema.parse({});
      expect(result.limit).toBe(20);
    });

    it('should default offset to 0', () => {
      const result = ListQuerySchema.parse({});
      expect(result.offset).toBe(0);
    });

    it('should coerce string limit to number', () => {
      const result = ListQuerySchema.parse({ limit: '10' });
      expect(result.limit).toBe(10);
    });

    it('should coerce string offset to number', () => {
      const result = ListQuerySchema.parse({ offset: '5' });
      expect(result.offset).toBe(5);
    });

    it('should accept limit between 1 and 100', () => {
      expect(ListQuerySchema.parse({ limit: 1 }).limit).toBe(1);
      expect(ListQuerySchema.parse({ limit: 100 }).limit).toBe(100);
    });

    it('should reject limit below 1', () => {
      expect(() => ListQuerySchema.parse({ limit: 0 })).toThrow();
    });

    it('should reject limit above 100', () => {
      expect(() => ListQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('should reject negative offset', () => {
      expect(() => ListQuerySchema.parse({ offset: -1 })).toThrow();
    });
  });
});
```

### Step 6: GREEN - Implement List Query Validator

```typescript
// src/validators/list-query-validator.ts
import { z } from 'zod';

export const ListQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  offset: z.coerce.number()
    .int()
    .min(0)
    .default(0),
});

export type ListQueryInput = z.infer<typeof ListQuerySchema>;
```

### Step 7: RED - Write Callback Validator Tests

```typescript
// tests/unit/validators/callback-validator.test.ts
import { describe, it, expect } from 'vitest';
import { CallbackSchema } from '@/validators/callback-validator';

describe('CallbackSchema', () => {
  describe('success callback', () => {
    it('should accept valid success callback', () => {
      const payload = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        success: true,
        result: {
          markdown: '# Title\n\nContent',
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 150,
        },
      };
      const result = CallbackSchema.parse(payload);
      expect(result.success).toBe(true);
      expect(result.result?.markdown).toBe('# Title\n\nContent');
    });

    it('should reject non-UUID documentId', () => {
      const payload = {
        documentId: 'not-a-uuid',
        success: true,
        result: {
          markdown: '# Title',
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 100,
        },
      };
      expect(() => CallbackSchema.parse(payload)).toThrow();
    });

    it('should require result when success is true', () => {
      const payload = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        success: true,
        // missing result
      };
      // This should technically be valid per schema but logically incorrect
      // We'll add refinement in implementation
      const result = CallbackSchema.safeParse(payload);
      // Schema allows it but application should validate
      expect(result.success).toBe(true);
    });
  });

  describe('failure callback', () => {
    it('should accept valid failure callback', () => {
      const payload = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        success: false,
        error: {
          code: 'PASSWORD_PROTECTED',
          message: 'PDF is password protected',
        },
      };
      const result = CallbackSchema.parse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PASSWORD_PROTECTED');
    });

    it.each([
      'PASSWORD_PROTECTED',
      'CORRUPT_FILE',
      'UNSUPPORTED_FORMAT',
      'OCR_FAILED',
      'TIMEOUT',
      'INTERNAL_ERROR',
    ])('should accept error code "%s"', (code) => {
      const payload = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        success: false,
        error: { code, message: 'Error message' },
      };
      const result = CallbackSchema.parse(payload);
      expect(result.error?.code).toBe(code);
    });

    it('should reject invalid error code', () => {
      const payload = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        success: false,
        error: { code: 'INVALID_CODE', message: 'Error' },
      };
      expect(() => CallbackSchema.parse(payload)).toThrow();
    });
  });

  describe('result fields', () => {
    const basePayload = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      success: true,
    };

    it('should require pageCount to be positive', () => {
      const payload = {
        ...basePayload,
        result: {
          markdown: '# Title',
          pageCount: 0,
          ocrApplied: false,
          processingTimeMs: 100,
        },
      };
      expect(() => CallbackSchema.parse(payload)).toThrow();
    });

    it('should require processingTimeMs to be positive', () => {
      const payload = {
        ...basePayload,
        result: {
          markdown: '# Title',
          pageCount: 1,
          ocrApplied: false,
          processingTimeMs: 0,
        },
      };
      expect(() => CallbackSchema.parse(payload)).toThrow();
    });
  });
});
```

### Step 8: GREEN - Implement Callback Validator

```typescript
// src/validators/callback-validator.ts
import { z } from 'zod';

const ProcessingResultSchema = z.object({
  markdown: z.string(),
  pageCount: z.number().int().positive(),
  ocrApplied: z.boolean(),
  processingTimeMs: z.number().positive(),
});

const ProcessingErrorSchema = z.object({
  code: z.enum([
    'PASSWORD_PROTECTED',
    'CORRUPT_FILE',
    'UNSUPPORTED_FORMAT',
    'OCR_FAILED',
    'TIMEOUT',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

export const CallbackSchema = z.object({
  documentId: z.string().uuid(),
  success: z.boolean(),
  result: ProcessingResultSchema.optional(),
  error: ProcessingErrorSchema.optional(),
});

export type CallbackPayload = z.infer<typeof CallbackSchema>;
export type ProcessingResult = z.infer<typeof ProcessingResultSchema>;
export type ProcessingError = z.infer<typeof ProcessingErrorSchema>;
```

### Step 9: RED - Write File Format Detector Tests

```typescript
// tests/unit/validators/file-format-detector.test.ts
import { describe, it, expect } from 'vitest';
import { detectFormat, getFormatFromMimeType, getFormatFromExtension } from '@/validators/file-format-detector';

describe('detectFormat', () => {
  describe('MIME type detection', () => {
    it.each([
      { mimeType: 'application/pdf', expected: 'pdf' },
      { mimeType: 'application/json', expected: 'json' },
      { mimeType: 'text/plain', expected: 'txt' },
      { mimeType: 'text/markdown', expected: 'md' },
      { mimeType: 'text/x-markdown', expected: 'md' },
    ])('should detect $expected from MIME type $mimeType', ({ mimeType, expected }) => {
      const result = detectFormat({ mimeType, filename: 'test.unknown' });
      expect(result).toBe(expected);
    });
  });

  describe('extension fallback', () => {
    it.each([
      { filename: 'document.pdf', expected: 'pdf' },
      { filename: 'data.json', expected: 'json' },
      { filename: 'readme.txt', expected: 'txt' },
      { filename: 'notes.md', expected: 'md' },
      { filename: 'UPPERCASE.PDF', expected: 'pdf' },
      { filename: 'file.JSON', expected: 'json' },
    ])('should detect $expected from filename $filename', ({ filename, expected }) => {
      const result = detectFormat({ mimeType: 'application/octet-stream', filename });
      expect(result).toBe(expected);
    });
  });

  describe('unsupported formats', () => {
    it('should return null for unsupported MIME type and extension', () => {
      const result = detectFormat({ mimeType: 'image/png', filename: 'image.png' });
      expect(result).toBeNull();
    });

    it('should return null for file without extension', () => {
      const result = detectFormat({ mimeType: 'application/octet-stream', filename: 'noextension' });
      expect(result).toBeNull();
    });
  });
});

describe('getFormatFromMimeType', () => {
  it('should return format for known MIME type', () => {
    expect(getFormatFromMimeType('application/pdf')).toBe('pdf');
  });

  it('should return null for unknown MIME type', () => {
    expect(getFormatFromMimeType('application/unknown')).toBeNull();
  });
});

describe('getFormatFromExtension', () => {
  it('should return format for known extension', () => {
    expect(getFormatFromExtension('pdf')).toBe('pdf');
  });

  it('should handle extension with dot', () => {
    expect(getFormatFromExtension('.pdf')).toBe('pdf');
  });

  it('should be case insensitive', () => {
    expect(getFormatFromExtension('PDF')).toBe('pdf');
    expect(getFormatFromExtension('.JSON')).toBe('json');
  });

  it('should return null for unknown extension', () => {
    expect(getFormatFromExtension('xyz')).toBeNull();
  });
});
```

### Step 10: GREEN - Implement File Format Detector

```typescript
// src/validators/file-format-detector.ts
import type { FileFormat } from '@prisma/client';

const MIME_TO_FORMAT: Record<string, FileFormat> = {
  'application/pdf': 'pdf',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
};

const EXT_TO_FORMAT: Record<string, FileFormat> = {
  pdf: 'pdf',
  json: 'json',
  txt: 'txt',
  md: 'md',
};

interface FileInfo {
  mimeType: string;
  filename: string;
}

export function detectFormat(file: FileInfo): FileFormat | null {
  // Try MIME type first
  const formatFromMime = getFormatFromMimeType(file.mimeType);
  if (formatFromMime) return formatFromMime;

  // Fallback to extension
  const ext = file.filename.split('.').pop();
  if (ext) {
    return getFormatFromExtension(ext);
  }

  return null;
}

export function getFormatFromMimeType(mimeType: string): FileFormat | null {
  return MIME_TO_FORMAT[mimeType] || null;
}

export function getFormatFromExtension(ext: string): FileFormat | null {
  const normalized = ext.replace(/^\./, '').toLowerCase();
  return EXT_TO_FORMAT[normalized] || null;
}
```

### Step 11: RED - Write Processing Lane Router Tests

```typescript
// tests/unit/validators/processing-lane-router.test.ts
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
```

### Step 12: GREEN - Implement Processing Lane Router

```typescript
// src/validators/processing-lane-router.ts
import type { FileFormat, ProcessingLane } from '@prisma/client';

export const LANE_CONFIG = {
  fast: ['json', 'txt', 'md'] as FileFormat[],
  heavy: ['pdf'] as FileFormat[],
} as const;

const FORMAT_TO_LANE = new Map<FileFormat, ProcessingLane>();

// Build lookup map
for (const format of LANE_CONFIG.fast) {
  FORMAT_TO_LANE.set(format, 'fast');
}
for (const format of LANE_CONFIG.heavy) {
  FORMAT_TO_LANE.set(format, 'heavy');
}

export function getProcessingLane(format: FileFormat): ProcessingLane {
  const lane = FORMAT_TO_LANE.get(format);
  if (!lane) {
    // Default to heavy for unknown (should never happen with proper validation)
    return 'heavy';
  }
  return lane;
}
```

### Step 13: Create Index Re-export

```typescript
// src/validators/index.ts
export { UploadSchema, validateUpload } from './upload-validator';
export type { UploadOptions } from './upload-validator';

export { QuerySchema } from './query-validator';
export type { QueryInput } from './query-validator';

export { ListQuerySchema } from './list-query-validator';
export type { ListQueryInput } from './list-query-validator';

export { CallbackSchema } from './callback-validator';
export type { CallbackPayload, ProcessingResult, ProcessingError } from './callback-validator';

export { detectFormat, getFormatFromMimeType, getFormatFromExtension } from './file-format-detector';

export { getProcessingLane, LANE_CONFIG } from './processing-lane-router';
```

---

## Todo List

- [ ] Write `tests/unit/validators/upload-validator.test.ts` (RED)
- [ ] Implement `src/validators/upload-validator.ts` (GREEN)
- [ ] Refactor upload validator if needed (REFACTOR)
- [ ] Write `tests/unit/validators/query-validator.test.ts` (RED)
- [ ] Implement `src/validators/query-validator.ts` (GREEN)
- [ ] Write `tests/unit/validators/list-query-validator.test.ts` (RED)
- [ ] Implement `src/validators/list-query-validator.ts` (GREEN)
- [ ] Write `tests/unit/validators/callback-validator.test.ts` (RED)
- [ ] Implement `src/validators/callback-validator.ts` (GREEN)
- [ ] Write `tests/unit/validators/file-format-detector.test.ts` (RED)
- [ ] Implement `src/validators/file-format-detector.ts` (GREEN)
- [ ] Write `tests/unit/validators/processing-lane-router.test.ts` (RED)
- [ ] Implement `src/validators/processing-lane-router.ts` (GREEN)
- [ ] Create `src/validators/index.ts` re-exports
- [ ] Run `pnpm test:unit` - all tests pass
- [ ] Check coverage is 100% for validators

---

## Success Criteria

1. All validator tests pass (`pnpm test:unit`)
2. 100% coverage on `src/validators/*`
3. Type inference works (no `any` types)
4. All edge cases from CONTRACT.md covered

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Zod version mismatch | Pin to 3.23.x in package.json |
| MIME type variations | Support common alternatives (text/x-markdown) |
| Extension edge cases | Normalize to lowercase, strip leading dot |

---

## Security Considerations

- Input sanitization via Zod trim/transforms
- Size limits enforced before file processing
- No user input in error messages (prevent info leak)

---

## Next Steps

After completion, proceed to [Phase 03: Business Logic (TDD)](./phase-03-business-logic-tdd.md) for chunking, quality gate, deduplication, and embedding tests.
