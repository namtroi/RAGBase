variable "project_name" {
  type        = string
  description = "The name of the project"
  default     = "ragbase"
}

variable "environment" {
  type        = string
  description = "The deployment environment (e.g., prod, dev)"
  default     = "prod"
}

variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  type        = list(string)
  description = "List of CIDR blocks for public subnets"
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnets" {
  type        = list(string)
  description = "List of CIDR blocks for private subnets"
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "azs" {
  type        = list(string)
  description = "List of Availability Zones to use"
  default     = ["us-east-1a", "us-east-1b"]
}
