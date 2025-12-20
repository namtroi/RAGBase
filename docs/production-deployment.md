# Production Deployment Guide

## Overview

This guide covers deploying RAGBase to production with all observability and security features enabled.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL with pgvector extension
- Redis for queue management
- (Optional) Prometheus for metrics scraping
- (Optional) Slack webhook for error alerts

## Environment Configuration

1. Copy the production environment template:
   ```bash
   cp env.production.template .env.production
   ```

2. Update the following critical variables:
   - `POSTGRES_PASSWORD`: Use a strong password (20+ characters)
   - `API_KEY`: Generate a secure API key
   - `CORS_ORIGIN`: Set to your frontend domain(s)
   - `ALERT_WEBHOOK_URL`: Configure Slack/Discord webhook
   - `RATE_LIMIT_MAX`: Adjust based on expected traffic

## Deployment Steps

### 1. Build and Start Services

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 2. Verify Health

Check that all services are healthy:

```bash
# Backend health
curl http://localhost:3000/health

# Detailed readiness check
curl http://localhost:3000/ready

# Liveness probe
curl http://localhost:3000/live
```

Expected response from `/ready`:
```json
{
  "status": "ok",
  "checks": {
    "database": true,
    "redis": true,
    "queue": true
  },
  "version": "0.1.0",
  "uptime": 42.5
}
```

### 3. Verify Metrics

Access Prometheus metrics:

```bash
curl http://localhost:3000/metrics
```

You should see metrics like:
- `http_requests_total`
- `http_request_duration_seconds`
- `documents_processed_total`
- `processing_queue_size`
- Node.js runtime metrics

### 4. Test Rate Limiting

```bash
# Send 101 requests quickly
for i in {1..101}; do
  curl -H "X-API-Key: your-api-key" http://localhost:3000/api/documents
done
```

After 100 requests, you should see:
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests, please try again later",
  "retryAfter": "60000"
}
```

## Monitoring Setup

### Prometheus Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'ragbase-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Log Aggregation

Logs are output to stdout in JSON format in production. Configure your log aggregator (Loki, ELK, etc.) to collect from Docker:

```bash
docker logs -f ragbase-backend-1
```

Example log output:
```json
{
  "level": "info",
  "time": "2025-12-19T21:21:11.123Z",
  "msg": "Server running on port 3000"
}
```

## Security Hardening

### 1. Network Isolation

Ensure internal network is not exposed:
- Only expose necessary ports (3000 for backend)
- Use reverse proxy (nginx/traefik) with SSL

### 2. API Key Security

- Generate strong API keys: `openssl rand -base64 32`
- Rotate keys regularly
- Never commit keys to version control

### 3. Database Security

- Use strong PostgreSQL password
- Enable SSL for database connections
- Restrict database access to backend service only

### 4. Rate Limiting

Default: 100 requests/minute per IP. Adjust based on:
- Expected traffic patterns
- Available resources
- Security requirements

## Performance Tuning

### Database Connection Pool

Update `DATABASE_URL` with connection pooling:
```
postgresql://postgres:password@postgres:5432/ragbase?connection_limit=10
```

### Redis Memory

Monitor Redis memory usage:
```bash
docker exec -it ragbase-redis-1 redis-cli INFO memory
```

### Resource Limits

Adjust Docker resource limits in `docker-compose.prod.yml` based on:
- Expected document size
- Concurrent processing jobs
- Available system resources

## Troubleshooting

### Service Won't Start

1. Check logs:
   ```bash
   docker-compose -f docker-compose.prod.yml logs backend
   ```

2. Verify environment variables:
   ```bash
   docker-compose -f docker-compose.prod.yml config
   ```

### Database Connection Issues

1. Check PostgreSQL is healthy:
   ```bash
   docker-compose -f docker-compose.prod.yml ps postgres
   ```

2. Verify pgvector extension:
   ```bash
   docker exec -it ragbase-postgres-1 psql -U postgres -d ragbase -c "SELECT * FROM pg_extension WHERE extname='vector';"
   ```

### High Memory Usage

1. Check metrics:
   ```bash
   curl http://localhost:3000/metrics | grep process_resident_memory_bytes
   ```

2. Review queue size:
   ```bash
   curl http://localhost:3000/metrics | grep processing_queue_size
   ```

3. Adjust resource limits if needed

## Backup Strategy

### PostgreSQL Backups

Daily backup using pg_dump:
```bash
docker exec ragbase-postgres-1 pg_dump -U postgres ragbase > backup-$(date +%Y%m%d).sql
```

### Redis Persistence

Redis is configured with AOF (Append-Only File) persistence. Backup the AOF file:
```bash
docker exec ragbase-redis-1 redis-cli BGSAVE
docker cp ragbase-redis-1:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

## Scaling Considerations

### Horizontal Scaling

- Backend: Run multiple instances behind load balancer
- AI Worker: Scale workers based on queue size
- PostgreSQL: Consider read replicas for query scaling

### Vertical Scaling

Increase resource limits in `docker-compose.prod.yml`:
- Backend: 1G → 2G memory
- AI Worker: 4G → 8G memory (for larger models)
- PostgreSQL: 2G → 4G memory

## Maintenance

### Updates

1. Pull latest images:
   ```bash
   docker-compose -f docker-compose.prod.yml pull
   ```

2. Graceful restart:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

   Services will gracefully shutdown, completing in-flight requests.

### Database Migrations

1. Backup database first
2. Run migrations:
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend npm run db:migrate
   ```

## Support

For issues or questions:
1. Check logs for error messages
2. Review metrics for anomalies
3. Consult deployment checklist
4. Check health endpoints

---

**Next Steps:**
- Set up Prometheus + Grafana for metrics visualization
- Configure log aggregation (Loki/ELK)
- Set up automated backups
- Create alerting rules in Prometheus
