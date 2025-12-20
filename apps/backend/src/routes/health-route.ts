import { FastifyInstance } from 'fastify';
import { getProcessingQueue } from '../queue/processing-queue.js';
import { getPrisma } from '../services/database.js';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  checks: {
    database: boolean;
    redis: boolean;
    queue: boolean;
  };
  version: string;
  uptime: number;
}

export async function healthRoute(fastify: FastifyInstance): Promise<void> {
  // Basic health check (for load balancers)
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Detailed readiness check
  fastify.get('/ready', async (request, reply) => {
    const checks = {
      database: false,
      redis: false,
      queue: false,
    };

    // Check database
    try {
      const prisma = getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Check Redis/Queue
    try {
      const queue = getProcessingQueue();
      await queue.getJobCounts();
      checks.redis = true;
      checks.queue = true;
    } catch {
      checks.redis = false;
      checks.queue = false;
    }

    const allHealthy = Object.values(checks).every(Boolean);

    const response: HealthStatus = {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
    };

    reply.status(allHealthy ? 200 : 503).send(response);
  });

  // Liveness probe (just checks process is running)
  fastify.get('/live', async () => {
    return { alive: true };
  });
}
