#!/bin/bash
# =============================================================================
# DogBank - RDS Setup Script
# =============================================================================
set -e

REGION="us-east-1"
TERRAFORM_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 DogBank RDS PostgreSQL Setup"
echo "================================"
echo ""

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install it first:"
    echo "   brew install terraform"
    exit 1
fi

# Check if AWS credentials are set
if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "❌ AWS credentials not set. Please export:"
    echo "   export AWS_ACCESS_KEY_ID=..."
    echo "   export AWS_SECRET_ACCESS_KEY=..."
    echo "   export AWS_SESSION_TOKEN=..."
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Initialize Terraform
echo "📦 Initializing Terraform..."
cd "$TERRAFORM_DIR"
terraform init

echo ""
echo "📋 Planning infrastructure..."
terraform plan -out=tfplan

echo ""
read -p "🤔 Apply this plan? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted"
    exit 0
fi

echo ""
echo "🏗️  Creating RDS instance (this takes ~10 minutes)..."
terraform apply tfplan

echo ""
echo "📊 Extracting outputs..."
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
RDS_ADDRESS=$(terraform output -raw rds_address)
RDS_PORT=$(terraform output -raw rds_port)
DB_NAME=$(terraform output -raw database_name)
DB_USER=$(terraform output -raw database_username)
DB_PASSWORD=$(terraform output -raw database_password)

echo ""
echo "✅ RDS Instance Created!"
echo "========================"
echo "Endpoint: $RDS_ENDPOINT"
echo "Database: $DB_NAME"
echo "Username: $DB_USER"
echo ""

# Wait for RDS to be available
echo "⏳ Waiting for RDS to be fully available..."
aws rds wait db-instance-available --db-instance-identifier dogbank-postgres --region $REGION

echo ""
echo "🗄️  Initializing database schema..."
echo "Note: You may need to install postgresql client first:"
echo "  brew install libpq"
echo "  export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
echo ""

# Try to run init script
if command -v psql &> /dev/null; then
    echo "Running init script..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$RDS_ADDRESS" -U "$DB_USER" -d "$DB_NAME" -f "$TERRAFORM_DIR/init-rds.sql"
    echo "✅ Database initialized!"
else
    echo "⚠️  psql not found. Please run init script manually:"
    echo "PGPASSWORD='$DB_PASSWORD' psql -h $RDS_ADDRESS -U $DB_USER -d $DB_NAME -f $TERRAFORM_DIR/init-rds.sql"
fi

echo ""
echo "🔧 Updating Kubernetes secrets..."
kubectl create secret generic postgres-secrets -n dogbank \
  --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" \
  --from-literal=DATADOG_PASSWORD="datadog_monitor_password_change_me" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic dogbank-secrets -n dogbank \
  --from-literal=SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "🔧 Updating Kubernetes ConfigMap..."
kubectl get configmap dogbank-config -n dogbank -o yaml | \
  sed "s|jdbc:postgresql://postgres:5432/dogbank|jdbc:postgresql://$RDS_ENDPOINT/$DB_NAME|g" | \
  kubectl apply -f -

echo ""
echo "🔄 Restarting services..."
kubectl rollout restart deployment/auth-service -n dogbank
kubectl rollout restart deployment/account-service -n dogbank
kubectl rollout restart deployment/transaction-service -n dogbank

echo ""
echo "✅ SETUP COMPLETE!"
echo "=================="
echo ""
echo "📝 RDS Connection Details:"
echo "  Host: $RDS_ADDRESS"
echo "  Port: $RDS_PORT"
echo "  Database: $DB_NAME"
echo "  Username: $DB_USER"
echo "  Password: (stored in Terraform state and K8s secrets)"
echo ""
echo "🔗 JDBC URL: jdbc:postgresql://$RDS_ENDPOINT/$DB_NAME"
echo ""
echo "📊 Monitor in Datadog:"
echo "  https://app.datadoghq.com/databases"
echo ""
echo "💡 Next steps:"
echo "  1. Verify pods are running: kubectl get pods -n dogbank"
echo "  2. Check logs: kubectl logs -n dogbank -l app=auth-service"
echo "  3. Test connection: psql -h $RDS_ADDRESS -U $DB_USER -d $DB_NAME"
echo ""
