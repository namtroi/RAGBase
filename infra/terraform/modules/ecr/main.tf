resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}/backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.project_name}-backend-repo"
    Environment = var.environment
  }
}

resource "aws_ecr_repository" "ai_worker" {
  name                 = "${var.project_name}/ai-worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.project_name}-ai-worker-repo"
    Environment = var.environment
  }
}

# Lifecycle policies to clean up old untagged images to save costs
resource "aws_ecr_lifecycle_policy" "backend_lifecycle" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1,
      description  = "Keep last 30 images",
      selection = {
        tagStatus     = "any",
        countType     = "imageCountMoreThan",
        countNumber   = 30
      },
      action = {
        type = "expire"
      }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "ai_worker_lifecycle" {
  repository = aws_ecr_repository.ai_worker.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1,
      description  = "Keep last 30 images",
      selection = {
        tagStatus     = "any",
        countType     = "imageCountMoreThan",
        countNumber   = 30
      },
      action = {
        type = "expire"
      }
    }]
  })
}
