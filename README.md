# Mitch Hospitality SaaS Platform

Multi-tenant hospitality AI platform for restaurants, street food vendors, and hospitality businesses.

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env
# Edit .env with your settings

# 2. Start infrastructure
docker-compose up -d

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev
```

## Architecture

- **API Server**: Node.js/Express with TypeScript
- **Database**: PostgreSQL 16 with Row-Level Security
- **Cache**: Redis 7
- **Vector DB**: Qdrant (for RAG)
- **Workflows**: n8n automation engine
- **Monitoring**: Grafana + Prometheus

## Multi-Tenant Security

All tables use Row-Level Security (RLS) with automatic tenant isolation.
JWT tokens include `tenant_id` claim for request context.

## Pricing Tiers

| Tier | Price | Locations | Users | API Calls |
|------|-------|-----------|-------|-----------|
| Starter | $49/mo | 1 | 5 | 10,000 |
| Professional | $149/mo | 5 | 20 | 50,000 |
| Enterprise | $499/mo | Unlimited | Unlimited | 500,000 |

## Related Documentation

- `/home/godja/MITCH_HOSPITALITY_SAAS_PLATFORM.md` - Full platform specification
- `/home/godja/MITCH_IMPLEMENTATION_ROADMAP.md` - Implementation roadmap

## License

Proprietary - Mitch from Transylvania
