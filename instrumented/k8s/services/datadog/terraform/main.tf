# =============================================================================
# DogBank - Datadog Terraform Configuration
# =============================================================================
# Configura monitors e notebooks para Bits AI SRE
# =============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.66"
    }
  }
}

provider "datadog" {
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
  api_url = "https://api.${var.datadog_site}/"
}
