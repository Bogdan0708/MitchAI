#!/bin/bash
# =============================================================================
# GCP AI Services Setup
# Project: mitch-ai-services (382299704849)
# =============================================================================

set -e

PROJECT_ID="mitch-ai-services"
REGION="europe-west2"  # London - close to AWS eu-west-2
ZONE="${REGION}-a"

echo "🚀 Setting up GCP AI Services..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"

# Set project
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION
gcloud config set run/region $REGION

# =============================================================================
# Enable APIs
# =============================================================================
echo "📦 Enabling required APIs..."

gcloud services enable \
  run.googleapis.com \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

echo "✅ APIs enabled"

# =============================================================================
# Create Artifact Registry
# =============================================================================
echo "📦 Creating Artifact Registry..."

gcloud artifacts repositories create mitch-ai \
  --repository-format=docker \
  --location=$REGION \
  --description="Mitch AI Service images" \
  2>/dev/null || echo "   (already exists)"

echo "✅ Artifact Registry ready"

# =============================================================================
# Create Secrets (placeholder values - update with real keys)
# =============================================================================
echo "🔐 Creating secrets..."

# Check and create secrets
create_secret() {
  local name=$1
  local value=$2
  if ! gcloud secrets describe $name --project=$PROJECT_ID >/dev/null 2>&1; then
    echo -n "$value" | gcloud secrets create $name --data-file=- --project=$PROJECT_ID
    echo "   Created: $name"
  else
    echo "   Exists: $name"
  fi
}

create_secret "openai-api-key" "PLACEHOLDER_UPDATE_ME"
create_secret "anthropic-api-key" "PLACEHOLDER_UPDATE_ME"
create_secret "perplexity-api-key" "PLACEHOLDER_UPDATE_ME"
create_secret "google-ai-key" "PLACEHOLDER_UPDATE_ME"

echo "✅ Secrets created (update with real values!)"
echo ""
echo "⚠️  Update secrets with real API keys:"
echo "   echo -n 'sk-xxx' | gcloud secrets versions add openai-api-key --data-file=-"
echo "   echo -n 'sk-ant-xxx' | gcloud secrets versions add anthropic-api-key --data-file=-"
echo ""

# =============================================================================
# Create Firewall Rules for Qdrant
# =============================================================================
echo "🔥 Creating firewall rules..."

gcloud compute firewall-rules create allow-qdrant-internal \
  --allow=tcp:6333,tcp:6334 \
  --source-ranges=10.0.0.0/8 \
  --target-tags=qdrant-server \
  --description="Allow Qdrant access from Cloud Run" \
  2>/dev/null || echo "   (already exists)"

echo "✅ Firewall rules ready"

echo ""
echo "=========================================="
echo "✅ GCP setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update secrets with real API keys"
echo "2. Run: ./deploy-qdrant.sh"
echo "3. Run: ./deploy-ai-service.sh"
