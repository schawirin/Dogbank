#!/bin/bash
# =============================================================================
# DogBank - Setup Interativo
# =============================================================================
# Este script configura o ambiente e sobe todos os containers
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                       ║"
echo "║     🐕 DogBank - Setup Interativo                                     ║"
echo "║                                                                       ║"
echo "║     Demo Banking Application com Datadog Observability                ║"
echo "║                                                                       ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verifica se Docker está rodando
echo -e "${YELLOW}Verificando pre-requisitos...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando!${NC}"
    echo "   Por favor, inicie o Docker Desktop e tente novamente."
    exit 1
fi
echo -e "${GREEN}✓ Docker está rodando${NC}"

# Verifica se docker-compose existe
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose não encontrado!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ docker-compose encontrado${NC}"
echo ""

# =============================================================================
# DATADOG - APM & Logs
# =============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DATADOG - Observabilidade (APM, Logs, Metricas)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Para obter suas chaves do Datadog:${NC}"
echo "  1. Acesse: https://app.datadoghq.com/organization-settings/api-keys"
echo "  2. Crie ou copie sua API Key"
echo "  3. Acesse: https://app.datadoghq.com/organization-settings/application-keys"
echo "  4. Crie ou copie sua App Key"
echo ""

read -p "$(echo -e ${YELLOW}DD_API_KEY${NC} [sua Datadog API Key]: )" DD_API_KEY
if [ -z "$DD_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  Sem API Key - Datadog será desabilitado${NC}"
    DD_API_KEY="dummy-key-disabled"
fi

read -p "$(echo -e ${YELLOW}DD_APP_KEY${NC} [sua Datadog App Key]: )" DD_APP_KEY
if [ -z "$DD_APP_KEY" ]; then
    DD_APP_KEY="dummy-app-key"
fi

echo ""

# =============================================================================
# DATADOG RUM - Real User Monitoring (Frontend)
# =============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DATADOG RUM - Monitoramento do Frontend${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}O RUM monitora a experiencia do usuario no navegador.${NC}"
echo ""
echo "Para configurar o RUM:"
echo "  1. Acesse: https://app.datadoghq.com/rum/application/create"
echo "  2. Crie uma aplicacao 'dog-bank'"
echo "  3. Copie o Application ID e Client Token"
echo ""
echo -e "${YELLOW}(Pressione ENTER para pular - RUM sera desabilitado)${NC}"
echo ""

read -p "$(echo -e ${YELLOW}VITE_DD_APPLICATION_ID${NC} [Application ID]: )" VITE_DD_APPLICATION_ID
read -p "$(echo -e ${YELLOW}VITE_DD_CLIENT_TOKEN${NC} [Client Token]: )" VITE_DD_CLIENT_TOKEN

if [ -z "$VITE_DD_APPLICATION_ID" ]; then
    VITE_DD_APPLICATION_ID="disabled"
    VITE_DD_CLIENT_TOKEN="disabled"
fi

echo ""

# =============================================================================
# GROQ - LLM para o Chatbot
# =============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  GROQ - LLM para o Chatbot (DogBot)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}O DogBot usa Groq para processamento de linguagem natural.${NC}"
echo -e "${CYAN}Groq oferece inferencia super rapida e tem tier GRATUITO!${NC}"
echo ""
echo "Para obter sua API Key do Groq:"
echo "  1. Acesse: https://console.groq.com/"
echo "  2. Crie uma conta (pode usar Google/GitHub)"
echo "  3. Va em 'API Keys' e crie uma nova chave"
echo "  4. A chave comeca com 'gsk_'"
echo ""
echo -e "${YELLOW}(Pressione ENTER para pular - Chatbot usara respostas mock)${NC}"
echo ""

read -p "$(echo -e ${YELLOW}GROQ_API_KEY${NC} [sua Groq API Key]: )" GROQ_API_KEY

if [ -z "$GROQ_API_KEY" ]; then
    GROQ_API_KEY="dummy-key-chatbot-disabled"
    echo -e "${YELLOW}⚠️  Sem Groq Key - Chatbot usara respostas pre-definidas${NC}"
fi

echo ""

# =============================================================================
# Confirmacao
# =============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Resumo da Configuracao${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  DD_API_KEY:              ${GREEN}${DD_API_KEY:0:10}...${NC}"
echo -e "  DD_APP_KEY:              ${GREEN}${DD_APP_KEY:0:10}...${NC}"
echo -e "  VITE_DD_APPLICATION_ID:  ${GREEN}${VITE_DD_APPLICATION_ID:0:20}...${NC}"
echo -e "  VITE_DD_CLIENT_TOKEN:    ${GREEN}${VITE_DD_CLIENT_TOKEN:0:15}...${NC}"
echo -e "  GROQ_API_KEY:            ${GREEN}${GROQ_API_KEY:0:15}...${NC}"
echo ""

read -p "$(echo -e ${YELLOW}Confirma e inicia o DogBank? [Y/n]: ${NC})" CONFIRM
if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
    echo -e "${RED}Cancelado pelo usuario.${NC}"
    exit 0
fi

# =============================================================================
# Criar arquivo .env
# =============================================================================
echo ""
echo -e "${YELLOW}Criando arquivo .env...${NC}"

cat > .env << EOF
# =============================================================================
# DogBank - Variaveis de Ambiente
# Gerado automaticamente por setup.sh em $(date)
# =============================================================================

# Database
DB_URL=jdbc:postgresql://postgres:5432/dogbank
DB_USER=dogbank
DB_PASSWORD=dog1234
POSTGRES_PASSWORD=dog1234
POSTGRES_USER=dogbank
POSTGRES_DB=dogbank

# Datadog APM
DD_API_KEY=${DD_API_KEY}
DD_APP_KEY=${DD_APP_KEY}
DD_SITE=datadoghq.com
DD_METRICS_ENABLED=true

# Datadog RUM (Frontend)
VITE_DD_CLIENT_TOKEN=${VITE_DD_CLIENT_TOKEN}
VITE_DD_APPLICATION_ID=${VITE_DD_APPLICATION_ID}
VITE_DD_SERVICE=dog-bank
VITE_DD_ENV=development

# Groq LLM (Chatbot)
GROQ_API_KEY=${GROQ_API_KEY}
OPENAI_API_KEY=${GROQ_API_KEY}
OPENAI_API_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=llama-3.1-8b-instant

# RabbitMQ
RABBITMQ_DEFAULT_USER=dogbank
RABBITMQ_DEFAULT_PASS=dog1234

# Redis
REDIS_PASSWORD=
EOF

echo -e "${GREEN}✓ Arquivo .env criado${NC}"

# =============================================================================
# Subir containers
# =============================================================================
echo ""
echo -e "${YELLOW}Iniciando containers...${NC}"
echo -e "${CYAN}(Isso pode levar alguns minutos na primeira vez)${NC}"
echo ""

docker-compose -f docker-compose.full.yml up -d --build

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ DogBank iniciado com sucesso!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐 Aplicacao:     ${CYAN}http://localhost${NC}"
echo -e "  🐰 RabbitMQ:      ${CYAN}http://localhost:15672${NC} (dogbank/dog1234)"
echo -e "  📊 Datadog:       ${CYAN}https://app.datadoghq.com${NC}"
echo ""
echo -e "  ${YELLOW}Login:${NC}"
echo -e "     CPF:   ${GREEN}12345678915${NC}"
echo -e "     Senha: ${GREEN}123456${NC}"
echo ""
echo -e "  ${YELLOW}Comandos uteis:${NC}"
echo -e "     Ver status:    docker-compose -f docker-compose.full.yml ps"
echo -e "     Ver logs:      docker-compose -f docker-compose.full.yml logs -f"
echo -e "     Parar:         docker-compose -f docker-compose.full.yml down"
echo ""
echo -e "${CYAN}Aguarde ~2-3 minutos para todos os servicos ficarem saudaveis.${NC}"
echo ""
