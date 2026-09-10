# AWS Infrastructure

This directory contains AWS infrastructure configuration for the Mitch Hospitality SaaS platform.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS (eu-west-2)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────────┐    ┌────────────────────┐          │
│  │  Cloudflare │───▶│   ALB (HTTPS)   │───▶│  ECS Fargate       │          │
│  │    (DNS)    │    │  mitch-alb      │    │  mitch-dev-api     │          │
│  └─────────────┘    └─────────────────┘    └────────┬───────────┘          │
│                                                      │                      │
│                     ┌────────────────────────────────┼────────────────┐     │
│                     │                                │                │     │
│                     ▼                                ▼                │     │
│            ┌────────────────┐              ┌─────────────────┐       │     │
│            │   RDS          │              │  ElastiCache    │       │     │
│            │   PostgreSQL   │              │  Redis          │       │     │
│            │   mitch-postgres              │  mitch-redis    │       │     │
│            └────────────────┘              └─────────────────┘       │     │
│                                                                       │     │
│  ┌──────────────────────────────────────────────────────────────────┐│     │
│  │                     Secrets Manager                               ││     │
│  │  - mitch/database-url    - mitch/stripe-secret-key               ││     │
│  │  - mitch/redis-url       - mitch/openai-api-key                  ││     │
│  │  - mitch/jwt-secret      - mitch/anthropic-api-key               ││     │
│  └──────────────────────────────────────────────────────────────────┘│     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Files

| File | Description |
|------|-------------|
| `task-definition.json` | ECS task definition with Secrets Manager integration |
| `cloudwatch-alarms.json` | CloudWatch alarm configurations for monitoring |
| `auto-scaling.json` | Auto-scaling policies for ECS service |
| `setup-secrets.sh` | Script to create/update secrets in Secrets Manager |

## Quick Start

### 1. Set Up Secrets

```bash
# Set environment variables (or use .env file)
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export REDIS_URL="redis://host:6379"
export JWT_SECRET="your-secret"
# ... other secrets

# Run setup script
chmod +x setup-secrets.sh
./setup-secrets.sh
```

### 2. Update IAM Role

```bash
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

### 3. Register Task Definition

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region eu-west-2
```

### 4. Update ECS Service

```bash
aws ecs update-service \
  --cluster mitch-cluster \
  --service mitch-dev-api \
  --task-definition mitch-dev-api \
  --force-new-deployment \
  --region eu-west-2
```

### 5. Set Up CloudWatch Alarms

```bash
# Create SNS topic for alerts
aws sns create-topic --name mitch-alerts --region eu-west-2

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-west-2:000000000000:mitch-alerts \
  --protocol email \
  --notification-endpoint your@email.com \
  --region eu-west-2

# Create alarms (example)
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
  --alarm-actions arn:aws:sns:eu-west-2:000000000000:mitch-alerts \
  --region eu-west-2
```

### 6. Configure Auto-Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/mitch-cluster/mitch-dev-api \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 3 \
  --region eu-west-2

# Create CPU-based scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/mitch-cluster/mitch-dev-api \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name mitch-api-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleOutCooldown": 300,
    "ScaleInCooldown": 300
  }' \
  --region eu-west-2
```

## Useful Commands

### Check Service Status

```bash
aws ecs describe-services \
  --cluster mitch-cluster \
  --services mitch-dev-api \
  --query 'services[0].{running:runningCount,desired:desiredCount,status:status}' \
  --region eu-west-2
```

### Check Target Health

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:eu-west-2:000000000000:targetgroup/mitch-dev-api-tg/506ab79f83d2f13d \
  --region eu-west-2
```

### View Recent Logs

```bash
aws logs tail /ecs/mitch-dev-api --since 1h --region eu-west-2
```

### Force New Deployment

```bash
aws ecs update-service \
  --cluster mitch-cluster \
  --service mitch-dev-api \
  --force-new-deployment \
  --region eu-west-2
```

## Cost Estimates

| Resource | Monthly Cost (approx) |
|----------|----------------------|
| ECS Fargate (1 task, 256 CPU, 512MB) | ~$10-15 |
| RDS PostgreSQL (db.t3.micro) | ~$15-20 |
| ElastiCache Redis (cache.t3.micro) | ~$12-15 |
| ALB | ~$16 |
| Secrets Manager (10 secrets) | ~$4 |
| CloudWatch (logs, alarms) | ~$5-10 |
| **Total** | **~$60-80/mo** |

## GitHub Actions Secrets Required

Configure these secrets in your GitHub repository:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |

## Troubleshooting

### Health Check Failures

1. Check if CORS is blocking health checks (should be fixed - health endpoints are before CORS middleware)
2. Verify security group allows ALB traffic
3. Check CloudWatch logs for errors

```bash
aws logs filter-log-events \
  --log-group-name /ecs/mitch-dev-api \
  --filter-pattern "ERROR" \
  --start-time $(date -d "1 hour ago" +%s000) \
  --region eu-west-2
```

### Task Failing to Start

1. Check task stopped reason:
   ```bash
   aws ecs describe-tasks \
     --cluster mitch-cluster \
     --tasks $(aws ecs list-tasks --cluster mitch-cluster --service-name mitch-dev-api --desired-status STOPPED --query 'taskArns[0]' --output text --region eu-west-2) \
     --region eu-west-2
   ```

2. Verify secrets are accessible:
   ```bash
   aws secretsmanager get-secret-value --secret-id mitch/database-url --region eu-west-2
   ```

3. Check IAM role permissions:
   ```bash
   aws iam list-attached-role-policies --role-name ecsTaskExecutionRole
   ```
