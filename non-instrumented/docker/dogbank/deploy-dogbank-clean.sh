#!/bin/bash

# Script de deploy limpo do DogBank
# Este script remove tudo e faz um deploy do zero

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🐕 DogBank - Deploy Limpo no Kubernetes${NC}"
echo -e "${BLUE}======================================${NC}"

# Função para aguardar pods
wait_for_pod() {
    local label=$1
    local timeout=${2:-120}
    echo -e "${BLUE}⏳ Aguardando pod com label ${label} ficar pronto...${NC}"
    kubectl wait --for=condition=ready pod -l $label -n production --timeout=${timeout}s
}

# Limpar deployment anterior
echo -e "\n${YELLOW}🧹 Limpando deployment anterior...${NC}"
kubectl delete namespace production --ignore-not-found=true

# Aguardar namespace ser deletado completamente
echo -e "${BLUE}⏳ Aguardando limpeza completa...${NC}"
while kubectl get namespace production &> /dev/null; do
    sleep 2
done

echo -e "${GREEN}✅ Limpeza concluída!${NC}"

# Aplicar novo deployment
echo -e "\n${BLUE}🚀 Aplicando novo deployment...${NC}"
kubectl apply -f dogbank-complete.yaml

# Aguardar PostgreSQL
echo -e "\n${BLUE}🐘 Aguardando PostgreSQL inicializar...${NC}"
sleep 10  # Dar tempo para o pod ser criado
wait_for_pod "app=postgres" 180

# Verificar se o banco foi inicializado corretamente
echo -e "\n${BLUE}🔍 Verificando banco de dados...${NC}"
kubectl exec deployment/postgres -n production -- psql -U dogbank -c "SELECT COUNT(*) as total_usuarios FROM usuarios;" || {
    echo -e "${RED}❌ Erro ao verificar banco de dados${NC}"
}

# Aguardar outros pods
echo -e "\n${BLUE}⏳ Aguardando todos os módulos iniciarem...${NC}"
sleep 30

# Status final
echo -e "\n${GREEN}📊 Status dos Pods:${NC}"
kubectl get pods -n production -o wide

echo -e "\n${GREEN}🌐 Services:${NC}"
kubectl get services -n production

# Verificar pods com problemas
FAILING_PODS=$(kubectl get pods -n production --no-headers | grep -v "Running" | grep -v "Completed" | wc -l)
if [ $FAILING_PODS -gt 0 ]; then
    echo -e "\n${YELLOW}⚠️  Alguns pods ainda não estão Running:${NC}"
    kubectl get pods -n production | grep -v "Running" | grep -v "Completed"
    
    echo -e "\n${BLUE}📋 Logs dos pods com problemas:${NC}"
    for pod in $(kubectl get pods -n production --no-headers | grep -v "Running" | grep -v "Completed" | awk '{print $1}'); do
        echo -e "\n${YELLOW}Pod: $pod${NC}"
        kubectl logs $pod -n production --tail=20 || echo "Não foi possível obter logs"
    done
else
    echo -e "\n${GREEN}✅ Todos os pods estão rodando!${NC}"
fi

# Instruções para teste
echo -e "\n${BLUE}🧪 Para testar a aplicação:${NC}"
echo "1. Port forward do auth-service:"
echo "   kubectl port-forward service/auth-service 8088:8088 -n production"
echo ""
echo "2. Em outro terminal, teste o login:"
echo "   curl -X POST http://localhost:8088/api/auth/login \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"cpf\": \"78912345603\", \"senha\": \"123456\"}'"
echo ""
echo "3. Para acessar o PostgreSQL:"
echo "   kubectl exec -it deployment/postgres -n production -- psql -U dogbank"

# Salvar comandos úteis
cat > dogbank-commands.txt << EOF
# DogBank - Comandos Úteis

## Ver logs
kubectl logs -f deployment/auth-module -n production
kubectl logs -f deployment/account-module -n production
kubectl logs -f deployment/postgres -n production

## Port forwards
kubectl port-forward service/auth-service 8088:8088 -n production
kubectl port-forward service/account-service 8089:8089 -n production
kubectl port-forward service/postgres 5432:5432 -n production

## Acessar banco
kubectl exec -it deployment/postgres -n production -- psql -U dogbank

## Ver todos recursos
kubectl get all -n production

## Deletar tudo
kubectl delete namespace production
EOF

echo -e "\n${GREEN}📝 Comandos úteis salvos em: dogbank-commands.txt${NC}"