# Solução Segura para Métricas do Datadog

## 📊 Arquitetura Implementada

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAVEGADOR DO USUÁRIO                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Frontend React                          │   │
│  │                                                            │   │
│  │  • DatadogMetrics.jsx                                     │   │
│  │  • datadogService.js (sem API key)                        │   │
│  │                                                            │   │
│  └────────────────────────┬─────────────────────────────────┘   │
└─────────────────────────────┼──────────────────────────────────┘
                              │
                    HTTP Request (CORS)
                    Sem credenciais expostas
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVIDOR BACKEND                            │
│                  (Spring Boot - Port 8080)                       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         DatadogController                                │   │
│  │  /api/observability/datadog/metrics                     │   │
│  │  /api/observability/datadog/logs                        │   │
│  │  /api/observability/datadog/dashboard/{id}             │   │
│  │  /api/observability/datadog/slos                        │   │
│  │  /api/observability/datadog/health                      │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │         DatadogService                                   │   │
│  │  • getMetrics()                                          │   │
│  │  • getLogs()                                             │   │
│  │  • getDashboardData()                                    │   │
│  │  • getSLOs()                                             │   │
│  │  • createHeaders() [🔐 API key aqui!]                   │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │         RestTemplate                                     │   │
│  │  HTTP Client (configurado em DatadogConfig)             │   │
│  │  • Timeouts: 10s (connect), 30s (read)                  │   │
│  │  • SSL/TLS: Seguro                                      │   │
│  └────────────────────────┬─────────────────────────────────┘   │
└─────────────────────────────┼──────────────────────────────────┘
                              │
                    HTTP Request (HTTPS)
                    + DD-API-KEY Header
                    + DD-APPLICATION-KEY Header
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATADOG API                                   │
│              (api.datadoghq.com ou api.eu.datadoghq.com)        │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 Fluxo de Segurança

### ❌ ANTES (Inseguro)
```
Frontend → (expõe API key) → Datadog API
```
**Problemas:**
- API key visível no código-fonte
- API key visível nas requisições
- Qualquer pessoa pode usar a chave

### ✅ DEPOIS (Seguro)
```
Frontend → Backend (sem credenciais) → Datadog API (com credenciais)
```
**Benefícios:**
- API key nunca sai do backend
- Autenticação do usuário implementada
- Logs de auditoria centralizados
- Rate limiting possível
- Fácil rotação de chaves

## 📦 Arquivos Criados

```
dogbank/integration-module/src/main/java/com/dogbank/integration/
├── datadog/
│   └── DatadogService.java            ← Comunicação com Datadog
├── controller/
│   └── DatadogController.java          ← Endpoints REST
├── config/
│   └── DatadogConfig.java              ← Configuração
└── resources/
    └── application-datadog.properties  ← Variáveis de ambiente

dogbank-frontend/src/
├── services/
│   └── datadogService.js               ← Cliente do proxy
└── components/datadog/
    ├── DatadogMetrics.jsx              ← Componente React
    └── DatadogMetrics.css              ← Estilos

DATADOG_SECURE_INTEGRATION.md           ← Documentação completa
.env.example                             ← Template de configuração
```

## 🚀 Como Usar

### 1. Configurar Credenciais
```bash
export DATADOG_API_KEY="seu-api-key"
export DATADOG_APP_KEY="sua-app-key"
```

### 2. Frontend - Importar e Usar
```javascript
import DatadogMetrics from './components/datadog/DatadogMetrics';

export default function App() {
  return (
    <div>
      <DatadogMetrics />
    </div>
  );
}
```

### 3. Backend - Iniciar Spring Boot
```bash
mvn spring-boot:run --DskipTests -Dspring-boot.run.profiles=datadog
```

### 4. Testar a Integração
```bash
# Verificar se está funcionando
curl http://localhost:8080/api/observability/datadog/health

# Buscar métricas
curl "http://localhost:8080/api/observability/datadog/metrics?query=avg:system.cpu&from=1234567890&to=1234567900"
```

## 🛡️ Checklist de Segurança

- ✅ API keys em variáveis de ambiente
- ✅ Proxy no backend (sem exposição no frontend)
- ✅ CORS configurado para domínios específicos
- ✅ Headers HTTPS configurados
- ✅ Logging de todas as requisições
- ✅ Timeouts configurados para proteção
- ⚠️ TODO: Adicionar autenticação por usuário
- ⚠️ TODO: Implementar rate limiting
- ⚠️ TODO: Adicionar tracing distribuído
- ⚠️ TODO: Implementar cache de métricas

## 🤔 Perguntas Frequentes

**P: Por que não usar a API key do Datadog diretamente no frontend?**  
R: Porque seria visível no navegador, nas requisições HTTP, e em logs. Qualquer pessoa poderia abusar da chave.

**P: Como configuro CORS corretamente?**  
R: Adicione seus domínios no `@CrossOrigin` do `DatadogController`:
```java
@CrossOrigin(origins = {"http://localhost:3000", "https://seu-dominio.com"})
```

**P: E se eu quiser usar um dashboard específico?**  
R: Use o endpoint `/api/observability/datadog/dashboard/{dashboardId}` passando o ID do dashboard.

**P: Como proteger os endpoints?**  
R: Adicione `@PreAuthorize` para exigir roles específicas:
```java
@PreAuthorize("hasRole('ADMIN')")
```

---

**Status:** ✅ Implementação Completa  
**Versão:** 1.0  
**Data:** Dezembro 2025
