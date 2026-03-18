output "db_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.postgres.endpoint
}

output "db_name" {
  description = "The database name"
  value       = aws_db_instance.postgres.db_name
}
