# DogBank - Datadog Terraform Configuration

Configuração de Monitors e Notebooks no Datadog via Terraform para suporte ao **Bits AI SRE**.

## Pré-requisitos

1. [Terraform](https://www.terraform.io/downloads) instalado (>= 1.0)
2. Datadog API Key e APP Key
3. Acesso à conta Datadog

## Recursos Criados

### Monitors (10)

| Monitor | Tipo | Descrição |
|---------|------|-----------|
| PIX Latência P99 | metric alert | Alerta quando latência PIX > 2000ms |
| Error Rate | query alert | Alerta quando erro > 5% |
| Auth Failures | metric alert | Alerta em falhas de autenticação |
| SQL Injection | event-v2 alert | Detecta ataques SQL injection (ASM) |
| RCE/Command Injection | event-v2 alert | Detecta ataques de RCE (ASM) |
| Prompt Injection | log alert | Detecta ataques no chatbot LLM |
| Kafka Consumer Lag | metric alert | Alerta quando lag > 1000 |
| RabbitMQ Queue Depth | metric alert | Alerta quando fila > 500 msgs |
| PostgreSQL Connections | metric alert | Alerta conexões > 80% |
| Service Health | service check | Alerta quando serviços down |

### Notebooks (4)

| Notebook | Descrição |
|----------|-----------|
| PIX Investigation Runbook | Investigação de problemas PIX |
| Security Investigation Runbook | Investigação de incidentes de segurança |
| LLM/Chatbot Investigation Runbook | Investigação de problemas do chatbot |
| Infrastructure Overview | Visão geral da infraestrutura |

## Como Usar

### 1. Configurar Credenciais

```bash
export TF_VAR_datadog_api_key="sua-api-key"
export TF_VAR_datadog_app_key="sua-app-key"
```

Ou crie um arquivo `terraform.tfvars`:

```hcl
datadog_api_key = "sua-api-key"
datadog_app_key = "sua-app-key"
datadog_site    = "datadoghq.com"  # ou datadoghq.eu
environment     = "dogbank"
```

**IMPORTANTE**: Nunca commite `terraform.tfvars` no git!

### 2. Inicializar Terraform

```bash
cd instrumented/docker/dogbank/datadog/terraform
terraform init
```

### 3. Verificar o Plano

```bash
terraform plan
```

### 4. Aplicar

```bash
terraform apply
```

### 5. Destruir (se necessário)

```bash
terraform destroy
```

## Estrutura de Arquivos

```
datadog/terraform/
├── README.md           # Este arquivo
├── main.tf             # Provider configuration
├── variables.tf        # Variáveis
├── monitors.tf         # Definição dos monitors
└── notebooks.tf        # Definição dos notebooks
```

## Bits AI SRE Integration

Os monitors foram configurados com mensagens detalhadas que incluem:

1. **Descrição do problema**: O que está acontecendo
2. **Passos de investigação**: Como investigar
3. **Links para runbooks**: Notebooks relacionados
4. **Notificações**: @slack-oncall, @pagerduty-security

O Bits AI SRE usa essas informações para:
- Entender o contexto do alerta
- Executar investigações automáticas
- Sugerir ações de remediação
- Acessar runbooks relevantes

## Customização

### Adicionar Novo Monitor

```hcl
resource "datadog_monitor" "my_monitor" {
  name    = "[DogBank] Meu Monitor"
  type    = "metric alert"
  message = <<-EOT
    ## Descrição do problema

    ### Investigação
    1. Passo 1
    2. Passo 2

    @slack-oncall
  EOT

  query = "avg(last_5m):avg:minha.metrica{env:dogbank} > 100"

  monitor_thresholds {
    critical = 100
    warning  = 50
  }

  tags = concat(local.common_tags, ["team:meu-time"])
}
```

### Adicionar Notebook Cell

```hcl
cell {
  cell_type = "timeseries"
  timeseries_cell_definition {
    title = "Minha Métrica"
    requests {
      q            = "avg:minha.metrica{env:${var.environment}}"
      display_type = "line"
    }
  }
}
```

## Referências

- [Terraform Datadog Provider](https://registry.terraform.io/providers/DataDog/datadog/latest/docs)
- [Datadog Monitors](https://docs.datadoghq.com/monitors/)
- [Datadog Notebooks](https://docs.datadoghq.com/notebooks/)
- [Bits AI SRE](https://docs.datadoghq.com/bits_ai/)
