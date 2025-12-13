# SchemaForge Architecture

Technical implementation details for the core pipeline.

---

## 1. Service Communication

**Pattern:** BullMQ (async queue) + HTTP Callback

```
┌────────────────┐       Redis/BullMQ       ┌────────────────┐
│  app-backend   │ ───── Job Queue ───────► │   ai-worker    │
│   (Node.js)    │                          │   (Python)     │
│                │ ◄── HTTP POST callback ─ │                │
└────────────────┘                          └────────────────┘
```

| Component | Role |
|-----------|------|
| **Node.js** | Producer - push jobs with `{documentId, filePath, config}` |
| **Python** | Consumer - poll queue, process with Docling, POST result back |
| **Redis** | Message broker for BullMQ |

**Config:**
```yaml
environment:
  - REDIS_URL=redis://redis:6379
  - CALLBACK_URL=http://app-backend:3000/internal/callback
```

---

## 2. Embedding Pipeline

**Decision:** Node.js handles embedding (no Python dependency)

```
PDF/DOCX → [Python: Docling → Markdown] → callback
                                              ↓
         [Node.js: LangChain Chunking → Embedding → pgvector]
```

| Provider | Implementation |
|----------|----------------|
| **Self-hosted** (default) | `@xenova/transformers` - ONNX runtime in Node.js |
| **OpenAI** (opt-in) | `@langchain/openai` - API call |

**Config:**
```yaml
environment:
  - EMBEDDING_PROVIDER=self-hosted  # or 'openai'
  - EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
  - EMBEDDING_BATCH_SIZE=50
```

---

## 3. Error Handling

**Strategy:** 3-Tier with Dead Letter Queue

```
Job Failed
    │
    ▼
┌─────────────────────┐
│ Tier 1: Retry 3x    │  ← exponential backoff (5s→10s→20s)
└──────────┬──────────┘
           │ still fails
           ▼
┌─────────────────────┐
│ Tier 2: Dead Letter │  ← move to DLQ, update DB status=FAILED
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Tier 3: Alert       │  ← webhook/email (optional)
└─────────────────────┘
```

| Category | Example | Action |
|----------|---------|--------|
| `RETRYABLE` | Network timeout | Retry 3x |
| `PERMANENT` | Password-protected PDF | Move to DLQ immediately |
| `RESOURCE` | OOM, disk full | Alert + pause queue |

**Config:**
```yaml
environment:
  - ALERT_WEBHOOK_URL=https://hooks.slack.com/xxx
  - ALERT_THRESHOLD=5  # Alert if 5+ failures/hour
```

---

## 4. Container Network

```yaml
services:
  app-backend:
    networks: [internal]
    depends_on: [redis, postgres-db]
  ai-worker:
    networks: [internal]
    depends_on: [redis]
  postgres-db:
    networks: [internal]
  redis:
    image: redis:7-alpine
    networks: [internal]

networks:
  internal:
    driver: bridge
```

---

## 5. OCR Workflow

**Strategy:** Hybrid detection + user override

```
PDF Upload → Extract first 3 pages (no OCR)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    Has text?               No text?
         │                       │
         ▼                       ▼
     Digital                 Scanned
    (skip OCR)            (trigger OCR)
```

| Mode | Trigger | Behavior |
|------|---------|----------|
| `auto` | text < 50 chars/page | Auto-enable OCR |
| `force` | User opt-in | Always OCR |
| `never` | User opt-out | Skip OCR |

**Language Detection:**
- `auto` - Auto-detect (slower)
- `en,vi` - Fixed languages (faster)
- `vi` - Single language (fastest)

**Config:**
```yaml
environment:
  - OCR_MODE=auto
  - OCR_LANGUAGES=en,vi
```

---

## 6. Drive Sync

**Strategy:** Optimistic locking + state machine

```
PENDING → PROCESSING → COMPLETED
               │            │
               ▼            ▼
            FAILED       OUTDATED (file updated on Drive)
```

| Scenario | Action |
|----------|--------|
| File updated while processing | Mark `OUTDATED` → re-queue |
| File deleted while processing | Complete → mark `ARCHIVED` |
| File moved to other folder | Update `sourceUrl`, continue |
| Sync interval miss | Persist `pageToken` for Changes API |

**Config:**
```yaml
environment:
  - DRIVE_SYNC_CRON=*/30 * * * *  # Every 30 mins
  - DRIVE_CONFLICT_STRATEGY=requeue
```

---

## 7. Database Scaling

**Index Strategy:** HNSW for 100K+ vectors

| Dataset Size | Index | Query Time |
|--------------|-------|------------|
| < 100K | IVFFlat | ~10ms |
| 100K - 1M | HNSW | ~5ms |
| > 1M | HNSW + Partitioning | ~5ms |

```sql
CREATE INDEX ON chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Connection Pooling:** PgBouncer recommended for production.

**Config:**
```yaml
environment:
  - PGVECTOR_INDEX_TYPE=hnsw
  - PG_POOL_SIZE=20
```

---

## 8. Multi-tenant (Phase 3+)

**Strategy:** Row-Level Security (RLS)

| Level | Implementation | Use Case |
|-------|----------------|----------|
| Shared DB + RLS | Row filtering | SME |
| Separate Schemas | Per-tenant schema | Enterprise |
| Separate DBs | Full isolation | Regulated |

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

**Config:**
```yaml
environment:
  - MULTI_TENANT_ENABLED=false  # Enable in Phase 3
  - TENANT_ISOLATION_LEVEL=rls
```

---

## 9. Security

**Secret Storage:**

| Environment | Strategy |
|-------------|----------|
| Development | `.env` file |
| Production | Docker Secrets / Cloud KMS |

**JWT Management:**
- Algorithm: RS256 (asymmetric keys)
- Rotation: Manual via `JWT_KEY_VERSION`
- Storage: Docker secrets or external KMS

**Input Sanitization:**
```typescript
const QuerySchema = z.object({
  query: z.string().min(1).max(1000).trim(),
  topK: z.number().int().min(1).max(100).default(5),
});
```

---

## 10. Quality Gate

**Text Validation:**

| Condition | Action | Config |
|-----------|--------|--------|
| `length < 50` | Reject | `MIN_TEXT_LENGTH=50` |
| `noise > 50%` | Warn | `MAX_NOISE_RATIO=0.5` |
| `noise > 80%` | Reject | `REJECT_NOISE_RATIO=0.8` |

**Noise Calculation:**
```
Noise = (non-alphanumeric chars) / (total chars) × 100%
```

**Config:**
```yaml
environment:
  - MIN_TEXT_LENGTH=50
  - MAX_NOISE_RATIO=0.5
  - REJECT_NOISE_RATIO=0.8
```
