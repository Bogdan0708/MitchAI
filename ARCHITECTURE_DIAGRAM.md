# Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT APPLICATIONS                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Web App    │  │  Mobile App  │  │   Admin      │  │   API       │ │
│  │  (React)     │  │ (React Native│  │   Portal     │  │  Clients    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            LOAD BALANCER                                 │
│                       NGINX / Application LB                             │
│                    (SSL Termination, Routing)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
        │   API Server  │ │   API Server  │ │   API Server  │
        │   (Node.js)   │ │   (Node.js)   │ │   (Node.js)   │
        │               │ │               │ │               │
        │  ┌─────────┐  │ │  ┌─────────┐  │ │  ┌─────────┐  │
        │  │ Tenant  │  │ │  │ Tenant  │  │ │  │ Tenant  │  │
        │  │ Resolver│  │ │  │ Resolver│  │ │  │ Resolver│  │
        │  └─────────┘  │ │  └─────────┘  │ │  └─────────┘  │
        │  ┌─────────┐  │ │  ┌─────────┐  │ │  ┌─────────┐  │
        │  │  Rate   │  │ │  │  Rate   │  │ │  │  Rate   │  │
        │  │ Limiter │  │ │  │ Limiter │  │ │  │ Limiter │  │
        │  └─────────┘  │ │  └─────────┘  │ │  └─────────┘  │
        └───────────────┘ └───────────────┘ └───────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  PostgreSQL  │          │    Redis     │          │    Stripe    │
│   Database   │          │    Cache     │          │    API       │
│              │          │              │          │              │
│  ┌────────┐  │          │  ┌────────┐  │          │  ┌────────┐  │
│  │  RLS   │  │          │  │ Rate   │  │          │  │Payment │  │
│  │ Engine │  │          │  │Limiting│  │          │  │Process │  │
│  └────────┘  │          │  └────────┘  │          │  └────────┘  │
│  ┌────────┐  │          │  ┌────────┐  │          │  ┌────────┐  │
│  │ Multi  │  │          │  │Session │  │          │  │Subscrip│  │
│  │Tenant  │  │          │  │ Cache  │  │          │  │ tion   │  │
│  │ Data   │  │          │  └────────┘  │          │  └────────┘  │
│  └────────┘  │          └──────────────┘          └──────────────┘
└──────────────┘
        │
        ▼
┌──────────────┐
│   Backups    │
│  (S3/Local)  │
└──────────────┘
```

## Request Flow

```
┌──────────┐
│  Client  │
└─────┬────┘
      │ 1. Request with JWT
      ▼
┌──────────────────────────────────────┐
│         NGINX Load Balancer          │
└─────┬────────────────────────────────┘
      │ 2. Route to API instance
      ▼
┌──────────────────────────────────────┐
│          API Server Instance         │
│                                      │
│  3. Extract JWT                      │
│     ┌──────────────────────┐         │
│     │ Tenant Middleware    │         │
│     │ - Decode JWT         │         │
│     │ - Extract tenant_id  │         │
│     │ - Validate tenant    │         │
│     │ - Set DB context     │         │
│     └──────────────────────┘         │
│                                      │
│  4. Check Rate Limits                │
│     ┌──────────────────────┐         │
│     │ Rate Limit Middleware│         │
│     │ - Check per-minute   │ ◄─────Redis
│     │ - Check monthly quota│ ◄─────PostgreSQL
│     │ - Return 429 if over │         │
│     └──────────────────────┘         │
│                                      │
│  5. Execute Business Logic           │
│     ┌──────────────────────┐         │
│     │   Route Handler      │         │
│     │ - Validate input     │         │
│     │ - Execute query      │ ◄─────PostgreSQL (RLS)
│     │ - Return response    │         │
│     └──────────────────────┘         │
│                                      │
│  6. Log Request                      │
│     ┌──────────────────────┐         │
│     │ Audit Logger         │ ────►PostgreSQL
│     └──────────────────────┘         │
└──────────────────────────────────────┘
      │
      │ 7. Response with rate limit headers
      ▼
┌──────────┐
│  Client  │
└──────────┘
```

## Database Schema Relationships

```
┌────────────────────────────────────────────────────────────────────┐
│                        TENANT TABLES                                │
│                                                                     │
│  ┌─────────────┐                                                   │
│  │   tenants   │───────────────┐                                   │
│  │             │               │                                   │
│  │ - id        │               │                                   │
│  │ - slug      │               │                                   │
│  │ - tier      │               │                                   │
│  │ - stripe_id │               │                                   │
│  └─────────────┘               │                                   │
│         │                      │                                   │
│         │ 1:N                  │ 1:N                               │
│         ▼                      ▼                                   │
│  ┌─────────────┐        ┌─────────────┐                           │
│  │tenant_users │        │  locations  │                           │
│  │             │        │             │                           │
│  │ - tenant_id │        │ - tenant_id │                           │
│  │ - email     │        │ - name      │                           │
│  │ - role      │        │ - address   │                           │
│  └─────────────┘        └─────────────┘                           │
│                                │                                   │
│                                │ 1:N                               │
│                    ┌───────────┼──────────┐                        │
│                    ▼           ▼          ▼                        │
│            ┌────────────┐ ┌────────┐ ┌────────────┐               │
│            │   orders   │ │ tables │ │reservation │               │
│            │            │ │        │ │            │               │
│            │- tenant_id │ │-tenant │ │- tenant_id │               │
│            │- location  │ │  _id   │ │- location  │               │
│            │- customer  │ └────────┘ │- customer  │               │
│            └────────────┘            └────────────┘               │
│                  │                                                 │
│                  │ 1:N                                             │
│                  ▼                                                 │
│            ┌────────────┐                                          │
│            │order_items │                                          │
│            │            │                                          │
│            │- order_id  │                                          │
│            │- menu_item │                                          │
│            │- quantity  │                                          │
│            └────────────┘                                          │
│                                                                     │
│  ┌─────────────┐        ┌──────────────┐                          │
│  │    menu     │        │menu_categories│                         │
│  │   items     │◄───────┤              │                          │
│  │             │        │ - tenant_id  │                          │
│  │ - tenant_id │        │ - name       │                          │
│  │ - category  │        └──────────────┘                          │
│  │ - price     │                                                   │
│  └─────────────┘                                                   │
│                                                                     │
│  [All tables have RLS policies filtering by tenant_id]            │
└────────────────────────────────────────────────────────────────────┘
```

## Multi-Tenancy Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      REQUEST ARRIVES                             │
│   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   JWT DECODING                                   │
│  {                                                               │
│    "tenantId": "550e8400-e29b-41d4-a716-446655440000",         │
│    "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",           │
│    "role": "owner"                                              │
│  }                                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              TENANT VALIDATION (PostgreSQL)                      │
│  SELECT * FROM tenants                                           │
│  WHERE id = '550e8400-e29b-41d4-a716-446655440000'              │
│    AND status IN ('active', 'trial')                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           SET DATABASE CONTEXT (PostgreSQL)                      │
│  SET LOCAL app.current_tenant_id =                              │
│    '550e8400-e29b-41d4-a716-446655440000'                       │
│                                                                  │
│  [All subsequent queries automatically filtered by RLS]         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              RATE LIMIT CHECK (Redis)                           │
│                                                                  │
│  Key: "ratelimit:550e8400-e29b-41d4-a716-446655440000"         │
│  Count requests in sliding window                               │
│  If count >= tier_limit: return 429                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              EXECUTE BUSINESS LOGIC                              │
│                                                                  │
│  SELECT * FROM orders                                            │
│  WHERE status = 'pending'                                        │
│  -- RLS automatically adds:                                      │
│  -- AND tenant_id = '550e8400-e29b-41d4-a716-446655440000'      │
│  ORDER BY created_at DESC                                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              AUDIT LOGGING                                       │
│                                                                  │
│  INSERT INTO audit_logs (tenant_id, user_id, action)            │
│  VALUES ('550e8400...', '7c9e6679...', 'orders.list')           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              RETURN RESPONSE                                     │
│  {                                                               │
│    "data": [...],                                                │
│    "meta": {                                                     │
│      "tenant": "restaurant-name",                                │
│      "rateLimit": {                                              │
│        "limit": 500,                                             │
│        "remaining": 487                                          │
│      }                                                            │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Rate Limiting Architecture

```
┌────────────────────────────────────────────────────────────┐
│                  RATE LIMITING LAYERS                       │
└────────────────────────────────────────────────────────────┘

Layer 1: IP-Based (Global DDoS Protection)
┌──────────────────────────────────────────────────────────┐
│  Key: "ratelimit:ip:192.168.1.100"                       │
│  Window: 1 minute                                         │
│  Limit: 1000 requests/minute                             │
│  Storage: Redis Sorted Set                               │
│  Applied: Before authentication                          │
└──────────────────────────────────────────────────────────┘
                           │
                           │ Pass
                           ▼
Layer 2: Per-Tenant Per-Minute (Tier-Based)
┌──────────────────────────────────────────────────────────┐
│  Key: "ratelimit:550e8400-e29b-41d4-a716-446655440000"  │
│  Window: 1 minute (sliding)                              │
│  Limit: Starter=100, Professional=500, Enterprise=2000   │
│  Storage: Redis Sorted Set                               │
│  Applied: After authentication                           │
└──────────────────────────────────────────────────────────┘
                           │
                           │ Pass
                           ▼
Layer 3: Monthly Quota (Subscription-Based)
┌──────────────────────────────────────────────────────────┐
│  Table: tenants.api_requests_used                        │
│  Window: 1 month (calendar month)                        │
│  Limit: Starter=10k, Professional=50k, Enterprise=500k   │
│  Storage: PostgreSQL                                     │
│  Applied: After authentication                           │
│  Reset: First day of month                               │
└──────────────────────────────────────────────────────────┘
                           │
                           │ Pass
                           ▼
                   ┌──────────────┐
                   │  Process     │
                   │  Request     │
                   └──────────────┘
```

## Billing Integration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  TENANT ONBOARDING                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  1. Create Stripe Customer           │
        │     POST /v1/customers               │
        │     {                                │
        │       "name": "Restaurant Name",     │
        │       "email": "owner@restaurant.com"│
        │     }                                │
        └──────────────────────────────────────┘
                           │
                           ▼ customer_id
        ┌──────────────────────────────────────┐
        │  2. Attach Payment Method            │
        │     POST /v1/payment_methods/attach  │
        │     {                                │
        │       "customer": "cus_xxx"          │
        │     }                                │
        └──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  3. Create Subscription              │
        │     POST /v1/subscriptions           │
        │     {                                │
        │       "customer": "cus_xxx",         │
        │       "items": [{"price": "price_id"}]│
        │     }                                │
        └──────────────────────────────────────┘
                           │
                           ▼ subscription_id
        ┌──────────────────────────────────────┐
        │  4. Store in Database                │
        │     INSERT INTO tenants              │
        │     (stripe_customer_id,             │
        │      stripe_subscription_id,         │
        │      subscription_status)            │
        └──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  5. Listen for Webhooks              │
        │     - subscription.updated           │
        │     - invoice.payment_succeeded      │
        │     - invoice.payment_failed         │
        └──────────────────────────────────────┘
```

## Data Export Flow

```
┌─────────────┐
│  User       │
│  Requests   │
│  Export     │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────────────┐
│  1. Create Export Record               │
│     INSERT INTO data_exports           │
│     (tenant_id, export_type, status)   │
│     VALUES (..., 'pending')            │
└────────────────────────────────────────┘
       │
       ▼ export_id
┌────────────────────────────────────────┐
│  2. Queue Background Job               │
│     processExport(export_id)           │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  3. Update Status to 'processing'      │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  4. Query Tenant Data                  │
│     SELECT * FROM orders               │
│     WHERE tenant_id = ...              │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  5. Generate Files                     │
│     - JSON format                      │
│     - CSV format                       │
│     - SQL format                       │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  6. Upload to S3                       │
│     PUT /exports/tenant-id/file.zip    │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  7. Update Export Record               │
│     UPDATE data_exports                │
│     SET status = 'completed',          │
│         file_url = 's3://...',         │
│         expires_at = NOW() + 7 days    │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  8. Send Email Notification            │
│     "Your export is ready!"            │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  9. User Downloads File                │
│     GET file_url (presigned)           │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  10. Auto-Delete After 7 Days          │
│      (Cron job)                        │
└────────────────────────────────────────┘
```

## Scaling Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    HORIZONTAL SCALING                           │
└────────────────────────────────────────────────────────────────┘

                     ┌─────────────────┐
                     │  Load Balancer  │
                     │  (Round Robin)  │
                     └────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │ API Instance │ │ API Instance │ │ API Instance │
      │      1       │ │      2       │ │      3       │
      └──────────────┘ └──────────────┘ └──────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │  PostgreSQL  │ │    Redis     │ │     S3       │
      │    Master    │ │   Cluster    │ │   Storage    │
      │              │ │              │ │              │
      │  ┌────────┐  │ │  ┌────────┐  │ │  ┌────────┐  │
      │  │ Read   │  │ │  │ Master │  │ │  │ CDN    │  │
      │  │Replica │  │ │  │        │  │ │  │        │  │
      │  └────────┘  │ │  │Replicas│  │ │  └────────┘  │
      │  ┌────────┐  │ │  └────────┘  │ │              │
      │  │ Read   │  │ │              │ │              │
      │  │Replica │  │ │              │ │              │
      │  └────────┘  │ │              │ │              │
      └──────────────┘ └──────────────┘ └──────────────┘
```

This comprehensive architecture ensures high availability, scalability, security, and performance for a multi-tenant SaaS platform.
