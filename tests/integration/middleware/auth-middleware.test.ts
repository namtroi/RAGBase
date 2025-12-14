import { authMiddleware } from '@/middleware/auth-middleware';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Auth Middleware', () => {
  const app = Fastify();
  const TEST_API_KEY = 'test-secret-key';

  beforeAll(async () => {
    process.env.API_KEY = TEST_API_KEY;

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

  describe('X-API-Key header', () => {
    it('should allow request with valid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'X-API-Key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'success' });
    });

    it('should reject request without API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('UNAUTHORIZED');
    });

    it('should reject request with invalid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'X-API-Key': 'wrong-key' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('UNAUTHORIZED');
    });

    it('should reject request with empty API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'X-API-Key': '' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('public routes', () => {
    it('should allow /health without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
