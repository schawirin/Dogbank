# 🔒 Relatório de Auditoria de Segurança - DogBank

**Data:** 03 de Janeiro de 2026  
**Versão:** 1.0  
**Auditor:** Manus AI Security Analysis

---

## 📋 Sumário Executivo

Esta auditoria identificou **múltiplas vulnerabilidades críticas** no projeto DogBank que precisam ser corrigidas antes de qualquer deploy em produção. Algumas vulnerabilidades são **intencionais** (para fins de treinamento em segurança), mas outras representam riscos reais.

| Severidade | Quantidade |
|------------|------------|
| 🔴 Crítica | 6 |
| 🟠 Alta | 5 |
| 🟡 Média | 4 |
| 🟢 Baixa | 3 |

---

## 🔴 Vulnerabilidades Críticas

### 1. SQL Injection Intencional (CVE-like)

**Arquivo:** `transaction-module/src/main/java/com/dogbank/transaction/service/TransactionService.java`  
**Linhas:** 181-220

```java
// 🚨 VULNERABILIDADE PROPOSITAL
String sql = "SELECT u.nome, u.email, u.cpf, c.saldo, c.banco, u.chave_pix " +
             "FROM usuarios u " +
             "JOIN contas c ON u.id = c.usuario_id " +
             "WHERE u.chave_pix = '" + pixKey + "'";
```

**Impacto:** Permite extração completa do banco de dados, bypass de autenticação, e potencialmente execução de comandos.

**Payloads de Exploração:**
```sql
' OR '1'='1
' UNION SELECT nome, senha, cpf, email, banco, chave_pix FROM usuarios--
' OR pg_sleep(5)--
```

**Recomendação:** Usar PreparedStatement ou JPA Repository com parâmetros.

---

### 2. Senhas Armazenadas em Texto Plano

**Arquivo:** `auth-module/src/main/java/com/dogbank/auth/controller/AuthController.java`  
**Linha:** 43

```java
if (!Objects.equals(pwd, user.getSenha())) {
```

**Problema:** A comparação de senhas é feita diretamente com `Objects.equals()`, indicando que as senhas estão armazenadas em texto plano no banco de dados.

**Evidência no banco:** `init-db/01-init.sql`
```sql
INSERT INTO usuarios (cpf, senha, nome, email, chave_pix) VALUES
('12345678915', '123456', 'Julia Medina', ...),
```

**Impacto:** Se o banco for comprometido, todas as senhas são expostas imediatamente.

**Recomendação:** Usar BCrypt para hash de senhas:
```java
@Autowired
private BCryptPasswordEncoder passwordEncoder;

// Na validação:
if (!passwordEncoder.matches(pwd, user.getSenha())) {
```

---

### 3. Credenciais Hardcoded no Código

**Arquivos afetados:**
- `docker-compose.microservices.yml`
- `secret.yaml`
- `dogbank-complete.yaml`

```yaml
# docker-compose.microservices.yml
POSTGRES_PASSWORD: dog1234

# secret.yaml (base64 decodificado)
POSTGRES_USER: dogbank
POSTGRES_PASSWORD: dog1234
```

**Impacto:** Qualquer pessoa com acesso ao repositório tem acesso total ao banco de dados.

**Recomendação:** 
- Usar variáveis de ambiente ou secrets manager (HashiCorp Vault, AWS Secrets Manager)
- Nunca commitar credenciais no Git
- Adicionar ao `.gitignore`: `*.env`, `secret.yaml`

---

### 4. Spring Security Completamente Desabilitado

**Todos os módulos têm:**
```java
.authorizeHttpRequests((requests) -> requests
    .antMatchers("/**").permitAll() // Libera tudo, sem segurança
)
.csrf().disable()
```

**Impacto:** 
- Todos os endpoints são públicos
- CSRF desabilitado permite ataques cross-site
- Sem autenticação JWT ou sessão

**Recomendação:** Implementar autenticação JWT:
```java
.authorizeHttpRequests(auth -> auth
    .antMatchers("/api/auth/login", "/api/auth/health").permitAll()
    .anyRequest().authenticated()
)
.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
```

---

### 5. Exposição de Dados Sensíveis em Logs

**Arquivo:** `TransactionService.java`
```java
log.warn("⚠️ [INPUT]: {}", pixKey);
log.info("📝 [SQL QUERY]: {}", sql);
```

**Impacto:** Logs podem conter dados sensíveis (CPF, senhas, queries SQL completas).

**Recomendação:** 
- Mascarar dados sensíveis antes de logar
- Usar níveis de log apropriados
- Implementar log sanitization

---

### 6. Porta do PostgreSQL Exposta Publicamente

**Arquivo:** `docker-compose.microservices.yml`
```yaml
postgres:
  ports:
    - "5432:5432"  # Exposto para qualquer IP
```

**Impacto:** Banco de dados acessível diretamente da internet.

**Recomendação:** 
- Remover mapeamento de porta ou usar `127.0.0.1:5432:5432`
- Usar rede interna do Docker apenas

---

## 🟠 Vulnerabilidades de Alta Severidade

### 7. Ausência de Rate Limiting nos Endpoints

**Problema:** Nenhum endpoint tem proteção contra brute force ou DDoS.

**Endpoints vulneráveis:**
- `POST /api/auth/login` - Permite brute force de senhas
- `POST /api/transactions/pix` - Permite spam de transações

**Recomendação:** Implementar rate limiting:
```java
@RateLimiter(name = "login", fallbackMethod = "loginFallback")
@PostMapping("/login")
public ResponseEntity<?> login(...) { }
```

---

### 8. Falta de Validação de Input

**Arquivo:** `AuthController.java`
```java
String cpf = request.getCpf() == null ? null : request.getCpf().trim();
```

**Problema:** Não há validação de formato de CPF, email, ou outros campos.

**Recomendação:** Usar Bean Validation:
```java
public class AuthRequest {
    @NotBlank
    @Pattern(regexp = "\\d{11}", message = "CPF inválido")
    private String cpf;
    
    @NotBlank
    @Size(min = 6, max = 100)
    private String password;
}
```

---

### 9. Informações Sensíveis em Respostas de Erro

**Arquivo:** `AuthController.java`
```java
return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
    .body(Map.of("error", "User not found"));
```

**Problema:** Revela se o usuário existe ou não (user enumeration).

**Recomendação:** Usar mensagem genérica:
```java
.body(Map.of("error", "Invalid credentials"));
```

---

### 10. Ausência de HTTPS Forçado

**Arquivo:** `nginx.conf`
```nginx
server {
    listen 80;  # Apenas HTTP
```

**Problema:** Tráfego pode ser interceptado (MITM).

**Recomendação:** Redirecionar HTTP para HTTPS:
```nginx
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

---

### 11. Headers de Segurança Ausentes

**Problema:** Nginx não adiciona headers de segurança importantes.

**Recomendação:** Adicionar ao nginx.conf:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

---

## 🟡 Vulnerabilidades de Média Severidade

### 12. Spring Boot 2.7.18 (Desatualizado)

**Arquivo:** `auth-module/pom.xml`
```xml
<spring.boot.version>2.7.18</spring.boot.version>
```

**Problema:** Spring Boot 2.7 está em fim de suporte. Versões mais recentes têm correções de segurança.

**Recomendação:** Atualizar para Spring Boot 3.2+

---

### 13. Actuator Endpoints Expostos

**Problema:** Spring Actuator pode expor informações sensíveis.

**Recomendação:** Restringir endpoints:
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info
  endpoint:
    health:
      show-details: never
```

---

### 14. Ausência de Auditoria de Transações

**Problema:** Não há log de auditoria para transações financeiras.

**Recomendação:** Implementar audit trail com timestamp, IP, user-agent.

---

### 15. Falta de Timeout em Conexões

**Problema:** Conexões de banco de dados não têm timeout configurado.

**Recomendação:**
```yaml
spring:
  datasource:
    hikari:
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

---

## 🟢 Vulnerabilidades de Baixa Severidade

### 16. Dockerfile sem Scan de Vulnerabilidades

**Recomendação:** Adicionar ao CI/CD:
```bash
docker scan dogbank/auth-service:latest
```

---

### 17. Ausência de .dockerignore

**Problema:** Pode incluir arquivos desnecessários na imagem.

**Recomendação:** Criar `.dockerignore`:
```
.git
*.md
*.env
target/
node_modules/
```

---

### 18. Logs sem Rotação

**Problema:** Logs podem crescer indefinidamente.

**Recomendação:** Configurar log rotation no Docker ou usar ELK stack.

---

## 📊 Matriz de Risco

| Vulnerabilidade | Probabilidade | Impacto | Risco |
|-----------------|---------------|---------|-------|
| SQL Injection | Alta | Crítico | 🔴 Crítico |
| Senhas em texto plano | Alta | Crítico | 🔴 Crítico |
| Credenciais hardcoded | Alta | Crítico | 🔴 Crítico |
| Security desabilitado | Alta | Alto | 🔴 Crítico |
| PostgreSQL exposto | Média | Crítico | 🔴 Crítico |
| Sem rate limiting | Alta | Alto | 🟠 Alto |
| Sem validação input | Alta | Médio | 🟠 Alto |
| User enumeration | Média | Médio | 🟡 Médio |
| Sem HTTPS | Média | Alto | 🟠 Alto |

---

## ✅ Checklist de Correções Prioritárias

- [ ] Implementar hash de senhas com BCrypt
- [ ] Remover SQL injection vulnerável (ou isolar em ambiente de demo)
- [ ] Mover credenciais para secrets manager
- [ ] Implementar autenticação JWT
- [ ] Adicionar rate limiting
- [ ] Configurar HTTPS obrigatório
- [ ] Adicionar headers de segurança
- [ ] Atualizar Spring Boot para 3.2+
- [ ] Restringir Actuator endpoints
- [ ] Implementar validação de input
- [ ] Adicionar audit logging
- [ ] Configurar log rotation

---

## 🔧 Arquivos que Precisam de Correção

| Arquivo | Prioridade | Correção |
|---------|------------|----------|
| `AuthController.java` | 🔴 | Hash de senhas, mensagens genéricas |
| `TransactionService.java` | 🔴 | Remover SQL injection |
| `SecurityConfig.java` (todos) | 🔴 | Implementar autenticação |
| `docker-compose.microservices.yml` | 🔴 | Remover credenciais |
| `secret.yaml` | 🔴 | Não commitar no Git |
| `nginx.conf` | 🟠 | HTTPS, headers de segurança |
| `pom.xml` | 🟡 | Atualizar dependências |
| `01-init.sql` | 🔴 | Remover senhas em texto plano |

---

## 📝 Notas Finais

Este projeto parece ser um **ambiente de treinamento em segurança** (dado o SQL injection intencional e comentários sobre Datadog ASM). No entanto, mesmo para fins educacionais, é importante:

1. **Documentar claramente** quais vulnerabilidades são intencionais
2. **Isolar** o ambiente de demo do ambiente de desenvolvimento
3. **Nunca** usar credenciais reais em ambientes de teste
4. **Implementar** feature flags para habilitar/desabilitar vulnerabilidades

---

*Relatório gerado automaticamente por Manus AI Security Analysis*
