# GCP AI Services Deployment

Hybrid deployment: AWS (core) + GCP (AI services)

## Architecture

```
AWS (eu-west-2)                    GCP (europe-west2)
┌─────────────────────┐           ┌─────────────────────────┐
│  Amplify (Frontend) │           │  Cloud Run (AI Router)  │
│  ECS (API)          │──────────▶│  - OpenAI / Claude      │
│  RDS (PostgreSQL)   │           │  - Perplexity / Gemini  │
│  ElastiCache (Redis)│           │  Compute Engine         │
└─────────────────────┘           │  - Qdrant Vector DB     │
                                  └─────────────────────────┘
```

## Cost Estimate

| Service | Spec | Monthly Cost |
|---------|------|--------------|
| Cloud Run (AI Router) | 1 vCPU, 2GB, scale-to-0 | ~$15-40 |
| Compute Engine (Qdrant) | e2-small + 20GB SSD | ~$18 |
| Artifact Registry | ~5GB images | ~$2 |
| Secret Manager | 4 secrets | <$1 |
| Networking | Cross-cloud egress | ~$5-10 |
| **TOTAL** | | **~$40-70/mo** |

With $700 credits: **~10-17 months free**

## Deployment Steps

### 1. Initial Setup

```bash
# Authenticate with GCP
gcloud auth login
gcloud auth application-default login

# Run setup (creates APIs, Artifact Registry, Secrets)
./setup.sh
```

### 2. Add API Keys

```bash
# Interactive mode
./update-secrets.sh

# Or manually
echo -n 'sk-xxx' | gcloud secrets versions add openai-api-key --data-file=-
echo -n 'sk-ant-xxx' | gcloud secrets versions add anthropic-api-key --data-file=-
```

### 3. Deploy Qdrant (Optional)

Only needed if using vector search/RAG features:

```bash
./deploy-qdrant.sh
```

### 4. Deploy AI Service

```bash
./deploy-ai-service.sh
```

### 5. Update AWS ECS

Add environment variable to ECS task definition:

```
AI_SERVICE_URL=https://mitch-ai-xxxxx-ew.a.run.app
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with provider status |
| `/ping` | GET | Simple ping/pong |
| `/providers` | GET | List available AI providers |
| `/v1/chat/completions` | POST | OpenAI-compatible chat API |
| `/complete` | POST | Simple completion endpoint |

### Example: Chat Completion

```bash
curl -X POST https://mitch-ai-xxxxx.a.run.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "provider": "openai",
    "model": "gpt-4o-mini",
    "max_tokens": 500
  }'
```

### Example: Simple Completion

```bash
curl -X POST https://mitch-ai-xxxxx.a.run.app/complete \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a menu description for: Sarmale",
    "system": "You are a Romanian cuisine expert.",
    "max_tokens": 200
  }'
```

## Monitoring

```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mitch-ai" \
  --limit=50 --project=mitch-ai-services

# Check service status
gcloud run services describe mitch-ai --region=europe-west2

# View Qdrant logs
gcloud compute instances get-serial-port-output qdrant-server --zone=europe-west2-a
```

## Scaling

Cloud Run auto-scales 0-10 instances. To adjust:

```bash
gcloud run services update mitch-ai \
  --min-instances=1 \
  --max-instances=20 \
  --region=europe-west2
```

## Costs Control

1. **Scale to zero**: Default min-instances=0 means no charge when idle
2. **Request timeout**: 60s max to prevent runaway requests
3. **Memory**: 2GB is enough for most LLM API calls
4. **Qdrant**: e2-small is the minimum viable size

## Troubleshooting

### Cloud Run won't start
```bash
# Check deployment logs
gcloud run services describe mitch-ai --region=europe-west2

# Check container logs
gcloud logging read "resource.type=cloud_run_revision" --limit=20
```

### Secrets not found
```bash
# List secrets
gcloud secrets list --project=mitch-ai-services

# Check secret versions
gcloud secrets versions list openai-api-key
```

### Qdrant unreachable
```bash
# SSH into Qdrant VM
gcloud compute ssh qdrant-server --zone=europe-west2-a

# Check container
sudo docker ps
sudo docker logs $(sudo docker ps -q)
```
