# Chatbot Service Runbook

**Team**: ai
**Criticidade**: Media
**SLO**: 99% disponibilidade, P99 latencia < 5s

## Sintomas Comuns

### Chatbot Nao Responde
**Impacto**: Assistente virtual indisponivel
**Severidade**: P3

**Investigacao**:
1. Verificar se GROQ_API_KEY esta configurada
2. Checar conexao com API do Groq/OpenAI
3. Verificar logs do chatbot-service

**Remediacao**:
```bash
# Verificar saude do servico
curl -s http://localhost:8083/api/chatbot/health

# Verificar logs
docker logs chatbot-service --tail 50

# Testar API do LLM
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"

# Reiniciar se necessario
docker-compose restart chatbot-service
```

### Respostas Lentas do LLM
**Impacto**: Chatbot demora > 10s para responder
**Severidade**: P3

**Investigacao**:
1. Verificar latencia da API Groq/OpenAI
2. Checar se modelo esta correto (llama-3.1-8b-instant)
3. Verificar metricas no Datadog LLM Observability

**Remediacao**:
```bash
# Trocar para modelo mais rapido se necessario
# Editar .env: OPENAI_MODEL=llama-3.1-8b-instant

# Ou usar Ollama local
# OPENAI_API_BASE_URL=http://ollama:11434/v1
# OPENAI_MODEL=llama3.2:1b
```

### Prompt Injection Detectado
**Impacto**: Tentativa de ataque ao LLM
**Severidade**: P2

**Investigacao**:
1. Verificar logs para payload malicioso
2. Checar se houve exfiltracao de dados
3. Verificar Datadog ASM/LLM Obs

**Remediacao**:
```bash
# NAO reiniciar durante investigacao
# Notificar equipe de seguranca
# Bloquear IP se necessario
```

### LLM Desabilitado (sem API Key)
**Impacto**: Chatbot usa respostas pre-definidas
**Severidade**: P4 (comportamento esperado)

**Investigacao**:
1. Verificar se GROQ_API_KEY esta vazia no .env
2. Confirmar que respostas pre-definidas estao funcionando

**Remediacao**:
```bash
# Adicionar API key ao .env
echo "OPENAI_API_KEY=gsk_..." >> .env
docker-compose restart chatbot-service
```

## Metricas Chave

- `llmobs.request.duration{ml_app:dogbot-assistant}`
- `llmobs.tokens.total{ml_app:dogbot-assistant}`
- `trace.fastapi.request.duration{service:chatbot-service}`

## Dependencias

- Groq API (LLM provider)
- auth-service (autenticacao)
- account-service (consulta saldo)

## Contato

- Slack: #ai-oncall
- Email: ai@dogbank.com
