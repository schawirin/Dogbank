# =============================================================================
# RDS PostgreSQL for DogBank
# =============================================================================
# Adapted from instrumented/docker/dogbank/datadog/terraform/rds-postgres.tf.
#
# That version located its VPC/subnets via a fragile chain of data sources
# (data.aws_eks_cluster -> data.aws_vpc -> data.aws_subnets filtered on a
# manually-applied "RDS-Pvt-subnet-*" tag) against the old ClickOps'd cluster.
# Here, VPC/subnets come directly from this same root module's own module.vpc
# outputs instead -- no external lookups, no manually-applied tags to keep in
# sync by hand.
#
# This instance is the single consolidated Postgres target for the migration
# (see max_connections override below); the actual data migration off the
# in-cluster postgres pod is a separate runbook workstream.

resource "aws_security_group" "rds_dogbank" {
  name_prefix = "rds-dogbank-"
  description = "Security group for DogBank RDS PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "PostgreSQL from within the VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }

  ingress {
    description     = "PostgreSQL from EKS worker nodes specifically"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "rds-dogbank-sg"
  })
}

resource "aws_db_subnet_group" "dogbank" {
  name_prefix = "dogbank-"
  description = "Subnet group for DogBank RDS"
  subnet_ids  = module.vpc.private_subnets

  tags = merge(local.common_tags, {
    Name = "dogbank-db-subnet-group"
  })
}

resource "aws_db_parameter_group" "dogbank" {
  name_prefix = "dogbank-postgres15-"
  family      = "postgres15"
  description = "Custom parameter group for DogBank with Datadog monitoring"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "track_activity_query_size"
    value        = "2048"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "pg_stat_statements.track"
    value        = "all"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "pg_stat_statements.max"
    value        = "10000"
    apply_method = "pending-reboot"
  }

  # Explicit override, not left to the db.t3.medium-derived default: this
  # instance is being consolidated as the single RDS target for several
  # services (account, auth, transaction, investment, fraud-detection, etc.),
  # so connection headroom needs to be a known, deliberate number rather than
  # whatever the instance-class formula happens to produce.
  parameter {
    name         = "max_connections"
    value        = "200"
    apply_method = "pending-reboot"
  }

  tags = merge(local.common_tags, {
    Name = "dogbank-postgres-params"
  })
}

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_instance" "dogbank" {
  identifier     = "dogbank-postgres"
  engine         = "postgres"
  engine_version = var.db_engine_version

  instance_class        = var.db_instance_class
  allocated_storage     = 20
  max_allocated_storage = 100 # auto-scales up to 100GB
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "dogbank"
  username = "dogbank"
  password = random_password.db_password.result

  vpc_security_group_ids = [aws_security_group.rds_dogbank.id]
  db_subnet_group_name   = aws_db_subnet_group.dogbank.name
  parameter_group_name   = aws_db_parameter_group.dogbank.name

  backup_retention_period = 7
  backup_window           = "03:00-04:00"         # UTC
  maintenance_window      = "mon:04:00-mon:05:00" # UTC

  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  publicly_accessible = false

  # Demo settings, carried over as-is from the baseline. Revisit before this
  # instance holds anything that matters beyond the demo/lab.
  deletion_protection = false
  skip_final_snapshot = true

  tags = merge(local.common_tags, {
    Name = "dogbank-postgres"
  })
}

resource "aws_iam_role" "rds_monitoring" {
  name_prefix = "rds-monitoring-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "rds-monitoring-role"
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name_prefix = "dogbank/postgres-"
  description = "DogBank PostgreSQL credentials"

  tags = merge(local.common_tags, {
    Name = "dogbank-postgres-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = aws_db_instance.dogbank.username
    password = random_password.db_password.result
    engine   = "postgres"
    host     = aws_db_instance.dogbank.address
    port     = aws_db_instance.dogbank.port
    dbname   = aws_db_instance.dogbank.db_name
    jdbc_url = "jdbc:postgresql://${aws_db_instance.dogbank.endpoint}/${aws_db_instance.dogbank.db_name}"
  })
}
