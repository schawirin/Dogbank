# DogBank - Guia de Containerização e Deploy Kubernetes

## Visão Geral

Este documento apresenta a solução completa para containerização do backend DogBank e sua transformação em uma arquitetura de microserviços para deployment no Kubernetes.

### Arquitetura Original vs Nova Arquitetura

**Antes:**
- Monolito com múltiplos módulos em um único container
- Dockerfile multi-stage executando todos os serviços
- Comunicação interna via localhost

**Depois:**
- 6 microserviços independentes
- Containers otimizados para cada serviço
- Comunicação via service discovery do Kubernetes
- Auto-scaling e alta disponibilidade

## Microserviços Implementados

### 1. Auth Service (Porta 8088)
- **Responsabilidade**: Autenticação e autorização
- **Réplicas**: 3 (produção) / 1 (desenvolvimento)
- **Recursos**: 256Mi RAM, 250m CPU
- **Auto-scaling**: 3-15 réplicas baseado em CPU/Memory

### 2. Account Service (Porta 8089)
- **Responsabilidade**: Gestão de contas bancárias
- **Réplicas**: 3 (produção) / 1 (desenvolvimento)
- **Recursos**: 256Mi RAM, 250m CPU
- **Auto-scaling**: 3-15 réplicas baseado em CPU/Memory

### 3. Transaction Service (Porta 8084)
- **Responsabilidade**: Processamento de transações
- **Réplicas**: 4 (produção) / 1 (desenvolvimento)
- **Recursos**: 256Mi RAM, 250m CPU
- **Auto-scaling**: 4-20 réplicas baseado em CPU/Memory
- **Dependências**: BancoCentral Service

### 4. BancoCentral Service (Porta 8085)
- **Responsabilidade**: Validação PIX e integração Banco Central
- **Réplicas**: 2 (produção) / 1 (desenvolvimento)
- **Recursos**: 256Mi RAM, 250m CPU
- **Auto-scaling**: 2-10 réplicas baseado em CPU/Memory

### 5. Integration Service (Porta 8082)
- **Responsabilidade**: Integrações externas
- **Réplicas**: 2 (produção) / 1 (desenvolvimento)
- **Recursos**: 256Mi RAM, 250m CPU
- **Auto-scaling**: 2-10 réplicas baseado em CPU/Memory

### 6. Notification Service (Porta 8083)
- **Responsabilidade**: Envio de notificações
- **Réplicas**: 2 (produção) / 1 (desenvolvimento)
- **Recursos**: 256Mi RAM, 250m CPU
- **Auto-scaling**: 2-10 réplicas baseado em CPU/Memory

## Infraestrutura

### Banco de Dados
- **PostgreSQL 15**: StatefulSet com volume persistente de 10Gi
- **Configurações otimizadas**: Para performance em containers
- **Health checks**: Liveness e readiness probes configurados

### Rede e Segurança
- **Namespace isolado**: `dogbank`
- **Network Policies**: Controle de tráfego entre pods
- **RBAC**: Permissões mínimas necessárias
- **Pod Disruption Budgets**: Garantia de disponibilidade durante updates

### Ingress e Load Balancing
- **Nginx Ingress Controller**: Roteamento baseado em path
- **SSL/TLS**: Certificados automáticos via cert-manager
- **Rate Limiting**: 100 requests/minuto por IP
- **Health checks**: Endpoint `/health` para monitoramento



## Estrutura de Arquivos

```
dogbank/
├── dockerfiles/                    # Dockerfiles individuais
│   ├── Dockerfile.auth
│   ├── Dockerfile.account
│   ├── Dockerfile.transaction
│   ├── Dockerfile.bancocentral
│   ├── Dockerfile.integration
│   └── Dockerfile.notification
├── k8s/                           # Manifestos Kubernetes
│   ├── base/                      # Configurações base
│   │   ├── 00-namespace-config.yaml
│   │   ├── 01-postgres.yaml
│   │   ├── 02-bancocentral-service.yaml
│   │   ├── 03-auth-service.yaml
│   │   ├── 04-account-service.yaml
│   │   ├── 05-transaction-service.yaml
│   │   ├── 06-integration-service.yaml
│   │   ├── 07-notification-service.yaml
│   │   ├── 08-ingress-network.yaml
│   │   └── 09-rbac-pdb.yaml
│   └── overlays/                  # Configurações por ambiente
│       ├── dev/
│       ├── staging/
│       └── prod/
├── nginx/                         # Configuração API Gateway
│   └── nginx.conf
├── init-db/                       # Scripts de inicialização DB
│   └── 01-init.sh
├── docker-compose.microservices.yml  # Docker Compose para dev
├── build-images.sh                # Script de build das imagens
├── dev-local.sh                   # Script para desenvolvimento local
├── deploy-k8s.sh                  # Script de deploy Kubernetes
└── microservices-architecture.md  # Documentação da arquitetura
```

## Pré-requisitos

### Para Desenvolvimento Local (Docker Compose)
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM disponível
- 10GB espaço em disco

### Para Deploy Kubernetes
- Kubernetes 1.24+
- kubectl configurado
- Nginx Ingress Controller
- cert-manager (para SSL automático)
- Metrics Server (para HPA)
- 8GB RAM disponível no cluster
- 50GB espaço em disco

## Guia de Uso

### 1. Desenvolvimento Local com Docker Compose

#### Build das Imagens
```bash
# Build de todas as imagens
./build-images.sh

# Build com tag específica
./build-images.sh v1.0.0 meu-registry
```

#### Executar Ambiente Local
```bash
# Iniciar todos os serviços
./dev-local.sh start

# Ver logs
./dev-local.sh logs

# Ver logs de um serviço específico
./dev-local.sh logs auth-service

# Ver status
./dev-local.sh status

# Parar serviços
./dev-local.sh stop

# Limpeza completa
./dev-local.sh clean
```

#### Endpoints Locais
- **API Gateway**: http://localhost
- **Auth Service**: http://localhost:8088
- **Account Service**: http://localhost:8089
- **Transaction Service**: http://localhost:8084
- **BancoCentral Service**: http://localhost:8085
- **Integration Service**: http://localhost:8082
- **Notification Service**: http://localhost:8083
- **PostgreSQL**: localhost:5432

### 2. Deploy no Kubernetes

#### Deploy Completo
```bash
# Deploy em desenvolvimento
./deploy-k8s.sh dev

# Deploy em produção
./deploy-k8s.sh prod

# Ver status
./deploy-k8s.sh prod status

# Cleanup
./deploy-k8s.sh dev cleanup
```

#### Deploy Manual
```bash
# Aplicar manifestos base
kubectl apply -f k8s/base/

# Aplicar configurações específicas do ambiente
kubectl apply -k k8s/overlays/prod/

# Verificar status
kubectl get all -n dogbank
```

#### Monitoramento
```bash
# Ver pods
kubectl get pods -n dogbank

# Ver logs
kubectl logs -f deployment/auth-service -n dogbank

# Ver métricas de auto-scaling
kubectl get hpa -n dogbank

# Acessar banco de dados
kubectl exec -it postgres-0 -n dogbank -- psql -U dogbank -d dogbank
```


## Configurações Importantes

### Variáveis de Ambiente

#### ConfigMap (dogbank-config)
```yaml
DB_HOST: "postgres-service"
DB_PORT: "5432"
DB_NAME: "dogbank"
SPRING_PROFILES_ACTIVE: "kubernetes"
JAVA_OPTS: "-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseContainerSupport"
BANCOCENTRAL_API_URL: "http://bancocentral-service:8085/api/bancocentral/pix/validate"
```

#### Secrets (dogbank-secrets)
```yaml
DB_USER: "dogbank" (base64)
DB_PASSWORD: "dog1234" (base64)
JWT_SECRET: "jwt-secret-key-change-in-production" (base64)
```

### Comunicação Entre Serviços

Os serviços se comunicam usando os nomes dos Services do Kubernetes:

- `auth-service:8088`
- `account-service:8089`
- `transaction-service:8084`
- `bancocentral-service:8085`
- `integration-service:8082`
- `notification-service:8083`
- `postgres-service:5432`

### Health Checks

Todos os serviços implementam health checks do Spring Boot Actuator:

- **Liveness Probe**: `/actuator/health`
- **Readiness Probe**: `/actuator/health/readiness`
- **Startup Probe**: `/actuator/health`

### Auto-scaling (HPA)

Configurado para escalar baseado em:
- **CPU**: 70% de utilização
- **Memory**: 80% de utilização

Limites por serviço:
- **Auth**: 3-15 réplicas
- **Account**: 3-15 réplicas
- **Transaction**: 4-20 réplicas (maior carga esperada)
- **BancoCentral**: 2-10 réplicas
- **Integration**: 2-10 réplicas
- **Notification**: 2-10 réplicas

## Segurança

### Network Policies
- Isolamento de rede por namespace
- Comunicação permitida apenas entre serviços necessários
- Acesso externo controlado via Ingress

### RBAC
- Service Account específico para o DogBank
- Permissões mínimas necessárias
- Acesso apenas a recursos do próprio namespace

### Pod Security
- Containers executam como usuário não-root
- Imagens baseadas em Alpine Linux (menor superfície de ataque)
- Resource limits configurados

### Secrets Management
- Senhas e chaves em Kubernetes Secrets
- Não exposição de credenciais em logs
- Rotação de secrets recomendada

## Monitoramento e Observabilidade

### Logs
```bash
# Logs de todos os serviços
kubectl logs -f -l component=microservice -n dogbank

# Logs de um serviço específico
kubectl logs -f deployment/transaction-service -n dogbank

# Logs do banco de dados
kubectl logs -f statefulset/postgres -n dogbank
```

### Métricas
```bash
# Status dos HPA
kubectl get hpa -n dogbank

# Uso de recursos
kubectl top pods -n dogbank

# Status dos deployments
kubectl get deployments -n dogbank
```

### Health Checks
```bash
# Verificar health de todos os pods
kubectl get pods -n dogbank

# Testar endpoint de health
kubectl exec -it deployment/auth-service -n dogbank -- wget -qO- http://localhost:8088/actuator/health
```


## Troubleshooting

### Problemas Comuns

#### 1. Pods não iniciam
```bash
# Verificar eventos
kubectl describe pod <pod-name> -n dogbank

# Verificar logs
kubectl logs <pod-name> -n dogbank

# Verificar recursos
kubectl top pods -n dogbank
```

#### 2. Serviços não se comunicam
```bash
# Testar conectividade
kubectl exec -it deployment/transaction-service -n dogbank -- wget -qO- http://bancocentral-service:8085/actuator/health

# Verificar services
kubectl get svc -n dogbank

# Verificar network policies
kubectl get networkpolicy -n dogbank
```

#### 3. Banco de dados não conecta
```bash
# Verificar status do PostgreSQL
kubectl get statefulset postgres -n dogbank

# Testar conexão
kubectl exec -it postgres-0 -n dogbank -- pg_isready -U dogbank

# Verificar logs do banco
kubectl logs postgres-0 -n dogbank
```

#### 4. Ingress não funciona
```bash
# Verificar ingress controller
kubectl get pods -n ingress-nginx

# Verificar ingress
kubectl describe ingress dogbank-ingress -n dogbank

# Testar DNS
nslookup api.dogbank.com
```

### Comandos Úteis

#### Debugging
```bash
# Entrar em um pod
kubectl exec -it deployment/auth-service -n dogbank -- /bin/sh

# Port forward para acesso local
kubectl port-forward svc/auth-service 8088:8088 -n dogbank

# Verificar configurações
kubectl get configmap dogbank-config -n dogbank -o yaml

# Verificar secrets
kubectl get secret dogbank-secrets -n dogbank -o yaml
```

#### Manutenção
```bash
# Restart de um deployment
kubectl rollout restart deployment/auth-service -n dogbank

# Escalar manualmente
kubectl scale deployment auth-service --replicas=5 -n dogbank

# Verificar histórico de rollouts
kubectl rollout history deployment/auth-service -n dogbank

# Rollback
kubectl rollout undo deployment/auth-service -n dogbank
```

## Performance e Otimização

### Recursos Recomendados por Ambiente

#### Desenvolvimento
- **CPU**: 100m request, 200m limit
- **Memory**: 128Mi request, 256Mi limit
- **Réplicas**: 1 por serviço

#### Staging
- **CPU**: 200m request, 400m limit
- **Memory**: 256Mi request, 512Mi limit
- **Réplicas**: 2 por serviço

#### Produção
- **CPU**: 250m request, 500m limit
- **Memory**: 256Mi request, 512Mi limit
- **Réplicas**: 2-4 por serviço (baseado na carga)

### Otimizações JVM
```bash
# Configurações otimizadas para containers
JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseContainerSupport"

# Para ambientes com pouca memória
JAVA_OPTS="-Xms128m -Xmx256m -XX:+UseSerialGC -XX:+UseContainerSupport"
```

### Banco de Dados
- **Shared buffers**: 256MB
- **Effective cache size**: 1GB
- **Max connections**: 200
- **Work mem**: 4MB

## Backup e Disaster Recovery

### Backup do Banco de Dados
```bash
# Backup manual
kubectl exec postgres-0 -n dogbank -- pg_dump -U dogbank dogbank > backup.sql

# Restore
kubectl exec -i postgres-0 -n dogbank -- psql -U dogbank dogbank < backup.sql
```

### Backup dos Manifestos
```bash
# Backup de todos os recursos
kubectl get all,configmap,secret,pvc,ingress -n dogbank -o yaml > dogbank-backup.yaml
```

### Estratégia de Disaster Recovery
1. **Backup automático** do banco de dados (CronJob)
2. **Versionamento** dos manifestos Kubernetes
3. **Multi-zone deployment** para alta disponibilidade
4. **Monitoramento** e alertas configurados

## Próximos Passos

### Melhorias Recomendadas

1. **Service Mesh** (Istio/Linkerd)
   - Observabilidade avançada
   - Circuit breakers
   - Retry policies

2. **GitOps** (ArgoCD/Flux)
   - Deploy automatizado
   - Rollback automático
   - Auditoria de mudanças

3. **Monitoring Stack**
   - Prometheus + Grafana
   - Alertmanager
   - Jaeger para tracing

4. **CI/CD Pipeline**
   - Build automático das imagens
   - Testes automatizados
   - Deploy por ambiente

5. **Database Separation**
   - Banco dedicado por serviço
   - Replicação read-only
   - Backup automatizado

### Considerações de Produção

1. **Certificados SSL** via cert-manager
2. **DNS** configurado para o domínio
3. **Monitoring** e alertas
4. **Backup** automatizado
5. **Documentação** de runbooks
6. **Treinamento** da equipe

---

## Conclusão

Esta solução transforma o DogBank de um monolito em uma arquitetura de microserviços robusta e escalável, pronta para produção no Kubernetes. A implementação inclui todas as melhores práticas de segurança, observabilidade e alta disponibilidade.

Para dúvidas ou suporte, consulte a documentação oficial do Kubernetes e as melhores práticas de cada ferramenta utilizada.

**Autor**: Manus AI  
**Data**: Junho 2025  
**Versão**: 1.0

