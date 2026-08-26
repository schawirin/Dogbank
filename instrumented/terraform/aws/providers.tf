# =============================================================================
# Provider Configuration
# =============================================================================

locals {
  # var.environment folded into var.tags once here, then reused by every
  # resource file in this module instead of each one re-deriving it.
  common_tags = merge(var.tags, {
    Environment = var.environment
  })
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Configured against this module's own EKS cluster (module.eks in eks.tf).
# Uses `aws eks get-token` via the exec plugin -- the current, non-deprecated
# terraform-aws-modules/eks pattern (the older aws-iam-authenticator binary
# approach is deprecated).
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks", "get-token",
      "--cluster-name", module.eks.cluster_name,
      "--region", var.aws_region,
    ]
  }
}
