import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { createJobProcessor } from './job-processor.js';
import { createQdrantSyncWorker, createQdrantSyncQueue, QdrantSyncJob } from './qdrant-sync.processor.js';
import { isQdrantConfigured } from '../services/qdrant.service.js';
import { logger } from '@/logging/logger.js';

let worker: Worker | null = null;
let qdrantWorker: Worker | null = null;
let qdrantQueue: Queue<QdrantSyncJob> | null = null;
let connection: Redis | null = null;

export function initWorker(): Worker {
  if (worker) return worker;

  connection = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  worker = createJobProcessor(connection);

  // Initialize Qdrant sync worker if configured
  if (isQdrantConfigured()) {
    qdrantQueue = createQdrantSyncQueue(connection);
    qdrantWorker = createQdrantSyncWorker(connection);
    logger.info('qdrant_sync_worker_initialized');
  }

  logger.info('worker_initialized');

  return worker;
}

export function getQdrantSyncQueue(): Queue<QdrantSyncJob> | null {
  return qdrantQueue;
}

export async function shutdownWorker(): Promise<void> {
  if (qdrantWorker) {
    await qdrantWorker.close();
    qdrantWorker = null;
  }
  if (qdrantQueue) {
    await qdrantQueue.close();
    qdrantQueue = null;
  }
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (connection) {
    connection.disconnect();
    connection = null;
  }
  logger.info('worker_shutdown');
}