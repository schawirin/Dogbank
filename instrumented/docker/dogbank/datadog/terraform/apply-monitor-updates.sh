#!/bin/bash
# =============================================================================
# Script para Aplicar Atualizações dos Monitores
# =============================================================================
# Este script aplica as mudanças nos thresholds dos monitores do Datadog
# para que os alertas apareçam no Service Map
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Verificar credenciais
# =============================================================================
if [ -z "$TF_VAR_datadog_api_key" ] || [ -z "$TF_VAR_datadog_app_key" ]; then
    echo_error "Datadog credentials not set!"
    echo ""
    echo "Por favor, exporte as credenciais:"
    echo "  export TF_VAR_datadog_api_key=\"your-api-key\""
    echo "  export TF_VAR_datadog_app_key=\"your-app-key\""
    echo ""
    exit 1
fi

# =============================================================================
# Verificar se estamos no diretório correto
# =============================================================================
if [ ! -f "monitors.tf" ]; then
    echo_error "monitors.tf not found. Please run from terraform directory"
    exit 1
fi

echo_info "==================================================================="
echo_info "  Aplicação de Atualizações dos Monitores - DogBank"
echo_info "==================================================================="
echo ""

# =============================================================================
# Resumo das mudanças
# =============================================================================
echo_info "Mudanças que serão aplicadas:"
echo ""
echo "  📊 THRESHOLDS DE ERROR RATE (todos os serviços):"
echo "     - Critical: 5% → 1%"
echo "     - Warning: 2% → 0.5%"
echo ""
echo "  ⏱️  THRESHOLDS DE LATENCY P99:"
echo "     - transaction-service: 1s → 500ms (warning: 0.5s → 300ms)"
echo "     - bancocentral-service: 1s → 500ms (warning: 0.5s → 300ms)"
echo "     - auth-service: 1s → 500ms (warning: 0.5s → 300ms)"
echo "     - account-service: 1s → 500ms (warning: 0.5s → 300ms)"
echo "     - chatbot-service: 3s → 2s (warning: 2s → 1s)"
echo "     - pix-worker: 1s → 500ms (warning: 0.5s → 300ms)"
echo ""
echo "  🎯 SERVIÇOS AFETADOS:"
echo "     - transaction-service"
echo "     - bancocentral-service"
echo "     - auth-service"
echo "     - account-service"
echo "     - chatbot-service"
echo "     - pix-worker"
echo ""
echo_warn "IMPORTANTE: Estes thresholds são mais sensíveis para demos."
echo_warn "Em produção, considere voltar aos valores originais."
echo ""

read -p "Continuar com a aplicação? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo_info "Aplicação cancelada pelo usuário"
    exit 0
fi

# =============================================================================
# Desabilitar telemetria OTEL (evita erro)
# =============================================================================
unset OTEL_TRACES_EXPORTER

# =============================================================================
# Terraform Plan
# =============================================================================
echo_info "Gerando plano de execução..."
terraform plan -out=tfplan

echo ""
echo_info "Plano gerado com sucesso!"
echo ""
read -p "Aplicar as mudanças agora? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo_info "Aplicação cancelada. Para aplicar depois, execute:"
    echo "  terraform apply tfplan"
    exit 0
fi

# =============================================================================
# Terraform Apply
# =============================================================================
echo_info "Aplicando mudanças..."
terraform apply tfplan

if [ $? -eq 0 ]; then
    echo ""
    echo_info "==================================================================="
    echo_info "  ✅ Mudanças aplicadas com sucesso!"
    echo_info "==================================================================="
    echo ""
    echo_info "Próximos passos:"
    echo "  1. Aguardar 5-10 minutos para propagação"
    echo "  2. Verificar Service Map no Datadog:"
    echo "     https://app.datadoghq.com/apm/map"
    echo "  3. Filtrar por: env:dogbank"
    echo "  4. Verificar se serviços com erros aparecem em vermelho/amarelo"
    echo ""
    echo_info "Monitores atualizados:"
    echo "  - Error Rate: agora alertam com >1% (warning >0.5%)"
    echo "  - Latency: agora alertam com >500ms (warning >300ms)"
    echo ""
    echo_warn "LEMBRE-SE: Estes thresholds são para demo/desenvolvimento!"
    echo ""
else
    echo_error "Erro ao aplicar mudanças"
    exit 1
fi
