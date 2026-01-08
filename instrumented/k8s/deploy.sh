#!/bin/bash
# =============================================================================
# DogBank - Kubernetes Deployment Script
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="dogbank"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    echo_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        echo_error "kubectl is not installed. Please install it first."
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        echo_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    echo_info "Prerequisites check passed!"
}

# Update secrets with actual values
update_secrets() {
    echo_warn "IMPORTANT: Before deploying, update the secrets in base/secrets.yaml with your actual values:"
    echo "  - DD_API_KEY: Your Datadog API key"
    echo "  - DD_APP_KEY: Your Datadog App key"
    echo "  - VITE_DD_CLIENT_TOKEN: Your Datadog RUM client token"
    echo "  - VITE_DD_APPLICATION_ID: Your Datadog RUM application ID"
    echo ""
    read -p "Have you updated the secrets? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo_error "Please update the secrets before deploying."
        exit 1
    fi
}

# Build and push images (if needed)
build_images() {
    echo_info "Note: This script assumes images are already built and available."
    echo_info "To build images, run the following commands from the docker directory:"
    echo "  docker build -t dogbank/auth-service:latest ./auth-module"
    echo "  docker build -t dogbank/account-service:latest ./account-module"
    echo "  docker build -t dogbank/transaction-service:latest ./transaction-module"
    echo "  docker build -t dogbank/bancocentral-service:latest ./bancocentral-module"
    echo "  docker build -t dogbank/notification-service:latest ./notification-module"
    echo "  docker build -t dogbank/frontend:latest ../dogbank-frontend"
}

# Deploy using kustomize
deploy() {
    echo_info "Deploying DogBank to Kubernetes..."
    
    # Apply base resources
    kubectl apply -k "$SCRIPT_DIR/base"
    
    echo_info "Waiting for deployments to be ready..."
    
    # Wait for infrastructure
    echo_info "Waiting for PostgreSQL..."
    kubectl wait --for=condition=available --timeout=120s deployment/postgres -n $NAMESPACE || true
    
    echo_info "Waiting for Redis..."
    kubectl wait --for=condition=available --timeout=60s deployment/redis -n $NAMESPACE || true
    
    # Wait for backend services
    echo_info "Waiting for backend services..."
    kubectl wait --for=condition=available --timeout=180s deployment/auth-service -n $NAMESPACE || true
    kubectl wait --for=condition=available --timeout=180s deployment/account-service -n $NAMESPACE || true
    kubectl wait --for=condition=available --timeout=180s deployment/transaction-service -n $NAMESPACE || true
    kubectl wait --for=condition=available --timeout=180s deployment/bancocentral-service -n $NAMESPACE || true
    kubectl wait --for=condition=available --timeout=180s deployment/notification-service -n $NAMESPACE || true
    
    # Wait for frontend
    echo_info "Waiting for frontend..."
    kubectl wait --for=condition=available --timeout=60s deployment/frontend -n $NAMESPACE || true
    kubectl wait --for=condition=available --timeout=60s deployment/nginx -n $NAMESPACE || true
    
    echo_info "Deployment complete!"
}

# Get status
status() {
    echo_info "DogBank Deployment Status:"
    echo ""
    kubectl get all -n $NAMESPACE
    echo ""
    echo_info "Services:"
    kubectl get svc -n $NAMESPACE
    echo ""
    echo_info "Ingress:"
    kubectl get ingress -n $NAMESPACE
}

# Get access URL
get_url() {
    echo_info "Getting access URL..."
    
    # Try LoadBalancer first
    EXTERNAL_IP=$(kubectl get svc nginx -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    
    if [ -n "$EXTERNAL_IP" ]; then
        echo_info "Access DogBank at: http://$EXTERNAL_IP"
    else
        # Try NodePort
        NODE_PORT=$(kubectl get svc nginx -n $NAMESPACE -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)
        if [ -n "$NODE_PORT" ]; then
            echo_info "Access DogBank at: http://<node-ip>:$NODE_PORT"
        else
            echo_warn "LoadBalancer IP not available yet. Try again later or use port-forward:"
            echo "  kubectl port-forward svc/nginx 8080:80 -n $NAMESPACE"
            echo "  Then access: http://localhost:8080"
        fi
    fi
}

# Delete deployment
delete() {
    echo_warn "This will delete all DogBank resources from the cluster."
    read -p "Are you sure? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo_info "Deleting DogBank resources..."
        kubectl delete -k "$SCRIPT_DIR/base" || true
        echo_info "DogBank resources deleted."
    fi
}

# Port forward for local access
port_forward() {
    echo_info "Starting port-forward to nginx service..."
    echo_info "Access DogBank at: http://localhost:8080"
    kubectl port-forward svc/nginx 8080:80 -n $NAMESPACE
}

# Show logs
logs() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        echo_error "Please specify a service name (e.g., auth-service, transaction-service)"
        exit 1
    fi
    kubectl logs -f -l app=$SERVICE -n $NAMESPACE
}

# Main
case "$1" in
    deploy)
        check_prerequisites
        update_secrets
        deploy
        status
        get_url
        ;;
    status)
        status
        ;;
    url)
        get_url
        ;;
    delete)
        delete
        ;;
    port-forward)
        port_forward
        ;;
    logs)
        logs $2
        ;;
    build)
        build_images
        ;;
    *)
        echo "DogBank Kubernetes Deployment Script"
        echo ""
        echo "Usage: $0 {deploy|status|url|delete|port-forward|logs|build}"
        echo ""
        echo "Commands:"
        echo "  deploy       - Deploy DogBank to Kubernetes"
        echo "  status       - Show deployment status"
        echo "  url          - Get access URL"
        echo "  delete       - Delete DogBank from cluster"
        echo "  port-forward - Start port-forward for local access"
        echo "  logs <svc>   - Show logs for a service"
        echo "  build        - Show build instructions"
        ;;
esac
