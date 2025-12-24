# Phase 3 Detailed Implementation Plan

**Data Management** | **TDD Approach**

---

## Overview

| Part | Name | Description | Status |
|------|------|-------------|--------|
| **3A** | Database Migration | Add `isActive`, `connectionState` columns | ✅ Complete |
| **3B** | Toggle Availability API | Single + bulk toggle endpoints | ✅ Complete |
| **3C** | Hard Delete API | Single + bulk delete endpoints | ✅ Complete |
| **3D** | Retry Failed API | Re-queue failed documents | ✅ Complete |
| **3E** | Enhanced List API | Filters, sorting, counts | ✅ Complete |
| **3F** | Query Filter Update | Exclude inactive from search | ✅ Complete |
| **3G** | Re-link Logic | Auto re-link when re-adding Drive folder | ✅ Complete |
| **3H** | Frontend Data Grid | Enhanced document list UI | ✅ Complete |
| **3I** | Bulk Operations UI | Selection + action handlers | ⬜ Pending |

---

## Part 3A: Database Migration ✅

**Status:** Complete  
**Implementation:** `apps/backend/prisma/schema.prisma`

### TDD Steps:

1. **Write migration test**
   ```typescript
   // tests/integration/migrations/phase3-migration.test.ts
   it('should add isActive column with default true')
   it('should add connectionState column with default STANDALONE')
   it('should backfill LINKED for documents with driveConfigId')
   ```

2. **Update Prisma schema**
   ```prisma
   model Document {
     isActive        Boolean  @default(true) @map("is_active")
     connectionState String   @default("STANDALONE") @map("connection_state")
     
     @@index([isActive])
     @@index([connectionState])
   }
   ```

3. **Run migration**
   ```bash
   pnpm db:push
   ```

4. **Backfill data**
   ```sql
   UPDATE documents 
   SET connection_state = 'LINKED' 
   WHERE source_type = 'DRIVE' AND drive_config_id IS NOT NULL;
   ```

### Files:
- `apps/backend/prisma/schema.prisma`

---

## Part 3B: Toggle Availability API ✅

**Status:** Complete  
**Implementation:** `apps/backend/src/routes/documents/availability-route.ts`

### TDD Steps:

1. **Write unit tests**
   ```typescript
   // tests/unit/validators/availability-validator.test.ts
   it('should validate isActive boolean')
   it('should validate documentIds array max 100')
   it('should reject empty documentIds array')
   ```

2. **Write integration tests**
   ```typescript
   // tests/integration/routes/documents/availability-route.test.ts
   describe('PATCH /api/documents/:id/availability', () => {
     it('should toggle COMPLETED document to inactive')
     it('should toggle inactive document to active')
     it('should return 400 for PENDING document')
     it('should return 400 for PROCESSING document')
     it('should return 400 for FAILED document')
     it('should return 404 for non-existent document')
     it('should emit SSE event document:availability')
   })
   
   describe('PATCH /api/documents/bulk/availability', () => {
     it('should toggle multiple documents')
     it('should skip non-COMPLETED documents')
     it('should return partial success response')
     it('should reject more than 100 documents')
   })
   ```

3. **Implement endpoints**

### Endpoints:
```
PATCH /api/documents/:id/availability
Body: { isActive: boolean }
Response: { id, isActive, updatedAt }

PATCH /api/documents/bulk/availability
Body: { documentIds: string[], isActive: boolean }
Response: { updated: number, failed: [{ id, reason }] }
```

### Files:
- `apps/backend/src/routes/documents/availability-route.ts`
- `apps/backend/src/validators/availability-validator.ts`
- `apps/backend/tests/unit/validators/availability-validator.test.ts`
- `apps/backend/tests/integration/routes/documents/availability-route.test.ts`

---

## Part 3C: Hard Delete API ✅

**Status:** Complete  
**Implementation:** `apps/backend/src/routes/documents/delete-route.ts`

### TDD Steps:

1. **Write integration tests**
   ```typescript
   // tests/integration/routes/documents/delete-route.test.ts
   describe('DELETE /api/documents/:id', () => {
     it('should delete document and chunks')
     it('should delete file from disk')
     it('should return 404 for non-existent document')
     it('should return 409 for PROCESSING document')
     it('should emit SSE event document:deleted')
   })
   
   describe('DELETE /api/documents/bulk', () => {
     it('should delete multiple documents')
     it('should skip PROCESSING documents')
     it('should return partial success response')
     it('should reject more than 100 documents')
   })
   ```

2. **Implement delete service**
   ```typescript
   // services/document-service.ts
   async hardDeleteDocument(id: string): Promise<void>
   async bulkDeleteDocuments(ids: string[]): Promise<BulkResult>
   ```

3. **Implement endpoints**

### Endpoints:
```
DELETE /api/documents/:id
Response: { id, deleted: true }

DELETE /api/documents/bulk
Body: { documentIds: string[] }
Response: { deleted: number, failed: [{ id, reason }] }
```

### Files:
- `apps/backend/src/routes/documents/delete-route.ts`
- `apps/backend/src/services/document-service.ts`
- `apps/backend/tests/integration/routes/documents/delete-route.test.ts`

---

## Part 3D: Retry Failed API ✅

**Status:** Complete  
**Implementation:** `apps/backend/src/routes/documents/retry-route.ts`

### TDD Steps:

1. **Write integration tests**
   ```typescript
   // tests/integration/routes/documents/retry-route.test.ts
   describe('POST /api/documents/:id/retry', () => {
     it('should reset FAILED document to PENDING')
     it('should re-queue document for processing')
     it('should clear failReason')
     it('should return 400 for non-FAILED document')
     it('should return 404 for non-existent document')
   })
   ```

2. **Implement endpoint**

### Endpoint:
```
POST /api/documents/:id/retry
Response: { id, status: 'PENDING' }
```

### Files:
- `apps/backend/src/routes/documents/retry-route.ts`
- `apps/backend/tests/integration/routes/documents/retry-route.test.ts`

---

## Part 3E: Enhanced List API ✅

**Status:** Complete  
**Implementation:** `apps/backend/src/routes/documents/list-route.ts`

### TDD Steps:

1. **Write unit tests for query validation**
   ```typescript
   // tests/unit/validators/list-query-validator.test.ts
   it('should validate isActive filter')
   it('should validate connectionState filter')
   it('should validate sourceType filter')
   it('should validate search string')
   it('should validate sortBy enum')
   it('should validate sortOrder enum')
   ```

2. **Write integration tests**
   ```typescript
   // tests/integration/routes/documents/list-route.test.ts
   describe('GET /api/documents', () => {
     it('should filter by isActive')
     it('should filter by connectionState')
     it('should filter by sourceType')
     it('should search by filename (case-insensitive)')
     it('should sort by createdAt asc/desc')
     it('should sort by filename')
     it('should sort by fileSize')
     it('should return counts in response')
     it('should combine multiple filters')
   })
   ```

3. **Update list endpoint**

### Query Params:
```
GET /api/documents?
  status=COMPLETED&
  isActive=true&
  connectionState=LINKED&
  sourceType=DRIVE&
  search=invoice&
  sortBy=createdAt&
  sortOrder=desc&
  limit=20&
  offset=0
```

### Response:
```typescript
{
  documents: DocumentSummary[],
  total: number,
  counts: {
    total: number,
    active: number,
    inactive: number,
    failed: number,
    pending: number
  }
}
```

### Files:
- `apps/backend/src/routes/documents/list-route.ts`
- `apps/backend/src/validators/list-query-validator.ts`
- `apps/backend/tests/unit/validators/list-query-validator.test.ts`
- `apps/backend/tests/integration/routes/documents/list-route.test.ts`

---

## Part 3F: Query Filter Update ✅

**Status:** Complete  
**Implementation:** `apps/backend/src/routes/query-route.ts`

### TDD Steps:

1. **Write integration tests**
   ```typescript
   // tests/integration/routes/query-route.test.ts (add to existing)
   it('should exclude inactive documents from search')
   it('should exclude FAILED documents from search')
   it('should only return chunks from COMPLETED + active documents')
   ```

2. **Update query SQL**
   ```sql
   WHERE d.status = 'COMPLETED' AND d.is_active = true
   ```

### Files:
- `apps/backend/src/routes/query-route.ts`
- `apps/backend/tests/integration/routes/query-route.test.ts`

---

## Part 3G: Re-link Logic ✅

**Status:** Complete  
**Implementation:** `apps/backend/src/services/sync-service.ts`

### TDD Steps:

1. **Write unit tests**
   ```typescript
   // tests/unit/services/sync-service.test.ts
   describe('re-link behavior', () => {
     it('should find existing document by driveFileId')
     it('should update driveConfigId on re-link')
     it('should set connectionState to LINKED')
     it('should trigger re-process if MD5 changed')
     it('should skip processing if MD5 unchanged')
   })
   ```

2. **Write integration tests**
   ```typescript
   // tests/integration/services/sync-service.test.ts
   describe('syncFile re-link', () => {
     it('should re-link document when re-adding folder')
     it('should not create duplicate when driveFileId matches')
   })
   ```

3. **Update sync-service.ts addFile function**

4. **Update DriveConfig delete to set connectionState**
   ```typescript
   // Before deleting config
   await prisma.document.updateMany({
     where: { driveConfigId: configId },
     data: { connectionState: 'STANDALONE' }
   });
   ```

### Files:
- `apps/backend/src/services/sync-service.ts`
- `apps/backend/src/routes/drive/config-routes.ts` (delete handler)
- `apps/backend/tests/unit/services/sync-service.test.ts`
- `apps/backend/tests/integration/services/sync-service.test.ts`

---

## Part 3H: Frontend Data Grid ✅

**Status:** Complete  
**Implementation:** `apps/frontend/src/components/documents/*`

### Components:

1. **DocumentTable.tsx** - Enhanced table with new columns
   - Status badge (icon + color)
   - Availability toggle (switch)
   - Connection state indicator
   - File size column
   - Actions dropdown

2. **DocumentFilters.tsx** - Filter controls
   - Search input
   - Status dropdown
   - Availability dropdown
   - Connection state dropdown
   - Source type dropdown
   - Sort controls

3. **StatusBadge.tsx** - Status display
   - Pending: gray, ⏳
   - Processing: blue animated, 🔄
   - Active: green, ✅
   - Inactive: yellow, 🔕
   - Failed: red, ❌

4. **AvailabilityToggle.tsx** - Switch component
   - Disabled for non-COMPLETED
   - Optimistic update
   - SSE sync

### Files:
- `apps/frontend/src/components/documents/DocumentTable.tsx`
- `apps/frontend/src/components/documents/DocumentFilters.tsx`
- `apps/frontend/src/components/documents/StatusBadge.tsx`
- `apps/frontend/src/components/documents/AvailabilityToggle.tsx`
- `apps/frontend/src/api/documents.ts` (new API methods)

---

## Part 3I: Bulk Operations UI ⬜

**Status:** Pending  
**Implementation:** `apps/frontend/src/components/documents/*`

### Components:

1. **BulkActionBar.tsx** - Floating action bar
   - Shows when items selected
   - Count display
   - Toggle Active/Inactive buttons
   - Delete button

2. **DeleteConfirmModal.tsx** - Confirmation dialog
   - Show document count
   - List first 5 filenames
   - "and X more" for large selections
   - Require typing "DELETE" for >10 documents

3. **Selection hooks**
   ```typescript
   // hooks/use-selection.ts
   useSelection(): {
     selected: Set<string>,
     toggle: (id: string) => void,
     selectAll: (ids: string[]) => void,
     clear: () => void,
     isAllSelected: boolean
   }
   ```

### Files:
- `apps/frontend/src/components/documents/BulkActionBar.tsx`
- `apps/frontend/src/components/documents/DeleteConfirmModal.tsx`
- `apps/frontend/src/hooks/use-selection.ts`
- `apps/frontend/src/api/documents.ts` (bulk methods)

---

## SSE Events

### New Events:
```typescript
document:deleted    { id: string }
document:availability { id: string, isActive: boolean }
bulk:completed      { operation: 'delete' | 'toggle', count: number }
```

### Files:
- `apps/backend/src/services/event-bus.ts`

---

## Test Commands

```bash
# Run all backend tests
cd apps/backend && pnpm test

# Run specific test file
cd apps/backend && pnpm test -- availability-route.test.ts

# Run frontend build check
cd apps/frontend && pnpm build

# Full suite
pnpm test
```

---

## Implementation Order

```
3A (Migration) → 3B (Toggle) → 3C (Delete) → 3D (Retry)
                      ↓
3E (List) → 3F (Query) → 3G (Re-link)
                      ↓
           3H (Data Grid) → 3I (Bulk UI)
```

Dependencies:
- 3B-3G can run in parallel after 3A
- 3H depends on 3B, 3C, 3E
- 3I depends on 3H

---

## Estimated Timeline

| Part | Estimated | Description |
|------|-----------|-------------|
| 3A | 1h | DB migration |
| 3B | 2h | Toggle API |
| 3C | 2h | Delete API |
| 3D | 1h | Retry API |
| 3E | 2h | Enhanced list |
| 3F | 1h | Query filter |
| 3G | 2h | Re-link logic |
| 3H | 4h | Frontend grid |
| 3I | 3h | Bulk UI |
| **Total** | **~18h** | |

---

**Phase 3 Status:** ⬜ NOT STARTED

