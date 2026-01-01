import { FastifyInstance } from 'fastify';
import { getProcessingQueue } from '../queue/processing-queue.js';
import { getPrisma } from '../services/database.js';
import { isQdrantConfigured, getQdrantService } from '../services/qdrant.service.js';

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

  // Phase 5I: System status for Settings dashboard
  fastify.get('/api/system', async (request, reply) => {
    const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:8000';

    const status = {
      vectorDb: {
        provider: process.env.VECTOR_DB_PROVIDER || 'pgvector',
        status: 'healthy' as 'healthy' | 'error' | 'not_configured',
        qdrantConfigured: isQdrantConfigured(),
        qdrantConnected: false,
      },
      encryption: {
        configured: !!process.env.APP_ENCRYPTION_KEY,
        algorithm: 'AES-256-GCM',
      },
      aiWorker: {
        url: AI_WORKER_URL,
        status: 'unknown' as 'healthy' | 'error' | 'unknown',
        hybridEmbeddings: false,
      },
      oauth: {
        configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
    };

    // Check Qdrant connection
    if (isQdrantConfigured()) {
      try {
        const qdrant = getQdrantService();
        await qdrant.ensureCollection();
        status.vectorDb.qdrantConnected = true;
        status.vectorDb.status = 'healthy';
      } catch {
        status.vectorDb.qdrantConnected = false;
        status.vectorDb.status = 'error';
      }
    } else if (status.vectorDb.provider === 'qdrant') {
      status.vectorDb.status = 'not_configured';
    }

    // Check AI Worker
    try {
      const response = await fetch(`${AI_WORKER_URL}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        status.aiWorker.status = 'healthy';
        status.aiWorker.hybridEmbeddings = true; // Phase 5B enabled
      } else {
        status.aiWorker.status = 'error';
      }
    } catch {
      status.aiWorker.status = 'error';
    }

    return reply.send(status);
  });
}

