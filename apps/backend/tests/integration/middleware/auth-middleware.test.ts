import { authMiddleware } from '@/middleware/auth-middleware.js';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Auth Middleware', () => {
  const app = Fastify();

  beforeAll(async () => {
    // Register middleware
    app.addHook('onRequest', authMiddleware);

    // Test routes
    app.get('/protected', async () => ({ message: 'success' }));
    app.get('/health', async () => ({ status: 'ok' }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('demo mode (auth disabled)', () => {
    it('should allow request without any authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'success' });
    });

    it('should allow /health without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
