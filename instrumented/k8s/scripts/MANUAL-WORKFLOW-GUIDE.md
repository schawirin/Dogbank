# Guia Rápido: Criar Workflows no Datadog (Manual - Para Demos)

## 🎯 Visão Geral

Vamos criar workflows no Datadog que permitem:
1. **Reiniciar um pod** específico
2. **Fazer rollout restart** de todos os serviços
3. **Escalar serviços** (aumentar/diminuir réplicas)

## ⚡ Setup Rápido para Demos (5 minutos)

### Passo 1: Configurar Webhook de Teste

1. Acesse https://webhook.site
2. Copie sua URL única (ex: `https://webhook.site/abc123...`)
3. **Guarde essa URL** - você vai usar nos workflows

> 💡 **Para demos**: O webhook.site só mostra os requests, não executa ações reais. Perfeito para demonstrar o funcionamento!

### Passo 2: Criar Workflows no Datadog

#### 2.1. Workflow: Rollout Restart All Services

1. Acesse **Datadog → Workflow Automation**
2. Clique em **"New Workflow"**
3. Configure:
   - **Name**: `[DogBank] Rollout Restart All Services`
   - **Description**: `Faz rollout restart de todos os serviços`
   - **Tags**: `env:dogbank`, `team:sre`, `automation:deployment`

4. **Adicionar Trigger** (Manual):
   - Clique em **"Add Trigger"**
   - Selecione **"Manual"**
   - Adicione input opcional:
     - **Name**: `reason`
     - **Type**: `String`
     - **Description**: `Motivo do restart`
     - **Default**: `Manual restart via Datadog`

5. **Adicionar Ação HTTP**:
   - Clique no **"+"** depois do trigger
   - Selecione **"HTTP"**
   - Configure:
     - **Name**: `Execute Rollout Restart`
     - **Method**: `POST`
     - **URL**: `[COLE SUA URL DO WEBHOOK.SITE]`
     - **Headers**:
       ```
       Content-Type: application/json
       ```
     - **Body**:
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
         "reason": "{{ Context.Workflow.reason }}"
       }
       ```

6. **Adicionar Notificação** (opcional):
   - Adicione outro step tipo **"Notification"**
   - Configure:
     - **Title**: `Rollout Restart Iniciado`
     - **Message**:
       ```
       🚀 Rollout restart de todos os serviços DogBank iniciado!

       Motivo: {{ Context.Workflow.reason }}
       ```
     - **Recipients**: `@seu-email` ou `@slack-channel`

7. Clique em **"Save"**

#### 2.2. Workflow: Restart Pod

1. Criar novo workflow: `[DogBank] Restart Pod`

2. **Trigger Manual** com inputs:
   - **pod_name** (String, Required): Nome do pod
   - **namespace** (String, Default: "dogbank"): Namespace

3. **HTTP Action**:
   ```json
   {
     "action": "delete_pod",
     "pod_name": "{{ Context.Workflow.pod_name }}",
     "namespace": "{{ Context.Workflow.namespace }}",
     "cluster": "eks-sandbox-datadog"
   }
   ```

#### 2.3. Workflow: Scale Service

1. Criar novo workflow: `[DogBank] Scale Service`

2. **Trigger Manual** com inputs:
   - **service_name** (String, Required): Nome do serviço
   - **replicas** (Number, Required): Número de réplicas

3. **HTTP Action**:
   ```json
   {
     "action": "scale_deployment",
     "service": "{{ Context.Workflow.service_name }}",
     "replicas": {{ Context.Workflow.replicas }},
     "namespace": "dogbank",
     "cluster": "eks-sandbox-datadog"
   }
   ```

### Passo 3: Testar os Workflows

1. Acesse **Datadog → Workflows**
2. Clique em um workflow (ex: "Rollout Restart All")
3. Clique em **"Run"** (canto superior direito)
4. Preencha os parâmetros se necessário
5. Clique em **"Run"**
6. **Verifique no webhook.site** - você verá o payload JSON que foi enviado!

## 🎬 Executando Durante a Demo

### Demo 1: Restart All Services (Simples)

1. **Navegue até**: Datadog → Workflows
2. **Abra**: `[DogBank] Rollout Restart All Services`
3. **Clique**: "Run"
4. **Mostre** na tela do webhook.site o request sendo recebido
5. **Explique**:
   - "Este workflow enviaria o comando para o cluster EKS"
   - "Em produção, o handler executaria `kubectl rollout restart` para cada serviço"
   - "Pods seriam recriados sem downtime (rolling update)"

### Demo 2: Restart Pod com Monitor

1. **Mostre um monitor** com alerta ativo (ex: high latency)
2. **Vá até**: Workflows → `[DogBank] Restart Pod`
3. **Execute** passando o nome do pod problemático
4. **Explique**:
   - "Detectamos latência alta no chatbot-service"
   - "Vamos reiniciar o pod via workflow do Datadog"
   - "O Kubernetes criará um novo pod automaticamente"
   - "Em produção, isso pode resolver problemas de memory leak, conexões travadas, etc"

### Demo 3: Scale Service

1. **Mostre** métrica de CPU/Requests alta
2. **Execute**: `[DogBank] Scale Service`
   - **service_name**: `chatbot-service`
   - **replicas**: `3`
3. **Explique**:
   - "Detectamos aumento de tráfego"
   - "Vamos escalar de 1 para 3 réplicas"
   - "Load balancer distribuirá o tráfego automaticamente"

## 🔗 Integrando Workflows com Monitores

Para executar workflows automaticamente quando um monitor alertar:

1. **Edite um monitor** existente
2. Na seção **"Say what's happening"**, adicione:
   ```
   {{#is_alert}}
   @workflow-[DogBank]-Restart-Pod("pod_name":"chatbot-service-xxx", "namespace":"dogbank")
   {{/is_alert}}
   ```

3. O workflow será executado automaticamente quando o monitor entrar em alerta!

## 🏗️ Para Produção (Deploy Real do Handler)

Se quiser executar ações reais no cluster:

1. **Deploy o webhook-handler.py** (ver `WORKFLOW-SETUP.md`)
2. **Substitua** a URL do webhook.site pela URL do seu handler
3. **Configure** credenciais AWS no handler
4. **Teste** cada workflow em ambiente de staging primeiro

### Opções de Deploy:

**Opção A: Servidor simples no cluster**
```bash
# Deploy como pod no cluster com permissões RBAC
kubectl apply -f workflow-handler-deployment.yaml
```

**Opção B: AWS Lambda**
```bash
# Deploy como função Lambda com acesso ao EKS
aws lambda create-function ...
```

**Opção C: Cloud Run / App Engine**
```bash
# Deploy em qualquer platform-as-a-service
gcloud run deploy workflow-handler ...
```

## 📋 Checklist

Para demos:
- [ ] Criar conta no webhook.site
- [ ] Copiar URL única
- [ ] Criar 3 workflows no Datadog
- [ ] Testar cada workflow
- [ ] Abrir webhook.site em aba separada para mostrar na demo

Para produção:
- [ ] Deploy webhook handler
- [ ] Configurar RBAC no cluster
- [ ] Configurar credentials AWS
- [ ] Atualizar URL nos workflows
- [ ] Testar em staging
- [ ] Integrar com monitores críticos

## 💡 Dicas para Demos

1. **Abra 2 abas**:
   - Aba 1: Datadog Workflows
   - Aba 2: webhook.site mostrando requests

2. **Prepare os workflows** antes da demo (já criados e testados)

3. **Tenha exemplos prontos**:
   - Nome de pod real do cluster
   - Serviços que estão rodando
   - Métricas mostrando "problema"

4. **Explique o valor**:
   - "Reduz MTTR (Mean Time To Resolution)"
   - "Ações consistentes e auditadas"
   - "Não precisa acesso direto ao cluster"
   - "Integração com alertas e incident management"

## 🎯 Workflows Úteis para Adicionar

Depois dos básicos, considere adicionar:

- **Get Pod Logs**: Buscar logs do pod com erro
- **Describe Pod**: Ver eventos e status
- **Emergency Scale Down**: Reduzir réplicas rapidamente
- **Clear Cache**: Limpar cache (Redis/Memcached)
- **Database Rollback**: Rollback de migration

## 📚 Recursos

- [Datadog Workflow Automation Docs](https://docs.datadoghq.com/workflows/)
- [HTTP Action Reference](https://docs.datadoghq.com/workflows/actions/#http)
- [Workflow Triggers](https://docs.datadoghq.com/workflows/triggers/)
