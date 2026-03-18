variable "project_name" {
  type        = string
  description = "The name of the project"
}

variable "environment" {
  type        = string
  description = "The deployment environment"
}

variable "domain_name" {
  type        = string
  description = "Domain name for the frontend (e.g., ragbase.com)"
  default     = "" # Optional for demo if not using a custom domain
}
