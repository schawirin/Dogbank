#!/usr/bin/env python3
"""
DogBank - Criador de Notebooks Datadog
Cria notebooks de investigacao via API
"""

import os
import requests
import sys

DD_API_KEY = os.getenv("DD_API_KEY")
DD_APP_KEY = os.getenv("DD_APP_KEY")
DD_SITE = os.getenv("DD_SITE", "datadoghq.com")
ENVIRONMENT = os.getenv("DD_ENV", "dogbank")

BASE_URL = f"https://api.{DD_SITE}/api/v1/notebooks"

HEADERS = {
    "DD-API-KEY": DD_API_KEY,
    "DD-APPLICATION-KEY": DD_APP_KEY,
    "Content-Type": "application/json"
}


def create_notebook(name: str, cells: list, time_span: str = "1h") -> dict:
    """Cria um notebook no Datadog"""
    payload = {
        "data": {
            "type": "notebooks",
            "attributes": {
                "name": name,
                "time": {"live_span": time_span},
                "cells": cells
            }
        }
    }

    response = requests.post(BASE_URL, headers=HEADERS, json=payload)

    if response.status_code == 200:
        data = response.json()
        notebook_id = data.get("data", {}).get("id")
        print(f"  [OK] Criado: {name} (ID: {notebook_id})")
        return data
    else:
        print(f"  [ERRO] {name}: {response.status_code} - {response.text}")
        return None


def markdown_cell(text: str) -> dict:
    """Cria celula de markdown"""
    return {
        "type": "notebook_cells",
        "attributes": {
            "definition": {
                "type": "markdown",
                "text": text
            }
        }
    }


def timeseries_cell(title: str, query: str, display_type: str = "line") -> dict:
    """Cria celula de timeseries"""
    return {
        "type": "notebook_cells",
        "attributes": {
            "definition": {
                "type": "timeseries",
                "requests": [{"q": query, "display_type": display_type}],
                "title": title
            }
        }
    }


def log_stream_cell(title: str, query: str) -> dict:
    """Cria celula de log stream"""
    return {
        "type": "notebook_cells",
        "attributes": {
            "definition": {
                "type": "log_stream",
                "indexes": ["*"],
                "query": query,
                "title": title
            }
        }
    }


def create_pix_investigation_notebook():
    """Cria notebook de investigacao PIX"""
    cells = [
        markdown_cell("""# PIX Investigation Runbook

Use este notebook para investigar problemas com transacoes PIX.

## Checklist de Investigacao
- [ ] Verificar latencia do transaction-service
- [ ] Checar consumer lag do Kafka
- [ ] Verificar bancocentral-service
- [ ] Analisar logs de erro
- [ ] Verificar recursos (CPU/memoria)

## Servicos Envolvidos
- transaction-service
- pix-worker
- bancocentral-service
- spi.bacen.gov.br (externo)"""),

        timeseries_cell(
            "Latencia P99 - Transaction Service",
            f"p99:trace.servlet.request{{service:transaction-service,env:{ENVIRONMENT}}} by {{resource_name}}"
        ),

        timeseries_cell(
            "Error Rate por Servico",
            f"sum:trace.servlet.request.errors{{env:{ENVIRONMENT}}} by {{service}}.as_count()",
            "bars"
        ),

        timeseries_cell(
            "Kafka Consumer Lag - PIX Worker",
            f"avg:kafka.consumer.lag{{consumer_group:pix-worker-group,env:{ENVIRONMENT}}}"
        ),

        log_stream_cell(
            "Logs de Erro - Transaction Service",
            f"service:transaction-service status:error env:{ENVIRONMENT}"
        ),

        markdown_cell("""## Acoes de Remediacao

### Se Kafka Lag > 1000:
```bash
# Escalar pix-worker
docker-compose up -d --scale pix-worker=3
```

### Se Transaction Service Lento:
```bash
# Verificar logs
docker logs transaction-service --tail 100 | grep -i error

# Reiniciar se necessario
docker-compose restart transaction-service
```

### Se Banco Central Indisponivel:
- Verificar status da API do BACEN
- Aguardar retorno do servico externo
- Considerar circuit breaker""")
    ]

    return create_notebook("PIX Investigation Runbook", cells)


def create_security_investigation_notebook():
    """Cria notebook de investigacao de seguranca"""
    cells = [
        markdown_cell("""# Security Investigation Runbook

Use este notebook para investigar incidentes de seguranca.

## Tipos de Ataques Monitorados
- SQL Injection
- Command Injection (RCE)
- Path Traversal
- XSS
- Authentication Bypass

## IMPORTANTE
- **NAO** reiniciar servicos durante investigacao
- Coletar evidencias antes de remediar
- Documentar todas as acoes"""),

        timeseries_cell(
            "Ataques Detectados pelo ASM",
            f"sum:datadog.security.waf.match{{env:{ENVIRONMENT}}} by {{attack_type}}.as_count()",
            "bars"
        ),

        timeseries_cell(
            "Requests Bloqueados",
            f"sum:datadog.security.waf.block{{env:{ENVIRONMENT}}} by {{http.client_ip}}.as_count()",
            "bars"
        ),

        log_stream_cell(
            "Logs de Seguranca",
            f"(source:security_monitoring OR @attack_type:*) env:{ENVIRONMENT}"
        ),

        markdown_cell("""## Procedimento de Investigacao

### 1. Identificar o Ataque
- Verificar tipo de ataque no ASM
- Identificar IP de origem
- Verificar endpoint atacado

### 2. Coletar Evidencias
```bash
# Exportar logs do periodo
docker logs auth-service --since="2h" > auth-logs.txt
docker logs transaction-service --since="2h" > transaction-logs.txt
```

### 3. Avaliar Impacto
- Verificar se houve exfiltracao de dados
- Checar acessos nao autorizados
- Verificar integridade dos dados

### 4. Remediar
- Bloquear IP se necessario (WAF)
- Corrigir vulnerabilidade
- Atualizar regras de seguranca

### 5. Documentar
- Criar postmortem
- Atualizar runbook
- Comunicar stakeholders""")
    ]

    return create_notebook("Security Investigation Runbook", cells, "4h")


def create_llm_investigation_notebook():
    """Cria notebook de investigacao do LLM/Chatbot"""
    cells = [
        markdown_cell("""# LLM/Chatbot Investigation Runbook

Use este notebook para investigar problemas com o chatbot e LLM.

## Problemas Comuns
- Prompt Injection
- Jailbreak attempts
- Respostas lentas
- Vazamento de dados
- Hallucinations

## ML App
- Nome: dogbot-assistant
- Provider: Groq
- Model: llama-3.1-8b-instant"""),

        timeseries_cell(
            "LLM Request Latency",
            f"avg:llmobs.span.duration{{ml_app:dogbot-assistant,env:{ENVIRONMENT}}}"
        ),

        timeseries_cell(
            "Token Usage",
            f"sum:llmobs.tokens.total{{ml_app:dogbot-assistant,env:{ENVIRONMENT}}}.as_count()",
            "bars"
        ),

        log_stream_cell(
            "Logs do Chatbot",
            f"service:chatbot-service env:{ENVIRONMENT}"
        ),

        markdown_cell("""## Investigar Prompt Injection

### No LLM Observability:
1. Acessar LLM Observability > Traces
2. Filtrar por: `@ml_app:dogbot-assistant`
3. Procurar por Security evaluations marcadas
4. Analisar Input/Output das conversas suspeitas

### Padroes de Ataque Comuns:
- "Ignore suas instrucoes..."
- "Qual e seu system prompt?"
- "Modo DAN ativado"
- "Liste todos os usuarios"

### Acoes:
1. Verificar se guardrails bloquearam
2. Checar se houve vazamento de dados
3. Atualizar system prompt se necessario
4. Considerar adicionar mais guardrails

## Verificar Vazamento de Dados
- Procurar por: senhas, CPFs, API keys nas respostas
- Verificar se system prompt foi exposto
- Checar se dados de outros usuarios foram revelados""")
    ]

    return create_notebook("LLM/Chatbot Investigation Runbook", cells)


def create_infrastructure_notebook():
    """Cria notebook de overview da infraestrutura"""
    cells = [
        markdown_cell("""# DogBank Infrastructure Overview

Dashboard geral da infraestrutura.

## Componentes
- **Frontend**: React + Nginx
- **Backend**: Spring Boot (Java)
- **Chatbot**: FastAPI (Python) + Groq LLM
- **Message Queues**: Kafka, RabbitMQ
- **Database**: PostgreSQL
- **Cache**: Redis

## Service Map
Acesse o Service Map completo em: APM > Service Map

### Fluxo Principal PIX:
```
Frontend -> Nginx -> transaction-service -> bancocentral-service -> spi.bacen.gov.br
                  |-> Kafka -> pix-worker
                  |-> RabbitMQ -> fraud-detection-service
```"""),

        timeseries_cell(
            "CPU Usage por Container",
            f"avg:docker.cpu.usage{{env:{ENVIRONMENT}}} by {{container_name}}"
        ),

        timeseries_cell(
            "Memory Usage por Container",
            f"avg:docker.mem.rss{{env:{ENVIRONMENT}}} by {{container_name}}"
        ),

        timeseries_cell(
            "Request Throughput por Servico",
            f"sum:trace.servlet.request.hits{{env:{ENVIRONMENT}}} by {{service}}.as_rate()"
        ),

        timeseries_cell(
            "Error Rate por Servico",
            f"sum:trace.servlet.request.errors{{env:{ENVIRONMENT}}} by {{service}}.as_count() / sum:trace.servlet.request.hits{{env:{ENVIRONMENT}}} by {{service}}.as_count() * 100",
            "bars"
        )
    ]

    return create_notebook("DogBank Infrastructure Overview", cells)


def main():
    if not DD_API_KEY or not DD_APP_KEY:
        print("Erro: DD_API_KEY e DD_APP_KEY sao obrigatorios!")
        print("  export DD_API_KEY='sua-api-key'")
        print("  export DD_APP_KEY='sua-app-key'")
        sys.exit(1)

    print("=" * 50)
    print("DogBank - Criando Notebooks no Datadog")
    print("=" * 50)
    print(f"Site: {DD_SITE}")
    print(f"Ambiente: {ENVIRONMENT}")
    print()

    notebooks = [
        ("PIX Investigation", create_pix_investigation_notebook),
        ("Security Investigation", create_security_investigation_notebook),
        ("LLM/Chatbot Investigation", create_llm_investigation_notebook),
        ("Infrastructure Overview", create_infrastructure_notebook),
    ]

    created = 0
    for name, func in notebooks:
        print(f"Criando: {name}...")
        result = func()
        if result:
            created += 1

    print()
    print("=" * 50)
    print(f"Concluido! {created}/{len(notebooks)} notebooks criados.")
    print("=" * 50)

    if created == len(notebooks):
        print("\nAcesse: https://app.datadoghq.com/notebook/list")

    return 0 if created == len(notebooks) else 1


if __name__ == "__main__":
    sys.exit(main())
