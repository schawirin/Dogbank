# Arquitetura de Microserviços - DogBank

## Análise dos Módulos Existentes

### 1. **auth-module** (Porta 8088)
- **Responsabilidade**: Autenticação e autorização
- **Banco**: PostgreSQL (dogbank)
- **Dependências**: Nenhuma identificada
- **Status**: Serviço independente ✅

### 2. **account-module** (Porta 8089)  
- **Responsabilidade**: Gestão de contas bancárias
- **Banco**: PostgreSQL (dogbank)
- **Dependências**: Provavelmente depende do auth-module
- **Status**: Microserviço independente ✅

### 3. **transaction-module** (Porta 8084)
- **Responsabilidade**: Processamento de transações
- **Banco**: PostgreSQL (dogbank)
- **Dependências**: 
  - bancocentral-module (http://localhost:8085/api/bancocentral/pix/validate)
  - Provavelmente account-module para validar contas
- **Status**: Microserviço com dependências ⚠️

### 4. **bancocentral-module** (Porta 8085)
- **Responsabilidade**: Validação PIX e integração Banco Central
- **Banco**: PostgreSQL (dogbank)
- **Dependências**: Nenhuma (serviço de validação)
- **Status**: Serviço independente ✅

### 5. **integration-module** (Porta 8082)
- **Responsabilidade**: Integrações externas
- **Banco**: PostgreSQL (dogbank)
- **Dependências**: A definir
- **Status**: Microserviço independente ✅

### 6. **notification-module** (Porta 8083)
- **Responsabilidade**: Envio de notificações
- **Banco**: PostgreSQL (dogbank)
- **Dependências**: Nenhuma (serviço de notificação)
- **Status**: Serviço independente ✅

## Estratégia de Microserviços

### Ordem de Inicialização Recomendada:
1. **bancocentral-module** (sem dependências)
2. **auth-module** (autenticação base)
3. **account-module** (gestão de contas)
4. **notification-module** (notificações)
5. **integration-module** (integrações)
6. **transaction-module** (depende do bancocentral)

### Comunicação Entre Serviços:
- **Service Discovery**: Usar DNS do Kubernetes
- **Load Balancing**: Kubernetes Services
- **Configuration**: ConfigMaps e Secrets
- **Database**: PostgreSQL compartilhado (pode ser separado futuramente)

### Configurações de Rede:
- Cada serviço terá seu próprio Service no Kubernetes
- Comunicação interna via service names (ex: `bancocentral-service:8085`)
- Ingress Controller para acesso externo
- Health checks em `/actuator/health`

