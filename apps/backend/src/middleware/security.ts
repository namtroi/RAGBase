import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';

export async function configureSecurity(fastify: FastifyInstance): Promise<void> {
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
  });

  // CORS configuration
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-API-Key'],
    credentials: true,
  });
}

// Additional security middleware
export function securityHooks(fastify: FastifyInstance): void {
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
