# Hospitality SaaS - GCP Infrastructure

This directory contains Terraform configurations, CLI tools, and scripts for deploying the Hospitality SaaS platform to Google Cloud Platform.

## Quick Start - One Command Deployment

### Option 1: CLI Tool (Recommended)

```bash
# Install CLI
cd infrastructure/cli
npm install
npm run build
npm link  # Makes 'hsp' command available globally

# Deploy everything with one command
hsp deploy -p <PROJECT_ID> -b <BILLING_ACCOUNT_ID> -e production

# Or interactive mode (prompts for all options)
hsp deploy
```

### Option 2: Makefile

```bash
cd infrastructure

# Full deployment
make deploy PROJECT=my-project ENV=production

# Or step by step
make setup PROJECT=my-project BILLING=01XXXX-XXXXXX
make tf-apply ENV=production
make build-push ENV=production
make migrate ENV=production
make deploy-run ENV=production
```

### Option 3: Manual Steps

See the detailed sections below for manual deployment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Google Cloud Platform                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   Cloud Run     │    │   Cloud Run     │    │  Compute Engine │         │
│  │   (API)         │    │   (Frontend)    │    │  (n8n + Redis)  │         │
│  │   - Express.js  │    │   - Next.js     │    │  - n8n          │         │
│  │   - Port 3000   │    │   - Port 3000   │    │  - Redis 7      │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│           │              VPC Connector                  │                   │
│           └──────────────────┬──────────────────────────┘                   │
│                              │                                              │
│  ┌───────────────────────────┴───────────────────────────┐                 │
│  │                    Private VPC                         │                 │
│  │  ┌─────────────────┐           ┌─────────────────┐    │                 │
│  │  │   Cloud SQL     │           │  Secret Manager │    │                 │
│  │  │  (PostgreSQL)   │           │  (Credentials)  │    │                 │
│  │  └─────────────────┘           └─────────────────┘    │                 │
│  └───────────────────────────────────────────────────────┘                 │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │ Artifact        │  ← Docker images from GitHub Actions                   │
│  │ Registry        │                                                        │
│  └─────────────────┘                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

External Services:
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Qdrant Cloud   │  │     Stripe      │  │    SendGrid     │
│  (Vector DB)    │  │   (Payments)    │  │    (Email)      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Cost Estimate (Startup-Friendly)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Cloud SQL | db-f1-micro | ~$9 |
| Cloud Run API | Scale-to-zero | ~$0-25* |
| Cloud Run Frontend | Scale-to-zero | ~$0-15* |
| Compute Engine (n8n) | e2-small | ~$13 |
| VPC Connector | 2 instances | ~$12 |
| Secret Manager | 10 secrets | ~$1 |
| **Total** | | **~$35-75/mo** |

*Cloud Run costs depend on traffic. Scale-to-zero means $0 when idle, but cold starts add 2-5s latency. Set `min_instances=1` to avoid cold starts (~$25/mo per service).

## Prerequisites

1. **GCP Account** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Terraform** 1.5+ installed
4. **Docker** for local testing

## Quick Start

### 1. Initial GCP Setup

```bash
# Make scripts executable
chmod +x infrastructure/scripts/*.sh

# Run setup script (creates project, enables APIs, creates service account)
./infrastructure/scripts/setup-gcp.sh <PROJECT_ID> <BILLING_ACCOUNT_ID>

# Example:
./infrastructure/scripts/setup-gcp.sh hospitality-saas-prod 01XXXX-XXXXXX-XXXXXX
```

### 2. Configure Terraform

```bash
cd infrastructure/terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars  # or vim, code, etc.
```

Key variables to set:
- `project_id`: Your GCP project ID
- `region`: GCP region (us-central1 is cheapest)
- `db_tier`: Start with `db-f1-micro`
- `api_min_instances`: 0 (scale-to-zero) or 1 (always-on)

### 3. Deploy Infrastructure

```bash
# Set credentials
export GOOGLE_APPLICATION_CREDENTIALS="../scripts/terraform-deployer-key.json"

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply (type 'yes' to confirm)
terraform apply
```

### 4. Update Secrets

After Terraform creates placeholder secrets, update them with real values:

```bash
cd ../scripts

# Update Stripe keys
./update-secrets.sh prod stripe-secret-key
./update-secrets.sh prod stripe-webhook-secret

# Update AI provider keys
./update-secrets.sh prod openai-api-key
./update-secrets.sh prod anthropic-api-key

# Update SendGrid
./update-secrets.sh prod sendgrid-api-key

# Update database connection string (after Cloud SQL is ready)
./update-secrets.sh prod db-connection-string
```

### 5. Deploy Application

Option A: **GitHub Actions** (recommended)
1. Add `GOOGLE_CREDENTIALS` secret to GitHub repo (contents of service account key JSON)
2. Add repository variables: `GCP_PROJECT_ID`, `GCP_REGION`
3. Push to `main` branch to trigger deployment

Option B: **Manual deployment**
```bash
# Build and push images
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build API
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/hospitality-saas-prod-docker/api:latest .
docker push us-central1-docker.pkg.dev/PROJECT_ID/hospitality-saas-prod-docker/api:latest

# Build Frontend
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/hospitality-saas-prod-docker/frontend:latest ./frontend
docker push us-central1-docker.pkg.dev/PROJECT_ID/hospitality-saas-prod-docker/frontend:latest

# Deploy to Cloud Run
gcloud run deploy hospitality-saas-prod-api \
  --image=us-central1-docker.pkg.dev/PROJECT_ID/hospitality-saas-prod-docker/api:latest \
  --region=us-central1 \
  --allow-unauthenticated
```

### 6. Run Database Migrations

```bash
# Install Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Start proxy (get connection name from Terraform output)
./cloud-sql-proxy PROJECT_ID:us-central1:hospitality-saas-prod-postgres-xxxx --port=5432 &

# Run migrations
DATABASE_URL="postgresql://hospitality_admin:PASSWORD@localhost:5432/hospitality_db" npm run db:migrate
```

## Directory Structure

```
infrastructure/
├── terraform/
│   ├── main.tf                 # Main orchestration
│   ├── variables.tf            # Input variables
│   ├── outputs.tf              # Output values
│   ├── versions.tf             # Provider versions
│   ├── terraform.tfvars.example
│   └── modules/
│       ├── vpc/                # VPC, subnets, firewall
│       ├── cloud-sql/          # PostgreSQL database
│       ├── artifact-registry/  # Docker registry
│       ├── cloud-run/          # API & Frontend services
│       ├── compute-engine/     # n8n + Redis VM
│       └── secrets/            # Secret Manager
├── scripts/
│   ├── setup-gcp.sh           # Initial project setup
│   └── update-secrets.sh      # Update secrets
└── README.md                  # This file
```

## Common Operations

### View Terraform Outputs

```bash
cd infrastructure/terraform

# All outputs
terraform output

# Specific output
terraform output api_url
terraform output n8n_url
terraform output ssh_command
```

### SSH to n8n VM

```bash
# Get SSH command from Terraform
gcloud compute ssh hospitality-saas-prod-n8n-vm --zone=us-central1-a

# View n8n logs
docker logs -f n8n

# View Redis logs
docker logs -f redis
```

### Scale Cloud Run Services

```bash
# Increase max instances
gcloud run services update hospitality-saas-prod-api \
  --max-instances=20 \
  --region=us-central1

# Enable always-on (avoid cold starts)
gcloud run services update hospitality-saas-prod-api \
  --min-instances=1 \
  --region=us-central1
```

### View Logs

```bash
# API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=hospitality-saas-prod-api" --limit=50

# Frontend logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=hospitality-saas-prod-frontend" --limit=50

# Or use Cloud Console: https://console.cloud.google.com/logs
```

### Rollback Deployment

```bash
# List revisions
gcloud run revisions list --service=hospitality-saas-prod-api --region=us-central1

# Route traffic to previous revision
gcloud run services update-traffic hospitality-saas-prod-api \
  --to-revisions=hospitality-saas-prod-api-00002-abc=100 \
  --region=us-central1
```

## Troubleshooting

### Cloud Run service won't start
1. Check logs: `gcloud logging read "resource.type=cloud_run_revision" --limit=50`
2. Verify secrets are set: `gcloud secrets list`
3. Check health endpoint: `curl https://SERVICE_URL/api/v1/health`

### Can't connect to Cloud SQL
1. Ensure VPC connector is working
2. Check firewall rules allow internal traffic
3. Verify connection string format and credentials

### n8n VM not responding
1. SSH into VM: `gcloud compute ssh hospitality-saas-prod-n8n-vm`
2. Check Docker: `docker ps`
3. Check logs: `docker logs n8n`
4. Restart services: `cd /opt/hospitality && docker-compose restart`

### Terraform state issues
1. Never manually edit `.tfstate` files
2. Use `terraform state` commands for state manipulation
3. Consider remote state with GCS backend for team collaboration

## Security Best Practices

1. **Rotate secrets regularly** - Update API keys quarterly
2. **Enable VPC Service Controls** for production
3. **Use IAM conditions** to restrict access by IP/time
4. **Enable Cloud Audit Logs** for compliance
5. **Set up budget alerts** to avoid surprise bills

## Upgrading

### Database
```bash
# Create backup first
gcloud sql backups create --instance=hospitality-saas-prod-postgres-xxxx

# Update tier in terraform.tfvars
db_tier = "db-g1-small"

# Apply
terraform apply
```

### Cloud Run resources
Update `api_cpu`, `api_memory` in terraform.tfvars and run `terraform apply`.

## Destroying Infrastructure

```bash
# Disable deletion protection on Cloud SQL first
gcloud sql instances patch hospitality-saas-prod-postgres-xxxx --no-deletion-protection

# Destroy all resources
terraform destroy

# This will NOT delete:
# - GCS buckets with data
# - Cloud SQL backups
# - Audit logs
```

## CLI Reference

The `hsp` CLI tool provides automated deployment with a single command.

### Installation

```bash
cd infrastructure/cli
npm install
npm run build
npm link  # Makes 'hsp' available globally
```

### Commands

| Command | Description |
|---------|-------------|
| `hsp deploy` | Full automated deployment |
| `hsp setup` | Initialize GCP project only |
| `hsp secrets` | Manage Secret Manager secrets |
| `hsp status` | Check deployment status |
| `hsp destroy` | Destroy infrastructure |

### Deploy Options

```bash
hsp deploy [options]

Options:
  -e, --environment <env>  Environment (staging/production)
  -p, --project <id>       GCP Project ID
  -r, --region <region>    GCP Region (default: us-central1)
  -b, --billing <id>       Billing Account ID
  --skip-setup             Skip GCP project setup
  --skip-infra             Skip Terraform
  --skip-secrets           Skip secrets configuration
  --skip-build             Skip Docker builds
  --skip-migrate           Skip database migrations
  --dry-run                Show what would be done
  -y, --yes                Skip confirmation prompts
```

### Examples

```bash
# Full interactive deployment
hsp deploy

# Non-interactive deployment
hsp deploy -p my-project -b 01XXXX-XXXXXX -e production -y

# Deploy only app (skip infrastructure)
hsp deploy --skip-setup --skip-infra -e production

# Check status
hsp status -e production

# Manage secrets
hsp secrets -e production --list
hsp secrets -e production --set openai-api-key
```

## Makefile Reference

| Command | Description |
|---------|-------------|
| `make deploy` | Full deployment |
| `make deploy-app` | App only (skip infra) |
| `make status` | Show status |
| `make urls` | Show URLs |
| `make health` | Health check |
| `make logs-api` | Tail API logs |
| `make ssh-n8n` | SSH to n8n VM |
| `make secrets-list` | List secrets |
| `make secrets-set NAME=xxx` | Set secret |
| `make destroy` | Destroy all |

## Support

- **GCP Documentation**: https://cloud.google.com/docs
- **Terraform GCP Provider**: https://registry.terraform.io/providers/hashicorp/google
- **Cloud Run**: https://cloud.google.com/run/docs
- **Cloud SQL**: https://cloud.google.com/sql/docs
