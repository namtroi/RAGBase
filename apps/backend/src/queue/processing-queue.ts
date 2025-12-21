import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export interface ProcessingJob {
  documentId: string;
  filePath: string;
  format: 'pdf' | 'json' | 'txt' | 'md';
  config: {
    ocrMode: 'auto' | 'force' | 'never';
    ocrLanguages: string[];
  };
}

// Bỏ generic, để TS tự infer
let queue: Queue | null = null;

export function createProcessingQueue(): Queue<ProcessingJob> {
  if (queue) return queue as Queue<ProcessingJob>;

  const connection = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });

  queue = new Queue('document-processing', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  });

  return queue as Queue<ProcessingJob>;
}

export function getProcessingQueue(): Queue<ProcessingJob> {
  if (!queue) {
    return createProcessingQueue();
  }
  return queue as Queue<ProcessingJob>;
}