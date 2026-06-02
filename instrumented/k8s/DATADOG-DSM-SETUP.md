# Datadog Data Stream Monitoring (DSM) - Kafka

## 🎯 O que é Data Stream Monitoring?

Data Stream Monitoring (DSM) é uma feature do Datadog que rastreia mensagens através de sistemas de streaming (Kafka, RabbitMQ, SQS, etc.) fornecendo:

- **Latência End-to-End**: Tempo desde a produção até o consumo da mensagem
- **Consumer Lag**: Atraso entre produção e consumo
- **Throughput**: Mensagens/segundo por tópico e partição
- **Path Tracking**: Visualização do caminho completo da mensagem através dos serviços
- **Bottleneck Detection**: Identificação de gargalos no pipeline de dados

---

## ✅ Configuração Implementada

### **1. Kafka - Annotations DSM**

```yaml
annotations:
  ad.datadoghq.com/kafka.check_names: '["kafka"]'
  ad.datadoghq.com/kafka.init_configs: '[{}]'
  ad.datadoghq.com/kafka.instances: |
    [
      {
        "host": "%%host%%",
        "port": 9092,
        "kafka_connect_str": ["%%host%%:9092"],
        "kafka_consumer_offsets": true,
        "consumer_groups": true,
        "monitor_unlisted_consumer_groups": true,
        "data_streams_enabled": true,
        "tags": [
          "env:dogbank",
          "service:kafka",
          "cluster_name:dogbank-kafka"
        ]
      }
    ]
```

**Configurações importantes:**
- `data_streams_enabled: true` - Habilita DSM
- `consumer_groups: true` - Monitora consumer groups
- `monitor_unlisted_consumer_groups: true` - Monitora todos os groups
- `cluster_name:dogbank-kafka` - Identifica o cluster

### **2. Kafka - JMX Metrics**

```yaml
env:
  - name: KAFKA_JMX_OPTS
    value: "-Dcom.sun.management.jmxremote -Dcom.sun.management.jmxremote.authenticate=false -Dcom.sun.management.jmxremote.ssl=false -Djava.rmi.server.hostname=127.0.0.1 -Dcom.sun.management.jmxremote.port=9999 -Dcom.sun.management.jmxremote.rmi.port=9999"
  - name: JMX_PORT
    value: "9999"
```

**Configurações importantes:**
- Porta JMX: 9999
- Sem autenticação (ambiente interno)
- Sem SSL (ambiente interno)

### **3. Transaction Service (Produtor) - DSM Enabled**

```yaml
env:
  - name: DD_DATA_STREAMS_ENABLED
    value: "true"
  - name: DD_ENV
    value: "dogbank"
  - name: DD_SERVICE
    value: "transaction-service"
```

**O que isso faz:**
- Instrumenta automaticamente o Kafka Producer (Spring Kafka)
- Adiciona headers DSM nas mensagens
- Rastreia produção de mensagens com timestamps

### **4. Cache Sync Service (Consumidor) - DSM Enabled**

```yaml
env:
  - name: DD_DATA_STREAMS_ENABLED
    value: "true"
  - name: DD_ENV
    value: "dogbank"
  - name: DD_SERVICE
    value: "cache-sync-service"
```

**O que isso faz:**
- Instrumenta automaticamente o Kafka Consumer (kafka-python)
- Lê headers DSM das mensagens
- Rastreia consumo de mensagens com timestamps
- Calcula latência end-to-end

---

## 🔍 Como Verificar se DSM está Funcionando

### **1. No Datadog UI**

Acesse: https://app.datadoghq.com/data-streams

Você verá:
- **Data Streams Explorer**: Mapa visual do fluxo de dados
- **Services**: transaction-service → kafka → cache-sync-service
- **Topics**: banking.accounts, banking.transactions
- **Latency**: Latência end-to-end por tópico
- **Throughput**: Mensagens/segundo

### **2. Verificar Métricas DSM**

```bash
# No Datadog Metrics Explorer, busque por:
data_streams.kafka.lag_seconds          # Lag em segundos
data_streams.kafka.lag_messages         # Lag em número de mensagens
data_streams.latency                    # Latência end-to-end
data_streams.kafka.in_messages          # Mensagens entrando
data_streams.kafka.out_messages         # Mensagens saindo
```

### **3. Verificar Headers DSM nas Mensagens**

```bash
# Consumir mensagem e ver headers
kubectl exec -n dogbank kafka-0 -- /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic banking.accounts \
  --from-beginning \
  --max-messages 1 \
  --property print.headers=true

# Você deve ver headers como:
# dd_data_streams_ctx:<base64>
# dd_trace_id:<trace_id>
# dd_span_id:<span_id>
```

### **4. Verificar Logs do Datadog Agent**

```bash
# Ver se o Agent está coletando métricas DSM
kubectl logs -n dogbank -l app=datadog-agent | grep -i "data.streams\|dsm"
```

---

## 📊 Métricas DSM Importantes

### **Latência**

| Métrica | Descrição | Threshold |
|---------|-----------|-----------|
| `data_streams.latency` | Tempo desde produção até consumo | < 100ms (ideal) |
| `data_streams.kafka.lag_seconds` | Lag em segundos | < 1s (ideal) |
| `data_streams.kafka.lag_messages` | Número de mensagens em atraso | < 10 (ideal) |

### **Throughput**

| Métrica | Descrição | Uso |
|---------|-----------|-----|
| `data_streams.kafka.in_messages` | Mensagens entrando no tópico | Monitorar carga |
| `data_streams.kafka.out_messages` | Mensagens sendo consumidas | Detectar problemas de consumo |
| `kafka.net.bytes_in` | Bytes entrando | Monitorar tamanho das mensagens |

### **Consumer Health**

| Métrica | Descrição | Threshold |
|---------|-----------|-----------|
| `kafka.consumer_lag` | Lag do consumer group | < 100 (ideal) |
| `kafka.consumer.records_consumed_rate` | Taxa de consumo | Deve ser > taxa de produção |
| `kafka.consumer.commit_latency_avg` | Latência de commit | < 50ms (ideal) |

---

## 🎬 Demo - Visualizando DSM

### **Passo 1: Fazer um PIX**

```bash
curl -X POST https://lab.dogbank.dog/api/transactions/pix \
  -H "Content-Type: application/json" \
  -d '{
    "accountOriginId": 4,
    "pixKeyDestination": "pedro.silva@dogbank.com",
    "amount": 10.00
  }'
```

### **Passo 2: Abrir Data Streams Explorer**

1. Acesse: https://app.datadoghq.com/data-streams
2. Selecione o cluster: `dogbank-kafka`
3. Visualize o fluxo:

```
transaction-service (producer)
  ↓ banking.accounts (topic)
  ↓ Partition 0, 1, ou 2
cache-sync-service (consumer)
  ↓ Redis update
```

### **Passo 3: Analisar Latência**

No Data Streams Explorer:
- **Producer Latency**: Tempo de transaction-service até Kafka
- **Broker Latency**: Tempo que a mensagem fica no Kafka
- **Consumer Latency**: Tempo do Kafka até cache-sync-service processar
- **End-to-End**: Soma de todas as latências

**Esperado:**
- Producer: ~5ms
- Broker: <1ms
- Consumer: ~10ms
- **Total: ~15-20ms** 🚀

### **Passo 4: Verificar Consumer Lag**

```bash
# Via kubectl
kubectl exec -n dogbank kafka-0 -- /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe \
  --group cache-sync-service

# Esperado: LAG = 0 (ou próximo de 0)
```

---

## 🚨 Alertas Recomendados

### **1. High Consumer Lag**

```yaml
Monitor: Data Stream Lag
Metric: data_streams.kafka.lag_seconds
Condition: avg(last_5m) > 5
Alert Message: |
  🚨 Alto lag no consumer group: {{consumer_group.name}}
  Topic: {{topic}}
  Lag: {{value}} segundos

  Possíveis causas:
  - Cache-sync-service lento
  - Volume alto de mensagens
  - Kafka indisponível

  @slack-alerts @pagerduty
```

### **2. High End-to-End Latency**

```yaml
Monitor: Data Stream Latency
Metric: data_streams.latency
Condition: p95(last_10m) > 1000
Alert Message: |
  ⚠️ Alta latência end-to-end no pipeline Kafka
  Service: {{service}}
  Topic: {{topic}}
  P95 Latency: {{value}}ms

  @slack-alerts
```

### **3. Consumer Not Consuming**

```yaml
Monitor: Consumer Inactive
Metric: kafka.consumer.records_consumed_rate
Condition: sum(last_5m) == 0
Alert Message: |
  🔴 Consumer parou de consumir mensagens!
  Consumer Group: {{consumer_group.name}}
  Topic: {{topic}}

  @slack-alerts @pagerduty-critical
```

---

## 🎯 Benefícios do DSM

### **1. Visibilidade End-to-End**

Antes do DSM:
- ❌ Não sabe quanto tempo mensagens levam para serem processadas
- ❌ Difícil identificar gargalos
- ❌ Lag descoberto apenas quando usuários reclamam

Com DSM:
- ✅ Latência end-to-end visível em tempo real
- ✅ Identificação imediata de gargalos
- ✅ Alertas proativos antes de afetar usuários

### **2. Troubleshooting Rápido**

**Cenário:** Usuário reclama que saldo não atualiza

Sem DSM:
1. Verificar logs do transaction-service ❌
2. Verificar logs do Kafka ❌
3. Verificar logs do cache-sync-service ❌
4. Verificar Redis ❌
**Tempo: 30+ minutos**

Com DSM:
1. Abrir Data Streams Explorer ✅
2. Ver lag alto no consumer ✅
3. Identificar problema: cache-sync-service lento ✅
**Tempo: 2 minutos**

### **3. Capacity Planning**

DSM mostra:
- Throughput atual vs capacidade
- Padrões de consumo (picos, vales)
- Quando escalar (antes de dar problema)

---

## 📚 Referências

- [Datadog Data Stream Monitoring](https://docs.datadoghq.com/data_streams/)
- [DSM for Kafka](https://docs.datadoghq.com/data_streams/kafka/)
- [Kafka Integration](https://docs.datadoghq.com/integrations/kafka/)
- [DSM Best Practices](https://docs.datadoghq.com/data_streams/best_practices/)

---

## ✅ Checklist de Implementação

- [x] Kafka com autodiscovery configurado
- [x] `data_streams_enabled: true` no Kafka check
- [x] JMX habilitado no Kafka (porta 9999)
- [x] `DD_DATA_STREAMS_ENABLED=true` no transaction-service (produtor)
- [x] `DD_DATA_STREAMS_ENABLED=true` no cache-sync-service (consumidor)
- [x] Kafka, transaction-service, cache-sync-service reiniciados
- [ ] Verificar métricas DSM no Datadog
- [ ] Testar com PIX real
- [ ] Criar dashboard DSM
- [ ] Configurar alertas de lag
