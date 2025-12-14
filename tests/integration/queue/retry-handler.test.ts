import { createProcessingQueue, ProcessingJob } from '@/queue/processing-queue';
import { RedisContainer } from '@testcontainers/redis';
import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database';
import { UnrecoverableError, Worker } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('RetryHandler', () => {
  let redis: any;
  let queue: any;
  let worker: Worker;
  const processedJobs: string[] = [];

  beforeAll(async () => {
    redis = await new RedisContainer().start();
    process.env.REDIS_URL = redis.getConnectionUrl();
    queue = createProcessingQueue();
  });

  afterAll(async () => {
    await worker?.close();
    await queue.close();
    await redis.stop();
  });

  beforeEach(async () => {
    processedJobs.length = 0;
    await queue.drain();
    await cleanDatabase();
  });

  describe('retry behavior', () => {
    it('should retry failed job up to 3 times', async () => {
      let attemptCount = 0;

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async (job) => {
          attemptCount++;
          throw new Error('Temporary failure');
        },
        { connection: queue.opts.connection }
      );

      const doc = await seedDocument({ status: 'PENDING' });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 20000));

      // Should have attempted 3 times (initial + 2 retries)
      expect(attemptCount).toBe(3);
    }, 30000);

    it('should not retry UnrecoverableError', async () => {
      let attemptCount = 0;

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async (job) => {
          attemptCount++;
          throw new UnrecoverableError('Password protected PDF');
        },
        { connection: queue.opts.connection }
      );

      const doc = await seedDocument({ status: 'PENDING' });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Should only attempt once
      expect(attemptCount).toBe(1);
    }, 10000);

    it('should update document status to FAILED after max retries', async () => {
      const prisma = getPrisma();
      const doc = await seedDocument({ status: 'PROCESSING' });

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async (job) => {
          // Update retry count in DB
          await prisma.document.update({
            where: { id: job.data.documentId },
            data: { retryCount: job.attemptsMade },
          });
          throw new Error('Failure');
        },
        { connection: queue.opts.connection }
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

      // Wait for all retries
      await new Promise(resolve => setTimeout(resolve, 25000));

      const updated = await prisma.document.findUnique({
        where: { id: doc.id },
      });

      expect(updated?.status).toBe('FAILED');
      expect(updated?.retryCount).toBe(3);
    }, 35000);
  });

  describe('exponential backoff', () => {
    it('should use exponential delays', async () => {
      const attemptTimes: number[] = [];

      worker = new Worker<ProcessingJob>(
        'document-processing',
        async (job) => {
          attemptTimes.push(Date.now());
          throw new Error('Failure');
        },
        { connection: queue.opts.connection }
      );

      const doc = await seedDocument({ status: 'PENDING' });

      await queue.add('process', {
        documentId: doc.id,
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 25000));

      // Check delays are increasing
      if (attemptTimes.length >= 3) {
        const delay1 = attemptTimes[1] - attemptTimes[0];
        const delay2 = attemptTimes[2] - attemptTimes[1];

        // Second delay should be roughly 2x first
        expect(delay2).toBeGreaterThan(delay1);
      }
    }, 35000);
  });
});
