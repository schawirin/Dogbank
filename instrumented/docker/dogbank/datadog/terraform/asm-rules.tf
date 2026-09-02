# =============================================================================
# Datadog Application Security Management (ASM) - Detection Rules
# =============================================================================
# Configura regras de detecção e bloqueio automático para atacantes.
#
# O DogBank recebe o IP demonstrado pelo EvilDog em X-Forwarded-For. O tracer
# normaliza esse valor em @http.client_ip; @network.client.ip é o peer da rede
# do container e, em compose, agrupa todos os agentes sob o mesmo IP interno.
# Use @http.client_ip em toda regra cuja identidade seja o atacante.
# Baseado nos padrões de ataque do security_attacker.py
# =============================================================================

# NOTA: Descomente o provider Datadog no main.tf antes de aplicar este arquivo
# Você precisará configurar DATADOG_APP_KEY além do API_KEY

# =============================================================================
# SQL Injection Detection
# =============================================================================
resource "datadog_security_monitoring_rule" "sql_injection" {
  name    = "[DogBank Demo] SQL Injection bem-sucedido — resposta imediata"
  message = "DogBank SQL Injection bem-sucedido do IP {{@http.client_ip}}. Bloqueie este IP e repita a pipeline para validar o HTTP 403 da AAP."
  enabled = true

  query {
    query           = "@appsec.security_activity:* env:dogbank service:transaction-service @appsec.type:sql_injection @appsec.category:attack_attempt @http.status_code:200"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
  }

  case {
    status    = "critical"
    condition = "> 0"
    name      = "SQLi confirmou acesso ao endpoint vulnerável"
  }

  options {
    evaluation_window   = 60  # sinal na primeira tentativa da demo
    keep_alive          = 60  # não esconde novos takes por uma hora
    max_signal_duration = 600
  }

  tags = ["security:sql-injection", "env:dogbank", "attack:database", "demo:evildog"]
}

# =============================================================================
# Remote Code Execution (RCE) Detection
# =============================================================================
resource "datadog_security_monitoring_rule" "rce_detection" {
  name    = "DogBank - Remote Code Execution Attempt"
  message = "🚨 CRITICAL: RCE attempt from {{@http.client_ip}}. Command: {{@appsec.security.payload}}. Block immediately!"
  enabled = true

  query {
    query           = "@appsec.type:command_injection @appsec.category:attack_attempt"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
  }

  case {
    status    = "critical"
    condition = "> 0" # Block on first attempt
    name      = "RCE attempt detected"
  }

  options {
    evaluation_window   = 60 # 1 minute
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:rce", "env:dogbank", "attack:critical"]
}

# =============================================================================
# Log4Shell Exploitation Detection
# =============================================================================
resource "datadog_security_monitoring_rule" "log4shell" {
  name    = "DogBank - Log4Shell Exploitation Attempt (CVE-2021-44228)"
  message = "🚨 CRITICAL: Log4Shell (Log4j RCE) detected from {{@http.client_ip}}. JNDI payload: {{@appsec.security.payload}}"
  enabled = true

  query {
    query           = "@appsec.type:log4shell OR @http.url:*jndi* OR @appsec.security.payload:*jndi:ldap*"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
  }

  case {
    status    = "critical"
    condition = "> 0"
    name      = "Log4Shell JNDI injection"
  }

  options {
    evaluation_window   = 60
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:log4shell", "env:dogbank", "cve:2021-44228", "attack:critical"]
}

# =============================================================================
# Path Traversal Detection
# =============================================================================
resource "datadog_security_monitoring_rule" "path_traversal" {
  name    = "DogBank - Path Traversal Attack"
  message = "Path traversal attempt from {{@http.client_ip}}. Path: {{@http.url_details.path}}"
  enabled = true

  query {
    query           = "@appsec.type:path_traversal @appsec.category:attack_attempt"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
  }

  case {
    status    = "high"
    condition = "> 5"
    name      = "Multiple path traversal attempts"
  }

  case {
    status    = "medium"
    condition = "> 0"
    name      = "Path traversal attempt"
  }

  options {
    evaluation_window   = 300
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:path-traversal", "env:dogbank", "attack:file-system"]
}

# =============================================================================
# Cross-Site Scripting (XSS) Detection
# =============================================================================
resource "datadog_security_monitoring_rule" "xss_detection" {
  name    = "DogBank - XSS Attack Detected"
  message = "XSS attempt from {{@http.client_ip}}. Payload: {{@appsec.security.payload}}"
  enabled = true

  query {
    query           = "@appsec.type:xss @appsec.category:attack_attempt"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
  }

  case {
    status    = "medium"
    condition = "> 3"
    name      = "Multiple XSS attempts"
  }

  case {
    status    = "low"
    condition = "> 0"
    name      = "XSS attempt"
  }

  options {
    evaluation_window   = 300
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:xss", "env:dogbank", "attack:client-side"]
}

# =============================================================================
# Authentication Bypass Detection
# =============================================================================
resource "datadog_security_monitoring_rule" "auth_bypass" {
  name    = "DogBank - Authentication Bypass Attempt"
  message = "Auth bypass attempt from {{@http.client_ip}}. Endpoint: {{@http.url}}"
  enabled = true

  query {
    query           = "@appsec.type:authentication_bypass @appsec.category:attack_attempt"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
  }

  case {
    status    = "high"
    condition = "> 2"
    name      = "Multiple auth bypass attempts"
  }

  case {
    status    = "medium"
    condition = "> 0"
    name      = "Auth bypass attempt"
  }

  options {
    evaluation_window   = 300
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:auth-bypass", "env:dogbank", "attack:authentication"]
}

# =============================================================================
# IDOR (Insecure Direct Object Reference) Detection
# =============================================================================
resource "datadog_security_monitoring_rule" "idor_detection" {
  name    = "DogBank - IDOR Attack Detected"
  message = "IDOR attempt from {{@http.client_ip}}. Suspicious account access pattern detected."
  enabled = true

  query {
    query           = "@appsec.type:idor @appsec.category:attack_attempt OR (@http.status_code:403 @http.url:*/accounts/*)"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
  }

  case {
    status    = "high"
    condition = "> 10"
    name      = "Multiple IDOR attempts"
  }

  case {
    status    = "medium"
    condition = "> 5"
    name      = "IDOR enumeration"
  }

  options {
    evaluation_window   = 300
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:idor", "env:dogbank", "attack:authorization"]
}

# =============================================================================
# Attacker Bot Detection (User-Agent based)
# =============================================================================
resource "datadog_security_monitoring_rule" "attacker_bot" {
  name    = "DogBank - Known Attack Bot Detected"
  message = "Known attack bot detected: {{@http.useragent}} from {{@http.client_ip}}"
  enabled = true

  query {
    query           = "@http.useragent:*DogBank-Attacker* OR @http.useragent:*Security Testing Bot*"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
  }

  case {
    status    = "high"
    condition = "> 0"
    name      = "Attack bot identified"
  }

  options {
    evaluation_window   = 60
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:bot", "env:dogbank", "attack:automated"]
}

# =============================================================================
# ACCOUNT TAKEOVER (ATO) - Credential Stuffing
# =============================================================================
# Depende de o auth-service emitir users.login.success/failure via EventTrackerV2.
# Veja AuthController.java -> tracker.trackLoginSuccessEvent / trackLoginFailureEvent.
resource "datadog_security_monitoring_rule" "credential_stuffing" {
  name    = "DogBank - Credential Stuffing (ATO)"
  message = "🚨 Credential stuffing detectado de {{@http.client_ip}} contra serviço auth-service. Volume de falhas excedeu o threshold. Considere bloquear IP e revisar contas afetadas."
  enabled = true

  query {
    query           = "@appsec.events.users.login.failure.usr.exists:true service:auth-service"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
    name            = "failures"
  }

  query {
    query           = "@appsec.events.users.login.success service:auth-service"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
    name            = "successes"
  }

  case {
    status    = "critical"
    condition = "failures > 20 && successes >= 1"
    name      = "Credential stuffing succeeded (login.success after many failures)"
  }

  case {
    status    = "high"
    condition = "failures > 20"
    name      = "Credential stuffing in progress (high failure rate)"
  }

  options {
    evaluation_window   = 600 # 10 minutes
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:ato", "env:dogbank", "attack:credential-stuffing", "tactic:credential-access"]
}

# =============================================================================
# ATO - High-value PIX after login (business logic)
# =============================================================================
# Correlaciona login.success com PIX > R$ 5.000 em <120s pelo mesmo usuario.
resource "datadog_security_monitoring_rule" "highvalue_pix_after_login" {
  name    = "DogBank - High-value PIX after login"
  message = "💸 PIX de alto valor detectado logo após login do usuário {{@usr.id}}. Possível account takeover. IP de origem: {{@http.client_ip}}."
  enabled = true

  query {
    query           = "@evt.name:users.login.success service:auth-service"
    aggregation     = "count"
    group_by_fields = ["@usr.id"]
    name            = "logins"
  }

  query {
    query           = "service:transaction-service @http.url:*api/transactions/pix* @transaction.amount:>5000"
    aggregation     = "count"
    group_by_fields = ["@usr.id"]
    name            = "high_pix"
  }

  case {
    status    = "high"
    condition = "logins >= 1 && high_pix >= 1"
    name      = "Login + PIX alto valor pelo mesmo usuario"
  }

  options {
    evaluation_window   = 300 # 5 minutes (menor valor permitido > 60)
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:ato", "env:dogbank", "attack:business-logic", "tactic:exfiltration"]
}

# =============================================================================
# ATO - Login from new geo/ASN
# =============================================================================
# Login bem-sucedido vindo de pais != BR (perfil esperado dos usuarios DogBank).
resource "datadog_security_monitoring_rule" "login_new_geo" {
  name    = "DogBank - Login from unexpected geo"
  message = "🌍 Login bem-sucedido fora do Brasil para usuário {{@usr.id}}. IP {{@http.client_ip}} de {{@network.client.geoip.country.iso_code}}. Verificar se é o usuário real."
  enabled = true

  query {
    query           = "@evt.name:users.login.success service:auth-service -@network.client.geoip.country.iso_code:BR"
    aggregation     = "count"
    group_by_fields = ["@usr.id", "@network.client.geoip.country.iso_code"]
  }

  case {
    status    = "medium"
    condition = "> 0"
    name      = "Login de país inesperado"
  }

  options {
    evaluation_window   = 300
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:ato", "env:dogbank", "attack:suspicious-login", "tactic:initial-access"]
}

# =============================================================================
# Post-exploit authenticated action (composite)
# =============================================================================
# Mesmo IP gera signal de SQLi/RCE/Log4Shell E em seguida faz acao autenticada.
# Indica que o exploit pode ter conseguido tomar a conta.
resource "datadog_security_monitoring_rule" "post_exploit_auth_action" {
  name    = "DogBank - Post-exploit authenticated action"
  message = "🚨 CRITICAL: IP {{@http.client_ip}} disparou exploit (SQLi/RCE/Log4Shell) e em seguida realizou ação autenticada. Possível kill-chain de account takeover via vulnerabilidade. Bloquear IP imediatamente!"
  enabled = true

  query {
    query           = "@appsec.type:(sql_injection OR command_injection OR log4shell) @appsec.category:attack_attempt"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
    name            = "exploits"
  }

  query {
    query           = "@evt.name:users.login.success OR @http.url:*api/transactions/pix*"
    aggregation     = "count"
    group_by_fields = ["@http.client_ip"]
    name            = "auth_action"
  }

  case {
    status    = "critical"
    condition = "exploits >= 1 && auth_action >= 1"
    name      = "Exploit + acao autenticada do mesmo IP"
  }

  options {
    evaluation_window   = 300 # 5 minutes
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:ato", "env:dogbank", "attack:critical", "tactic:lateral-movement"]
}

# =============================================================================
# Salami slicing / money-mule fan-in (micro-PIX para conta laranja)
# =============================================================================
# Padrão "salami slicing": muitas contas de origem enviam micro-valores (R$1) para
# UMA chave PIX laranja (fan-in). Caso real: Michael Largent (2008) — script desviou
# micro-depósitos de ~58k contas (~US$50k), detectado pela monitoração dos bancos.
# Aqui detectamos o mesmo padrão em tempo real no transaction-service (evento
# PIX_CONCLUIDO com @chave_pix da laranja e @valor_numerico baixo).
resource "datadog_security_monitoring_rule" "salami_slicing_mule" {
  name    = "DogBank - Salami slicing / money-mule fan-in (micro-PIX)"
  message = <<-EOT
💰 Fan-in de micro-PIX detectado para a chave laranja `evildog@dogbank.com`.
Padrão clássico de **salami slicing** (ref. caso Michael Largent, 2008: ~US$50k
desviados de ~58k contas em micro-depósitos, detectado pela monitoração dos bancos).
O volume de micro-transferências (≤ R$ 2) para uma única chave excedeu o threshold.
Ação: congelar a conta destino, revisar as contas de origem e abrir investigação de fraude.
EOT
  enabled = true

  query {
    query           = "service:transaction-service @evento:PIX_CONCLUIDO @chave_pix:evildog@dogbank.com @valor_numerico:<2"
    aggregation     = "count"
    group_by_fields = ["@chave_pix"]
    name            = "micro_pix"
  }

  case {
    status    = "high"
    condition = "micro_pix > 15"
    name      = "Fan-in massivo de micro-PIX (robô de salami slicing)"
  }

  case {
    status    = "medium"
    condition = "micro_pix > 5"
    name      = "Fan-in suspeito de micro-PIX para conta laranja"
  }

  options {
    evaluation_window   = 300 # 5 minutes
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:fraud", "env:dogbank", "attack:salami-slicing", "tactic:collection", "case:largent-2008"]
}

# =============================================================================
# IP rotation / evasão de bloqueio (o atacante rotaciona IPs contra a MESMA vuln)
# =============================================================================
# Um mesmo padrão de ataque (SQLi no validate-pix-key) chegando de MUITOS IPs
# distintos em pouco tempo = atacante rotacionando IPs para evadir o bloqueio da AAP.
# Mensagem para o Blue Team: bloquear IP é gato-e-rato — o fix definitivo é FECHAR a
# vulnerabilidade (query parametrizada no endpoint), não perseguir IPs.
resource "datadog_security_monitoring_rule" "ip_rotation_sqli" {
  name    = "DogBank - IP rotation / block evasion (SQLi)"
  message = <<-EOT
🕳️ Rotação de IPs detectada contra o endpoint vulnerável `validate-pix-key`.
O mesmo ataque (SQL Injection) está chegando de MUITOS IPs de origem distintos num curto
intervalo — o atacante está trocando de IP para evadir o bloqueio da App & API Protection.

Bloquear IP é **gato-e-rato**: a mitigação definitiva é **fechar a vulnerabilidade**
(parametrizar a query do endpoint `validate-pix-key`), somada a WAF em modo bloqueio e rate limit.
EOT
  enabled = true

  query {
    query       = "service:transaction-service (@http.url_details.path:*validate-pix-key* OR @appsec.type:sql_injection)"
    aggregation = "cardinality"
    metrics     = ["@http.client_ip"]
    name        = "distinct_ips"
  }

  case {
    status    = "high"
    condition = "distinct_ips > 5"
    name      = "Rotação de IPs contra a vuln (evasão de bloqueio)"
  }

  case {
    status    = "medium"
    condition = "distinct_ips > 2"
    name      = "Múltiplos IPs de origem no endpoint vulnerável"
  }

  options {
    evaluation_window   = 300 # 5 minutes
    keep_alive          = 3600
    max_signal_duration = 86400
  }

  tags = ["security:evasion", "env:dogbank", "attack:ip-rotation", "tactic:defense-evasion", "cwe:89"]
}

# =============================================================================
# IP Blocking Policy (Requires Datadog Remote Configuration)
# =============================================================================
# NOTA: O bloqueio automático de IPs requer:
# 1. Datadog Remote Configuration habilitado no Agent
# 2. ASM Protection habilitado no Datadog
# 3. Criar IP Blocking Policy via UI ou API
#
# Para habilitar:
# 1. Vá em: https://app.datadoghq.com/security/configuration/asm/ip-blocking
# 2. Crie regra: "Block IPs with 'critical' or 'high' severity signals"
# 3. Duração: 24 horas
# 4. Ação: Block + Redirect to custom page
# =============================================================================

# =============================================================================
# Outputs
# =============================================================================
output "asm_rules_created" {
  description = "Lista de regras ASM criadas"
  value = {
    sql_injection             = "SQL Injection Detection (High severity after 3 attempts)"
    rce                       = "Remote Code Execution (Critical on first attempt)"
    log4shell                 = "Log4Shell CVE-2021-44228 (Critical immediately)"
    path_traversal            = "Path Traversal (High after 5 attempts)"
    xss                       = "XSS Detection (Medium after 3 attempts)"
    auth_bypass               = "Auth Bypass (High after 2 attempts)"
    idor                      = "IDOR Detection (High after 10 attempts)"
    attacker_bot              = "Known Attack Bot (High immediately)"
    credential_stuffing       = "ATO: Credential Stuffing (High @ failures>20, Critical se +sucesso)"
    highvalue_pix_after_login = "ATO: PIX > R$5k em <2min apos login (High)"
    login_new_geo             = "ATO: Login fora do BR (Medium)"
    post_exploit_auth_action  = "ATO: Exploit + acao autenticada do mesmo IP (Critical)"
    salami_slicing_mule       = "Fraud: fan-in de micro-PIX p/ conta laranja (High @ >15, Medium @ >5) — caso Largent 2008"
    ip_rotation_sqli          = "Evasion: rotação de IPs contra a vuln SQLi (High @ >5 IPs distintos) — discurso: fechar a vuln"
  }
}

output "next_steps" {
  description = "Próximos passos para ativar bloqueio automático"
  value       = <<-EOT

  ✅ Detection Rules criadas com sucesso!

  Para ativar o BLOQUEIO AUTOMÁTICO de IPs:

  1. Habilite Remote Configuration no Datadog Agent:
     - Adicione 'remote_configuration.enabled: true' no DatadogAgent CR

  2. Configure IP Blocking Policy:
     - URL: https://app.datadoghq.com/security/configuration/asm/ip-blocking
     - Regra: "Block IPs with signals severity >= high"
     - Duração: 24 horas
     - Ação: Block + Log

  3. Verifique os IPs flagados em:
     - https://app.datadoghq.com/security/appsec/inventory

  EOT
}
