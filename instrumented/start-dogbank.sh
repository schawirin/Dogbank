#!/bin/bash

# ==============================================================================
# DogBank Startup Script
# ==============================================================================
# Interactive setup script for DogBank with Datadog observability
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Banner
echo -e "${PURPLE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██████╗  ██████╗  ██████╗ ██████╗  █████╗ ███╗   ██╗  ║
║   ██╔══██╗██╔═══██╗██╔════╝ ██╔══██╗██╔══██╗████╗  ██║  ║
║   ██║  ██║██║   ██║██║  ███╗██████╔╝███████║██╔██╗ ██║  ║
║   ██║  ██║██║   ██║██║   ██║██╔══██╗██╔══██║██║╚██╗██║  ║
║   ██████╔╝╚██████╔╝╚██████╔╝██████╔╝██║  ██║██║ ╚████║  ║
║   ╚═════╝  ╚═════╝  ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝  ║
║                                                           ║
║              🐕 Banking System with Full Observability   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Configuration
DOCKER_COMPOSE_DIR="./docker/dogbank"
DOCKER_COMPOSE_FILE="docker-compose.full.yml"
ENV_FILE="$DOCKER_COMPOSE_DIR/.env"

# Check if running from correct directory
if [ ! -d "$DOCKER_COMPOSE_DIR" ]; then
    echo -e "${RED}❌ Error: Must be run from /instrumented directory${NC}"
    echo -e "${YELLOW}Current directory: $(pwd)${NC}"
    exit 1
fi

echo -e "${BLUE}📋 DogBank Configuration Setup${NC}"
echo ""

# Check if .env file exists
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  Found existing .env file${NC}"
    read -p "Do you want to reconfigure? (y/N): " RECONFIGURE
    if [[ ! $RECONFIGURE =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}✅ Using existing configuration${NC}"
        USE_EXISTING=true
    fi
fi

if [ "$USE_EXISTING" != "true" ]; then
    echo -e "${BLUE}🔐 Datadog Configuration${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Datadog API Key
    echo ""
    echo -e "${PURPLE}1. Datadog API Key${NC}"
    echo "   Get it from: https://app.datadoghq.com/organization-settings/api-keys"
    read -p "   Enter your Datadog API Key: " DD_API_KEY

    # Datadog APP Key
    echo ""
    echo -e "${PURPLE}2. Datadog APP Key${NC}"
    echo "   Get it from: https://app.datadoghq.com/organization-settings/application-keys"
    read -p "   Enter your Datadog APP Key: " DD_APP_KEY

    # RUM Configuration
    echo ""
    echo -e "${BLUE}📊 Real User Monitoring (RUM) Configuration${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    echo ""
    echo -e "${PURPLE}3. RUM Client Token${NC}"
    echo "   Get it from: https://app.datadoghq.com/rum/list"
    echo "   Click on your application → Settings → Client Token"
    read -p "   Enter your RUM Client Token: " VITE_DD_CLIENT_TOKEN

    echo ""
    echo -e "${PURPLE}4. RUM Application ID${NC}"
    echo "   Get it from: https://app.datadoghq.com/rum/list"
    echo "   Click on your application → Settings → Application ID"
    read -p "   Enter your RUM Application ID: " VITE_DD_APPLICATION_ID

    # LLM Observability (Groq)
    echo ""
    echo -e "${BLUE}🤖 AI Chatbot (LLM Observability)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    echo ""
    echo -e "${PURPLE}5. Groq API Key (FREE)${NC}"
    echo "   Get it from: https://console.groq.com/keys"
    echo "   1. Create account (Google/GitHub login)"
    echo "   2. Navigate to API Keys"
    echo "   3. Click 'Create API Key'"
    echo "   4. Copy the key (starts with 'gsk_')"
    read -p "   Enter your Groq API Key: " GROQ_API_KEY

    # Optional: Datadog Site
    echo ""
    echo -e "${PURPLE}6. Datadog Site (optional)${NC}"
    echo "   Default: datadoghq.com (US1)"
    echo "   Other options: datadoghq.eu, us3.datadoghq.com, etc."
    read -p "   Enter Datadog Site [datadoghq.com]: " DD_SITE
    DD_SITE=${DD_SITE:-datadoghq.com}

    # Create .env file
    echo ""
    echo -e "${YELLOW}💾 Creating .env file...${NC}"

    cat > "$ENV_FILE" << EOF
# ==============================================================================
# DogBank Environment Configuration
# ==============================================================================
# Generated on: $(date)
# ==============================================================================

# Datadog Configuration
DD_API_KEY=$DD_API_KEY
DD_APP_KEY=$DD_APP_KEY
DD_SITE=$DD_SITE
DD_METRICS_ENABLED=true

# Real User Monitoring (RUM)
VITE_DD_CLIENT_TOKEN=$VITE_DD_CLIENT_TOKEN
VITE_DD_APPLICATION_ID=$VITE_DD_APPLICATION_ID

# AI Chatbot (Groq LLM)
GROQ_API_KEY=$GROQ_API_KEY

# Database
POSTGRES_PASSWORD=dog1234
POSTGRES_USER=dogbank
POSTGRES_DB=dogbank

# Redis
REDIS_PASSWORD=

# RabbitMQ
RABBITMQ_DEFAULT_USER=dogbank
RABBITMQ_DEFAULT_PASS=dog1234
EOF

    echo -e "${GREEN}✅ Configuration saved to $ENV_FILE${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}📦 Starting DogBank Services${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Services to be started:${NC}"
echo "  • PostgreSQL Database"
echo "  • Redis Cache"
echo "  • RabbitMQ Message Broker"
echo "  • Apache Kafka"
echo "  • Datadog Agent"
echo "  • Auth Service (Port 8088)"
echo "  • Account Service (Port 8089)"
echo "  • Transaction Service (Port 8087)"
echo "  • Banco Central Service (Port 8085)"
echo "  • Notification Service (Port 8086)"
echo "  • AI Chatbot Service (Port 8083)"
echo "  • PIX Worker (Kafka Consumer)"
echo "  • Fraud Detection Service"
echo "  • Frontend (React)"
echo "  • Nginx Reverse Proxy"
echo "  • Load Generator"
echo ""

read -p "Start services now? (Y/n): " START_NOW
if [[ $START_NOW =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}⚠️  Setup complete. Run this script again to start services.${NC}"
    exit 0
fi

# Start services
echo ""
echo -e "${GREEN}🚀 Starting Docker Compose...${NC}"
echo ""

cd "$DOCKER_COMPOSE_DIR"
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d

# Wait for services to be healthy
echo ""
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check status
echo ""
echo -e "${BLUE}📊 Service Status${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker-compose -f "$DOCKER_COMPOSE_FILE" ps

# Success message
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}║  ✅ DogBank is now running!                           ║${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🌐 Access URLs:${NC}"
echo "  • Frontend:        http://localhost"
echo "  • Auth API:        http://localhost/api/auth"
echo "  • Account API:     http://localhost/api/accounts"
echo "  • Transaction API: http://localhost/api/transactions"
echo "  • Chatbot API:     http://localhost/api/chatbot"
echo ""
echo -e "${BLUE}📊 Datadog:${NC}"
echo "  • APM:        https://app.datadoghq.com/apm/home"
echo "  • Logs:       https://app.datadoghq.com/logs"
echo "  • RUM:        https://app.datadoghq.com/rum/list"
echo "  • LLM Obs:    https://app.datadoghq.com/apm/traces"
echo ""
echo -e "${BLUE}👥 Test Users:${NC}"
echo "  • CPF: 12345678915 | Senha: 123456 (Vitoria Itadori)"
echo "  • CPF: 98765432101 | Senha: 123456 (Pedro Silva)"
echo "  • CPF: 66666666666 | Senha: 123456 (Usuário Teste)"
echo ""
echo -e "${YELLOW}💡 Useful Commands:${NC}"
echo "  • View logs:       docker-compose -f $DOCKER_COMPOSE_FILE logs -f [service]"
echo "  • Stop services:   docker-compose -f $DOCKER_COMPOSE_FILE down"
echo "  • Restart service: docker-compose -f $DOCKER_COMPOSE_FILE restart [service]"
echo ""
echo -e "${PURPLE}🎉 Happy Banking! 🐕${NC}"
echo ""
