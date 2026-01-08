#!/bin/bash

# =============================================================================
# DogBank - Script de Inicialização Completo
# =============================================================================
# Este script inicializa todos os serviços do DogBank com HTTPS
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                       ║"
echo "║     🏦  DogBank - Sistema Bancário de Microserviços                   ║"
echo "║                                                                       ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# Verificar pré-requisitos
# =============================================================================

echo -e "${YELLOW}📋 Verificando pré-requisitos...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não encontrado. Por favor, instale o Docker.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose não encontrado. Por favor, instale o Docker Compose.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker e Docker Compose encontrados${NC}"

# =============================================================================
# Verificar/Criar certificados SSL
# =============================================================================

echo -e "${YELLOW}🔐 Verificando certificados SSL...${NC}"

if [ ! -f "nginx/ssl/dogbank.crt" ] || [ ! -f "nginx/ssl/dogbank.key" ]; then
    echo -e "${YELLOW}   Certificados não encontrados. Gerando...${NC}"
    
    if [ -f "nginx/ssl/generate-certs.sh" ]; then
        chmod +x nginx/ssl/generate-certs.sh
        cd nginx/ssl && ./generate-certs.sh && cd ../..
    else
        echo -e "${RED}❌ Script de geração de certificados não encontrado${NC}"
        echo -e "${YELLOW}   Criando certificados manualmente...${NC}"
        
        mkdir -p nginx/ssl
        
        # Gerar certificado auto-assinado
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/dogbank.key \
            -out nginx/ssl/dogbank.crt \
            -subj "/C=BR/ST=SP/L=SaoPaulo/O=DogBank/CN=localhost"
        
        # Gerar dhparam
        openssl dhparam -out nginx/ssl/dhparam.pem 2048
    fi
    
    echo -e "${GREEN}✅ Certificados SSL gerados${NC}"
else
    echo -e "${GREEN}✅ Certificados SSL encontrados${NC}"
fi

# =============================================================================
# Verificar/Criar arquivo .env
# =============================================================================

echo -e "${YELLOW}📝 Verificando arquivo .env...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}   Arquivo .env criado a partir do .env.example${NC}"
        echo -e "${YELLOW}   ⚠️  Por favor, edite o arquivo .env com suas configurações${NC}"
    else
        echo -e "${YELLOW}   Criando arquivo .env padrão...${NC}"
        cat > .env << EOF
POSTGRES_DB=dogbank
POSTGRES_USER=dogbank
POSTGRES_PASSWORD=dog1234
JWT_SECRET=dogbank-secret-key-change-in-production
JWT_EXPIRATION=86400000
TRANSACTION_LIMIT_DAILY=50000
TRANSACTION_LIMIT_SINGLE=10000
DD_ENV=development
EOF
    fi
fi

echo -e "${GREEN}✅ Arquivo .env verificado${NC}"

# =============================================================================
# Criar diretórios necessários
# =============================================================================

echo -e "${YELLOW}📁 Criando diretórios...${NC}"

mkdir -p nginx/logs
mkdir -p nginx/snippets

echo -e "${GREEN}✅ Diretórios criados${NC}"

# =============================================================================
# Parar containers existentes
# =============================================================================

echo -e "${YELLOW}🛑 Parando containers existentes...${NC}"

docker-compose -f docker-compose.complete.yml down --remove-orphans 2>/dev/null || true

echo -e "${GREEN}✅ Containers parados${NC}"

# =============================================================================
# Build das imagens
# =============================================================================

echo -e "${YELLOW}🔨 Construindo imagens Docker...${NC}"
echo -e "${YELLOW}   Isso pode demorar alguns minutos na primeira vez...${NC}"

docker-compose -f docker-compose.complete.yml build --parallel

echo -e "${GREEN}✅ Imagens construídas${NC}"

# =============================================================================
# Iniciar serviços
# =============================================================================

echo -e "${YELLOW}🚀 Iniciando serviços...${NC}"

docker-compose -f docker-compose.complete.yml up -d

echo -e "${GREEN}✅ Serviços iniciados${NC}"

# =============================================================================
# Aguardar serviços ficarem saudáveis
# =============================================================================

echo -e "${YELLOW}⏳ Aguardando serviços ficarem saudáveis...${NC}"

services=(
    "dogbank-postgres"
    "dogbank-redis"
    "auth-service"
    "account-service"
    "autorizador-service"
    "ledger-service"
    "transaction-service"
    "bancocentral-service"
    "integration-service"
    "notification-service"
    "dogbank-gateway"
)

max_wait=180
waited=0

for service in "${services[@]}"; do
    echo -ne "   Aguardando ${service}..."
    
    while [ $waited -lt $max_wait ]; do
        status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "starting")
        
        if [ "$status" = "healthy" ]; then
            echo -e " ${GREEN}✅${NC}"
            break
        elif [ "$status" = "unhealthy" ]; then
            echo -e " ${RED}❌ (unhealthy)${NC}"
            break
        fi
        
        sleep 2
        waited=$((waited + 2))
        echo -ne "."
    done
    
    if [ $waited -ge $max_wait ]; then
        echo -e " ${YELLOW}⚠️ (timeout)${NC}"
    fi
    
    waited=0
done

# =============================================================================
# Exibir status
# =============================================================================

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ DogBank iniciado com sucesso!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 Status dos serviços:${NC}"
docker-compose -f docker-compose.complete.yml ps

echo ""
echo -e "${YELLOW}🌐 URLs de acesso:${NC}"
echo -e "   HTTP:  ${BLUE}http://localhost${NC} (redireciona para HTTPS)"
echo -e "   HTTPS: ${BLUE}https://localhost${NC}"
echo ""
echo -e "${YELLOW}📋 Endpoints disponíveis:${NC}"
echo -e "   Auth:         ${BLUE}https://localhost/api/auth/${NC}"
echo -e "   Account:      ${BLUE}https://localhost/api/accounts/${NC}"
echo -e "   Transaction:  ${BLUE}https://localhost/api/transactions/${NC}"
echo -e "   Autorizador:  ${BLUE}https://localhost/api/autorizador/${NC}"
echo -e "   Ledger:       ${BLUE}https://localhost/api/ledger/${NC}"
echo -e "   Banco Central:${BLUE}https://localhost/api/bancocentral/${NC}"
echo -e "   Integration:  ${BLUE}https://localhost/api/integration/${NC}"
echo -e "   Notification: ${BLUE}https://localhost/api/notifications/${NC}"
echo ""
echo -e "${YELLOW}🔧 Comandos úteis:${NC}"
echo -e "   Ver logs:     ${BLUE}docker-compose -f docker-compose.complete.yml logs -f${NC}"
echo -e "   Parar:        ${BLUE}docker-compose -f docker-compose.complete.yml down${NC}"
echo -e "   Reiniciar:    ${BLUE}docker-compose -f docker-compose.complete.yml restart${NC}"
echo ""
echo -e "${YELLOW}⚠️  Nota:${NC} O navegador mostrará um aviso de certificado auto-assinado."
echo -e "   Clique em 'Avançado' → 'Continuar para localhost' para acessar."
echo ""
