# Pre-Deployment Checklist

## Security
- [ ] API_KEY is strong and unique
- [ ] POSTGRES_PASSWORD is strong
- [ ] CORS_ORIGIN is set to production domain
- [ ] No secrets in Docker images
- [ ] No debug endpoints exposed

## Infrastructure
- [ ] PostgreSQL has pgvector extension
- [ ] Redis persistence enabled
- [ ] Health checks configured
- [ ] Resource limits set
- [ ] Volumes for data persistence

## Monitoring
- [ ] /metrics endpoint accessible to Prometheus
- [ ] Log aggregation configured
- [ ] Alert webhook tested
- [ ] Error thresholds appropriate

## Performance
- [ ] Database indexes created (HNSW for vectors)
- [ ] Connection pooling configured
- [ ] Rate limits appropriate for expected load

## Backup
- [ ] PostgreSQL backup strategy
- [ ] Redis persistence (AOF) enabled
- [ ] Disaster recovery plan documented
