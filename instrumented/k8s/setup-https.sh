#!/bin/bash

# =============================================================================
# Setup HTTPS with Let's Encrypt for DogBank on EKS
# =============================================================================
# This script:
# 1. Installs cert-manager for automatic SSL certificate management
# 2. Installs nginx-ingress-controller
# 3. Configures Let's Encrypt certificate issuer
# 4. Creates Ingress with TLS
# 5. Creates Route53 DNS record pointing to the LoadBalancer
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DogBank HTTPS Setup with Let's Encrypt${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
DOMAIN="lab.dogbank.com"
NAMESPACE="dogbank"
ROUTE53_HOSTED_ZONE_ID="YOUR_HOSTED_ZONE_ID"  # Replace with your Zone ID

# =============================================================================
# Step 1: Install cert-manager
# =============================================================================
echo -e "${YELLOW}[1/6] Installing cert-manager...${NC}"

# Check if cert-manager is already installed
if kubectl get namespace cert-manager &> /dev/null; then
    echo -e "${GREEN}✓ cert-manager namespace already exists${NC}"
else
    echo "Creating cert-manager namespace and installing..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

    echo "Waiting for cert-manager to be ready..."
    kubectl wait --for=condition=Available --timeout=300s \
        deployment/cert-manager -n cert-manager
    kubectl wait --for=condition=Available --timeout=300s \
        deployment/cert-manager-webhook -n cert-manager
    kubectl wait --for=condition=Available --timeout=300s \
        deployment/cert-manager-cainjector -n cert-manager

    echo -e "${GREEN}✓ cert-manager installed successfully${NC}"
fi

# =============================================================================
# Step 2: Install nginx-ingress-controller
# =============================================================================
echo -e "${YELLOW}[2/6] Installing nginx-ingress-controller...${NC}"

# Check if nginx-ingress is already installed
if kubectl get namespace ingress-nginx &> /dev/null; then
    echo -e "${GREEN}✓ nginx-ingress namespace already exists${NC}"
else
    echo "Installing nginx-ingress-controller..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.5/deploy/static/provider/aws/deploy.yaml

    echo "Waiting for nginx-ingress-controller to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=300s

    echo -e "${GREEN}✓ nginx-ingress-controller installed successfully${NC}"
fi

# =============================================================================
# Step 3: Apply Let's Encrypt ClusterIssuer
# =============================================================================
echo -e "${YELLOW}[3/6] Configuring Let's Encrypt ClusterIssuer...${NC}"

kubectl apply -f base/cert-manager-issuer.yaml

echo "Waiting for ClusterIssuer to be ready..."
sleep 10

echo -e "${GREEN}✓ ClusterIssuer configured${NC}"

# =============================================================================
# Step 4: Apply Ingress with TLS
# =============================================================================
echo -e "${YELLOW}[4/6] Creating Ingress with TLS...${NC}"

kubectl apply -f base/ingress-tls.yaml

echo "Waiting for certificate to be issued..."
echo "This may take 1-2 minutes..."
sleep 30

# Check certificate status
echo "Certificate status:"
kubectl get certificate -n $NAMESPACE dogbank-tls-cert || echo "Certificate being provisioned..."

echo -e "${GREEN}✓ Ingress with TLS created${NC}"

# =============================================================================
# Step 5: Get LoadBalancer DNS
# =============================================================================
echo -e "${YELLOW}[5/6] Getting LoadBalancer DNS...${NC}"

echo "Waiting for LoadBalancer to be provisioned..."
sleep 10

# Get the LoadBalancer hostname
LB_HOSTNAME=$(kubectl get svc ingress-nginx-controller -n ingress-nginx \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

if [ -z "$LB_HOSTNAME" ]; then
    echo -e "${RED}✗ Failed to get LoadBalancer hostname${NC}"
    echo "Please wait a few more minutes and check manually with:"
    echo "kubectl get svc ingress-nginx-controller -n ingress-nginx"
    exit 1
fi

echo -e "${GREEN}✓ LoadBalancer DNS: ${LB_HOSTNAME}${NC}"

# =============================================================================
# Step 6: Create Route53 DNS Record
# =============================================================================
echo -e "${YELLOW}[6/6] Creating Route53 DNS record...${NC}"

if [ "$ROUTE53_HOSTED_ZONE_ID" == "YOUR_HOSTED_ZONE_ID" ]; then
    echo -e "${YELLOW}⚠ Please update ROUTE53_HOSTED_ZONE_ID in this script${NC}"
    echo ""
    echo "To find your Hosted Zone ID, run:"
    echo "aws route53 list-hosted-zones --query \"HostedZones[?Name=='dogbank.com.'].Id\" --output text"
    echo ""
    echo "Then create the DNS record manually or re-run this script."
    echo ""
    echo -e "${BLUE}Manual DNS creation command:${NC}"
    cat << EOF
aws route53 change-resource-record-sets \\
    --hosted-zone-id YOUR_HOSTED_ZONE_ID \\
    --change-batch '{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "lab.dogbank.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "'$LB_HOSTNAME'"}]
    }
  }]
}'
EOF
else
    echo "Creating DNS record for $DOMAIN..."

    aws route53 change-resource-record-sets \
        --hosted-zone-id $ROUTE53_HOSTED_ZONE_ID \
        --change-batch "{
      \"Changes\": [{
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"$DOMAIN\",
          \"Type\": \"CNAME\",
          \"TTL\": 300,
          \"ResourceRecords\": [{\"Value\": \"$LB_HOSTNAME\"}]
        }
      }]
    }"

    echo -e "${GREEN}✓ DNS record created successfully${NC}"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ HTTPS Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Wait 5-10 minutes for DNS propagation"
echo "2. Wait for Let's Encrypt to issue the certificate"
echo "3. Access your application at: https://$DOMAIN"
echo ""
echo -e "${BLUE}Check certificate status:${NC}"
echo "kubectl get certificate -n $NAMESPACE"
echo "kubectl describe certificate dogbank-tls-cert -n $NAMESPACE"
echo ""
echo -e "${BLUE}Check ingress status:${NC}"
echo "kubectl get ingress -n $NAMESPACE"
echo "kubectl describe ingress dogbank-ingress -n $NAMESPACE"
echo ""
echo -e "${BLUE}Troubleshooting:${NC}"
echo "kubectl logs -n cert-manager deployment/cert-manager"
echo "kubectl logs -n ingress-nginx deployment/ingress-nginx-controller"
echo ""
