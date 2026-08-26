# =============================================================================
# EKS Cluster
# =============================================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.0"

  # NOTE on argument names: the "~> 21.0" line underwent a significant
  # interface rewrite partway through its releases (confirmed by resolving
  # this constraint against the registry while authoring this tree -- it
  # currently lands on 21.x with `name`/`kubernetes_version`/`endpoint_public_access`/
  # `addons`, not the older `cluster_name`/`cluster_version`/
  # `cluster_endpoint_public_access`/`cluster_addons` names). Outputs
  # (module.eks.cluster_name, cluster_endpoint, cluster_arn,
  # node_security_group_id, etc.) were NOT renamed and are used as-is
  # elsewhere in this tree.
  name               = var.cluster_name
  kubernetes_version = "1.31"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # GitHub-hosted runners need public reachability to the API server; there is
  # no private connectivity path (VPN/Direct Connect/self-hosted runner) today.
  # endpoint_public_access_cidrs defaults to 0.0.0.0/0 (see variables.tf) --
  # a deliberately accepted risk, not an oversight: GitHub-hosted runners have
  # no fixed/published IP range to scope this to. Access is still gated by
  # IAM/RBAC (see access_entries below), just not restricted at the network
  # layer. Narrow eks_endpoint_public_access_cidrs if a static CIDR ever
  # becomes available.
  endpoint_public_access       = true
  endpoint_public_access_cidrs = var.eks_endpoint_public_access_cidrs

  # Lets the IAM principal that actually runs `terraform apply` administer the
  # cluster too, so this tree can never lock itself out of the very cluster it
  # just created. This is independent of, and does not widen, the namespace-
  # scoped access entry granted to the GitHub Actions CI user below.
  enable_cluster_creator_admin_permissions = true

  authentication_mode = "API_AND_CONFIG_MAP"

  addons = {
    coredns    = {}
    kube-proxy = {}
    vpc-cni    = {}
    # Required for EKS Pod Identity associations (see module.ebs_csi_pod_identity
    # below) to actually serve credentials in-cluster.
    eks-pod-identity-agent = {}
    # Without this, every StatefulSet/PVC requesting storageClassName "gp2"
    # (kafka, rabbitmq, ollama) hangs Pending forever on a fresh cluster.
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    default = {
      instance_types = var.node_instance_types
      min_size       = var.node_min_size
      max_size       = var.node_max_size
      desired_size   = var.node_desired_size
    }
  }

  # Namespace-scoped access for the GitHub Actions CI user -- genuine least
  # privilege, not cluster-admin. AmazonEKSAdminPolicy (not AmazonEKSEditPolicy)
  # is required here: Edit does not cover writing RBAC Role/RoleBinding objects,
  # and instrumented/k8s/base/evildog-api-rbac.yaml creates exactly that.
  access_entries = {
    github_actions = {
      principal_arn = aws_iam_user.github_actions.arn

      policy_associations = {
        dogbank_admin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSAdminPolicy"
          access_scope = {
            type       = "namespace"
            namespaces = ["dogbank"]
          }
        }
      }
    }
  }

  tags = local.common_tags
}

# IAM permissions for the aws-ebs-csi-driver addon via EKS Pod Identity (no
# OIDC provider needed for this). The "no OIDC" decision made elsewhere is
# specifically about the CI-to-AWS auth path (GitHub Actions uses static IAM
# keys instead) -- it says nothing about in-cluster workload identity, and Pod
# Identity is the simplest supported mechanism for that here.
module "ebs_csi_pod_identity" {
  source  = "terraform-aws-modules/eks-pod-identity/aws"
  version = "~> 1.0"

  name = "${var.cluster_name}-ebs-csi"

  attach_aws_ebs_csi_policy = true

  association_defaults = {
    namespace       = "kube-system"
    service_account = "ebs-csi-controller-sa"
  }

  associations = {
    main = {
      cluster_name = module.eks.cluster_name
    }
  }

  tags = local.common_tags
}
