variable "aws_region" {
  description = "AWS region to create the state bucket and lock table in."
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Name of the S3 bucket that will hold Terraform remote state for the aws/ tree. This exact default is referenced by the placeholder values in instrumented/terraform/aws/backend.tf."
  type        = string
  default     = "dogbank-terraform-state"
}

variable "table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking by the aws/ tree. This exact default is referenced by the placeholder values in instrumented/terraform/aws/backend.tf."
  type        = string
  default     = "dogbank-terraform-locks"
}

variable "tags" {
  description = "Common tags applied to the bootstrap resources."
  type        = map(string)
  default = {
    Project   = "dogbank"
    ManagedBy = "terraform"
    Layer     = "bootstrap"
  }
}
