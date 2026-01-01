/**
 * Qdrant Sync Processor - Outbox Pattern
 *
 * Phase 5D: Syncs PENDING chunks from PostgreSQL to Qdrant Cloud
 * After successful sync, nullifies vectors in PostgreSQL to save space.
 */

import { Worker, Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { getPrisma } from '../services/database.js';
import { getQdrantService, isQdrantConfigured, QdrantPoint } from '../services/qdrant.service.js';
import { logger } from '@/logging/logger.js';

const BATCH_SIZE = 100;
const QUEUE_NAME = 'qdrant-sync';

export interface QdrantSyncJob {
  documentId?: string;  // Optional: sync specific document, or all PENDING if omitted
  batchSize?: number;
}

// Module-level queue reference for batch continuation
let syncQueueRef: Queue<QdrantSyncJob> | null = null;

/**
 * Create the Qdrant sync queue
 */
export function createQdrantSyncQueue(connection: Redis): Queue<QdrantSyncJob> {
  syncQueueRef = new Queue<QdrantSyncJob>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,  // 5s, 10s, 20s
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  });
  return syncQueueRef;
}

/**
 * Create the Qdrant sync worker
 */
export function createQdrantSyncWorker(connection: Redis): Worker<QdrantSyncJob> {
  const worker = new Worker<QdrantSyncJob>(
    QUEUE_NAME,
    async (job) => {
      await processQdrantSync(job);
    },
    {
      connection,
      concurrency: 1,  // Serial processing to avoid race conditions
      lockDuration: 60000,  // 1 minute lock
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job?.id }, 'qdrant_sync_completed');
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    logger.error({ jobId: job.id, error: err.message }, 'qdrant_sync_failed');

    // On max retries, mark chunks as FAILED
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await markChunksFailed(job.data.documentId);
    }
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'qdrant_sync_worker_error');
  });

  return worker;
}

/**
 * Process a sync job - fetch PENDING chunks and upsert to Qdrant
 */
async function processQdrantSync(job: Job<QdrantSyncJob>): Promise<void> {
  if (!isQdrantConfigured()) {
    logger.info('qdrant_sync_skipped_not_configured');
    return;
  }

  const prisma = getPrisma();
  const qdrant = getQdrantService();
  const batchSize = job.data.batchSize || BATCH_SIZE;

  // 1. Fetch PENDING chunks
  const whereClause: any = { syncStatus: 'PENDING' };
  if (job.data.documentId) {
    whereClause.documentId = job.data.documentId;
  }

  const chunks = await prisma.chunk.findMany({
    where: whereClause,
    take: batchSize,
    select: {
      id: true,
      documentId: true,
      content: true,
      denseVector: true,
      sparseIndices: true,
      sparseValues: true,
      qualityScore: true,
      qualityFlags: true,
      chunkType: true,
      chunkIndex: true,
      breadcrumbs: true,
      tokenCount: true,
    },
  });

  if (chunks.length === 0) {
    logger.debug('qdrant_sync_no_pending_chunks');
    return;
  }

  logger.info({ count: chunks.length, documentId: job.data.documentId }, 'qdrant_sync_processing');

  // 2. Filter chunks with valid vectors
  const validChunks = chunks.filter(
    (c) =>
      c.denseVector &&
      c.denseVector.length === 384 &&
      c.sparseIndices &&
      c.sparseIndices.length > 0 &&
      c.sparseValues &&
      c.sparseValues.length > 0
  );

  if (validChunks.length === 0) {
    logger.warn({ count: chunks.length }, 'qdrant_sync_no_valid_vectors');
    // Mark as SYNCED anyway (no vectors to sync)
    await prisma.chunk.updateMany({
      where: { id: { in: chunks.map((c) => c.id) } },
      data: { syncStatus: 'SYNCED' },
    });
    return;
  }

  // 3. Build Qdrant points
  const points: QdrantPoint[] = validChunks.map((c) => ({
    id: c.id,
    vector: {
      dense: c.denseVector!,
      sparse: {
        indices: c.sparseIndices!,
        values: c.sparseValues!,
      },
    },
    payload: {
      documentId: c.documentId,
      content: c.content,
      metadata: {
        qualityScore: c.qualityScore,
        qualityFlags: c.qualityFlags,
        chunkType: c.chunkType,
        chunkIndex: c.chunkIndex,
        breadcrumbs: c.breadcrumbs,
        tokenCount: c.tokenCount,
      },
    },
  }));

  // 4. Upsert to Qdrant
  await qdrant.upsertPoints(points);

  // 5. Update sync status + nullify vectors to save PostgreSQL space
  await prisma.chunk.updateMany({
    where: { id: { in: validChunks.map((c) => c.id) } },
    data: {
      syncStatus: 'SYNCED',
      denseVector: [],  // Clear to save space
      sparseIndices: [],
      sparseValues: [],
    },
  });

  logger.info({ synced: validChunks.length }, 'qdrant_sync_success');

  // 6. Check if more chunks to process and enqueue follow-up job
  const remaining = await prisma.chunk.count({
    where: whereClause,
  });

  if (remaining > 0) {
    // Use module-level queue reference to add follow-up job
    if (syncQueueRef) {
      await syncQueueRef.add('sync-continue', {
        documentId: job.data.documentId,
        batchSize
      }, {
        jobId: `sync-continue-${job.data.documentId || 'all'}-${Date.now()}`,
        delay: 100,  // Small delay to avoid overwhelming Qdrant
      });
      logger.info({ remaining, documentId: job.data.documentId }, 'qdrant_sync_continuing');
    }
  }
}

/**
 * Mark chunks as FAILED after max retries
 */
async function markChunksFailed(documentId?: string): Promise<void> {
  const prisma = getPrisma();

  const whereClause: any = { syncStatus: 'PENDING' };
  if (documentId) {
    whereClause.documentId = documentId;
  }

  await prisma.chunk.updateMany({
    where: whereClause,
    data: { syncStatus: 'FAILED' },
  });

  logger.warn({ documentId }, 'qdrant_sync_marked_failed');
}

/**
 * Enqueue a sync job for a specific document or all pending chunks
 */
export async function enqueueQdrantSync(
  queue: Queue<QdrantSyncJob>,
  documentId?: string
): Promise<void> {
  await queue.add('sync', { documentId }, {
    jobId: documentId ? `sync-${documentId}` : `sync-all-${Date.now()}`,
  });
}
