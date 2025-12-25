import { getProcessingQueue } from '@/queue/processing-queue.js';
import { getPrismaClient } from '@/services/database.js';
import { eventBus } from '@/services/event-bus.js';
import { HashService } from '@/services/index.js';
import { detectFormat } from '@/validators/index.js';
import { validateUpload } from '@/validators/upload-validator.js';
import { logger } from '@/logging/logger.js';
import { FastifyInstance } from 'fastify';
import { mkdir, rm, writeFile } from 'fs/promises';
import path, { basename } from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';

// NOTE: Queue is lazily initialized to allow env vars to be set first (important for tests)

export async function uploadRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/documents', async (request, reply) => {
    try {
      logger.info('upload_request_received');

      const data = await request.file();

      if (!data) {
        logger.warn('upload_no_file');
        return reply.status(400).send({
          error: 'NO_FILE',
          message: 'No file uploaded',
        });
      }

      const buffer = await data.toBuffer();
      const filename = data.filename;
      const mimeType = data.mimetype;

      logger.info({ filename, mimeType, size: buffer.length }, 'upload_file_details');

      // Validate file
      const validation = validateUpload({
        filename,
        mimeType,
        size: buffer.length,
      });

      if (!validation.valid) {
        logger.warn({ error: validation.error }, 'upload_validation_failed');
        return reply.status(400).send({
          error: validation.error!.code,
          message: validation.error!.message,
        });
      }

      // Detect format
      const format = detectFormat({ filename, mimeType });
      if (!format) {
        logger.warn({ filename, mimeType }, 'upload_format_detection_failed');
        return reply.status(400).send({
          error: 'INVALID_FORMAT',
          message: 'Unable to detect file format',
        });
      }

      logger.debug({ format }, 'upload_format_detected');

      // Validate filename for path traversal
      const sanitizedFilename = basename(filename);
      if (sanitizedFilename !== filename || sanitizedFilename.length === 0 || sanitizedFilename.length > 255) {
        logger.warn({ filename }, 'upload_invalid_filename');
        return reply.status(400).send({
          error: 'INVALID_FILENAME',
          message: 'Filename contains invalid characters or exceeds length limit',
        });
      }

      // Calculate MD5 hash
      const md5Hash = HashService.md5(buffer);
      logger.debug({ md5Hash }, 'upload_hash_calculated');

      // Check for duplicates
      const prisma = getPrismaClient();
      const existing = await prisma.document.findUnique({
        where: { md5Hash },
      });

      if (existing) {
        logger.info({ existingId: existing.id, md5Hash }, 'upload_duplicate_found');
        return reply.status(409).send({
          error: 'DUPLICATE_FILE',
          message: 'File already exists',
          existingId: existing.id,
        });
      }



      // Use MD5 hash only for unique storage (prevents path traversal)
      const filePath = path.join(UPLOAD_DIR, md5Hash);

      // Save file to disk with error handling
      try {
        await mkdir(UPLOAD_DIR, { recursive: true });
        // Allow overwrite - if MD5 is same, content is identical
        await writeFile(filePath, buffer);
        logger.debug({ filePath }, 'upload_file_saved');
      } catch (error: any) {
        logger.error({ err: error, filePath }, 'upload_file_save_error');
        return reply.status(500).send({
          error: 'STORAGE_ERROR',
          message: `Failed to save file: ${error.message}`,
        });
      }

      // Create document record (with cleanup on failure)
      let document;
      try {
        document = await prisma.document.create({
          data: {
            filename: sanitizedFilename,
            mimeType,
            fileSize: buffer.length,
            format,
            status: 'PENDING',
            filePath,
            md5Hash,
          },
        });
        logger.info({ documentId: document.id, filename: sanitizedFilename }, 'upload_document_created');

        // Emit SSE event for new document
        eventBus.emit('document:created', {
          id: document.id,
          filename: sanitizedFilename,
          status: 'PENDING'
        });
      } catch (error) {
        logger.error({ err: error, filePath }, 'upload_database_error');
        // Cleanup file if DB insert fails
        await rm(filePath).catch((rmErr) => logger.error({ err: rmErr }, 'upload_cleanup_failed'));
        throw error;
      }

      // Queue for processing (all formats now go through queue)
      await getProcessingQueue().add('process', {
        documentId: document.id,
        filePath: filePath,
        format: format as any,
        config: {
          ocrMode: 'auto',
          ocrLanguages: ['en'],
        },
      });
      logger.debug({ documentId: document.id }, 'upload_queued');

      logger.info({ documentId: document.id, filename: document.filename }, 'upload_complete');
      return reply.status(201).send({
        id: document.id,
        filename: document.filename,
        status: document.status,
        format: document.format,
      });
    } catch (error: any) {
      logger.error({ err: error }, 'upload_route_error');

      // Handle Fastify file size limit error
      if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(413).send({
          error: 'INTERNAL_ERROR',
          message: error.message || 'Request file too large',
        });
      }

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });
}
