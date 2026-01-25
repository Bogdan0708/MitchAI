#!/bin/bash
# =============================================================================
# GCP Project Setup Script
# =============================================================================
# This script initializes a new GCP project for Hospitality SaaS deployment.
# Run this once before using Terraform.
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Billing account linked to the project
#
# Usage:
#   ./setup-gcp.sh <PROJECT_ID> <BILLING_ACCOUNT_ID>
#
# Example:
#   ./setup-gcp.sh hospitality-saas-prod 01XXXX-XXXXXX-XXXXXX
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check arguments
if [ $# -lt 1 ]; then
    log_error "Usage: $0 <PROJECT_ID> [BILLING_ACCOUNT_ID]"
    exit 1
fi

PROJECT_ID=$1
BILLING_ACCOUNT=${2:-""}
REGION=${GCP_REGION:-"us-central1"}

log_info "Setting up GCP project: $PROJECT_ID"

# -----------------------------------------------------------------------------
# Check prerequisites
# -----------------------------------------------------------------------------

if ! command -v gcloud &> /dev/null; then
    log_error "gcloud CLI is not installed. Please install it first."
    exit 1
fi

if ! gcloud auth print-identity-token &> /dev/null; then
    log_error "Not authenticated with gcloud. Run 'gcloud auth login' first."
    exit 1
fi

# -----------------------------------------------------------------------------
# Create project if it doesn't exist
# -----------------------------------------------------------------------------

if gcloud projects describe "$PROJECT_ID" &> /dev/null; then
    log_info "Project $PROJECT_ID already exists"
else
    log_info "Creating project $PROJECT_ID..."
    gcloud projects create "$PROJECT_ID" --name="Hospitality SaaS"
fi

# Set as active project
gcloud config set project "$PROJECT_ID"

# -----------------------------------------------------------------------------
# Link billing account
# -----------------------------------------------------------------------------

if [ -n "$BILLING_ACCOUNT" ]; then
    log_info "Linking billing account..."
    gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
else
    log_warn "No billing account provided. Link one manually:"
    log_warn "  gcloud billing projects link $PROJECT_ID --billing-account=<BILLING_ACCOUNT_ID>"
fi

# -----------------------------------------------------------------------------
# Enable required APIs
# -----------------------------------------------------------------------------

log_info "Enabling required APIs (this may take a few minutes)..."

APIS=(
    "compute.googleapis.com"
    "sqladmin.googleapis.com"
    "run.googleapis.com"
    "secretmanager.googleapis.com"
    "artifactregistry.googleapis.com"
    "vpcaccess.googleapis.com"
    "servicenetworking.googleapis.com"
    "cloudresourcemanager.googleapis.com"
    "iam.googleapis.com"
    "cloudbuild.googleapis.com"
)

for api in "${APIS[@]}"; do
    log_info "  Enabling $api..."
    gcloud services enable "$api" --quiet
done

# -----------------------------------------------------------------------------
# Create service account for Terraform and CI/CD
# -----------------------------------------------------------------------------

SA_NAME="terraform-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$SA_EMAIL" &> /dev/null; then
    log_info "Service account $SA_NAME already exists"
else
    log_info "Creating service account for Terraform..."
    gcloud iam service-accounts create "$SA_NAME" \
        --description="Service account for Terraform and CI/CD deployments" \
        --display-name="Terraform Deployer"
fi

# Grant necessary roles
log_info "Granting IAM roles to service account..."

ROLES=(
    "roles/compute.admin"
    "roles/iam.serviceAccountAdmin"
    "roles/iam.serviceAccountUser"
    "roles/resourcemanager.projectIamAdmin"
    "roles/secretmanager.admin"
    "roles/cloudsql.admin"
    "roles/run.admin"
    "roles/artifactregistry.admin"
    "roles/vpcaccess.admin"
    "roles/servicenetworking.networksAdmin"
    "roles/storage.admin"
)

for role in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$role" \
        --quiet
done

# -----------------------------------------------------------------------------
# Create and download service account key
# -----------------------------------------------------------------------------

KEY_FILE="terraform-deployer-key.json"

if [ ! -f "$KEY_FILE" ]; then
    log_info "Creating service account key..."
    gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SA_EMAIL"
    log_warn "Service account key saved to $KEY_FILE"
    log_warn "Keep this file secure and never commit it to version control!"
else
    log_info "Service account key already exists: $KEY_FILE"
fi

# -----------------------------------------------------------------------------
# Create GCS bucket for Terraform state (optional but recommended)
# -----------------------------------------------------------------------------

STATE_BUCKET="${PROJECT_ID}-terraform-state"

if gsutil ls "gs://$STATE_BUCKET" &> /dev/null 2>&1; then
    log_info "Terraform state bucket already exists: $STATE_BUCKET"
else
    log_info "Creating Terraform state bucket..."
    gsutil mb -l "$REGION" "gs://$STATE_BUCKET"
    gsutil versioning set on "gs://$STATE_BUCKET"
    log_info "Terraform state bucket created: $STATE_BUCKET"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo "============================================================================="
log_info "GCP project setup complete!"
echo "============================================================================="
echo ""
echo "Project ID:        $PROJECT_ID"
echo "Region:            $REGION"
echo "Service Account:   $SA_EMAIL"
echo "State Bucket:      gs://$STATE_BUCKET"
echo ""
echo "Next steps:"
echo ""
echo "1. Set the GOOGLE_APPLICATION_CREDENTIALS environment variable:"
echo "   export GOOGLE_APPLICATION_CREDENTIALS=\"$(pwd)/$KEY_FILE\""
echo ""
echo "2. Update infrastructure/terraform/terraform.tfvars with your settings"
echo ""
echo "3. Initialize and apply Terraform:"
echo "   cd infrastructure/terraform"
echo "   terraform init"
echo "   terraform plan"
echo "   terraform apply"
echo ""
echo "4. For GitHub Actions, add the service account key as a secret:"
echo "   - Go to GitHub repo Settings → Secrets → Actions"
echo "   - Add GOOGLE_CREDENTIALS with contents of $KEY_FILE"
echo ""
echo "5. Add these GitHub repository variables:"
echo "   - GCP_PROJECT_ID: $PROJECT_ID"
echo "   - GCP_REGION: $REGION"
echo ""
