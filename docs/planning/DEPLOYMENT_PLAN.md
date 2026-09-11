# 🚀 Hospitality SaaS Deployment Plan

**Updated:** 2026-01-31  
**Strategy:** Hybrid AWS (core) + GCP (AI services)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE                                │
│                    (DNS + CDN + DDoS)                           │
└─────────────┬─────────────────────────────────┬─────────────────┘
              │                                 │
              ▼                                 ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│         AWS             │     │            GCP                   │
│  ┌──────────────────┐  │     │  ┌─────────────────────────────┐ │
│  │   Amplify        │  │     │  │     Cloud Run (AI)          │ │
│  │   (Frontend)     │  │     │  │  - LLM orchestration        │ │
│  └──────────────────┘  │     │  │  - Vector search (Qdrant)   │ │
│  ┌──────────────────┐  │     │  │  - AI-heavy workloads       │ │
│  │   ALB + ECS      │  │     │  └─────────────────────────────┘ │
│  │   (API)          │  │     └─────────────────────────────────┘
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │   RDS Postgres   │  │
│  │   (Database)     │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │   ElastiCache    │  │
│  │   (Redis)        │  │
│  └──────────────────┘  │
└─────────────────────────┘
```

---

## Cost Breakdown

| Component | Service | Monthly Cost | Notes |
|-----------|---------|--------------|-------|
| **Frontend** | AWS Amplify | ~$5-15 | Static hosting + builds |
| **API** | ECS Fargate | ~$15-30 | 0.5 vCPU, 1GB RAM |
| **Database** | RDS PostgreSQL | ~$15-25 | db.t3.micro |
| **Cache** | ElastiCache Redis | ~$12-15 | cache.t3.micro |
| **Load Balancer** | ALB | ~$18 | Fixed + usage |
| **AI Services** | GCP Cloud Run | ~$10-30 | Pay per request |
| **DNS/CDN** | Cloudflare | $0 | Free tier |
| **TOTAL** | | **~$75-130/mo** | |

---

## Current Infrastructure Status

### AWS (eu-west-2) ✅

| Resource | Status | Details |
|----------|--------|---------|
| VPC | ✅ Default VPC | Using existing |
| RDS PostgreSQL | ✅ Running | `mitch-postgres.cdlh3juxdrbo.eu-west-2.rds.amazonaws.com` |
| ElastiCache Redis | ✅ Running | `mitch-redis.0qttdd.0001.euw2.cache.amazonaws.com:6379` |
| ECR Repository | ✅ Created | `000000000000.dkr.ecr.eu-west-2.amazonaws.com/mitch-dev-api` |
| ECS Cluster | ✅ Created | `mitch-cluster` |
| ECS Service | 🔄 Deploying | `mitch-dev-api` |
| ALB | ✅ Running | `mitch-dev-alb-449769852.eu-west-2.elb.amazonaws.com` |
| Amplify | ✅ Running | Frontend deployed |
| IAM Role | ✅ Created | `ecsTaskExecutionRole` |

### Cloudflare DNS ✅

| Record | Type | Value | Status |
|--------|------|-------|--------|
| `@` (root) | CNAME | `d30b6s96j1j43g.cloudfront.net` | ✅ Active |
| `www` | CNAME | `d30b6s96j1j43g.cloudfront.net` | ✅ Active |
| `api` | CNAME | `mitch-dev-alb-449769852.eu-west-2.elb.amazonaws.com` | ✅ Active |
| `_4db1efe3b5dec50d572d4607a72dc41f` | CNAME | `_006be7bd5d0eb1d0e89ee3de80af4821.jkddzztszm.acm-validations.aws` | ✅ Cert validation |
| `n8n` | CNAME | `e6e85394-0e60-4a6b-baef-db4683ec2f9d.cfargotunnel.com` | ✅ Active (proxied) |

---

## AWS CLI Deployment Commands

### Prerequisites

```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Configure credentials
aws configure
# Region: eu-west-2
```

### 1. Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name mitch-dev-api \
  --region eu-west-2
```

### 2. Build & Push Docker Image

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region eu-west-2 | \
  docker login --username AWS --password-stdin \
  000000000000.dkr.ecr.eu-west-2.amazonaws.com

# Build and push
cd <repo-root>
npm run build
docker build -t mitch-dev-api .
docker tag mitch-dev-api:latest \
  000000000000.dkr.ecr.eu-west-2.amazonaws.com/mitch-dev-api:latest
docker push 000000000000.dkr.ecr.eu-west-2.amazonaws.com/mitch-dev-api:latest
```

### 3. Create RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier mitch-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username mitch_admin \
  --master-user-password "YOUR_SECURE_PASSWORD" \
  --allocated-storage 20 \
  --db-name mitch_hospitality \
  --publicly-accessible \
  --region eu-west-2
```

### 4. Create ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id mitch-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --region eu-west-2
```

### 5. Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name mitch-cluster \
  --region eu-west-2
```

### 6. Create IAM Role for ECS

```bash
# Create role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### 7. Create CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /ecs/mitch-dev-api \
  --region eu-west-2
```

### 8. Register Task Definition

```bash
aws ecs register-task-definition \
  --family mitch-dev-api \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --execution-role-arn arn:aws:iam::000000000000:role/ecsTaskExecutionRole \
  --container-definitions '[{
    "name": "mitch-dev-api",
    "image": "000000000000.dkr.ecr.eu-west-2.amazonaws.com/mitch-dev-api:latest",
    "cpu": 512,
    "memory": 1024,
    "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "3000"},
      {"name": "DATABASE_URL", "value": "postgresql://USER:PASS@HOST:5432/DB"},
      {"name": "REDIS_URL", "value": "redis://REDIS_HOST:6379"},
      {"name": "JWT_SECRET", "value": "YOUR_JWT_SECRET"},
      {"name": "STRIPE_SECRET_KEY", "value": "sk_test_xxx"},
      {"name": "CORS_ORIGINS", "value": "https://mitchfromtransylvania.com"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/mitch-dev-api",
        "awslogs-region": "eu-west-2",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "essential": true
  }]' \
  --region eu-west-2
```

### 9. Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name mitch-dev-alb \
  --subnets subnet-xxx subnet-yyy subnet-zzz \
  --security-groups sg-xxx \
  --scheme internet-facing \
  --type application \
  --region eu-west-2

# Create target group
aws elbv2 create-target-group \
  --name mitch-dev-api-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxx \
  --target-type ip \
  --health-check-path /ping \
  --health-check-interval-seconds 30 \
  --region eu-west-2

# Create listener (HTTPS)
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:eu-west-2:xxx:loadbalancer/app/mitch-dev-alb/xxx \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:eu-west-2:xxx:certificate/xxx \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:xxx:targetgroup/mitch-dev-api-tg/xxx \
  --region eu-west-2
```

### 10. Create ECS Service

```bash
aws ecs create-service \
  --cluster mitch-cluster \
  --service-name mitch-dev-api \
  --task-definition mitch-dev-api:5 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-xxx,subnet-yyy],
    securityGroups=[sg-xxx],
    assignPublicIp=ENABLED
  }" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:xxx,containerName=mitch-dev-api,containerPort=3000" \
  --region eu-west-2
```

### 11. Security Group Rules

```bash
# Allow ECS to access Redis
aws ec2 authorize-security-group-ingress \
  --group-id sg-REDIS_SG \
  --protocol tcp \
  --port 6379 \
  --source-group sg-ECS_SG \
  --region eu-west-2

# Allow ECS to access RDS
aws ec2 authorize-security-group-ingress \
  --group-id sg-RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group sg-ECS_SG \
  --region eu-west-2
```

---

## Deployment Commands (Quick Reference)

### Deploy New Version

```bash
# 1. Build
cd <repo-root>
npm run build
docker build -t mitch-dev-api .

# 2. Push
aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin 000000000000.dkr.ecr.eu-west-2.amazonaws.com
docker tag mitch-dev-api:latest 000000000000.dkr.ecr.eu-west-2.amazonaws.com/mitch-dev-api:latest
docker push 000000000000.dkr.ecr.eu-west-2.amazonaws.com/mitch-dev-api:latest

# 3. Deploy
aws ecs update-service --cluster mitch-cluster --service mitch-dev-api --force-new-deployment --region eu-west-2
```

### Check Status

```bash
# Service status
aws ecs describe-services --cluster mitch-cluster --services mitch-dev-api --region eu-west-2 \
  --query 'services[0].{running:runningCount,desired:desiredCount,status:status}'

# Task logs
aws logs tail /ecs/mitch-dev-api --since 5m --region eu-west-2

# Health check
curl https://api.mitchfromtransylvania.com/ping
curl https://api.mitchfromtransylvania.com/api/v1/health
```

### Rollback

```bash
# List task definition revisions
aws ecs list-task-definitions --family-prefix mitch-dev-api --region eu-west-2

# Rollback to specific revision
aws ecs update-service --cluster mitch-cluster --service mitch-dev-api \
  --task-definition mitch-dev-api:PREVIOUS_REVISION --region eu-west-2
```

---

## GCP AI Services (Future)

AI-heavy workloads will be deployed to GCP Cloud Run:

```bash
# Deploy AI service to GCP
gcloud run deploy mitch-ai \
  --image gcr.io/PROJECT/mitch-ai:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "OPENAI_API_KEY=xxx,ANTHROPIC_API_KEY=xxx"
```

**Why GCP for AI?**
- Better GPU/TPU support for future ML workloads
- Native Vertex AI integration
- Cost-effective for burst AI traffic

---

## Environment Variables

| Variable | Description | Where |
|----------|-------------|-------|
| `DATABASE_URL` | PostgreSQL connection string | ECS Task Definition |
| `REDIS_URL` | Redis connection string | ECS Task Definition |
| `JWT_SECRET` | JWT signing secret | ECS Task Definition |
| `STRIPE_SECRET_KEY` | Stripe API key | ECS Task Definition |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | ECS Task Definition |
| `CORS_ORIGINS` | Allowed CORS origins | ECS Task Definition |
| `OPENAI_API_KEY` | OpenAI API key | ECS Task Definition |
| `ANTHROPIC_API_KEY` | Anthropic API key | ECS Task Definition |

---

## Monitoring & Alerts

### CloudWatch Alarms

```bash
# CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name mitch-api-cpu-high \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=mitch-cluster Name=ServiceName,Value=mitch-dev-api \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:eu-west-2:xxx:alerts \
  --region eu-west-2
```

---

## Troubleshooting

### Task Won't Start

```bash
# Check service events
aws ecs describe-services --cluster mitch-cluster --services mitch-dev-api \
  --query 'services[0].events[0:5]' --region eu-west-2

# Check stopped tasks
aws ecs list-tasks --cluster mitch-cluster --desired-status STOPPED --region eu-west-2
aws ecs describe-tasks --cluster mitch-cluster --tasks TASK_ARN \
  --query 'tasks[0].stoppedReason' --region eu-west-2
```

### Health Check Failing

```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:eu-west-2:xxx:targetgroup/mitch-dev-api-tg/xxx \
  --region eu-west-2

# Check container logs
aws logs tail /ecs/mitch-dev-api --since 10m --region eu-west-2
```

### Redis Connection Issues

```bash
# Verify security group allows ECS → Redis
aws ec2 describe-security-group-rules \
  --filters Name=group-id,Values=sg-REDIS_SG \
  --query 'SecurityGroupRules[?FromPort==`6379`]' \
  --region eu-west-2
```

---

## URLs

| Service | URL | Status |
|---------|-----|--------|
| Frontend | https://mitchfromtransylvania.com | ✅ Active |
| Frontend (www) | https://www.mitchfromtransylvania.com | ✅ Active |
| Frontend (Amplify default) | https://master.d19ti5682xc8uc.amplifyapp.com | ✅ Active |
| API | https://api.mitchfromtransylvania.com | ✅ Active |
| API Health | https://api.mitchfromtransylvania.com/ping | ✅ Active |
| n8n | https://n8n.mitchfromtransylvania.com | ✅ Active |
| Amplify Console | https://eu-west-2.console.aws.amazon.com/amplify |
| ECS Console | https://eu-west-2.console.aws.amazon.com/ecs |

---

## Next Steps

1. ✅ RDS PostgreSQL running
2. ✅ ElastiCache Redis running
3. ✅ ECS cluster and service created
4. ✅ ALB configured with HTTPS
5. ✅ Amplify frontend deployed
6. ✅ ECS task health checks working
7. ✅ Custom domain `mitchfromtransylvania.com` active (root + www)
8. ✅ Custom domain `api.mitchfromtransylvania.com` active
9. ⬜ Set up CloudWatch alarms
11. ⬜ Configure auto-scaling
12. ⬜ Deploy AI services to GCP
13. ⬜ Set up CI/CD pipeline
