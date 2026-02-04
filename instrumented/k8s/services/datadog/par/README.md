# DogBank - Private Action Runner (PAR)

Private Action Runner para executar comandos docker-compose via Datadog Workflow Automation.

## O que e o PAR?

O Private Action Runner permite que o Datadog execute comandos em sua infraestrutura de forma segura:
- Executa apenas comandos pre-aprovados (allowlist)
- Roda em pull mode (nao requer portas abertas)
- Todas as execucoes sao logadas

## Comandos Disponiveis

### Restart de Servicos
| Comando | Descricao |
|---------|-----------|
| `restart_transaction_service` | Reinicia transaction-service |
| `restart_pix_worker` | Reinicia pix-worker |
| `restart_auth_service` | Reinicia auth-service |
| `restart_chatbot_service` | Reinicia chatbot-service |
| `restart_account_service` | Reinicia account-service |
| `restart_bancocentral_service` | Reinicia bancocentral-service |
| `restart_fraud_detection` | Reinicia fraud-detection-service |

### Scaling
| Comando | Descricao |
|---------|-----------|
| `scale_pix_worker_3` | Escala pix-worker para 3 replicas |
| `scale_pix_worker_5` | Escala pix-worker para 5 replicas |
| `scale_pix_worker_1` | Reduz para 1 replica |

### Restart em Grupo
| Comando | Descricao |
|---------|-----------|
| `restart_all_backend` | Reinicia todos os servicos backend |
| `restart_messaging` | Reinicia Kafka, Zookeeper, RabbitMQ |

### Diagnostico
| Comando | Descricao |
|---------|-----------|
| `check_services_status` | Lista status dos containers |
| `check_service_logs_*` | Mostra logs dos servicos |
| `check_kafka_topics` | Lista topics do Kafka |

## Setup

### 1. Registrar PAR no Datadog

1. Acesse: **Organization Settings > Private Action Runners**
2. Clique em **+ New Private Action Runner**
3. Nome: `dogbank-par`
4. Copie o par de chaves gerado
5. Salve a private key em `config/private_key.pem`

### 2. Configurar Private Key

```bash
# Copie a private key do Datadog e salve:
cat > config/private_key.pem << 'EOF'
-----BEGIN PRIVATE KEY-----
<sua-private-key-aqui>
-----END PRIVATE KEY-----
EOF

# Ajuste permissoes
chmod 600 config/private_key.pem
```

### 3. Iniciar o PAR

```bash
# Certifique-se que a rede dogbank_default existe
docker network ls | grep dogbank_default

# Se nao existir, inicie os servicos primeiro:
cd ..
docker-compose -f docker-compose.full.yml up -d

# Volte e inicie o PAR
cd datadog/par
docker-compose up -d
```

### 4. Verificar Status

```bash
# Verificar logs
docker logs dogbank-private-action-runner

# Verificar conexao com Datadog
# O PAR deve aparecer como "Connected" em Organization Settings
```

## Criar Workflows

### Workflow 1: Auto-Restart Transaction Service

1. Acesse: **Service Management > Workflow Automation > New Workflow**
2. Nome: `[DogBank] Auto-Restart Transaction Service`
3. Trigger: Monitor `[DogBank] PIX - Alta Latencia P99` em ALERT

**Steps:**
1. **Slack** - Enviar mensagem: "Iniciando auto-remediacao do transaction-service..."
2. **Script** - Comando: `restart_transaction_service`
3. **Wait** - 60 segundos
4. **HTTP** - Verificar se monitor voltou ao normal
5. **Condition**:
   - Se OK: Slack "Servico recuperado automaticamente"
   - Se ALERT: Slack "Escalando para oncall" + criar ticket

### Workflow 2: Auto-Scale PIX Worker

1. Acesse: **Service Management > Workflow Automation > New Workflow**
2. Nome: `[DogBank] Auto-Scale PIX Worker`
3. Trigger: Monitor `[DogBank] Kafka - Consumer Lag Alto` > 1000

**Steps:**
1. **Slack** - "Kafka lag alto, escalando pix-worker..."
2. **Script** - Comando: `scale_pix_worker_3`
3. **Wait** - 5 minutos
4. **Condition**:
   - Se lag < 500: `scale_pix_worker_1` (normalizar)
   - Se lag >= 500: `scale_pix_worker_5` (escalar mais)

## Seguranca

- Apenas comandos na allowlist podem ser executados
- Docker socket montado read-only para o projeto
- Todas as execucoes sao logadas no Datadog
- RBAC controla quem pode criar/editar workflows

## Troubleshooting

### PAR nao conecta

```bash
# Verificar logs
docker logs dogbank-private-action-runner

# Verificar private key
ls -la config/private_key.pem

# Verificar rede
docker network inspect dogbank_default
```

### Comando falha

1. Verifique se o comando esta na allowlist (`config/credentials/script.yaml`)
2. Verifique se o path do docker-compose esta correto
3. Verifique logs do PAR

### Timeout

Aumente o timeout no `script.yaml` se necessario.

## Referencias

- [Private Actions Docs](https://docs.datadoghq.com/actions/private_actions/)
- [Run Script with PAR](https://docs.datadoghq.com/actions/private_actions/run_script/)
- [Workflow Automation](https://docs.datadoghq.com/actions/workflows/)
