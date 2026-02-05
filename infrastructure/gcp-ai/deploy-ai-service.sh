#!/bin/bash
# =============================================================================
# Deploy AI Service to Cloud Run
# =============================================================================

set -e

PROJECT_ID="mitch-ai-services"
REGION="europe-west2"
SERVICE_NAME="mitch-ai"
IMAGE="europe-west2-docker.pkg.dev/$PROJECT_ID/mitch-ai/router:latest"

# Get Qdrant internal IP
QDRANT_IP=$(gcloud compute instances describe qdrant-server \
  --zone=${REGION}-a \
  --project=$PROJECT_ID \
  --format='get(networkInterfaces[0].networkIP)' 2>/dev/null || echo "")

echo "🚀 Deploying AI Service to Cloud Run..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Image: $IMAGE"
if [ -n "$QDRANT_IP" ]; then
  echo "   Qdrant: http://$QDRANT_IP:6333"
fi

# =============================================================================
# Build and Push Image
# =============================================================================
echo ""
echo "📦 Building Docker image..."

cd "$(dirname "$0")/../../ai-service"

# Configure Docker for GCP
gcloud auth configure-docker europe-west2-docker.pkg.dev --quiet

# Build
docker build -t $IMAGE .

# Push
echo "📤 Pushing to Artifact Registry..."
docker push $IMAGE

# =============================================================================
# Deploy to Cloud Run
# =============================================================================
echo ""
echo "🚀 Deploying to Cloud Run..."

# Build secrets string
SECRETS="OPENAI_API_KEY=openai-api-key:latest"
SECRETS="$SECRETS,ANTHROPIC_API_KEY=anthropic-api-key:latest"
SECRETS="$SECRETS,PERPLEXITY_API_KEY=perplexity-api-key:latest"
SECRETS="$SECRETS,GOOGLE_API_KEY=google-ai-key:latest"

# Build env vars string
ENV_VARS="NODE_ENV=production"
ENV_VARS="$ENV_VARS,CORS_ORIGINS=https://api.mitchfromtransylvania.com,https://mitchfromtransylvania.com"
if [ -n "$QDRANT_IP" ]; then
  ENV_VARS="$ENV_VARS,QDRANT_URL=http://$QDRANT_IP:6333"
fi

gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --project=$PROJECT_ID \
  --platform=managed \
  --memory=2Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=60s \
  --concurrency=80 \
  --set-secrets=$SECRETS \
  --set-env-vars=$ENV_VARS \
  --allow-unauthenticated

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

echo ""
echo "=========================================="
echo "✅ AI Service deployed!"
echo "=========================================="
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Test endpoints:"
echo "  curl $SERVICE_URL/health"
echo "  curl $SERVICE_URL/providers"
echo ""
echo "Chat completion:"
echo '  curl -X POST '$SERVICE_URL'/v1/chat/completions \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '\''{"messages":[{"role":"user","content":"Hello!"}]}'\'''
echo ""
echo "⚠️  Update AWS ECS with this URL:"
echo "   AI_SERVICE_URL=$SERVICE_URL"
