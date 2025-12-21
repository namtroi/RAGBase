import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createJobProcessor } from './job-processor.js';

let worker: Worker | null = null;

/**
 * Initialize the document processing worker
 */
export function initWorker(): Worker {
  if (worker) return worker;

  const connection = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });

  worker = createJobProcessor(connection);
  
  console.log('🤖 BullMQ Worker initialized');
  
  return worker;
}

/**
 * Gracefully shut down the worker
 */
export async function shutdownWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('🤖 BullMQ Worker shut down');
  }
}
