#!/bin/bash

# =============================================================================
# Script para atualizar versões nos manifests do Kubernetes
# =============================================================================
# Uso: ./update-version.sh <VERSION>
# Exemplo: ./update-version.sh v1.2.3
# =============================================================================

set -e

VERSION="${1:-$(git rev-parse --short HEAD)}"

echo "=========================================="
echo "Atualizando versão para: $VERSION"
echo "=========================================="
echo ""

# Verifica se yq está instalado
if ! command -v yq &> /dev/null; then
    echo "❌ yq não está instalado. Instalando..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install yq
    else
        wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /usr/local/bin/yq
        chmod +x /usr/local/bin/yq
    fi
fi

# Lista de serviços
SERVICES=(
    "account-service"
    "auth-service"
    "bancocentral-service"
    "transaction-service"
    "fraud-detection-service"
    "pix-worker"
    "chatbot-service"
)

# Atualizar cada serviço
for service in "${SERVICES[@]}"; do
    FILE="../base/${service}.yaml"
    
    if [ ! -f "$FILE" ]; then
        echo "⚠️  Arquivo não encontrado: $FILE"
        continue
    fi
    
    echo "📝 Atualizando: $service"
    
    # Atualizar label tags.datadoghq.com/version nos metadata
    yq eval -i "
        select(.kind == \"Deployment\") |
        .metadata.labels.\"tags.datadoghq.com/version\" = \"$VERSION\" |
        .spec.template.metadata.labels.\"tags.datadoghq.com/version\" = \"$VERSION\"
    " "$FILE"
    
    # Atualizar variável de ambiente DD_VERSION (se existir)
    if yq eval 'select(.kind == "Deployment") | .spec.template.spec.containers[0].env[] | select(.name == "DD_VERSION")' "$FILE" | grep -q "DD_VERSION"; then
        yq eval -i "
            select(.kind == \"Deployment\") |
            (.spec.template.spec.containers[0].env[] | select(.name == \"DD_VERSION\") | .value) = \"$VERSION\"
        " "$FILE"
    fi
    
    echo "   ✅ $service atualizado"
done

# Atualizar ConfigMap
echo ""
echo "📝 Atualizando ConfigMap"
yq eval -i ".data.DD_VERSION = \"$VERSION\"" ../base/configmap.yaml
echo "   ✅ ConfigMap atualizado"

echo ""
echo "=========================================="
echo "✅ Versões atualizadas com sucesso!"
echo "Versão: $VERSION"
echo "=========================================="
echo ""
echo "Para aplicar no cluster:"
echo "  kubectl apply -f ../base/"
echo ""
echo "Para verificar:"
echo "  kubectl get deployments -n dogbank -o custom-columns=NAME:.metadata.name,VERSION:.metadata.labels.tags\\.datadoghq\\.com/version"
