# Phase 02: Validation Layer (TDD)

**Parent:** [plan.md](./plan.md) | **Status:** ✅ **DONE** | **Priority:** P0

## Objectives
Build comprehensive Zod-based validation layer with type-safe schemas for all API inputs, ensuring data integrity before business logic execution.

## Acceptance Criteria
- [x] 4 Zod schemas (upload, query, list, callback)
- [x] Type-safe validation with TypeScript inference
- [x] Comprehensive edge case coverage (size limits, formats, boundaries)
- [x] 329 lines of unit tests across 4 test files
- [x] Environment-based configuration (MAX_FILE_SIZE_MB)
- [x] Detailed error messages with error codes

## Key Files & Components

### Validators (Source)
- `apps/backend/src/validators/upload-validator.ts`: File upload validation (size, format, OCR mode)
- `apps/backend/src/validators/query-validator.ts`: Search query validation (query string, topK)
- `apps/backend/src/validators/list-query-validator.ts`: List/pagination validation (status, limit, offset)
- `apps/backend/src/validators/callback-validator.ts`: AI worker callback validation (success/error payloads)

### Unit Tests (329 total lines)
- `apps/backend/tests/unit/validators/upload-validator.test.ts`: 79 lines (size, format, OCR mode tests)
- `apps/backend/tests/unit/validators/query-validator.test.ts`: 62 lines (query string, topK boundary tests)
- `apps/backend/tests/unit/validators/list-query-validator.test.ts`: 63 lines (status, pagination, coercion tests)
- `apps/backend/tests/unit/validators/callback-validator.test.ts`: 125 lines (success/error, error codes, field validation)

## Implementation Details

### 1. Upload Validator
**Schema Features:**
- OCR mode enum: `auto` | `force` | `never` (default: `auto`)
- File size limit: Configurable via `MAX_FILE_SIZE_MB` env (default: 50MB)
- Allowed formats: PDF, JSON, TXT, MD
- MIME type validation with extension fallback
- Error codes: `FILE_TOO_LARGE`, `INVALID_FORMAT`

**Test Coverage:**
- Size validation: under limit, at limit, over limit
- Format validation: all allowed types (PDF, JSON, TXT, MD)
- Rejection tests: images, Office docs, videos
- OCR mode: default, valid values, invalid values

### 2. Query Validator
**Schema Features:**
- Query string: 1-1000 chars, trimmed, non-empty
- TopK: Integer 1-100 (default: 5)
- Type-safe output via `z.infer`

**Test Coverage:**
- Query validation: valid, trimmed, empty, whitespace-only, max length
- TopK validation: default, boundaries (1, 100), out of range, non-integer

### 3. List Query Validator
**Schema Features:**
- Status filter: Optional enum (`PENDING` | `PROCESSING` | `COMPLETED` | `FAILED`)
- Limit: Integer 1-100 (default: 20)
- Offset: Integer ≥0 (default: 0)
- String coercion: Converts query params to numbers

**Test Coverage:**
- Status: all valid values, optional, invalid
- Pagination: defaults, coercion, boundaries, negative offset

### 4. Callback Validator
**Schema Features:**
- DocumentId: UUID validation
- Success boolean flag
- Success payload: markdown, pageCount (positive int), ocrApplied (bool), processingTimeMs (positive)
- Error payload: code enum (6 types), message string
- Error codes: `PASSWORD_PROTECTED`, `CORRUPT_FILE`, `UNSUPPORTED_FORMAT`, `OCR_FAILED`, `TIMEOUT`, `INTERNAL_ERROR`

**Test Coverage:**
- Success callbacks: valid payload, non-UUID rejection
- Failure callbacks: all error codes, invalid code rejection
- Field validation: positive pageCount, positive processingTimeMs

### 5. Type Safety
- All schemas export TypeScript types via `z.infer`
- Compile-time type checking for API handlers
- Auto-completion in IDEs
- Runtime validation + static typing

### 6. Error Handling
- Structured error objects with codes
- User-friendly error messages
- Validation errors include field paths
- Zod error formatting for API responses

## Verification

```bash
# Run all validator unit tests
pnpm --filter @ragbase/backend test:unit tests/unit/validators

# Run specific validator test
pnpm --filter @ragbase/backend test:unit tests/unit/validators/upload-validator.test.ts

# Watch mode for TDD
pnpm --filter @ragbase/backend test:unit tests/unit/validators --watch
```

## Critical Notes

### TDD Approach
- Tests written FIRST (RED phase)
- Schemas implemented to pass tests (GREEN phase)
- Refactored for optimization (REFACTOR phase)
- All edge cases covered before implementation

### Validation Strategy
- **Fail Fast:** Validate at API boundary before business logic
- **Type Safety:** Zod schemas generate TypeScript types automatically
- **Error Clarity:** Specific error codes and messages for debugging
- **Environment Config:** Size limits configurable via env vars

### Edge Cases Covered
- **Boundaries:** Exact limits (50MB, 1000 chars, topK=100)
- **Coercion:** String to number conversion for query params
- **Whitespace:** Trimming and empty string handling
- **Formats:** MIME type + extension fallback for reliability
- **UUIDs:** Strict UUID validation for documentId

### Design Decisions
- **Separate Validators:** Each API endpoint has dedicated schema (SRP)
- **Defaults:** Sensible defaults (topK=5, limit=20, ocrMode=auto)
- **Optional Fields:** Status filter optional for flexibility
- **Error Codes:** Enum-based codes for consistent error handling
- **Positive Numbers:** pageCount and processingTimeMs must be >0

### Integration Points
- Used in Fastify route handlers via `schema.parse()`
- Errors caught and formatted as 400 Bad Request
- Types exported for use in services and business logic
- Callback validator ensures AI worker contract compliance
