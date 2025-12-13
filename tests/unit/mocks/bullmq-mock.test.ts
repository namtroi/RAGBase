import { describe, it, expect } from 'vitest';
import { MockQueue, MockWorker } from '@tests/mocks/bullmq-mock';

describe('BullMQ Mock', () => {
  describe('MockQueue', () => {
    it('should add jobs to queue', async () => {
      const queue = new MockQueue('test-queue');
      
      const job = await queue.add('test-job', { data: 'test' });
      
      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-job');
      expect(job.data).toEqual({ data: 'test' });
      expect(job.status).toBe('waiting');
    });

    it('should track multiple jobs', async () => {
      const queue = new MockQueue('test-queue');
      
      await queue.add('job1', { id: 1 });
      await queue.add('job2', { id: 2 });
      await queue.add('job3', { id: 3 });
      
      const jobs = queue.getAddedJobs();
      expect(jobs).toHaveLength(3);
    });

    it('should clear jobs', async () => {
      const queue = new MockQueue('test-queue');
      
      await queue.add('job1', { id: 1 });
      queue.clear();
      
      expect(queue.getAddedJobs()).toHaveLength(0);
    });
  });

  describe('MockWorker', () => {
    it('should process jobs', async () => {
      const processor = async (job: any) => {
        return { result: job.data.value * 2 };
      };
      
      const worker = new MockWorker('test-worker', processor);
      const job: any = {
        id: '1',
        name: 'test',
        data: { value: 5 },
        status: 'waiting',
        attemptsMade: 0,
        opts: {},
      };
      
      const result = await worker.processJob(job);
      
      expect(result).toEqual({ result: 10 });
      expect(job.status).toBe('completed');
    });

    it('should handle job failures', async () => {
      const processor = async () => {
        throw new Error('Processing failed');
      };
      
      const worker = new MockWorker('test-worker', processor);
      const job: any = {
        id: '1',
        name: 'test',
        data: {},
        status: 'waiting',
        attemptsMade: 0,
        opts: {},
      };
      
      await expect(worker.processJob(job)).rejects.toThrow('Processing failed');
      expect(job.status).toBe('failed');
      expect(job.failedReason).toBe('Processing failed');
    });
  });
});
