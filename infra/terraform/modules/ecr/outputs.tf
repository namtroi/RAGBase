output "backend_repository_url" {
  description = "URL of the backend ECR repository"
  value       = aws_ecr_repository.backend.repository_url
}

output "ai_worker_repository_url" {
  description = "URL of the AI Worker ECR repository"
  value       = aws_ecr_repository.ai_worker.repository_url
}
