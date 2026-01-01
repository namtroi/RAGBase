# Phase 3: Data Management

**Goal:** Transform Documents view into comprehensive data management interface with lifecycle controls.

**Status:** ✅ COMPLETE

---

## Problem Statement

Current limitations:
- No way to delete documents (only soft archive via Drive disconnect)
- No way to exclude documents from AI search without deleting
- No bulk operations for managing large datasets
- Drive disconnect orphans documents without clear state indication
- Limited filtering/sorting options

---

## Core Features

### 1. Document Lifecycle States

**Availability State** (user-controlled):
- `ACTIVE` - AI includes in search (default)
- `INACTIVE` - AI ignores, still in DB

**Connection State** (system-controlled):
- `LINKED` - Active Drive sync
- `STANDALONE` - Manual upload or disconnected

**Rules:**
- FAILED documents = implicit INACTIVE (no chunks)
- Toggle only affects COMPLETED documents
- Delete DriveConfig → LINKED becomes STANDALONE

---

### 2. Hard Delete

**What gets deleted:**
- Document record
- All chunks (cascade)
- File on disk
- Vector embeddings

**Restrictions:**
- Cannot delete PROCESSING documents
- Confirmation required for bulk delete

---

### 3. Bulk Operations

**Supported actions:**
- Toggle Active/Inactive (batch)
- Hard Delete (batch, max 100 per request)

**UI constraints:**
- Only affects selected documents in current page
- Confirmation dialog with document count
- Typing "DELETE" required for bulk delete > 10

---

### 4. Drive Re-link

**Scenario:** User removes DriveConfig, later re-adds same folder.

**Behavior:**
- Check `driveFileId` match before MD5 dedup
- Re-link existing document to new config
- If content changed (MD5 differs), re-process

**Benefits:**
- No duplicate data
- Preserves document history

---

### 5. Enhanced Filtering

**New filters:**
- `isActive` (boolean)
- `connectionState` (LINKED/STANDALONE)
- `sourceType` (MANUAL/DRIVE)
- `search` (filename, case-insensitive)

**New sorting:**
- `sortBy`: createdAt, updatedAt, filename, fileSize
- `sortOrder`: asc, desc

---

## API Changes

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/documents/:id/availability` | Toggle single |
| PATCH | `/api/documents/bulk/availability` | Toggle batch |
| DELETE | `/api/documents/:id` | Hard delete single |
| DELETE | `/api/documents/bulk` | Hard delete batch |
| POST | `/api/documents/:id/retry` | Retry failed |

### Updated Endpoints

| Endpoint | Changes |
|----------|---------|
| `GET /api/documents` | New filters, sorting, counts |
| `POST /api/query` | Filter by `isActive = true` |

---

## Database Changes

```prisma
model Document {
  // New fields
  isActive        Boolean  @default(true)
  connectionState String   @default("STANDALONE")
  
  // New indexes
  @@index([isActive])
  @@index([connectionState])
}
```

---

## Frontend Changes

### Document List (Data Grid)

**New columns:**
- Availability toggle (switch component)
- Connection state (icon indicator)
- File size
- Actions menu

**New controls:**
- Search input
- Filter dropdowns
- Bulk selection
- Bulk action buttons

### Status Indicators

| State | Badge | Color |
|-------|-------|-------|
| Pending | ⏳ | Gray |
| Processing | 🔄 | Blue |
| Active | ✅ | Green |
| Inactive | 🔕 | Yellow |
| Failed | ❌ | Red |

---

## Implementation Order

1. **Database migration** - Add columns, backfill data
2. **Backend API** - New endpoints, update list/query
3. **Re-link logic** - Update sync service
4. **Frontend list** - Enhanced table with controls
5. **Bulk operations** - Selection + action handlers
6. **SSE events** - New event types

---

## Success Criteria

- [x] User can toggle document visibility (active/inactive)
- [x] User can hard delete documents
- [x] User can bulk select and operate on documents
- [x] Disconnected Drive documents show STANDALONE state
- [x] Re-adding Drive folder re-links existing documents
- [x] Query excludes inactive documents
- [x] All operations emit SSE events
- [x] Existing tests pass, new tests added

---

## Estimated Effort

| Part | Description | Est. Hours |
|------|-------------|------------|
| 3A | Database migration | 1h |
| 3B | Toggle availability API | 2h |
| 3C | Hard delete API | 2h |
| 3D | Bulk operations API | 3h |
| 3E | Retry failed API | 1h |
| 3F | Enhanced list API | 2h |
| 3G | Re-link logic | 2h |
| 3H | Frontend data grid | 4h |
| 3I | Bulk operations UI | 3h |
| **Total** | | **~20h** |

---

## Dependencies

- Phase 2 complete (Drive sync, SSE) ✅
- No external dependencies

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Accidental bulk delete | Confirmation dialog, typing requirement |
| Re-link conflicts | driveFileId is unique, clear error messages |
| Performance with large datasets | Pagination, DB indexes |

---

**Phase 3 Status:** ✅ COMPLETE

