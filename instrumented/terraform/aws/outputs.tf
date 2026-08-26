# =============================================================================
# Outputs
# =============================================================================

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded certificate authority data for the EKS cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "ecr_repository_urls" {
  description = "Map of image name -> ECR repository URL"
  value       = { for name, repo in aws_ecr_repository.this : name => repo.repository_url }
}

output "rds_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = aws_db_instance.dogbank.endpoint
}

output "rds_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the generated RDS credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
  sensitive   = true
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID for var.domain_name"
  value       = aws_route53_zone.dogbank.zone_id
}

output "route53_name_servers" {
  description = "Name servers for the new hosted zone -- create matching NS records in the parent dogbank.dog zone to delegate"
  value       = aws_route53_zone.dogbank.name_servers
}

output "github_actions_access_key_id" {
  description = "IAM access key ID for the GitHub Actions CI user"
  value       = aws_iam_access_key.github_actions.id
  sensitive   = true
}

output "github_actions_secret_access_key" {
  description = "IAM secret access key for the GitHub Actions CI user"
  value       = aws_iam_access_key.github_actions.secret
  sensitive   = true
}
