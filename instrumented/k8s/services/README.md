# DogBank Services - Source Code & Dockerfiles

Este diretório contém todo o código fonte e Dockerfiles dos serviços do DogBank, organizados para facilitar o desenvolvimento e deployment no Kubernetes.

## 📁 Estrutura

```
k8s/services/
├── auth-module/          # Serviço de autenticação (Java/Spring Boot)
├── account-module/       # Serviço de contas (Java/Spring Boot)
├── transaction-module/   # Serviço de transações (Java/Spring Boot)
├── bancocentral-module/  # Serviço Banco Central (Java/Spring Boot)
├── fraud-detection-module/ # Detecção de fraudes (Java/Spring Boot)
├── pix-worker-module/    # Worker PIX (Java/Spring Boot)
├── chatbot-python/       # Chatbot AI (Python/FastAPI)
├── load-generator/       # Gerador de carga e ataques (Python)
└── frontend/             # Frontend React
```

## 🐳 Build & Deploy

### Build Local
```bash
# Build de um serviço específico
docker build -t schawirin/dogbank-auth-service:latest \
  -f auth-module/Dockerfile .

# Build multi-arch (Mac -> Linux)
docker buildx build --platform linux/amd64,linux/arm64 \
  -t schawirin/dogbank-auth-service:latest \
  -f auth-module/Dockerfile . --push
```

### CI/CD Pipeline
O workflow `.github/workflows/docker-publish.yml` automaticamente:
1. Builda todas as imagens Docker (Linux/AMD64)
2. Faz push para Docker Hub (schawirin/*)
3. Faz rollout restart dos deployments no EKS

**Trigger:** Push para branch `main`

## 🔧 Modificando Dockerfiles

Todos os Dockerfiles neste diretório são usados pela pipeline de CI/CD.
Qualquer mudança aqui será aplicada no próximo build.

### Boas Práticas
- Use multi-stage builds para reduzir tamanho das imagens
- Sempre especifique versões de base images
- Use `.dockerignore` para excluir arquivos desnecessários
- Teste localmente antes de commitar

## 📊 Monitoramento

Todos os serviços são instrumentados com:
- **Datadog APM** (Java Agent / ddtrace-py)
- **Datadog Application Security** (ASM)
- **Datadog Profiling**
- **Data Streams Monitoring** (Kafka/RabbitMQ)

## 🚀 Deploy Rápido

```bash
# Fazer mudanças nos Dockerfiles
vim auth-module/Dockerfile

# Commit e push (dispara pipeline automaticamente)
git add .
git commit -m "feat: update auth service Dockerfile"
git push origin main

# Acompanhar build
# https://github.com/schawirin/Dogbank/actions
```

---

**Nota:** O diretório `/docker` original ainda existe mas não é mais usado pela pipeline de CI/CD.
Todas as mudanças devem ser feitas aqui em `/k8s/services/`.
