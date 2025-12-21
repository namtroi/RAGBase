import multipart from '@fastify/multipart';
import Fastify, { FastifyInstance } from 'fastify';
import { logger } from './logging/logger.js';
import { metricsHook, metricsRoute } from './metrics/prometheus.js';
import { authMiddleware } from './middleware/auth-middleware.js';
import { configureRateLimit } from './middleware/rate-limit.js';
import { configureSecurity, securityHooks } from './middleware/security.js';
import { closeQueue } from './queue/processing-queue.js';
import { initWorker, shutdownWorker } from './queue/worker-init.js';
import { listRoute } from './routes/documents/list-route.js';
import { statusRoute } from './routes/documents/status-route.js';
import { uploadRoute } from './routes/documents/upload-route.js';
import { healthRoute } from './routes/health-route.js';
import { callbackRoute } from './routes/internal/callback-route.js';
import { searchRoute } from './routes/query/search-route.js';
import { disconnectPrisma } from './services/database.js';

const isProduction = process.env.NODE_ENV === 'production';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isProduction ? logger : {
      transport: process.env.NODE_ENV !== 'test' ? {
        target: 'pino-pretty',
      } : undefined,
    },
  });

  // Security middleware (helmet, CORS)
  await configureSecurity(app);
  securityHooks(app);

  // Rate limiting
  await configureRateLimit(app);

  // Register multipart
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  // Metrics collection
  metricsHook(app);

  // Metrics endpoint (no auth required)
  await metricsRoute(app);

  // Health check endpoints (no auth required)
  await healthRoute(app);

  // Internal routes (no auth)
  await callbackRoute(app);

  // Initialize BullMQ worker (if not in test mode)
  if (process.env.NODE_ENV !== 'test') {
    initWorker();
  }

  // Register protected routes (Auth applied here)
  await app.register(async (protectedScope) => {
    protectedScope.addHook('onRequest', authMiddleware);
    
    await uploadRoute(protectedScope);
    await statusRoute(protectedScope);
    await listRoute(protectedScope);
    await searchRoute(protectedScope);
  });

  // Cleanup on shutdown
  app.addHook('onClose', async () => {
    await shutdownWorker();
    await closeQueue();
    await disconnectPrisma();
  });

  return app;
}
