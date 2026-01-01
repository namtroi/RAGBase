# Phase 5: Production-Readiness (Qdrant & Security)

**Goal:** Production-grade security with per-user Drive OAuth (AES encrypted) and scalable Hybrid Search using Qdrant (Dense + Sparse).

---

## 1. Google Drive OAuth (Per-User & Secured)

Move from shared Service Account to user-centric OAuth 2.0 flow, with military-grade encryption for stored credentials.

### 1.1 Authentication Flow
1.  **Initiate**: User clicks "Connect Drive" -> Redirect to Google.
2.  **Callback**: Exchange code for `access_token` + `refresh_token`.
3.  **Encryption**:
    -   Algorithm: **AES-256-GCM**
    -   Key: `APP_ENCRYPTION_KEY` (32-byte hex from `.env`)
    -   Payload: Encrypt `refresh_token` before database insertion.
4.  **Storage**: Save encrypted token in `DriveConfig`.

### 1.2 Synchronization Updates
- **Decryption**: On Sync Job start, decrypt `refresh_token` using the env key.
- **Dynamic Client**: Instantiate `DriveService` with the decrypted user credentials.

---

## 2. Advanced Qdrant Integration (Hybrid Search)

Replace `pgvector` and `tsvector` with Qdrant's native Multi-Vector support (Dense + Sparse) for superior retrieval quality and scalability.

### 2.1 Search Architecture (Hybrid)
We will leverage Qdrant's ability to store and search both dense and sparse vectors in a single query using **Reciprocal Rank Fusion (RRF)**.

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Dense Vector** | `fastembed` (bge-small-en-v1.5) | Semantic understanding (Concept matching) |
| **Sparse Vector** | `fastembed` (SPLADE/BGE-M3) | Keyword matching (Exact term matching, Neural Sparse) |
| **Fusion** | Qdrant RRF | Combine scores for best-of-both-worlds results |

### 2.2 Data Sync Strategy: The "Outbox Pattern"

To prevent "Dual Write" issues and keep PostgreSQL lightweight (removing heavy vectors after sync).

**Workflow:**

1.  **Staging (Write)**:
    -   AI Worker returns `Dense` + `Sparse` vectors.
    -   Backend saves to PostgreSQL `Chunk` table.
    -   **Status**: `PENDING`
    -   **Data**: `content`, `metadata`, `vectors` (temporarily stored).
2.  **Sync (Job Queue)**:
    -   BullMQ Job (`qdrant-sync`) polls for `PENDING` chunks.
    -   Batch pushes to Qdrant Collection.
3.  **Cleanup (Update)**:
    -   On Qdrant success -> Update `Chunk` status to `SYNCED`.
    -   **CRITICAL**: Set `vector` columns in PostgreSQL to `NULL` to free up storage.

---

## 3. Data Flow Diagrams

### 3.1 Ingestion (Write Path)
```mermaid
graph LR
    Worker[AI Worker] -->|Dense + Sparse| Backend
    Backend -->|Insert (State: PENDING)| Postgres[(PostgreSQL)]
    Postgres -->|Poll PENDING| Queue[BullMQ: Qdrant Sync]
    Queue -->|Push Vectors| Qdrant[(Qdrant)]
    Qdrant -->|Example Success| Backend
    Backend -->|Update SYNCED + Nullify Vectors| Postgres
```

### 3.2 Retrieval (Read Path)
```mermaid
graph LR
    User -->|Query| Backend
    Backend -->|Embed (Dense + Sparse)| Worker
    Worker -->|Vectors| Backend
    Backend -->|Hybrid Search (RRF)| Qdrant
    Qdrant -->|Top K IDs| Backend
    Backend -->|Fetch Content| Postgres
    Postgres -->|Full Text| Backend
    Backend -->|Results| User
```

---

## 4. Configuration

### 4.1 Environment Variables
```bash
# Security
APP_ENCRYPTION_KEY=... # 32-byte hex string

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=...
QDRANT_COLLECTION=ragbase_hybrid

# Feature Flags
VECTOR_DB_PROVIDER=qdrant
```

---

## 5. Database Schema Changes

### 5.1 Chunk Model Updates

```prisma
model Chunk {
  // ... existing fields ...

  // Qdrant Sync (NEW)
  syncStatus    SyncStatus @default(PENDING) @map("sync_status")
  denseVector   Float[]?   @map("dense_vector")   // Nullable after sync
  sparseIndices Int[]?     @map("sparse_indices") // Nullable after sync
  sparseValues  Float[]?   @map("sparse_values")  // Nullable after sync
  qdrantId      String?    @map("qdrant_id")      // Qdrant point ID
}

enum SyncStatus {
  PENDING
  SYNCED
  FAILED
}
```

### 5.2 DriveConfig Updates

```prisma
model DriveConfig {
  // ... existing fields ...
  
  // Store encrypted tokens (AES-256-GCM)
  encryptedRefreshToken String? @map("encrypted_refresh_token")
  tokenIv               String? @map("token_iv")       // Initialization Vector
  tokenAuthTag          String? @map("token_auth_tag") // Auth tag for GCM
}
```

---

## 6. Implementation Checklist

### Security (AES-256-GCM)
- [x] Create `EncryptionService` (encrypt, decrypt).
- [x] Update `DriveOAuth` model to hold encrypted credentials.
- [x] Update OAuth Callback to encrypt before save.
- [x] Update SyncService to decrypt before use.

### AI Worker (Neural Sparse Vectors)
- [x] Add `fastembed` library (supports BM25).
- [x] Update `HybridEmbedder` to return `{ dense: [...], sparse: { indices: [...], values: [...] } }`.
- [x] Update job response schema for dual vectors.

### Backend - Outbox Pattern
- [x] Update `Chunk` model: Add `syncStatus` (PENDING/SYNCED/FAILED), make vectors nullable.
- [x] Create `QdrantSyncQueue` and Processor.
- [x] Implement `QdrantService` (upsert, hybrid search, delete).
- [x] Implement Cleanup Logic (Nullify local vectors after sync).
- [x] Add retry logic for failed syncs.

### Search
- [x] Refactor `SearchService` to call `QdrantService.search`.
- [x] Implement hybrid query with RRF fusion.
- [x] Remove `pgvector` search logic.
- [x] Update search API response format.

### Testing
- [x] Unit tests for encryption/decryption.
- [x] Integration tests for Qdrant sync flow.
- [x] E2E tests for hybrid search.

---

## 7. Key Decisions

| Decision | Rationale |
|----------|-----------|
| **AES-256-GCM** | AEAD cipher, industry standard for sensitive data |
| **Qdrant over pgvector** | Native hybrid search, better scalability |
| **SPLADE (Neural Sparse)** | Stateless (no corpus needed), works with AI Worker |
| **Outbox Pattern** | Avoid dual-write issues, keep Postgres lightweight |
| **Nullify vectors after sync** | Massive storage savings (90%+) |
| **fastembed** | Lightweight, CPU-friendly, supports both dense + sparse |

---

## 8. Success Criteria

**Phase 5 complete when:**
- ✅ Drive OAuth tokens encrypted with AES-256-GCM
- ✅ Encryption/decryption working in sync flow
- ✅ AI Worker returns dense + sparse vectors
- ✅ Qdrant collection created and accepting upserts
- ✅ Outbox pattern working (PENDING → SYNCED)
- ✅ Hybrid search returning results from Qdrant
- ✅ PostgreSQL vectors nullified after sync
- ✅ Zero regression in Phase 1-4 functionality
- ✅ Tests passing (unit + integration + E2E)
