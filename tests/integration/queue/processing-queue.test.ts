import { createProcessingQueue, ProcessingJob } from '@/queue/processing-queue';
import { RedisContainer } from '@testcontainers/redis';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('ProcessingQueue', () => {
  let redis: any;
  let queue: Queue<ProcessingJob>;

  beforeAll(async () => {
    redis = await new RedisContainer().start();
    process.env.REDIS_URL = redis.getConnectionUrl();
    queue = createProcessingQueue();
  });

  afterAll(async () => {
    await queue.close();
    await redis.stop();
  });

  beforeEach(async () => {
    await queue.drain();
  });

  describe('job creation', () => {
    it('should add job to queue', async () => {
      const jobData: ProcessingJob = {
        documentId: 'doc-123',
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: {
          ocrMode: 'auto',
          ocrLanguages: ['en'],
        },
      };

      const job = await queue.add('process', jobData);

      expect(job.id).toBeDefined();
      expect(job.name).toBe('process');
      expect(job.data.documentId).toBe('doc-123');
    });

    it('should set default retry options', async () => {
      const job = await queue.add('process', {
        documentId: 'doc-123',
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      expect(job.opts.attempts).toBe(3);
      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 5000,
      });
    });

    it('should include job timeout', async () => {
      const job = await queue.add('process', {
        documentId: 'doc-123',
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      // 5 minute timeout for processing
      expect(job.opts.timeout).toBe(300000);
    });
  });

  describe('queue state', () => {
    it('should track waiting jobs', async () => {
      await queue.add('process', {
        documentId: 'doc-1',
        filePath: '/tmp/test1.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      const waiting = await queue.getWaiting();
      expect(waiting.length).toBeGreaterThanOrEqual(1);
    });

    it('should retrieve job by ID', async () => {
      const addedJob = await queue.add('process', {
        documentId: 'doc-retrieve',
        filePath: '/tmp/test.pdf',
        format: 'pdf',
        config: { ocrMode: 'auto', ocrLanguages: ['en'] },
      });

      const retrieved = await queue.getJob(addedJob.id!);
      expect(retrieved?.data.documentId).toBe('doc-retrieve');
    });
  });
});
