# Transaction Service Runbook

**Team**: pix
**Criticidade**: Critica
**SLO**: 99.95% disponibilidade, P99 latencia < 2s

## Sintomas Comuns

### PIX Falhando em Massa
**Impacto**: Usuarios nao conseguem fazer transferencias
**Severidade**: P1

**Investigacao**:
1. Verificar status do Banco Central (bancocentral-service)
2. Checar se Kafka esta processando mensagens
3. Verificar saldo das contas de origem

**Remediacao**:
```bash
# Verificar saude do Kafka
docker exec dogbank-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:29092 --list

# Verificar consumer lag
docker logs dogbank-pix-worker --tail 50

# Verificar bancocentral
curl -s http://localhost:8085/actuator/health
```

### Alta Latencia em Transferencias
**Impacto**: PIX demorando mais que 10s
**Severidade**: P2

**Investigacao**:
1. Verificar latencia do bancocentral-service
2. Checar metricas do Kafka (throughput)
3. Verificar se ha deadlocks no PostgreSQL

**Remediacao**:
```bash
# Verificar metricas de latencia
docker stats transaction-service

# Verificar fila Kafka
docker exec dogbank-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:29092 \
  --describe --group pix-worker-group

# Reiniciar workers se consumer lag > 1000
docker-compose restart pix-worker
```

### Erro de Saldo Insuficiente em Massa
**Impacto**: Muitos PIX rejeitados
**Severidade**: P3

**Investigacao**:
1. Verificar se houve debito indevido
2. Checar logs de account-service
3. Verificar consistencia entre cache e banco

**Remediacao**:
```bash
# Verificar saldo no banco
docker exec dogbank-postgres psql -U dogbank -c \
  "SELECT cpf, saldo FROM contas ORDER BY saldo ASC LIMIT 10;"

# Limpar cache se inconsistente
docker exec dogbank-redis redis-cli FLUSHALL
```

### Transacao Bloqueada por COAF
**Impacto**: PIX >= R$ 50.000 requer verificacao
**Severidade**: P4 (comportamento esperado)

**Investigacao**:
1. Verificar se valor esta correto (>= 50000)
2. Confirmar que alerta COAF foi gerado

**Remediacao**:
- Nenhuma acao necessaria (comportamento esperado)
- Contatar compliance se for falso positivo

## Metricas Chave

- `pix.transferencia.sucesso`
- `pix.transferencia.falha`
- `pix.validacao.banco_central`
- `kafka.consumer.lag{consumer_group:pix-worker-group}`
- `trace.servlet.request.duration{service:transaction-service}`

## Dependencias

- PostgreSQL (banco de dados)
- Kafka (fila de mensagens)
- bancocentral-service (validacao PIX)
- account-service (saldos)

## Contato

- Slack: #pix-oncall
- Email: pix@dogbank.com
