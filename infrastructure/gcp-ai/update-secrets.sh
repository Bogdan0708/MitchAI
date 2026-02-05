#!/bin/bash
# =============================================================================
# Update GCP Secrets with Real API Keys
# =============================================================================

set -e

PROJECT_ID="mitch-ai-services"

echo "🔐 Update API Keys"
echo "=================="
echo ""
echo "This script will update your GCP secrets with real API keys."
echo "Leave blank to skip a key."
echo ""

# Function to update secret
update_secret() {
  local name=$1
  local description=$2
  
  read -p "$description: " -s value
  echo ""
  
  if [ -n "$value" ]; then
    echo -n "$value" | gcloud secrets versions add $name --data-file=- --project=$PROJECT_ID
    echo "✅ Updated: $name"
  else
    echo "⏭️  Skipped: $name"
  fi
}

update_secret "openai-api-key" "OpenAI API Key (sk-...)"
update_secret "anthropic-api-key" "Anthropic API Key (sk-ant-...)"
update_secret "perplexity-api-key" "Perplexity API Key (pplx-...)"
update_secret "google-ai-key" "Google AI API Key"

echo ""
echo "✅ Done! Redeploy the service to use new keys:"
echo "   ./deploy-ai-service.sh"
