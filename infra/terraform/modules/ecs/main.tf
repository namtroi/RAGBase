resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${var.project_name}-ecs-cluster"
    Environment = var.environment
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# IAM Roles for ECS Tasks
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-ecs-task-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy needed to mount EFS
resource "aws_iam_role_policy" "ecs_efs_mount_policy" {
  name = "${var.project_name}-ecs-efs-mount-policy"
  role = aws_iam_role.ecs_task_execution_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite",
          "elasticfilesystem:ClientRootAccess"
        ]
        Resource = "*" # Restrict to specific EFS ARN in production if needed
      }
    ]
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-backend-${var.environment}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "ai_worker" {
  name              = "/ecs/${var.project_name}-ai-worker-${var.environment}"
  retention_in_days = 14
}

# Subnets & Service Discovery integration (CloudMap) omitted for brevity 
# but should typically be used so backend can resolve "http://ai-worker:8000"

# Task Definition: Backend
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256 # 0.25 vCPU
  memory                   = 512 # 0.5 GB
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${var.backend_repository_url}:latest"
    essential = true
    
    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]
    
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "AI_WORKER_URL", value = "http://ai-worker.local:8000" } # Hardcoded for demo/local DNS
    ]
    
    # Needs AWS Secrets Manager for DATABASE_URL and REDIS_URL realistically
    secrets = [] 
    
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.backend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
    
    mountPoints = [{
      sourceVolume  = "shared-uploads"
      containerPath = "/tmp/uploads"
    }]
  }])

  volume {
    name = "shared-uploads"
    efs_volume_configuration {
      file_system_id          = var.efs_id
      transit_encryption      = "ENABLED"
    }
  }
}

# Task Definition: AI Worker
resource "aws_ecs_task_definition" "ai_worker" {
  family                   = "${var.project_name}-ai-worker-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 1024 # 1 vCPU
  memory                   = 4096 # 4 GB
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([{
    name      = "ai-worker"
    image     = "${var.ai_worker_repository_url}:latest"
    essential = true
    
    portMappings = [{
      containerPort = 8000
      protocol      = "tcp"
    }]
    
    environment = [
      { name = "MAX_WORKERS", value = "1" },
      { name = "CALLBACK_URL", value = "http://backend.local:3000/internal/callback" }
    ]
    
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ai_worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
    
    mountPoints = [{
      sourceVolume  = "shared-uploads"
      containerPath = "/tmp/uploads"
    }]
  }])

  volume {
    name = "shared-uploads"
    efs_volume_configuration {
      file_system_id          = var.efs_id
      transit_encryption      = "ENABLED"
    }
  }
}

# Services
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 100
  }

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.ecs_backend_sg_id]
  }

  load_balancer {
    target_group_arn = var.backend_target_group_arn
    container_name   = "backend"
    container_port   = 3000
  }
}

resource "aws_ecs_service" "ai_worker" {
  name            = "${var.project_name}-ai-worker-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ai_worker.arn
  desired_count   = 1

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 100
  }

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.ecs_worker_sg_id]
  }
}
