# Vector Embeddings Stack Research: pgvector + Transformers.js + LangChain + BullMQ

**Date:** 2025-12-13 | **Focus:** Production-ready Node.js embedding pipeline

## 1. pgvector + Prisma Configuration

### Index Strategy (HNSW vs IVFFlat)

| Aspect | HNSW | IVFFlat |
|--------|------|---------|
| Query Performance | Superior | Good |
| Build Speed | Slower | Faster |
| Memory Usage | Higher | Lower |
| Training Required | No | Yes (k-means) |
| Operator Classes | `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops` |

**Recommendation:** Use HNSW for <10M vectors (better query perf). IVFFlat for larger datasets (memory efficiency).

### Prisma Implementation

```prisma
// schema.prisma
model Document {
  id      String   @id @default(cuid())
  content String
  embedding Unsupported("vector(1536)")  // or 384 for all-MiniLM-L6-v2
  createdAt DateTime @default(now())
  @@index([id])  // Prisma-managed index
}
```

**Critical Limitation:** Prisma `migrate dev` does NOT support pgvector indexes. Manual SQL required:

```sql
-- migrations/add_vector_index.sql
CREATE INDEX embedding_hnsw ON Document
USING hnsw (embedding vector_cosine_ops);

-- Or for IVFFlat:
CREATE INDEX embedding_ivfflat ON Document
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Issue:** Subsequent migrations may drop custom indexes. Workaround: Store in `sql/` directory and apply post-migration.

**Version Notes:** pgvector 0.5.1+ (npm), Prisma 5.7+

---

## 2. @xenova/transformers ONNX Runtime

### Model Selection

**Recommended:** `Xenova/all-MiniLM-L6-v2`
- **Dimensions:** 384
- **Max Tokens:** 256 (hard limit)
- **Performance:** ~50-100ms inference on CPU
- **Size:** ~90MB (first load, cached locally)

**Setup Pattern:**

```typescript
import { pipeline } from '@xenova/transformers';

const extractor = await pipeline('feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

const embedding = await extractor(text, {
  pooling: 'mean',      // or 'cls' for classification
  normalize: true       // L2 normalization
});

// Output: Float32Array of length 384
const vector = Array.from(embedding.data);
```

### Production Configuration

```typescript
// Disable remote models in production
import { env } from '@xenova/transformers';
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/app/models';  // Pre-download models

// Single instance pattern (expensive to initialize)
let extractor: any = null;

export async function getEmbedder() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return extractor;
}
```

**Constraints:**
- Token limit 256 → chunk text to ≤128 tokens for optimal quality
- No GPU support natively (WASM-based)
- Cold starts: ~2-3s first call; warm cache: ~50-100ms/chunk

---

## 3. LangChain.js Markdown Chunking

### Semantic-First Strategy

```typescript
import { MarkdownTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';

// Step 1: Header-aware splitting
const headerSplitter = new MarkdownHeaderTextSplitter({
  headers_to_split_on: [
    ['#', 'Section'],
    ['##', 'Subsection'],
    ['###', 'Topic'],
  ],
});

const docsSplit = await headerSplitter.splitText(markdownContent);

// Step 2: Size-aware chunking within sections
const chunkSplitter = new MarkdownTextSplitter({
  chunkSize: 500,        // ~128 tokens at 4 chars/token
  chunkOverlap: 100,     // 20% overlap for context continuity
});

const finalChunks = await chunkSplitter.splitDocuments(docsSplit);
```

**Parameters:**
- `chunkSize: 500` = ~128 tokens (safe for all-MiniLM-L6-v2)
- `chunkOverlap: 100` = preserve cross-chunk relationships
- `keepSeparator: true` = preserve markdown formatting

**Output:** Each chunk includes metadata: `{ Section, Subsection, Topic }`

---

## 4. BullMQ Async Processing + Retry

### Queue Pattern for Embeddings

```typescript
import { Queue, Worker, UnrecoverableError } from 'bullmq';

// Job type
interface EmbedJob {
  documentId: string;
  text: string;
  chunkIndex: number;
}

// Queue setup
const embedQueue = new Queue<EmbedJob>('embed', {
  connection: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,  // Start 1s, then 2s, 4s
    },
    timeout: 30000,  // 30s timeout
  },
});

// Worker: process embeddings
const worker = new Worker<EmbedJob>(
  'embed',
  async (job) => {
    try {
      const embedder = await getEmbedder();
      const vector = await embedder(job.data.text, {
        pooling: 'mean',
        normalize: true,
      });

      // Save to DB
      await prisma.embedding.upsert({
        where: { documentId_chunkIndex: {
          documentId: job.data.documentId,
          chunkIndex: job.data.chunkIndex,
        }},
        create: {
          documentId: job.data.documentId,
          chunkIndex: job.data.chunkIndex,
          vector: Array.from(vector.data),
        },
        update: {
          vector: Array.from(vector.data),
          processedAt: new Date(),
        },
      });

      return { success: true };
    } catch (err) {
      // Unrecoverable: invalid UTF-8, etc.
      if (err.name === 'InvalidInput') {
        throw new UnrecoverableError(err.message);
      }
      throw err;  // Retry-able errors
    }
  },
  { connection: { host: 'localhost', port: 6379 } }
);

// Enqueue chunks
for (const chunk of finalChunks) {
  await embedQueue.add('embed', {
    documentId: doc.id,
    text: chunk.pageContent,
    chunkIndex: finalChunks.indexOf(chunk),
  });
}
```

**Concurrency:** Adjust worker threads based on CPU cores.

---

## 5. Fastify + Prisma + Zod Integration

### Recommended Stack: fastify-type-provider-zod

```typescript
import Fastify from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const app = Fastify().withTypeProvider<ZodTypeProvider>();
const prisma = new PrismaClient();

// Schemas
const CreateDocSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(10),
});

const DocumentResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  chunked: z.boolean(),
});

// Route with full typing
app.post<{ Body: z.infer<typeof CreateDocSchema> }>(
  '/documents',
  {
    schema: {
      body: CreateDocSchema,
      response: {
        201: DocumentResponseSchema,
      },
    },
  },
  async (request, reply) => {
    // request.body is fully typed
    const doc = await prisma.document.create({
      data: {
        title: request.body.title,
        content: request.body.content,
      },
    });

    // Enqueue embedding job
    await embedQueue.add('embed', {
      documentId: doc.id,
      text: doc.content,
      chunkIndex: 0,
    });

    return reply.code(201).send({
      id: doc.id,
      title: doc.title,
      chunked: false,
    });
  }
);

// Similarity search endpoint
const SearchSchema = z.object({
  query: z.string().min(3),
  limit: z.number().int().min(1).max(50).default(10),
});

app.get<{ Querystring: z.infer<typeof SearchSchema> }>(
  '/search',
  { schema: { querystring: SearchSchema } },
  async (request, reply) => {
    const embedder = await getEmbedder();
    const queryVector = await embedder(request.query.query);

    // Raw SQL for pgvector similarity
    const results = await prisma.$queryRaw`
      SELECT id, content, 1 - (embedding <=> ${queryVector}::vector) as similarity
      FROM "Document"
      ORDER BY embedding <=> ${queryVector}::vector
      LIMIT ${request.query.limit}
    `;

    return reply.send(results);
  }
);

app.listen({ port: 3000 });
```

**Key Patterns:**
- Type inference from schemas (no manual types needed)
- Request/response validation automatic
- Prisma integration via `@prisma/client`
- pgvector queries via raw SQL `<=>` operator

---

## Version Compatibility Notes (2025)

| Library | Version | Notes |
|---------|---------|-------|
| pgvector | 0.5.1+ | npm package; raw SQL for indexes |
| @xenova/transformers | 2.6.x+ | ONNX 1.14+; WebAssembly stable |
| @langchain/core | 0.1.45+ | Markdown splitter stable |
| bullmq | 5.x+ | Redis 6.2+ required |
| @prisma/client | 5.7+ | Vector support (Unsupported type) |
| fastify | 4.x+ | Stable; 5.x upcoming |
| zod | 3.22+ | Type inference stable |

---

## Unresolved Questions

1. **pgvector Index Persistence:** How to safely manage HNSW/IVFFlat indexes across Prisma migrations in CI/CD?
2. **@xenova/transformers GPU:** Native GPU acceleration roadmap for Node.js?
3. **BullMQ Scaling:** Optimal worker count formula for mixed CPU/IO workloads?
4. **Chunk Size Sensitivity:** Impact of chunk overlap on retrieval quality—needs empirical testing.

---

## Sources

- [pgvector - npm](https://www.npmjs.com/package/pgvector)
- [pgvector-node GitHub](https://github.com/pgvector/pgvector-node)
- [AWS: pgvector Indexing Deep Dive](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)
- [Supabase HNSW Indexes](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes)
- [@xenova/transformers npm](https://www.npmjs.com/package/@xenova/transformers?activeTab=dependents)
- [DEV: Vector Embeddings in Node.js](https://dev.to/datastax/how-to-create-vector-embeddings-in-nodejs-2khl)
- [LangChain.js MarkdownTextSplitter](https://v03.api.js.langchain.com/classes/langchain.text_splitter.MarkdownTextSplitter.html)
- [LangChain.js Text Splitters](https://js.langchain.com/v0.1/docs/modules/data_connection/document_transformers/)
- [BullMQ Retrying Guide](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [BullMQ Official](https://bullmq.io/)
- [Fastify + Prisma + Zod - DEV](https://dev.to/azzam_faraj/fastify-prisma-zod-swagger-1k06)
- [fastify-type-provider-zod GitHub](https://github.com/fabogit/fastify-prisma-zod-swagger)
