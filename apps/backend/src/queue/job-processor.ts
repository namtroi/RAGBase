import { UnrecoverableError, Worker } from 'bullmq';
import { getPrisma } from '../services/database.js';
import { ProcessingJob } from './processing-queue.js';

// Error codes that should not be retried
const PERMANENT_ERRORS = [
  'PASSWORD_PROTECTED',
  'CORRUPT_FILE',
  'UNSUPPORTED_FORMAT',
];

export function createJobProcessor(connection: any): Worker<ProcessingJob> {
  const worker = new Worker<ProcessingJob>(
    'document-processing',
    async (job) => {
      const prisma = getPrisma();

      // Update status to PROCESSING
      await prisma.document.update({
        where: { id: job.data.documentId },
        data: {
          status: 'PROCESSING',
          retryCount: job.attemptsMade,
        },
      });

      // Note: Actual processing happens in Python worker
      // This Node.js worker just updates status and waits for callback
      // In production, this would not process here but wait for Python

      job.log(`Processing document ${job.data.documentId}`);

      // The actual processing is done by Python worker polling Redis
      // This processor just marks the document as PROCESSING
    },
    {
      connection,
      concurrency: 5,
    }
  );

  // Handle job completion (via callback)
  worker.on('completed', async (job) => {
    console.log(`Job ${job?.id} completed`);
  });

  // Handle job failure
  worker.on('failed', async (job, err) => {
    if (!job) return;

    const prisma = getPrisma();
    const isPermanent = PERMANENT_ERRORS.some(code =>
      err.message.includes(code)
    );

    if (isPermanent || job.attemptsMade >= 3) {
      await prisma.document.update({
        where: { id: job.data.documentId },
        data: {
          status: 'FAILED',
          failReason: err.message,
          retryCount: job.attemptsMade,
        },
      });
    }
  });

  return worker;
}

/**
 * Mark error as permanent (no retry)
 */
export function permanentError(message: string): UnrecoverableError {
  return new UnrecoverableError(message);
}
