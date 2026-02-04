# Fraud Detection Service Runbook

**Team**: security
**Criticidade**: Alta
**SLO**: 99.9% disponibilidade, P99 latencia < 500ms

## Sintomas Comuns

### Fila de Fraude Crescendo
**Impacto**: PIX nao sendo validado por fraude
**Severidade**: P1

**Investigacao**:
1. Verificar consumer do RabbitMQ
2. Checar se servico esta processando mensagens
3. Verificar metricas de throughput

**Remediacao**:
```bash
# Verificar fila RabbitMQ
curl -s -u dogbank:dog1234 http://localhost:15672/api/queues/dogbank/pix.fraud

# Verificar logs
docker logs dogbank-fraud-detection --tail 50

# Escalar consumers se necessario
docker-compose up -d --scale fraud-detection-service=3
```

### Muitos Falsos Positivos
**Impacto**: PIX legitimos sendo bloqueados
**Severidade**: P2

**Investigacao**:
1. Verificar regras de fraude
2. Checar threshold de score
3. Analisar padroes de transacoes bloqueadas

**Remediacao**:
```bash
# Ajustar threshold no codigo ou config
# Atualmente: score > 0.7 = fraude

# Verificar transacoes bloqueadas
docker exec dogbank-postgres psql -U dogbank -c \
  "SELECT * FROM transacoes WHERE status = 'FRAUD_BLOCKED' ORDER BY data DESC LIMIT 10;"
```

### Conexao RabbitMQ Perdida
**Impacto**: Servico nao consome mensagens
**Severidade**: P1

**Investigacao**:
1. Verificar saude do RabbitMQ
2. Checar credenciais
3. Verificar network entre containers

**Remediacao**:
```bash
# Verificar RabbitMQ
docker exec dogbank-rabbitmq rabbitmq-diagnostics -q ping

# Verificar conexoes
curl -s -u dogbank:dog1234 http://localhost:15672/api/connections

# Reiniciar servico
docker-compose restart fraud-detection-service
```

## Metricas Chave

- `rabbitmq.queue.messages{queue:pix.fraud}`
- `fraud.detection.score`
- `fraud.detection.blocked.count`
- `trace.spring.request.duration{service:fraud-detection-service}`

## Dependencias

- RabbitMQ (fila de mensagens)
- transaction-service (envia transacoes)

## Contato

- Slack: #security-oncall
- Email: security@dogbank.com
