# Guia de Integração Segura com Datadog

## 📋 Visão Geral

Este guia descreve a implementação segura da integração com Datadog no DogBank. O objetivo principal é **não expor a API key no frontend** e implementar um **proxy seguro no backend** para todas as requisições ao Datadog.

## 🎯 Arquitetura

```
Frontend (React)
     ↓
     | (sem credenciais)
     ↓
Backend Spring Boot
     ├─ DatadogService (mantém API keys seguras)
     ├─ DatadogController (endpoints REST)
     └─ RestTemplate (HTTP client)
     ↓
     | (com credenciais seguras)
     ↓
Datadog API
```

## 🔒 Por que essa abordagem?

### Problemas da exposição direta de API key no frontend:
- ✗ API keys visíveis no código JavaScript
- ✗ API keys visíveis nas requisições HTTP (mesmo em HTTPS)
- ✗ Qualquer pessoa pode usar a chave para fazer requisições
- ✗ Difícil de rotacionar ou revogar chaves

### Vantagens da abordagem com proxy no backend:
- ✅ API keys nunca saem do backend
- ✅ Fácil implementar rate limiting
- ✅ Autenticação do usuário antes de acessar Datadog
- ✅ Logs de auditoria centralizados
- ✅ Controle fino sobre quem pode acessar cada métrica

## 🚀 Setup

### 1. Configurar variáveis de ambiente

**No seu servidor/container, defina:**

```bash
# Docker
export DATADOG_API_KEY="seu-api-key-aqui"
export DATADOG_APP_KEY="sua-app-key-aqui"

# Ou no .env (NUNCA committe isso!)
DATADOG_API_KEY=seu-api-key-aqui
DATADOG_APP_KEY=sua-app-key-aqui
```

**No docker-compose.yml:**

```yaml
services:
  backend:
    environment:
      - DATADOG_API_KEY=${DATADOG_API_KEY}
      - DATADOG_APP_KEY=${DATADOG_APP_KEY}
      - DATADOG_ENABLED=true
```

### 2. Ativar o profile do Spring

**application.yml ou application.properties:**

```yaml
spring:
  profiles:
    active: datadog
```

### 3. Frontend: Usar o DatadogService

```javascript
import { getMetrics, getLogs, getSLOs } from './services/datadogService';

// Buscar métricas (sem passar API key!)
const metrics = await getMetrics('avg:system.cpu{*}', from, to);

// Buscar logs
const logs = await getLogs('status:error', from, to);

// Buscar SLOs
const slos = await getSLOs();
```

## 📝 Endpoints Disponíveis

### GET /api/observability/datadog/metrics
Busca métricas do Datadog

**Parâmetros:**
- `query` (string): Query da métrica (ex: `avg:system.cpu{*}`)
- `from` (number): Timestamp inicial em segundos
- `to` (number): Timestamp final em segundos

**Exemplo:**
```bash
curl -X GET "http://localhost:8080/api/observability/datadog/metrics?query=avg:system.cpu&from=1234567890&to=1234567900"
```

### GET /api/observability/datadog/logs
Busca logs do Datadog

**Parâmetros:**
- `query` (string): Query dos logs
- `from` (number): Timestamp inicial em milissegundos
- `to` (number): Timestamp final em milissegundos

**Exemplo:**
```bash
curl -X GET "http://localhost:8080/api/observability/datadog/logs?query=status:error&from=1234567890000&to=1234567900000"
```

### GET /api/observability/datadog/dashboard/{dashboardId}
Busca dados de um dashboard específico

**Parâmetros:**
- `dashboardId` (path): ID do dashboard no Datadog

**Exemplo:**
```bash
curl -X GET "http://localhost:8080/api/observability/datadog/dashboard/abc123def456"
```

### GET /api/observability/datadog/slos
Busca Service Level Objectives (SLOs)

**Exemplo:**
```bash
curl -X GET "http://localhost:8080/api/observability/datadog/slos"
```

### GET /api/observability/datadog/health
Verifica se Datadog está configurado e disponível

**Exemplo:**
```bash
curl -X GET "http://localhost:8080/api/observability/datadog/health"
```

**Resposta:**
```json
{
  "status": "UP",
  "datadog_configured": true,
  "timestamp": 1701705600000
}
```

## 🛡️ Segurança - Boas Práticas

### 1. Nunca committe credenciais
```bash
# .gitignore
.env
.env.local
application-datadog.properties  # Se contiver senhas
```

### 2. Use variáveis de ambiente
```yaml
# application.yml
datadog:
  api-key: ${DATADOG_API_KEY:}
  app-key: ${DATADOG_APP_KEY:}
```

### 3. Implemente autenticação
Adicione `@PreAuthorize` aos endpoints:

```java
@GetMapping("/metrics")
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<Map<String, Object>> getMetrics(...) {
    // Apenas admins podem acessar
}
```

### 4. Rate Limiting
Implemente rate limiting para prevenir abuso:

```java
@RateLimiter(value = 100, interval = "1m")  // 100 requisições por minuto
@GetMapping("/metrics")
public ResponseEntity<Map<String, Object>> getMetrics(...) {
    ...
}
```

### 5. Logging e Auditoria
O backend já registra todas as requisições:

```
INFO  com.dogbank.integration.controller.DatadogController - Requisição de métricas: query=avg:system.cpu, from=1234567890, to=1234567900
```

## 🐛 Troubleshooting

### CORS Error
Se receber erro de CORS no frontend:

1. Verifique se o backend está rodando na URL correta
2. Adicione sua URL no `@CrossOrigin`:

```java
@CrossOrigin(origins = {"http://localhost:3000", "https://seu-dominio.com"})
```

3. Verifique headers na resposta:
```bash
curl -i http://localhost:8080/api/observability/datadog/health
```

### Datadog API Error
Se receber erro do Datadog:

1. Verifique as credenciais:
   ```bash
   echo $DATADOG_API_KEY
   echo $DATADOG_APP_KEY
   ```

2. Verifique se `datadog.enabled=true` está setado

3. Veja os logs do backend:
   ```bash
   docker logs backend | grep -i datadog
   ```

### Health Check
Para verificar se tudo está funcionando:

```bash
# Backend respondendo?
curl http://localhost:8080/api/observability/datadog/health

# Datadog configurado?
curl http://localhost:3000/api/observability/datadog/health | jq .datadog_configured
```

## 📚 Referências

- [Datadog API Docs](https://docs.datadoghq.com/api/latest/)
- [Spring CORS Configuration](https://spring.io/guides/gs/handling-form-submission/)
- [Environment Variables in Spring Boot](https://spring.io/blog/2015/06/08/using-spring-boot-embedded-containers-to-run-multiple-war-files)

## 🔄 Próximos Passos

1. **Implementar autenticação**: Garantir que apenas usuários autenticados acessem métricas
2. **Adicionar rate limiting**: Proteger contra abuso
3. **Melhorar logging**: Adicionar tracing distribuído
4. **Cache de métricas**: Cachear respostas para melhor performance
5. **Alertas**: Implementar alertas quando métricas saem dos limites

---

**Última atualização:** Dezembro 2025  
**Versão:** 1.0
