# Phase 09: Production Readiness

**Parent:** [plan.md](./plan.md) | **Dependencies:** Phases 00-08 | **Blocks:** None

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2025-12-13 |
| Priority | P1 (Important) |
| Est. Hours | 6 |
| Status | Pending |

**Description:** Production hardening including structured logging, Prometheus metrics, health checks, rate limiting, and security hardening.

---

## Key Insights

- pino for Node.js structured logging (JSON format)
- structlog already configured for Python
- Prometheus metrics via prom-client
- Rate limiting at 100 req/min per IP
- Health checks for Docker orchestration

---

## Requirements

### Acceptance Criteria
- [ ] Structured JSON logging in production
- [ ] /metrics endpoint with Prometheus format
- [ ] /health and /ready endpoints
- [ ] Rate limiting (100 req/min per IP)
- [ ] Error alerting webhook integration
- [ ] Docker Compose production config

---

## Architecture

### Observability Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Production Setup                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐    ┌──────────────┐                    │
│  │   Backend   │───►│  Prometheus  │                    │
│  │  /metrics   │    │  (scraping)  │                    │
│  └─────────────┘    └──────────────┘                    │
│         │                   │                            │
│         ▼                   ▼                            │
│  ┌─────────────┐    ┌──────────────┐                    │
│  │    Logs     │    │   Grafana    │                    │
│  │   (stdout)  │    │  (optional)  │                    │
│  └─────────────┘    └──────────────┘                    │
│         │                                                │
│         ▼                                                │
│  ┌─────────────────────────────────┐                    │
│  │  Log Aggregator (Loki/ELK)     │                    │
│  │       (customer's choice)       │                    │
│  └─────────────────────────────────┘                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Related Code Files

| File | Purpose |
|------|---------|
| `src/logging/logger.ts` | Pino logger setup |
| `src/metrics/prometheus.ts` | Metrics endpoint |
| `src/routes/health-route.ts` | Health checks |
| `src/middleware/rate-limit.ts` | Rate limiting |
| `src/middleware/security.ts` | Security headers |
| `docker-compose.prod.yml` | Production config |

---

## Implementation Steps

### Step 1: Structured Logging (pino)

```typescript
// src/logging/logger.ts
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isProduction
    ? {
        // Production: JSON format
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // Development: pretty print
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      }),
});

// Request logger middleware
export function createRequestLogger() {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
        },
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  });
}

// Create child logger with context
export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
```

### Step 2: Prometheus Metrics

```typescript
// src/metrics/prometheus.ts
import { FastifyInstance } from 'fastify';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
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
  });
}
```

### Step 3: Health Check Endpoints

```typescript
// src/routes/health-route.ts
import { FastifyInstance } from 'fastify';
import { getPrisma } from '@/database';
import { getProcessingQueue } from '@/queue/processing-queue';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  checks: {
    database: boolean;
    redis: boolean;
    queue: boolean;
  };
  version: string;
  uptime: number;
}

export async function healthRoute(fastify: FastifyInstance): Promise<void> {
  // Basic health check (for load balancers)
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Detailed readiness check
  fastify.get('/ready', async (request, reply) => {
    const checks = {
      database: false,
      redis: false,
      queue: false,
    };

    // Check database
    try {
      const prisma = getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Check Redis/Queue
    try {
      const queue = getProcessingQueue();
      await queue.getJobCounts();
      checks.redis = true;
      checks.queue = true;
    } catch {
      checks.redis = false;
      checks.queue = false;
    }

    const allHealthy = Object.values(checks).every(Boolean);

    const response: HealthStatus = {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
    };

    reply.status(allHealthy ? 200 : 503).send(response);
  });

  // Liveness probe (just checks process is running)
  fastify.get('/live', async () => {
    return { alive: true };
  });
}
```

### Step 4: Rate Limiting

```typescript
// src/middleware/rate-limit.ts
import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

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
```

### Step 5: Security Headers

```typescript
// src/middleware/security.ts
import { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

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
```

### Step 6: Error Alerting

```typescript
// src/alerting/webhook.ts
import { logger } from '@/logging/logger';

interface AlertPayload {
  level: 'error' | 'critical';
  message: string;
  context: Record<string, unknown>;
  timestamp: string;
}

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD || '5', 10);

// Track error counts for threshold alerting
const errorCounts = new Map<string, { count: number; lastReset: number }>();

export async function sendAlert(payload: AlertPayload): Promise<void> {
  if (!ALERT_WEBHOOK_URL) {
    logger.warn('Alert webhook not configured', payload);
    return;
  }

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${payload.level.toUpperCase()}] ${payload.message}`,
        ...payload,
      }),
    });
  } catch (error) {
    logger.error('Failed to send alert', { error, payload });
  }
}

export function trackError(errorType: string, context: Record<string, unknown>): void {
  const now = Date.now();
  const hourAgo = now - 3600000;

  let entry = errorCounts.get(errorType);

  // Reset if older than 1 hour
  if (!entry || entry.lastReset < hourAgo) {
    entry = { count: 0, lastReset: now };
    errorCounts.set(errorType, entry);
  }

  entry.count++;

  // Alert if threshold exceeded
  if (entry.count === ALERT_THRESHOLD) {
    sendAlert({
      level: 'error',
      message: `Error threshold exceeded: ${errorType} (${entry.count} in last hour)`,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Step 7: Graceful Shutdown

```typescript
// src/shutdown.ts
import { FastifyInstance } from 'fastify';
import { closeQueue } from '@/queue/processing-queue';
import { getPrisma } from '@/database';
import { logger } from '@/logging/logger';

export function configureGracefulShutdown(app: FastifyInstance): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      try {
        // Stop accepting new requests
        await app.close();
        logger.info('HTTP server closed');

        // Close queue connections
        await closeQueue();
        logger.info('Queue connections closed');

        // Close database connections
        await getPrisma().$disconnect();
        logger.info('Database connections closed');

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });
  }
}
```

### Step 8: Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/ragbase
      - REDIS_URL=redis://redis:6379
      - API_KEY=${API_KEY}
      - LOG_LEVEL=info
      - RATE_LIMIT_MAX=100
      - RATE_LIMIT_WINDOW=1 minute
      - ALERT_WEBHOOK_URL=${ALERT_WEBHOOK_URL}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
    networks:
      - internal

  ai-worker:
    build:
      context: .
      dockerfile: docker/ai-worker.Dockerfile
    restart: unless-stopped
    environment:
      - REDIS_URL=redis://redis:6379
      - CALLBACK_URL=http://backend:3000/internal/callback
      - OCR_ENABLED=${OCR_ENABLED:-false}
      - LOG_LEVEL=INFO
      - LOG_FORMAT=json
    depends_on:
      redis:
        condition: service_healthy
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
    networks:
      - internal

  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=ragbase
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
    networks:
      - internal

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    networks:
      - internal

networks:
  internal:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
```

### Step 9: Production Environment Template

```bash
# .env.production.example

# Database
POSTGRES_PASSWORD=change-this-strong-password

# API
API_KEY=change-this-to-secure-api-key

# Processing
MAX_FILE_SIZE_MB=50
OCR_ENABLED=false

# Alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx
ALERT_THRESHOLD=5

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute

# CORS
CORS_ORIGIN=https://your-domain.com

# Logging
LOG_LEVEL=info
```

### Step 10: Deployment Checklist

```markdown
## Pre-Deployment Checklist

### Security
- [ ] API_KEY is strong and unique
- [ ] POSTGRES_PASSWORD is strong
- [ ] CORS_ORIGIN is set to production domain
- [ ] No secrets in Docker images
- [ ] No debug endpoints exposed

### Infrastructure
- [ ] PostgreSQL has pgvector extension
- [ ] Redis persistence enabled
- [ ] Health checks configured
- [ ] Resource limits set
- [ ] Volumes for data persistence

### Monitoring
- [ ] /metrics endpoint accessible to Prometheus
- [ ] Log aggregation configured
- [ ] Alert webhook tested
- [ ] Error thresholds appropriate

### Performance
- [ ] Database indexes created (HNSW for vectors)
- [ ] Connection pooling configured
- [ ] Rate limits appropriate for expected load

### Backup
- [ ] PostgreSQL backup strategy
- [ ] Redis persistence (AOF) enabled
- [ ] Disaster recovery plan documented
```

---

## Todo List

- [ ] Create `src/logging/logger.ts`
- [ ] Create `src/metrics/prometheus.ts`
- [ ] Create `src/routes/health-route.ts`
- [ ] Create `src/middleware/rate-limit.ts`
- [ ] Create `src/middleware/security.ts`
- [ ] Create `src/alerting/webhook.ts`
- [ ] Create `src/shutdown.ts`
- [ ] Create `docker-compose.prod.yml`
- [ ] Create `.env.production.example`
- [ ] Update app.ts to use production config
- [ ] Test /metrics endpoint
- [ ] Test health checks
- [ ] Test rate limiting
- [ ] Document deployment process

---

## Success Criteria

1. `/metrics` returns Prometheus format
2. `/health` and `/ready` endpoints work
3. Rate limiting blocks after 100 req/min
4. Logs are JSON in production
5. Graceful shutdown works correctly

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Metrics expose sensitive data | Filter sensitive labels |
| Rate limit false positives | Allow-list internal routes |
| Shutdown hangs | Timeout after 30s |

---

## Security Considerations

- Metrics endpoint internal only (firewall)
- No PII in logs
- API keys never logged
- Health checks don't expose internals

---

## Next Steps

Phase 1 (MVP) is complete after this phase. System is ready for:
- User acceptance testing
- Performance benchmarking
- Documentation review
- Phase 2 planning (Google Drive sync)
