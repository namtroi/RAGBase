import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Singleton
 *
 * Maintains single PrismaClient instance for application lifecycle.
 * Prevents connection pool exhaustion from creating multiple clients.
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */

let prismaInstance: PrismaClient | null = null;

/**
 * Get or create Prisma Client instance
 * Thread-safe singleton pattern
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
    });
  }
  return prismaInstance;
}

/**
 * Disconnect Prisma Client
 * Call on application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
