import { UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { getPrisma } from '../services/database.js';
import { getPdfConcurrency } from './concurrency-config.js';
import { ProcessingJob } from './processing-queue.js';
import { logger } from '@/logging/logger.js';

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

        // Dispatch ALL formats to Python AI worker via HTTP
        const aiWorkerUrl = process.env.AI_WORKER_URL || 'http://localhost:8000';

        const response = await fetch(`${aiWorkerUrl}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: job.data.documentId,
            filePath: job.data.filePath,
            format: job.data.format, // Pass format for routing
            config: job.data.config,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`AI worker failed: ${response.status} - ${errorText}`);
        }

        // Job completed - AI worker will send callback when processing done
        return { dispatched: true, documentId: job.data.documentId };

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
      concurrency: getPdfConcurrency(),
      lockDuration: 300000,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job?.id }, 'job_completed');
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
      logger.error({ err: updateError, jobId: job.id }, 'job_status_update_failed');
    }
  });

  // Thêm error handler cho worker
  worker.on('error', (err) => {
    logger.error({ err }, 'worker_error');
  });

  return worker;
}

export function permanentError(message: string): UnrecoverableError {
  return new UnrecoverableError(message);
}