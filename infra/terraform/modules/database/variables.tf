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
  description = "List of private subnet IDs for the DB subnet group"
}

variable "rds_sg_id" {
  type        = string
  description = "Security Group ID for the RDS instance"
}

variable "db_name" {
  type        = string
  description = "Name of the initial database"
  default     = "ragbase"
}

variable "db_username" {
  type        = string
  description = "Database master username"
}

variable "db_password" {
  type        = string
  description = "Database master password"
  sensitive   = true
}

variable "instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t4g.micro"
}
