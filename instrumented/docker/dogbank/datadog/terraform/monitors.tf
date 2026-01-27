# =============================================================================
# DogBank - Datadog Monitors
# =============================================================================
# Monitors para Bits AI SRE investigar automaticamente
# =============================================================================

# =============================================================================
# PIX - Alta Latencia P99
# =============================================================================
resource "datadog_monitor" "pix_latency" {
  name    = "[DogBank] PIX - Alta Latencia P99"
  type    = "metric alert"
  message = <<-EOT
## PIX com alta latencia!

**Servico**: transaction-service
**Latencia P99**: {{value}}ms (threshold: 2000ms)

### Investigacao
1. Verificar latencia do bancocentral-service
2. Checar consumer lag do Kafka
3. Verificar conexoes PostgreSQL
4. Analisar traces no APM

### Runbook
Acesse o notebook de investigacao PIX no Datadog.

### Acoes de Remediacao
- Se Kafka lag > 1000: escalar pix-worker
- Se PostgreSQL lento: verificar queries lentas
- Se bancocentral lento: verificar API externa

${var.slack_channel}
EOT

  query = "avg(last_5m):p99:trace.servlet.request{service:transaction-service,resource_name:post_/api/pix} > 2000"

  monitor_thresholds {
    critical = 2000
    warning  = 1000
  }

  notify_no_data    = false
  renotify_interval = 60

  tags = concat(local.common_tags, [
    "service:transaction-service",
    "team:pix",
    "severity:high"
  ])
}

# =============================================================================
# Error Rate Alto - Todos os Servicos
# =============================================================================
resource "datadog_monitor" "error_rate_high" {
  name    = "[DogBank] Error Rate > 5%"
  type    = "query alert"
  message = <<-EOT
## Error rate alto!

**Taxa de erro**: {{value}}%
**Threshold**: 5%

### Investigacao
1. Verificar logs de erro no Log Explorer
2. Analisar traces com erro no APM
3. Verificar dependencias (PostgreSQL, Redis, Kafka)
4. Checar recursos (CPU/memoria dos containers)

### Servicos Afetados
Verificar quais servicos estao gerando erros no Service Map.

${var.slack_channel}
EOT

  query = "sum(last_5m):sum:trace.servlet.request.errors{env:${var.environment}}.as_count() / sum:trace.servlet.request.hits{env:${var.environment}}.as_count() * 100 > 5"

  monitor_thresholds {
    critical = 5
    warning  = 2
  }

  notify_no_data    = false
  renotify_interval = 30

  tags = concat(local.common_tags, [
    "team:sre",
    "severity:high"
  ])
}

# =============================================================================
# Auth Service - Falhas de Login
# =============================================================================
resource "datadog_monitor" "auth_login_failures" {
  name    = "[DogBank] Auth - Muitas Falhas de Login"
  type    = "log alert"
  message = <<-EOT
## Muitas falhas de login detectadas!

**Quantidade**: {{value}} falhas em 5 minutos

### Possíveis Causas
1. Ataque de brute force
2. Problema com validacao de credenciais
3. Integracao com Redis falhando

### Investigacao
1. Verificar IPs de origem nos logs
2. Checar se Redis esta respondendo
3. Analisar padroes de tentativas

### Seguranca
Se suspeitar de ataque, verificar ASM para mais detalhes.

${var.slack_channel}
EOT

  query = "logs(\"service:auth-service status:error (login OR authentication)\").index(\"*\").rollup(\"count\").last(\"5m\") > 50"

  monitor_thresholds {
    critical = 50
    warning  = 20
  }

  notify_no_data = false

  tags = concat(local.common_tags, [
    "service:auth-service",
    "team:security",
    "severity:medium"
  ])
}

# =============================================================================
# SQL Injection Detectado (ASM)
# =============================================================================
resource "datadog_monitor" "sql_injection" {
  name    = "[DogBank] Security - SQL Injection Detectado"
  type    = "event-v2 alert"
  message = <<-EOT
## SQL Injection detectado pelo ASM!

### ACAO URGENTE NECESSARIA

### Detalhes do Ataque
Verifique o Application Security Monitoring para:
- IP de origem
- Payload utilizado
- Endpoint atacado

### Procedimento
1. **NAO** reiniciar servicos durante investigacao
2. Coletar evidencias (logs, traces)
3. Avaliar se houve exfiltracao de dados
4. Bloquear IP se necessario

### Escalacao
Este alerta e CRITICO e requer atencao imediata.

${var.pagerduty_service}
EOT

  query = "events(\"source:security_monitoring attack_type:sql_injection env:${var.environment}\").rollup(\"count\").last(\"5m\") > 0"

  notify_no_data    = false
  renotify_interval = 15

  tags = concat(local.common_tags, [
    "team:security",
    "severity:critical",
    "attack_type:sql_injection"
  ])
}

# =============================================================================
# RCE/Command Injection Detectado (ASM)
# =============================================================================
resource "datadog_monitor" "rce_attack" {
  name    = "[DogBank] Security - RCE/Command Injection Detectado"
  type    = "event-v2 alert"
  message = <<-EOT
## Command Injection detectado pelo ASM!

### ACAO URGENTE NECESSARIA

### Detalhes do Ataque
Este e um ataque critico que tenta executar comandos no servidor.

### Procedimento
1. Isolar o servico afetado se possivel
2. Verificar logs para comandos executados
3. Avaliar comprometimento do sistema
4. Notificar equipe de seguranca

${var.pagerduty_service}
EOT

  query = "events(\"source:security_monitoring (attack_type:command_injection OR attack_type:rce) env:${var.environment}\").rollup(\"count\").last(\"5m\") > 0"

  notify_no_data = false

  tags = concat(local.common_tags, [
    "team:security",
    "severity:critical",
    "attack_type:rce"
  ])
}

# =============================================================================
# LLM - Prompt Injection Detectado
# =============================================================================
resource "datadog_monitor" "prompt_injection" {
  name    = "[DogBank] LLM - Prompt Injection Detectado"
  type    = "log alert"
  message = <<-EOT
## Tentativas de Prompt Injection no Chatbot!

**Quantidade**: {{value}} tentativas em 5 minutos

### Indicadores
- Tentativas de extrair system prompt
- Pedidos para ignorar instrucoes
- Jailbreak attempts (DAN mode, etc.)

### Investigacao
1. Acessar LLM Observability > Traces
2. Filtrar por: @ml_app:dogbot-assistant
3. Verificar Security evaluations
4. Analisar payloads utilizados

### Acoes
- Verificar se houve vazamento de dados
- Avaliar se guardrails estao funcionando
- Considerar bloquear padrao se persistir

${var.slack_channel}
EOT

  query = "logs(\"service:chatbot-service (\\\"prompt injection\\\" OR jailbreak OR \\\"ignore instructions\\\" OR \\\"system prompt\\\" OR DAN)\").index(\"*\").rollup(\"count\").last(\"5m\") > 5"

  monitor_thresholds {
    critical = 5
    warning  = 2
  }

  notify_no_data = false

  tags = concat(local.common_tags, [
    "service:chatbot-service",
    "team:ai",
    "ml_app:dogbot-assistant",
    "severity:medium"
  ])
}

# =============================================================================
# Kafka Consumer Lag Alto
# =============================================================================
resource "datadog_monitor" "kafka_lag" {
  name    = "[DogBank] Kafka - Consumer Lag Alto"
  type    = "metric alert"
  message = <<-EOT
## Consumer lag alto no Kafka!

**Consumer Group**: pix-worker-group
**Lag**: {{value}} mensagens

### Impacto
PIX podem estar demorando para ser processados.

### Investigacao
1. Verificar se pix-worker esta rodando
2. Checar logs do pix-worker para erros
3. Verificar recursos (CPU/memoria)
4. Analisar throughput do Kafka

### Remediacao
- Escalar pix-worker se necessario
- Verificar se ha deadlocks no processamento
- Checar conexao com bancocentral-service

${var.slack_channel}
EOT

  query = "avg(last_5m):avg:kafka.consumer.lag{consumer_group:pix-worker-group,env:${var.environment}} > 1000"

  monitor_thresholds {
    critical = 1000
    warning  = 500
  }

  notify_no_data = false

  tags = concat(local.common_tags, [
    "service:pix-worker",
    "team:pix",
    "severity:high"
  ])
}

# =============================================================================
# RabbitMQ - Fila de Fraude Crescendo
# =============================================================================
resource "datadog_monitor" "rabbitmq_fraud_queue" {
  name    = "[DogBank] RabbitMQ - Fila de Fraude Crescendo"
  type    = "metric alert"
  message = <<-EOT
## Fila de fraude com muitas mensagens!

**Queue**: pix.fraud
**Mensagens**: {{value}}

### Impacto
Transacoes nao estao sendo validadas por fraude.

### Investigacao
1. Verificar fraud-detection-service esta rodando
2. Checar logs para erros
3. Verificar conexao com RabbitMQ

### Remediacao
- Reiniciar fraud-detection-service se necessario
- Escalar consumers

${var.slack_channel}
EOT

  query = "avg(last_5m):avg:rabbitmq.queue.messages{queue:pix.fraud,env:${var.environment}} > 500"

  monitor_thresholds {
    critical = 500
    warning  = 200
  }

  notify_no_data = false

  tags = concat(local.common_tags, [
    "service:fraud-detection-service",
    "team:security",
    "severity:high"
  ])
}

# =============================================================================
# PostgreSQL - Conexoes Esgotando
# =============================================================================
resource "datadog_monitor" "postgres_connections" {
  name    = "[DogBank] PostgreSQL - Conexoes Esgotando"
  type    = "metric alert"
  message = <<-EOT
## PostgreSQL com muitas conexoes!

**Conexoes ativas**: {{value}}

### Impacto
Servicos podem nao conseguir conectar ao banco.

### Investigacao
1. Identificar servico com mais conexoes
2. Verificar se ha connection leak
3. Checar pool de conexoes

### Remediacao
- Aumentar max_connections se necessario
- Reiniciar servico com leak
- Otimizar pool de conexoes

${var.slack_channel}
EOT

  query = "avg(last_5m):avg:postgresql.connections{env:${var.environment}} > 80"

  monitor_thresholds {
    critical = 80
    warning  = 60
  }

  notify_no_data = false

  tags = concat(local.common_tags, [
    "service:postgres",
    "team:platform",
    "severity:high"
  ])
}

# =============================================================================
# Servico Down (Health Check Falhando)
# =============================================================================
resource "datadog_monitor" "service_health" {
  name    = "[DogBank] Servico Down - Health Check Falhando"
  type    = "service check"
  message = <<-EOT
## Servico com health check falhando!

**Servico**: {{service.name}}

### Impacto
O servico pode estar indisponivel.

### Investigacao
1. Verificar logs do container
2. Checar se container esta rodando
3. Verificar recursos (CPU/memoria)
4. Checar dependencias

### Remediacao
- docker-compose restart <servico>
- Verificar se ha erro de inicializacao

${var.pagerduty_service}
EOT

  query = "\"http.can_connect\".over(\"env:${var.environment}\").by(\"host\",\"instance\",\"url\").last(2).count_by_status()"

  notify_no_data    = true
  no_data_timeframe = 5

  tags = concat(local.common_tags, [
    "team:sre",
    "severity:critical"
  ])
}

# =============================================================================
# MONITORS POR SERVICO - Para refletir no Service Map
# =============================================================================
# Estes monitors tem a tag service:xxx que faz o Service Map mudar de cor
# quando ha problemas no servico
# =============================================================================

# =============================================================================
# Transaction Service - Error Rate
# =============================================================================
resource "datadog_monitor" "transaction_service_error_rate" {
  name    = "[DogBank] Transaction Service - Error Rate > 5%"
  type    = "query alert"
  message = <<-EOT
## Transaction Service com taxa de erro alta!

**Taxa de erro**: {{value}}%
**Threshold**: Critical > 5%, Warning > 2%

### Impacto
Transacoes PIX podem estar falhando.

### Investigacao
1. Verificar logs de erro no Log Explorer
2. Analisar traces com erro no APM
3. Checar conexao com PostgreSQL
4. Verificar integracao com Kafka

### Runbook
Acesse o notebook de investigacao PIX no Datadog.

${var.slack_channel}
EOT

  query = "sum(last_5m):trace.servlet.request.errors{service:transaction-service,env:${var.environment}}.as_count() / sum:trace.servlet.request.hits{service:transaction-service,env:${var.environment}}.as_count() * 100 > 5"

  monitor_thresholds {
    critical = 5
    warning  = 2
  }

  notify_no_data    = false
  renotify_interval = 30

  tags = concat(local.common_tags, [
    "service:transaction-service",
    "team:dogbank-backend",
    "severity:high"
  ])
}

# =============================================================================
# Transaction Service - Latency P99
# =============================================================================
resource "datadog_monitor" "transaction_service_latency" {
  name    = "[DogBank] Transaction Service - Latency P99 > 1s"
  type    = "query alert"
  message = <<-EOT
## Transaction Service com latencia alta!

**Latencia P99**: {{value}}s
**Threshold**: Critical > 1s, Warning > 0.5s

### Impacto
Usuarios podem estar experimentando lentidao nas transacoes PIX.

### Investigacao
1. Verificar latencia do PostgreSQL
2. Checar latencia do Kafka
3. Analisar traces lentos no APM
4. Verificar recursos (CPU/memoria)

${var.slack_channel}
EOT

  query = "percentile(last_5m):p99:trace.servlet.request{service:transaction-service,env:${var.environment}} > 1"

  monitor_thresholds {
    critical = 1
    warning  = 0.5
  }

  notify_no_data    = false
  renotify_interval = 60

  tags = concat(local.common_tags, [
    "service:transaction-service",
    "team:dogbank-backend",
    "severity:high"
  ])
}

# =============================================================================
# Banco Central Service - Error Rate
# =============================================================================
resource "datadog_monitor" "bancocentral_service_error_rate" {
  name    = "[DogBank] Banco Central Service - Error Rate > 5%"
  type    = "query alert"
  message = <<-EOT
## Banco Central Service com taxa de erro alta!

**Taxa de erro**: {{value}}%
**Threshold**: Critical > 5%, Warning > 2%

### Impacto
Integracao com BACEN pode estar falhando. PIX podem nao ser liquidados.

### Investigacao
1. Verificar status da API do Banco Central (spi.bacen.gov.br)
2. Checar logs de erro do servico
3. Verificar certificados e autenticacao
4. Analisar traces no APM

### ATENCAO
Este servico e CRITICO para operacoes PIX!

${var.pagerduty_service}
EOT

  query = "sum(last_5m):trace.servlet.request.errors{service:bancocentral-service,env:${var.environment}}.as_count() / sum:trace.servlet.request.hits{service:bancocentral-service,env:${var.environment}}.as_count() * 100 > 5"

  monitor_thresholds {
    critical = 5
    warning  = 2
  }

  notify_no_data    = false
  renotify_interval = 30

  tags = concat(local.common_tags, [
    "service:bancocentral-service",
    "team:dogbank-backend",
    "severity:critical"
  ])
}

# =============================================================================
# Banco Central Service - Latency P99
# =============================================================================
resource "datadog_monitor" "bancocentral_service_latency" {
  name    = "[DogBank] Banco Central Service - Latency P99 > 1s"
  type    = "query alert"
  message = <<-EOT
## Banco Central Service com latencia alta!

**Latencia P99**: {{value}}s
**Threshold**: Critical > 1s, Warning > 0.5s

### Impacto
Transacoes PIX podem estar demorando para liquidar.

### Investigacao
1. Verificar latencia da API do Banco Central
2. Checar rede e conectividade
3. Analisar traces lentos no APM
4. Verificar se ha throttling do BACEN

${var.slack_channel}
EOT

  query = "percentile(last_5m):p99:trace.servlet.request{service:bancocentral-service,env:${var.environment}} > 1"

  monitor_thresholds {
    critical = 1
    warning  = 0.5
  }

  notify_no_data    = false
  renotify_interval = 60

  tags = concat(local.common_tags, [
    "service:bancocentral-service",
    "team:dogbank-backend",
    "severity:high"
  ])
}

# =============================================================================
# Auth Service - Error Rate
# =============================================================================
resource "datadog_monitor" "auth_service_error_rate" {
  name    = "[DogBank] Auth Service - Error Rate > 5%"
  type    = "query alert"
  message = <<-EOT
## Auth Service com taxa de erro alta!

**Taxa de erro**: {{value}}%
**Threshold**: Critical > 5%, Warning > 2%

### Impacto
Usuarios podem nao conseguir fazer login.

### Investigacao
1. Verificar conexao com Redis (cache de sessoes)
2. Checar logs de erro
3. Verificar se ha ataque de brute force
4. Analisar traces no APM

${var.slack_channel}
EOT

  query = "sum(last_5m):trace.servlet.request.errors{service:auth-service,env:${var.environment}}.as_count() / sum:trace.servlet.request.hits{service:auth-service,env:${var.environment}}.as_count() * 100 > 5"

  monitor_thresholds {
    critical = 5
    warning  = 2
  }

  notify_no_data    = false
  renotify_interval = 30

  tags = concat(local.common_tags, [
    "service:auth-service",
    "team:dogbank-backend",
    "severity:high"
  ])
}

# =============================================================================
# Auth Service - Latency P99
# =============================================================================
resource "datadog_monitor" "auth_service_latency" {
  name    = "[DogBank] Auth Service - Latency P99 > 1s"
  type    = "query alert"
  message = <<-EOT
## Auth Service com latencia alta!

**Latencia P99**: {{value}}s
**Threshold**: Critical > 1s, Warning > 0.5s

### Impacto
Login pode estar demorando para usuarios.

### Investigacao
1. Verificar latencia do Redis
2. Checar recursos do servico
3. Analisar traces lentos no APM

${var.slack_channel}
EOT

  query = "percentile(last_5m):p99:trace.servlet.request{service:auth-service,env:${var.environment}} > 1"

  monitor_thresholds {
    critical = 1
    warning  = 0.5
  }

  notify_no_data    = false
  renotify_interval = 60

  tags = concat(local.common_tags, [
    "service:auth-service",
    "team:dogbank-backend",
    "severity:medium"
  ])
}

# =============================================================================
# Account Service - Error Rate
# =============================================================================
resource "datadog_monitor" "account_service_error_rate" {
  name    = "[DogBank] Account Service - Error Rate > 5%"
  type    = "query alert"
  message = <<-EOT
## Account Service com taxa de erro alta!

**Taxa de erro**: {{value}}%
**Threshold**: Critical > 5%, Warning > 2%

### Impacto
Consulta de saldo e extrato podem estar falhando.

### Investigacao
1. Verificar conexao com PostgreSQL
2. Checar logs de erro
3. Analisar traces no APM

${var.slack_channel}
EOT

  query = "sum(last_5m):trace.servlet.request.errors{service:account-service,env:${var.environment}}.as_count() / sum:trace.servlet.request.hits{service:account-service,env:${var.environment}}.as_count() * 100 > 5"

  monitor_thresholds {
    critical = 5
    warning  = 2
  }

  notify_no_data    = false
  renotify_interval = 30

  tags = concat(local.common_tags, [
    "service:account-service",
    "team:dogbank-backend",
    "severity:high"
  ])
}

# =============================================================================
# Account Service - Latency P99
# =============================================================================
resource "datadog_monitor" "account_service_latency" {
  name    = "[DogBank] Account Service - Latency P99 > 1s"
  type    = "query alert"
  message = <<-EOT
## Account Service com latencia alta!

**Latencia P99**: {{value}}s
**Threshold**: Critical > 1s, Warning > 0.5s

### Impacto
Consultas de saldo podem estar lentas.

### Investigacao
1. Verificar queries lentas no PostgreSQL
2. Checar indices do banco
3. Analisar traces lentos no APM

${var.slack_channel}
EOT

  query = "percentile(last_5m):p99:trace.servlet.request{service:account-service,env:${var.environment}} > 1"

  monitor_thresholds {
    critical = 1
    warning  = 0.5
  }

  notify_no_data    = false
  renotify_interval = 60

  tags = concat(local.common_tags, [
    "service:account-service",
    "team:dogbank-backend",
    "severity:medium"
  ])
}

# =============================================================================
# PIX Worker - Error Rate
# =============================================================================
resource "datadog_monitor" "pix_worker_error_rate" {
  name    = "[DogBank] PIX Worker - Error Rate > 5%"
  type    = "query alert"
  message = <<-EOT
## PIX Worker com taxa de erro alta!

**Taxa de erro**: {{value}}%
**Threshold**: Critical > 5%, Warning > 2%

### Impacto
Processamento assincrono de PIX pode estar falhando.

### Investigacao
1. Verificar conexao com Kafka
2. Checar logs de erro do worker
3. Verificar conexao com PostgreSQL
4. Analisar consumer lag

${var.slack_channel}
EOT

  query = "sum(last_5m):trace.servlet.request.errors{service:pix-worker,env:${var.environment}}.as_count() / sum:trace.servlet.request.hits{service:pix-worker,env:${var.environment}}.as_count() * 100 > 5"

  monitor_thresholds {
    critical = 5
    warning  = 2
  }

  notify_no_data    = false
  renotify_interval = 30

  tags = concat(local.common_tags, [
    "service:pix-worker",
    "team:dogbank-backend",
    "severity:high"
  ])
}

# =============================================================================
# PIX Worker - Latency P99
# =============================================================================
resource "datadog_monitor" "pix_worker_latency" {
  name    = "[DogBank] PIX Worker - Latency P99 > 1s"
  type    = "query alert"
  message = <<-EOT
## PIX Worker com latencia alta no processamento!

**Latencia P99**: {{value}}s
**Threshold**: Critical > 1s, Warning > 0.5s

### Impacto
Transacoes PIX podem estar demorando para ser processadas.

### Investigacao
1. Verificar recursos do worker (CPU/memoria)
2. Checar latencia do PostgreSQL
3. Verificar throughput do Kafka
4. Analisar traces lentos

${var.slack_channel}
EOT

  query = "percentile(last_5m):p99:trace.servlet.request{service:pix-worker,env:${var.environment}} > 1"

  monitor_thresholds {
    critical = 1
    warning  = 0.5
  }

  notify_no_data    = false
  renotify_interval = 60

  tags = concat(local.common_tags, [
    "service:pix-worker",
    "team:dogbank-backend",
    "severity:high"
  ])
}

# =============================================================================
# Chatbot Service - Error Rate
# =============================================================================
resource "datadog_monitor" "chatbot_service_error_rate" {
  name    = "[DogBank] Chatbot Service - Error Rate > 5%"
  type    = "query alert"
  message = <<-EOT
## Chatbot Service com taxa de erro alta!

**Taxa de erro**: {{value}}%
**Threshold**: Critical > 5%, Warning > 2%

### Impacto
Atendimento automatizado pode estar falhando.

### Investigacao
1. Verificar conexao com Groq API (LLM)
2. Checar logs de erro do chatbot
3. Verificar guardrails e validacoes
4. Analisar LLM Observability

${var.slack_channel}
EOT

  query = "sum(last_5m):trace.flask.request.errors{service:chatbot-service,env:${var.environment}}.as_count() / sum:trace.flask.request.hits{service:chatbot-service,env:${var.environment}}.as_count() * 100 > 5"

  monitor_thresholds {
    critical = 5
    warning  = 2
  }

  notify_no_data    = false
  renotify_interval = 30

  tags = concat(local.common_tags, [
    "service:chatbot-service",
    "team:dogbank-ai",
    "ml_app:dogbot-assistant",
    "severity:medium"
  ])
}

# =============================================================================
# Chatbot Service - Latency P99
# =============================================================================
resource "datadog_monitor" "chatbot_service_latency" {
  name    = "[DogBank] Chatbot Service - Latency P99 > 3s"
  type    = "query alert"
  message = <<-EOT
## Chatbot Service com latencia alta!

**Latencia P99**: {{value}}s
**Threshold**: Critical > 3s, Warning > 2s

### Impacto
Respostas do chatbot podem estar demorando.

### Investigacao
1. Verificar latencia da Groq API
2. Checar se prompts estao muito longos
3. Analisar LLM Observability para token usage
4. Verificar recursos do servico

${var.slack_channel}
EOT

  query = "percentile(last_5m):p99:trace.flask.request{service:chatbot-service,env:${var.environment}} > 3"

  monitor_thresholds {
    critical = 3
    warning  = 2
  }

  notify_no_data    = false
  renotify_interval = 60

  tags = concat(local.common_tags, [
    "service:chatbot-service",
    "team:dogbank-ai",
    "ml_app:dogbot-assistant",
    "severity:medium"
  ])
}
