# =============================================================================
# DogBank - Service Definitions (Service Catalog)
# =============================================================================
# Metadados dos servicos para aparecer no Service Catalog do Datadog
# Isso permite que o Service Map reflita a saude dos monitores
# =============================================================================

# =============================================================================
# Transaction Service
# =============================================================================
resource "datadog_service_definition_yaml" "transaction_service" {
  service_definition = <<EOF
schema-version: v2.2
dd-service: transaction-service
team: dogbank-backend
contacts:
  - name: Backend Team
    type: email
    contact: backend@dogbank.com
  - name: Slack Channel
    type: slack
    contact: https://dogbank.slack.com/archives/dogbank-alerts
links:
  - name: GitHub Repository
    type: repo
    url: https://github.com/dogbank/transaction-module
  - name: Runbook
    type: runbook
    url: https://github.com/dogbank/runbooks/blob/main/transaction-service.md
  - name: API Documentation
    type: doc
    url: https://github.com/dogbank/docs/blob/main/api/transaction.md
tags:
  - env:dogbank
  - tier:critical
  - business-unit:pix
type: web
lifecycle: production
description: |
  Servico principal de transacoes PIX. Responsavel por:
  - Receber requisicoes de transferencia
  - Validar dados da transacao
  - Publicar eventos no Kafka
  - Integrar com Banco Central (SPI)
EOF
}

# =============================================================================
# Banco Central Service
# =============================================================================
resource "datadog_service_definition_yaml" "bancocentral_service" {
  service_definition = <<EOF
schema-version: v2.2
dd-service: bancocentral-service
team: dogbank-backend
contacts:
  - name: Backend Team
    type: email
    contact: backend@dogbank.com
  - name: Slack Channel
    type: slack
    contact: https://dogbank.slack.com/archives/dogbank-alerts
links:
  - name: GitHub Repository
    type: repo
    url: https://github.com/dogbank/bancocentral-module
  - name: Runbook
    type: runbook
    url: https://github.com/dogbank/runbooks/blob/main/bancocentral-service.md
  - name: SPI Documentation
    type: doc
    url: https://www.bcb.gov.br/estabilidadefinanceira/pix
tags:
  - env:dogbank
  - tier:critical
  - business-unit:pix
  - external-dependency:bacen
type: web
lifecycle: production
description: |
  Servico de integracao com o Banco Central do Brasil (BACEN).
  Responsavel por:
  - Comunicacao com SPI (Sistema de Pagamentos Instantaneos)
  - Liquidacao de transacoes PIX
  - Consulta de chaves PIX no DICT
EOF
}

# =============================================================================
# Auth Service
# =============================================================================
resource "datadog_service_definition_yaml" "auth_service" {
  service_definition = <<EOF
schema-version: v2.2
dd-service: auth-service
team: dogbank-backend
contacts:
  - name: Backend Team
    type: email
    contact: backend@dogbank.com
  - name: Security Team
    type: email
    contact: security@dogbank.com
  - name: Slack Channel
    type: slack
    contact: https://dogbank.slack.com/archives/dogbank-alerts
links:
  - name: GitHub Repository
    type: repo
    url: https://github.com/dogbank/auth-module
  - name: Runbook
    type: runbook
    url: https://github.com/dogbank/runbooks/blob/main/auth-service.md
tags:
  - env:dogbank
  - tier:critical
  - business-unit:security
type: web
lifecycle: production
description: |
  Servico de autenticacao e autorizacao.
  Responsavel por:
  - Login e logout de usuarios
  - Gerenciamento de tokens JWT
  - Validacao de sessoes
  - Integracao com Redis para cache de sessoes
EOF
}

# =============================================================================
# Account Service
# =============================================================================
resource "datadog_service_definition_yaml" "account_service" {
  service_definition = <<EOF
schema-version: v2.2
dd-service: account-service
team: dogbank-backend
contacts:
  - name: Backend Team
    type: email
    contact: backend@dogbank.com
  - name: Slack Channel
    type: slack
    contact: https://dogbank.slack.com/archives/dogbank-alerts
links:
  - name: GitHub Repository
    type: repo
    url: https://github.com/dogbank/account-module
  - name: Runbook
    type: runbook
    url: https://github.com/dogbank/runbooks/blob/main/account-service.md
tags:
  - env:dogbank
  - tier:high
  - business-unit:core-banking
type: web
lifecycle: production
description: |
  Servico de gerenciamento de contas.
  Responsavel por:
  - Consulta de saldo
  - Extrato de transacoes
  - Dados cadastrais do cliente
  - Integracao com PostgreSQL
EOF
}

# =============================================================================
# PIX Worker
# =============================================================================
resource "datadog_service_definition_yaml" "pix_worker" {
  service_definition = <<EOF
schema-version: v2.2
dd-service: pix-worker
team: dogbank-backend
contacts:
  - name: Backend Team
    type: email
    contact: backend@dogbank.com
  - name: Slack Channel
    type: slack
    contact: https://dogbank.slack.com/archives/dogbank-alerts
links:
  - name: GitHub Repository
    type: repo
    url: https://github.com/dogbank/pix-worker
  - name: Runbook
    type: runbook
    url: https://github.com/dogbank/runbooks/blob/main/pix-worker.md
tags:
  - env:dogbank
  - tier:critical
  - business-unit:pix
type: worker
lifecycle: production
description: |
  Worker para processamento assincrono de transacoes PIX.
  Responsavel por:
  - Consumir eventos do Kafka (topic: pix-transactions)
  - Processar transacoes em background
  - Atualizar status no PostgreSQL
  - Publicar resultados no RabbitMQ
EOF
}

# =============================================================================
# Chatbot Service
# =============================================================================
resource "datadog_service_definition_yaml" "chatbot_service" {
  service_definition = <<EOF
schema-version: v2.2
dd-service: chatbot-service
team: dogbank-ai
contacts:
  - name: AI Team
    type: email
    contact: ai@dogbank.com
  - name: Slack Channel
    type: slack
    contact: https://dogbank.slack.com/archives/dogbank-ai
links:
  - name: GitHub Repository
    type: repo
    url: https://github.com/dogbank/chatbot-python
  - name: Runbook
    type: runbook
    url: https://github.com/dogbank/runbooks/blob/main/chatbot-service.md
  - name: LLM Observability
    type: dashboard
    url: https://app.datadoghq.com/llm
tags:
  - env:dogbank
  - tier:medium
  - business-unit:ai
  - ml_app:dogbot-assistant
type: web
lifecycle: production
description: |
  Chatbot com IA para atendimento ao cliente.
  Responsavel por:
  - Atendimento automatizado via chat
  - Integracao com LLM (Groq API)
  - Consulta de saldo e extrato via funcoes
  - Guardrails de seguranca contra prompt injection
EOF
}

# =============================================================================
# Fraud Detection Service
# =============================================================================
resource "datadog_service_definition_yaml" "fraud_detection_service" {
  service_definition = <<EOF
schema-version: v2.2
dd-service: fraud-detection-service
team: dogbank-backend
contacts:
  - name: Backend Team
    type: email
    contact: backend@dogbank.com
  - name: Security Team
    type: email
    contact: security@dogbank.com
  - name: Slack Channel
    type: slack
    contact: https://dogbank.slack.com/archives/dogbank-alerts
links:
  - name: GitHub Repository
    type: repo
    url: https://github.com/dogbank/fraud-detection
  - name: Runbook
    type: runbook
    url: https://github.com/dogbank/runbooks/blob/main/fraud-detection.md
tags:
  - env:dogbank
  - tier:high
  - business-unit:security
  - compliance:coaf
type: worker
lifecycle: production
description: |
  Servico de deteccao de fraude em transacoes.
  Responsavel por:
  - Analise de padroes suspeitos
  - Validacao de limites transacionais
  - Notificacao ao COAF quando necessario
  - Consumo de filas RabbitMQ (pix.fraud)
EOF
}
