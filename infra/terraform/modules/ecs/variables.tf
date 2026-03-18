variable "project_name" {
  type        = string
  description = "The name of the project"
}

variable "environment" {
  type        = string
  description = "The deployment environment"
}

variable "vpc_id" {
  type        = string
  description = "The VPC ID"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for the ECS tasks"
}

variable "ecs_backend_sg_id" {
  type        = string
  description = "Security Group ID for the ECS backend tasks"
}

variable "ecs_worker_sg_id" {
  type        = string
  description = "Security Group ID for the ECS worker tasks"
}

variable "backend_target_group_arn" {
  type        = string
  description = "ARN of the ALB target group for the backend"
}

variable "backend_repository_url" {
  type        = string
  description = "URL of the backend ECR repository"
}

variable "ai_worker_repository_url" {
  type        = string
  description = "URL of the AI Worker ECR repository"
}

variable "efs_id" {
  type        = string
  description = "ID of the EFS file system for /tmp/uploads"
}

variable "db_endpoint" {
  type        = string
  description = "RDS database endpoint"
}

variable "redis_endpoint" {
  type        = string
  description = "ElastiCache Redis endpoint"
}

variable "aws_region" {
  type        = string
  description = "AWS region for CloudWatch logs"
}
