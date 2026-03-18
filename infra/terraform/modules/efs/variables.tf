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
  description = "List of private subnet IDs for EFS mount targets"
}

variable "efs_sg_id" {
  type        = string
  description = "Security Group ID for EFS"
}
