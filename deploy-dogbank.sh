#!/bin/bash

# Script de deploy completo do DogBank no Kubernetes
# Uso: ./deploy-dogbank.sh

set -e

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🐕 DogBank - Deploy no Kubernetes${NC}"
echo -e "${BLUE}===================================${NC}"

# Verificar se kubectl está instalado
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl não está instalado${NC}"
    exit 1
fi

# Criar namespace se não existir
echo -e "\n${BLUE}📁 Criando namespace 'production'...${NC}"
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -

# Criar secret do PostgreSQL
echo -e "\n${BLUE}🔐 Criando secret do PostgreSQL...${NC}"
kubectl create secret generic dogbank-postgres-secret \
  --from-literal=POSTGRES_USER=dogbank \
  --from-literal=POSTGRES_PASSWORD=dog1234 \
  --from-literal=POSTGRES_DB=dogbank \
  -n production \
  --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✅ Secret criada com sucesso!${NC}"

# Aplicar o deployment completo
echo -e "\n${BLUE}🚀 Aplicando deployment completo...${NC}"
kubectl apply -f dogbank-deployment.yaml

# Aguardar PostgreSQL ficar pronto
echo -e "\n${BLUE}⏳ Aguardando PostgreSQL inicializar...${NC}"
kubectl wait --for=condition=ready pod -l app=postgres -n production --timeout=120s

# Verificar status dos pods
echo -e "\n${BLUE}📊 Status dos Pods:${NC}"
kubectl get pods -n production

# Verificar services
echo -e "\n${BLUE}🌐 Services criados:${NC}"
kubectl get services -n production

# Testar conexão com auth-service
echo -e "\n${BLUE}🧪 Testando auth-service...${NC}"
echo -e "${YELLOW}Para testar o auth-service, execute:${NC}"
echo "kubectl port-forward service/auth-service 8088:8088 -n production"
echo ""
echo "Em outro terminal:"
echo 'curl -X POST http://localhost:8088/api/auth/login \\'
echo '  -H "Content-Type: application/json" \\'
echo '  -d '\''{"cpf": "78912345603", "senha": "123456"}'\'''

# Informações úteis
echo -e "\n${GREEN}🎉 Deploy concluído com sucesso!${NC}"
echo -e "\n${BLUE}📝 Comandos úteis:${NC}"
echo "• Ver logs: kubectl logs -f deployment/auth-module -n production"
echo "• Entrar no PostgreSQL: kubectl exec -it deployment/postgres -n production -- psql -U dogbank"
echo "• Ver todos os recursos: kubectl get all -n production"
echo "• Deletar tudo: kubectl delete namespace production"

# Verificar se há algum pod com erro
PODS_WITH_ERROR=$(kubectl get pods -n production --no-headers | grep -E "Error|CrashLoopBackOff|Pending" | wc -l)
if [ $PODS_WITH_ERROR -gt 0 ]; then
    echo -e "\n${RED}⚠️  Atenção: Alguns pods estão com problemas${NC}"
    kubectl get pods -n production | grep -E "Error|CrashLoopBackOff|Pending"
fi