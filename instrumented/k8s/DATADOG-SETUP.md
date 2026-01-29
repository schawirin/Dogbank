# 🐕 Instalação do Datadog no Kubernetes (EKS)

Este guia mostra a **melhor forma** de instalar o Datadog Agent no cluster Kubernetes usando o **Datadog Operator**.

## 📋 Pré-requisitos

1. ✅ Cluster Kubernetes/EKS funcionando
2. ✅ `kubectl` configurado
3. ✅ `helm` instalado
4. ✅ Conta Datadog com API Key

## 🚀 Instalação Recomendada (via Operator)

Esta é a forma recomendada pela Datadog, usando código gerado diretamente no console do Datadog.

### Passo 1: Adicionar o Helm Repository

```bash
helm repo add datadog https://helm.datadoghq.com
helm repo update
```

### Passo 2: Instalar o Datadog Operator

```bash
helm install datadog-operator datadog/datadog-operator
```

Aguarde o Operator ficar pronto:
```bash
kubectl wait --for=condition=Available --timeout=120s deployment/datadog-operator -n default
```

### Passo 3: Criar o Secret com a API Key

**IMPORTANTE**: Substitua `YOUR_API_KEY` pela sua API Key do Datadog (disponível em: https://app.datadoghq.com/organization-settings/api-keys)

```bash
kubectl create secret generic datadog-secret --from-literal api-key=YOUR_API_KEY
```

### Passo 4: Aplicar o DatadogAgent

Aplique o arquivo `datadog-agent.yaml`:

```bash
kubectl apply -f base/datadog-agent.yaml
```

## ✅ Verificação

### 1. Verificar pods do Datadog

```bash
kubectl get pods -n default | grep datadog
```

Você deve ver:
- 1 pod `datadog-operator` (Running)
- 1 pod `datadog-cluster-agent` (Running)
- N pods `datadog-agent` (Running, onde N = número de nodes)

### 2. Verificar o DatadogAgent CR

```bash
kubectl get datadogagent -n default
```

Status esperado: `Ready`

### 3. Verificar logs

```bash
# Logs do Cluster Agent
kubectl logs -n default deployment/datadog-cluster-agent --tail=50

# Logs de um Agent (escolha qualquer pod)
kubectl logs -n default daemonset/datadog-agent --tail=50
```

## 🔧 Configuração Incluída

O arquivo `datadog-agent.yaml` habilita:

### APM & Tracing
- ✅ Instrumentação automática (Java, Python, JS, PHP, .NET, Ruby)
- ✅ Profiling habilitado
- ✅ Data Streams Monitoring (Kafka/RabbitMQ)

### Logs
- ✅ Log Collection de todos os containers

### OpenTelemetry
- ✅ OpenTelemetry Collector (portas 4317 GRPC e 4318 HTTP)

### Security
- ✅ Application Security Management (ASM):
  - Threat Detection
  - Software Composition Analysis (SCA)
  - Interactive Application Security Testing (IAST)
- ✅ Cloud Workload Security (CWS)
- ✅ Cloud Security Posture Management (CSPM)
- ✅ Software Bill of Materials (SBOM)

### Infrastructure
- ✅ Universal Service Monitoring (USM)
- ✅ Network Performance Monitoring (NPM)
- ✅ Live Process Collection
- ✅ Orchestrator Explorer
- ✅ Cluster Checks

## 📊 Acessando o Datadog

Após a instalação, acesse o console do Datadog:

- **APM**: https://app.datadoghq.com/apm/traces
- **Infrastructure**: https://app.datadoghq.com/infrastructure
- **Logs**: https://app.datadoghq.com/logs
- **Security**: https://app.datadoghq.com/security

Filtros úteis:
- `env:dogbank` - Ver apenas o ambiente DogBank
- `kube_cluster_name:dogbank` - Filtrar pelo cluster

## 🔄 Atualização

Para atualizar a configuração:

1. Edite o arquivo `base/datadog-agent.yaml`
2. Aplique as mudanças:
```bash
kubectl apply -f base/datadog-agent.yaml
```

O Operator vai automaticamente atualizar os pods.

## 🗑️ Desinstalação

Para remover completamente o Datadog:

```bash
# 1. Deletar o DatadogAgent
kubectl delete datadogagent datadog -n default

# 2. Deletar o Secret
kubectl delete secret datadog-secret -n default

# 3. Desinstalar o Operator
helm uninstall datadog-operator

# 4. (Opcional) Deletar os CRDs
kubectl delete crd datadogagents.datadoghq.com
kubectl delete crd datadogmetrics.datadoghq.com
kubectl delete crd datadogmonitors.datadoghq.com
kubectl delete crd datadogpodautoscalers.datadoghq.com
```

## 🆘 Troubleshooting

### Pods não ficam prontos

```bash
# Ver eventos do cluster
kubectl get events -n default --sort-by='.lastTimestamp' | grep datadog

# Ver logs do Operator
kubectl logs -n default deployment/datadog-operator

# Ver detalhes de um pod específico
kubectl describe pod -n default <pod-name>
```

### API Key inválida

Se você ver erro `Unauthorized`, verifique a API Key:

```bash
# Ver o secret
kubectl get secret datadog-secret -n default -o yaml

# Recriar o secret com a API Key correta
kubectl delete secret datadog-secret -n default
kubectl create secret generic datadog-secret --from-literal api-key=YOUR_NEW_API_KEY

# Reiniciar os pods
kubectl rollout restart daemonset/datadog-agent -n default
kubectl rollout restart deployment/datadog-cluster-agent -n default
```

## 📚 Documentação Adicional

- [Datadog Operator](https://github.com/DataDog/datadog-operator)
- [Datadog Kubernetes](https://docs.datadoghq.com/containers/kubernetes/)
- [APM Kubernetes](https://docs.datadoghq.com/tracing/trace_collection/automatic_instrumentation/dd_libraries/kubernetes/)

---

**Nota**: Esta configuração usa **todos os recursos do Datadog**. Para ambientes de produção com alto volume, considere ajustar as configurações de acordo com suas necessidades específicas.
