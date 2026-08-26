# =============================================================================
# ECR Repositories
# =============================================================================
# Authoritative list built from grepping every `image:` line in
# instrumented/k8s/base/*.yaml and cross-checking against the build matrix in
# .github/workflows/docker-publish.yml. This is every custom-built
# "schawirin/dogbank-*" image; third-party/public images (postgres, redis,
# rabbitmq, apache/kafka, nginx, ollama/ollama, gcr.io/datadoghq/cluster-agent)
# are intentionally excluded -- they're pulled straight from public registries
# and are not part of this migration's ECR footprint.
locals {
  ecr_images = toset([
    "dogbank-account-service",
    "dogbank-auth-service",
    "dogbank-bancocentral-service",
    "dogbank-cache-sync-service",
    "dogbank-chatbot-service",
    "dogbank-evildog-api",
    "dogbank-evildog-callback",
    "dogbank-fraud-detection-service",
    "dogbank-frontend",
    "dogbank-investment-registry-mock",
    "dogbank-investment-service",
    "dogbank-load-generator",
    "dogbank-notification-service",
    "dogbank-pix-worker",
    "dogbank-spi-mock-service",
    "dogbank-transaction-service",
  ])
}

resource "aws_ecr_repository" "this" {
  for_each = local.ecr_images

  name = each.value

  # MUTABLE is required, not a default left in place: docker-publish.yml
  # repeatedly rebuilds and overwrites the ":latest" tag on every push to
  # main. IMMUTABLE would make every subsequent push to an existing tag fail.
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.common_tags, {
    Name = each.value
  })
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = local.ecr_images

  repository = aws_ecr_repository.this[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
