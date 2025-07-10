#!/bin/bash

# VR Streaming Platform Deployment Script
set -e

echo "🚀 Starting VR Streaming Platform deployment..."

# Configuration
NAMESPACE="vr-streaming"
ENVIRONMENT=${1:-"staging"}
IMAGE_TAG=${2:-"latest"}

echo "📋 Deployment Configuration:"
echo "   Environment: $ENVIRONMENT"
echo "   Namespace: $NAMESPACE"
echo "   Image Tag: $IMAGE_TAG"
echo

# Functions
check_requirements() {
    echo "🔍 Checking requirements..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        echo "❌ kubectl is not installed"
        exit 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        echo "❌ helm is not installed"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        echo "❌ Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    echo "✅ All requirements satisfied"
}

create_namespace() {
    echo "📦 Creating namespace..."
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    echo "✅ Namespace ready"
}

deploy_secrets() {
    echo "🔐 Deploying secrets..."
    
    # Create secrets from environment variables or files
    kubectl create secret generic vr-streaming-secrets \
        --namespace=$NAMESPACE \
        --from-literal=JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 32)}" \
        --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -base64 16)}" \
        --from-literal=REDIS_PASSWORD="${REDIS_PASSWORD:-$(openssl rand -base64 16)}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo "✅ Secrets deployed"
}

deploy_databases() {
    echo "🗄️ Deploying databases..."
    kubectl apply -f infrastructure/kubernetes/databases.yaml
    
    # Wait for databases to be ready
    echo "⏳ Waiting for PostgreSQL..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s
    
    echo "⏳ Waiting for Redis..."
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s
    
    echo "✅ Databases ready"
}

deploy_services() {
    echo "🚀 Deploying services..."
    
    # Update image tags in manifests
    sed -i.bak "s|image: vr-streaming/|image: ghcr.io/$GITHUB_REPOSITORY/|g" infrastructure/kubernetes/services.yaml
    sed -i.bak "s|:latest|:$IMAGE_TAG|g" infrastructure/kubernetes/services.yaml
    
    kubectl apply -f infrastructure/kubernetes/services.yaml
    
    # Wait for services to be ready
    echo "⏳ Waiting for services..."
    kubectl wait --for=condition=available deployment -l app -n $NAMESPACE --timeout=600s
    
    echo "✅ Services deployed"
}

deploy_monitoring() {
    echo "📊 Deploying monitoring..."
    kubectl apply -f infrastructure/kubernetes/monitoring.yaml
    
    echo "⏳ Waiting for monitoring services..."
    kubectl wait --for=condition=ready pod -l app=prometheus -n $NAMESPACE --timeout=300s
    
    echo "✅ Monitoring deployed"
}

deploy_ingress() {
    echo "🌐 Deploying ingress..."
    kubectl apply -f infrastructure/kubernetes/ingress.yaml
    
    # Wait for ingress to get an IP
    echo "⏳ Waiting for ingress IP..."
    while true; do
        INGRESS_IP=$(kubectl get ingress vr-streaming-ingress -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
        if [ ! -z "$INGRESS_IP" ]; then
            echo "🌍 Ingress IP: $INGRESS_IP"
            break
        fi
        sleep 10
    done
    
    echo "✅ Ingress deployed"
}

deploy_autoscaling() {
    echo "📈 Deploying autoscaling..."
    kubectl apply -f infrastructure/kubernetes/autoscaling.yaml
    echo "✅ Autoscaling configured"
}

run_health_checks() {
    echo "🏥 Running health checks..."
    
    # Get service endpoints
    AUTH_IP=$(kubectl get service auth-service -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
    SESSION_IP=$(kubectl get service session-management -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
    STREAMING_IP=$(kubectl get service vr-streaming-engine -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
    
    # Test services
    kubectl run health-check --rm -i --restart=Never --image=curlimages/curl -- \
        sh -c "
        echo 'Testing auth service...' && \
        curl -f http://$AUTH_IP:3001/health && \
        echo 'Testing session management...' && \
        curl -f http://$SESSION_IP:3002/health && \
        echo 'Testing streaming engine...' && \
        curl -f http://$STREAMING_IP:3003/health && \
        echo 'All health checks passed!'
        " -n $NAMESPACE
    
    echo "✅ Health checks passed"
}

show_status() {
    echo
    echo "📊 Deployment Status:"
    echo "===================="
    kubectl get pods -n $NAMESPACE
    echo
    kubectl get services -n $NAMESPACE
    echo
    kubectl get ingress -n $NAMESPACE
    echo
    
    # Show resource usage
    echo "💻 Resource Usage:"
    echo "=================="
    kubectl top pods -n $NAMESPACE 2>/dev/null || echo "Metrics server not available"
    echo
}

cleanup_temp_files() {
    echo "🧹 Cleaning up temporary files..."
    find infrastructure/kubernetes -name "*.bak" -delete 2>/dev/null || true
    echo "✅ Cleanup complete"
}

# Main deployment flow
main() {
    echo "🎯 Starting deployment to $ENVIRONMENT environment..."
    
    check_requirements
    create_namespace
    deploy_secrets
    deploy_databases
    deploy_services
    deploy_monitoring
    
    if [ "$ENVIRONMENT" = "production" ]; then
        deploy_ingress
    fi
    
    deploy_autoscaling
    run_health_checks
    show_status
    cleanup_temp_files
    
    echo
    echo "🎉 Deployment completed successfully!"
    echo
    echo "📋 Next Steps:"
    echo "=============="
    echo "1. Update DNS records to point to the ingress IP"
    echo "2. Configure SSL certificates"
    echo "3. Set up monitoring alerts"
    echo "4. Run load tests"
    echo
    
    if [ "$ENVIRONMENT" = "staging" ]; then
        echo "🔍 Staging URLs:"
        echo "  - API Gateway: http://$INGRESS_IP"
        echo "  - Prometheus: http://$INGRESS_IP:9090"
        echo "  - Grafana: http://$INGRESS_IP:3000"
    fi
}

# Handle script interruption
trap 'echo "❌ Deployment interrupted"; cleanup_temp_files; exit 1' INT TERM

# Run main function
main "$@"
