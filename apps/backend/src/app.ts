import multipart from '@fastify/multipart';
import Fastify, { FastifyInstance } from 'fastify';
import { initializeCronJobs, stopAllCronJobs } from './jobs/cron.js';
import { logger } from './logging/logger.js';
import { metricsHook, metricsRoute } from './metrics/prometheus.js';
import { authMiddleware } from './middleware/auth-middleware.js';
import { configureRateLimit } from './middleware/rate-limit.js';
import { configureSecurity, securityHooks } from './middleware/security.js';
import { closeQueue } from './queue/processing-queue.js';
import { initWorker, shutdownWorker } from './queue/worker-init.js';
import { contentRoute } from './routes/documents/content-route.js';
import { listRoute } from './routes/documents/list-route.js';
import { statusRoute } from './routes/documents/status-route.js';
import { uploadRoute } from './routes/documents/upload-route.js';
import { availabilityRoute } from './routes/documents/availability-route.js';
import { driveConfigRoutes } from './routes/drive/config-routes.js';
import { driveSyncRoutes } from './routes/drive/sync-routes.js';
import { healthRoute } from './routes/health-route.js';
import { callbackRoute } from './routes/internal/callback-route.js';
import { searchRoute } from './routes/query/search-route.js';
import { closeAllSSEConnections, sseRoute } from './routes/sse-route.js';
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

  // Initialize BullMQ worker and cron jobs (if not in test mode)
  if (process.env.NODE_ENV !== 'test') {
    initWorker();
    // Initialize Drive sync cron jobs
    initializeCronJobs().catch(err => {
      console.error('Failed to initialize cron jobs:', err);
    });
  }

  // Register protected routes (Auth applied here)
  await app.register(async (protectedScope) => {
    protectedScope.addHook('onRequest', authMiddleware);

    await uploadRoute(protectedScope);
    await statusRoute(protectedScope);
    await contentRoute(protectedScope);
    await listRoute(protectedScope);
    await availabilityRoute(protectedScope);
    await searchRoute(protectedScope);

    // Drive sync routes
    await driveConfigRoutes(protectedScope);
    await driveSyncRoutes(protectedScope);

    // SSE real-time events
    await sseRoute(protectedScope);
  });

  app.addHook('onClose', async () => {
    closeAllSSEConnections();
    stopAllCronJobs();
    await shutdownWorker();
    await closeQueue();
    await disconnectPrisma();
  });

  return app;
}

