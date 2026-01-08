#!/bin/bash

# =============================================================================
# Script para gerar certificados SSL auto-assinados para DogBank
# =============================================================================
# Este script cria certificados para desenvolvimento local.
# NÃO use em produção - use Let's Encrypt ou certificados de CA confiável.
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="$SCRIPT_DIR"

# Configurações do certificado
DOMAIN="${DOMAIN:-localhost}"
DAYS_VALID="${DAYS_VALID:-365}"
KEY_SIZE="${KEY_SIZE:-2048}"

echo -e "${YELLOW}🔐 Gerando certificados SSL para DogBank...${NC}"
echo -e "${YELLOW}   Domínio: $DOMAIN${NC}"
echo -e "${YELLOW}   Validade: $DAYS_VALID dias${NC}"
echo ""

# Criar arquivo de configuração OpenSSL
cat > "$CERT_DIR/openssl.cnf" << EOF
[req]
default_bits = $KEY_SIZE
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = BR
ST = Sao Paulo
L = Sao Paulo
O = DogBank
OU = Security Team
CN = $DOMAIN

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = *.$DOMAIN
DNS.3 = localhost
DNS.4 = *.localhost
DNS.5 = dogbank.local
DNS.6 = *.dogbank.local
DNS.7 = lab.dogbank.dog
DNS.8 = *.lab.dogbank.dog
IP.1 = 127.0.0.1
IP.2 = ::1
IP.3 = 0.0.0.0
EOF

echo -e "${GREEN}✅ Arquivo de configuração criado${NC}"

# Gerar chave privada
echo -e "${YELLOW}🔑 Gerando chave privada...${NC}"
openssl genrsa -out "$CERT_DIR/dogbank.key" $KEY_SIZE 2>/dev/null
echo -e "${GREEN}✅ Chave privada gerada: dogbank.key${NC}"

# Gerar certificado auto-assinado
echo -e "${YELLOW}📜 Gerando certificado...${NC}"
openssl req -new -x509 \
    -key "$CERT_DIR/dogbank.key" \
    -out "$CERT_DIR/dogbank.crt" \
    -days $DAYS_VALID \
    -config "$CERT_DIR/openssl.cnf" \
    -extensions v3_req 2>/dev/null

echo -e "${GREEN}✅ Certificado gerado: dogbank.crt${NC}"

# Gerar arquivo PEM combinado (útil para alguns serviços)
cat "$CERT_DIR/dogbank.crt" "$CERT_DIR/dogbank.key" > "$CERT_DIR/dogbank.pem"
echo -e "${GREEN}✅ Arquivo PEM combinado: dogbank.pem${NC}"

# Gerar parâmetros Diffie-Hellman para segurança adicional
echo -e "${YELLOW}🔒 Gerando parâmetros DH (pode demorar um pouco)...${NC}"
openssl dhparam -out "$CERT_DIR/dhparam.pem" 2048 2>/dev/null
echo -e "${GREEN}✅ Parâmetros DH gerados: dhparam.pem${NC}"

# Definir permissões corretas
chmod 600 "$CERT_DIR/dogbank.key"
chmod 644 "$CERT_DIR/dogbank.crt"
chmod 644 "$CERT_DIR/dogbank.pem"
chmod 644 "$CERT_DIR/dhparam.pem"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Certificados gerados com sucesso!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Arquivos criados em: ${YELLOW}$CERT_DIR${NC}"
echo -e "  - dogbank.key  (chave privada)"
echo -e "  - dogbank.crt  (certificado)"
echo -e "  - dogbank.pem  (combinado)"
echo -e "  - dhparam.pem  (parâmetros DH)"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo -e "  Este é um certificado AUTO-ASSINADO para desenvolvimento."
echo -e "  O navegador mostrará um aviso de segurança."
echo -e "  Para produção, use Let's Encrypt ou certificado de CA confiável."
echo ""
echo -e "${YELLOW}📋 Para confiar no certificado localmente:${NC}"
echo -e "  Linux:   sudo cp dogbank.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates"
echo -e "  macOS:   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain dogbank.crt"
echo -e "  Windows: Importar dogbank.crt em 'Autoridades de Certificação Raiz Confiáveis'"
