terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Intentionally local state: this tree bootstraps the S3 bucket + DynamoDB
  # table that every OTHER tree (instrumented/terraform/aws/) uses as its
  # remote backend. It cannot remote-state the thing that creates remote
  # state, so this is the one exception in the project.
}
