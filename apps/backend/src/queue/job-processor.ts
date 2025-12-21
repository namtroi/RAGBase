import { UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { getPrisma } from '../services/database.js';
import { ProcessingJob } from './processing-queue.js';

const PERMANENT_ERRORS = [
  'PASSWORD_PROTECTED',
  'CORRUPT_FILE',
  'UNSUPPORTED_FORMAT',
] as const;

export function createJobProcessor(connection: Redis): Worker<ProcessingJob> {
  const worker = new Worker<ProcessingJob>(
    'document-processing',
    async (job) => {
      const prisma = getPrisma();

      try {
        await prisma.document.update({
          where: { id: job.data.documentId },
          data: {
            status: 'PROCESSING',
            retryCount: job.attemptsMade,
          },
        });

        job.log(`Processing document ${job.data.documentId}`);
        
        // TODO: Implement actual processing hoặc wait for Python callback
        
      } catch (error) {
        // Nếu document không tồn tại, không retry
        if ((error as any)?.code === 'P2025') {
          throw new UnrecoverableError('Document not found');
        }
        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
      lockDuration: 300000,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job?.id} completed`);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    try {
      const prisma = getPrisma();
      const isPermanent = PERMANENT_ERRORS.some(code =>
        err.message.includes(code)
      );

      // Fix: Check cả UnrecoverableError
      const shouldMarkFailed = 
        isPermanent || 
        err instanceof UnrecoverableError ||
        job.attemptsMade >= (job.opts.attempts ?? 3);

      if (shouldMarkFailed) {
        await prisma.document.update({
          where: { id: job.data.documentId },
          data: {
            status: 'FAILED',
            failReason: err.message.slice(0, 500),  // Truncate để tránh DB error
            retryCount: job.attemptsMade,
          },
        });
      }
    } catch (updateError) {
      console.error('Failed to update document status:', updateError);
    }
  });

  // Thêm error handler cho worker
  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  return worker;
}

export function permanentError(message: string): UnrecoverableError {
  return new UnrecoverableError(message);
}