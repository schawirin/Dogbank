# 🔐 Gerenciamento de Secrets no DogBank

Este guia mostra as melhores práticas para gerenciar secrets no Kubernetes sem commitar senhas no Git.

## 🎯 Estratégias Recomendadas

### Opção 1: Kubernetes Secrets via kubectl (Simples)
✅ Fácil de implementar  
✅ Não precisa serviços externos  
❌ Secrets ficam no etcd (base64, não criptografado em repouso por padrão)

### Opção 2: AWS Secrets Manager + External Secrets Operator (Profissional)
✅ Secrets criptografados na AWS  
✅ Rotação automática  
✅ Auditoria completa  
✅ Separação por ambiente  
❌ Requer configuração adicional

**Vamos implementar as duas!** Use Opção 1 para começar rápido, migre para Opção 2 em produção.

---

## 📋 Secrets Necessários

```yaml
dogbank-secrets:
  - POSTGRES_PASSWORD         # Senha do PostgreSQL
  - SPRING_DATASOURCE_PASSWORD  # Mesma senha do PostgreSQL
  - db-user                   # Usuário do banco (dogbank)
  - db-password               # Senha do banco
  - DD_API_KEY                # Datadog API Key
  - DD_APP_KEY                # Datadog Application Key
  - VITE_DD_CLIENT_TOKEN      # Datadog RUM Client Token
  - VITE_DD_APPLICATION_ID    # Datadog RUM Application ID
  - JWT_SECRET                # Secret para JWT tokens
  - groq-api-key              # Groq LLM API Key
  - rabbitmq-user             # Usuário RabbitMQ
  - rabbitmq-password         # Senha RabbitMQ
  - dd-site                   # Datadog Site (datadoghq.com)

postgres-secrets:
  - POSTGRES_PASSWORD         # Senha do PostgreSQL
  - DATADOG_PASSWORD          # Senha do usuário Datadog no PostgreSQL
```

---

## 🚀 Opção 1: Kubernetes Secrets via kubectl

### Passo 1: Criar arquivo local (NÃO commitar)

Crie um arquivo `k8s/secrets.local.sh` com suas credenciais:

```bash
#!/bin/bash
# =============================================================================
# DogBank Secrets - LOCAL ONLY (git ignored)
# =============================================================================
# INSTRUCTIONS: 
# 1. Preencha as variáveis abaixo com valores reais
# 2. Execute: ./secrets.local.sh
# 3. NUNCA commite este arquivo!
# =============================================================================

# Database
export POSTGRES_PASSWORD="sua_senha_postgres_aqui"
export DB_PASSWORD="sua_senha_db_aqui"

# Datadog (obtenha em: https://app.datadoghq.com/organization-settings/api-keys)
export DD_API_KEY="sua_dd_api_key_aqui"
export DD_APP_KEY="sua_dd_app_key_aqui"
export DD_CLIENT_TOKEN="seu_dd_client_token_aqui"
export DD_APPLICATION_ID="seu_dd_app_id_aqui"

# JWT
export JWT_SECRET="seu_jwt_secret_aqui"

# Groq (obtenha em: https://console.groq.com/keys)
export GROQ_API_KEY="sua_groq_api_key_aqui"

# RabbitMQ
export RABBITMQ_PASSWORD="sua_rabbitmq_password_aqui"

# Datadog Database
export DATADOG_DB_PASSWORD="datadog_password_aqui"

# =============================================================================
# Criar Secrets no Kubernetes
# =============================================================================

echo "🔐 Criando secrets no Kubernetes..."

# Configurar kubectl
aws eks update-kubeconfig --region us-east-1 --name eks-sandbox-datadog

# Criar namespace se não existir
kubectl create namespace dogbank --dry-run=client -o yaml | kubectl apply -f -

# Deletar secrets existentes (se houver)
kubectl delete secret dogbank-secrets -n dogbank --ignore-not-found
kubectl delete secret postgres-secrets -n dogbank --ignore-not-found

# Criar secret principal
kubectl create secret generic dogbank-secrets -n dogbank \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --from-literal=SPRING_DATASOURCE_PASSWORD="${POSTGRES_PASSWORD}" \
  --from-literal=db-user="dogbank" \
  --from-literal=db-password="${DB_PASSWORD}" \
  --from-literal=DD_API_KEY="${DD_API_KEY}" \
  --from-literal=DD_APP_KEY="${DD_APP_KEY}" \
  --from-literal=dd-api-key="${DD_API_KEY}" \
  --from-literal=VITE_DD_CLIENT_TOKEN="${DD_CLIENT_TOKEN}" \
  --from-literal=VITE_DD_APPLICATION_ID="${DD_APPLICATION_ID}" \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=groq-api-key="${GROQ_API_KEY}" \
  --from-literal=rabbitmq-user="dogbank" \
  --from-literal=rabbitmq-password="${RABBITMQ_PASSWORD}" \
  --from-literal=dd-site="datadoghq.com"

echo "✅ Secret 'dogbank-secrets' criado"

# Criar secret do PostgreSQL
kubectl create secret generic postgres-secrets -n dogbank \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --from-literal=DATADOG_PASSWORD="${DATADOG_DB_PASSWORD}"

echo "✅ Secret 'postgres-secrets' criado"

# Verificar
echo ""
echo "📋 Secrets criados:"
kubectl get secrets -n dogbank

echo ""
echo "✅ Secrets configurados com sucesso!"
```

### Passo 2: Executar o script

```bash
cd k8s
chmod +x secrets.local.sh
./secrets.local.sh
```

### Passo 3: Verificar secrets

```bash
# Listar secrets
kubectl get secrets -n dogbank

# Ver detalhes (valores em base64)
kubectl get secret dogbank-secrets -n dogbank -o yaml

# Decodificar um valor específico
kubectl get secret dogbank-secrets -n dogbank -o jsonpath='{.data.DD_API_KEY}' | base64 -d
```

### Passo 4: Remover secrets.yaml do Git

```bash
# Adicionar ao .gitignore
echo "k8s/base/secrets.yaml" >> .gitignore
echo "k8s/secrets.local.sh" >> .gitignore

# Remover do Git (mas manter localmente)
git rm --cached k8s/base/secrets.yaml
git commit -m "chore: remove secrets.yaml from git"
```

---

## 🏢 Opção 2: AWS Secrets Manager (Produção)

### Passo 1: Instalar External Secrets Operator

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

### Passo 2: Criar IAM Policy para acesso aos secrets

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:dogbank/*"
    }
  ]
}
```

### Passo 3: Criar secrets na AWS

```bash
# Criar secret do Datadog
aws secretsmanager create-secret \
  --name dogbank/datadog-api-key \
  --secret-string "sua_dd_api_key_aqui" \
  --region us-east-1

aws secretsmanager create-secret \
  --name dogbank/datadog-app-key \
  --secret-string "sua_dd_app_key_aqui" \
  --region us-east-1

# Criar secret do PostgreSQL
aws secretsmanager create-secret \
  --name dogbank/postgres-password \
  --secret-string "sua_senha_postgres" \
  --region us-east-1

# Criar secret do Groq
aws secretsmanager create-secret \
  --name dogbank/groq-api-key \
  --secret-string "sua_groq_key" \
  --region us-east-1

# Criar secret do JWT
aws secretsmanager create-secret \
  --name dogbank/jwt-secret \
  --secret-string "seu_jwt_secret" \
  --region us-east-1

# Criar secret do RabbitMQ
aws secretsmanager create-secret \
  --name dogbank/rabbitmq-password \
  --secret-string "sua_rabbitmq_password" \
  --region us-east-1

# Criar secret do RUM
aws secretsmanager create-secret \
  --name dogbank/dd-rum-config \
  --secret-string '{"clientToken":"seu_token","applicationId":"seu_app_id"}' \
  --region us-east-1
```

### Passo 4: Criar SecretStore

```yaml
# k8s/base/secretstore.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: dogbank
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
```

### Passo 5: Criar ExternalSecrets

```yaml
# k8s/base/external-secrets.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: dogbank-secrets
  namespace: dogbank
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: dogbank-secrets
    creationPolicy: Owner
  data:
    # Datadog
    - secretKey: DD_API_KEY
      remoteRef:
        key: dogbank/datadog-api-key
    - secretKey: DD_APP_KEY
      remoteRef:
        key: dogbank/datadog-app-key
    - secretKey: dd-api-key
      remoteRef:
        key: dogbank/datadog-api-key
    
    # PostgreSQL
    - secretKey: POSTGRES_PASSWORD
      remoteRef:
        key: dogbank/postgres-password
    - secretKey: SPRING_DATASOURCE_PASSWORD
      remoteRef:
        key: dogbank/postgres-password
    
    # JWT
    - secretKey: JWT_SECRET
      remoteRef:
        key: dogbank/jwt-secret
    
    # Groq
    - secretKey: groq-api-key
      remoteRef:
        key: dogbank/groq-api-key
    
    # RabbitMQ
    - secretKey: rabbitmq-password
      remoteRef:
        key: dogbank/rabbitmq-password
    
    # RUM
    - secretKey: VITE_DD_CLIENT_TOKEN
      remoteRef:
        key: dogbank/dd-rum-config
        property: clientToken
    - secretKey: VITE_DD_APPLICATION_ID
      remoteRef:
        key: dogbank/dd-rum-config
        property: applicationId
  
  # Valores estáticos (não sensíveis)
  template:
    data:
      db-user: "dogbank"
      rabbitmq-user: "dogbank"
      dd-site: "datadoghq.com"
```

### Passo 6: Aplicar configuração

```bash
kubectl apply -f k8s/base/secretstore.yaml
kubectl apply -f k8s/base/external-secrets.yaml

# Verificar
kubectl get externalsecret -n dogbank
kubectl get secret dogbank-secrets -n dogbank
```

---

## 🔄 Rotação de Secrets

### Manual (Opção 1)

```bash
# Atualizar secret
kubectl delete secret dogbank-secrets -n dogbank
./secrets.local.sh

# Reiniciar pods para pegar novo secret
kubectl rollout restart deployment -n dogbank
```

### Automático (Opção 2)

```bash
# Atualizar na AWS
aws secretsmanager update-secret \
  --secret-id dogbank/datadog-api-key \
  --secret-string "nova_api_key"

# External Secrets Operator vai sincronizar automaticamente (1h por padrão)
# Ou force a sincronização:
kubectl annotate externalsecret dogbank-secrets -n dogbank \
  force-sync=$(date +%s) --overwrite
```

---

## 📊 Comparação de Opções

| Aspecto | Opção 1 (kubectl) | Opção 2 (AWS Secrets Manager) |
|---------|-------------------|--------------------------------|
| **Facilidade** | ⭐⭐⭐⭐⭐ Muito fácil | ⭐⭐⭐ Moderado |
| **Segurança** | ⭐⭐⭐ Base64 no etcd | ⭐⭐⭐⭐⭐ Criptografado |
| **Auditoria** | ⭐⭐ Limitada | ⭐⭐⭐⭐⭐ CloudTrail |
| **Rotação** | ⭐⭐ Manual | ⭐⭐⭐⭐⭐ Automática |
| **Custo** | ✅ Grátis | 💰 $0.40/secret/mês |
| **Multi-ambiente** | ⭐⭐ Difícil | ⭐⭐⭐⭐⭐ Fácil |

---

## 📝 Checklist de Implementação

### Setup Inicial

- [ ] Criar arquivo `secrets.local.sh` com valores reais
- [ ] Adicionar `secrets.local.sh` ao `.gitignore`
- [ ] Adicionar `k8s/base/secrets.yaml` ao `.gitignore`
- [ ] Executar `secrets.local.sh` para criar secrets no K8s
- [ ] Verificar que secrets foram criados: `kubectl get secrets -n dogbank`
- [ ] Remover `secrets.yaml` do Git: `git rm --cached k8s/base/secrets.yaml`

### Para Produção (Opcional)

- [ ] Instalar External Secrets Operator
- [ ] Criar IAM Role com permissões de Secrets Manager
- [ ] Criar secrets na AWS Secrets Manager
- [ ] Criar SecretStore no K8s
- [ ] Criar ExternalSecret no K8s
- [ ] Verificar sincronização automática
- [ ] Configurar rotação automática na AWS

---

## 🔍 Obtendo Credenciais

### Datadog

1. **API Key**: https://app.datadoghq.com/organization-settings/api-keys
2. **Application Key**: https://app.datadoghq.com/organization-settings/application-keys
3. **RUM Client Token**: https://app.datadoghq.com/rum/application/create
4. **RUM Application ID**: Mesmo link acima

### Groq

1. **API Key**: https://console.groq.com/keys

### PostgreSQL

- Defina uma senha forte aleatória:
  ```bash
  openssl rand -base64 32
  ```

### JWT Secret

- Gere um secret aleatório:
  ```bash
  openssl rand -base64 64
  ```

### RabbitMQ

- Defina uma senha forte aleatória:
  ```bash
  openssl rand -base64 32
  ```

---

## 🆘 Troubleshooting

### Secret não está sendo usado pelos pods

```bash
# Verificar se o secret existe
kubectl get secret dogbank-secrets -n dogbank

# Verificar se os deployments referenciam corretamente
kubectl get deployment account-service -n dogbank -o yaml | grep secretKeyRef

# Reiniciar pods para pegar novos secrets
kubectl rollout restart deployment/account-service -n dogbank
```

### External Secret não sincroniza

```bash
# Ver status do ExternalSecret
kubectl describe externalsecret dogbank-secrets -n dogbank

# Ver logs do operator
kubectl logs -n external-secrets-system deployment/external-secrets

# Forçar sincronização
kubectl annotate externalsecret dogbank-secrets -n dogbank \
  force-sync=$(date +%s) --overwrite
```

### Erro de permissão AWS

```bash
# Verificar IAM Role do ServiceAccount
kubectl describe sa external-secrets-sa -n dogbank

# Verificar se a policy está correta
aws iam get-role-policy --role-name <role-name> --policy-name <policy-name>
```

---

## 📚 Referências

- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [External Secrets Operator](https://external-secrets.io/)
- [Datadog API Keys](https://docs.datadoghq.com/account_management/api-app-keys/)

---

**Recomendação**: Comece com **Opção 1** para desenvolvimento/testes. Migre para **Opção 2** quando for para produção.
