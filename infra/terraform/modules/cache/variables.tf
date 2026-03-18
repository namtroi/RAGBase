variable "project_name" {
  type        = string
  description = "The name of the project"
}

variable "environment" {
  type        = string
  description = "The deployment environment"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for the Redis subnet group"
}

variable "redis_sg_id" {
  type        = string
  description = "Security Group ID for the Redis cluster"
}

variable "node_type" {
  type        = string
  description = "ElastiCache instance node type"
  default     = "cache.t4g.micro"
}

variable "num_cache_nodes" {
  type        = number
  description = "Number of cache nodes"
  default     = 1
}
