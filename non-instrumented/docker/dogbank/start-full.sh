#!/bin/bash

# =============================================================================
# DogBank - Script de Inicialização Full Stack com Datadog
# =============================================================================
# Este script sobe toda a aplicação: Frontend + Backend + Banco + Datadog
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🐕 DogBank - Full Stack Startup com Datadog APM            ║"
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

# Verificar DD_API_KEY
if [ -z "$DD_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  DD_API_KEY não está configurada.${NC}"
    echo -e "${CYAN}   O Datadog Agent não será iniciado corretamente sem a API Key.${NC}"
    echo ""
    echo -e "${CYAN}   Para configurar, execute:${NC}"
    echo -e "${GREEN}   export DD_API_KEY=\"sua-api-key-aqui\"${NC}"
    echo ""
    read -p "Deseja continuar sem o Datadog? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Operação cancelada.${NC}"
        exit 1
    fi
    echo ""
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
sleep 15

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
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║   🌐 Frontend: http://localhost                              ║"
echo "║   🔑 Auth API: http://localhost/api/auth/                    ║"
echo "║   💳 Account API: http://localhost/api/account/              ║"
echo "║   💸 PIX API: http://localhost/api/pix/                      ║"
echo "║                                                               ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║   📝 Usuários de teste:                                      ║"
echo "║      CPF: 66666666666  |  Senha: 123456  |  R$ 50.000        ║"
echo "║      CPF: 12345678915  |  Senha: 123456  |  R$ 10.000        ║"
echo "║      CPF: 98765432101  |  Senha: 123456  |  R$ 15.000        ║"
echo "║                                                               ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║   🐕 Datadog:                                                ║"
echo "║      APM Traces: http://localhost:8126                       ║"
echo "║      DogStatsD: localhost:8125 (UDP)                         ║"
echo "║                                                               ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║   📋 Comandos úteis:                                         ║"
echo "║      Ver logs: docker-compose -f docker-compose.full.yml logs -f  ║"
echo "║      Parar: docker-compose -f docker-compose.full.yml down   ║"
echo "║      Reset: docker-compose -f docker-compose.full.yml down -v║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se Datadog está configurado
if [ -n "$DD_API_KEY" ]; then
    echo -e "${CYAN}🐕 Datadog Agent está configurado e coletando métricas!${NC}"
    echo -e "${CYAN}   Acesse https://app.datadoghq.com para ver os dados.${NC}"
else
    echo -e "${YELLOW}⚠️  Datadog Agent iniciado mas sem API Key configurada.${NC}"
    echo -e "${YELLOW}   Configure DD_API_KEY e reinicie para habilitar o monitoramento.${NC}"
fi
