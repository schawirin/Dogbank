# =============================================================================
# Kubernetes Namespace
# =============================================================================
# The one and only place this Terraform tree touches the Kubernetes API.
#
# Everything else -- Deployments, Services, ConfigMaps, RBAC, the lot -- stays
# on the existing kubectl-apply CI pipeline (.github/workflows/deploy-eks.yml /
# docker-publish.yml), unchanged. This single resource exists only because the
# CI's own EKS access entry (AmazonEKSAdminPolicy scoped to the "dogbank"
# namespace, see eks.tf) is namespace-scoped by design and therefore cannot
# create the cluster-scoped Namespace object itself. This admin-level
# Terraform apply creates it once, up front, so the CI always has a namespace
# to be scoped into.
resource "kubernetes_namespace" "dogbank" {
  metadata {
    name = "dogbank"
  }

  depends_on = [module.eks]
}
