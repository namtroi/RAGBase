-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW index will be created after first migration via Prisma
-- Uncomment and run manually after schema is populated:
-- CREATE INDEX chunks_embedding_hnsw ON chunks
-- USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);
