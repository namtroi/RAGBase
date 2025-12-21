# Production Readiness Features

This document provides an overview of the production-ready features implemented in RAGBase.

## 🎯 Overview

The RAGBase backend includes comprehensive production features for observability, security, and reliability:

- **Structured Logging** with Pino (JSON in production)
- **Prometheus Metrics** for monitoring
- **Health Checks** for orchestration
- **Rate Limiting** for API protection
- **Security Headers** via Helmet
- **Graceful Shutdown** for zero-downtime deployments
- **Error Alerting** via webhooks

## 📊 Observability

### Structured Logging

Production logs are output in JSON format for easy parsing by log aggregators:

```json
{
  "level": "info",
  "time": "2025-12-19T21:21:11.123Z",
  "msg": "Document processed successfully",
  "documentId": "doc-123",
  "format": "pdf",
  "duration": 1234
}
```

**Configuration:**
- `LOG_LEVEL` - Set logging level (debug, info, warn, error)
- Development: Pretty-printed colored output
- Production: JSON format with ISO timestamps

### Prometheus Metrics

Access metrics at `http://localhost:3000/metrics`

**Custom Metrics:**

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request duration with buckets |
| `documents_processed_total` | Counter | Documents processed by status, format, lane |
| `processing_queue_size` | Gauge | Current queue size by status |
| `embedding_generation_duration_seconds` | Histogram | Embedding generation time |

**Plus:** All default Node.js metrics (CPU, memory, GC, event loop, etc.)

**Example Prometheus Query:**
```promql
# Request rate
rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Queue backlog
processing_queue_size{status="waiting"}
```

## 🏥 Health Checks

### Endpoints

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `GET /health` | Basic liveness | Load balancer health check |
| `GET /ready` | Detailed readiness | Kubernetes readiness probe |
| `GET /live` | Process alive | Kubernetes liveness probe |

### `/ready` Response

```json
{
  "status": "ok",
  "checks": {
    "database": true,
    "redis": true,
    "queue": true
  },
  "version": "0.1.0",
  "uptime": 3600.5
}
```

Returns 200 if all healthy, 503 if any check fails.

## 🔒 Security

### Rate Limiting

**Default:** 100 requests/minute per IP

**Configuration:**
```bash
RATE_LIMIT_MAX=100          # Max requests
RATE_LIMIT_WINDOW=1 minute  # Time window
```

**Behavior:**
- IP-based limiting (respects X-Forwarded-For)
- Custom error response with retry-after
- Allowlist: /health, /metrics, /internal/*

**Rate Limit Response (429):**
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests, please try again later",
  "retryAfter": "60000"
}
```

### Security Headers

Implemented via Helmet:

- `Content-Security-Policy` - XSS protection
- `X-Content-Type-Options: nosniff` - MIME sniffing protection
- `X-Frame-Options: DENY` - Clickjacking protection
- `Strict-Transport-Security` - HTTPS enforcement
- No `X-Powered-By` header

### CORS

Configurable via `CORS_ORIGIN`:
```bash
CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

### Request Tracing

Every request gets a unique ID:
- Accepts `X-Request-ID` header
- Generates if not provided: `req-{timestamp}-{random}`
- Returns in response headers

## 🔔 Alerting

### Webhook Integration

Send alerts to Slack/Discord/etc when errors exceed threshold.

**Configuration:**
```bash
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx
ALERT_THRESHOLD=5  # Alert after 5 errors/hour
```

**Alert Payload:**
```json
{
  "level": "error",
  "message": "Error threshold exceeded: DATABASE_CONNECTION (5 in last hour)",
  "context": {
    "errorType": "DATABASE_CONNECTION",
    "count": 5
  },
  "timestamp": "2025-12-19T21:21:11.123Z"
}
```

## 🔄 Graceful Shutdown

Handles `SIGTERM` and `SIGINT` signals:

1. Stop accepting new requests
2. Complete in-flight requests
3. Close queue connections
4. Disconnect database
5. Exit with code 0 (or 1 on error)

**Behavior:**
```
SIGTERM received → Close HTTP → Close Queue → Close DB → Exit
```

Perfect for:
- Zero-downtime deployments
- Kubernetes rolling updates
- Docker container restarts

## 🐳 Docker Production

### docker-compose.prod.yml

Features:
- Health checks for all services
- Resource limits (memory)
- Persistent volumes for data
- Service dependencies
- Restart policies
- Internal network isolation

**Start:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Check Status:**
```bash
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f backend
```

## 📈 Monitoring Stack (Optional)

### Prometheus + Grafana

**Prometheus scrape config:**
```yaml
scrape_configs:
  - job_name: 'ragbase'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

**Grafana Dashboards:**
- Request rate and latency
- Error rates by endpoint
- Queue depth and processing time
- System resources (CPU, memory, GC)

### Log Aggregation

**Loki/Promtail:**
```yaml
scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
```

**ELK Stack:**
Use Filebeat to ship JSON logs to Elasticsearch.

## 🧪 Testing

### Manual Testing

```bash
# Health checks
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:3000/live

# Metrics
curl http://localhost:3000/metrics | grep http_requests_total

# Rate limiting
for i in {1..101}; do curl -H "X-API-Key: test" http://localhost:3000/api/documents; done

# Graceful shutdown
docker-compose -f docker-compose.prod.yml kill -s SIGTERM backend
```

### Integration Tests

```bash
cd apps/backend
pnpm test tests/integration/production-readiness.test.ts
```

## 📚 Documentation

- [Production Deployment Guide](./production-deployment.md)
- [Deployment Checklist](./deployment-checklist.md)

## 🎓 Best Practices

1. **Never log sensitive data** - API keys, passwords, PII
2. **Use structured logging** - Easier to query and aggregate
3. **Monitor metrics** - Set up alerts on key metrics
4. **Test graceful shutdown** - Ensure no data loss
5. **Set appropriate rate limits** - Balance security and UX
6. **Enable health checks** - Critical for orchestration
7. **Backup regularly** - Database and Redis persistence

## 🚨 Troubleshooting

### High Memory Usage
```bash
# Check metrics for memory leaks
curl http://localhost:3000/metrics | grep process_resident_memory_bytes
```

### Database Connection Issues
```bash
# Check readiness
curl http://localhost:3000/ready | jq '.checks.database'
```

### Queue Backlog
```bash
# Check queue size
curl http://localhost:3000/metrics | grep processing_queue_size
```

### Rate Limiting Issues
- Check if IP is being correctly identified
- Verify X-Forwarded-For header from proxy
- Adjust limits if legitimate traffic is blocked

## 🎉 Summary

All production readiness features are implemented and tested. The system is ready for production deployment with:

✅ Comprehensive observability  
✅ Security hardening  
✅ Scalable architecture  
✅ Zero-downtime deployments  
✅ Error alerting  
✅ Complete documentation  

Ready to deploy! 🚀
