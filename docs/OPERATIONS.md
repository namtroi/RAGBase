# Production Operations Quick Reference

## 🚀 Deployment

```bash
# Start production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Stop
docker-compose -f docker-compose.prod.yml down
```

## 🏥 Health Checks

```bash
# Basic health
curl http://localhost:3000/health

# Detailed readiness (DB, Redis, Queue)
curl http://localhost:3000/ready | jq

# Liveness
curl http://localhost:3000/live
```

## 📊 Metrics

```bash
# All metrics
curl http://localhost:3000/metrics

# Request rate
curl http://localhost:3000/metrics | grep http_requests_total

# Memory usage
curl http://localhost:3000/metrics | grep process_resident_memory_bytes

# Queue size
curl http://localhost:3000/metrics | grep processing_queue_size
```

## 🔍 Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Check service status
docker-compose -f docker-compose.prod.yml ps

# Restart service
docker-compose -f docker-compose.prod.yml restart backend
```

### Database Issues
```bash
# Check PostgreSQL health
docker exec ragbase-postgres-1 pg_isready -U postgres

# Check pgvector extension
docker exec -it ragbase-postgres-1 psql -U postgres -d schemaforge -c "SELECT * FROM pg_extension WHERE extname='vector';"

# View database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

### Queue Issues
```bash
# Check Redis
docker exec ragbase-redis-1 redis-cli ping

# View queue metrics
curl http://localhost:3000/metrics | grep processing_queue_size

# Redis memory
docker exec -it ragbase-redis-1 redis-cli INFO memory
```

### High Memory
```bash
# Check current usage
curl http://localhost:3000/metrics | grep process_resident_memory_bytes

# Docker stats
docker stats --no-stream
```

## 🔄 Updates

```bash
# Pull latest
docker-compose -f docker-compose.prod.yml pull

# Graceful restart (zero downtime)
docker-compose -f docker-compose.prod.yml up -d

# Force rebuild
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## 💾 Backup

### PostgreSQL
```bash
# Backup
docker exec ragbase-postgres-1 pg_dump -U postgres schemaforge > backup-$(date +%Y%m%d).sql

# Restore
cat backup-20251219.sql | docker exec -i ragbase-postgres-1 psql -U postgres schemaforge
```

### Redis
```bash
# Trigger save
docker exec ragbase-redis-1 redis-cli BGSAVE

# Copy AOF file
docker cp ragbase-redis-1:/data/appendonly.aof ./redis-backup-$(date +%Y%m%d).aof
```

## 📈 Performance

### Rate Limiting
```bash
# Test rate limit (send 101 requests)
for i in {1..101}; do
  curl -H "X-API-Key: your-key" http://localhost:3000/api/documents
done
# Should get 429 after 100
```

### Response Times
```bash
# 95th percentile latency (if Prometheus installed)
curl -s "http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))"
```

## 🔐 Security

### Check Security Headers
```bash
curl -I http://localhost:3000/health | grep -E "(x-frame-options|x-content-type-options|strict-transport-security)"
```

### Rotate API Key
1. Update `.env.production` with new `API_KEY`
2. Restart: `docker-compose -f docker-compose.prod.yml restart backend`
3. Update clients with new key

## 🔔 Alerts

### Test Alert Webhook
```bash
# Trigger test alert by causing errors
# Or manually test webhook
curl -X POST $ALERT_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text":"Test alert from RAGBase"}'
```

## 🎛️ Configuration

### Environment Variables (in .env.production)
```bash
# Security
API_KEY=<secure-key>
POSTGRES_PASSWORD=<strong-password>
CORS_ORIGIN=https://your-domain.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute

# Alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_THRESHOLD=5

# Logging
LOG_LEVEL=info
```

## 📞 Emergency Procedures

### Service Degradation
1. Check `/ready` endpoint for failing components
2. Review recent logs for errors
3. Check metrics for anomalies
4. Scale resources if needed

### Complete Outage
1. Check all services: `docker-compose ps`
2. Review logs: `docker-compose logs --tail=100`
3. Restart if needed: `docker-compose restart`
4. If persistent, restore from backup

### Data Recovery
1. Stop services
2. Restore database from backup
3. Restore Redis AOF if needed
4. Start services
5. Verify with `/ready` endpoint

## 📊 Monitoring Dashboards

### Recommended Metrics to Monitor
- Request rate (`http_requests_total`)
- Error rate (status 5xx)
- Response latency (p50, p95, p99)
- Queue depth (`processing_queue_size`)
- Memory usage (`process_resident_memory_bytes`)
- CPU usage (`process_cpu_user_seconds_total`)

### Alert Thresholds (suggestions)
- Error rate > 5% of requests
- p95 latency > 2 seconds
- Queue depth > 100 jobs
- Memory usage > 90% of limit
- Disk usage > 85%

---

**For detailed information, see:**
- [Production Deployment Guide](./production-deployment.md)
- [Production Features](./production-features.md)
- [Deployment Checklist](./deployment-checklist.md)
