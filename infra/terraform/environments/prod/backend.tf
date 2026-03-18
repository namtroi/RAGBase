# Uncomment and configure this file to use S3 for Terraform state storage in production.
# Ensure the S3 bucket and DynamoDB table are created first (e.g., via a separate bootstrap module).

/*
terraform {
  backend "s3" {
    bucket         = "ragbase-terraform-state-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ragbase-terraform-locks-prod"
  }
}
*/
