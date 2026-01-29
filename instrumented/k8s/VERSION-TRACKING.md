# 🏷️ Controle de Versões no DogBank

Este guia explica como trackear versões usando tags do Datadog com GitHub Actions e deploy automatizado no EKS.

## 📋 Como Funciona

O sistema captura a versão do código e propaga para:

1. **Labels Kubernetes**: `tags.datadoghq.com/version`
2. **Variáveis de Ambiente**: `DD_VERSION`
3. **ConfigMap**: `DD_VERSION`
4. **Tags do Datadog**: Todos os traces/logs vão ter `version:X.Y.Z`

## 🚀 Deploy com GitHub Actions (Automático)

### Opção 1: Deploy via Git Tag (Recomendado)

Quando você criar uma tag no Git, o deploy é automático:

```bash
# 1. Commit suas mudanças
git add .
git commit -m "feat: nova funcionalidade"

# 2. Criar tag com a versão
git tag v1.2.3

# 3. Push da tag
git push origin v1.2.3
```

O GitHub Actions vai:
- ✅ Detectar a tag `v1.2.3`
- ✅ Atualizar todos os manifests com `version: v1.2.3`
- ✅ Fazer deploy no EKS
- ✅ Criar evento no Datadog marcando o deployment

### Opção 2: Deploy Manual

Você também pode disparar o workflow manualmente:

1. Vá em: **GitHub** → **Actions** → **Deploy to EKS**
2. Clique em **Run workflow**
3. Digite a versão (ex: `v1.2.3`) ou deixe em branco para usar o SHA do commit

## 🛠️ Deploy Local (Sem GitHub Actions)

### Usando o Script

```bash
cd k8s/scripts

# Atualizar para uma versão específica
./update-version.sh v1.2.3

# Ou usar o SHA do git automaticamente
./update-version.sh

# Aplicar no cluster
kubectl apply -f ../base/
```

### Manualmente

```bash
# Instalar yq (se não tiver)
brew install yq  # macOS
# ou
wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /usr/local/bin/yq

# Atualizar versão em um serviço específico
yq eval -i '.metadata.labels."tags.datadoghq.com/version" = "v1.2.3"' base/account-service.yaml

# Aplicar no cluster
kubectl apply -f base/account-service.yaml
```

## 📊 Verificando Versões

### No Kubernetes

```bash
# Ver versões de todos os deployments
kubectl get deployments -n dogbank -o custom-columns=\
NAME:.metadata.name,\
VERSION:.metadata.labels.tags\\.datadoghq\\.com/version

# Ver pods com suas versões
kubectl get pods -n dogbank -o custom-columns=\
NAME:.metadata.name,\
VERSION:.metadata.labels.tags\\.datadoghq\\.com/version
```

### No Datadog

1. **APM/Traces**:
   - Acesse: https://app.datadoghq.com/apm/traces
   - Filtro: `env:dogbank version:v1.2.3`
   
2. **Deployment Tracking**:
   - Acesse: https://app.datadoghq.com/apm/services
   - Clique em um serviço
   - Veja a timeline de deployments por versão

3. **Compare Versions**:
   ```
   https://app.datadoghq.com/apm/traces/compare?
   query=env:dogbank&
   beforeVersion=v1.2.2&
   afterVersion=v1.2.3
   ```

## ⚙️ Configuração Inicial

### 1. Secrets do GitHub

Configure estes secrets no GitHub (**Settings** → **Secrets and variables** → **Actions**):

```
AWS_ACCESS_KEY_ID        → Sua AWS Access Key
AWS_SECRET_ACCESS_KEY    → Sua AWS Secret Key
AWS_SESSION_TOKEN        → Sua AWS Session Token (opcional)
DATADOG_API_KEY          → Sua Datadog API Key
```

### 2. Verificar Workflow

O arquivo `.github/workflows/deploy-eks.yml` deve existir no repositório.

### 3. Testar Deploy

```bash
# Criar uma tag de teste
git tag v0.0.1-test
git push origin v0.0.1-test

# Acompanhar no GitHub Actions
```

## 📈 Estratégias de Versionamento

### Semantic Versioning (Recomendado)

```
v1.0.0  → Primeira versão estável
v1.0.1  → Bug fix
v1.1.0  → Nova feature
v2.0.0  → Breaking change
```

### Com Prefixos

```
v1.2.3-dev     → Versão de desenvolvimento
v1.2.3-staging → Versão de staging
v1.2.3-prod    → Versão de produção
```

### Por Ambiente

```
dev-v1.2.3
staging-v1.2.3
prod-v1.2.3
```

## 🔄 Rollback

Se precisar fazer rollback para uma versão anterior:

### Usando GitHub Actions

1. Vá em **Actions** → **Deploy to EKS**
2. **Run workflow**
3. Digite a versão anterior (ex: `v1.2.2`)

### Manualmente

```bash
# 1. Atualizar para versão anterior
cd k8s/scripts
./update-version.sh v1.2.2

# 2. Aplicar no cluster
kubectl apply -f ../base/

# 3. Verificar rollout
kubectl rollout status deployment/account-service -n dogbank
```

### Usando kubectl rollout undo

```bash
# Rollback do último deployment
kubectl rollout undo deployment/account-service -n dogbank

# Rollback para revisão específica
kubectl rollout history deployment/account-service -n dogbank
kubectl rollout undo deployment/account-service -n dogbank --to-revision=2
```

## 📝 Exemplo de Uso Completo

```bash
# 1. Desenvolver feature
git checkout -b feature/nova-api
# ... fazer mudanças ...
git commit -m "feat: adiciona nova API de transferências"

# 2. Merge para main
git checkout main
git merge feature/nova-api

# 3. Criar tag de versão
git tag v1.3.0 -m "Release v1.3.0: Nova API de transferências"

# 4. Push (dispara deploy automático)
git push origin main
git push origin v1.3.0

# 5. Acompanhar deploy
# GitHub: https://github.com/SEU_USER/dogbank/actions
# Datadog: https://app.datadoghq.com/apm/traces?query=version:v1.3.0

# 6. Verificar no cluster
kubectl get deployments -n dogbank -o wide

# 7. Verificar traces no Datadog
# Filtrar por: env:dogbank version:v1.3.0
```

## 🎯 Benefícios

✅ **Rastreabilidade**: Saber exatamente qual versão está em cada trace/log  
✅ **Deployment Tracking**: Ver timeline de deploys no Datadog  
✅ **Comparação**: Comparar performance entre versões  
✅ **Debugging**: Identificar quando um bug foi introduzido  
✅ **Rollback**: Fácil reverter para versão anterior  
✅ **Automação**: Deploy automático via Git tags  

## 🆘 Troubleshooting

### Workflow não dispara

Verifique:
- Secrets configurados no GitHub
- Workflow file existe em `.github/workflows/deploy-eks.yml`
- Tag foi pushed: `git push origin v1.2.3`

### Versão não aparece no Datadog

Aguarde 2-5 minutos após o deploy. Se não aparecer:

```bash
# Verificar se as labels estão corretas
kubectl get deployment account-service -n dogbank -o yaml | grep version

# Verificar variável de ambiente
kubectl get deployment account-service -n dogbank -o yaml | grep DD_VERSION

# Reiniciar pods
kubectl rollout restart deployment/account-service -n dogbank
```

### yq não está instalado

```bash
# macOS
brew install yq

# Linux
wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /usr/local/bin/yq
chmod +x /usr/local/bin/yq
```

## 📚 Referências

- [GitHub Actions](https://docs.github.com/en/actions)
- [Datadog Deployment Tracking](https://docs.datadoghq.com/tracing/services/deployment_tracking/)
- [Datadog Unified Tagging](https://docs.datadoghq.com/getting_started/tagging/unified_service_tagging/)
- [Semantic Versioning](https://semver.org/)

---

**Próximo passo**: Criar sua primeira tag e ver o deploy automático em ação! 🚀
