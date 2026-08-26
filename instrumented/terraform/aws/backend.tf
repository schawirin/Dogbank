# =============================================================================
# Remote State Backend (S3 + DynamoDB)
# =============================================================================
# Terraform backend blocks cannot interpolate variables or locals, so the
# values below are placeholder literals, NOT the real values.
#
# Before the first `terraform init` in this directory, replace them with the
# actual outputs of the bootstrap tree at instrumented/terraform/bootstrap/,
# which provisions:
#   - S3 bucket      -> convention: "dogbank-terraform-state"
#   - DynamoDB table -> convention: "dogbank-terraform-locks"
#
# (Exact bucket/table names come from that tree's own outputs -- it may add a
# suffix for global uniqueness. This file only encodes the naming convention
# both trees agree on.)
terraform {
  backend "s3" {
    bucket         = "REPLACE_WITH_BOOTSTRAP_BUCKET_OUTPUT" # expect ~ "dogbank-terraform-state"
    key            = "dogbank/aws/terraform.tfstate"
    region         = "REPLACE_WITH_REGION"                 # e.g. "us-east-1"
    dynamodb_table = "REPLACE_WITH_BOOTSTRAP_TABLE_OUTPUT" # expect ~ "dogbank-terraform-locks"
    encrypt        = true
  }
}
