# Service Map - Fix de Alertas não Refletidos

## Problema Identificado

O Service Map do Datadog está mostrando **todos os serviços em verde** mesmo com monitores alertando. Isso acontece porque:

### Como Funciona o Service Map

O Service Map muda a cor dos serviços baseado em:

1. **Monitores com tag `service:xxx`** - ✅ **Já configurado**
2. **Estado do monitor ALERT ou WARNING** - ❌ **Problema aqui**
3. **Correspondência exata do nome do serviço** entre monitor e APM

### Root Cause

Os monitores estão criados corretamente, MAS:
- Podem estar em estado **OK** (não alertando)
- Podem estar em estado **No Data** (sem dados para avaliar)
- Os nomes dos serviços podem não corresponder exatamente

## Diagnóstico

### 1. Verificar Estado dos Monitores

No Datadog UI:
1. Ir para **Monitors → Manage Monitors**
2. Filtrar por: `tag:env:dogbank`
3. Verificar quantos estão em:
   - 🟢 **OK** - Monitor não está alertando
   - 🔴 **ALERT** - Monitor alertando (deveria aparecer no mapa)
   - 🟡 **WARN** - Monitor em warning (deveria aparecer no mapa)
   - ⚪ **No Data** - Monitor sem dados (não aparece no mapa)

### 2. Verificar Nomes dos Serviços no APM

No Datadog UI:
1. Ir para **APM → Service Catalog**
2. Filtrar por: `env:dogbank`
3. Anotar os nomes EXATOS dos serviços

Exemplo de nomes esperados:
- `transaction-service`
- `auth-service`
- `account-service`
- `bancocentral-service`
- `chatbot-service`
- `pix-worker`

## Solução

### Opção 1: Ajustar Thresholds dos Monitores (Recomendado para Demo)

Para **demonstrações**, podemos ajustar os thresholds para que os monitores alertem mais facilmente:

#### Mudança nos Monitores de Error Rate

**Arquivo**: `/Users/pedro.schawirin/Documents/Dogbank/instrumented/docker/dogbank/datadog/terraform/monitors.tf`

**Localizar** (exemplo transaction-service, linhas 463-466):
```hcl
monitor_thresholds {
  critical = 5      # 5% error rate
  warning  = 2      # 2% error rate
}
```

**Mudar para**:
```hcl
monitor_thresholds {
  critical = 1      # 1% error rate (mais sensível)
  warning  = 0.5    # 0.5% error rate
}
```

#### Mudança nos Monitores de Latency

**Localizar** (exemplo transaction-service, linhas 504-507):
```hcl
monitor_thresholds {
  critical = 1      # 1 segundo
  warning  = 0.5    # 500ms
}
```

**Mudar para**:
```hcl
monitor_thresholds {
  critical = 0.5    # 500ms (mais sensível)
  warning  = 0.3    # 300ms
}
```

Depois aplicar:
```bash
cd /Users/pedro.schawirin/Documents/Dogbank/instrumented/docker/dogbank/datadog/terraform
terraform apply
```

### Opção 2: Verificar e Corrigir Nomes dos Serviços

Se os nomes não correspondem, precisamos ajustá-los.

#### Passo 1: Listar serviços no APM

Via API do Datadog:
```bash
export DD_API_KEY="sua-api-key"
export DD_APP_KEY="sua-app-key"

curl -X GET "https://api.datadoghq.com/api/v1/apm/services?env=dogbank" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}"
```

#### Passo 2: Ajustar tags nos monitores

Se um serviço aparecer como `dogbank-transaction-service` no APM, mas o monitor tem `service:transaction-service`, precisamos ajustar.

**No monitors.tf**, mudar:
```hcl
tags = concat(local.common_tags, [
  "service:transaction-service",  # Deve corresponder exatamente ao APM
  "team:dogbank-backend",
  "severity:high"
])
```

### Opção 3: Forçar Alertas para Demonstração

Para **demonstração imediata**, podemos criar monitores de teste que sempre alertam:

```hcl
# Monitor de teste que sempre alerta
resource "datadog_monitor" "demo_alert_test" {
  name    = "[DEMO] Test Alert - Transaction Service"
  type    = "query alert"
  message = "Monitor de teste para demo do Service Map"

  query = "avg(last_5m):avg:system.cpu.user{*} > 0"  # Sempre verdadeiro

  monitor_thresholds {
    critical = 0
  }

  tags = [
    "env:dogbank",
    "service:transaction-service",  # Faz o serviço ficar vermelho
    "demo:true"
  ]
}
```

## Verificação

### 1. Aguardar Propagação (5-10 minutos)

Após aplicar mudanças no Terraform:
```bash
# Aguardar 5-10 minutos
sleep 300

# Verificar no Service Map
```

### 2. Verificar Service Map

1. Ir para **APM → Service Map**
2. Filtrar por: `env:dogbank`
3. Verificar cores dos serviços:
   - 🟢 Verde = Sem alertas
   - 🟡 Amarelo = Warning
   - 🔴 Vermelho = Critical

### 3. Verificar Detalhes do Serviço

Clicar em um serviço no mapa:
- Deveria mostrar monitores associados
- Deveria mostrar estado dos monitores
- Deveria mostrar SLOs

## Configuração Atual dos Monitores

### Monitores Configurados por Serviço

| Serviço | Monitores | Tags |
|---------|-----------|------|
| transaction-service | Error Rate, Latency P99 | `service:transaction-service` |
| bancocentral-service | Error Rate, Latency P99 | `service:bancocentral-service` |
| auth-service | Error Rate, Latency P99 | `service:auth-service` |
| account-service | Error Rate, Latency P99 | `service:account-service` |
| chatbot-service | Error Rate, Latency P99, Rate Limit | `service:chatbot-service` |
| pix-worker | Error Rate, Latency P99 | `service:pix-worker` |

### Thresholds Atuais

**Error Rate**:
- Critical: 5%
- Warning: 2%

**Latency P99**:
- Critical: 1s (chatbot: 3s)
- Warning: 0.5s (chatbot: 2s)

## Troubleshooting

### Problema: Nenhum serviço muda de cor

**Causa**: Monitores não estão alertando
**Solução**:
1. Verificar se há tráfego APM nos serviços
2. Verificar se load generator está rodando
3. Reduzir thresholds dos monitores (Opção 1)

### Problema: Apenas alguns serviços mudam de cor

**Causa**: Nomes não correspondem
**Solução**:
1. Listar serviços no APM (Opção 2, Passo 1)
2. Ajustar tags nos monitores (Opção 2, Passo 2)
3. Aplicar Terraform novamente

### Problema: Serviços ficam cinza

**Causa**: Monitores em estado "No Data"
**Solução**:
1. Verificar se serviços estão enviando traces
2. Aguardar alguns minutos para coleta de dados
3. Verificar se agent está coletando APM metrics

## Scripts Úteis

### Script para Verificar Estado dos Monitores

```bash
#!/bin/bash
# check-monitor-status.sh

export DD_API_KEY="sua-api-key"
export DD_APP_KEY="sua-app-key"

curl -X GET "https://api.datadoghq.com/api/v1/monitor?tags=env:dogbank" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" | jq '.[] | {name: .name, state: .overall_state, service: (.tags[] | select(startswith("service:")))}'
```

### Script para Listar Serviços APM

```bash
#!/bin/bash
# list-apm-services.sh

export DD_API_KEY="sua-api-key"
export DD_APP_KEY="sua-app-key"

curl -X GET "https://api.datadoghq.com/api/v1/apm/services?env=dogbank" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" | jq '.data[].id'
```

## Recomendação para Produção

Para ambientes de produção, mantenha os thresholds originais:
- Error Rate Critical: 5%
- Error Rate Warning: 2%
- Latency P99 Critical: 1s
- Latency P99 Warning: 0.5s

Para **demos**, use thresholds mais sensíveis para garantir que alertas apareçam no Service Map.

## Próximos Passos

1. **Aplicar Opção 1** - Ajustar thresholds para demo
2. **Aguardar 10 minutos** - Permitir propagação
3. **Verificar Service Map** - Confirmar que alertas aparecem
4. **Documentar** - Adicionar ao runbook de demos

## Referências

- [Datadog Service Map Documentation](https://docs.datadoghq.com/tracing/services/service_map/)
- [Monitor Tagging Best Practices](https://docs.datadoghq.com/monitors/manage/#monitor-tags)
- [APM Service Tagging](https://docs.datadoghq.com/getting_started/tagging/unified_service_tagging/)
