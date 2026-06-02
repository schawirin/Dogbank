# Atualizações no Security Attacker para Demos

## ✅ Mudanças Implementadas

Modifiquei o `security_attacker.py` para gerar ataques **muito mais visíveis** no Datadog ASM:

### 1. **Frequência de Ataques Aumentada**
- **MIN_INTERVAL**: 5s → **2s** (60% mais rápido)
- **MAX_INTERVAL**: 15s → **8s** (47% mais rápido)
- Ataques começam após **30s** (antes: 60s)

### 2. **Probabilidades Ajustadas para SQL Injection e RCE**

**ANTES:**
```python
PROB_SQL_INJECTION = 0.20  (20%)
PROB_RCE = 0.15           (15%)
PROB_LOG4SHELL = 0.15     (15%)
PROB_PATH_TRAVERSAL = 0.15 (15%)
PROB_XSS = 0.15           (15%)
PROB_AUTH_BYPASS = 0.10   (10%)
PROB_IDOR = 0.10          (10%)
```

**DEPOIS (PARA DEMOS):**
```python
PROB_SQL_INJECTION = 0.35  (35% - DOBROU!)
PROB_RCE = 0.35           (35% - MAIS QUE DOBROU!)
PROB_LOG4SHELL = 0.10     (10%)
PROB_PATH_TRAVERSAL = 0.08 (8%)
PROB_XSS = 0.05           (5%)
PROB_AUTH_BYPASS = 0.04   (4%)
PROB_IDOR = 0.03          (3%)
```

### 3. **Headers de Identificação para Datadog ASM**

Agora todos os ataques incluem headers distintivos:

```python
'User-Agent': 'DogBank-Attacker/2.0 (Security Testing Bot)'
'X-Attack-Simulation': 'DogBank-Demo'
'X-Attacker-ID': 'attacker-XXXX'
```

Isso facilita encontrar os ataques no Datadog ASM!

## 🚀 Como Aplicar as Mudanças

### Opção 1: Usar a Imagem Já Buildada (RECOMENDADO)

A imagem já foi construída e enviada para Docker Hub:

```bash
# Configure AWS credentials
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."

# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name eks-sandbox-datadog

# Restart load-generator com a nova imagem
kubectl rollout restart deployment/load-generator -n dogbank

# Acompanhe os logs
kubectl logs -f deployment/load-generator -n dogbank
```

### Opção 2: Build Local e Deploy

```bash
cd /Users/pedro.schawirin/Documents/Dogbank/instrumented/docker/dogbank/load-generator

# Build
docker build -t schawirin/dogbank-load-generator:latest .

# Push
docker push schawirin/dogbank-load-generator:latest

# Deploy
kubectl rollout restart deployment/load-generator -n dogbank
```

## 📊 Onde Ver os Ataques no Datadog

### 1. **Application Security → Signals**
- Acesse: https://app.datadoghq.com/security/appsec/signals
- Filtre por: `service:*-service` OR `env:dogbank`
- Você verá os sinais de ataque detectados

### 2. **Application Security → Traces**
- Acesse: https://app.datadoghq.com/security/appsec/traces
- Filtre por: `@appsec.detected:true`
- Veja traces individuais com payloads maliciosos

### 3. **Application Security → Attackers**
- Acesse: https://app.datadoghq.com/security/appsec/attackers
- Procure por User-Agent: `DogBank-Attacker/2.0`
- **IMPORTANTE**: Se ainda aparecer "0 IPs", é porque:
  - Os ataques estão sendo BLOQUEADOS (bom sinal!)
  - Datadog pode estar agregando IPs internos do cluster
  - Tente filtrar por `@http.useragent:*Attacker*`

### 4. **APM → Services → [service-name] → Security**
- Veja a aba "Security" em cada serviço
- Mostra vulnerabilidades detectadas por serviço

## 🎬 Comandos para Demo

### Verificar se ataques estão rodando:
```bash
kubectl logs -f deployment/load-generator -n dogbank | grep -E "SQL-INJECTION|RCE"
```

Saída esperada:
```
[SQL-INJECTION] Tentando bypass de login com: ' OR '1'='1...
[RCE] Tentando command injection via header: ; cat /etc/passwd...
[SQL-INJECTION] Injetando na busca: ' UNION SELECT * FROM usuarios--...
[RCE] Tentando RCE via chatbot: ; whoami...
```

### Verificar estatísticas:
```bash
kubectl logs deployment/load-generator -n dogbank | grep "ESTATISTICAS" -A 15
```

### Forçar restart mais rápido:
```bash
kubectl delete pod -l app=load-generator -n dogbank
```

## 🔍 Troubleshooting

### Problema: Ainda não vejo ataques no Datadog

**Solução 1: Verificar se Datadog Agent está coletando**
```bash
kubectl get pods -n dogbank | grep datadog
kubectl logs -n dogbank daemonset/datadog-agent | grep -i appsec
```

**Solução 2: Verificar se ASM está habilitado nos serviços**
```bash
kubectl get deployment -n dogbank account-service -o yaml | grep DD_APPSEC_ENABLED
kubectl get deployment -n dogbank transaction-service -o yaml | grep DD_APPSEC_ENABLED
kubectl get deployment -n dogbank auth-service -o yaml | grep DD_APPSEC_ENABLED
```

Deve retornar: `value: "true"`

**Solução 3: Verificar Network Policy**
```bash
kubectl get networkpolicies -n dogbank
```

Se houver policies bloqueando, pode impedir ataques chegarem nos serviços.

**Solução 4: Aguardar propagação**
- Datadog pode levar 2-5 minutos para processar e mostrar sinais
- Refresh a página do Datadog após alguns minutos

## 📈 Métricas Esperadas (Após 5 minutos)

Com as novas configurações, você deve ver:

- **~10-15 ataques por minuto**
- **35% SQL Injection** (mais visível)
- **35% RCE attempts** (mais visível)
- **Vários sinais de segurança** no Datadog ASM
- **User-Agent identificável**: `DogBank-Attacker/2.0`

## 🎯 Próximos Passos

1. ✅ Aplicar as mudanças no cluster (restart load-generator)
2. ⏳ Aguardar 2-3 minutos para ataques começarem
3. ⏳ Verificar logs do load-generator
4. ⏳ Abrir Datadog ASM → Signals
5. ⏳ Filtrar por `service:*-service` ou `@http.useragent:*Attacker*`
6. ⏳ Preparar demo mostrando detecção em tempo real

## 💡 Dicas para Demo

1. **Abra 3 abas no navegador:**
   - Aba 1: Datadog ASM Signals (auto-refresh)
   - Aba 2: Logs do load-generator (kubectl logs -f)
   - Aba 3: DogBank frontend

2. **Mostre o fluxo:**
   - "Veja aqui no terminal: ataque SQL Injection sendo executado"
   - "E aqui no Datadog ASM: detecção em tempo real"
   - "Payload bloqueado: [mostrar trace com payload]"

3. **Destaque os pontos:**
   - Detecção automática sem config manual
   - Payload completo capturado
   - Contexto do ataque (User-Agent, IP, serviço)
   - Action automática (block/monitor)

## 🔐 Lembrete de Segurança

Este código é **APENAS PARA DEMOS** em ambiente controlado.

**NUNCA** execute em produção real ou em sistemas que você não possui autorização!
