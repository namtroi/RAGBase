output "efs_id" {
  description = "The ID of the EFS file system"
  value       = aws_efs_file_system.main.id
}
