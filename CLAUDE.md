# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mitch Hospitality SaaS is a multi-tenant hospitality AI platform for restaurants and street food vendors. It uses PostgreSQL Row-Level Security (RLS) for tenant isolation, with JWT tokens containing `tenant_id` claims.

**Key Technologies:**
- **Backend**: Express.js 4.18, TypeScript 5.3
- **Database**: PostgreSQL 16 with RLS, Redis 7 for caching
- **AI**: Multi-provider system (OpenAI, Claude, Perplexity, LM Studio, Ollama)
- **Payments**: Stripe (subscriptions, webhooks, customer portal)
- **Vector DB**: Qdrant for RAG features
- **Workflow**: n8n for automation

## Development Commands

```bash
# Start infrastructure (PostgreSQL, Redis, Qdrant, n8n)
docker-compose up -d

# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run database migrations
npm run db:migrate

# Run tests
npm test
npm test:watch           # Watch mode for TDD
npm test:coverage        # With coverage report

# Lint and type check
npm run lint
npm run typecheck        # TypeScript validation without emit

# Seed demo data
npm run db:seed
npm run db:seed-reviews  # Seed review data specifically
```

## Architecture

### Multi-Tenant Data Flow

1. JWT token contains `tenant_id` claim (7-day expiration)
2. `TenantMiddleware` extracts tenant context, validates against database (60s Redis cache)
3. PostgreSQL RLS policy filters all queries: `tenant_id = current_setting('app.current_tenant_id')::uuid`
4. `RateLimitMiddleware` enforces per-tenant limits based on pricing tier

### Request Flow Pattern

```
Request → RequestId → Helmet/CORS → TenantMiddleware → RateLimitMiddleware → validate() → Controller → Service → Database
```

Controllers handle HTTP concerns, Services contain business logic. Services are in `src/services/tenant/`.

### Project Structure

```
src/
├── server.ts                      # Express entry point with Stripe webhooks
├── middleware/
│   ├── tenant.middleware.ts       # JWT validation, tenant context, feature gates
│   ├── rateLimit.middleware.ts    # 3-tier rate limiting with Redis sliding window
│   ├── validate.middleware.ts     # Zod schema validation
│   ├── error.middleware.ts        # AppError class, global error handler
│   └── requestId.middleware.ts    # UUID generation for distributed tracing
├── routes/
│   └── api.routes.ts              # All API endpoints (60+ routes)
├── controllers/                   # HTTP layer (6 controllers)
├── validators/                    # Zod schemas (6 files)
├── services/
│   ├── logger.service.ts          # Structured JSON logging
│   ├── notifications/
│   │   └── email.service.ts       # SendGrid email templates
│   ├── integrations/
│   │   └── google-business.service.ts
│   └── tenant/                    # All business logic services
│       ├── auth.service.ts        # Login with account locking
│       ├── tenant.service.ts      # Tenant profile management
│       ├── tenant-onboarding.service.ts
│       ├── menu.service.ts        # Menu CRUD
│       ├── menu-ai.service.ts     # AI descriptions, translations
│       ├── order.service.ts       # Order processing
│       ├── reservation.service.ts # Reservations
│       ├── chatbot.service.ts     # Multi-channel AI chat
│       ├── review-ai.service.ts   # Sentiment analysis, AI responses
│       ├── voice-ai.service.ts    # Speech-to-text, TTS (Enterprise)
│       ├── qr.service.ts          # QR code generation
│       ├── loyalty.service.ts     # MitchCoin blockchain loyalty
│       ├── billing.service.ts     # Stripe subscriptions
│       ├── whitelabel.service.ts  # Custom branding, domains
│       ├── data-export.service.ts # GDPR exports
│       ├── upsell.service.ts      # Smart recommendations
│       ├── email.service.ts       # Tenant notifications
│       ├── location.service.ts    # Location management
│       └── ai/                    # AI Provider System
│           ├── types.ts           # Interfaces & model configs
│           ├── base.provider.ts   # Abstract provider class
│           ├── router.ts          # Priority routing, fallback, cost tracking
│           ├── openai.provider.ts
│           ├── claude.provider.ts
│           ├── perplexity.provider.ts
│           ├── lmstudio.provider.ts
│           └── ollama.provider.ts
└── tests/
    ├── setup.ts                   # Jest global mocks
    ├── middleware/
    ├── services/
    ├── validators/
    └── integration/
```

### Key Files

- `src/server.ts` - Express application entry point with Stripe webhook handlers
- `src/routes/api.routes.ts` - All API endpoints, split into public (health, onboard, login) and protected routes
- `src/middleware/tenant.middleware.ts` - JWT validation and tenant context setup
- `src/middleware/rateLimit.middleware.ts` - Tier-based rate limiting with Redis
- `src/middleware/validate.middleware.ts` - Zod schema validation
- `src/middleware/error.middleware.ts` - AppError class, dev vs prod error responses
- `database/schema.sql` - PostgreSQL schema with RLS policies

## Services

### Tenant Services (`src/services/tenant/`)

| Service | Purpose |
|---------|---------|
| `auth.service.ts` | Login with account locking (5 attempts → 15min lock), JWT generation, IP tracking |
| `tenant.service.ts` | Tenant profile management, settings |
| `tenant-onboarding.service.ts` | Stripe customer creation, subscription setup, admin user |
| `menu.service.ts` | Menu item CRUD with soft-delete |
| `menu-ai.service.ts` | AI descriptions, allergen detection, price suggestions, translations |
| `order.service.ts` | Order creation, status tracking |
| `reservation.service.ts` | Reservation management with date filtering |
| `chatbot.service.ts` | Multi-channel chat (web, WhatsApp, voice, SMS), sentiment analysis |
| `review-ai.service.ts` | Sentiment analysis, AI response generation, review insights |
| `voice-ai.service.ts` | Whisper STT, TTS, phone/WhatsApp voice (Enterprise tier) |
| `qr.service.ts` | QR code generation, table ordering sessions |
| `loyalty.service.ts` | MitchCoin blockchain, tiered membership (bronze/silver/gold/platinum) |
| `billing.service.ts` | Stripe subscriptions, customer portal, usage tracking |
| `whitelabel.service.ts` | Theme config, custom domains, logo upload, email templates |
| `data-export.service.ts` | GDPR exports (JSON/CSV/SQL), S3 storage, 7-day expiry |
| `upsell.service.ts` | Time/weather/history-based recommendations |
| `email.service.ts` | SendGrid templates (welcome, order, reservation, review) |
| `location.service.ts` | Location CRUD, multi-location support |

### AI Provider System

Multi-provider AI system in `src/services/tenant/ai/`:

| Provider | Models | Use Case |
|----------|--------|----------|
| `openai` | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo | General, code |
| `claude` | claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus | Creative writing, reasoning |
| `perplexity` | llama-3.1-sonar (small/large/huge) | Research, real-time info |
| `lm_studio` | Local models | Privacy, cost-sensitive |
| `ollama` | llama3.2, mistral, etc. | Privacy, open-source |

**Router Features:**
- Priority-based provider selection
- Automatic fallback on failure (up to 3 retries)
- Per-tenant cost tracking in `ai_usage` table
- Task-type routing (creative→claude, research→perplexity, cost-sensitive→local)
- Health monitoring for all providers

### Validators

Zod schemas in `src/validators/`:

| Validator | Schemas |
|-----------|---------|
| `auth.validator.ts` | login, register, resetPassword |
| `ai.validator.ts` | chatMessage, menuEnhance, recommendations, reviewResponse, createReview |
| `menu.validator.ts` | createCategory, updateCategory, createMenuItem, updateMenuItem |
| `order.validator.ts` | createOrder |
| `reservation.validator.ts` | createReservation |
| `tenant.validator.ts` | updateTenant, createLocation, updateLocation |

## API Endpoints

### Public Routes (No Auth)
```
GET  /health                    - Health check (DB + Redis status)
POST /onboard                   - Tenant signup with Stripe
GET  /onboarding/check-slug     - Slug availability check
POST /auth/login                - Email/password login
```

### Protected Routes (Auth Required)
```
# Auth
GET  /auth/me                   - Current user + tenant info

# Dashboard
GET  /dashboard/stats           - Revenue, orders, customers, AI usage
GET  /dashboard/revenue         - Revenue chart by day

# Tenant
GET  /tenant                    - Current tenant profile
PATCH /tenant                   - Update tenant settings
POST /tenant/export             - Request GDPR data export
GET  /tenant/export/:exportId   - Check export status

# Locations
GET  /locations                 - List locations
POST /locations                 - Create location

# Menu
GET  /menu                      - List menu items
POST /menu                      - Create menu item
POST /menu/:id/ai-enhance       - AI description, allergens, pricing

# Orders
GET  /orders                    - List orders (with status filter)
POST /orders                    - Create order

# Reservations
GET  /reservations              - List reservations (with date filter)
POST /reservations              - Create reservation

# Chat
GET  /chat/sessions             - List chat sessions
GET  /chat/sessions/:id/messages - Get conversation messages
POST /chat                      - Process chat message

# Recommendations
GET  /recommendations           - Get AI upsell suggestions

# Reviews
GET  /reviews                   - List reviews (with sentiment filter)
POST /reviews                   - Create/import review
POST /reviews/:id/ai-respond    - Generate AI response
GET  /reviews/insights          - Sentiment breakdown, trends

# Billing
GET  /billing                   - Current billing info & usage
GET  /billing/tiers             - Available pricing tiers
POST /billing/checkout          - Create Stripe checkout
POST /billing/portal            - Create Stripe portal session

# Notifications
GET  /notifications/preferences  - Email preferences
PATCH /notifications/preferences - Update preferences

# Integrations
GET  /integrations/google-business/status
POST /integrations/google-business/connect
POST /integrations/google-business/sync

# Onboarding Wizard
GET  /onboarding/status         - Check wizard progress
POST /onboarding/complete       - Mark onboarding complete
```

## Pricing Tiers

Three tiers defined in `pricing_tiers` table:

| Tier | Price | Locations | Users | API Calls | Rate Limit | Features |
|------|-------|-----------|-------|-----------|------------|----------|
| **Starter** | $49/mo | 1 | 5 | 10K/mo | 100/min | menu_ai |
| **Professional** | $149/mo | 5 | 20 | 50K/mo | 500/min | + social_media, blockchain |
| **Enterprise** | $499/mo | Unlimited | Unlimited | 500K/mo | 2000/min | + voice_ai |

## Database

### Core Tables (with RLS)

**Data Tables (soft-delete with `deleted_at`):**
- `tenants` - Business accounts with subscription status
- `tenant_users` - Staff with roles (owner/admin/manager/staff), login tracking
- `locations` - Physical locations per tenant
- `menu_items` - Menu with AI descriptions, allergens (JSONB)
- `menu_categories` - Category organization
- `customers` - Customer profiles with preferences
- `tables` - Physical tables for QR ordering
- `loyalty_accounts` - MitchCoin wallets, tier status
- `ai_provider_config` - Per-tenant AI settings

**Audit Tables (no soft-delete):**
- `orders` - Order records with source tracking
- `order_items` - Line items with modifiers
- `reservations` - Booking records
- `chat_conversations` - Session management, sentiment
- `chat_messages` - Message history with provider/model tracking
- `reviews` - Platform reviews with sentiment
- `ai_usage` - Token/cost tracking per provider
- `audit_logs` - Full audit trail
- `data_exports` - GDPR export requests
- `subscription_history` - Billing events

### Migrations

Located in `database/migrations/`:
- `001_add_soft_delete_to_rls.sql` - Soft-delete support & RLS policy updates
- `002_onboarding_columns.sql` - Onboarding wizard columns

## Environment Variables

### Required
```bash
DATABASE_URL              # PostgreSQL connection string
REDIS_URL                 # Redis connection string
JWT_SECRET                # JWT signing secret
STRIPE_SECRET_KEY         # Stripe API key
STRIPE_WEBHOOK_SECRET     # Stripe webhook validation
```

### Optional - AI Providers
```bash
OPENAI_API_KEY            # OpenAI/GPT access
ANTHROPIC_API_KEY         # Claude API access
PERPLEXITY_API_KEY        # Perplexity/Sonar access
LM_STUDIO_URL             # Local LM Studio endpoint (default: http://localhost:1234/v1)
OLLAMA_URL                # Local Ollama endpoint (default: http://localhost:11434)
DEFAULT_AI_PROVIDER       # Default provider (openai)
AI_ENABLE_FALLBACK        # Automatic provider fallback (true)
LOCAL_AI_FIRST            # Prefer local providers (false)
ENABLE_LOCAL_AI           # Enable local AI providers (false)
```

### Optional - Services
```bash
PORT                      # Server port (default: 3000)
NODE_ENV                  # development/production
CORS_ORIGINS              # Comma-separated allowed origins
LOG_LEVEL                 # debug/info/warn/error
SENDGRID_API_KEY          # Email delivery
AWS_ACCESS_KEY_ID         # S3 for data exports
AWS_SECRET_ACCESS_KEY
AWS_REGION
S3_BUCKET
```

## Multi-Tenant Pattern

When adding new endpoints or tables:

1. Always include `tenant_id` column in new tables
2. Enable RLS: `ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;`
3. Create policy with soft-delete support (see below)
4. Protected routes automatically have `req.tenant` context with `tenantId`, `userId`, `userRole`, and `tier` info

### Soft-Delete Pattern

The database uses soft-delete for data tables (not audit/history tables). RLS policies automatically filter out soft-deleted records.

**For data tables** (users, locations, menu items, customers, etc.):
1. Include `deleted_at TIMESTAMPTZ` column
2. Create RLS policy with soft-delete filter:
   ```sql
   CREATE POLICY tenant_isolation ON new_table
   USING (tenant_id = current_setting('app.current_tenant_id')::uuid AND deleted_at IS NULL);
   ```
3. Add partial index for performance:
   ```sql
   CREATE INDEX idx_new_table_active ON new_table(tenant_id) WHERE deleted_at IS NULL;
   ```
4. To soft-delete: `UPDATE table SET deleted_at = NOW() WHERE id = $1`

**For audit/history tables** (orders, reservations, audit_logs, etc.):
- No `deleted_at` column - records should never be deleted
- RLS policy without soft-delete filter:
  ```sql
  CREATE POLICY tenant_isolation ON audit_table
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
  ```

**Tables with soft-delete:** `tenant_users`, `locations`, `menu_items`, `menu_categories`, `customers`, `tables`, `loyalty_accounts`, `ai_provider_config`

**Tables without soft-delete:** `orders`, `order_items`, `reservations`, `chat_conversations`, `chat_messages`, `ai_usage`, `reviews`, `audit_logs`, `data_exports`, `subscription_history`

## Error Handling

The `AppError` class in `src/middleware/error.middleware.ts` provides:
- Operational vs programming error distinction
- Development mode: full stack traces
- Production mode: sanitized error messages
- Specific handlers for JWT errors, duplicate fields, etc.
- All errors logged with request context and `requestId`

## Rate Limiting

Three-tier rate limiting in `src/middleware/rateLimit.middleware.ts`:

| Tier | Per-Minute | Monthly Cap |
|------|------------|-------------|
| Starter | 100 | 10,000 |
| Professional | 500 | 50,000 |
| Enterprise | 2,000 | 500,000 |

Plus IP-based DDoS protection: 1,000 req/min global limit.

Implementation uses Redis sorted set sliding window algorithm.

## Testing

Tests are in `src/tests/` using Jest. Run a single test file:
```bash
npm test -- src/tests/middleware/tenant.middleware.test.ts
```

Test structure:
- `setup.ts` - Global mocks for pg, ioredis
- `middleware/` - Tenant, rate limit tests
- `services/` - Service unit tests
- `validators/` - Schema validation tests
- `integration/` - End-to-end flow tests

## Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **postgres** | postgres:16-alpine | 5433→5432 | Multi-tenant database |
| **redis** | redis:7-alpine | 6380→6379 | Rate limiting & caching |
| **qdrant** | qdrant/qdrant | 6335→6333 | Vector DB for RAG |
| **n8n** | n8nio/n8n | 5679→5678 | Workflow automation |
| **grafana** | grafana/grafana | 3001→3000 | Monitoring (profile: monitoring) |

Start monitoring stack: `docker-compose --profile monitoring up -d`

## Authentication

- JWT tokens with 7-day expiration
- Account locking after 5 failed attempts (15-minute lockout)
- Last login IP and timestamp tracking
- Roles: `owner`, `admin`, `manager`, `staff`

## Key Patterns

### Adding a New AI Provider
1. Create `src/services/tenant/ai/newprovider.provider.ts` extending `BaseAIProvider`
2. Implement `complete()`, `stream()`, `healthCheck()`, `calculateCost()`
3. Register in `router.ts` with priority and config
4. Add models to `PROVIDER_MODELS` in `types.ts`

### Adding a New Feature Gate
1. Add feature flag to `pricing_tiers.features` JSONB
2. Check in middleware: `req.tenant.tier.features.new_feature`
3. Return 403 if not available for tier

### Creating New Endpoints
1. Add Zod schema in `src/validators/`
2. Create controller method or inline handler
3. Add route in `api.routes.ts` with `validate(schema)`
4. Ensure RLS-enabled table access
