# Auth Service Runbook

**Team**: security
**Criticidade**: Alta
**SLO**: 99.9% disponibilidade, P99 latencia < 200ms

## Sintomas Comuns

### Erro 401 em massa
**Impacto**: Usuarios nao conseguem fazer login
**Severidade**: P1

**Investigacao**:
1. Verificar logs do auth-service para erros de JWT
2. Checar conexao com Redis (sessoes)
3. Verificar se o secret JWT foi rotacionado

**Remediacao**:
```bash
# Verificar saude do Redis
docker exec dogbank-redis redis-cli ping

# Verificar logs
docker logs auth-service --tail 100 | grep -i error

# Reiniciar se necessario
docker-compose restart auth-service
```

### Latencia Alta no /login
**Impacto**: Login lento, timeout
**Severidade**: P2

**Investigacao**:
1. Verificar metricas de CPU/memoria do container
2. Checar latencia do PostgreSQL
3. Verificar se ha muitas sessoes ativas no Redis

**Remediacao**:
```bash
# Verificar metricas
docker stats auth-service

# Verificar conexoes PostgreSQL
docker exec dogbank-postgres psql -U dogbank -c "SELECT count(*) FROM pg_stat_activity;"

# Limpar sessoes expiradas no Redis
docker exec dogbank-redis redis-cli FLUSHDB
```

### SQL Injection Detectado (ASM)
**Impacto**: Tentativa de ataque
**Severidade**: P2

**Investigacao**:
1. Verificar Datadog ASM para detalhes do ataque
2. Identificar IP de origem
3. Checar se houve exfiltracao de dados

**Remediacao**:
```bash
# Bloquear IP no nginx (se necessario)
# Notificar equipe de seguranca
# NÃO reiniciar servicos durante investigacao
```

## Metricas Chave

- `trace.servlet.request.duration{service:auth-service}`
- `auth.login.success.count`
- `auth.login.failure.count`
- `redis.connected_clients`

## Dependencias

- PostgreSQL (banco de dados)
- Redis (cache de sessoes)

## Contato

- Slack: #security-oncall
- Email: security@dogbank.com
