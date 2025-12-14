import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export interface ProcessingJob {
  documentId: string;
  filePath: string;
  format: 'pdf' | 'json' | 'txt' | 'md';
  config: {
    ocrMode: 'auto' | 'force' | 'never';
    ocrLanguages: string[];
  };
}

let queue: Queue<ProcessingJob> | null = null;

export function createProcessingQueue(): Queue<ProcessingJob> {
  if (queue) return queue;

  const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });

  queue = new Queue<ProcessingJob>('document-processing', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s → 10s → 20s
      },
      timeout: 300000, // 5 minutes
      removeOnComplete: {
        age: 3600, // 1 hour
        count: 1000,
      },
      removeOnFail: {
        age: 86400, // 24 hours
      },
    },
  });

  return queue;
}

export function getProcessingQueue(): Queue<ProcessingJob> {
  if (!queue) {
    return createProcessingQueue();
  }
  return queue;
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
