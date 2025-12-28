import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export interface ProcessingJob {
  documentId: string;
  filePath: string;
  format: 'pdf' | 'json' | 'txt' | 'md' | 'docx' | 'xlsx' | 'csv' | 'pptx' | 'html' | 'epub';
  config: {
    ocrMode: 'auto' | 'force' | 'never';
    ocrLanguages: string[];
    profileConfig?: Record<string, unknown>;
  };
}

let queue: Queue<ProcessingJob> | null = null;
let connection: Redis | null = null;  // Track connection

export function createProcessingQueue(forceNew = false): Queue<ProcessingJob> {
  if (queue && !forceNew) return queue;

  if (forceNew && queue) {
    queue.close().catch(console.error);
    connection?.disconnect();
  }

  connection = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  queue = new Queue<ProcessingJob>('document-processing', {
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
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}