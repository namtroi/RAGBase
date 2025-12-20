import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

export async function configureRateLimit(fastify: FastifyInstance): Promise<void> {
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    skipOnError: true,

    // Custom key generator (IP-based)
    keyGenerator: (request) => {
      return (
        request.headers['x-forwarded-for']?.toString().split(',')[0] ||
        request.ip
      );
    },

    // Custom error response
    errorResponseBuilder: (request, context) => ({
      error: 'RATE_LIMITED',
      message: 'Too many requests, please try again later',
      retryAfter: context.after,
    }),

    // Skip rate limiting for internal routes
    allowList: (request) => {
      return request.url.startsWith('/internal/') ||
             request.url === '/health' ||
             request.url === '/metrics';
    },
  });
}
