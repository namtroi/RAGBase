import { vi } from 'vitest';
import { EventEmitter } from 'events';

interface MockJob<T = any> {
  id: string;
  name: string;
  data: T;
  opts: any;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  attemptsMade: number;
  failedReason?: string;
}

/**
 * In-memory BullMQ Queue mock for unit tests
 */
export class MockQueue<T = any> extends EventEmitter {
  name: string;
  jobs: Map<string, MockJob<T>> = new Map();
  private idCounter = 0;

  constructor(name: string) {
    super();
    this.name = name;
  }

  async add(jobName: string, data: T, opts?: any): Promise<MockJob<T>> {
    const id = String(++this.idCounter);
    const job: MockJob<T> = {
      id,
      name: jobName,
      data,
      opts: opts || {},
      status: 'waiting',
      attemptsMade: 0,
    };
    this.jobs.set(id, job);
    this.emit('added', job);
    return job;
  }

  async addBulk(jobs: Array<{ name: string; data: T; opts?: any }>): Promise<MockJob<T>[]> {
    return Promise.all(jobs.map(j => this.add(j.name, j.data, j.opts)));
  }

  async getJob(id: string): Promise<MockJob<T> | undefined> {
    return this.jobs.get(id);
  }

  async getJobs(statuses: string[]): Promise<MockJob<T>[]> {
    return Array.from(this.jobs.values())
      .filter(job => statuses.includes(job.status));
  }

  // Test helpers
  getAddedJobs(): MockJob<T>[] {
    return Array.from(this.jobs.values());
  }

  clear(): void {
    this.jobs.clear();
    this.idCounter = 0;
  }

  async close(): Promise<void> {
    this.clear();
  }
}

/**
 * In-memory BullMQ Worker mock for unit tests
 */
export class MockWorker<T = any> extends EventEmitter {
  name: string;
  processor: (job: MockJob<T>) => Promise<any>;
  isRunning = false;

  constructor(name: string, processor: (job: MockJob<T>) => Promise<any>) {
    super();
    this.name = name;
    this.processor = processor;
  }

  async run(): Promise<void> {
    this.isRunning = true;
  }

  async close(): Promise<void> {
    this.isRunning = false;
  }

  // Test helper: manually process a job
  async processJob(job: MockJob<T>): Promise<any> {
    job.status = 'active';
    try {
      const result = await this.processor(job);
      job.status = 'completed';
      this.emit('completed', job, result);
      return result;
    } catch (error: any) {
      job.attemptsMade++;
      job.status = 'failed';
      job.failedReason = error.message;
      this.emit('failed', job, error);
      throw error;
    }
  }
}

/**
 * Mock the bullmq module
 */
export function mockBullMQ() {
  vi.mock('bullmq', () => ({
    Queue: MockQueue,
    Worker: MockWorker,
    QueueEvents: class extends EventEmitter {},
  }));
}
