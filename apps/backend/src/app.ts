import Fastify, { FastifyInstance } from 'fastify';
import { authMiddleware } from './middleware/auth-middleware.js';
import { listRoute } from './routes/documents/list-route.js';
import { statusRoute } from './routes/documents/status-route.js';
import { uploadRoute } from './routes/documents/upload-route.js';
import { callbackRoute } from './routes/internal/callback-route.js';
import { searchRoute } from './routes/query/search-route.js';
import { disconnectPrisma } from './services/database.js';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV !== 'test' ? {
        target: 'pino-pretty',
      } : undefined,
    },
  });

  // Health check (no auth)
  app.get('/health', async () => ({ status: 'ok' }));

  // Internal routes (no auth)
  await callbackRoute(app);

  // Auth middleware
  app.addHook('onRequest', authMiddleware);

  // Register routes
  await uploadRoute(app);
  await statusRoute(app);
  await listRoute(app);
  await searchRoute(app);

  // Cleanup on shutdown
  app.addHook('onClose', async () => {
    await disconnectPrisma();
  });

  return app;
}
