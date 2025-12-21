import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

/**
 * Prisma Client Singleton
 *
 * Maintains single PrismaClient instance for application lifecycle.
 * Prevents connection pool exhaustion from creating multiple clients.
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */

let prismaInstance: PrismaClient | null = null;
let pgPool: pg.Pool | null = null;

/**
 * Get or create Prisma Client instance
 * Thread-safe singleton pattern
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pgPool);
    
    prismaInstance = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
    }) as unknown as PrismaClient; // Cast if types are slightly out of sync
  }
  return prismaInstance;
}

/**
 * Disconnect Prisma Client and close pg Pool
 * Call on application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

// Alias for consistency with test helpers
export const getPrisma = getPrismaClient;

