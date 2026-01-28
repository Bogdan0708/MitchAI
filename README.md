# 🦇 Mitch AI Suite - Hospitality SaaS Platform

<div align="center">

![Mitch AI Suite](https://img.shields.io/badge/Mitch-AI%20Suite-red?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyeiIvPjwvc3ZnPg==)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-22-green?style=for-the-badge&logo=node.js)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)

**Enterprise-grade multi-tenant hospitality platform with AI-powered operations**

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [API](#-api-documentation) • [Modules](#-modules)

</div>

---

## 🎯 Overview

Mitch AI Suite is a comprehensive SaaS platform designed for the modern hospitality industry. From street food vendors to luxury restaurants, our platform provides AI-powered tools to streamline operations, enhance customer experience, and drive growth.

### Who Is This For?

- 🍔 **Street Food Vendors** - Quick-service operations with QR ordering
- 🍽️ **Restaurants** - Full-service dining with reservations and reviews
- 🏨 **Hotels** - Multi-location management and compliance
- 🍺 **Bars & Pubs** - Inventory and event management
- ☕ **Cafés** - Menu optimization and loyalty programs

---

## ✨ Features

### 🤖 AI-Powered Operations

| Feature | Description |
|---------|-------------|
| **AI Review Responder** | Generate professional responses to customer reviews across all platforms |
| **Menu Description Generator** | Create appetizing descriptions with style customization |
| **Content Generator** | Social posts, emails, promotions with platform-specific formatting |
| **Sentiment Analysis** | Bulk analysis of customer feedback with trend detection |
| **Smart Chatbot** | 24/7 customer service with context-aware responses |
| **Predictive Analytics** | Demand forecasting and inventory optimization |

### 📊 Business Intelligence

- **Real-time Dashboard** - KPIs, revenue tracking, order analytics
- **Review Aggregation** - Google, TripAdvisor, Yelp, Deliveroo, Uber Eats
- **Competitor Insights** - Market positioning and benchmarking
- **Custom Reports** - Exportable analytics with scheduled delivery

### 🔒 Enterprise Security

- **Multi-tenant Architecture** - Complete data isolation with Row-Level Security
- **Role-Based Access Control** - Granular permissions per location/user
- **SOC 2 Compliant** - Enterprise-grade security standards
- **GDPR Ready** - Data export, deletion, and consent management

### 💰 Blockchain Integration (Mitch Coin)

- **Loyalty Points** - Earn/redeem on Mitch Chain (Cosmos SDK)
- **AI Credits** - Pay-per-use model with credit packages
- **Wallet Integration** - Custodial and connected wallet support
- **On-chain Transparency** - Verifiable transaction history

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MITCH AI SUITE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Next.js   │  │   Mobile    │  │  QR Order   │  │   Widget    │        │
│  │  Dashboard  │  │    Apps     │  │    PWA      │  │   Embed     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
│                          ┌───────▼───────┐                                  │
│                          │   API Gateway  │                                  │
│                          │  (Express.js)  │                                  │
│                          └───────┬───────┘                                  │
│                                  │                                           │
│    ┌─────────────────────────────┼─────────────────────────────┐            │
│    │                             │                              │            │
│    ▼                             ▼                              ▼            │
│  ┌─────────────┐       ┌─────────────────┐           ┌─────────────┐        │
│  │   Core API  │       │ AI Orchestrator │           │  Blockchain │        │
│  │  Services   │       │                 │           │   Client    │        │
│  │             │       │ ┌─────────────┐ │           │             │        │
│  │ • Auth      │       │ │   OpenAI    │ │           │ • Loyalty   │        │
│  │ • Tenants   │       │ │  Anthropic  │ │           │ • Credits   │        │
│  │ • Menu      │       │ │   Google    │ │           │ • Wallet    │        │
│  │ • Orders    │       │ │   Local LLM │ │           │             │        │
│  │ • Reviews   │       │ └─────────────┘ │           └──────┬──────┘        │
│  │ • Content   │       └────────┬────────┘                  │               │
│  │ • Analytics │                │                           │               │
│  └──────┬──────┘                │                           │               │
│         │                       │                           │               │
│    ┌────┴────────────────┬──────┴───────────────────────────┘               │
│    │                     │                                                   │
│    ▼                     ▼                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ PostgreSQL  │  │    Redis    │  │   Qdrant    │  │ Mitch Chain │        │
│  │   16 + RLS  │  │    Cache    │  │  Vector DB  │  │  (Cosmos)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14, React 18, Tailwind CSS | Dashboard & PWA |
| **API** | Node.js 22, Express.js, TypeScript | REST API |
| **Database** | PostgreSQL 16 | Primary data store with RLS |
| **Cache** | Redis 7 | Session, rate limiting, queues |
| **Vector DB** | Qdrant | RAG & semantic search |
| **AI** | OpenAI, Anthropic, Google, Local LLM | Multi-provider orchestration |
| **Blockchain** | Cosmos SDK (Mitch Chain) | Loyalty & credits |
| **Queue** | BullMQ | Background job processing |
| **Monitoring** | Grafana, Prometheus | Observability |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hospitality-saas.git
cd hospitality-saas

# Copy environment configuration
cp .env.example .env
# Edit .env with your API keys and settings

# Start infrastructure services
docker-compose up -d

# Install backend dependencies
npm install

# Run database migrations
npm run db:migrate

# Seed demo data (optional)
npm run db:seed

# Start the development server
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Access the dashboard at `http://localhost:3001`

---

## 📚 API Documentation

### Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://api.mitch.ai/v1
```

### Authentication

All authenticated endpoints require a Bearer token:

```bash
curl -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     https://api.mitch.ai/v1/...
```

### Key Endpoints

#### AI Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/ai/health` | Check AI provider status |
| `GET` | `/ai/models` | List available models |
| `POST` | `/ai/review-response` | Generate review response |
| `POST` | `/ai/menu-description` | Generate menu description |
| `POST` | `/ai/content` | Generate marketing content |
| `POST` | `/ai/sentiment` | Analyze sentiment (batch) |
| `POST` | `/ai/translate` | Translate with context |
| `POST` | `/ai/chat` | General assistant |
| `GET` | `/ai/usage` | Usage statistics |

#### Core Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Authenticate user |
| `POST` | `/auth/register` | Register tenant |
| `GET` | `/menu/items` | List menu items |
| `POST` | `/orders` | Create order |
| `GET` | `/reviews` | List reviews |
| `GET` | `/analytics` | Dashboard analytics |

---

## 📦 Modules

### Guest Whisperer (Reviews)
Aggregate and respond to reviews from all major platforms with AI-powered response generation.

### Menu Maestro
AI-enhanced menu management with description generation, pricing optimization, and allergen tracking.

### Order Flow
End-to-end order management with QR ordering, kitchen display, and delivery integration.

### Compliance Guardian
HACCP compliance, temperature logging, equipment maintenance, and audit trails.

### Content Studio
Social media scheduling, campaign management, and AI content generation.

### Business Intelligence
Real-time analytics, predictive insights, and automated alerts.

---

## 💳 Pricing Tiers

| Feature | Starter | Professional | Enterprise |
|---------|:-------:|:------------:|:----------:|
| **Price** | $49/mo | $149/mo | $499/mo |
| **Locations** | 1 | 5 | Unlimited |
| **Users** | 5 | 20 | Unlimited |
| **API Calls** | 10,000 | 50,000 | 500,000 |
| **AI Credits** | 1,000 | 5,000 | 25,000 |
| **Review Platforms** | 2 | All | All |
| **Support** | Email | Priority | Dedicated |
| **Custom Branding** | ❌ | ✅ | ✅ |
| **API Access** | ❌ | ✅ | ✅ |
| **SLA** | ❌ | 99.5% | 99.9% |

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx jest src/tests/services/mtc-client.test.ts

# Watch mode
npm run test:watch
```

### Test Coverage

- **MTC Client**: 40 tests (blockchain operations)
- **AI Orchestrator**: 27 tests (multi-provider routing)
- **Services**: 96+ tests total

---

## 🔧 Development

### Project Structure

```
hospitality-saas/
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   │   ├── ai/          # AI orchestration
│   │   ├── blockchain/  # MTC client
│   │   └── tenant/      # Tenant services
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── validators/      # Request validation (Zod)
│   ├── lib/             # Utilities
│   └── tests/           # Test suites
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js pages
│   │   ├── components/  # React components
│   │   └── lib/         # Frontend utilities
├── database/
│   ├── migrations/      # SQL migrations
│   ├── seeds/           # Demo data
│   └── schema.sql       # Full schema
├── infrastructure/      # Deployment configs
└── docs/                # Documentation
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/hospitality

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Blockchain
MTC_RPC_URL=http://localhost:26657
MTC_REST_URL=http://localhost:1317
MTC_CHAIN_ID=mitch-1

# External Services
STRIPE_SECRET_KEY=sk_...
SENDGRID_API_KEY=SG...
```

---

## 🤝 Contributing

This is a proprietary project. For partnership inquiries, contact the team.

---

## 📄 License

**Proprietary** - © 2024-2025 Mitch from Transylvania Ltd.

All rights reserved. Unauthorized copying, modification, or distribution is prohibited.

---

<div align="center">

**Built with 🦇 in London**

Part of the Mitch AI Suite Ecosystem

</div>
