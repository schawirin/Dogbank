#!/bin/bash

# ========================================
# Script para instalar Traefik via Helm
# ========================================

set -e  # Para se houver erro

echo "🚀 Instalando Traefik via Helm..."

# 1. Adicionar repositório do Traefik
echo "📦 Adicionando repositório Traefik..."
helm repo add traefik https://traefik.github.io/charts

# 2. Atualizar repositórios
echo "🔄 Atualizando repositórios..."
helm repo update

# 3. Criar namespace para o Traefik
echo "📁 Criando namespace traefik..."
kubectl create namespace traefik --dry-run=client -o yaml | kubectl apply -f -

# 4. Instalar Traefik com configurações customizadas
echo "⚙️  Instalando Traefik..."
helm install traefik traefik/traefik \
  --namespace traefik \
  --set ingressRoute.dashboard.enabled=true \
  --set ingressRoute.dashboard.matchRule='Host(`traefik.localhost`)' \
  --set ingressRoute.dashboard.entryPoints={web} \
  --set providers.kubernetesCRD.enabled=true \
  --set providers.kubernetesCRD.allowCrossNamespace=true \
  --set providers.kubernetesIngress.enabled=true \
  --set ports.web.port=80 \
  --set ports.websecure.port=443 \
  --set logs.general.level=INFO \
  --set logs.access.enabled=true

# 5. Aguardar o Traefik ficar pronto
echo "⏳ Aguardando Traefik ficar pronto..."
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=traefik \
  -n traefik \
  --timeout=120s

# 6. Verificar instalação
echo ""
echo "✅ Traefik instalado com sucesso!"
echo ""
echo "📊 Status dos pods:"
kubectl get pods -n traefik
echo ""
echo "🌐 Services:"
kubectl get svc -n traefik
echo ""
echo "📝 Para acessar o dashboard do Traefik:"
echo "   kubectl port-forward -n traefik \$(kubectl get pods -n traefik -l app.kubernetes.io/name=traefik -o name) 9000:9000"
echo "   Depois acesse: http://localhost:9000/dashboard/"
echo ""
echo "🎉 Pronto! Agora você pode aplicar seus deployments do Dogbank."