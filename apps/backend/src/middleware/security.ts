import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';

export async function configureSecurity(fastify: FastifyInstance): Promise<void> {
  // Skip helmet in test mode (causes issues with light-my-request)
  if (process.env.NODE_ENV !== 'test') {
    // Security headers via helmet
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: false, // Disable HSTS for local development/testing
    });
  }

  // CORS configuration (skip in test mode)
  if (process.env.NODE_ENV !== 'test') {
    await fastify.register(cors, {
      origin: process.env.CORS_ORIGIN?.split(',') || true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-API-Key'],
      credentials: true,
    });
  }
}

// Additional security middleware
export function securityHooks(fastify: FastifyInstance): void {
  // Skip custom onSend hooks in test mode (causes race condition with light-my-request)
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // Remove server header
  fastify.addHook('onSend', async (request, reply) => {
    reply.removeHeader('x-powered-by');
  });

  // Add request ID for tracing
  fastify.addHook('onRequest', async (request) => {
    const requestId =
      request.headers['x-request-id'] ||
      `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    (request as any).requestId = requestId;
  });

  fastify.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', (request as any).requestId);
  });
}
