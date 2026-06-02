# 🔐 Quick Reference: Secrets do DogBank

## 📝 Lista Completa de Secrets

### Secret: `dogbank-secrets`

| Chave | Valor/Descrição | Obrigatório | Como Obter |
|-------|------------------|-------------|------------|
| **Database** |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL | ✅ Sim | `openssl rand -base64 32` |
| `SPRING_DATASOURCE_PASSWORD` | Mesma senha do PostgreSQL | ✅ Sim | Mesmo valor acima |
| `db-user` | `dogbank` | ✅ Sim | Fixo |
| `db-password` | Senha do banco | ✅ Sim | `openssl rand -base64 32` |
| **Datadog** |
| `DD_API_KEY` | Datadog API Key | ✅ Sim | [API Keys](https://app.datadoghq.com/organization-settings/api-keys) |
| `DD_APP_KEY` | Datadog Application Key | ✅ Sim | [App Keys](https://app.datadoghq.com/organization-settings/application-keys) |
| `dd-api-key` | Datadog API Key (alt) | ✅ Sim | Mesmo valor acima |
| `DATADOG_API_KEY` | Datadog API Key (alt) | ✅ Sim | Mesmo valor acima |
| `DATADOG_APP_KEY` | Datadog App Key (alt) | ✅ Sim | Mesmo valor acima |
| `VITE_DD_CLIENT_TOKEN` | Datadog RUM Client Token | ✅ Sim | [RUM Application](https://app.datadoghq.com/rum/application/create) |
| `VITE_DD_APPLICATION_ID` | Datadog RUM Application ID | ✅ Sim | Mesmo link acima |
| `dd-site` | `datadoghq.com` | ✅ Sim | Fixo |
| **LLM APIs** |
| `GROQ_API_KEY` | Groq LLM API Key | ✅ Sim | [Groq Console](https://console.groq.com/keys) |
| `groq-api-key` | Groq LLM API Key (alt) | ✅ Sim | Mesmo valor acima |
| `LLM_API_KEY` | LLM API Key genérica | ✅ Sim | Mesmo valor acima |
| `GEMINI_API_KEY` | Google Gemini API Key | ⚠️ Opcional | [AI Studio](https://aistudio.google.com/app/apikey) |
| `OPENAI_API_KEY` | OpenAI API Key | ❌ Não | [OpenAI](https://platform.openai.com/api-keys) |
| **RabbitMQ** |
| `rabbitmq-user` | `dogbank` | ✅ Sim | **Fixo: `dogbank`** |
| `rabbitmq-password` | `dogbank123` | ✅ Sim | **Fixo: `dogbank123`** |
| `SPRING_RABBITMQ_USERNAME` | `dogbank` | ✅ Sim | **Fixo: `dogbank`** |
| `SPRING_RABBITMQ_PASSWORD` | `dogbank123` | ✅ Sim | **Fixo: `dogbank123`** |
| **Redis** |
| `SPRING_REDIS_PASSWORD` | Senha do Redis | ⚠️ Opcional | `redis123` ou vazio |
| **Segurança** |
| `JWT_SECRET` | Secret para JWT tokens | ✅ Sim | `openssl rand -base64 64` |
| **Banco Central (PIX)** |
| `BACEN_API_KEY` | Chave API Banco Central | ❌ Não | Fornecido pelo Bacen |
| `BACEN_API_SECRET` | Secret API Banco Central | ❌ Não | Fornecido pelo Bacen |
| `BACEN_CLIENT_ID` | Client ID Banco Central | ❌ Não | Fornecido pelo Bacen |
| `BACEN_CLIENT_SECRET` | Client Secret Banco Central | ❌ Não | Fornecido pelo Bacen |
| `BACEN_CERT_PASSWORD` | Senha certificado Bacen | ❌ Não | Fornecido pelo Bacen |

### Secret: `postgres-secrets`

| Chave | Valor/Descrição | Obrigatório |
|-------|------------------|-------------|
| `POSTGRES_PASSWORD` | Senha do PostgreSQL | ✅ Sim |
| `DATADOG_PASSWORD` | Senha do usuário Datadog no PostgreSQL | ✅ Sim |

---

## ⚡ Comandos Rápidos

### Adicionar Secret do RabbitMQ

```bash
kubectl create secret generic dogbank-secrets -n dogbank \
  --from-literal=rabbitmq-user="dogbank" \
  --from-literal=rabbitmq-password="dogbank123" \
  --from-literal=SPRING_RABBITMQ_USERNAME="dogbank" \
  --from-literal=SPRING_RABBITMQ_PASSWORD="dogbank123" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Adicionar Secret do Gemini (Fallback LLM)

```bash
kubectl create secret generic dogbank-secrets -n dogbank \
  --from-literal=GEMINI_API_KEY="sua_gemini_api_key_aqui" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Verificar Secrets

```bash
# Listar todas as secrets
kubectl get secrets -n dogbank

# Ver todas as chaves (sem valores)
kubectl get secret dogbank-secrets -n dogbank -o jsonpath='{.data}' | jq 'keys'

# Ver valor de uma chave específica
kubectl get secret dogbank-secrets -n dogbank -o jsonpath='{.data.rabbitmq-user}' | base64 -d
kubectl get secret dogbank-secrets -n dogbank -o jsonpath='{.data.rabbitmq-password}' | base64 -d

# Contar número de chaves
kubectl get secret dogbank-secrets -n dogbank -o jsonpath='{.data}' | jq 'keys | length'
```

### Atualizar uma Secret Existente

```bash
# Método 1: Patch (adiciona sem deletar outras)
kubectl patch secret dogbank-secrets -n dogbank --type='json' -p='[
  {"op": "add", "path": "/data/nova-chave", "value": "'$(echo -n "valor" | base64)'"}
]'

# Método 2: Apply (merge com existente)
kubectl create secret generic dogbank-secrets -n dogbank \
  --from-literal=nova-chave="valor" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Deletar e Recriar Secret

```bash
# Deletar
kubectl delete secret dogbank-secrets -n dogbank

# Recriar usando o script
cd /Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s
./secrets.local.sh
```

### Reiniciar Pods após Atualizar Secrets

```bash
# Reiniciar todos os deployments
kubectl rollout restart deployment -n dogbank

# Reiniciar deployment específico
kubectl rollout restart deployment/transaction-service -n dogbank
kubectl rollout restart deployment/frontend -n dogbank

# Reiniciar statefulset
kubectl rollout restart statefulset/rabbitmq -n dogbank
```

---

## 🔍 Troubleshooting

### Erro: "couldn't find key X in Secret"

**Problema**: Pod não consegue encontrar uma chave no secret

**Solução**:
```bash
# 1. Verificar se a chave existe
kubectl get secret dogbank-secrets -n dogbank -o jsonpath='{.data}' | jq 'keys' | grep -i "chave"

# 2. Se não existir, adicionar
kubectl create secret generic dogbank-secrets -n dogbank \
  --from-literal=chave-faltando="valor" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Reiniciar o pod
kubectl delete pod <pod-name> -n dogbank
```

### Verificar qual chave está faltando

```bash
# Ver eventos do pod
kubectl describe pod <pod-name> -n dogbank | grep -A 10 "Error"

# Exemplo de erro:
# Error: couldn't find key rabbitmq-user in Secret dogbank/dogbank-secrets
```

### Criar todas as secrets de uma vez

```bash
cd /Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s
cp secrets.local.sh.example secrets.local.sh
nano secrets.local.sh  # Editar com valores reais
chmod +x secrets.local.sh
./secrets.local.sh
```

---

## 📚 Referências

- **Documentação Completa**: `SECRETS-MANAGEMENT.md`
- **Script de Exemplo**: `secrets.local.sh.example`
- **Datadog Keys**: https://app.datadoghq.com/organization-settings/api-keys
- **Groq Keys**: https://console.groq.com/keys
- **Gemini Keys**: https://aistudio.google.com/app/apikey

---

## ✅ Checklist Mínimo para Funcionar

- [ ] `POSTGRES_PASSWORD` - Senha do banco
- [ ] `SPRING_DATASOURCE_PASSWORD` - Mesma senha do banco
- [ ] `DD_API_KEY` - Datadog API Key
- [ ] `DD_APP_KEY` - Datadog App Key
- [ ] `GROQ_API_KEY` - Groq API Key
- [ ] `JWT_SECRET` - Secret JWT
- [ ] `rabbitmq-user` = **`dogbank`**
- [ ] `rabbitmq-password` = **`dogbank123`**
- [ ] `SPRING_RABBITMQ_USERNAME` = **`dogbank`**
- [ ] `SPRING_RABBITMQ_PASSWORD` = **`dogbank123`**
- [ ] Verificar: `kubectl get secret dogbank-secrets -n dogbank`
- [ ] Reiniciar pods: `kubectl rollout restart deployment -n dogbank`
