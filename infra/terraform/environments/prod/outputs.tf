output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "db_endpoint" {
  description = "RDS Endpoint"
  value       = module.database.db_endpoint
}

output "redis_endpoint" {
  description = "Redis Endpoint"
  value       = module.cache.redis_endpoint
}

output "efs_id" {
  description = "EFS ID"
  value       = module.efs.efs_id
}

output "backend_repository_url" {
  description = "Backend ECR Repository URL"
  value       = module.ecr.backend_repository_url
}

output "ai_worker_repository_url" {
  description = "AI Worker ECR Repository URL"
  value       = module.ecr.ai_worker_repository_url
}

output "alb_dns_name" {
  description = "DNS name of the application load balancer"
  value       = module.alb.alb_dns_name
}
