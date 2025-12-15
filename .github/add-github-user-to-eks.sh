#!/bin/bash

# Script para adicionar o usuário github-actions-dogbank ao ConfigMap aws-auth
# do cluster eks-sandbox-datadog

set -e

echo "🔧 Configurando acesso do GitHub Actions ao cluster EKS..."

# Verifica se kubectl está instalado
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl não encontrado. Instale kubectl primeiro."
    exit 1
fi

# Verifica se eksctl está instalado
if ! command -v eksctl &> /dev/null; then
    echo "⚠️  eksctl não encontrado. Tentando adicionar manualmente..."

    # Método manual usando kubectl
    echo "📝 Editando aws-auth ConfigMap..."

    # Backup do ConfigMap atual
    kubectl get configmap aws-auth -n kube-system -o yaml > aws-auth-backup.yaml
    echo "✅ Backup criado: aws-auth-backup.yaml"

    # Adicionar o usuário ao ConfigMap
    kubectl get configmap aws-auth -n kube-system -o yaml | \
    grep -q "github-actions-dogbank" && \
    echo "✅ Usuário github-actions-dogbank já está no ConfigMap" || \
    kubectl patch configmap aws-auth -n kube-system --type merge -p '
apiVersion: v1
data:
  mapUsers: |
    - userarn: arn:aws:iam::061039767542:user/github-actions-dogbank
      username: github-actions-dogbank
      groups:
        - system:masters
'

    echo "✅ Usuário adicionado ao ConfigMap aws-auth"
else
    # Método usando eksctl (mais seguro)
    echo "📝 Adicionando usuário usando eksctl..."

    eksctl create iamidentitymapping \
        --cluster eks-sandbox-datadog \
        --region us-east-1 \
        --arn arn:aws:iam::061039767542:user/github-actions-dogbank \
        --username github-actions-dogbank \
        --group system:masters

    echo "✅ Usuário adicionado usando eksctl"
fi

echo ""
echo "🎉 Configuração concluída!"
echo ""
echo "Agora o GitHub Actions pode fazer deploy no cluster."
echo "Execute um novo push para testar o deployment automático."
