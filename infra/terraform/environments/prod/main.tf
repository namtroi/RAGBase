terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "networking" {
  source = "../../modules/networking"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = "10.0.0.0/16"
  
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]
  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
}

module "database" {
  source = "../../modules/database"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.networking.private_subnet_ids
  rds_sg_id          = module.networking.rds_sg_id
  
  db_username    = var.db_username
  db_password    = var.db_password
  instance_class = "db.t4g.micro"
}

module "cache" {
  source = "../../modules/cache"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.networking.private_subnet_ids
  redis_sg_id        = module.networking.redis_sg_id
  
  node_type       = "cache.t4g.micro"
  num_cache_nodes = 1
}

module "efs" {
  source = "../../modules/efs"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.networking.private_subnet_ids
  efs_sg_id          = module.networking.efs_sg_id
}

module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

module "alb" {
  source = "../../modules/alb"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  alb_sg_id         = module.networking.alb_sg_id
}

module "ecs" {
  source = "../../modules/ecs"

  project_name        = var.project_name
  environment         = var.environment
  aws_region          = var.aws_region
  vpc_id              = module.networking.vpc_id
  private_subnet_ids  = module.networking.private_subnet_ids
  
  ecs_backend_sg_id = module.networking.ecs_backend_sg_id
  ecs_worker_sg_id  = module.networking.ecs_worker_sg_id
  
  backend_target_group_arn = module.alb.backend_target_group_arn
  backend_repository_url   = module.ecr.backend_repository_url
  ai_worker_repository_url = module.ecr.ai_worker_repository_url
  
  efs_id         = module.efs.efs_id
  db_endpoint    = module.database.db_endpoint
  redis_endpoint = module.cache.redis_endpoint
}
