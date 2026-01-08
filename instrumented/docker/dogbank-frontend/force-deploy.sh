#!/bin/bash

echo "🔄 FORÇANDO DEPLOY DA NOVA VERSÃO COM CORS CORRIGIDO"
echo "=================================================="

echo "1. 🗑️ REMOVENDO POD ATUAL:"
echo "========================="
kubectl delete pod -n production -l app=auth-module

echo ""
echo "2. ⏳ AGUARDANDO NOVO POD:"
echo "========================"
kubectl wait --for=condition=ready pod -l app=auth-module -n production --timeout=60s

echo ""
echo "3. 🧪 TESTANDO NOVA VERSÃO:"
echo "=========================="
kubectl exec -n production deployment/dogbank-frontend -- curl -v \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"cpf":"78912345603","senha":"123456"}' \
  http://auth-service.production.svc.cluster.local:8088/api/auth/login 2>&1 | head -30

echo ""
echo "4. 📊 LOGS DA NOVA INSTÂNCIA:"
echo "============================"
kubectl logs -n production -l app=auth-module --tail=20