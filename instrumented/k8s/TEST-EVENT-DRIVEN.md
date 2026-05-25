# Teste - Arquitetura Event-Driven

## 🎯 Objetivo

Validar o fluxo completo: Transaction Service → Kafka → Cache Sync Service → Redis → Account Service

---

## ✅ Pré-requisitos

```bash
# 1. Verificar se todos os serviços estão rodando
kubectl get pods -n dogbank | grep -E "(transaction|account|cache-sync|kafka|redis)"

# Esperado:
# - transaction-service: Running (3-4 pods)
# - account-service: Running (3-4 pods)
# - cache-sync-service: Running (1 pod)
# - kafka-0: Running
# - redis: Running
```

---

## 🧪 Teste 1: Publicar Evento de Saldo (Manual)

### **Produzir evento manualmente no Kafka**

```bash
# Conectar ao pod Kafka
kubectl exec -it kafka-0 -n dogbank -- bash

# Publicar evento de saldo atualizado
/opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic banking.accounts \
  --property "parse.key=true" \
  --property "key.separator=:"

# Digite (Cole isso e pressione Enter):
4:{"event_type":"balance.updated","account_id":4,"delta":-50.00,"new_balance":16595.76,"reason":"test_event","transaction_id":"test-123","timestamp":"2026-02-05T16:00:00Z"}

# Ctrl+C para sair
```

### **Verificar no Redis**

```bash
# Verificar se o saldo foi atualizado no Redis
kubectl exec -n dogbank redis-895657877-tv45g -- redis-cli GET account:4:balance

# Esperado: 16595.76
```

### **Verificar logs do Cache Sync Service**

```bash
kubectl logs -n dogbank -l app=cache-sync-service --tail=20

# Esperado:
# 📨 Received event: balance.updated from topic=banking.accounts
# 📦 Updated Redis: account:4:balance = 16595.76
```

---

## 🧪 Teste 2: PIX End-to-End

### **1. Verificar saldo inicial**

```bash
curl https://lab.dogbank.dog/api/accounts/4 | jq '.balance'

# Anote o saldo atual
```

### **2. Fazer PIX de R$ 10**

```bash
curl -X POST https://lab.dogbank.dog/api/transactions/pix \
  -H "Content-Type: application/json" \
  -d '{
    "accountOriginId": 4,
    "pixKeyDestination": "pedro.silva@dogbank.com",
    "amount": 10.00
  }' | jq '.'

# Esperado:
# {
#   "id": 123,
#   "accountOriginId": 4,
#   "accountDestinationId": 2,
#   "amount": 10.00,
#   "type": "PIX",
#   "status": "COMPLETED",
#   ...
# }
```

### **3. Verificar eventos no Kafka**

```bash
# Consumir últimos eventos do tópico banking.accounts
kubectl exec -n dogbank kafka-0 -- /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic banking.accounts \
  --from-beginning \
  --max-messages 5

# Esperado: Ver 2 eventos balance.updated (origem e destino)

# Consumir últimos eventos do tópico banking.transactions
kubectl exec -n dogbank kafka-0 -- /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic banking.transactions \
  --from-beginning \
  --max-messages 5

# Esperado: Ver 1 evento pix.completed
```

### **4. Verificar Redis atualizado**

```bash
# Verificar saldo no Redis
kubectl exec -n dogbank redis-895657877-tv45g -- redis-cli GET account:4:balance

# Esperado: Saldo inicial - 10.00

# Verificar transações no Redis
kubectl exec -n dogbank redis-895657877-tv45g -- redis-cli ZRANGE account:4:transactions -5 -1

# Esperado: Ver últimas 5 transações em JSON
```

### **5. Consultar saldo via API (deve vir do Redis)**

```bash
curl https://lab.dogbank.dog/api/accounts/4 | jq '.'

# Verificar no Datadog APM:
# - Trace deve mostrar redis.get com latência <5ms
# - Log do account-service deve mostrar "Redis CACHE HIT"
```

### **6. Verificar logs de todos os serviços**

```bash
# Transaction Service (publicou eventos)
kubectl logs -n dogbank deployment/transaction-service --tail=50 | grep -E "(Published|balance.updated|pix.completed)"

# Esperado:
# 📤 Published balance.updated event to Kafka - account_id=4
# 📤 Published balance.updated event to Kafka - account_id=2
# 📤 Published pix.completed event to Kafka - transaction_id=123
# ✅ Published event-driven events for PIX transaction 123

# Cache Sync Service (consumiu eventos)
kubectl logs -n dogbank -l app=cache-sync-service --tail=50 | grep -E "(Received|Updated Redis)"

# Esperado:
# 📨 Received event: balance.updated from topic=banking.accounts partition=X offset=Y
# 📦 Updated Redis: account:4:balance = (novo saldo)
# 📨 Received event: balance.updated from topic=banking.accounts partition=X offset=Y
# 📦 Updated Redis: account:2:balance = (novo saldo)
# 📨 Received event: pix.completed from topic=banking.transactions partition=X offset=Y
# 📦 Added PIX_OUT transaction to account:4:transactions

# Account Service (leu do Redis)
kubectl logs -n dogbank deployment/account-service --tail=50 | grep -E "(Redis|CACHE)"

# Esperado:
# ✅ Redis CACHE HIT - account_id=4, balance=(saldo)
# ✅ Returned account with Redis cached balance - account_id=4, balance=(saldo)
```

---

## 🧪 Teste 3: Verificar Fallback (Redis Down)

### **1. Parar o Redis temporariamente**

```bash
kubectl scale deployment/redis -n dogbank --replicas=0

# Aguardar pod parar
kubectl get pods -n dogbank | grep redis
```

### **2. Consultar saldo (deve fazer fallback ao PostgreSQL)**

```bash
curl https://lab.dogbank.dog/api/accounts/4 | jq '.balance'

# Ainda funciona, mas com latência maior

# Verificar logs
kubectl logs -n dogbank deployment/account-service --tail=20 | grep -E "(Redis|CACHE)"

# Esperado:
# ⚠️ Redis CACHE MISS - account_id=4
# ⚠️ Redis cache miss, using PostgreSQL balance - account_id=4
```

### **3. Restaurar Redis**

```bash
kubectl scale deployment/redis -n dogbank --replicas=1

# Aguardar pod iniciar
kubectl wait --for=condition=ready pod -l app=redis -n dogbank --timeout=60s
```

---

## 🧪 Teste 4: Verificar Consumer Lag

### **1. Parar Cache Sync Service**

```bash
kubectl scale deployment/cache-sync-service -n dogbank --replicas=0
```

### **2. Fazer múltiplos PIX**

```bash
for i in {1..10}; do
  curl -X POST https://lab.dogbank.dog/api/transactions/pix \
    -H "Content-Type: application/json" \
    -d '{
      "accountOriginId": 4,
      "pixKeyDestination": "pedro.silva@dogbank.com",
      "amount": 1.00
    }'
  sleep 0.5
done
```

### **3. Verificar consumer lag**

```bash
kubectl exec -n dogbank kafka-0 -- /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe \
  --group cache-sync-service

# Esperado: LAG alto (10-30 mensagens)
```

### **4. Restaurar Cache Sync Service e ver lag zerar**

```bash
kubectl scale deployment/cache-sync-service -n dogbank --replicas=1

# Aguardar processar
sleep 5

# Verificar lag novamente
kubectl exec -n dogbank kafka-0 -- /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe \
  --group cache-sync-service

# Esperado: LAG = 0
```

---

## 📊 Verificar no Datadog

### **APM Trace do PIX**

1. Ir para **APM → Traces**
2. Filtrar: `service:transaction-service` AND `resource_name:POST /api/transactions/pix`
3. Abrir trace recente
4. Verificar spans:
   - `postgres.query` (UPDATE contas)
   - `kafka.send` (3x: 2x banking.accounts + 1x banking.transactions)
   - Total: ~150ms

### **APM Trace da Consulta**

1. Filtrar: `service:account-service` AND `resource_name:GET /api/accounts/:id`
2. Abrir trace recente
3. Verificar span:
   - `redis.command` (GET account:4:balance)
   - Latência: <5ms

### **Kafka Metrics**

1. Ir para **Infrastructure → Kafka**
2. Verificar:
   - Consumer lag: 0
   - Messages in/sec
   - Partitions saudáveis

### **Redis Metrics**

1. Ir para **Infrastructure → Redis**
2. Verificar:
   - Cache hit rate: >90%
   - Commands/sec
   - Memory usage
   - Latency p99: <5ms

---

## 🎯 Resultados Esperados

| Métrica | Antes (sem cache) | Depois (com cache) | Ganho |
|---------|-------------------|-------------------|-------|
| **Latência leitura (p99)** | 150ms | <5ms | **97% ↓** |
| **Throughput leituras** | 500 req/s | 50k+ req/s | **100x** |
| **Carga PostgreSQL** | 100% | 10% | **90% ↓** |
| **Disponibilidade** | 99.9% | 99.99% | **+0.09%** |
| **Event propagation** | N/A | <10ms | Real-time |

---

## ✅ Checklist de Validação

- [ ] Eventos publicados no Kafka após PIX
- [ ] Cache Sync Service consumindo eventos
- [ ] Redis atualizado em tempo real
- [ ] Account Service lendo do Redis (cache hit)
- [ ] Consumer lag = 0
- [ ] Fallback ao PostgreSQL funciona quando Redis down
- [ ] Traces APM completos no Datadog
- [ ] Métricas Kafka visíveis no Datadog
- [ ] Métricas Redis visíveis no Datadog
- [ ] Latência de leitura <5ms (p99)
