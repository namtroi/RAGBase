import { ProcessingJob } from '@/queue/processing-queue.js';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('ProcessingQueue', () => {
  let redisContainer: StartedRedisContainer;
  let connection: Redis;
  let queue: Queue<ProcessingJob>;

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
          delay: 5000,
        },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400 },
      },
    });
  }, 30000);  

  afterAll(async () => {
    await queue?.close();
    connection?.disconnect();
    await redisContainer?.stop();
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