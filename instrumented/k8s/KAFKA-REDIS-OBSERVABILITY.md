# Observabilidade Kafka e Redis - Datadog

## 🎯 Overview

Configuração de observabilidade completa para Kafka e Redis usando Datadog Agent com autodiscovery.

---

## 📊 Datadog Agent - Autodiscovery

O Datadog Agent já está configurado com autodiscovery para detectar automaticamente Kafka e Redis no Kubernetes.

### **Annotations para Kafka** (kafka.yaml)

```yaml
annotations:
  ad.datadoghq.com/kafka.check_names: '["kafka"]'
  ad.datadoghq.com/kafka.init_configs: '[{}]'
  ad.datadoghq.com/kafka.instances: |
    [
      {
        "kafka_connect_str": ["localhost:9092"],
        "kafka_consumer_offsets": true,
        "tags": ["env:dogbank", "service:kafka"]
      }
    ]
  ad.datadoghq.com/kafka.logs: '[{"source":"kafka","service":"kafka","tags":["env:dogbank"]}]'
```

### **Annotations para Redis** (redis.yaml)

```yaml
annotations:
  ad.datadoghq.com/redis.check_names: '["redis"]'
  ad.datadoghq.com/redis.init_configs: '[{}]'
  ad.datadoghq.com/redis.instances: |
    [
      {
        "host": "localhost",
        "port": 6379,
        "tags": ["env:dogbank", "service:redis"]
      }
    ]
  ad.datadoghq.com/redis.logs: '[{"source":"redis","service":"redis","tags":["env:dogbank"]}]'
```

---

## 📈 Métricas Kafka Monitoradas

### **Consumer Metrics** (cache-sync-service)

```
kafka.consumer_lag                    # Lag do consumer por partição
kafka.consumer.records_consumed_rate  # Taxa de consumo de mensagens
kafka.consumer.fetch_latency_avg      # Latência média de fetch
kafka.consumer.commit_latency_avg     # Latência de commit
kafka.consumer.bytes_consumed_rate    # Taxa de bytes consumidos
```

### **Producer Metrics** (transaction-service)

```
kafka.producer.record_send_rate       # Taxa de envio de mensagens
kafka.producer.request_latency_avg    # Latência média de request
kafka.producer.record_error_rate      # Taxa de erros
kafka.producer.compression_rate       # Taxa de compressão
```

### **Broker Metrics**

```
kafka.net.bytes_in                    # Bytes recebidos
kafka.net.bytes_out                   # Bytes enviados
kafka.request.fetch.time.avg          # Tempo médio de fetch
kafka.request.produce.time.avg        # Tempo médio de produce
kafka.replication.isr_shrinks         # Shrinks do ISR (problemas)
```

### **Topic Metrics**

```
kafka.log.size                        # Tamanho do log por tópico
kafka.log.segment_count               # Número de segmentos
kafka.messages_in                     # Mensagens entrando
```

---

## 📊 Métricas Redis Monitoradas

### **Performance Metrics**

```
redis.net.commands                    # Comandos executados/sec
redis.net.clients                     # Clientes conectados
redis.stats.keyspace_hits             # Cache hits
redis.stats.keyspace_misses           # Cache misses
redis.stats.evicted_keys              # Keys evicted por memória
```

### **Memory Metrics**

```
redis.mem.used                        # Memória usada
redis.mem.rss                         # Resident Set Size
redis.mem.peak                        # Pico de memória
redis.mem.fragmentation_ratio         # Fragmentação
```

### **Persistence Metrics**

```
redis.rdb.last_save_time              # Último save
redis.rdb.changes_since_last_save     # Changes desde último save
```

### **Latency Metrics**

```
redis.command.latency.avg             # Latência média por comando
redis.slowlog.length                  # Tamanho do slow log
```

---

## 🔍 APM Traces - Event-Driven Architecture

### **Trace Completo: PIX Transaction**

```
Frontend
  ↓ POST /api/transactions/pix
Transaction Service (transaction-service)
  ├─→ PostgreSQL (write - saldo origem e destino)
  │   └─ Span: "postgres.query" (UPDATE contas)
  ├─→ Kafka Producer (publish events)
  │   ├─ Span: "kafka.produce" → banking.accounts (balance.updated origem)
  │   ├─ Span: "kafka.produce" → banking.accounts (balance.updated destino)
  │   └─ Span: "kafka.produce" → banking.transactions (pix.completed)
  └─ Response: Transaction ID

Kafka (propagação assíncrona)
  ↓
Cache Sync Service (cache-sync-service)
  ├─→ Kafka Consumer (poll)
  │   └─ Span: "kafka.consume" (process_event)
  └─→ Redis (update cache)
      ├─ Span: "redis.set" → account:4:balance
      ├─ Span: "redis.set" → account:2:balance
      └─ Span: "redis.zadd" → account:*:transactions

Account Service (account-service) - Query
  └─→ Redis (read - cache hit!)
      └─ Span: "redis.get" → account:4:balance (<5ms)
```

### **Tags de APM Importantes**

```yaml
# Tags automáticas do Datadog APM
env: dogbank
service: transaction-service | account-service | cache-sync-service
version: 1.0

# Tags customizadas nos eventos
kafka.topic: banking.accounts | banking.transactions
kafka.partition: 0-2
kafka.offset: offset_number
kafka.consumer_group: cache-sync-service

redis.command: GET | SET | ZADD
redis.key: account:*:balance | account:*:transactions
redis.cache_hit: true | false

event_type: balance.updated | pix.completed | pix.failed
account_id: account_id_number
transaction_id: transaction_uuid
```

---

## 📊 Dashboards Recomendados no Datadog

### **1. Event-Driven Architecture Overview**

**Widgets:**
- **Kafka Consumer Lag** (Timeseries)
  - Métrica: `kafka.consumer_lag`
  - Filtro: `service:cache-sync-service`
  - Threshold: Alert se > 100

- **Kafka Throughput** (Query Value)
  - Métrica: `kafka.consumer.records_consumed_rate`
  - Agregação: Sum

- **Redis Cache Hit Rate** (Query Value)
  - Fórmula: `(redis.stats.keyspace_hits / (redis.stats.keyspace_hits + redis.stats.keyspace_misses)) * 100`
  - Formato: Percentage

- **Event Processing Latency** (Heatmap)
  - Trace Analytics: `service:cache-sync-service`
  - Resource: `process_*` functions

### **2. Kafka Health Dashboard**

**Widgets:**
- **Consumer Lag por Partição** (Timeseries by partition)
- **Messages Published per Topic** (Timeseries stacked)
- **Producer Errors** (Timeseries)
- **Broker Disk Usage** (Query Value)

### **3. Redis Performance Dashboard**

**Widgets:**
- **Commands per Second** (Timeseries)
- **Memory Usage** (Timeseries)
- **Cache Hit Rate** (Timeseries)
- **Slow Commands** (Top List from logs)

---

## 🚨 Monitors (Alertas)

### **1. Kafka Consumer Lag Alto**

```yaml
Monitor Type: Metric
Metric: kafka.consumer_lag
Condition: avg(last_5m) > 100
Alert Message: |
  🚨 Kafka consumer lag alto para {{consumer_group.name}}
  Partição: {{partition}}
  Lag atual: {{value}}

  Cache pode estar desatualizado!

  @slack-alerts @pagerduty
```

### **2. Redis Cache Miss Rate Alto**

```yaml
Monitor Type: Metric
Formula: (redis.stats.keyspace_misses / (redis.stats.keyspace_hits + redis.stats.keyspace_misses)) * 100
Condition: avg(last_10m) > 20
Alert Message: |
  ⚠️ Redis cache miss rate alto: {{value}}%

  Possíveis causas:
  - Cache não sincronizado
  - Keys evicted por memória
  - Cache-sync-service down

  @slack-alerts
```

### **3. Kafka Producer Errors**

```yaml
Monitor Type: Metric
Metric: kafka.producer.record_error_rate
Condition: sum(last_5m) > 0
Alert Message: |
  ❌ Erros ao publicar eventos no Kafka
  Service: {{service}}
  Topic: {{topic}}
  Error rate: {{value}}

  @slack-alerts @pagerduty
```

### **4. Redis Unavailable**

```yaml
Monitor Type: Service Check
Check: redis.can_connect
Condition: is failing for 1 minute
Alert Message: |
  🔴 Redis indisponível!
  Host: {{host}}

  Fallback para PostgreSQL ativo, mas com alta latência.

  @slack-alerts @pagerduty-critical
```

---

## 🔧 Comandos de Verificação

### **Verificar Kafka Consumer Lag**

```bash
kubectl exec -n dogbank kafka-0 -- /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe \
  --group cache-sync-service
```

### **Verificar Redis Keys**

```bash
# Verificar saldo no cache
kubectl exec -n dogbank redis-895657877-tv45g -- redis-cli GET account:4:balance

# Verificar transações no cache
kubectl exec -n dogbank redis-895657877-tv45g -- redis-cli ZRANGE account:4:transactions 0 -1

# Verificar estatísticas
kubectl exec -n dogbank redis-895657877-tv45g -- redis-cli INFO stats

# Verificar slow log
kubectl exec -n dogbank redis-895657877-tv45g -- redis-cli SLOWLOG GET 10
```

### **Verificar Logs do Cache Sync Service**

```bash
kubectl logs -n dogbank -l app=cache-sync-service -f --tail=50
```

---

## 🎬 Demo Script - Observabilidade

### **1. Mostrar Arquitetura Event-Driven (2min)**

- Abrir Datadog APM Service Map
- Mostrar fluxo: Transaction → Kafka → Cache Sync → Redis → Account
- Destacar latências: PostgreSQL (100ms) vs Redis (<5ms)

### **2. Executar PIX e Acompanhar Trace (3min)**

```bash
# Fazer PIX de R$ 50
curl -X POST https://lab.dogbank.dog/api/transactions/pix \
  -H "Content-Type: application/json" \
  -d '{
    "accountOriginId": 4,
    "pixKeyDestination": "pedro.silva@dogbank.com",
    "amount": 50.00
  }'

# No Datadog:
# 1. Abrir APM Trace do PIX
# 2. Mostrar spans:
#    - PostgreSQL write (UPDATE contas)
#    - 3x Kafka produce (2x balance.updated + 1x pix.completed)
#    - Cache Sync: Kafka consume + Redis sets
# 3. Verificar latência end-to-end: ~150ms
```

### **3. Consultar Saldo e Mostrar Cache Hit (2min)**

```bash
# Consultar saldo (vem do Redis)
curl https://lab.dogbank.dog/api/accounts/4

# No Datadog:
# 1. Abrir APM Trace da consulta
# 2. Mostrar span: redis.get (account:4:balance)
# 3. Verificar latência: <5ms
# 4. Comparar com query PostgreSQL anterior: 97% mais rápido
```

### **4. Mostrar Métricas Kafka e Redis (3min)**

```bash
# Dashboard no Datadog:
# 1. Kafka Consumer Lag: 0ms (tempo real)
# 2. Kafka Throughput: X msgs/sec
# 3. Redis Cache Hit Rate: >95%
# 4. Redis Latency p99: <5ms
# 5. Redis Memory Usage: X MB
```

---

## 📚 Links Úteis

- [Datadog Kafka Integration](https://docs.datadoghq.com/integrations/kafka/)
- [Datadog Redis Integration](https://docs.datadoghq.com/integrations/redis/)
- [Datadog APM Distributed Tracing](https://docs.datadoghq.com/tracing/)
- [Kafka Monitoring Best Practices](https://kafka.apache.org/documentation/#monitoring)
- [Redis Monitoring](https://redis.io/docs/management/optimization/latency/)

---

## ✅ Checklist de Implementação

- [x] Datadog Agent configurado com autodiscovery
- [x] Kafka annotations para monitoramento
- [x] Redis annotations para monitoramento
- [x] Cache Sync Service com APM
- [x] Transaction Service publicando eventos
- [x] Account Service lendo do Redis
- [ ] Dashboards criados no Datadog
- [ ] Monitors configurados
- [ ] Runbook de troubleshooting documentado
