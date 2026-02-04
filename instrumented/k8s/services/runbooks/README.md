# Runbooks Operacionais - DogBank

Documentacao operacional para troubleshooting e remediacao de incidentes.
Estes runbooks sao utilizados pelo **Datadog Bits AI SRE** para investigacao automatizada.

## Servicos

| Servico | Team | Runbook |
|---------|------|---------|
| auth-service | security | [auth-service.md](auth-service.md) |
| account-service | accounts | [account-service.md](account-service.md) |
| transaction-service | pix | [transaction-service.md](transaction-service.md) |
| pix-worker | pix | [pix-worker.md](pix-worker.md) |
| fraud-detection-service | security | [fraud-detection-service.md](fraud-detection-service.md) |
| chatbot-service | ai | [chatbot-service.md](chatbot-service.md) |

## Contatos

| Team | Slack | Email |
|------|-------|-------|
| platform | #platform-oncall | platform@dogbank.com |
| security | #security-oncall | security@dogbank.com |
| pix | #pix-oncall | pix@dogbank.com |
| accounts | #accounts-oncall | accounts@dogbank.com |
| ai | #ai-oncall | ai@dogbank.com |
| frontend | #frontend-oncall | frontend@dogbank.com |

## Escalation

1. **P1 (Critico)**: Ligar para oncall imediatamente
2. **P2 (Alto)**: Notificar Slack + investigar em 15min
3. **P3 (Medio)**: Investigar no proximo horario comercial
4. **P4 (Baixo)**: Backlog para proxima sprint
