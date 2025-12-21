import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createJobProcessor } from './job-processor.js';

let worker: Worker | null = null;
let connection: Redis | null = null;

export function initWorker(): Worker {
  if (worker) return worker;

  connection = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  worker = createJobProcessor(connection);
  
  console.log('🤖 BullMQ Worker initialized');
  
  return worker;
}

export async function shutdownWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (connection) {
    connection.disconnect();
    connection = null;
  }
  console.log('🤖 BullMQ Worker shut down');
}