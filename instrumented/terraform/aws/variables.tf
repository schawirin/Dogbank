# =============================================================================
# Root Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "EKS cluster name (kept identical to the ClickOps'd cluster it replaces)"
  type        = string
  default     = "eks-sandbox-datadog"
}

variable "vpc_cidr" {
  description = "CIDR block for the new VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "node_instance_types" {
  description = "Instance types for the EKS managed node group"
  type        = list(string)
  default     = ["t3.large"]
}

# NOTE: node_desired_size / node_min_size / node_max_size below are directional
# demo-sizing defaults, not validated against the real aggregate resource
# requests/limits of every Deployment in instrumented/k8s/base/. Check actual
# workload sizing (CPU/memory requests across all ~16 services + Kafka/RabbitMQ/
# Ollama/Postgres-adjacent pods) before a real apply against the new account.
variable "node_desired_size" {
  description = "Desired number of nodes in the EKS managed node group"
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum number of nodes in the EKS managed node group"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of nodes in the EKS managed node group"
  type        = number
  default     = 4
}

variable "db_instance_class" {
  description = "RDS instance class (matches the current live dogbank-postgres instance)"
  type        = string
  default     = "db.t3.medium"
}

variable "db_engine_version" {
  description = "PostgreSQL engine version (matches the current live dogbank-postgres instance)"
  type        = string
  default     = "15.15"
}

variable "domain_name" {
  description = "Domain name that gets its own dedicated Route53 hosted zone in the new account"
  type        = string
  default     = "lab.dogbank.dog"
}

variable "eks_endpoint_public_access_cidrs" {
  description = <<-EOT
    CIDR blocks allowed to reach the EKS public API endpoint. Cost/ops-conscious
    demo choice: defaults to 0.0.0.0/0 because GitHub-hosted Actions runners
    have no fixed, published IP range and there is no private connectivity
    path (VPN/Direct Connect/self-hosted runner) today. Trade-off: the API
    server is reachable from the whole internet, gated only by IAM/RBAC auth
    -- there is no network-layer restriction. Narrow this list (and drop the
    default) if a static/known CIDR range (corporate VPN, self-hosted
    runners, etc.) ever becomes available.
  EOT
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "github_actions_iam_user_name" {
  description = "IAM user name for the GitHub Actions CI static credentials (ECR push/pull + eks:DescribeCluster only)"
  type        = string
  default     = "github-actions-dogbank"
}

variable "environment" {
  description = "Environment name, folded into the common tag set applied to every resource"
  type        = string
  default     = "dogbank"
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default = {
    Project   = "dogbank"
    ManagedBy = "terraform"
  }
}
