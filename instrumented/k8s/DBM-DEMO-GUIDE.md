# Guia de Demo do Datadog Database Monitoring (DBM)

## 🎯 Objetivo

Este guia demonstra as capacidades avançadas do Datadog DBM através de cenários realistas de problemas de banco de dados que ocorrem em produção.

## 📋 O Que Foi Implementado

### 1. DB Chaos Generator (`db_chaos_generator.py`)

Script que monitora transações PIX e **injeta problemas de banco de dados** quando valores específicos são detectados:

| Valor da Transação | Problema Gerado | Visível no DBM |
|-------------------|-----------------|----------------|
| **R$ 7777.77** | 🔒 **Blocking Query** | Lock prolongado (10-30s) em múltiplas linhas |
| **R$ 8888.88** | 🐌 **Slow Query** | Full table scan, JOIN complexo sem índices |
| **R$ 9999.99** | 💀 **Deadlock** | Deadlock intencional entre duas transações |
| **R$ 6666.66** | ⏰ **Waiting Query** | Query aguardando lock de outra transação |

### 2. Load Generator Atualizado

O `load_generator.py` agora inclui novos cenários que automaticamente criam transações com os valores específicos:

**Novas Probabilidades:**
- 10% chance de criar DB Lock (R$ 7777.77)
- 8% chance de criar Slow Query (R$ 8888.88)
- 5% chance de criar Deadlock (R$ 9999.99)
- 2% chance de criar Waiting Query (R$ 6666.66)

## 🚀 Como Usar

### Deployment no Kubernetes

#### 1. Rebuild e Deploy do Load Generator

```bash
cd /Users/pedro.schawirin/Documents/Dogbank/instrumented/docker/dogbank/load-generator

# Build nova imagem
docker build -t dogbank/load-generator:latest .

# Tag para registry (se estiver usando)
docker tag dogbank/load-generator:latest <registry>/dogbank/load-generator:latest
docker push <registry>/dogbank/load-generator:latest

# Restart do pod para usar nova imagem
kubectl rollout restart deployment/load-generator -n dogbank
```

#### 2. Verificar Logs

```bash
# Logs do Load Generator (transações)
kubectl logs -n dogbank deployment/load-generator -f | grep -E "DB_LOCK|SLOW|DEADLOCK|WAIT"

# Exemplo de output:
# 🔒 [DB_LOCK] Pedro Silva -> João Santos: R$ 7777.77 (TRIGGER DB LOCK)
# 🐌 [SLOW_QUERY] Vitoria Itadori -> Eliane Oliveira: R$ 8888.88 (TRIGGER SLOW QUERY)
# 💀 [DEADLOCK] Emiliano Costa -> Patricia Souza: R$ 9999.99 (TRIGGER DEADLOCK)
```

#### 3. Monitorar DB Chaos Generator

```bash
# Logs do DB Chaos Generator (ações no PostgreSQL)
kubectl logs -n dogbank deployment/load-generator -f | grep -E "DBM-"

# Exemplo de output:
# 🔒 [DBM-LOCK] Iniciando transação bloqueante por 15s...
# 🐌 [DBM-SLOW] Executando slow query (full table scan)...
# 💀 [DBM-DEADLOCK] Criando deadlock intencional...
```

## 📊 Visualizando no Datadog DBM

### 1. Acesse o Database Monitoring

**URL**: https://app.datadoghq.com/databases

**Filtros**:
- Database: `dogbank`
- Host: `postgres`

### 2. Seções a Verificar

#### A. Blocking Queries 🔒
**Quando**: Após transações de R$ 7777.77

**O que ver**:
- Queries bloqueando outras por 10-30 segundos
- `SELECT ... FOR UPDATE` na tabela `accounts`
- Múltiplas queries esperando (waiting queries)
- Max Block Time > 10s

**Exemplo de Query Bloqueante**:
```sql
SELECT id, balance, cpf
FROM accounts
WHERE balance > 5000
FOR UPDATE;
```

#### B. Slow Queries 🐌
**Quando**: Após transações de R$ 8888.88

**O que ver**:
- Query duration > 2s
- Full table scan indicators
- JOIN complexo sem índices otimizados
- Execution plan mostrando Sequential Scan

**Exemplo de Slow Query**:
```sql
SELECT a.id, a.cpf, a.balance, u.name, u.email
FROM accounts a
JOIN users u ON CAST(a.user_id AS TEXT) LIKE '%' || CAST(u.id AS TEXT) || '%'
WHERE LOWER(u.email) LIKE '%dogbank%'
  AND a.balance::text LIKE '%0%'
  AND LENGTH(u.name) > 5
ORDER BY RANDOM()
LIMIT 100;
```

**Insights do Datadog**:
- "Add index on accounts(balance)"
- "JOIN condition not optimized"
- "Consider materialized view"

#### C. Deadlocks 💀
**Quando**: Após transações de R$ 9999.99

**O que ver**:
- Deadlock events no gráfico
- Duas transações travadas mutuamente
- Rollback automático de uma transação
- Event log: "deadlock detected"

**Fluxo do Deadlock**:
1. TX1: Lock em `accounts.id = 1`
2. TX2: Lock em `accounts.id = 2`
3. TX1: Tenta lock em `accounts.id = 2` (WAIT)
4. TX2: Tenta lock em `accounts.id = 1` (DEADLOCK!)
5. PostgreSQL detecta e faz rollback de TX2

#### D. Waiting Queries ⏰
**Quando**: Após transações de R$ 6666.66

**O que ver**:
- Queries em estado "waiting"
- Wait time > 10s
- Lock wait events
- Blocked by other transaction

**Cenário**:
- Background thread mantém lock em `accounts.id = 3`
- Query foreground tenta acessar mesma linha
- Query espera até lock ser liberado

### 3. Query Samples

No DBM, você verá **Query Samples** detalhados:

**Para cada query problemática**:
- ✅ SQL statement completo
- ✅ Execution plan (EXPLAIN)
- ✅ Duration (P50, P95, P99)
- ✅ Rows examined vs returned
- ✅ Lock wait time
- ✅ Transaction ID
- ✅ User/Application que executou

### 4. Explain Plans

Click em qualquer slow query para ver:

**PostgreSQL EXPLAIN**:
```
Seq Scan on accounts  (cost=0.00..100.50 rows=500)
  Filter: ((balance)::text ~~ '%0%'::text)
Planning Time: 0.123 ms
Execution Time: 2456.789 ms
```

**Datadog Insights**:
- 🔴 "Sequential scan on large table"
- 🟡 "Add index: CREATE INDEX idx_balance ON accounts(balance)"
- 🟡 "Consider partitioning by balance range"

## 🎬 Roteiro de Demonstração

### Cenário 1: Blocking Queries (5 min)

1. **Setup**: Abra DBM → Blocking Queries tab
2. **Trigger**: Faça transação de R$ 7777.77:
   ```bash
   # Via load generator automático ou manual via API
   ```
3. **Aguarde**: 10-15 segundos
4. **Mostre**:
   - Query bloqueante aparece
   - Outras queries esperando
   - Max block time > 10s
   - Drill-down no query sample

5. **Explique**:
   > "Aqui vemos uma transação que esqueceu de fazer COMMIT, travando outras queries.
   > Em produção, isso causa timeout e degradação de performance.
   > O DBM identifica automaticamente qual query está bloqueando e quais estão esperando."

### Cenário 2: Slow Queries (5 min)

1. **Setup**: DBM → Query Metrics
2. **Trigger**: Transação de R$ 8888.88
3. **Aguarde**: 5-10 segundos
4. **Mostre**:
   - Query com P99 > 2s
   - Explain plan: Sequential Scan
   - Datadog suggest: "Add index"

5. **Explique**:
   > "Esta query não tem índice otimizado e faz full table scan.
   > O DBM não só detecta a lentidão, mas **sugere** a criação de índices.
   > Olhem o execution plan - scan completo da tabela ao invés de index seek."

### Cenário 3: Deadlocks (3 min)

1. **Setup**: DBM → Database Activity
2. **Trigger**: Transação de R$ 9999.99
3. **Mostre**:
   - Deadlock event
   - Duas transações envolvidas
   - Rollback automático

4. **Explique**:
   > "Deadlock clássico: duas transações travadas mutuamente.
   > PostgreSQL detecta e faz rollback automaticamente.
   > O DBM captura o evento e mostra exatamente quais queries causaram."

### Cenário 4: Query Performance Over Time (3 min)

1. **Mostre gráficos**:
   - Query latency P99 trend
   - Slow queries count
   - Lock contention over time

2. **Explique**:
   > "Aqui vemos o histórico de performance.
   > Podemos correlacionar problemas de banco com deploys, mudanças de código, ou aumento de carga.
   > Isso é essencial para troubleshooting e capacity planning."

## 🔧 Troubleshooting

### Problema: Blocking Queries não aparecem

**Causa**: Lock duration muito curto

**Solução**:
```python
# Em db_chaos_generator.py, aumente a duração:
duration = random.randint(20, 40)  # Era 10-30
```

### Problema: Slow Queries muito rápidas

**Causa**: Tabela muito pequena (poucos dados)

**Solução**: Insira mais dados de teste no PostgreSQL
```sql
INSERT INTO accounts (cpf, balance, user_id)
SELECT
  LPAD((random()*99999999999)::bigint::text, 11, '0'),
  random() * 100000,
  (random() * 10)::int + 1
FROM generate_series(1, 10000);
```

### Problema: DB Chaos Generator não inicia

**Causa**: Conexão com PostgreSQL falhou

**Verificação**:
```bash
# Testar conexão
kubectl exec -n dogbank deployment/load-generator -- \
  python -c "import psycopg2; psycopg2.connect(host='postgres', database='dogbank', user='dogbank', password='dogbank123')"
```

## 📈 Métricas de Sucesso

✅ **Demo bem-sucedida quando**:
- Blocking queries aparecem com >10s de block time
- Slow queries mostram P99 > 2s
- Deadlock events são capturados
- Explain plans mostram Sequential Scan
- Datadog sugere otimizações (índices)

## 🎯 Pontos-Chave para Destacar

1. **Visibilidade Completa**
   - Não precisa instrumentar código
   - DBM captura tudo automaticamente
   - Histórico completo de queries

2. **Insights Acionáveis**
   - Sugere índices específicos
   - Identifica queries bloqueantes
   - Explain plans integrados

3. **Correlação com APM**
   - Slow queries correlacionadas com traces
   - Link direto: "Ver trace que executou esta query"
   - Contexto completo do problema

4. **Produção-Ready**
   - Overhead mínimo (<5%)
   - Não afeta performance
   - Seguro para produção

## 📚 Recursos Adicionais

### Configuração Atual do PostgreSQL

DBM já habilitado em `/Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s/base/postgres.yaml`:

```yaml
ad.datadoghq.com/postgres.checks: |
  {
    "postgres": {
      "instances": [{
        "host": "%%host%%",
        "port": 5432,
        "username": "datadog",
        "password": "datadog_pwd",
        "dbm": true,                    # DBM enabled
        "query_samples": {
          "enabled": true
        },
        "query_metrics": {
          "enabled": true
        }
      }]
    }
  }
```

### Comandos Úteis

```bash
# Ver transações ativas no PostgreSQL
kubectl exec -n dogbank deployment/postgres -- \
  psql -U dogbank -d dogbank -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Ver locks atuais
kubectl exec -n dogbank deployment/postgres -- \
  psql -U dogbank -d dogbank -c "SELECT * FROM pg_locks JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid;"

# Ver queries bloqueadas
kubectl exec -n dogbank deployment/postgres -- \
  psql -U dogbank -d dogbank -c "SELECT blocked_locks.pid AS blocked_pid, blocking_locks.pid AS blocking_pid FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype WHERE NOT blocked_locks.GRANTED;"
```

## 🎉 Conclusão

Com este setup, você tem um **ambiente completo para demonstrar DBM** com:
- ✅ Blocking queries realistas
- ✅ Slow queries detectáveis
- ✅ Deadlocks capturados
- ✅ Waiting queries visíveis
- ✅ Insights automáticos
- ✅ Explain plans integrados

**Tudo trigado automaticamente** através de valores específicos de transações PIX!

**Próximos passos**:
1. Rebuild do load-generator
2. Deploy no cluster
3. Aguardar 5-10 minutos
4. Abrir DBM e ver os problemas aparecerem

**Tempo até ver resultados**: 5-15 minutos após deployment
