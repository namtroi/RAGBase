import { authMiddleware } from '@/middleware/auth-middleware';
import { listRoute } from '@/routes/documents/list-route';
import { statusRoute } from '@/routes/documents/status-route';
import { uploadRoute } from '@/routes/documents/upload-route';
import { searchRoute } from '@/routes/query/search-route';
import { disconnectPrisma } from '@/services/database';
import Fastify, { FastifyInstance } from 'fastify';

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
