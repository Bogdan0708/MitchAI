# 🚀 Hospitality SaaS Deployment Plan

**Created:** 2025-06-26  
**Target:** Production deployment on GCP

---

## TL;DR - Three Options

| Option | Monthly Cost | Best For |
|--------|-------------|----------|
| **MVP** | ~$45-75/mo | Testing with real users, early customers |
| **Production** | ~$120-180/mo | 10-50 active tenants, reliable uptime |
| **Scale** | ~$300-500/mo | 50+ tenants, high availability |

---

## Option 1: MVP Deploy (~$45-75/mo)

**Philosophy:** Scale-to-zero, minimal resources, accept cold starts

### GCP Infrastructure

| Service | Tier | Cost/mo | Notes |
|---------|------|---------|-------|
| Cloud SQL (PostgreSQL) | db-f1-micro | $9 | 0.6GB RAM, shared CPU |
| Cloud Run (API) | Scale-to-zero | $0-25 | Pay per request, 2-5s cold start |
| Cloud Run (Frontend) | Scale-to-zero | $0-15 | Pay per request |
| Compute Engine (n8n+Redis) | e2-micro | $7 | 1GB RAM, good for light workflows |
| VPC Connector | 2 instances | $12 | Required for Cloud SQL access |
| Secret Manager | ~10 secrets | $1 | Negligible |
| Artifact Registry | Storage | $1 | Docker images |
| **GCP Subtotal** | | **$30-70** | |

### External Services

| Service | Tier | Cost/mo | Notes |
|---------|------|---------|-------|
| Qdrant Cloud | Free tier | $0 | 1GB storage, 1M vectors |
| Stripe | Pay-as-you-go | $0 + 2.9% | No monthly fee |
| SendGrid | Free tier | $0 | 100 emails/day |
| OpenAI API | Pay-as-you-go | $5-20 | Depends on usage |
| Anthropic API | Pay-as-you-go | $5-20 | Depends on usage |
| Domain + SSL | Caddy auto-SSL | $12/yr | ~$1/mo |
| **External Subtotal** | | **$11-42** | |

### **MVP Total: ~$45-75/mo**

### Pros/Cons

✅ Cheapest option  
✅ Scales to zero when idle  
✅ Good for validating product  
❌ Cold starts (2-5s) on first request  
❌ Database limited (may need upgrade with 10+ tenants)  
❌ n8n workflows may timeout on heavy tasks

---

## Option 2: Production (~$120-180/mo)

**Philosophy:** Always-on, no cold starts, room to grow

### GCP Infrastructure

| Service | Tier | Cost/mo | Notes |
|---------|------|---------|-------|
| Cloud SQL (PostgreSQL) | db-g1-small | $26 | 1.7GB RAM, better performance |
| Cloud Run (API) | min_instances=1 | $25-40 | Always warm, no cold starts |
| Cloud Run (Frontend) | min_instances=1 | $20-30 | Always warm |
| Compute Engine (n8n+Redis) | e2-small | $13 | 2GB RAM, handles workflows |
| VPC Connector | 2 instances | $12 | Required |
| Secret Manager | ~15 secrets | $1 | |
| Artifact Registry | Storage | $2 | |
| Cloud Armor (WAF) | Basic | $5 | DDoS protection |
| **GCP Subtotal** | | **$104-129** | |

### External Services

| Service | Tier | Cost/mo | Notes |
|---------|------|---------|-------|
| Qdrant Cloud | Starter | $25 | 4GB storage, better performance |
| Stripe | Pay-as-you-go | $0 + 2.9% | |
| SendGrid | Essentials | $20 | 50K emails/mo |
| OpenAI API | Pay-as-you-go | $10-30 | |
| Anthropic API | Pay-as-you-go | $10-30 | |
| Domain | | $1 | |
| **External Subtotal** | | **$66-106** | |

### **Production Total: ~$120-180/mo**

### Pros/Cons

✅ No cold starts  
✅ Handles 10-50 tenants comfortably  
✅ Room for workflow automation  
✅ Basic DDoS protection  
❌ Higher base cost  
❌ Need to scale manually as you grow

---

## Option 3: Scale (~$300-500/mo)

**Philosophy:** High availability, auto-scaling, production-hardened

### GCP Infrastructure

| Service | Tier | Cost/mo | Notes |
|---------|------|---------|-------|
| Cloud SQL (PostgreSQL) | db-custom-2-4096 | $70 | 2 vCPU, 4GB RAM, HA optional |
| Cloud Run (API) | min=2, max=10 | $50-100 | Auto-scales, redundant |
| Cloud Run (Frontend) | min=2, max=5 | $40-60 | |
| Compute Engine (n8n+Redis) | e2-medium | $25 | 4GB RAM |
| VPC Connector | 3 instances | $18 | |
| Secret Manager | ~20 secrets | $2 | |
| Cloud Armor (WAF) | Standard | $12 | Advanced rules |
| Cloud CDN | Basic | $10 | Frontend caching |
| Cloud Monitoring | Enhanced | $10 | Alerts, dashboards |
| **GCP Subtotal** | | **$237-307** | |

### External Services

| Service | Tier | Cost/mo | Notes |
|---------|------|---------|-------|
| Qdrant Cloud | Business | $75 | 16GB, replicas |
| Stripe | Pay-as-you-go | $0 + 2.9% | |
| SendGrid | Pro | $90 | 100K emails/mo, dedicated IP |
| OpenAI API | | $20-50 | |
| Anthropic API | | $20-50 | |
| Domain | | $1 | |
| **External Subtotal** | | **$206-266** | |

### **Scale Total: ~$300-500/mo**

---

## 📋 Deployment Checklist

### Phase 1: Prerequisites (30 min)

- [ ] GCP account with billing enabled
- [ ] `gcloud` CLI installed and authenticated
- [ ] Terraform 1.5+ installed
- [ ] Docker installed
- [ ] Domain name ready (or use Cloud Run URLs initially)

### Phase 2: External Services Setup (1-2 hours)

- [ ] **Stripe Account**
  - Create account at stripe.com
  - Get API keys (test mode first)
  - Set up webhook endpoint (after deploy)
  
- [ ] **SendGrid Account**
  - Create account at sendgrid.com
  - Verify sender domain
  - Get API key
  
- [ ] **AI Providers**
  - OpenAI API key (platform.openai.com)
  - Anthropic API key (console.anthropic.com)
  - Optional: Perplexity, Google AI
  
- [ ] **Qdrant Cloud** (optional, can self-host)
  - Create cluster at cloud.qdrant.io
  - Get API key and URL

### Phase 3: GCP Infrastructure (30-60 min)

```bash
cd ~/hospitality-saas/infrastructure

# Option A: One-command deploy (recommended)
cd cli && npm install && npm run build && npm link
hsp deploy -p YOUR_PROJECT_ID -b YOUR_BILLING_ID -e production

# Option B: Manual with Makefile
make deploy PROJECT=YOUR_PROJECT_ID ENV=production
```

### Phase 4: Secrets Configuration (15 min)

```bash
# Set all secrets
hsp secrets -e production --set stripe-secret-key
hsp secrets -e production --set stripe-webhook-secret
hsp secrets -e production --set openai-api-key
hsp secrets -e production --set anthropic-api-key
hsp secrets -e production --set sendgrid-api-key
hsp secrets -e production --set jwt-secret
```

### Phase 5: Database Migration (10 min)

```bash
# Run migrations
make migrate ENV=production
```

### Phase 6: Verification (15 min)

```bash
# Check status
hsp status -e production

# Health check
make health ENV=production

# Get URLs
make urls ENV=production
```

### Phase 7: DNS & SSL (if using custom domain)

1. Point domain A record to Cloud Run URL
2. Or use Cloud Run domain mapping:
```bash
gcloud run domain-mappings create --service=hospitality-saas-prod-api \
  --domain=api.yourdomain.com --region=us-central1
```

### Phase 8: Post-Deploy (30 min)

- [ ] Create first admin tenant via API
- [ ] Configure Stripe webhook URL
- [ ] Test payment flow (test mode)
- [ ] Test email sending
- [ ] Import n8n workflows from `~/dev/mitch/main/mitch-production/workflows/`
- [ ] Set up monitoring alerts

---

## 💰 Cost Comparison Table

| Component | MVP | Production | Scale |
|-----------|-----|------------|-------|
| Database | $9 | $26 | $70 |
| API (Cloud Run) | $0-25 | $25-40 | $50-100 |
| Frontend (Cloud Run) | $0-15 | $20-30 | $40-60 |
| n8n VM | $7 | $13 | $25 |
| Networking | $13 | $13 | $20 |
| Qdrant | $0 | $25 | $75 |
| Email | $0 | $20 | $90 |
| AI APIs | $10-40 | $20-60 | $40-100 |
| **TOTAL** | **$45-75** | **$120-180** | **$300-500** |

---

## 🎯 Recommendation

**Start with MVP ($45-75/mo)** because:

1. You need to validate with real users first
2. Cold starts are annoying but not fatal for B2B SaaS
3. You can upgrade Cloud SQL with zero downtime
4. Cloud Run scales automatically if you get traffic spikes
5. Easy to upgrade to Production tier when you hit 5-10 paying customers

**Upgrade trigger points:**
- 5+ tenants → Upgrade Cloud SQL to db-g1-small
- Cold starts annoying users → Set min_instances=1
- 10+ tenants → Move to Production tier
- 50+ tenants → Scale tier with HA

---

## ⚡ Quick Start Command

```bash
cd ~/hospitality-saas/infrastructure/cli
npm install && npm run build && npm link

# Deploy MVP
hsp deploy -e production --dry-run  # Preview first
hsp deploy -e production             # Actually deploy
```

---

## 📊 Revenue Breakeven

| Tier | Monthly Cost | Breakeven (at $49/tenant) | Breakeven (at $149/tenant) |
|------|-------------|---------------------------|----------------------------|
| MVP | $60 | 2 tenants | 1 tenant |
| Production | $150 | 4 tenants | 2 tenants |
| Scale | $400 | 9 tenants | 3 tenants |

You're profitable quickly. 😮‍💨

---

## Questions?

Just ask. I can:
- Run the deployment commands
- Help debug issues
- Set up monitoring
- Configure the n8n workflows
