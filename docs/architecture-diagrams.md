# Production Architecture Diagrams

## Observability Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    Production Observability Stack                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐                                             │
│  │  Backend API    │                                             │
│  │  Port: 3000     │                                             │
│  │                 │                                             │
│  │  /metrics   ────┼────► ┌──────────────┐                      │
│  │  /health        │      │  Prometheus  │                      │
│  │  /ready         │      │  (scrape)    │                      │
│  └────────┬────────┘      └──────┬───────┘                      │
│           │                      │                               │
│           │ JSON logs            └──► ┌──────────────┐          │
│           │ (stdout)                  │   Grafana    │          │
│           ▼                           │ (visualize)  │          │
│  ┌─────────────────┐                 └──────────────┘          │
│  │ Log Aggregator  │                                             │
│  │  Loki / ELK     │                                             │
│  └─────────────────┘                                             │
│           │                                                       │
│           └──► Query & Alert                                     │
│                                                                   │
│  ┌─────────────────┐                                             │
│  │ Error Webhook   │                                             │
│  │ Slack/Discord   │                                             │
│  └─────────────────┘                                             │
│           ▲                                                       │
│           │ Threshold alerts                                     │
│           └──────── Backend API                                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow with Middleware

```
┌────────────────────────────────────────────────────────────────┐
│                       Request Pipeline                          │
└────────────────────────────────────────────────────────────────┘

  Client Request
       │
       ▼
  ┌─────────────────┐
  │ Security        │  ← Helmet (CSP, HSTS, etc.)
  │ Headers         │  ← CORS configuration
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Rate Limiting   │  ← 100 req/min per IP
  │ (IP-based)      │  ← Skip allowlist routes
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Metrics Hook    │  ← Record request start time
  │ (onRequest)     │  ← Track request count
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Route Handler   │  ← /health, /ready, /metrics
  │                 │  ← /api/* (with auth)
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Metrics Hook    │  ← Calculate duration
  │ (onResponse)    │  ← Update histograms
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Response        │  ← Add X-Request-ID
  │ Headers         │  ← Security headers
  └────────┬────────┘
           │
           ▼
  Client Response
```

## Health Check Detail

```
┌────────────────────────────────────────────────────────────────┐
│                      Health Check Endpoints                     │
└────────────────────────────────────────────────────────────────┘

  GET /health
  ┌─────────────────────┐
  │ Basic Check         │
  │ Returns: 200 OK     │
  │ Body: {status: ok}  │
  └─────────────────────┘
  
  GET /ready
  ┌─────────────────────┐
  │ Readiness Check     │
  │ ✓ PostgreSQL ping   │
  │ ✓ Redis connection  │
  │ ✓ Queue accessible  │
  │ Returns: 200/503    │
  └─────────────────────┘
  
  GET /live
  ┌─────────────────────┐
  │ Liveness Check      │
  │ Process running?    │
  │ Returns: 200 OK     │
  │ Body: {alive: true} │
  └─────────────────────┘
```

## Metrics Collection

```
┌────────────────────────────────────────────────────────────────┐
│                      Prometheus Metrics                         │
└────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │ HTTP Metrics                                              │
  │ ─────────────────────────────────────────────────────────  │
  │ • http_requests_total           (counter)                 │
  │   Labels: method, path, status                            │
  │                                                            │
  │ • http_request_duration_seconds (histogram)               │
  │   Buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]               │
  │   Labels: method, path, status                            │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │ Business Metrics                                          │
  │ ─────────────────────────────────────────────────────────  │
  │ • documents_processed_total      (counter)                │
  │   Labels: status, format, lane                            │
  │                                                            │
  │ • processing_queue_size          (gauge)                  │
  │   Labels: status                                          │
  │                                                            │
  │ • embedding_generation_duration_seconds (histogram)       │
  │   Buckets: [0.1, 0.5, 1, 2, 5, 10]                       │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │ Node.js Runtime Metrics (Default)                         │
  │ ─────────────────────────────────────────────────────────  │
  │ • process_cpu_user_seconds_total                          │
  │ • process_resident_memory_bytes                           │
  │ • nodejs_heap_size_total_bytes                            │
  │ • nodejs_gc_duration_seconds                              │
  │ • nodejs_eventloop_lag_seconds                            │
  │ • ... and more                                            │
  └───────────────────────────────────────────────────────────┘
```

## Graceful Shutdown Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    Graceful Shutdown Process                    │
└────────────────────────────────────────────────────────────────┘

  SIGTERM/SIGINT Signal Received
         │
         ▼
  ┌─────────────────┐
  │ Log: Starting   │
  │ graceful        │
  │ shutdown        │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Close HTTP      │  ← Stop accepting new requests
  │ Server          │  ← Wait for in-flight requests (timeout: 30s)
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Close Queue     │  ← Disconnect from Redis
  │ Connection      │  ← Workers finish current jobs
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Disconnect      │  ← Close DB connection pool
  │ Database        │  ← Wait for queries to complete
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Log: Shutdown   │
  │ complete        │
  └────────┬────────┘
           │
           ▼
      Exit (0)

  If error at any step:
         │
         ▼
  ┌─────────────────┐
  │ Log error       │
  └────────┬────────┘
           │
           ▼
      Exit (1)
```

## Docker Compose Production Stack

```
┌────────────────────────────────────────────────────────────────┐
│              Docker Compose Production Services                 │
└────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  Backend API                                                 │
  │  Port: 3000                                                  │
  │  Health Check: curl http://localhost:3000/health            │
  │  Memory: 1GB limit, 512MB reservation                       │
  │  Depends on: PostgreSQL, Redis                              │
  └──────────────────┬──────────────────────────────────────────┘
                     │
       ┌─────────────┼─────────────┐
       │             │             │
       ▼             ▼             ▼
  ┌─────────┐  ┌─────────┐  ┌──────────┐
  │PostgreSQL│  │  Redis  │  │AI Worker │
  │ pgvector │  │ Queue   │  │  Python  │
  │          │  │         │  │          │
  │ Health:  │  │ Health: │  │ Health:  │
  │pg_isready│  │  ping   │  │/health   │
  │          │  │         │  │          │
  │ Volume:  │  │ Volume: │  │ Mem: 4GB │
  │ postgres-│  │ redis-  │  │          │
  │ data     │  │ data    │  │          │
  └─────────┘  └─────────┘  └──────────┘
       │             │
       └──── Persistent Storage ────┘
```

## Deployment Flow

```
┌────────────────────────────────────────────────────────────────┐
│                   Production Deployment Flow                    │
└────────────────────────────────────────────────────────────────┘

  1. Pre-Deployment
     ┌────────────────────────┐
     │ • Security checklist   │
     │ • Environment vars     │
     │ • Backup database      │
     └───────────┬────────────┘
                 │
                 ▼
  2. Build & Deploy
     ┌────────────────────────┐
     │ docker-compose build   │
     │ docker-compose up -d   │
     └───────────┬────────────┘
                 │
                 ▼
  3. Health Verification
     ┌────────────────────────┐
     │ GET /health            │
     │ GET /ready             │
     │ Check all services     │
     └───────────┬────────────┘
                 │
                 ▼
  4. Monitoring Setup
     ┌────────────────────────┐
     │ Prometheus scraping    │
     │ Log aggregation        │
     │ Alert webhook test     │
     └───────────┬────────────┘
                 │
                 ▼
  5. Traffic Routing
     ┌────────────────────────┐
     │ Update load balancer   │
     │ Monitor metrics        │
     │ Watch for errors       │
     └────────────────────────┘
```

## Alert Threshold Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    Error Alerting System                        │
└────────────────────────────────────────────────────────────────┘

  Error Occurs
       │
       ▼
  ┌─────────────────┐
  │ trackError()    │
  │ errorType, ctx  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Error Count Map │
  │ per error type  │
  │ 1-hour window   │
  └────────┬────────┘
           │
           ▼
    Count >= Threshold?
           │
    ┌──────┴──────┐
    │ No          │ Yes
    ▼             ▼
  Continue   ┌─────────────┐
  tracking   │ sendAlert() │
             │ to webhook  │
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │ Slack/      │
             │ Discord     │
             │ notification│
             └─────────────┘
```

---

All diagrams represent the production-ready architecture implemented in Phase 09.
