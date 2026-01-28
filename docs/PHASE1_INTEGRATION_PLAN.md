# Phase 1 Integration Plan
## Mitch Hospitality SaaS + AI Platform + MTC Blockchain

**Date:** 2026-01-28
**Status:** Planning

---

## Executive Summary

Phase 1 unifies three core components of the Mitch ecosystem:

1. **hospitality-saas** (current workspace) — Customer-facing SaaS platform
2. **mitch-ai-platform** — AI orchestration layer with specialized agents
3. **mitch-chain (MTC)** — Layer-1 blockchain for loyalty & AI credits

---

## Current State Analysis

### hospitality-saas (This Workspace)

**Tech Stack:** Node.js, TypeScript, Express, PostgreSQL, Redis

**Existing Features:**
- Multi-tenant architecture ✅
- Menu management (CRUD + AI suggestions) ✅
- Order system ✅
- Reservation system ✅
- Review management + AI analysis ✅
- QR code generation ✅
- Loyalty system (basic) ⚠️
- AI services (Anthropic, OpenAI) ✅
- Billing (Stripe) ✅
- Email service ✅
- Data export ✅
- Compliance tracking ✅
- Content generation ✅
- Intelligence dashboard ✅
- Chatbot service ✅

**Missing/Needs Enhancement:**
- Blockchain integration ❌
- AI orchestration layer ❌
- Social media automation ❌
- Advanced analytics ⚠️
- Voice AI integration ⚠️

### mitch-ai-platform

**Tech Stack:** Python, agno/crewai, TypeScript (monorepo)

**Valuable Components:**
- `ai-suite-core/` — AI orchestration with teams:
  - JournalistTeam (content generation)
  - FinanceTeam (financial analysis)
  - HealthTeam (nutrition, fitness)
  - ResearchTeam (web research)
  - Orchestrator (routing, registry)
- `hospitality-api/` — Same codebase as hospitality-saas
- `shared-ai/` — Reusable AI components
- `shared-tools/` — Utilities

### mitch-chain (MTC)

**Tech Stack:** Go, Cosmos SDK v0.52, CosmWasm

**Key Features:**
- Native cryptocurrency: **MTC** (1 MTC = 1,000,000 uMTC)
- **Loyalty Rewards System:**
  - Point earning from purchases
  - Tiers: Bronze → Silver → Gold → Platinum
  - Point transfers, redemptions
  - Leaderboard queries
- **AI Credits System:**
  - Credit packages (starter, professional, enterprise)
  - Per-service pricing (GPT-4, Claude, etc.)
  - Usage tracking, rate limiting
  - Bonus credits on purchase

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MITCH ECOSYSTEM                                  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    CUSTOMER INTERFACES                            │  │
│  │                                                                   │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐  │  │
│  │  │ Web App │  │Mobile   │  │ QR Menu │  │ Chatbot / Voice AI  │  │  │
│  │  │(Next.js)│  │(Future) │  │ Ordering│  │                     │  │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └──────────┬──────────┘  │  │
│  └───────┼────────────┼────────────┼────────────────────┼───────────┘  │
│          │            │            │                    │              │
│          └────────────┴────────────┴────────────────────┘              │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    HOSPITALITY-SAAS API                           │  │
│  │                    (Express + TypeScript)                         │  │
│  │                                                                   │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│  │  │  Menu   │  │ Orders  │  │ Reviews │  │ Loyalty │  │ Billing │ │  │
│  │  │ Service │  │ Service │  │ Service │  │ Service │  │ Service │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └────┬────┘  └─────────┘ │  │
│  │                                              │                    │  │
│  └──────────────────────────────────────────────┼────────────────────┘  │
│                                                 │                       │
│                   ┌─────────────────────────────┘                       │
│                   │                                                     │
│                   ▼                                                     │
│  ┌────────────────────────────┐    ┌────────────────────────────────┐  │
│  │      AI ORCHESTRATION      │    │       MITCH-CHAIN (MTC)        │  │
│  │    (mitch-ai-platform)     │    │      (Cosmos SDK L1)           │  │
│  │                            │    │                                │  │
│  │  ┌──────────────────────┐  │    │  ┌──────────────────────────┐  │  │
│  │  │  Main Orchestrator   │  │    │  │   Loyalty Module         │  │  │
│  │  │  (Router + Registry) │  │    │  │   - Points / Tiers       │  │  │
│  │  └──────────────────────┘  │    │  │   - Redemptions          │  │  │
│  │                            │    │  └──────────────────────────┘  │  │
│  │  ┌────────┐ ┌────────────┐ │    │                                │  │
│  │  │Content │ │ Research   │ │    │  ┌──────────────────────────┐  │  │
│  │  │ Team   │ │   Team     │ │    │  │   AI Credits Module      │  │  │
│  │  └────────┘ └────────────┘ │    │  │   - Packages / Usage     │  │  │
│  │                            │    │  │   - Rate Limiting        │  │  │
│  │  ┌────────┐ ┌────────────┐ │    │  └──────────────────────────┘  │  │
│  │  │Finance │ │  Social    │ │    │                                │  │
│  │  │ Team   │ │   Team     │ │    │  Native Token: MTC             │  │
│  │  └────────┘ └────────────┘ │    │  1 MTC = 1,000,000 uMTC        │  │
│  │                            │    │                                │  │
│  └────────────────────────────┘    └────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 Tasks

### Task 1.1: Align hospitality-saas with mitch-ai-platform

**Objective:** Ensure hospitality-saas can be imported as a package in the monorepo

**Steps:**
1. Update package.json to use workspace-compatible naming
2. Extract shared types to `@mitch/shared-types`
3. Create API client package for frontend consumption
4. Align database schema with shared-tools conventions

**Files to modify:**
- `package.json` — Update name to `@mitch/hospitality-api`
- `src/types/` — Create and export shared types
- `src/lib/` — Standardize utility functions

### Task 1.2: Create Loyalty Service Bridge to MTC

**Objective:** Connect existing loyalty.service.ts to mitch-chain

**New Files:**
```
src/services/blockchain/
├── mtc-client.ts        # Cosmos SDK client wrapper
├── loyalty-bridge.ts    # Bridge between existing loyalty and chain
└── credits-bridge.ts    # AI credits tracking
```

**Integration Points:**
```typescript
// mtc-client.ts
export class MTCClient {
  constructor(rpcUrl: string, chainId: string) {}
  
  // Loyalty operations
  async getLoyaltyAccount(address: string): Promise<LoyaltyAccount>
  async earnPoints(address: string, amount: number, action: string): Promise<TxResult>
  async redeemPoints(address: string, amount: number, reward: string): Promise<TxResult>
  
  // AI Credits operations
  async purchaseCredits(address: string, package: CreditPackage): Promise<TxResult>
  async useCredits(address: string, service: AIService, amount: number): Promise<TxResult>
  async getCreditBalance(address: string): Promise<CreditBalance>
}
```

### Task 1.3: Implement AI Orchestration Bridge

**Objective:** Allow hospitality-saas to call mitch-ai-platform agents

**Options:**
1. **HTTP Bridge** — AI platform exposes REST/gRPC endpoints
2. **Direct Import** — Compile Python to WebAssembly (complex)
3. **Message Queue** — Redis/RabbitMQ for async tasks

**Recommended: HTTP Bridge**

```typescript
// src/services/ai/orchestrator-client.ts
export class AIOrchestrator {
  constructor(baseUrl: string) {}
  
  async generateContent(prompt: string, team: 'journalist' | 'research'): Promise<ContentResult>
  async analyzeFinance(data: FinanceInput): Promise<FinanceAnalysis>
  async route(query: string): Promise<RoutingDecision>
}
```

---

## Immediate Action Items

### Today (Priority 1)
1. ☐ Create `@mitch/shared-types` package
2. ☐ Update hospitality-saas package.json for monorepo compatibility
3. ☐ Design MTC client interface (TypeScript types)

### This Week (Priority 2)
4. ☐ Implement basic MTCClient with mock responses
5. ☐ Create loyalty-bridge.ts connecting existing service to MTCClient
6. ☐ Write integration tests for blockchain bridge

### Next Week (Priority 3)
7. ☐ Set up AI orchestration HTTP server in mitch-ai-platform
8. ☐ Create AIOrchestrator client in hospitality-saas
9. ☐ Test end-to-end flow: Order → Loyalty Points → MTC Chain

---

## Database Schema Updates

### New Tables for MTC Integration

```sql
-- Wallet addresses linked to tenants/customers
CREATE TABLE IF NOT EXISTS wallet_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID REFERENCES customers(id),
  chain_address VARCHAR(100) NOT NULL UNIQUE,  -- mitch1...
  wallet_type VARCHAR(50) NOT NULL,  -- 'custodial' | 'connected'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cached blockchain state (avoid excessive RPC calls)
CREATE TABLE IF NOT EXISTS mtc_loyalty_cache (
  wallet_address VARCHAR(100) PRIMARY KEY,
  points BIGINT NOT NULL DEFAULT 0,
  tier VARCHAR(50) NOT NULL DEFAULT 'bronze',
  lifetime_points BIGINT NOT NULL DEFAULT 0,
  last_synced TIMESTAMP DEFAULT NOW()
);

-- AI credit usage tracking (for billing/analytics)
CREATE TABLE IF NOT EXISTS ai_credit_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  service VARCHAR(50) NOT NULL,  -- 'gpt4', 'claude', etc.
  credits_used INT NOT NULL,
  tx_hash VARCHAR(100),  -- blockchain tx if applicable
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Environment Variables (New)

```env
# MTC Blockchain
MTC_RPC_URL=http://localhost:26657
MTC_REST_URL=http://localhost:1317
MTC_CHAIN_ID=mitch-1
MTC_DENOM=uMTC

# AI Orchestration
AI_ORCHESTRATOR_URL=http://localhost:8080
AI_ORCHESTRATOR_API_KEY=secret

# Feature Flags
FEATURE_MTC_LOYALTY=false
FEATURE_AI_ORCHESTRATOR=false
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Loyalty points on-chain | 100% of new points | Chain queries vs DB |
| AI credit tracking | <500ms latency | P95 response time |
| Order → Points flow | <2s end-to-end | Integration tests |
| Zero data loss | 0 missed transactions | Reconciliation job |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Chain downtime | Points not recorded | Queue + retry with local cache |
| High gas fees | Cost overrun | Batch transactions, off-peak scheduling |
| Complex wallet UX | User friction | Custodial wallets for simple mode |
| AI orchestrator latency | Slow features | Async processing, caching |

---

## Next Steps After Phase 1

**Phase 2:**
- Integrate MCP servers for enhanced AI tools
- Merge hospitality-assistant best components
- Set up Gmail automation for customer comms

**Phase 3:**
- AIRS code quality automation
- NPU acceleration for local AI
- Review dashboard deployment

---

*Document maintained by Grumpy 😏*
*Last updated: 2026-01-28*
