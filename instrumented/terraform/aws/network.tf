# =============================================================================
# Networking -- reuses the account's existing shared default VPC
# =============================================================================
# This account is a shared sandbox already at its 5-VPC-per-region quota
# (other teams' VPCs: cmse-cluster-vpc, vuln-handson-vpc, the chaos-cloud
# sandbox VPC, bambino-gambino-sjung-vpc), so creating a brand-new dedicated
# VPC (the original design) is not possible without either an account-wide
# quota increase or displacing another team's VPC -- neither is acceptable.
#
# Instead, this reuses the account's existing DEFAULT VPC (var.existing_vpc_id,
# 172.31.0.0/16), which several other teams already share via their own
# dedicated subnets (e.g. "RDS-Pvt-subnet-*", "sk-dev-private-*") routed
# through one common NAT Gateway (var.existing_nat_gateway_id). Rather than
# reusing anyone else's subnets (which would mix DogBank traffic/tags into
# another team's resources), this carves out brand-new, dedicated subnets in
# CIDR ranges verified free of collision with every existing subnet in this
# VPC at the time of writing (everything else in this VPC sits below
# 172.31.104.0; these subnets start at 172.31.192.0, far above that).
#
# Public subnets are deliberately NOT associated with an explicit route
# table: any subnet not explicitly associated falls back to the VPC's main
# route table, which already routes 0.0.0.0/0 to the existing Internet
# Gateway -- so no new IGW/route-table resource is needed for them.

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_vpc" "existing" {
  id = var.existing_vpc_id
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)

  vpc_id         = data.aws_vpc.existing.id
  vpc_cidr_block = data.aws_vpc.existing.cidr_block
}

resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = local.vpc_id
  availability_zone = local.azs[count.index]
  cidr_block        = var.new_private_subnet_cidrs[count.index]

  tags = merge(local.common_tags, {
    Name                                        = "${var.cluster_name}-private-${local.azs[count.index]}"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"           = "1"
  })
}

resource "aws_subnet" "public" {
  count = length(local.azs)

  vpc_id                  = local.vpc_id
  availability_zone       = local.azs[count.index]
  cidr_block              = var.new_public_subnet_cidrs[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name                                        = "${var.cluster_name}-public-${local.azs[count.index]}"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                    = "1"
  })
}

# New private route table pointing at the VPC's EXISTING NAT Gateway --
# other teams' private route tables in this VPC do the same thing, this just
# adds one more consumer of the same shared NAT Gateway rather than creating
# a second one (which would also cost more for no benefit).
resource "aws_route_table" "private" {
  vpc_id = local.vpc_id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.existing_nat_gateway_id
  }

  tags = merge(local.common_tags, {
    Name = "${var.cluster_name}-private-rt"
  })
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

locals {
  private_subnet_ids = aws_subnet.private[*].id
  public_subnet_ids  = aws_subnet.public[*].id
}
