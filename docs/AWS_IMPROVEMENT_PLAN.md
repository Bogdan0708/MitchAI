# AWS Improvement Plan

**Created:** 2026-01-28  
**Domain:** mitchfromtransylvania.com  
**Current State:** ECS Fargate + RDS (Free Tier)

---

## Current Architecture

```
                    ┌─────────────────────┐
                    │    Cloudflare DNS   │
                    │ mitchfromtransylvania│
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   AWS ALB (London)  │
                    │   mitch-dev-alb     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    ECS Fargate      │
                    │   mitch-dev-api     │
                    │  256 CPU / 512 MB   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    RDS Postgres     │
                    │  mitch-dev-postgres │
                    │    db.t3.micro      │
                    └─────────────────────┘
```

---

## Improvements Needed

### 1. ✅ Health Endpoint (Done)
Added `/health` and `/ready` endpoints for ALB health checks.

### 2. Production Environment Variables
Current: `NODE_ENV=development`  
Target: `NODE_ENV=production`

### 3. Marketing Landing Page
Options:
- **A) Static S3 + CloudFront** - Cheapest, separate from API
- **B) Next.js on same ECS** - Single deployment
- **C) External** - Framer, Webflow, Carrd (easiest)

### 4. Subdomains Structure
```
mitchfromtransylvania.com     → Marketing/Landing page
api.mitchfromtransylvania.com → API (current ECS)
app.mitchfromtransylvania.com → Dashboard (future)
```

### 5. SSL/TLS
Currently handled by ALB. ✅

### 6. Monitoring & Alerts
- CloudWatch alarms for ECS
- RDS performance insights
- Error rate monitoring

---

## Deployment Steps

### Step 1: Build & Push New Image

```bash
# Login to ECR
aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin 000000000000.dkr.ecr.eu-west-2.amazonaws.com

# Build image
cd <repo-root>
docker build -t mitch-hospitality-api:latest -f Dockerfile --target production .

# Tag and push
docker tag mitch-hospitality-api:latest 000000000000.dkr.ecr.eu-west-2.amazonaws.com/mitch-hospitality-api:latest
docker push 000000000000.dkr.ecr.eu-west-2.amazonaws.com/mitch-hospitality-api:latest
```

### Step 2: Update ECS Task Definition

```bash
# Create new task definition with production settings
aws ecs register-task-definition \
  --family mitch-dev-api \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 256 \
  --memory 512 \
  --execution-role-arn arn:aws:iam::000000000000:role/ecsTaskExecutionRole \
  --container-definitions '[
    {
      "name": "mitch-api",
      "image": "000000000000.dkr.ecr.eu-west-2.amazonaws.com/mitch-hospitality-api:latest",
      "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "LOG_LEVEL", "value": "info"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:eu-west-2:000000000000:secret:mitch/db-url"},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:eu-west-2:000000000000:secret:mitch/jwt-secret"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/mitch-dev-api",
          "awslogs-region": "eu-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]'
```

### Step 3: Update ECS Service

```bash
aws ecs update-service \
  --cluster mitch-cluster \
  --service mitch-dev-api \
  --force-new-deployment \
  --region eu-west-2
```

### Step 4: Update ALB Health Check

```bash
# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups --region eu-west-2 --query 'TargetGroups[0].TargetGroupArn' --output text)

# Update health check
aws elbv2 modify-target-group \
  --target-group-arn $TG_ARN \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region eu-west-2
```

---

## Marketing Site Options

### Option A: Simple Landing Page (Recommended)
Use a hosted service for the marketing site:

| Service | Cost | Pros |
|---------|------|------|
| **Carrd** | $19/yr | Super simple, fast |
| **Framer** | Free-$20/mo | Beautiful, no-code |
| **Webflow** | Free-$16/mo | Powerful, CMS included |

Point `mitchfromtransylvania.com` → Hosted service  
Point `api.mitchfromtransylvania.com` → AWS ALB

### Option B: S3 + CloudFront (DIY)
```bash
# Create S3 bucket
aws s3 mb s3://mitchfromtransylvania-marketing

# Enable static hosting
aws s3 website s3://mitchfromtransylvania-marketing \
  --index-document index.html \
  --error-document error.html

# Create CloudFront distribution
# (Detailed steps in separate guide)
```

### Option C: Same ECS (Complex)
Add nginx container to serve static files + proxy to API.

---

## DNS Configuration (Cloudflare)

```
Type  Name   Content                                              Proxy
A     @      → CloudFront/Webflow/Carrd IP                        ✓
CNAME api    → mitch-dev-alb-449769852.eu-west-2.elb.amazonaws.com ✗
CNAME app    → (future dashboard)                                  ✗
```

---

## Monitoring Setup

```bash
# Create CloudWatch alarm for ECS CPU
aws cloudwatch put-metric-alarm \
  --alarm-name mitch-api-high-cpu \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=ClusterName,Value=mitch-cluster Name=ServiceName,Value=mitch-dev-api \
  --alarm-actions arn:aws:sns:eu-west-2:000000000000:alerts \
  --region eu-west-2
```

---

## Cost Projection (Post Free Tier)

| Component | Monthly Cost |
|-----------|--------------|
| ECS Fargate (256 CPU/512MB) | ~$10 |
| RDS t3.micro | ~$15 |
| ALB | ~$18 |
| Data Transfer | ~$2 |
| CloudWatch | ~$2 |
| **Total** | **~$47/mo** |

Still cheaper than most alternatives!

---

## Quick Commands

```bash
# View ECS logs
aws logs tail /ecs/mitch-dev-api --follow --region eu-west-2

# Check service status
aws ecs describe-services --cluster mitch-cluster --services mitch-dev-api --region eu-west-2

# Force redeploy
aws ecs update-service --cluster mitch-cluster --service mitch-dev-api --force-new-deployment --region eu-west-2

# Check RDS status
aws rds describe-db-instances --db-instance-identifier mitch-dev-postgres --region eu-west-2
```
