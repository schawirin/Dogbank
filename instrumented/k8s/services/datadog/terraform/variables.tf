# =============================================================================
# DogBank - Datadog Terraform Variables
# =============================================================================
# Variaveis para configuracao do provider Datadog
#
# Uso:
#   export TF_VAR_datadog_api_key="sua-api-key"
#   export TF_VAR_datadog_app_key="sua-app-key"
#   terraform init && terraform apply
# =============================================================================

variable "datadog_api_key" {
  description = "Datadog API Key"
  type        = string
  sensitive   = true
}

variable "datadog_app_key" {
  description = "Datadog Application Key"
  type        = string
  sensitive   = true
}

variable "datadog_site" {
  description = "Datadog site (datadoghq.com, datadoghq.eu, etc.)"
  type        = string
  default     = "datadoghq.com"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dogbank"
}

variable "slack_channel" {
  description = "Slack channel for alerts (e.g., @slack-oncall)"
  type        = string
  default     = "@slack-dogbank-alerts"
}

variable "pagerduty_service" {
  description = "PagerDuty service for critical alerts"
  type        = string
  default     = "@pagerduty-dogbank"
}

# =============================================================================
# Tags padrao para todos os recursos
# =============================================================================
locals {
  common_tags = [
    "env:${var.environment}",
    "managed_by:terraform",
    "project:dogbank"
  ]
}
