# =============================================================================
# GitHub Actions CI IAM User
# =============================================================================
# Static IAM access keys (per the approved migration decision -- not OIDC).
# Scoped to exactly what .github/workflows/docker-publish.yml and
# .github/workflows/deploy-eks.yml actually do against AWS today:
#   - ECR login + image push/pull (docker-publish.yml, once it moves off
#     Docker Hub)
#   - `aws eks update-kubeconfig` (both workflows), which needs
#     eks:DescribeCluster
# `kubectl apply` / `kubectl rollout` themselves talk to the Kubernetes API,
# authorized via the namespace-scoped EKS access entry in eks.tf, not IAM --
# so no additional AWS Actions are needed for those. No Route53, ACM, or
# Secrets Manager permissions are granted: the CI doesn't touch those today.

resource "aws_iam_user" "github_actions" {
  name = var.github_actions_iam_user_name

  tags = local.common_tags
}

resource "aws_iam_access_key" "github_actions" {
  user = aws_iam_user.github_actions.name
}

resource "aws_iam_user_policy" "github_actions" {
  name = "${var.github_actions_iam_user_name}-policy"
  user = aws_iam_user.github_actions.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "EcrAuth"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*" # this action has no resource-level permissions
      },
      {
        Sid    = "EcrPushPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ]
        Resource = [for repo in aws_ecr_repository.this : repo.arn]
      },
      {
        Sid      = "EksDescribe"
        Effect   = "Allow"
        Action   = "eks:DescribeCluster"
        Resource = module.eks.cluster_arn
      }
    ]
  })
}
