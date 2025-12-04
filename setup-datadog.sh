#!/bin/bash

# ============================================
# Setup Script para Integração Datadog Segura
# ============================================

echo "🔧 Setup para Integração Segura com Datadog"
echo "==========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Verificar arquivo .env
echo -e "${BLUE}1. Verificando arquivo .env${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
    echo "Criando a partir de .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✅ .env criado${NC}"
else
    echo -e "${GREEN}✅ .env encontrado${NC}"
fi

echo ""

# 2. Verificar variáveis de ambiente necessárias
echo -e "${BLUE}2. Verificando variáveis de ambiente${NC}"

if [ -z "$DATADOG_API_KEY" ] || [ "$DATADOG_API_KEY" = "" ]; then
    echo -e "${YELLOW}⚠️  DATADOG_API_KEY não está definida${NC}"
    echo "Defina com: export DATADOG_API_KEY='sua-chave-aqui'"
else
    echo -e "${GREEN}✅ DATADOG_API_KEY está definida${NC}"
fi

if [ -z "$DATADOG_APP_KEY" ] || [ "$DATADOG_APP_KEY" = "" ]; then
    echo -e "${YELLOW}⚠️  DATADOG_APP_KEY não está definida${NC}"
    echo "Defina com: export DATADOG_APP_KEY='sua-chave-aqui'"
else
    echo -e "${GREEN}✅ DATADOG_APP_KEY está definida${NC}"
fi

echo ""

# 3. Verificar estrutura de diretórios
echo -e "${BLUE}3. Verificando estrutura de diretórios${NC}"

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
    fi
}

check_file "dogbank/integration-module/src/main/java/com/dogbank/integration/datadog/DatadogService.java"
check_file "dogbank/integration-module/src/main/java/com/dogbank/integration/controller/DatadogController.java"
check_file "dogbank/integration-module/src/main/java/com/dogbank/integration/config/DatadogConfig.java"
check_file "dogbank/integration-module/src/main/resources/application-datadog.properties"
check_file "dogbank-frontend/src/services/datadogService.js"
check_file "dogbank-frontend/src/components/datadog/DatadogMetrics.jsx"

echo ""

# 4. Instruções para configurar Datadog
echo -e "${BLUE}4. Próximos Passos${NC}"
echo -e "${YELLOW}1. Configure as credenciais do Datadog:${NC}"
echo "   export DATADOG_API_KEY='sua-chave-api'"
echo "   export DATADOG_APP_KEY='sua-chave-app'"
echo ""
echo -e "${YELLOW}2. Inicie o backend:${NC}"
echo "   cd dogbank/integration-module"
echo "   mvn spring-boot:run -Dspring-boot.run.profiles=datadog"
echo ""
echo -e "${YELLOW}3. Inicie o frontend:${NC}"
echo "   cd dogbank-frontend"
echo "   npm install"
echo "   npm start"
echo ""
echo -e "${YELLOW}4. Teste a integração:${NC}"
echo "   curl http://localhost:8080/api/observability/datadog/health"
echo ""

# 5. Informações de segurança
echo -e "${BLUE}5. Checklist de Segurança${NC}"
echo "   ☐ Variáveis de ambiente definidas"
echo "   ☐ .env não está no git (.gitignore)"
echo "   ☐ API keys não estão expostas no código"
echo "   ☐ CORS configurado apenas para domínios confiáveis"
echo "   ☐ HTTPS habilitado em produção"
echo ""

# 6. Teste rápido
echo -e "${BLUE}6. Executando testes rápidos...${NC}"
echo ""

# Testar se pode fazer requisição
if command -v curl &> /dev/null; then
    echo -e "${YELLOW}Testando backend (em http://localhost:8080):${NC}"
    
    if curl -s http://localhost:8080/api/observability/datadog/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend respondendo${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend não está rodando em localhost:8080${NC}"
    fi
else
    echo -e "${YELLOW}curl não encontrado, pulando teste de conectividade${NC}"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}🎉 Setup concluído!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Para mais detalhes, consulte:"
echo "  - DATADOG_SECURE_INTEGRATION.md"
echo "  - SOLUCAO_SEGURA_DATADOG.md"
echo ""
