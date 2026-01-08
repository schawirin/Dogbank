#!/bin/bash
# test-dogbank-api.sh - Script para testar a API do DogBank

# Cores para melhor visualização
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configurações
AUTH_URL="http://localhost:8088"
ACCOUNT_URL="http://localhost:8089"
TRANSACTION_URL="http://localhost:8084"
BANCO_CENTRAL_URL="http://localhost:8085"

echo -e "${YELLOW}=== TESTE DA API DOGBANK ===${NC}"
echo "Data e hora: $(date )"
echo "--------------------------------------"

# Função para testar endpoints
test_endpoint() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  local headers=$5

  echo -e "\n${YELLOW}Testando: ${name}${NC}"
  echo "URL: ${method} ${url}"
  
  if [ -n "$data" ]; then
    echo "Payload: ${data}"
    if [ -n "$headers" ]; then
      response=$(curl -s -X ${method} "${url}" -H "Content-Type: application/json" -H "${headers}" -d "${data}")
    else
      response=$(curl -s -X ${method} "${url}" -H "Content-Type: application/json" -d "${data}")
    fi
  else
    if [ -n "$headers" ]; then
      response=$(curl -s -X ${method} "${url}" -H "Content-Type: application/json" -H "${headers}")
    else
      response=$(curl -s -X ${method} "${url}" -H "Content-Type: application/json")
    fi
  fi
  
  echo "Resposta:"
  echo "${response}" | jq . 2>/dev/null || echo "${response}"
  echo "--------------------------------------"
}

# 1. Teste de Login
login_payload='{
  "cpf": "123.456.789-15",
  "password": "123456"
}'
test_endpoint "Login (Julia Medina)" "POST" "${AUTH_URL}/api/auth/login" "${login_payload}"

# Extrair token se disponível
TOKEN=$(echo "${response}" | jq -r '.token' 2>/dev/null)
if [ "${TOKEN}" != "null" ] && [ -n "${TOKEN}" ]; then
  echo -e "${GREEN}Token obtido com sucesso!${NC}"
  AUTH_HEADER="Authorization: Bearer ${TOKEN}"
else
  echo -e "${RED}Não foi possível obter token. Continuando sem autenticação...${NC}"
  AUTH_HEADER=""
fi

# 2. Validar chave PIX
test_endpoint "Validar chave PIX" "GET" "${AUTH_URL}/api/auth/validate-pix?chavePix=julia.medina@dogbank.com"

# 3. Testar chave PIX específica
test_endpoint "Testar chave PIX específica" "GET" "${AUTH_URL}/api/auth/test-chave-pix/julia.medina@dogbank.com"

# 4. Consultar contas (se autenticado)
if [ -n "${AUTH_HEADER}" ]; then
  test_endpoint "Consultar contas" "GET" "${ACCOUNT_URL}/api/accounts" "" "${AUTH_HEADER}"
fi

# 5. Consultar saldo de uma conta específica
test_endpoint "Consultar saldo da conta 1" "GET" "${ACCOUNT_URL}/api/accounts/1/balance"

# 6. Realizar uma transferência PIX
pix_payload='{
  "sourceAccountId": 1,
  "pixKey": "joao.santos@dogbank.com",
  "amount": 100.00,
  "description": "Teste de transferência"
}'
test_endpoint "Realizar transferência PIX" "POST" "${TRANSACTION_URL}/api/transactions/pix" "${pix_payload}" "${AUTH_HEADER}"

# 7. Verificar histórico de transações
test_endpoint "Histórico de transações" "GET" "${TRANSACTION_URL}/api/transactions/account/1" "" "${AUTH_HEADER}"

echo -e "\n${GREEN}Testes concluídos!${NC}"
