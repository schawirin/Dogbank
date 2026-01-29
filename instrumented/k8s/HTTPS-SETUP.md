# 🔒 HTTPS Setup for DogBank with Let's Encrypt

Este guia configura HTTPS automático com certificado SSL gratuito do Let's Encrypt para o DogBank rodando no EKS.

## 📋 Pré-requisitos

1. ✅ Cluster EKS rodando com o DogBank
2. ✅ Domínio registrado (ex: `dogbank.com`)
3. ✅ Hosted Zone no Route53 para o domínio
4. ✅ AWS CLI configurado com credenciais válidas
5. ✅ kubectl configurado para o cluster EKS

## 🚀 Opção 1: Instalação Automática (Recomendado)

### 1. Encontre seu Hosted Zone ID

```bash
aws route53 list-hosted-zones --query "HostedZones[?Name=='dogbank.com.'].Id" --output text
```

### 2. Edite o script setup-https.sh

Abra o arquivo `setup-https.sh` e atualize:

```bash
ROUTE53_HOSTED_ZONE_ID="Z1234567890ABC"  # Substitua pelo seu Zone ID
```

### 3. Execute o script

```bash
cd /Users/pedro.schawirin/Documents/Dogbank/instrumented/k8s
./setup-https.sh
```

O script irá:
- ✅ Instalar cert-manager
- ✅ Instalar nginx-ingress-controller
- ✅ Configurar Let's Encrypt ClusterIssuer
- ✅ Criar Ingress com TLS
- ✅ Criar registro DNS no Route53

## 🛠️ Opção 2: Instalação Manual

### Passo 1: Instalar cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

# Aguarde cert-manager ficar ready
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager-webhook -n cert-manager
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
```

### Passo 2: Instalar nginx-ingress-controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.5/deploy/static/provider/aws/deploy.yaml

# Aguarde nginx-ingress ficar ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s
```

### Passo 3: Aplicar ClusterIssuer

```bash
kubectl apply -f base/cert-manager-issuer.yaml
```

### Passo 4: Aplicar Ingress com TLS

```bash
kubectl apply -f base/ingress-tls.yaml
```

### Passo 5: Obter LoadBalancer DNS

```bash
kubectl get svc ingress-nginx-controller -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

Anote o hostname do LoadBalancer (ex: `a1234567890.us-east-1.elb.amazonaws.com`)

### Passo 6: Criar registro DNS no Route53

Substitua `YOUR_HOSTED_ZONE_ID` e `YOUR_LOADBALANCER_DNS`:

```bash
aws route53 change-resource-record-sets \
    --hosted-zone-id YOUR_HOSTED_ZONE_ID \
    --change-batch '{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "lab.dogbank.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "YOUR_LOADBALANCER_DNS"}]
    }
  }]
}'
```

## ✅ Verificação

### 1. Verificar Certificate

```bash
kubectl get certificate -n dogbank
kubectl describe certificate dogbank-tls-cert -n dogbank
```

Status esperado: `Ready: True`

### 2. Verificar Ingress

```bash
kubectl get ingress -n dogbank
kubectl describe ingress dogbank-ingress -n dogbank
```

### 3. Verificar DNS

```bash
nslookup lab.dogbank.com
# ou
dig lab.dogbank.com
```

### 4. Testar HTTPS

Aguarde 5-10 minutos para:
- DNS propagar
- Let's Encrypt emitir o certificado

Então acesse:
```
https://lab.dogbank.com
```

## 🔧 Troubleshooting

### Certificado não é emitido

```bash
# Verificar logs do cert-manager
kubectl logs -n cert-manager deployment/cert-manager

# Verificar CertificateRequest
kubectl get certificaterequest -n dogbank
kubectl describe certificaterequest -n dogbank

# Verificar Challenge
kubectl get challenge -n dogbank
kubectl describe challenge -n dogbank
```

### Ingress não responde

```bash
# Verificar logs do nginx-ingress
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Verificar LoadBalancer
kubectl get svc -n ingress-nginx
```

### DNS não resolve

```bash
# Verificar registro no Route53
aws route53 list-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --query "ResourceRecordSets[?Name=='lab.dogbank.com.']"

# Aguarde propagação (pode levar até 5-10 minutos)
watch -n 5 dig lab.dogbank.com
```

### Erro "Too Many Requests" do Let's Encrypt

Se você recebeu muitas requisições negadas:

1. Use o ClusterIssuer de staging primeiro:
```bash
# Edite ingress-tls.yaml e mude para:
cert-manager.io/cluster-issuer: "letsencrypt-staging"
```

2. Teste com staging
3. Depois volte para production

## 📊 Monitoramento

### Verificar status geral

```bash
# Pods
kubectl get pods -n cert-manager
kubectl get pods -n ingress-nginx
kubectl get pods -n dogbank

# Certificados
kubectl get certificate --all-namespaces

# Ingresses
kubectl get ingress --all-namespaces
```

## 🔄 Renovação Automática

O cert-manager renova automaticamente os certificados:
- Certificados Let's Encrypt são válidos por 90 dias
- Renovação automática ocorre 30 dias antes da expiração
- Nenhuma ação manual necessária

## 📝 Endpoints Disponíveis

Após a configuração, os seguintes endpoints estarão disponíveis em HTTPS:

- `https://lab.dogbank.com/` - Frontend React
- `https://lab.dogbank.com/api/auth` - Auth Service
- `https://lab.dogbank.com/api/accounts` - Account Service
- `https://lab.dogbank.com/api/transactions` - Transaction Service
- `https://lab.dogbank.com/api/bancocentral` - Banco Central Service
- `https://lab.dogbank.com/api/chatbot` - Chatbot Service

## 🎯 Próximos Passos

1. Configure HTTP → HTTPS redirect (já incluído no Ingress)
2. Configure HSTS headers para segurança adicional
3. Configure rate limiting no Ingress
4. Configure WAF (AWS WAF) para proteção adicional
5. Configure backup automático dos certificados

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs: `kubectl logs -n cert-manager deployment/cert-manager`
2. Verifique o status: `kubectl get certificate -n dogbank -o yaml`
3. Consulte a documentação: https://cert-manager.io/docs/

---

**Nota**: Este setup usa o ambiente **production** do Let's Encrypt. Para testes, use o `letsencrypt-staging` ClusterIssuer primeiro.
