# 🔒 Configuração HTTPS para DogBank

Este guia explica como configurar e usar HTTPS no ambiente Docker local do DogBank.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquivos Criados](#arquivos-criados)
3. [Início Rápido](#início-rápido)
4. [Configuração Detalhada](#configuração-detalhada)
5. [Confiar no Certificado](#confiar-no-certificado)
6. [Headers de Segurança](#headers-de-segurança)
7. [Rate Limiting](#rate-limiting)
8. [Troubleshooting](#troubleshooting)
9. [Produção](#produção)

---

## 🎯 Visão Geral

A configuração HTTPS inclui:

| Recurso | Descrição |
|---------|-----------|
| **TLS 1.2/1.3** | Protocolos seguros de criptografia |
| **HTTP → HTTPS** | Redirecionamento automático |
| **Headers de Segurança** | HSTS, X-Frame-Options, CSP, etc. |
| **Rate Limiting** | Proteção contra brute force e DDoS |
| **CORS** | Configuração para origens permitidas |
| **HTTP/2** | Protocolo moderno para melhor performance |

---

## 📁 Arquivos Criados

```
dogbank/
├── nginx/
│   ├── nginx-https.conf      # Configuração Nginx com HTTPS
│   ├── ssl/
│   │   ├── generate-certs.sh # Script para gerar certificados
│   │   ├── dogbank.crt       # Certificado SSL
│   │   ├── dogbank.key       # Chave privada
│   │   ├── dogbank.pem       # Certificado + chave combinados
│   │   ├── dhparam.pem       # Parâmetros Diffie-Hellman
│   │   └── openssl.cnf       # Configuração OpenSSL
│   └── logs/                 # Logs do Nginx
├── docker-compose.https.yml  # Docker Compose com HTTPS
└── HTTPS_SETUP.md           # Esta documentação
```

---

## 🚀 Início Rápido

### 1. Gerar Certificados (se ainda não existem)

```bash
cd dogbank/nginx/ssl
./generate-certs.sh
```

### 2. Iniciar com HTTPS

```bash
cd dogbank
docker-compose -f docker-compose.https.yml up -d
```

### 3. Acessar a Aplicação

- **HTTPS:** https://localhost
- **HTTP:** http://localhost (redireciona para HTTPS)

> ⚠️ O navegador mostrará um aviso de certificado auto-assinado. Clique em "Avançado" → "Continuar para localhost".

---

## ⚙️ Configuração Detalhada

### Variáveis de Ambiente

Crie um arquivo `.env` na pasta `dogbank/`:

```env
# Banco de dados
POSTGRES_DB=dogbank
POSTGRES_USER=dogbank
POSTGRES_PASSWORD=SuaSenhaSegura123!

# Domínio (para certificados)
DOMAIN=localhost
```

### Regenerar Certificados com Domínio Personalizado

```bash
cd dogbank/nginx/ssl
DOMAIN=meudominio.local ./generate-certs.sh
```

### Usar Certificados Existentes

Se você já tem certificados, coloque-os em `nginx/ssl/`:

```bash
cp seu-certificado.crt nginx/ssl/dogbank.crt
cp sua-chave.key nginx/ssl/dogbank.key
```

---

## 🔐 Confiar no Certificado

Para evitar avisos do navegador, instale o certificado como confiável:

### Linux (Ubuntu/Debian)

```bash
sudo cp dogbank/nginx/ssl/dogbank.crt /usr/local/share/ca-certificates/dogbank.crt
sudo update-ca-certificates
```

### macOS

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  dogbank/nginx/ssl/dogbank.crt
```

### Windows

1. Clique duplo em `dogbank.crt`
2. Clique em "Instalar Certificado"
3. Selecione "Máquina Local"
4. Selecione "Colocar todos os certificados no repositório a seguir"
5. Clique em "Procurar" → "Autoridades de Certificação Raiz Confiáveis"
6. Conclua a instalação

### Chrome (alternativa)

1. Acesse `chrome://flags/#allow-insecure-localhost`
2. Habilite "Allow invalid certificates for resources loaded from localhost"

---

## 🛡️ Headers de Segurança

A configuração inclui os seguintes headers:

| Header | Valor | Proteção |
|--------|-------|----------|
| `X-Frame-Options` | SAMEORIGIN | Clickjacking |
| `X-Content-Type-Options` | nosniff | MIME sniffing |
| `X-XSS-Protection` | 1; mode=block | XSS |
| `Strict-Transport-Security` | max-age=31536000 | Downgrade attacks |
| `Referrer-Policy` | strict-origin-when-cross-origin | Information leakage |
| `Content-Security-Policy` | default-src 'self' | XSS, injection |
| `Permissions-Policy` | geolocation=() | Feature abuse |

### Verificar Headers

```bash
curl -I https://localhost/health --insecure
```

---

## ⏱️ Rate Limiting

Configuração de rate limiting por endpoint:

| Zona | Limite | Endpoints |
|------|--------|-----------|
| `api_login` | 5 req/min | `/api/auth/login` |
| `api_transactions` | 30 req/min | `/api/transactions/*` |
| `api_general` | 10 req/s | Todos os outros |

### Resposta quando limite é atingido

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

---

## 🔧 Troubleshooting

### Erro: "Connection refused"

```bash
# Verificar se os containers estão rodando
docker-compose -f docker-compose.https.yml ps

# Ver logs do Nginx
docker-compose -f docker-compose.https.yml logs nginx
```

### Erro: "SSL certificate problem"

```bash
# Regenerar certificados
cd nginx/ssl
rm -f dogbank.* dhparam.pem
./generate-certs.sh

# Reiniciar Nginx
docker-compose -f docker-compose.https.yml restart nginx
```

### Erro: "502 Bad Gateway"

```bash
# Verificar se os serviços backend estão rodando
docker-compose -f docker-compose.https.yml logs auth-service

# Verificar conectividade
docker exec dogbank-gateway ping auth-service
```

### Testar Endpoints

```bash
# Health check
curl -k https://localhost/health

# Login
curl -k -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cpf":"12345678915","password":"123456"}'
```

---

## 🌐 Produção

Para produção, **NÃO use certificados auto-assinados**. Use Let's Encrypt:

### Opção 1: Certbot

```bash
# Instalar certbot
apt-get install certbot python3-certbot-nginx

# Obter certificado
certbot --nginx -d seudominio.com
```

### Opção 2: Traefik com ACME

O projeto já inclui configurações Traefik em:
- `traefik-acme-config.yaml`
- `dogbank-traefik-https.yaml`

### Checklist de Produção

- [ ] Usar certificados de CA confiável (Let's Encrypt)
- [ ] Remover credenciais hardcoded
- [ ] Configurar firewall (apenas portas 80/443)
- [ ] Habilitar logs de auditoria
- [ ] Configurar backup do banco de dados
- [ ] Implementar monitoramento (Datadog, Prometheus)
- [ ] Configurar alertas de segurança

---

## 📊 Comparação HTTP vs HTTPS

| Aspecto | HTTP | HTTPS |
|---------|------|-------|
| Porta | 80 | 443 |
| Criptografia | ❌ | ✅ TLS 1.2/1.3 |
| Headers de segurança | ❌ | ✅ |
| Rate limiting | ❌ | ✅ |
| HTTP/2 | ❌ | ✅ |
| HSTS | ❌ | ✅ |
| Proteção MITM | ❌ | ✅ |

---

## 📝 Comandos Úteis

```bash
# Iniciar com HTTPS
docker-compose -f docker-compose.https.yml up -d

# Parar
docker-compose -f docker-compose.https.yml down

# Ver logs
docker-compose -f docker-compose.https.yml logs -f nginx

# Rebuild
docker-compose -f docker-compose.https.yml build --no-cache

# Verificar certificado
openssl x509 -in nginx/ssl/dogbank.crt -text -noout

# Testar conexão SSL
openssl s_client -connect localhost:443 -servername localhost
```

---

*Documentação criada por Manus AI - Janeiro 2026*
