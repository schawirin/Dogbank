# Correções de CORS para Ambiente Docker Local - DogBank

## Resumo das Correções Realizadas

### 1. CorsConfig.java (Todos os 6 módulos)

**Problema:** CORS configurado apenas para origens específicas (`localhost:3000`, `lab.dogbank.dog`)

**Solução:** Alterado para usar `setAllowedOriginPatterns("*")` que permite qualquer origem em ambiente de desenvolvimento.

**Arquivos modificados:**
- `dogbank/auth-module/src/main/java/com/dogbank/auth/config/CorsConfig.java`
- `dogbank/account-module/src/main/java/com/dogbank/account/config/CorsConfig.java`
- `dogbank/transaction-module/src/main/java/com/dogbank/transaction/config/CorsConfig.java`
- `dogbank/bancocentral-module/src/main/java/com/dogbank/bancocentral/config/CorsConfig.java`
- `dogbank/integration-module/src/main/java/com/dogbank/integration/config/CorsConfig.java`
- `dogbank/notification-module/src/main/java/com/dogbank/notification/config/CorsConfig.java`

### 2. api.js (Frontend)

**Problema:** Path duplicado `/api/auth/api/auth` causando 404

**Solução:** Corrigido para `/api/auth`

**Arquivo modificado:**
- `dogbank-frontend/src/services/api.js`

### 3. nginx.conf

**Problema:** `proxy_pass` com `/` no final remove o prefixo da URL

**Solução:** Removida a `/` final e adicionados headers CORS para preflight requests

**Arquivo modificado:**
- `dogbank/nginx/nginx.conf`

---

## Como Aplicar as Correções

### Opção 1: Rebuild dos containers (Recomendado)

```bash
# Parar containers
docker-compose down

# Rebuild das imagens Java (necessário para aplicar CorsConfig)
docker-compose build --no-cache auth-service account-service transaction-service bancocentral-service integration-service notification-service

# Subir novamente
docker-compose up -d
```

### Opção 2: Apenas reiniciar Nginx (se já aplicou as correções Java)

```bash
docker-compose restart nginx
```

---

## Mapeamento de Endpoints

| Frontend (api.js) | Nginx Location | Backend Service | Porta |
|-------------------|----------------|-----------------|-------|
| `/api/auth` | `/api/auth/` | auth-service | 8088 |
| `/api/accounts` | `/api/accounts/` | account-service | 8089 |
| `/api/transactions` | `/api/transactions/` | transaction-service | 8084 |
| `/api/bancocentral` | `/api/bancocentral/` | bancocentral-service | 8085 |
| `/api/integration` | `/api/integration/` | integration-service | 8082 |
| `/api/notifications` | `/api/notifications/` | notification-service | 8083 |

---

## Endpoint de Login

**URL completa:** `POST http://localhost/api/auth/login`

**Request Body:**
```json
{
  "cpf": "12345678901",
  "password": "senha123"
}
```

**Response (sucesso):**
```json
{
  "message": "Login successful",
  "nome": "Nome do Usuário",
  "chavePix": "chave@pix.com",
  "accountId": 1
}
```

---

## Teste de Conectividade

```bash
# Testar health check do Nginx
curl http://localhost/health

# Testar health check do auth-service (via Nginx)
curl http://localhost/api/auth/health

# Testar login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cpf":"12345678901","password":"senha123"}'
```

---

## Troubleshooting

### Erro: "CORS policy: No 'Access-Control-Allow-Origin'"

1. Verifique se o CorsConfig.java foi atualizado em TODOS os módulos
2. Rebuild os containers Java: `docker-compose build --no-cache`
3. Verifique os logs: `docker-compose logs auth-service`

### Erro: "404 Not Found"

1. Verifique se o nginx.conf foi atualizado
2. Verifique se o endpoint está correto (sem path duplicado)
3. Teste diretamente no backend: `curl http://localhost:8088/api/auth/health`

### Erro: "Connection refused"

1. Verifique se os containers estão rodando: `docker-compose ps`
2. Verifique a rede Docker: `docker network ls`
3. Verifique os logs: `docker-compose logs`

---

## Configuração para Produção

⚠️ **IMPORTANTE:** As configurações atuais são para **desenvolvimento local**.

Para produção, altere o CorsConfig.java para usar origens específicas:

```java
configuration.setAllowedOrigins(Arrays.asList(
    "https://seu-dominio.com",
    "https://app.seu-dominio.com"
));
```
