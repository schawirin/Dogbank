# 🐕 DogBank - Kubernetes Deployment

Deploy completo do DogBank no Amazon EKS com Datadog monitoring, HTTPS, e versionamento automático.

## 📁 Estrutura de Arquivos

```
k8s/
├── base/                          # Manifests Kubernetes
│   ├── namespace.yaml             # Namespace dogbank
│   ├── configmap.yaml             # ConfigMaps (com DD_VERSION)
│   ├── secrets.yaml               # Secrets (senhas, tokens)
│   ├── postgres.yaml              # PostgreSQL database
│   ├── redis.yaml                 # Redis cache
│   ├── kafka.yaml                 # Kafka message broker
│   ├── rabbitmq.yaml              # RabbitMQ
│   ├── account-service.yaml       # Serviço de contas
│   ├── auth-service.yaml          # Serviço de autenticação
│   ├── transaction-service.yaml   # Serviço de transações
│   ├── bancocentral-service.yaml  # Banco Central mock
│   ├── chatbot-service.yaml       # Chatbot Python
│   ├── fraud-detection-service.yaml  # Detecção de fraude
│   ├── pix-worker.yaml            # Worker PIX
│   ├── frontend.yaml              # Frontend React
│   ├── ingress-tls.yaml           # Ingress com HTTPS
│   ├── cert-manager-issuer.yaml   # Let's Encrypt issuer
│   └── datadog-agent.yaml         # Datadog Agent config
├── scripts/                       # Scripts utilitários
│   └── update-version.sh          # Atualizar versões
├── HTTPS-SETUP.md                 # Guia de configuração HTTPS
├── DATADOG-SETUP.md               # Guia de instalação do Datadog
├── VERSION-TRACKING.md            # Guia de versionamento
├── setup-https.sh                 # Script de instalação HTTPS
└── README.md                      # Este arquivo

.github/
└── workflows/
    └── deploy-eks.yml             # GitHub Actions para deploy automático
```

## 🚀 Quick Start

### 1. Deploy Inicial no EKS

```bash
# Configurar kubectl
aws eks update-kubeconfig --region us-east-1 --name eks-sandbox-datadog

# Aplicar todos os manifests
kubectl apply -f base/namespace.yaml
kubectl apply -f base/configmap.yaml
kubectl apply -f base/secrets.yaml
kubectl apply -f base/

# Verificar pods
kubectl get pods -n dogbank
```

### 2. Configurar HTTPS (Let's Encrypt)

```bash
# Ver guia completo em: HTTPS-SETUP.md
./setup-https.sh
```

Acesse: **https://lab.dogbank.dog**

### 3. Instalar Datadog

```bash
# Ver guia completo em: DATADOG-SETUP.md

# 1. Instalar Operator
helm repo add datadog https://helm.datadoghq.com
helm install datadog-operator datadog/datadog-operator

# 2. Criar secret
kubectl create secret generic datadog-secret --from-literal api-key=YOUR_API_KEY

# 3. Aplicar Agent
kubectl apply -f base/datadog-agent.yaml
```

### 4. Configurar Versionamento Automático

```bash
# Ver guia completo em: VERSION-TRACKING.md

# Criar e fazer push de uma tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions vai fazer deploy automático!
```

## 🌐 Endpoints

Após o deploy, os seguintes endpoints estarão disponíveis:

### Produção (HTTPS)
- **Frontend**: https://lab.dogbank.dog
- **Auth API**: https://lab.dogbank.dog/api/auth
- **Accounts API**: https://lab.dogbank.dog/api/accounts
- **Transactions API**: https://lab.dogbank.dog/api/transactions
- **Banco Central API**: https://lab.dogbank.dog/api/bancocentral
- **Chatbot API**: https://lab.dogbank.dog/api/chatbot

### Datadog Console
- **APM**: https://app.datadoghq.com/apm/traces?query=env:dogbank
- **Infrastructure**: https://app.datadoghq.com/infrastructure
- **Logs**: https://app.datadoghq.com/logs?query=env:dogbank
- **Security**: https://app.datadoghq.com/security

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS EKS Cluster                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Namespace: dogbank                                   │   │
│  │                                                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │  Frontend  │  │    Auth    │  │  Account   │     │   │
│  │  │   (React)  │  │  Service   │  │  Service   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  │                                                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │Transaction │  │   Banco    │  │  Chatbot   │     │   │
│  │  │  Service   │  │  Central   │  │  Service   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  │                                                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │   Fraud    │  │    PIX     │  │ PostgreSQL │     │   │
│  │  │ Detection  │  │   Worker   │  │  Database  │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  │                                                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │   Redis    │  │   Kafka    │  │  RabbitMQ  │     │   │
│  │  │   Cache    │  │            │  │            │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Datadog Agent (DaemonSet)                           │   │
│  │  - APM & Tracing                                     │   │
│  │  - Log Collection                                    │   │
│  │  - Security Monitoring                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Ingress (nginx)                                      │   │
│  │  - HTTPS (Let's Encrypt)                             │   │
│  │  - lab.dogbank.dog                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
                    ┌───────────────┐
                    │   Datadog     │
                    │   Console     │
                    └───────────────┘
```

## 📊 Monitoramento

### Datadog Tags

Todos os serviços estão tagueados com:
- `env:dogbank` - Ambiente
- `service:<nome>` - Nome do serviço
- `version:X.Y.Z` - Versão deployada
- `team:dogbank-backend` ou `team:dogbank-frontend`

### Features Habilitadas

✅ **APM (Application Performance Monitoring)**
- Distributed Tracing
- Profiling
- Data Streams Monitoring (Kafka/RabbitMQ)

✅ **Logs**
- Log Collection de todos os containers
- Log correlation com traces

✅ **Security**
- Application Security Management (ASM)
- Cloud Workload Security (CWS)
- Cloud Security Posture Management (CSPM)
- SBOM (Software Bill of Materials)

✅ **Infrastructure**
- Universal Service Monitoring (USM)
- Network Performance Monitoring (NPM)
- Live Process Collection
- Orchestrator Explorer

## 🔄 Workflows Comuns

### Deploy Nova Versão

```bash
# 1. Fazer mudanças no código
git add .
git commit -m "feat: nova funcionalidade"

# 2. Criar tag
git tag v1.2.3

# 3. Push (deploy automático via GitHub Actions)
git push origin main
git push origin v1.2.3

# 4. Acompanhar no GitHub Actions e Datadog
```

### Rollback

```bash
# Opção 1: Via GitHub Actions
# GitHub → Actions → Deploy to EKS → Run workflow → v1.2.2

# Opção 2: Via kubectl
kubectl rollout undo deployment/account-service -n dogbank

# Opção 3: Via script
cd k8s/scripts
./update-version.sh v1.2.2
kubectl apply -f ../base/
```

### Ver Logs

```bash
# Logs de um serviço
kubectl logs -f deployment/account-service -n dogbank

# Logs com erro
kubectl logs -f deployment/account-service -n dogbank | grep ERROR

# Logs de todos os pods de um serviço
kubectl logs -f -l app=account-service -n dogbank
```

### Escalar Serviços

```bash
# Escalar para 3 réplicas
kubectl scale deployment account-service -n dogbank --replicas=3

# Auto-scaling (exemplo)
kubectl autoscale deployment account-service -n dogbank \
  --min=2 --max=10 --cpu-percent=80
```

## 🆘 Troubleshooting

### Pods não ficam prontos

```bash
# Ver detalhes do pod
kubectl describe pod <pod-name> -n dogbank

# Ver logs
kubectl logs <pod-name> -n dogbank

# Ver eventos
kubectl get events -n dogbank --sort-by='.lastTimestamp'
```

### Serviço não responde

```bash
# Testar conectividade
kubectl run -it --rm debug --image=busybox --restart=Never -n dogbank -- \
  wget -O- http://account-service:8089/actuator/health

# Ver endpoints
kubectl get endpoints -n dogbank
```

### HTTPS não funciona

```bash
# Ver certificado
kubectl get certificate -n dogbank
kubectl describe certificate dogbank-tls-cert -n dogbank

# Ver Ingress
kubectl get ingress -n dogbank
kubectl describe ingress dogbank-ingress -n dogbank
```

### Datadog não mostra dados

```bash
# Ver pods do Datadog
kubectl get pods -n default | grep datadog

# Ver logs do Agent
kubectl logs -f daemonset/datadog-agent -n default

# Ver logs do Cluster Agent
kubectl logs -f deployment/datadog-cluster-agent -n default

# Verificar API Key
kubectl get secret datadog-secret -n default -o yaml
```

## 📚 Documentação Completa

- **[HTTPS-SETUP.md](HTTPS-SETUP.md)** - Configuração completa de HTTPS com Let's Encrypt
- **[DATADOG-SETUP.md](DATADOG-SETUP.md)** - Instalação e configuração do Datadog
- **[VERSION-TRACKING.md](VERSION-TRACKING.md)** - Sistema de versionamento e deploy automático

## 🔐 Secrets Necessários

### Kubernetes Secrets

Criar o arquivo `secrets.yaml` com:
- Senhas do banco de dados
- Tokens de autenticação
- Chaves de API

### GitHub Secrets

Configurar em **Settings** → **Secrets**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` (opcional)
- `DATADOG_API_KEY`

## 📝 Checklist de Deploy

- [ ] Cluster EKS criado e configurado
- [ ] kubectl configurado (`aws eks update-kubeconfig`)
- [ ] Secrets criados no K8s
- [ ] Namespace criado
- [ ] ConfigMaps aplicados
- [ ] Serviços deployados
- [ ] HTTPS configurado (cert-manager + ingress)
- [ ] Datadog instalado
- [ ] GitHub Actions configurado
- [ ] DNS configurado (lab.dogbank.dog)
- [ ] Primeira tag criada e deploy testado
- [ ] Verificado traces no Datadog

## 🎯 Próximos Passos

1. ✅ Adicionar CI/CD para build de imagens Docker
2. ✅ Configurar staging environment
3. ✅ Adicionar testes automatizados
4. ✅ Configurar backup automático do banco
5. ✅ Adicionar Prometheus/Grafana (opcional)

---

**Versão**: 1.0.0  
**Última atualização**: Janeiro 2026  
**Cluster**: eks-sandbox-datadog  
**Domínio**: https://lab.dogbank.dog
