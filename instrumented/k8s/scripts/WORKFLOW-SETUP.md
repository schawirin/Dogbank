# Datadog Workflows para DogBank - Setup Guide

## 🎯 O que são os Workflows?

Os workflows permitem executar ações automatizadas no cluster EKS diretamente do Datadog:

1. **Restart Pod** - Reinicia um pod específico
2. **Rollout Restart All** - Reinicia todos os serviços (para demos/deploys)
3. **Scale Service** - Aumenta/diminui réplicas de um serviço
4. **Emergency Rollback** - Rollback rápido para versão anterior

## 📋 Pré-requisitos

- Terraform instalado
- AWS CLI configurado com acesso ao EKS
- Datadog API Key e App Key
- Webhook handler deployado (ver opções abaixo)

## 🚀 Opção 1: Deploy Rápido com webhook.site (Para Demos)

**Ideal para**: Demos e testes rápidos

1. Acesse https://webhook.site e copie sua URL única

2. Atualize os workflows no Terraform:
```bash
cd /Users/pedro.schawirin/Documents/Dogbank/instrumented/docker/dogbank/datadog/terraform

# Substitua "your-webhook-id" pela sua URL do webhook.site
sed -i '' 's|https://webhook.site/your-webhook-id|https://webhook.site/SEU-ID-AQUI|g' workflows.tf
```

3. Aplique o Terraform:
```bash
export TF_VAR_datadog_api_key="<DD_API_KEY>"
export TF_VAR_datadog_app_key="<DD_APP_KEY>"

terraform apply
```

4. **Para demos**: Os workflows enviarão requests para webhook.site e você verá os payloads, mas não executarão ações reais no cluster.

## 🏗️ Opção 2: Deploy com AWS Lambda (Produção)

**Ideal para**: Ambiente de produção

### 2.1. Criar Lambda Function

1. Criar função Lambda:
```bash
cd /Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s/scripts

# Criar pacote de deployment
zip lambda-function.zip webhook-handler.py

# Upload para Lambda (via AWS CLI ou Console)
aws lambda create-function \
  --function-name dogbank-workflow-handler \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-eks-role \
  --handler webhook-handler.lambda_handler \
  --zip-file fileb://lambda-function.zip \
  --environment Variables="{EKS_CLUSTER=eks-sandbox-datadog,AWS_REGION=us-east-1,WEBHOOK_SECRET=seu-secret-aqui}"
```

2. Criar API Gateway para expor a Lambda

3. Atualizar `workflows.tf` com a URL do API Gateway

### 2.2. Permissões IAM

A Lambda precisa de permissões para:
- Acessar EKS cluster
- Executar kubectl commands

Adicione esta policy à role da Lambda:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🐳 Opção 3: Deploy com Docker/Cloud Run

**Ideal para**: Flexibilidade e facilidade

1. Criar Dockerfile:
```dockerfile
FROM python:3.11-slim

# Install kubectl and AWS CLI
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/ \
    && curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# Install Python dependencies
RUN pip install flask boto3

# Copy webhook handler
COPY webhook-handler.py /app/webhook-handler.py

WORKDIR /app

# Run server
CMD ["python", "webhook-handler.py"]
```

2. Build e push:
```bash
docker build -t schawirin/dogbank-webhook-handler:latest .
docker push schawirin/dogbank-webhook-handler:latest
```

3. Deploy no cluster EKS:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workflow-handler
  namespace: dogbank
spec:
  replicas: 1
  selector:
    matchLabels:
      app: workflow-handler
  template:
    metadata:
      labels:
        app: workflow-handler
    spec:
      serviceAccountName: workflow-handler  # Com RBAC permissions
      containers:
      - name: handler
        image: schawirin/dogbank-webhook-handler:latest
        ports:
        - containerPort: 8080
        env:
        - name: EKS_CLUSTER
          value: "eks-sandbox-datadog"
        - name: AWS_REGION
          value: "us-east-1"
        - name: WEBHOOK_SECRET
          valueFrom:
            secretKeyRef:
              name: workflow-secrets
              key: webhook-secret
---
apiVersion: v1
kind: Service
metadata:
  name: workflow-handler
  namespace: dogbank
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
  selector:
    app: workflow-handler
```

4. Criar RBAC permissions:
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: workflow-handler
  namespace: dogbank
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: workflow-handler
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "patch", "update"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: workflow-handler
subjects:
- kind: ServiceAccount
  name: workflow-handler
  namespace: dogbank
roleRef:
  kind: ClusterRole
  name: workflow-handler
  apiGroup: rbac.authorization.k8s.io
```

## 🎮 Como Usar os Workflows no Datadog

### Via UI (Para Demos):

1. Acesse Datadog → Workflows
2. Encontre o workflow desejado (ex: "[DogBank] Rollout Restart All Services")
3. Clique em "Run Workflow"
4. Preencha os parâmetros necessários
5. Clique em "Run" e acompanhe a execução

### Via Monitor (Automático):

Configure um monitor para executar um workflow quando alertar:

```hcl
resource "datadog_monitor" "high_error_rate" {
  # ... configuração do monitor ...

  notify_no_data = false

  # Adicionar workflow action
  tags = [
    "workflow:restart_pod",
    "service:chatbot-service"
  ]
}
```

## 🔒 Segurança

1. **Webhook Secret**: Sempre configure `WEBHOOK_SECRET` para validar requests
2. **IAM Permissions**: Use least-privilege principle
3. **RBAC**: Limite permissões do ServiceAccount
4. **Network**: Use security groups para limitar acesso

## 📊 Monitoramento

Os workflows criam logs no Datadog que podem ser visualizados em:
- Workflow Execution History
- APM Traces (se instrumentado)
- Logs Explorer (com filtro `workflow:dogbank`)

## 🧪 Testando

```bash
# Testar webhook localmente
curl -X POST http://localhost:8080/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: seu-secret" \
  -d '{
    "action": "get_pod_status",
    "namespace": "dogbank"
  }'

# Testar rollout restart
curl -X POST http://localhost:8080/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: seu-secret" \
  -d '{
    "action": "rollout_restart_all",
    "namespace": "dogbank",
    "reason": "Manual test"
  }'
```

## 🎯 Workflows Disponíveis

| Workflow | Descrição | Parâmetros | Uso |
|----------|------------|------------|-----|
| Restart Pod | Reinicia um pod específico | pod_name, namespace | Troubleshooting |
| Rollout Restart All | Reinicia todos os serviços | reason | Deploy/Demo |
| Scale Service | Escala réplicas | service_name, replicas | Capacity |
| Emergency Rollback | Rollback de emergência | service_name, incident_id | Incident |

## 📝 Próximos Passos

1. ✅ Criar workflows no Datadog (via Terraform)
2. ⏳ Deployar webhook handler (escolher opção)
3. ⏳ Configurar URL do webhook nos workflows
4. ⏳ Testar cada workflow
5. ⏳ Integrar com monitores (opcional)
6. ⏳ Adicionar ao runbook da equipe
