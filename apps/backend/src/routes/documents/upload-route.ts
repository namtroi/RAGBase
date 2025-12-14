import { HashService } from '@/services';
import { getPrismaClient } from '@/services/database';
import { detectFormat, getProcessingLane, validateUpload } from '@/validators';
import multipart from '@fastify/multipart';
import { FastifyInstance } from 'fastify';
import { mkdir, rm, writeFile } from 'fs/promises';
import path, { basename } from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';

// Mock queue for now - will be replaced in Phase 05
const mockQueue = {
  add: async (name: string, data: any) => {
    console.log(`[Mock Queue] Job added: ${name}`, data);
  },
};

export async function uploadRoute(fastify: FastifyInstance): Promise<void> {
  // Register multipart
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  fastify.post('/api/documents', async (request, reply) => {
    try {
      console.log('📤 Upload request received');
      
      const data = await request.file();

      if (!data) {
        console.log('❌ No file in request');
        return reply.status(400).send({
          error: 'NO_FILE',
          message: 'No file uploaded',
        });
      }

      const buffer = await data.toBuffer();
      const filename = data.filename;
      const mimeType = data.mimetype;

      console.log('📄 File details:', {
        filename,
        mimeType,
        size: buffer.length,
      });

      // Validate file
      const validation = validateUpload({
        filename,
        mimeType,
        size: buffer.length,
      });

      if (!validation.valid) {
        console.log('❌ Validation failed:', validation.error);
        return reply.status(400).send({
          error: validation.error!.code,
          message: validation.error!.message,
        });
      }

      // Detect format
      const format = detectFormat({ filename, mimeType });
      if (!format) {
        console.log('❌ Format detection failed');
        return reply.status(400).send({
          error: 'INVALID_FORMAT',
          message: 'Unable to detect file format',
        });
      }

      console.log('✅ Format detected:', format);

      // Validate filename for path traversal
      const sanitizedFilename = basename(filename);
      if (sanitizedFilename !== filename || sanitizedFilename.length === 0 || sanitizedFilename.length > 255) {
        console.log('❌ Invalid filename');
        return reply.status(400).send({
          error: 'INVALID_FILENAME',
          message: 'Filename contains invalid characters or exceeds length limit',
        });
      }

      // Calculate MD5 hash
      console.log('🔐 Calculating MD5 hash...');
      const md5Hash = HashService.md5(buffer);
      console.log('✅ MD5 hash:', md5Hash);

      // Check for duplicates
      console.log('🔍 Checking for duplicates...');
      const prisma = getPrismaClient();
      const existing = await prisma.document.findUnique({
        where: { md5Hash },
      });

      if (existing) {
        console.log('⚠️ Duplicate file found:', existing.id);
        return reply.status(409).send({
          error: 'DUPLICATE_FILE',
          message: 'File already exists',
          existingId: existing.id,
        });
      }

      // Determine processing lane
      const lane = getProcessingLane(format);
      console.log('🛣️ Processing lane:', lane);

      // Use MD5 hash only for unique storage (prevents path traversal)
      const filePath = path.join(UPLOAD_DIR, md5Hash);

      // Save file to disk with error handling
      console.log('💾 Saving file to disk:', filePath);
      try {
        await mkdir(UPLOAD_DIR, { recursive: true });
        // Allow overwrite - if MD5 is same, content is identical
        await writeFile(filePath, buffer);
        console.log('✅ File saved successfully');
      } catch (error: any) {
        console.error('❌ File save error:', error);
        return reply.status(500).send({
          error: 'STORAGE_ERROR',
          message: `Failed to save file: ${error.message}`,
        });
      }

      // Create document record (with cleanup on failure)
      console.log('📝 Creating document record...');
      let document;
      try {
        document = await prisma.document.create({
          data: {
            filename: sanitizedFilename,
            mimeType,
            fileSize: buffer.length,
            format,
            lane,
            status: 'PENDING',
            filePath,
            md5Hash,
          },
        });
        console.log('✅ Document created:', document.id);
      } catch (error) {
        console.error('❌ Database error:', error);
        // Cleanup file if DB insert fails
        await rm(filePath).catch(console.error);
        throw error;
      }

      // Queue for processing (mock for now)
      console.log('📬 Adding to queue...');
      await mockQueue.add('process', {
        documentId: document.id,
        filePath,
        format,
        config: {
          ocrMode: 'auto',
          ocrLanguages: ['en'],
        },
      });
      console.log('✅ Queued successfully');

      console.log('🎉 Upload complete, returning 201');
      return reply.status(201).send({
        id: document.id,
        filename: document.filename,
        status: document.status,
        format: document.format,
        lane: document.lane,
      });
    } catch (error: any) {
      console.error('💥 UPLOAD ROUTE ERROR:', error);
      console.error('Stack trace:', error.stack);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });
}
