output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "alb_sg_id" {
  description = "Security Group ID for ALB"
  value       = aws_security_group.alb.id
}

output "ecs_backend_sg_id" {
  description = "Security Group ID for ECS Backend"
  value       = aws_security_group.ecs_backend.id
}

output "ecs_worker_sg_id" {
  description = "Security Group ID for ECS Worker"
  value       = aws_security_group.ecs_worker.id
}

output "rds_sg_id" {
  description = "Security Group ID for RDS"
  value       = aws_security_group.rds.id
}

output "redis_sg_id" {
  description = "Security Group ID for Redis"
  value       = aws_security_group.redis.id
}

output "efs_sg_id" {
  description = "Security Group ID for EFS"
  value       = aws_security_group.efs.id
}
