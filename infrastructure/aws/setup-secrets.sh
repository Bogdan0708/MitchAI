#!/bin/bash
# =============================================================================
# AWS Secrets Manager Setup Script
# =============================================================================
# This script creates all required secrets in AWS Secrets Manager for the
# Mitch Hospitality SaaS platform.
#
# Usage:
#   ./setup-secrets.sh
#
# Prerequisites:
#   - AWS CLI configured with appropriate permissions
#   - Secrets values set in environment variables or .env file
# =============================================================================

set -e

REGION="eu-west-2"
PREFIX="mitch"

echo "================================================"
echo "  AWS Secrets Manager Setup"
echo "================================================"

# Function to create or update a secret
create_secret() {
    local name="$1"
    local value="$2"
    local description="$3"

    if [ -z "$value" ]; then
        echo "  [SKIP] $name - No value provided"
        return
    fi

    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "$name" --region "$REGION" 2>/dev/null; then
        echo "  [UPDATE] $name"
        aws secretsmanager put-secret-value \
            --secret-id "$name" \
            --secret-string "$value" \
            --region "$REGION"
    else
        echo "  [CREATE] $name"
        aws secretsmanager create-secret \
            --name "$name" \
            --description "$description" \
            --secret-string "$value" \
            --region "$REGION"
    fi
}

# Load environment variables from .env if it exists
if [ -f "../../.env" ]; then
    echo "Loading environment from .env file..."
    export $(grep -v '^#' ../../.env | xargs)
fi

echo ""
echo "Creating/Updating Secrets..."
echo ""

# Database URL
create_secret \
    "${PREFIX}/database-url" \
    "$DATABASE_URL" \
    "PostgreSQL connection string for Mitch Hospitality SaaS"

# Redis URL
create_secret \
    "${PREFIX}/redis-url" \
    "$REDIS_URL" \
    "Redis connection string for caching and rate limiting"

# JWT Secret
create_secret \
    "${PREFIX}/jwt-secret" \
    "$JWT_SECRET" \
    "JWT signing secret for authentication"

# Stripe Keys
create_secret \
    "${PREFIX}/stripe-secret-key" \
    "$STRIPE_SECRET_KEY" \
    "Stripe API secret key"

create_secret \
    "${PREFIX}/stripe-webhook-secret" \
    "$STRIPE_WEBHOOK_SECRET" \
    "Stripe webhook signing secret"

# AI Provider Keys
create_secret \
    "${PREFIX}/openai-api-key" \
    "$OPENAI_API_KEY" \
    "OpenAI API key for AI features"

create_secret \
    "${PREFIX}/anthropic-api-key" \
    "$ANTHROPIC_API_KEY" \
    "Anthropic API key for Claude AI"

create_secret \
    "${PREFIX}/perplexity-api-key" \
    "$PERPLEXITY_API_KEY" \
    "Perplexity API key for research features"

# Email Service
create_secret \
    "${PREFIX}/sendgrid-api-key" \
    "$SENDGRID_API_KEY" \
    "SendGrid API key for email delivery"

echo ""
echo "================================================"
echo "  Secret Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Update IAM role to allow Secrets Manager access:"
echo "   aws iam attach-role-policy \\"
echo "     --role-name ecsTaskExecutionRole \\"
echo "     --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite"
echo ""
echo "2. Update ECS task definition to use secrets"
echo ""
echo "3. Redeploy the ECS service:"
echo "   aws ecs update-service --cluster mitch-cluster --service mitch-dev-api --force-new-deployment --region eu-west-2"
echo ""
