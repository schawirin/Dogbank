# Guia Rápido: Criar Workflows na UI do Datadog

## ❌ Problema: API sem permissões
A App Key não tem permissões `actions API access`, então não podemos criar workflows via API.

## ✅ Solução: Criar manualmente na UI (5 minutos)

---

## 🎯 Passo 1: Acesse Workflow Automation

1. Abra o Datadog: https://app.datadoghq.com
2. Menu lateral → **Automation** → **Workflow Automation**
3. Ou acesse direto: https://app.datadoghq.com/workflow

---

## 📝 Passo 2: Criar Workflows

### Workflow 1: [DogBank] Restart Pod ⭐

**Objetivo**: Reiniciar um pod específico no cluster

#### Configuração:
1. Clique em **"+ New Workflow"** (canto superior direito)
2. **Name**: `[DogBank] Restart Pod`
3. **Description**: `Reinicia um pod específico do DogBank no cluster EKS`
4. **Trigger**: Manual

#### Inputs:
| Nome | Tipo | Descrição | Obrigatório | Default |
|------|------|-----------|-------------|---------|
| `pod_name` | String | Nome do pod a ser reiniciado | ✅ Sim | - |
| `namespace` | String | Namespace do pod | ❌ Não | `dogbank` |

#### Step 1: HTTP Request
- **Action**: HTTP Request
- **Method**: POST
- **URL**: `https://webhook.site/your-unique-id` (obter em https://webhook.site)

**Headers**:
```json
{
  "Content-Type": "application/json"
}
```

**Body** (copie exatamente):
```json
{
  "action": "delete_pod",
  "pod_name": "{{ Trigger.pod_name }}",
  "namespace": "{{ Trigger.namespace }}",
  "cluster": "eks-sandbox-datadog"
}
```

5. Clique em **"Save"**

---

### Workflow 2: [DogBank] Rollout Restart All Services ⭐

**Objetivo**: Fazer rollout restart de todos os serviços

#### Configuração:
1. **"+ New Workflow"**
2. **Name**: `[DogBank] Rollout Restart All Services`
3. **Description**: `Faz rollout restart de todos os serviços do DogBank`
4. **Trigger**: Manual

#### Inputs:
| Nome | Tipo | Descrição | Obrigatório | Default |
|------|------|-----------|-------------|---------|
| `reason` | String | Motivo do restart | ❌ Não | `Manual restart via Datadog` |

#### Step 1: HTTP Request
- **Method**: POST
- **URL**: `https://webhook.site/your-unique-id`

**Body**:
```json
{
  "action": "rollout_restart_all",
  "namespace": "dogbank",
  "cluster": "eks-sandbox-datadog",
  "services": [
    "account-service",
    "transaction-service",
    "bancocentral-service",
    "chatbot-service",
    "frontend",
    "nginx"
  ],
  "reason": "{{ Trigger.reason }}"
}
```

5. **Save**

---

### Workflow 3: [DogBank] Scale Service ⭐

**Objetivo**: Escalar número de réplicas de um serviço

#### Configuração:
1. **"+ New Workflow"**
2. **Name**: `[DogBank] Scale Service`
3. **Description**: `Escala réplicas de um serviço específico`
4. **Trigger**: Manual

#### Inputs:
| Nome | Tipo | Descrição | Obrigatório | Default |
|------|------|-----------|-------------|---------|
| `service_name` | String | Nome do serviço (ex: chatbot-service) | ✅ Sim | - |
| `replicas` | Number | Número de réplicas desejado | ✅ Sim | - |

#### Step 1: HTTP Request
- **Method**: POST
- **URL**: `https://webhook.site/your-unique-id`

**Body**:
```json
{
  "action": "scale_deployment",
  "service": "{{ Trigger.service_name }}",
  "replicas": {{ Trigger.replicas }},
  "namespace": "dogbank",
  "cluster": "eks-sandbox-datadog"
}
```

5. **Save**

---

### Workflow 4: [DogBank-Sec] Account Takeover Response 🛡️

**Objetivo**: Responder automaticamente a ATO detectado pelo Datadog AAP / Cloud SIEM. Abre incident, bloqueia o usuário e (opcional) bloqueia o IP no AAP.

**Quando dispara**: signal de qualquer uma das regras `DogBank - Credential Stuffing`, `DogBank - High-value PIX after login`, `DogBank - Login from unexpected geo`, ou `DogBank - Post-exploit authenticated action` (criadas via `terraform apply` no `instrumented/docker/dogbank/datadog/terraform/asm-rules.tf`).

#### Configuração:
1. **"+ New Workflow"**
2. **Name**: `[DogBank-Sec] Account Takeover Response`
3. **Description**: `Bloqueia usuário comprometido e abre incident no Datadog Incident Management`
4. **Trigger**: **Security Signal** (não Manual)
   - **Filter (query)**: `@workflow.rule_name:"DogBank - Credential Stuffing" OR @workflow.rule_name:"DogBank - High-value PIX after login" OR @workflow.rule_name:"DogBank - Login from unexpected geo" OR @workflow.rule_name:"DogBank - Post-exploit authenticated action"`
   - **Severity filter**: `high` ou `critical`

#### Inputs (do signal — populados automaticamente):
| Campo | De onde vem |
|-------|-------------|
| `usr_id` | `{{ Source.attributes.attributes.usr.id }}` |
| `client_ip` | `{{ Source.attributes.attributes.network.client.ip }}` |
| `signal_id` | `{{ Source.id }}` |
| `signal_title` | `{{ Source.attributes.title }}` |
| `severity` | `{{ Source.attributes.severity }}` |

#### Step 1 — Create Incident (Datadog Incident Mgmt)
- **Action**: `Datadog → Incidents → Create incident`
- **Title**: `ATO suspeito (usr {{ Steps.Trigger.usr_id }}): {{ Steps.Trigger.signal_title }}`
- **Severity**: `{{ Steps.Trigger.severity }}` (mapear high→SEV-2, critical→SEV-1)
- **Customer impact**: `false` (por enquanto suspeita)
- **Notification handles**: `@security-team` (ajustar)
- **Attached signals**: `{{ Steps.Trigger.signal_id }}`

#### Step 2 — Block User (chamada HTTP ao auth-service)
- **Action**: `HTTP → POST`
- **URL**: `https://lab.dogbank.dog/api/auth/admin/block-user`
- **Headers**:
  ```json
  {
    "Content-Type": "application/json",
    "X-Admin-Token": "{{ secrets.ADMIN_BLOCK_TOKEN }}"
  }
  ```
- **Body**:
  ```json
  {
    "userId": "{{ Steps.Trigger.usr_id }}",
    "reason": "Datadog Signal {{ Steps.Trigger.signal_id }} - {{ Steps.Trigger.signal_title }}"
  }
  ```
- **Importante**: criar o secret `ADMIN_BLOCK_TOKEN` em **Workflow Automation → Settings → Secrets**, com o mesmo valor configurado no auth-service via env `DOGBANK_ADMIN_BLOCK_TOKEN` (ver `instrumented/k8s/base/secrets.yaml`).

#### Step 3 — Add note to signal (audit trail)
- **Action**: `Datadog → Security → Add note to signal`
- **Signal ID**: `{{ Steps.Trigger.signal_id }}`
- **Note**: `Workflow automatizado bloqueou usuário {{ Steps.Trigger.usr_id }} (incident {{ Steps.Step1.id }}). IP de origem: {{ Steps.Trigger.client_ip }}.`

#### Step 4 (opcional) — Notify Slack
- **Action**: `Slack → Send message`
- **Channel**: `#sec-incidents` (ou canal de demo)
- **Message**:
  ```
  🚨 ATO detectado e mitigado
  Usuário: {{ Steps.Trigger.usr_id }} (bloqueado)
  Regra: {{ Steps.Trigger.signal_title }}
  IP: {{ Steps.Trigger.client_ip }}
  Incident: {{ Steps.Step1.public_id }}
  Signal: https://app.datadoghq.com/security?event={{ Steps.Trigger.signal_id }}
  ```

5. **Save** + **Enable** (toggle no canto superior direito).

#### Teste manual (após salvar)
1. Force um credential stuffing rodando localmente:
   ```bash
   kubectl exec -it deploy/load-generator -n dogbank -- python -u -c "from security_attacker import SecurityAttacker; SecurityAttacker().attack_credential_stuffing()"
   ```
2. Aguarde ~2min o signal aparecer em https://app.datadoghq.com/security
3. Verifique se o workflow rodou em **Workflow Automation → History**
4. Verifique se o usuário foi bloqueado:
   ```bash
   kubectl exec -it deploy/postgres -n dogbank -- \
     psql -U dogbank -d dogbank -c "SELECT id, nome, blocked FROM usuarios WHERE blocked=true;"
   ```
5. Tente login com o usuário bloqueado pelo frontend → deve retornar **403 "Account temporarily blocked"**.
6. Para resetar: chame `/api/auth/admin/unblock-user` com o mesmo `X-Admin-Token`.

---

## 🎬 Passo 3: Testar os Workflows

### Setup: Obter URL do webhook.site
1. Acesse https://webhook.site
2. Copie sua URL única (ex: `https://webhook.site/abc123-def456`)
3. **IMPORTANTE**: Deixe essa aba aberta para ver os requests chegando

### Teste 1: Restart Pod
1. Na lista de workflows, clique em `[DogBank] Restart Pod`
2. Clique em **"Run"** (canto superior direito)
3. Preencha:
   - `pod_name`: `chatbot-service-xxxxx` (use um nome real)
   - `namespace`: `dogbank`
4. Clique em **"Run"**
5. **Verifique na aba do webhook.site** - você verá:
   ```json
   {
     "action": "delete_pod",
     "pod_name": "chatbot-service-xxxxx",
     "namespace": "dogbank",
     "cluster": "eks-sandbox-datadog"
   }
   ```

### Teste 2: Rollout Restart All
1. Workflow: `[DogBank] Rollout Restart All Services`
2. **"Run"**
3. `reason`: `Demo test`
4. Verifique payload no webhook.site

### Teste 3: Scale Service
1. Workflow: `[DogBank] Scale Service`
2. **"Run"**
3. Preencha:
   - `service_name`: `chatbot-service`
   - `replicas`: `2`
4. Verifique payload no webhook.site

---

## 🎯 Passo 4: Para DEMO (Opcional)

Os workflows já funcionam com webhook.site para demonstrações!

**No Service Map ou Monitors**:
- Quando houver um alerta, você pode executar o workflow manualmente
- Mostra como "resposta automatizada" a incidentes

**Pontos de destaque**:
- ✅ Ações auditadas (quem executou, quando, por quê)
- ✅ Sem acesso direto ao cluster (segurança)
- ✅ Pode ser integrado com monitores (automação futura)
- ✅ Reduz MTTR (Mean Time To Resolution)

---

## 🏭 Passo 5: Para PRODUÇÃO (Opcional)

Se quiser executar ações **reais** no cluster:

### 1. Deploy do Webhook Handler

**Arquivo**: `/Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s/scripts/webhook-handler.py`

```bash
# Criar deployment do webhook handler
kubectl create deployment webhook-handler --image=python:3.11-slim -n dogbank
kubectl expose deployment webhook-handler --port=8080 --type=LoadBalancer -n dogbank

# Obter URL externa
kubectl get svc webhook-handler -n dogbank
```

### 2. Atualizar Workflows

Substitua a URL do webhook.site pela URL real do webhook-handler:
- Ex: `http://<EXTERNAL-IP>:8080/webhook`

### 3. Configurar RBAC

O webhook handler precisa de permissões no cluster:

```yaml
# service-account.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: workflow-handler
  namespace: dogbank
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: workflow-handler-role
  namespace: dogbank
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "patch", "update"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: workflow-handler-binding
  namespace: dogbank
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: workflow-handler-role
subjects:
- kind: ServiceAccount
  name: workflow-handler
  namespace: dogbank
```

### 4. Testar em Staging Primeiro

**IMPORTANTE**: Nunca teste ações destrutivas em produção primeiro!

---

## ✅ Checklist

- [ ] Acessar Datadog Workflow Automation
- [ ] Obter URL do webhook.site
- [ ] Criar workflow: [DogBank] Restart Pod
- [ ] Criar workflow: [DogBank] Rollout Restart All Services
- [ ] Criar workflow: [DogBank] Scale Service
- [ ] Atualizar URLs nos 3 workflows
- [ ] Testar cada workflow manualmente
- [ ] Verificar payloads chegando no webhook.site
- [ ] (Opcional) Configurar para produção

---

## 🚨 Troubleshooting

### Não encontro "+ New Workflow"
- Certifique-se de estar em: **Automation** → **Workflow Automation**
- URL: https://app.datadoghq.com/workflow
- Você precisa ter permissões de admin/editor

### Workflow não executa
- Verifique se salvou o workflow
- Verifique se a URL do webhook está correta
- Teste a URL manualmente: `curl -X POST <URL> -d '{"test": true}'`

### Payload não chega no webhook.site
- Verifique se copiou a URL correta do webhook.site
- Recarregue a página do webhook.site
- Verifique logs do workflow no Datadog (aba "Executions")

---

## 🎉 Pronto!

Agora você tem 3 workflows funcionando no Datadog:
- ✅ Reiniciar pods individuais
- ✅ Rollout restart de todos os serviços
- ✅ Escalar serviços dinamicamente

**Tempo total**: ~5-10 minutos

**Para demo**: Use webhook.site (já funciona!)
**Para produção**: Deploy webhook-handler (ver Passo 5)
