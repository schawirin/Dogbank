#!/bin/bash

echo "🔍 VERIFICANDO VERSÃO E BUILD"
echo "============================="

echo "1. 📋 IMAGEM ATUAL EM USO:"
echo "========================="
kubectl get deployment auth-module -n production -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""

echo "2. 🏷️ VERIFICAR TAGS DISPONÍVEIS:"
echo "==============================="
echo "Verificando se existe versão mais recente..."

echo "3. 📊 ENVIRONMENT ATUAL:"
echo "======================="
kubectl get deployment auth-module -n production -o jsonpath='{.spec.template.spec.containers[0].env}' | jq .

echo ""
echo "4. 🔍 ÚLTIMA BUILD NO REPOSITÓRIO:"
echo "================================="
echo "Verifique se fez push da nova imagem com:"
echo "docker push schawirin/dogbank-auth-service:v1.2"
echo ""
echo "5. 🔄 SE PRECISAR ATUALIZAR IMAGEM:"
echo "=================================="
echo "kubectl set image deployment/auth-module auth-module=schawirin/dogbank-auth-service:v1.2 -n production"