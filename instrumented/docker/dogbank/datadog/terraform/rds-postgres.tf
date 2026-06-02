# =============================================================================
# RDS PostgreSQL for DogBank
# =============================================================================
# Creates a managed PostgreSQL database with Datadog monitoring support

# Data source para pegar VPC e subnets do EKS
data "aws_eks_cluster" "dogbank" {
  name = "eks-sandbox-datadog"
}

data "aws_vpc" "eks_vpc" {
  id = data.aws_eks_cluster.dogbank.vpc_config[0].vpc_id
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.eks_vpc.id]
  }

  filter {
    name   = "tag:Name"
    values = ["RDS-Pvt-subnet-*"]
  }
}

# Security Group para RDS
resource "aws_security_group" "rds_dogbank" {
  name_prefix = "rds-dogbank-"
  description = "Security group for DogBank RDS PostgreSQL"
  vpc_id      = data.aws_vpc.eks_vpc.id

  ingress {
    description = "PostgreSQL from EKS"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.eks_vpc.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "rds-dogbank-sg"
    Environment = "dogbank"
    ManagedBy   = "terraform"
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "dogbank" {
  name_prefix = "dogbank-"
  description = "Subnet group for DogBank RDS"
  subnet_ids  = data.aws_subnets.private.ids

  tags = {
    Name        = "dogbank-db-subnet-group"
    Environment = "dogbank"
    ManagedBy   = "terraform"
  }
}

# DB Parameter Group para habilitar performance insights e Datadog
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

  tags = {
    Name        = "dogbank-postgres-params"
    Environment = "dogbank"
    ManagedBy   = "terraform"
  }
}

# Random password para o banco (sem caracteres inválidos para RDS: /, @, ", espaço)
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "dogbank" {
  identifier     = "dogbank-postgres"
  engine         = "postgres"
  engine_version = "15.15"

  instance_class        = "db.t3.medium"  # 2 vCPU, 4GB RAM
  allocated_storage     = 20
  max_allocated_storage = 100  # Auto-scaling até 100GB
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "dogbank"
  username = "dogbank"
  password = random_password.db_password.result

  vpc_security_group_ids = [aws_security_group.rds_dogbank.id]
  db_subnet_group_name   = aws_db_subnet_group.dogbank.name
  parameter_group_name   = aws_db_parameter_group.dogbank.name

  # Backups
  backup_retention_period = 7
  backup_window           = "03:00-04:00"  # UTC
  maintenance_window      = "mon:04:00-mon:05:00"  # UTC

  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled    = true
  performance_insights_retention_period = 7

  # Multi-AZ para produção (comentado para dev)
  # multi_az = true

  # Public access (set to false for production)
  publicly_accessible = false

  # Deletion protection (set to true for production)
  deletion_protection = false
  skip_final_snapshot = true  # Para testes - mude para false em produção
  # final_snapshot_identifier = "dogbank-final-snapshot"

  tags = {
    Name        = "dogbank-postgres"
    Environment = "dogbank"
    ManagedBy   = "terraform"
  }
}

# IAM Role para Enhanced Monitoring
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

  tags = {
    Name        = "rds-monitoring-role"
    Environment = "dogbank"
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Secret no AWS Secrets Manager para armazenar credenciais
resource "aws_secretsmanager_secret" "db_credentials" {
  name_prefix = "dogbank/postgres-"
  description = "DogBank PostgreSQL credentials"

  tags = {
    Name        = "dogbank-postgres-credentials"
    Environment = "dogbank"
    ManagedBy   = "terraform"
  }
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

# Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.dogbank.endpoint
}

output "rds_address" {
  description = "RDS instance address (hostname only)"
  value       = aws_db_instance.dogbank.address
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.dogbank.port
}

output "database_name" {
  description = "Database name"
  value       = aws_db_instance.dogbank.db_name
}

output "database_username" {
  description = "Database username"
  value       = aws_db_instance.dogbank.username
  sensitive   = true
}

output "database_password" {
  description = "Database password"
  value       = random_password.db_password.result
  sensitive   = true
}

output "secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "jdbc_connection_string" {
  description = "JDBC connection string"
  value       = "jdbc:postgresql://${aws_db_instance.dogbank.endpoint}/${aws_db_instance.dogbank.db_name}"
  sensitive   = true
}

# Script SQL para inicializar o banco (salvo como output para executar depois)
output "init_sql_instructions" {
  description = "Instructions to initialize the database"
  sensitive   = true
  value       = <<-EOT

  # 1. Connect to RDS:
  psql -h ${aws_db_instance.dogbank.address} -U dogbank -d dogbank

  # 2. Or use kubectl port-forward and run init script:
  kubectl port-forward -n dogbank svc/postgres 5432:5432
  psql -h localhost -U dogbank -d dogbank -f instrumented/k8s/base/init-db.sql

  # 3. Update K8s secrets:
  kubectl create secret generic dogbank-secrets -n dogbank \
    --from-literal=SPRING_DATASOURCE_PASSWORD='${random_password.db_password.result}' \
    --dry-run=client -o yaml | kubectl apply -f -

  # 4. Update ConfigMap with RDS endpoint:
  kubectl patch configmap dogbank-config -n dogbank --type merge -p '{"data":{"POSTGRES_HOST":"${aws_db_instance.dogbank.address}"}}'

  EOT
}
