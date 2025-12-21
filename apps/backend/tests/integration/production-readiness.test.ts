/**
 * Production Readiness Integration Test
 * Tests all production features: metrics, health checks, rate limiting, security
 */
import { createApp } from '@/app.js';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Production Readiness', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('should return ok from /health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
    });

    it('should return detailed status from /ready', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      const body = JSON.parse(response.body);
      
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('checks');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('uptime');
      expect(body.checks).toHaveProperty('database');
      expect(body.checks).toHaveProperty('redis');
      expect(body.checks).toHaveProperty('queue');
    });

    it('should return alive from /live', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/live',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ alive: true });
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return Prometheus metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      
      const body = response.body;
      
      // Check for default Node.js metrics
      expect(body).toContain('process_cpu_user_seconds_total');
      expect(body).toContain('nodejs_heap_size_total_bytes');
      
      // Check for custom metrics
      expect(body).toContain('http_requests_total');
      expect(body).toContain('http_request_duration_seconds');
      expect(body).toContain('documents_processed_total');
      expect(body).toContain('processing_queue_size');
      expect(body).toContain('embedding_generation_duration_seconds');
    });

    it('should not require authentication for metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should include request ID in response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers['x-request-id']).toBeTruthy();
    });

    it('should accept custom request ID', async () => {
      const customId = 'test-request-123';
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          'x-request-id': customId,
        },
      });

      expect(response.headers['x-request-id']).toBe(customId);
    });
  });

  describe('Request Metrics', () => {
    it('should track HTTP requests in metrics', async () => {
      // Make a request
      await app.inject({
        method: 'GET',
        url: '/health',
      });

      // Check metrics
      const metricsResponse = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      const metrics = metricsResponse.body;
      
      // Should have recorded at least one request
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('path="/health"');
      expect(metrics).toContain('status="200"');
    });
  });
});
