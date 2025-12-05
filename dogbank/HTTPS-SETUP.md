# HTTPS Setup com Let's Encrypt + Route53

## 📋 Pré-requisitos

### 1. Registrar domínio no Route53

1. Acesse o AWS Console → Route53
2. Registre o domínio `dogbank.com` (custo: ~$12/ano)
3. Aguarde propagação DNS (pode levar até 48h)

### 2. Configurar Hosted Zone

Depois do registro, crie um registro A apontando para o LoadBalancer:

```bash
# 1. Obter IP público do LoadBalancer EKS
kubectl get svc -n kube-system traefik

# Exemplo de output:
# NAME      TYPE           CLUSTER-IP      EXTERNAL-IP
# traefik   LoadBalancer   10.100.x.x      ae0d37ed522d34b9a94d25c971146714-1099794259.us-east-1.elb.amazonaws.com
```

### 3. Criar registro DNS no Route53

**Via AWS Console:**

1. Vá em Route53 → Hosted Zones → dogbank.com
2. Crie novo Record:
   - **Name:** `lab`
   - **Type:** `A - Routes traffic to an IPv4 address and some AWS resources`
   - **Alias:** Yes
   - **Alias target:** Selecione o ELB do Traefik
   - **Routing policy:** Simple routing

**Via AWS CLI:**

```bash
# Pegar o DNS do ELB
ELB_DNS=$(kubectl get svc -n kube-system traefik -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Pegar o Hosted Zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='dogbank.com.'].Id" --output text | cut -d'/' -f3)

# Pegar o ELB Hosted Zone ID (us-east-1)
ELB_ZONE_ID="Z35SXDOTRQ7X7K"  # us-east-1

# Criar o registro
cat > /tmp/route53-record.json <<EOF
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "lab.dogbank.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "${ELB_ZONE_ID}",
        "DNSName": "${ELB_DNS}",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file:///tmp/route53-record.json
```

### 4. Verificar DNS

```bash
# Verificar propagação DNS
dig lab.dogbank.com

# Ou usar nslookup
nslookup lab.dogbank.com

# Teste com curl
curl -I http://lab.dogbank.com
```

## 🚀 Deploy da configuração HTTPS

### 1. Aplicar configuração do Traefik com Let's Encrypt

```bash
kubectl apply -f dogbank-traefik-https.yaml
```

### 2. Verificar certificado sendo emitido

```bash
# Ver logs do Traefik
kubectl logs -n kube-system -l app=traefik -f

# Procure por linhas como:
# time="..." level=info msg="Trying to challenge from ..." providerName=letsencrypt.acme
```

### 3. Verificar certificado obtido

```bash
# Verificar o acme.json
kubectl exec -n kube-system -it $(kubectl get pods -n kube-system -l app=traefik -o name | head -1) -- cat /acme/acme.json

# Testar HTTPS
curl -v https://lab.dogbank.com/api/auth/health
```

## 🔒 Detalhes da Configuração

### Certificado Let's Encrypt

- **Email:** admin@dogbank.local (altere para email real)
- **Challenge:** HTTP-01 (automático via porta 80)
- **Storage:** PersistentVolume `/acme/acme.json`
- **Auto-renewal:** Traefik renova automaticamente 30 dias antes de expirar

### Redirecionamento HTTP → HTTPS

Todo tráfego HTTP (porta 80) é automaticamente redirecionado para HTTPS (porta 443).

### CORS

O CORS está configurado para aceitar:
- http://localhost:3000 (desenvolvimento local)
- https://lab.dogbank.com (produção)
- Métodos: GET, POST, PUT, DELETE, OPTIONS, PATCH
- Headers: * (todos)
- Credentials: false (necessário quando usa wildcard origins)

## 📊 Custos estimados

- **Domínio dogbank.com:** ~$12/ano
- **Route53 Hosted Zone:** $0.50/mês
- **Route53 Queries:** $0.40 por milhão de queries (~$0.01/mês para baixo tráfego)
- **Let's Encrypt:** GRÁTIS
- **Total:** ~$13/ano

## 🔧 Troubleshooting

### Let's Encrypt não emite certificado

```bash
# 1. Verificar se DNS está resolvendo
dig lab.dogbank.com

# 2. Verificar se porta 80 está acessível
curl -I http://lab.dogbank.com

# 3. Ver logs do Traefik
kubectl logs -n kube-system -l app=traefik --tail=100

# 4. Usar staging para testes (evita rate limit)
# Edite traefik-acme-config.yaml e descomente:
# caServer: https://acme-staging-v02.api.letsencrypt.org/directory
```

### Rate limit do Let's Encrypt

- **Production:** 50 certificados/semana por domínio
- **Staging:** Sem limite (para testes)
- Use staging primeiro, depois mude para production

### Certificado expirado

Traefik renova automaticamente, mas se expirar:

```bash
# Deletar certificado antigo
kubectl delete pvc traefik-acme-pvc -n kube-system

# Recriar PVC
kubectl apply -f dogbank-traefik-https.yaml

# Restart Traefik
kubectl rollout restart deployment traefik -n kube-system
```

## 🎯 Próximos passos

1. ✅ Registrar domínio dogbank.com no Route53
2. ✅ Criar registro DNS lab.dogbank.com → ELB
3. ✅ Aplicar configuração HTTPS: `kubectl apply -f dogbank-traefik-https.yaml`
4. ⏳ Aguardar emissão do certificado (1-5 minutos)
5. ✅ Testar: `curl https://lab.dogbank.com/api/auth/health`
6. ✅ Atualizar frontend para usar https://lab.dogbank.com
