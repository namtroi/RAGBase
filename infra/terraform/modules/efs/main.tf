resource "aws_efs_file_system" "main" {
  creation_token = "${var.project_name}-efs-${var.environment}"
  encrypted      = true
  
  # For cost optimization in dev/demo, One Zone can be used, but standard is default.
  # We will just enable standard throughput since it's cheap enough for small usage.
  performance_mode = "generalPurpose"
  throughput_mode  = "bursting"

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }

  tags = {
    Name        = "${var.project_name}-efs"
    Environment = var.environment
  }
}

resource "aws_efs_mount_target" "main" {
  count           = length(var.private_subnet_ids)
  file_system_id  = aws_efs_file_system.main.id
  subnet_id       = var.private_subnet_ids[count.index]
  security_groups = [var.efs_sg_id]
}
