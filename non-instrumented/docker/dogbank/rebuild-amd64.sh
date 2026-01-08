#!/bin/bash

# Rebuild simples e direto para AMD64

echo "🏗️ Rebuild rápido para AMD64..."

# Configuração
DOCKER_USER="schawirin"

# Certificar que estamos no diretório correto
cd /path/to/dogbank  # Ajuste para seu diretório

# Build cada serviço especificamente para AMD64
services=("auth" "account" "transaction" "notification" "integration" "bancocentral")

for service in "${services[@]}"; do
    echo "🔨 Building $service para AMD64..."
    
    # Build com plataforma específica
    docker build \
        --platform linux/amd64 \
        -f dockerfiles/Dockerfile.$service \
        -t $DOCKER_USER/dogbank-$service-service:amd64 \
        .
    
    # Push
    docker push $DOCKER_USER/dogbank-$service-service:amd64
    
    # Atualizar no Kubernetes
    kubectl set image deployment/$service-module \
        $service-module=$DOCKER_USER/dogbank-$service-service:amd64 \
        -n production
done

echo "✅ Feito! Verificando pods..."
sleep 20
kubectl get pods -n production