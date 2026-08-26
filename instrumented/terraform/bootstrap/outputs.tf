# Paste these three values into instrumented/terraform/aws/backend.tf's
# placeholder values (REPLACE_WITH_*) before running `terraform init` there.

output "bucket_name" {
  description = "S3 bucket name -> aws/backend.tf backend \"s3\" bucket"
  value       = aws_s3_bucket.terraform_state.id
}

output "bucket_arn" {
  description = "S3 bucket ARN, for reference/IAM policies."
  value       = aws_s3_bucket.terraform_state.arn
}

output "table_name" {
  description = "DynamoDB table name -> aws/backend.tf backend \"s3\" dynamodb_table"
  value       = aws_dynamodb_table.terraform_locks.name
}
