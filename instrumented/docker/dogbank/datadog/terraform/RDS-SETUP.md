# DogBank - RDS PostgreSQL Setup

Este guia explica como migrar o banco de dados DogBank de um pod Kubernetes para Amazon RDS PostgreSQL.

## 🎯 Benefícios do RDS

- ✅ Alta disponibilidade com Multi-AZ (opcional)
- ✅ Backups automáticos com retenção de 7 dias
- ✅ Performance Insights habilitado
- ✅ Monitoramento integrado com Datadog DBM
- ✅ Auto-scaling de storage (20GB → 100GB)
- ✅ Patches e manutenção gerenciados
- ✅ Encryption at rest habilitada

## 📋 Pré-requisitos

1. **Terraform instalado**
   ```bash
   brew install terraform
   ```

2. **PostgreSQL client instalado** (para init script)
   ```bash
   brew install libpq
   export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
   ```

3. **Credenciais AWS configuradas**
   ```bash
   export AWS_ACCESS_KEY_ID="..."
   export AWS_SECRET_ACCESS_KEY="..."
   export AWS_SESSION_TOKEN="..."  # Se usando temporary credentials
   ```

4. **kubectl configurado** para o cluster EKS
   ```bash
   aws eks update-kubeconfig --name eks-sandbox-datadog --region us-east-1
   ```

## 🚀 Opção 1: Setup Automatizado (Recomendado)

Execute o script que faz tudo automaticamente:

```bash
cd instrumented/docker/dogbank/datadog/terraform
./apply-rds.sh
```

O script irá:
1. ✅ Validar pré-requisitos
2. ✅ Criar RDS instance (db.t3.medium, 20GB, PostgreSQL 15.4)
3. ✅ Configurar security groups e networking
4. ✅ Aguardar RDS ficar disponível (~10 min)
5. ✅ Executar init script (criar tabelas e dados de teste)
6. ✅ Atualizar secrets do Kubernetes
7. ✅ Atualizar ConfigMap com novo endpoint
8. ✅ Reiniciar services

## 🔧 Opção 2: Setup Manual

### Passo 1: Aplicar Terraform

```bash
cd instrumented/docker/dogbank/datadog/terraform

# Initialize
terraform init

# Plan
terraform plan -out=tfplan

# Apply (takes ~10 minutes)
terraform apply tfplan
```

### Passo 2: Pegar credenciais

```bash
# Endpoint RDS
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
RDS_ADDRESS=$(terraform output -raw rds_address)

# Credenciais
DB_PASSWORD=$(terraform output -raw database_password)

echo "RDS Endpoint: $RDS_ENDPOINT"
echo "Password: $DB_PASSWORD"
```

### Passo 3: Aguardar RDS ficar disponível

```bash
aws rds wait db-instance-available \
  --db-instance-identifier dogbank-postgres \
  --region us-east-1
```

### Passo 4: Inicializar banco de dados

```bash
# Conectar e executar init script
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$RDS_ADDRESS" \
  -U dogbank \
  -d dogbank \
  -f init-rds.sql

# Ou conectar interativamente
PGPASSWORD="$DB_PASSWORD" psql -h "$RDS_ADDRESS" -U dogbank -d dogbank
```

### Passo 5: Atualizar Kubernetes Secrets

```bash
# Atualizar senha do Postgres
kubectl create secret generic postgres-secrets -n dogbank \
  --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" \
  --from-literal=DATADOG_PASSWORD="datadog_monitor_password_change_me" \
  --dry-run=client -o yaml | kubectl apply -f -

# Atualizar senha do Spring Boot
kubectl create secret generic dogbank-secrets -n dogbank \
  --from-literal=SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Passo 6: Atualizar ConfigMap

```bash
# Atualizar connection string no ConfigMap
kubectl get configmap dogbank-config -n dogbank -o yaml | \
  sed "s|jdbc:postgresql://postgres:5432/dogbank|jdbc:postgresql://$RDS_ENDPOINT/dogbank|g" | \
  kubectl apply -f -
```

### Passo 7: Atualizar Service Deployments

Edite os deployments para usar o novo endpoint:

```yaml
# auth-service.yaml, account-service.yaml, transaction-service.yaml
env:
  - name: SPRING_DATASOURCE_URL
    value: "jdbc:postgresql://<RDS_ENDPOINT>/dogbank"
```

Ou use environment variable do ConfigMap:

```yaml
env:
  - name: SPRING_DATASOURCE_URL
    valueFrom:
      configMapKeyRef:
        name: dogbank-config
        key: SPRING_DATASOURCE_URL
```

### Passo 8: Reiniciar Services

```bash
kubectl rollout restart deployment/auth-service -n dogbank
kubectl rollout restart deployment/account-service -n dogbank
kubectl rollout restart deployment/transaction-service -n dogbank

# Monitorar rollout
kubectl rollout status deployment/auth-service -n dogbank
```

## 🔍 Verificação

### 1. Verificar pods estão rodando

```bash
kubectl get pods -n dogbank | grep -E "auth|account|transaction"
```

### 2. Verificar logs

```bash
kubectl logs -n dogbank -l app=auth-service --tail=50 | grep -i "started\|error"
```

### 3. Testar conexão direta ao RDS

```bash
PGPASSWORD="$DB_PASSWORD" psql -h "$RDS_ADDRESS" -U dogbank -d dogbank -c "\dt"
```

### 4. Verificar dados

```bash
PGPASSWORD="$DB_PASSWORD" psql -h "$RDS_ADDRESS" -U dogbank -d dogbank -c "SELECT COUNT(*) FROM usuarios;"
```

## 📊 Monitoramento no Datadog

1. **Database Monitoring (DBM)**
   - Acesse: https://app.datadoghq.com/databases
   - Verifique queries, slow queries, explain plans

2. **Performance Insights**
   - AWS Console → RDS → dogbank-postgres → Performance Insights

3. **CloudWatch Metrics**
   - CPU, connections, IOPS, latency

## 🗑️ Remover Postgres Pod (Opcional)

Após confirmar que RDS está funcionando:

```bash
# Scale down Postgres deployment
kubectl scale deployment postgres -n dogbank --replicas=0

# Ou deletar completamente
kubectl delete deployment postgres -n dogbank
kubectl delete svc postgres -n dogbank
kubectl delete pvc postgres-pvc -n dogbank
```

## 💰 Custos Estimados

**db.t3.medium (2 vCPU, 4GB RAM)**
- On-Demand: ~$0.068/hora = ~$50/mês
- Storage (20GB gp3): ~$2.30/mês
- Backups (7 days): ~$2/mês

**Total estimado: ~$55/mês**

### Reduzir custos (Dev/Test):

```hcl
# Em rds-postgres.tf, altere:
instance_class = "db.t3.micro"  # $0.017/hora = ~$12/mês
allocated_storage = 10          # $1.15/mês
backup_retention_period = 1     # Mínimo de backups
```

## 🚨 Troubleshooting

### Pods não conectam ao RDS

```bash
# 1. Verificar security group
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw rds_security_group_id) \
  --region us-east-1

# 2. Testar conectividade de dentro de um pod
kubectl run -it --rm debug --image=postgres:15-alpine --restart=Never -n dogbank -- \
  psql -h "$RDS_ADDRESS" -U dogbank -d dogbank

# 3. Verificar secrets
kubectl get secret dogbank-secrets -n dogbank -o jsonpath='{.data.SPRING_DATASOURCE_PASSWORD}' | base64 -d
```

### Senha incorreta

```bash
# Reset password via Terraform
terraform apply -var="db_password=nova_senha"

# Ou via AWS CLI
aws rds modify-db-instance \
  --db-instance-identifier dogbank-postgres \
  --master-user-password "nova_senha" \
  --apply-immediately \
  --region us-east-1
```

### Performance lenta

```bash
# Upgrade instance class
# Em rds-postgres.tf:
instance_class = "db.t3.large"  # 2 vCPU, 8GB RAM

terraform apply
```

## 📚 Recursos Adicionais

- [AWS RDS PostgreSQL Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [Datadog DBM for PostgreSQL](https://docs.datadoghq.com/database_monitoring/setup_postgres/)
- [RDS Performance Insights](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PerfInsights.html)

## 🔄 Rollback

Se precisar voltar ao Postgres em pod:

```bash
# 1. Scale up Postgres deployment
kubectl scale deployment postgres -n dogbank --replicas=1

# 2. Restaurar ConfigMap original
kubectl get configmap dogbank-config -n dogbank -o yaml | \
  sed "s|jdbc:postgresql://.*:5432/dogbank|jdbc:postgresql://postgres:5432/dogbank|g" | \
  kubectl apply -f -

# 3. Reiniciar services
kubectl rollout restart deployment/auth-service -n dogbank
kubectl rollout restart deployment/account-service -n dogbank
kubectl rollout restart deployment/transaction-service -n dogbank
```

---

**Dúvidas?** Verifique os logs do Terraform: `terraform show` ou `cat terraform.tfstate`
