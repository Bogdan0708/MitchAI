#!/bin/bash
# =============================================================================
# Update GCP Secret Manager Secrets
# =============================================================================
# This script helps update secrets in GCP Secret Manager.
# Run after Terraform creates the initial placeholder secrets.
#
# Usage:
#   ./update-secrets.sh <ENVIRONMENT> <SECRET_NAME> [VALUE]
#
# Examples:
#   # Interactive mode (prompts for value)
#   ./update-secrets.sh prod stripe-secret-key
#
#   # Direct mode (pass value as argument - be careful with shell history!)
#   ./update-secrets.sh prod openai-api-key "sk-xxx"
#
#   # From file
#   ./update-secrets.sh prod stripe-secret-key "$(cat stripe-key.txt)"
#
# Available secrets:
#   - db-password
#   - db-connection-string
#   - jwt-secret
#   - stripe-secret-key
#   - stripe-webhook-secret
#   - openai-api-key
#   - anthropic-api-key
#   - perplexity-api-key
#   - sendgrid-api-key
#   - n8n-password
#   - qdrant-api-key
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ $# -lt 2 ]; then
    log_error "Usage: $0 <ENVIRONMENT> <SECRET_NAME> [VALUE]"
    echo ""
    echo "Environment: staging or prod"
    echo ""
    echo "Available secrets:"
    echo "  - db-password"
    echo "  - db-connection-string"
    echo "  - jwt-secret"
    echo "  - stripe-secret-key"
    echo "  - stripe-webhook-secret"
    echo "  - openai-api-key"
    echo "  - anthropic-api-key"
    echo "  - perplexity-api-key"
    echo "  - sendgrid-api-key"
    echo "  - n8n-password"
    echo "  - qdrant-api-key"
    exit 1
fi

ENVIRONMENT=$1
SECRET_NAME=$2
SECRET_VALUE=${3:-""}

# Map environment to prefix
case $ENVIRONMENT in
    prod|production)
        PREFIX="hospitality-saas-prod"
        ;;
    staging|stage)
        PREFIX="hospitality-saas-staging"
        ;;
    *)
        log_error "Unknown environment: $ENVIRONMENT"
        log_error "Use 'prod' or 'staging'"
        exit 1
        ;;
esac

FULL_SECRET_NAME="${PREFIX}-${SECRET_NAME}"

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    log_error "No GCP project set. Run 'gcloud config set project <PROJECT_ID>'"
    exit 1
fi

log_info "Project: $PROJECT_ID"
log_info "Environment: $ENVIRONMENT"
log_info "Secret: $FULL_SECRET_NAME"

# Check if secret exists
if ! gcloud secrets describe "$FULL_SECRET_NAME" &>/dev/null; then
    log_error "Secret '$FULL_SECRET_NAME' does not exist."
    log_error "Run Terraform first to create the secrets."
    exit 1
fi

# Get value interactively if not provided
if [ -z "$SECRET_VALUE" ]; then
    echo ""
    log_warn "Enter the secret value (input hidden):"
    read -s SECRET_VALUE
    echo ""

    if [ -z "$SECRET_VALUE" ]; then
        log_error "No value provided"
        exit 1
    fi
fi

# Add new version of the secret
log_info "Updating secret..."
echo -n "$SECRET_VALUE" | gcloud secrets versions add "$FULL_SECRET_NAME" --data-file=-

log_info "Secret '$FULL_SECRET_NAME' updated successfully!"

# For db-connection-string, provide format hint
if [ "$SECRET_NAME" == "db-connection-string" ]; then
    echo ""
    log_info "Connection string format:"
    echo "  postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
    echo ""
    log_info "For Cloud SQL with private IP:"
    echo "  postgresql://USER:PASSWORD@PRIVATE_IP:5432/DATABASE"
fi
