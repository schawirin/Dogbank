# =============================================================================
# DogBank - Service Level Objectives (SLOs)
# =============================================================================
# SLOs baseados nos monitors para medir a confiabilidade dos servicos
# =============================================================================

# =============================================================================
# Transaction Service SLO
# =============================================================================
resource "datadog_service_level_objective" "transaction_service_slo" {
  name        = "[DogBank] Transaction Service SLO"
  type        = "monitor"
  description = <<-EOT
SLO para o servico de transacoes PIX.

Este SLO mede a disponibilidade e performance do transaction-service,
que e responsavel por receber e processar transacoes PIX.

**Criterios:**
- Error Rate < 5%
- Latency P99 < 1s
EOT

  monitor_ids = [
    datadog_monitor.transaction_service_error_rate.id,
    datadog_monitor.transaction_service_latency.id,
  ]

  thresholds {
    timeframe = "30d"
    target    = 99.5
    warning   = 99.8
  }

  thresholds {
    timeframe = "7d"
    target    = 99.5
    warning   = 99.8
  }

  tags = concat(local.common_tags, [
    "service:transaction-service",
    "team:dogbank-backend",
    "tier:critical"
  ])
}

# =============================================================================
# Banco Central Service SLO
# =============================================================================
resource "datadog_service_level_objective" "bancocentral_service_slo" {
  name        = "[DogBank] Banco Central Service SLO"
  type        = "monitor"
  description = <<-EOT
SLO para o servico de integracao com o Banco Central.

Este SLO mede a disponibilidade e performance do bancocentral-service,
que e responsavel pela comunicacao com o SPI (Sistema de Pagamentos Instantaneos).

**Criterios:**
- Error Rate < 5%
- Latency P99 < 1s

**Nota:** Este servico depende da disponibilidade da API do BACEN.
EOT

  monitor_ids = [
    datadog_monitor.bancocentral_service_error_rate.id,
    datadog_monitor.bancocentral_service_latency.id,
  ]

  thresholds {
    timeframe = "30d"
    target    = 99.5
    warning   = 99.8
  }

  thresholds {
    timeframe = "7d"
    target    = 99.5
    warning   = 99.8
  }

  tags = concat(local.common_tags, [
    "service:bancocentral-service",
    "team:dogbank-backend",
    "tier:critical",
    "external-dependency:bacen"
  ])
}

# =============================================================================
# Auth Service SLO
# =============================================================================
resource "datadog_service_level_objective" "auth_service_slo" {
  name        = "[DogBank] Auth Service SLO"
  type        = "monitor"
  description = <<-EOT
SLO para o servico de autenticacao.

Este SLO mede a disponibilidade e performance do auth-service,
que e responsavel pelo login, logout e validacao de sessoes.

**Criterios:**
- Error Rate < 5%
- Latency P99 < 1s

**Target mais alto:** Servico de autenticacao e critico para todos os usuarios.
EOT

  monitor_ids = [
    datadog_monitor.auth_service_error_rate.id,
    datadog_monitor.auth_service_latency.id,
  ]

  thresholds {
    timeframe = "30d"
    target    = 99.9
    warning   = 99.95
  }

  thresholds {
    timeframe = "7d"
    target    = 99.9
    warning   = 99.95
  }

  tags = concat(local.common_tags, [
    "service:auth-service",
    "team:dogbank-backend",
    "tier:critical"
  ])
}

# =============================================================================
# PIX Flow SLO (Composto)
# =============================================================================
resource "datadog_service_level_objective" "pix_flow_slo" {
  name        = "[DogBank] PIX Flow SLO (End-to-End)"
  type        = "monitor"
  description = <<-EOT
SLO composto para o fluxo completo de PIX.

Este SLO mede a disponibilidade end-to-end do fluxo de transacoes PIX,
incluindo:
- transaction-service (recebe a transacao)
- pix-worker (processa assincronamente)
- bancocentral-service (liquida no BACEN)

**Criterios:**
- Todos os servicos do fluxo PIX devem estar saudaveis

**Target menor:** Por ser composto, aceita mais margem de erro.
EOT

  monitor_ids = [
    datadog_monitor.transaction_service_error_rate.id,
    datadog_monitor.transaction_service_latency.id,
    datadog_monitor.pix_worker_error_rate.id,
    datadog_monitor.pix_worker_latency.id,
    datadog_monitor.bancocentral_service_error_rate.id,
    datadog_monitor.bancocentral_service_latency.id,
    datadog_monitor.kafka_lag.id,
  ]

  thresholds {
    timeframe = "30d"
    target    = 99.0
    warning   = 99.5
  }

  thresholds {
    timeframe = "7d"
    target    = 99.0
    warning   = 99.5
  }

  tags = concat(local.common_tags, [
    "flow:pix",
    "team:dogbank-backend",
    "tier:critical",
    "type:composite"
  ])
}

# =============================================================================
# Account Service SLO
# =============================================================================
resource "datadog_service_level_objective" "account_service_slo" {
  name        = "[DogBank] Account Service SLO"
  type        = "monitor"
  description = <<-EOT
SLO para o servico de contas.

Este SLO mede a disponibilidade e performance do account-service,
que e responsavel por consulta de saldo, extrato e dados cadastrais.

**Criterios:**
- Error Rate < 5%
- Latency P99 < 1s
EOT

  monitor_ids = [
    datadog_monitor.account_service_error_rate.id,
    datadog_monitor.account_service_latency.id,
  ]

  thresholds {
    timeframe = "30d"
    target    = 99.5
    warning   = 99.8
  }

  thresholds {
    timeframe = "7d"
    target    = 99.5
    warning   = 99.8
  }

  tags = concat(local.common_tags, [
    "service:account-service",
    "team:dogbank-backend",
    "tier:high"
  ])
}

# =============================================================================
# Chatbot Service SLO
# =============================================================================
resource "datadog_service_level_objective" "chatbot_service_slo" {
  name        = "[DogBank] Chatbot Service SLO"
  type        = "monitor"
  description = <<-EOT
SLO para o servico de chatbot com IA.

Este SLO mede a disponibilidade e performance do chatbot-service,
que e responsavel pelo atendimento automatizado via LLM.

**Criterios:**
- Error Rate < 5%
- Latency P99 < 3s (maior devido a natureza do LLM)

**Nota:** Latencia maior e esperada devido ao processamento do LLM.
EOT

  monitor_ids = [
    datadog_monitor.chatbot_service_error_rate.id,
    datadog_monitor.chatbot_service_latency.id,
  ]

  thresholds {
    timeframe = "30d"
    target    = 99.0
    warning   = 99.5
  }

  thresholds {
    timeframe = "7d"
    target    = 99.0
    warning   = 99.5
  }

  tags = concat(local.common_tags, [
    "service:chatbot-service",
    "team:dogbank-ai",
    "ml_app:dogbot-assistant",
    "tier:medium"
  ])
}
