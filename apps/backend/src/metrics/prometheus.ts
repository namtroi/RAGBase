import { FastifyInstance } from 'fastify';
import {
    Counter,
    Gauge,
    Histogram,
    Registry,
    collectDefaultMetrics,
} from 'prom-client';

const register = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const documentsProcessed = new Counter({
  name: 'documents_processed_total',
  help: 'Total documents processed',
  labelNames: ['status', 'format', 'lane'],
  registers: [register],
});

export const queueSize = new Gauge({
  name: 'processing_queue_size',
  help: 'Current size of processing queue',
  labelNames: ['status'],
  registers: [register],
});

export const embeddingDuration = new Histogram({
  name: 'embedding_generation_duration_seconds',
  help: 'Embedding generation duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Metrics route
export async function metricsRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}

// Request metrics hook
export function metricsHook(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request) => {
    (request as any).startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    try {
      const duration = (Date.now() - (request as any).startTime) / 1000;
      const path = request.routeOptions?.url || request.url;

      httpRequestsTotal.inc({
        method: request.method,
        path,
        status: reply.statusCode,
      });

      httpRequestDuration.observe(
        { method: request.method, path, status: reply.statusCode },
        duration
      );
    } catch {
      // Ignore errors during test cleanup when response is already finalized
    }
  });
}
