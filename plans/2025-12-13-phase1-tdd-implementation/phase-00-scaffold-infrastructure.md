# Phase 00: Project Scaffold & Infrastructure

**Parent:** [plan.md](./plan.md) | **Dependencies:** None | **Blocks:** All phases

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P0 (Critical) |
| Est. Hours | 8 |
| Status | Pending |

**Description:** Set up project structure, Docker infrastructure, Prisma schema with pgvector, and CI/CD pipeline. Foundation for all subsequent work.

---

## Key Insights (from Research)

- Prisma 5.7+ supports pgvector via `Unsupported("vector(384)")` type
- HNSW index requires manual SQL migration (Prisma doesn't auto-create)
- Use pnpm for faster installs and disk efficiency
- Node.js 20 LTS for long-term support

---

## Requirements

### Acceptance Criteria
- [ ] `docker compose up` starts all 4 services (backend, ai-worker, postgres, redis)
- [ ] Prisma generates types including Document and Chunk models
- [ ] pgvector extension enabled in PostgreSQL
- [ ] Environment variables documented in `.env.example`
- [ ] GitHub Actions CI runs on push to main/PR

---

## Architecture

### Project Structure

```
schemaforge/
├── apps/
│   ├── backend/           # Node.js Fastify API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── validators/
│   │   │   ├── workers/
│   │   │   └── index.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ai-worker/         # Python FastAPI
│       ├── src/
│       │   ├── main.py
│       │   ├── processor.py
│       │   └── consumer.py
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   └── shared/            # Shared types (optional, Phase 2+)
├── tests/
│   ├── fixtures/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker/
│   ├── backend.Dockerfile
│   ├── ai-worker.Dockerfile
│   └── postgres-init.sql
├── docker-compose.yml
├── docker-compose.test.yml
├── .github/workflows/
│   └── ci.yml
├── .env.example
├── package.json           # Root workspace
├── pnpm-workspace.yaml
└── turbo.json             # Optional: Turborepo
```

### Docker Services

```yaml
# docker-compose.yml
services:
  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    ports: ["3000:3000"]
    depends_on: [redis, postgres]
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/schemaforge
      - REDIS_URL=redis://redis:6379
      - API_KEY=${API_KEY}
    networks: [internal]

  ai-worker:
    build:
      context: .
      dockerfile: docker/ai-worker.Dockerfile
    depends_on: [redis]
    environment:
      - REDIS_URL=redis://redis:6379
      - CALLBACK_URL=http://backend:3000/internal/callback
      - OCR_ENABLED=${OCR_ENABLED:-false}
    networks: [internal]

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=schemaforge
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql
    ports: ["5432:5432"]
    networks: [internal]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    networks: [internal]

networks:
  internal:
    driver: bridge

volumes:
  postgres-data:
```

---

## Related Code Files

| File | Purpose |
|------|---------|
| `apps/backend/package.json` | Node.js dependencies |
| `apps/backend/tsconfig.json` | TypeScript configuration |
| `apps/backend/prisma/schema.prisma` | Database schema |
| `apps/ai-worker/requirements.txt` | Python dependencies |
| `docker-compose.yml` | Service orchestration |
| `docker/backend.Dockerfile` | Backend container |
| `docker/ai-worker.Dockerfile` | Python worker container |
| `docker/postgres-init.sql` | pgvector extension setup |
| `.github/workflows/ci.yml` | CI pipeline |
| `.env.example` | Environment template |

---

## Implementation Steps

### Step 1: Initialize Monorepo

```bash
# Root package.json
pnpm init
```

```json
// package.json
{
  "name": "schemaforge",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Step 2: Backend Package Setup

```json
// apps/backend/package.json
{
  "name": "@schemaforge/backend",
  "version": "0.1.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/multipart": "^8.3.0",
    "@prisma/client": "^5.22.0",
    "zod": "^3.23.0",
    "bullmq": "^5.12.0",
    "ioredis": "^5.4.0",
    "@xenova/transformers": "^2.17.0",
    "@langchain/core": "^0.3.0",
    "langchain": "^0.3.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tsx": "^4.19.0",
    "@types/node": "^20.14.0",
    "vitest": "^2.0.0",
    "@testcontainers/postgresql": "^10.13.0",
    "@testcontainers/redis": "^10.13.0",
    "prisma": "^5.22.0"
  }
}
```

### Step 3: TypeScript Configuration

```json
// apps/backend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 4: Prisma Schema

```prisma
// apps/backend/prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

enum DocumentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum FileFormat {
  pdf
  json
  txt
  md
}

enum ProcessingLane {
  fast
  heavy
}

model Document {
  id          String         @id @default(uuid())
  filename    String
  mimeType    String         @map("mime_type")
  fileSize    Int            @map("file_size")
  format      FileFormat
  lane        ProcessingLane
  status      DocumentStatus @default(PENDING)
  filePath    String         @map("file_path")
  md5Hash     String         @map("md5_hash")
  retryCount  Int            @default(0) @map("retry_count")
  failReason  String?        @map("fail_reason")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  chunks      Chunk[]

  @@unique([md5Hash])
  @@map("documents")
}

model Chunk {
  id          String   @id @default(uuid())
  documentId  String   @map("document_id")
  content     String
  chunkIndex  Int      @map("chunk_index")
  embedding   Unsupported("vector(384)")
  charStart   Int      @map("char_start")
  charEnd     Int      @map("char_end")
  page        Int?
  heading     String?
  createdAt   DateTime @default(now()) @map("created_at")

  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, chunkIndex])
  @@map("chunks")
}
```

### Step 5: PostgreSQL Init Script

```sql
-- docker/postgres-init.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW index (created after first migration)
-- CREATE INDEX chunks_embedding_hnsw ON chunks
-- USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);
```

### Step 6: Backend Dockerfile

```dockerfile
# docker/backend.Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/backend/prisma apps/backend/prisma/

# Install deps
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @schemaforge/backend db:generate

# Copy source
COPY apps/backend/src apps/backend/src
COPY apps/backend/tsconfig.json apps/backend/

# Build
RUN pnpm --filter @schemaforge/backend build

# Production image
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/node_modules/.prisma ./node_modules/.prisma

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Step 7: Python Worker Dockerfile

```dockerfile
# docker/ai-worker.Dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for Docling
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY apps/ai-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY apps/ai-worker/src ./src

ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "src.main"]
```

### Step 8: Python Requirements

```txt
# apps/ai-worker/requirements.txt
fastapi==0.115.0
uvicorn==0.32.0
docling==2.10.0
bullmq==0.4.0
redis==5.2.0
httpx==0.27.0
pydantic==2.9.0
structlog==24.4.0
```

### Step 9: Environment Template

```bash
# .env.example
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/schemaforge

# Redis
REDIS_URL=redis://localhost:6379

# API
API_KEY=your-secret-api-key-change-in-production
PORT=3000

# Processing
MAX_FILE_SIZE_MB=50
MIN_TEXT_LENGTH=50
MAX_NOISE_RATIO=0.5
REJECT_NOISE_RATIO=0.8

# OCR (ai-worker)
OCR_ENABLED=false
OCR_MODE=auto
OCR_LANGUAGES=en

# Embedding
EMBEDDING_PROVIDER=self-hosted
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
EMBEDDING_BATCH_SIZE=50

# Internal
CALLBACK_URL=http://backend:3000/internal/callback
```

### Step 10: GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration

  build:
    runs-on: ubuntu-latest
    needs: [lint, unit-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### Step 11: Minimal Entry Point

```typescript
// apps/backend/src/index.ts
import Fastify from 'fastify';
import { config } from 'dotenv';

config();

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

app.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

---

## Todo List

- [ ] Create root `package.json` with workspace config
- [ ] Create `pnpm-workspace.yaml`
- [ ] Create `apps/backend/package.json` with dependencies
- [ ] Create `apps/backend/tsconfig.json`
- [ ] Create `apps/backend/prisma/schema.prisma`
- [ ] Create `docker/postgres-init.sql`
- [ ] Create `docker/backend.Dockerfile`
- [ ] Create `apps/ai-worker/requirements.txt`
- [ ] Create `docker/ai-worker.Dockerfile`
- [ ] Create `docker-compose.yml`
- [ ] Create `.env.example`
- [ ] Create `.github/workflows/ci.yml`
- [ ] Create `apps/backend/src/index.ts` (minimal entry)
- [ ] Run `pnpm install`
- [ ] Run `pnpm db:generate`
- [ ] Run `docker compose up` and verify all services start
- [ ] Verify `/health` endpoint responds

---

## Success Criteria

1. `docker compose up -d` starts all 4 services without errors
2. `curl localhost:3000/health` returns `{"status":"ok"}`
3. PostgreSQL has pgvector extension enabled
4. Prisma generates types without errors
5. CI pipeline passes on push

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| pgvector Docker image issues | Pin to `pgvector/pgvector:pg16` |
| pnpm workspace complexity | Keep structure flat, avoid deep nesting |
| Prisma migration conflicts | Use `db push` for dev, migrations for prod |

---

## Security Considerations

- API_KEY stored in `.env`, never committed
- PostgreSQL credentials only for local dev
- Docker internal network isolates services
- No secrets in Dockerfile (use env vars)

---

## Next Steps

After completion, proceed to [Phase 01: Test Infrastructure](./phase-01-test-infrastructure.md) to set up Vitest, Testcontainers, and test fixtures.
