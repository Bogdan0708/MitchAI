# GCP Deployment Guide - Hospitality SaaS

**Created:** 2026-01-28  
**Credits Available:** £743.46 (expires 27 Sept 2026)  
**Target Project:** `agent1-473213` (existing) or new dedicated project

---

## 📊 Executive Summary

| Item | Value |
|------|-------|
| **Available Credits** | £743.46 |
| **Credit Expiry** | 27 September 2026 (~8 months) |
| **Recommended Tier** | Production (~£100-130/mo) |
| **Runway with Credits** | ~6 months of Production tier |
| **Existing Infrastructure** | 1 Cloud Run service, 1 VM (gmail-automation) |

---

## 🎯 Recommended Deployment: Production Tier

Given your credits cover 6+ months, go straight to Production tier to avoid cold starts and have a professional experience for customers.

### Monthly Cost Breakdown (GBP)

| Service | Spec | Monthly Cost |
|---------|------|--------------|
| **Cloud SQL** | db-g1-small, 20GB SSD | ~£22 |
| **Cloud Run (API)** | 1 vCPU, 1GB, min=1 | ~£30 |
| **Cloud Run (Frontend)** | 1 vCPU, 512MB, min=1 | ~£20 |
| **VPC Connector** | 2 instances | ~£10 |
| **Secret Manager** | 15 secrets | ~£1 |
| **Artifact Registry** | Docker images | ~£2 |
| **Cloud Storage** | 10GB + CDN | ~£2 |
| **n8n VM** | e2-small (or reuse existing) | ~£10 |
| **Subtotal GCP** | | **~£97** |
| **External (SendGrid, AI)** | | ~£30 |
| **Total** | | **~£127/mo** |

**With £743 credits: ~5.8 months covered**

---

## 🚀 Step-by-Step Deployment

### Phase 1: GCP Project Setup (15 min)

```bash
# Set gcloud path (add to ~/.bashrc for persistence)
export PATH="$PATH:<local-path>/google-cloud-sdk/bin"

# Verify authentication
gcloud auth list
gcloud config set project agent1-473213

# Enable required APIs
gcloud services enable \
    sqladmin.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    artifactregistry.googleapis.com \
    vpcaccess.googleapis.com \
    servicenetworking.googleapis.com \
    cloudbuild.googleapis.com
```

### Phase 2: Create Cloud SQL Instance (10 min)

```bash
# Create PostgreSQL instance
gcloud sql instances create hospitality-db \
    --database-version=POSTGRES_15 \
    --tier=db-g1-small \
    --region=europe-west2 \
    --storage-size=20GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --availability-type=zonal

# Create database
gcloud sql databases create hospitality_prod --instance=hospitality-db

# Create user
gcloud sql users create hospitality_admin \
    --instance=hospitality-db \
    --password="$(openssl rand -base64 24)"
```

**Note the password!** Store it in Secret Manager.

### Phase 3: Create VPC Connector (5 min)

```bash
# Create VPC connector for Cloud Run → Cloud SQL
gcloud compute networks vpc-access connectors create hospitality-connector \
    --region=europe-west2 \
    --range=10.8.0.0/28
```

### Phase 4: Create Artifact Registry (2 min)

```bash
# Create Docker repository
gcloud artifacts repositories create hospitality-saas \
    --repository-format=docker \
    --location=europe-west2 \
    --description="Hospitality SaaS Docker images"
```

### Phase 5: Build and Push Docker Images (10 min)

```bash
cd <repo-root>

# Configure Docker for Artifact Registry
gcloud auth configure-docker europe-west2-docker.pkg.dev

# Build API image
docker build -t europe-west2-docker.pkg.dev/agent1-473213/hospitality-saas/api:latest \
    -f Dockerfile .

# Push to registry
docker push europe-west2-docker.pkg.dev/agent1-473213/hospitality-saas/api:latest
```

### Phase 6: Create Secrets (5 min)

```bash
# Database password
echo -n "YOUR_DB_PASSWORD" | gcloud secrets create db-password --data-file=-

# JWT secret
openssl rand -base64 32 | gcloud secrets create jwt-secret --data-file=-

# Add more secrets as needed
# gcloud secrets create stripe-secret-key --data-file=-
# gcloud secrets create openai-api-key --data-file=-
```

### Phase 7: Deploy Cloud Run Services (10 min)

```bash
# Deploy API service
gcloud run deploy hospitality-api \
    --image=europe-west2-docker.pkg.dev/agent1-473213/hospitality-saas/api:latest \
    --region=europe-west2 \
    --platform=managed \
    --allow-unauthenticated \
    --memory=1Gi \
    --cpu=1 \
    --min-instances=1 \
    --max-instances=10 \
    --vpc-connector=hospitality-connector \
    --set-env-vars="NODE_ENV=production" \
    --set-secrets="DATABASE_URL=db-password:latest,JWT_SECRET=jwt-secret:latest"
```

### Phase 8: Run Database Migrations (5 min)

```bash
# Connect to Cloud SQL via proxy
gcloud sql connect hospitality-db --user=hospitality_admin

# Or use Cloud Run job for migrations
gcloud run jobs create migrate-db \
    --image=europe-west2-docker.pkg.dev/agent1-473213/hospitality-saas/api:latest \
    --region=europe-west2 \
    --vpc-connector=hospitality-connector \
    --set-secrets="DATABASE_URL=db-password:latest" \
    --command="npm,run,migrate"

gcloud run jobs execute migrate-db --region=europe-west2
```

### Phase 9: Verify Deployment (5 min)

```bash
# Get service URL
gcloud run services describe hospitality-api --region=europe-west2 --format='value(status.url)'

# Test health endpoint
curl $(gcloud run services describe hospitality-api --region=europe-west2 --format='value(status.url)')/health
```

---

## 📁 Terraform Alternative (Recommended)

For repeatable deployments, use the existing Terraform setup:

```bash
cd <repo-root>/infrastructure/terraform

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars:
# project_id = "agent1-473213"
# region = "europe-west2"
# environment = "production"
# db_tier = "db-g1-small"
# api_min_instances = 1
# frontend_min_instances = 1

# Initialize and deploy
terraform init
terraform plan
terraform apply
```

---

## 🔧 Environment Variables

Create `.env.production`:

```bash
# Database
DATABASE_URL=postgresql://hospitality_admin:PASSWORD@/hospitality_prod?host=/cloudsql/agent1-473213:europe-west2:hospitality-db

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-char-encryption-key

# External Services
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
SENDGRID_API_KEY=SG.xxx
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Google OAuth (for email integration)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Feature Flags
ENABLE_MTC_BLOCKCHAIN=false
ENABLE_AI_FEATURES=true
```

---

## 📍 Region Selection

**Recommended: `europe-west2` (London)**

| Region | Latency to UK | Cost Tier |
|--------|---------------|-----------|
| `europe-west2` (London) | ~5ms | Standard |
| `us-central1` (Iowa) | ~100ms | Cheapest |
| `europe-west1` (Belgium) | ~15ms | Standard |

Using London because:
- Your target market is UK hospitality
- Low latency for your customers
- GDPR data residency compliance
- Only ~5% more expensive than Iowa

---

## 🔄 CI/CD Setup

### GitHub Actions (`.github/workflows/deploy-gcp.yml`)

The workflow already exists. Add these secrets to GitHub:

| Secret Name | Description |
|-------------|-------------|
| `GCP_SA_KEY` | Service account JSON key |
| `GCP_PROJECT_ID` | `agent1-473213` |

```bash
# Create service account for CI/CD
gcloud iam service-accounts create github-deployer \
    --display-name="GitHub Actions Deployer"

# Grant permissions
gcloud projects add-iam-policy-binding agent1-473213 \
    --member="serviceAccount:github-deployer@agent1-473213.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding agent1-473213 \
    --member="serviceAccount:github-deployer@agent1-473213.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

# Create key
gcloud iam service-accounts keys create github-key.json \
    --iam-account=github-deployer@agent1-473213.iam.gserviceaccount.com
```

---

## 📊 Monitoring & Alerts

```bash
# Enable Cloud Monitoring
gcloud services enable monitoring.googleapis.com

# Create uptime check
gcloud monitoring uptime-check-configs create hospitality-api-check \
    --display-name="Hospitality API Health" \
    --resource-type=cloud-run-revision \
    --resource-labels=service_name=hospitality-api,location=europe-west2
```

---

## 💰 Cost Optimization Tips

1. **Use committed use discounts** - Save 20-50% on VMs
2. **Scale to zero in dev** - Set `min_instances=0` for non-prod
3. **Right-size database** - Start with g1-small, upgrade when needed
4. **Use Cloud CDN** - Cache static assets to reduce egress
5. **Monitor billing** - Set up budget alerts at 50%, 80%, 100%

```bash
# Create budget alert
gcloud billing budgets create \
    --billing-account=013EC5-706D8C-B680DC \
    --display-name="Hospitality SaaS Budget" \
    --budget-amount=150GBP \
    --threshold-rules-percent=0.5,0.8,1.0
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Enable required APIs
- [ ] Create Cloud SQL instance
- [ ] Create VPC Connector
- [ ] Create Artifact Registry
- [ ] Configure secrets

### Deployment
- [ ] Build Docker image
- [ ] Push to Artifact Registry
- [ ] Deploy Cloud Run service
- [ ] Run database migrations
- [ ] Verify health endpoints

### Post-Deployment
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring alerts
- [ ] Configure backup schedule
- [ ] Test all API endpoints
- [ ] Create first admin tenant

---

## 🚨 Quick Commands Reference

```bash
# Check deployment status
gcloud run services list --region=europe-west2

# View logs
gcloud run services logs read hospitality-api --region=europe-west2

# Get service URL
gcloud run services describe hospitality-api --region=europe-west2 --format='value(status.url)'

# Scale up/down
gcloud run services update hospitality-api --min-instances=2 --region=europe-west2

# Check database status
gcloud sql instances describe hospitality-db

# View costs
gcloud billing accounts describe 013EC5-706D8C-B680DC
```

---

## 📞 Next Steps

1. **Run Phase 1** - Enable APIs (~15 min)
2. **Run Phase 2** - Create Cloud SQL (~10 min)
3. **Run Phase 5** - Build & push Docker image (~10 min)
4. **Run Phase 7** - Deploy Cloud Run (~10 min)
5. **Test & iterate**

Total time: ~45-60 minutes to production deployment.

---

*Last updated: 2026-01-28*
