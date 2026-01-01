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
import { deleteRoute } from './routes/documents/delete-route.js';
import { retryRoute } from './routes/documents/retry-route.js';
import { driveConfigRoutes } from './routes/drive/config-routes.js';
import { driveSyncRoutes } from './routes/drive/sync-routes.js';
import { healthRoute } from './routes/health-route.js';
import { callbackRoute } from './routes/internal/callback-route.js';
import { searchRoute } from './routes/query/search-route.js';
import { closeAllSSEConnections, sseRoute } from './routes/sse-route.js';
import { disconnectPrisma } from './services/database.js';
// Phase 5: Analytics Dashboard
import { overviewRoute, processingRoute, qualityRoute, documentsRoute } from './routes/analytics/index.js';
import { chunksRoute } from './routes/chunks/index.js';
import { profileRoutes } from './routes/profiles/index.js';
// Hybrid Search Infrastructure
import { initializeHybridSearch } from './services/hybrid-search-init.js';
// Default Profile
import { ensureDefaultProfile } from './services/default-profile.js';
// Phase 5F: OAuth
import { oauthRoutes } from './routes/oauth/google.route.js';

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

  // OAuth routes (no auth required - handles its own redirect flow)
  await oauthRoutes(app);

  // Initialize BullMQ worker and cron jobs (if not in test mode)
  if (process.env.NODE_ENV !== 'test') {
    // Ensure default profile exists
    await ensureDefaultProfile();

    initWorker();
    // Initialize Drive sync cron jobs
    initializeCronJobs().catch(err => {
      console.error('Failed to initialize cron jobs:', err);
    });
    // Initialize hybrid search (tsvector trigger)
    initializeHybridSearch().catch(err => {
      console.error('Failed to initialize hybrid search:', err);
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
    await deleteRoute(protectedScope);
    await retryRoute(protectedScope);
    await searchRoute(protectedScope);

    // Drive sync routes
    await driveConfigRoutes(protectedScope);
    await driveSyncRoutes(protectedScope);

    // SSE real-time events
    await sseRoute(protectedScope);

    // Phase 5: Analytics Dashboard routes
    await overviewRoute(protectedScope);
    await processingRoute(protectedScope);
    await qualityRoute(protectedScope);
    await documentsRoute(protectedScope);
    await chunksRoute(protectedScope);

    // Phase 5: Processing Profiles
    await profileRoutes(protectedScope);
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
