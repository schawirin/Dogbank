# Como Criar Workflows no Datadog - Guia Rápido

## ❌ Problema: Workflows Não Foram Criados Automaticamente

O script Python (`create-datadog-workflows.py`) **falhou** com erro 403:
```
actions API access is not enabled on this application key
```

**Motivo**: A App Key do Datadog não tem permissões suficientes para criar workflows via API.

## ✅ Solução: Criar Workflows Manualmente na UI

Você precisa criar os workflows **manualmente** pela interface do Datadog.

### Opção 1: Para Demos Rápidas (RECOMENDADO) 🎯

Use webhook.site para testar os workflows sem precisar deployar um handler real:

#### Passo 1: Criar Webhook de Teste

1. Acesse https://webhook.site
2. Copie sua URL única (exemplo: `https://webhook.site/abc123-def456-ghi789`)
3. **Deixe essa aba aberta** - você vai ver os requests chegando

#### Passo 2: Criar Workflows no Datadog

1. Acesse **Datadog → Workflow Automation**:
   https://app.datadoghq.com/workflow

2. Clique em **"+ New Workflow"** (canto superior direito)

3. **Configure 3 workflows:**

---

### Workflow 1: [DogBank] Restart Pod

**Name**: `[DogBank] Restart Pod`
**Description**: `Reinicia um pod específico do DogBank no EKS`

**Trigger**: Manual
- Input 1:
  - Name: `pod_name`
  - Type: String
  - Description: `Nome do pod a ser reiniciado`
  - Required: ✅

- Input 2:
  - Name: `namespace`
  - Type: String
  - Description: `Namespace do pod`
  - Default: `dogbank`

**Step 1: HTTP Request**
- Action: HTTP
- Method: POST
- URL: `[COLE SUA URL DO WEBHOOK.SITE AQUI]`
- Headers:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- Body:
  ```json
  {
    "action": "delete_pod",
    "pod_name": "{{ Trigger.pod_name }}",
    "namespace": "{{ Trigger.namespace }}",
    "cluster": "eks-sandbox-datadog"
  }
  ```

Clique em **"Save"**

---

### Workflow 2: [DogBank] Rollout Restart All Services

**Name**: `[DogBank] Rollout Restart All Services`
**Description**: `Faz rollout restart de todos os serviços do DogBank`

**Trigger**: Manual
- Input:
  - Name: `reason`
  - Type: String
  - Description: `Motivo do restart`
  - Default: `Manual restart via Datadog`

**Step 1: HTTP Request**
- Action: HTTP
- Method: POST
- URL: `[COLE SUA URL DO WEBHOOK.SITE AQUI]`
- Headers:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- Body:
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

Clique em **"Save"**

---

### Workflow 3: [DogBank] Scale Service

**Name**: `[DogBank] Scale Service`
**Description**: `Escala réplicas de um serviço específico`

**Trigger**: Manual
- Input 1:
  - Name: `service_name`
  - Type: String
  - Description: `Nome do serviço (ex: chatbot-service)`
  - Required: ✅

- Input 2:
  - Name: `replicas`
  - Type: Number
  - Description: `Número de réplicas desejado`
  - Required: ✅

**Step 1: HTTP Request**
- Action: HTTP
- Method: POST
- URL: `[COLE SUA URL DO WEBHOOK.SITE AQUI]`
- Headers:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- Body:
  ```json
  {
    "action": "scale_deployment",
    "service": "{{ Trigger.service_name }}",
    "replicas": {{ Trigger.replicas }},
    "namespace": "dogbank",
    "cluster": "eks-sandbox-datadog"
  }
  ```

Clique em **"Save"**

---

## 🎬 Testando os Workflows

1. Na lista de workflows, clique em um workflow que você criou
2. Clique em **"Run"** (canto superior direito)
3. Preencha os parâmetros solicitados
4. Clique em **"Run"**
5. **Verifique na aba do webhook.site** - você verá o payload JSON!

### Exemplo de Request no webhook.site:

```json
{
  "action": "rollout_restart_all",
  "namespace": "dogbank",
  "cluster": "eks-sandbox-datadog",
  "services": ["account-service", "transaction-service", ...],
  "reason": "Demo test"
}
```

## 🎯 Para Demos

**Roteiro sugerido:**

1. **Mostre um problema** no Datadog (ex: high latency monitor)
2. **Explique**: "Vamos reiniciar o serviço problemático usando Workflow Automation"
3. **Abra** o workflow `[DogBank] Restart Pod`
4. **Preencha**: pod_name = `chatbot-service-xxxx`
5. **Execute** o workflow
6. **Mostre** o request chegando no webhook.site
7. **Explique**: "Em produção, isso executaria `kubectl delete pod` no cluster EKS automaticamente"

**Pontos-chave para mencionar:**
- ✅ Ações auditadas e rastreáveis
- ✅ Não precisa acesso direto ao cluster (segurança)
- ✅ Pode ser integrado com monitores (automação)
- ✅ Reduz MTTR (Mean Time To Resolution)

## 🏗️ Para Produção (Opcional)

Se quiser executar ações **reais** no cluster:

1. Deploy o `webhook-handler.py` (ver `WORKFLOW-SETUP.md`)
2. Substitua a URL do webhook.site pela URL do seu handler
3. Configure RBAC permissions no cluster
4. Teste em staging primeiro

**Arquivo de referência**: `/Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s/scripts/WORKFLOW-SETUP.md`

## 📚 Documentação Completa

Para mais detalhes sobre workflows e opções de deployment:

- **Manual completo**: `MANUAL-WORKFLOW-GUIDE.md`
- **Setup técnico**: `WORKFLOW-SETUP.md`
- **Handler Python**: `webhook-handler.py`

## 🚨 Troubleshooting

**Problema**: Não consigo encontrar o botão "+ New Workflow"

**Solução**: Certifique-se de estar em:
- Datadog → **Actions** → **Workflow Automation**
- URL: https://app.datadoghq.com/workflow

**Problema**: Workflow criado não aparece na lista

**Solução**:
- Clique em "All Workflows" (não "Blueprints")
- Use a busca: `[DogBank]`
- Verifique o toggle "My workflows"

**Problema**: Workflow não executa (erro de permissão)

**Solução**:
- Webhooks públicos (webhook.site) não precisam de auth
- Se usar handler próprio, configure `X-Webhook-Secret` header

## ✅ Checklist

- [ ] Criar conta no webhook.site e copiar URL
- [ ] Criar workflow: [DogBank] Restart Pod
- [ ] Criar workflow: [DogBank] Rollout Restart All Services
- [ ] Criar workflow: [DogBank] Scale Service
- [ ] Testar cada workflow manualmente
- [ ] Verificar requests chegando no webhook.site
- [ ] Preparar roteiro de demo

Pronto para demonstrar Workflow Automation! 🎉
