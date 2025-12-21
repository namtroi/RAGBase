import { ProcessingJob } from '@/queue/processing-queue.js';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('RetryHandler', () => {
  let redisContainer: StartedRedisContainer;
  let connection: Redis;
  let queue: Queue<ProcessingJob>;
  let worker: Worker<ProcessingJob> | null = null;

  beforeAll(async () => {
    redisContainer = await new RedisContainer().start();
    
    connection = new Redis(redisContainer.getConnectionUrl(), {
      maxRetriesPerRequest: null,
    });

    queue = new Queue<ProcessingJob>('document-processing', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,  
        },
      },
    });
  }, 30000);

  afterAll(async () => {
    await worker?.close();
    await queue?.close();
    connection?.disconnect();
    await redisContainer?.stop();
  });

  beforeEach(async () => {
    await queue.drain();
    await cleanDatabase();
  });

  afterEach(async () => {
    if (worker) {
      await worker.close();
      worker = null;
    }
  });

  describe('retry behavior', () => {
    it('should retry failed job up to 3 times', async () => {
      let attemptCount = 0;

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async () => {
          attemptCount++;
          throw new Error('Temporary failure');
        },
        { connection }
      );

      const doc = await seedDocument({ status: 'PENDING' });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      await new Promise<void>((resolve) => {
        worker!.on('failed', (job) => {
          if (job?.attemptsMade === 3) {
            resolve();
          }
        });
      });

      expect(attemptCount).toBe(3);
    }, 15000);

    it('should not retry UnrecoverableError', async () => {
      let attemptCount = 0;

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async () => {
          attemptCount++;
          throw new UnrecoverableError('Password protected PDF');
        },
        { connection }
      );

      const doc = await seedDocument({ status: 'PENDING' });

      const job = await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for job to fail
      await new Promise<void>((resolve) => {
        worker!.on('failed', () => resolve());
      });

      expect(attemptCount).toBe(1);
    }, 10000);

    it('should update document status to FAILED after max retries', async () => {
      const prisma = getPrisma();
      const doc = await seedDocument({ status: 'PROCESSING' });

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async (job) => {
          await prisma.document.update({
            where: { id: job.data.documentId },
            data: { retryCount: job.attemptsMade },
          });
          throw new Error('Failure');
        },
        { connection }
      );

      worker.on('failed', async (job, err) => {
        if (job && job.attemptsMade >= 3) {
          await prisma.document.update({
            where: { id: job.data.documentId },
            data: {
              status: 'FAILED',
              failReason: err.message,
            },
          });
        }
      });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for final failure
      await new Promise<void>((resolve) => {
        worker!.on('failed', (job) => {
          if (job?.attemptsMade === 3) {
            setTimeout(resolve, 100);
          }
        });
      });

      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('FAILED');
      expect(updated?.retryCount).toBe(2);
    }, 15000);
  });

  describe('exponential backoff', () => {
    it('should use exponential delays', async () => {
      const attemptTimes: number[] = [];

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async () => {
          attemptTimes.push(Date.now());
          throw new Error('Failure');
        },
        { connection }
      );

      const doc = await seedDocument({ status: 'PENDING' });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for all retries
      await new Promise<void>((resolve) => {
        worker!.on('failed', (job) => {
          if (job?.attemptsMade === 3) {
            resolve();
          }
        });
      });

      expect(attemptTimes.length).toBe(3);

      const delay1 = attemptTimes[1] - attemptTimes[0];
      const delay2 = attemptTimes[2] - attemptTimes[1];

      // delay2 should be ~2x delay1 (exponential)
      expect(delay2).toBeGreaterThan(delay1 * 1.5);
    }, 15000);
  });
});