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

variable "existing_vpc_id" {
  description = "ID of the account's existing shared default VPC to deploy into (this account is at its 5-VPC-per-region quota, shared by other teams -- see network.tf)"
  type        = string
  default     = "vpc-0f8d443ba6e668bed"
}

variable "existing_nat_gateway_id" {
  description = "ID of the existing NAT Gateway (in var.existing_vpc_id) that this project's new private subnets route through, shared with other teams' private subnets in the same VPC"
  type        = string
  default     = "nat-06672820db9842a1c"
}

variable "new_private_subnet_cidrs" {
  description = "CIDR blocks for the new dedicated private subnets this project creates inside the existing VPC -- verified free of collision with every subnet already in that VPC"
  type        = list(string)
  default     = ["172.31.192.0/20", "172.31.208.0/20"]
}

variable "new_public_subnet_cidrs" {
  description = "CIDR blocks for the new dedicated public subnets this project creates inside the existing VPC -- verified free of collision with every subnet already in that VPC"
  type        = list(string)
  default     = ["172.31.224.0/20", "172.31.240.0/20"]
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
