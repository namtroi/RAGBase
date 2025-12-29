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
        // Part 3: Skip already-completed documents (stale job protection)
        const existing = await prisma.document.findUnique({
          where: { id: job.data.documentId },
          select: { status: true, processedContent: true }
        });

        if (existing?.status === 'COMPLETED' && existing?.processedContent) {
          logger.info({ documentId: job.data.documentId }, 'job_skipped_already_complete');
          return { skipped: true, documentId: job.data.documentId };
        }

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
        // Document not found - don't retry
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

      // Part 2: Detect network errors - these should retry, not fail permanently
      const isNetworkError =
        err.message.includes('fetch failed') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ETIMEDOUT') ||
        err.message.includes('AI worker failed: 5'); // 5xx server errors

      const isPermanent = PERMANENT_ERRORS.some(code =>
        err.message.includes(code)
      );

      // Network errors should keep retrying until exhausted, not fail immediately
      const shouldMarkFailed =
        (isPermanent && !isNetworkError) ||
        err instanceof UnrecoverableError ||
        job.attemptsMade >= (job.opts.attempts ?? 3);

      if (shouldMarkFailed) {
        // Classify error for better debugging
        let failReason = err.message.slice(0, 500);
        if (isNetworkError && job.attemptsMade >= (job.opts.attempts ?? 3)) {
          failReason = `AI_WORKER_UNREACHABLE: ${failReason}`;
        }

        await prisma.document.update({
          where: { id: job.data.documentId },
          data: {
            status: 'FAILED',
            failReason,
            retryCount: job.attemptsMade,
          },
        });
      }
    } catch (updateError) {
      // P2025: Document already deleted, ignore
      if ((updateError as any)?.code === 'P2025') {
        logger.info({ jobId: job.id }, 'job_status_update_skipped_doc_deleted');
        return;
      }
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