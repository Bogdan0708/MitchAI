#!/bin/bash
# =============================================================================
# Quick Deploy Script
# =============================================================================
# Simplified deployment script that handles common deployment scenarios.
#
# Usage:
#   ./deploy.sh [staging|production] [--skip-terraform] [--skip-migrate]
#
# Examples:
#   ./deploy.sh staging              # Full staging deployment
#   ./deploy.sh production           # Full production deployment
#   ./deploy.sh production --skip-terraform  # Deploy without infra changes
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Parse arguments
ENVIRONMENT=${1:-"staging"}
SKIP_TERRAFORM=false
SKIP_MIGRATE=false

for arg in "$@"; do
    case $arg in
        --skip-terraform)
            SKIP_TERRAFORM=true
            ;;
        --skip-migrate)
            SKIP_MIGRATE=true
            ;;
    esac
done

# Validate environment
case $ENVIRONMENT in
    staging|production|prod)
        if [ "$ENVIRONMENT" == "prod" ]; then
            ENVIRONMENT="production"
        fi
        ;;
    *)
        log_error "Invalid environment: $ENVIRONMENT"
        log_error "Use 'staging' or 'production'"
        exit 1
        ;;
esac

log_info "Deploying to $ENVIRONMENT"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$INFRA_DIR")"
TERRAFORM_DIR="$INFRA_DIR/terraform"

# Check prerequisites
if ! command -v gcloud &> /dev/null; then
    log_error "gcloud CLI is not installed"
    exit 1
fi

if ! command -v terraform &> /dev/null; then
    log_error "Terraform is not installed"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi

# Get project ID from Terraform or gcloud
PROJECT_ID=$(cd "$TERRAFORM_DIR" && terraform output -raw project_id 2>/dev/null || gcloud config get-value project)
REGION=$(cd "$TERRAFORM_DIR" && terraform output -raw region 2>/dev/null || echo "us-central1")

if [ -z "$PROJECT_ID" ]; then
    log_error "Could not determine GCP project ID"
    log_error "Set with: gcloud config set project <PROJECT_ID>"
    exit 1
fi

log_info "Project: $PROJECT_ID"
log_info "Region: $REGION"

# -----------------------------------------------------------------------------
# Step 1: Terraform
# -----------------------------------------------------------------------------

if [ "$SKIP_TERRAFORM" = false ]; then
    log_step "Step 1/4: Applying Terraform changes..."
    cd "$TERRAFORM_DIR"

    terraform init -input=false
    terraform plan -var="environment=$ENVIRONMENT" -out=tfplan

    log_warn "Review the plan above. Continue? (y/n)"
    read -r CONFIRM
    if [ "$CONFIRM" != "y" ]; then
        log_info "Aborted"
        exit 0
    fi

    terraform apply tfplan
    rm tfplan
else
    log_step "Step 1/4: Skipping Terraform (--skip-terraform)"
fi

# -----------------------------------------------------------------------------
# Step 2: Build and Push Docker Images
# -----------------------------------------------------------------------------

log_step "Step 2/4: Building and pushing Docker images..."

REGISTRY="$REGION-docker.pkg.dev"
REPO="$PROJECT_ID/hospitality-saas-${ENVIRONMENT}-docker"
TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")

# Configure Docker
gcloud auth configure-docker "$REGISTRY" --quiet

# Build API
log_info "Building API image..."
cd "$ROOT_DIR"
docker build -t "$REGISTRY/$REPO/api:$TAG" -t "$REGISTRY/$REPO/api:latest" --target production .
docker push "$REGISTRY/$REPO/api:$TAG"
docker push "$REGISTRY/$REPO/api:latest"

# Build Frontend
log_info "Building Frontend image..."
cd "$ROOT_DIR/frontend"
docker build -t "$REGISTRY/$REPO/frontend:$TAG" -t "$REGISTRY/$REPO/frontend:latest" .
docker push "$REGISTRY/$REPO/frontend:$TAG"
docker push "$REGISTRY/$REPO/frontend:latest"

# -----------------------------------------------------------------------------
# Step 3: Run Migrations
# -----------------------------------------------------------------------------

if [ "$SKIP_MIGRATE" = false ]; then
    log_step "Step 3/4: Running database migrations..."
    cd "$ROOT_DIR"

    # Get Cloud SQL connection info
    SQL_CONNECTION=$(cd "$TERRAFORM_DIR" && terraform output -raw cloud_sql_connection_name)
    DB_PASSWORD=$(gcloud secrets versions access latest --secret="hospitality-saas-${ENVIRONMENT}-db-password")

    # Start Cloud SQL Proxy
    log_info "Starting Cloud SQL Proxy..."
    cloud-sql-proxy "$SQL_CONNECTION" --port=5432 &
    PROXY_PID=$!
    sleep 5

    # Run migrations
    DATABASE_URL="postgresql://hospitality_admin:${DB_PASSWORD}@localhost:5432/hospitality_db" npm run db:migrate

    # Stop proxy
    kill $PROXY_PID || true
else
    log_step "Step 3/4: Skipping migrations (--skip-migrate)"
fi

# -----------------------------------------------------------------------------
# Step 4: Deploy to Cloud Run
# -----------------------------------------------------------------------------

log_step "Step 4/4: Deploying to Cloud Run..."

ENV_PREFIX="hospitality-saas-${ENVIRONMENT}"

# Deploy API
log_info "Deploying API..."
gcloud run deploy "${ENV_PREFIX}-api" \
    --image="$REGISTRY/$REPO/api:$TAG" \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --quiet

# Get API URL for frontend
API_URL=$(gcloud run services describe "${ENV_PREFIX}-api" --region="$REGION" --format='value(status.url)')

# Deploy Frontend
log_info "Deploying Frontend..."
gcloud run deploy "${ENV_PREFIX}-frontend" \
    --image="$REGISTRY/$REPO/frontend:$TAG" \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --set-env-vars="NEXT_PUBLIC_API_URL=${API_URL}/api/v1" \
    --quiet

FRONTEND_URL=$(gcloud run services describe "${ENV_PREFIX}-frontend" --region="$REGION" --format='value(status.url)')

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo "============================================================================="
log_info "Deployment complete!"
echo "============================================================================="
echo ""
echo "Environment: $ENVIRONMENT"
echo "Image Tag:   $TAG"
echo ""
echo "URLs:"
echo "  API:      $API_URL"
echo "  Frontend: $FRONTEND_URL"
echo "  Health:   ${API_URL}/api/v1/health"
echo ""

# Health check
log_info "Running health check..."
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/health" || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    log_info "Health check passed!"
else
    log_warn "Health check returned status $HTTP_STATUS"
    log_warn "Check logs: gcloud logging read 'resource.type=cloud_run_revision'"
fi
