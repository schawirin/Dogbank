#!/bin/bash

# =============================================================================
# DogBank - Script de Inicialização Full Stack
# =============================================================================
# Este script sobe toda a aplicação: Frontend + Backend + Banco de Dados
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🐕 DogBank - Full Stack Startup                            ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando. Por favor, inicie o Docker primeiro.${NC}"
    exit 1
fi

# Verificar se docker-compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose não encontrado. Por favor, instale o docker-compose.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Parando containers existentes...${NC}"
docker-compose -f docker-compose.full.yml down 2>/dev/null || true

echo ""
echo -e "${YELLOW}🔨 Construindo imagens...${NC}"
echo -e "${BLUE}   Isso pode levar alguns minutos na primeira vez...${NC}"
docker-compose -f docker-compose.full.yml build

echo ""
echo -e "${YELLOW}🚀 Iniciando todos os serviços...${NC}"
docker-compose -f docker-compose.full.yml up -d

echo ""
echo -e "${YELLOW}⏳ Aguardando serviços ficarem saudáveis...${NC}"
sleep 10

# Verificar status dos containers
echo ""
echo -e "${BLUE}📊 Status dos containers:${NC}"
docker-compose -f docker-compose.full.yml ps

echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   ✅ DogBank está rodando!                                   ║"
echo "║                                                               ║"
echo "║   🌐 Frontend: http://localhost                              ║"
echo "║   🔑 Auth API: http://localhost/api/auth/                    ║"
echo "║   💳 Account API: http://localhost/api/account/              ║"
echo "║   💸 PIX API: http://localhost/api/pix/                      ║"
echo "║                                                               ║"
echo "║   📝 Usuários de teste:                                      ║"
echo "║      CPF: 66666666666  |  Senha: 123456                      ║"
echo "║      CPF: 12345678915  |  Senha: 123456                      ║"
echo "║                                                               ║"
echo "║   📋 Comandos úteis:                                         ║"
echo "║      Ver logs: docker-compose -f docker-compose.full.yml logs -f  ║"
echo "║      Parar: docker-compose -f docker-compose.full.yml down   ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
