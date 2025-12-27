import { getPrismaClient } from './database.js';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Initialize Hybrid Search Infrastructure
 * 
 * Sets up PostgreSQL trigger to auto-populate search_vector column
 * from chunk content for BM25 full-text search.
 * 
 * This should be called after database setup/migration.
 * Safe to run multiple times (uses CREATE OR REPLACE).
 */
export async function initializeHybridSearch(): Promise<void> {
  const prisma = getPrismaClient();

  logger.info('Initializing hybrid search infrastructure...');

  try {
    // Create trigger function to auto-populate search_vector
    // Includes heading + breadcrumbs + content for better keyword matching
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION chunks_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english', 
          COALESCE(NEW.heading, '') || ' ' || 
          COALESCE(array_to_string(NEW.breadcrumbs, ' '), '') || ' ' ||
          COALESCE(NEW.content, '')
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Drop existing trigger if exists (for idempotency)
    await prisma.$executeRaw`
      DROP TRIGGER IF EXISTS chunks_search_vector_trigger ON chunks;
    `;

    // Create trigger on INSERT and UPDATE of content, heading, or breadcrumbs
    await prisma.$executeRaw`
      CREATE TRIGGER chunks_search_vector_trigger
        BEFORE INSERT OR UPDATE OF content, heading, breadcrumbs ON chunks
        FOR EACH ROW
        EXECUTE FUNCTION chunks_search_vector_update();
    `;

    // Backfill all chunks to include heading + breadcrumbs in search_vector
    const result = await prisma.$executeRaw`
      UPDATE chunks 
      SET search_vector = to_tsvector('english', 
        COALESCE(heading, '') || ' ' || 
        COALESCE(array_to_string(breadcrumbs, ' '), '') || ' ' ||
        COALESCE(content, '')
      );
    `;

    logger.info({ backfilledCount: result }, 'Hybrid search infrastructure initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize hybrid search infrastructure');
    throw error;
  }
}

/**
 * Check if hybrid search is available
 * Verifies the search_vector column and trigger exist
 */
export async function isHybridSearchAvailable(): Promise<boolean> {
  const prisma = getPrismaClient();

  try {
    // Check if the trigger exists
    const result = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'chunks_search_vector_trigger'
      ) as exists;
    `;

    return result[0]?.exists ?? false;
  } catch {
    return false;
  }
}
