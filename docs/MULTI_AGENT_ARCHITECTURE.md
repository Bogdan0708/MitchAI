# Multi-Agent Architecture for Mitch Hospitality SaaS

## Overview

Adaptation of OpenClaw's Heroku Multi-Agent SaaS pattern for the Mitch hospitality platform. Each restaurant tenant gets an isolated AI agent that can handle customer support, reservations, and automated responses.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MITCH HOSPITALITY SAAS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Restaurant A   │  │   Restaurant B   │  │   Restaurant C   │  │
│  │                  │  │                  │  │                  │  │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │  │
│  │  │  AI Agent  │  │  │  │  AI Agent  │  │  │  │  AI Agent  │  │  │
│  │  │  (Claude)  │  │  │  │ (Local LLM)│  │  │  │  (GPT-4)   │  │  │
│  │  └─────┬──────┘  │  │  └─────┬──────┘  │  │  └─────┬──────┘  │  │
│  │        │         │  │        │         │  │        │         │  │
│  │  ┌─────┴──────┐  │  │  ┌─────┴──────┐  │  │  ┌─────┴──────┐  │  │
│  │  │  Telegram  │  │  │  │  WhatsApp  │  │  │  │  Telegram  │  │  │
│  │  │    Bot     │  │  │  │    Bot     │  │  │  │    Bot     │  │  │
│  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      SHARED SERVICES                           │ │
│  │                                                                │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │ │
│  │  │   Agent    │  │  Credential│  │   AI       │  │  Menu &  │ │ │
│  │  │  Manager   │  │   Vault    │  │ Orchestrator│  │  Orders  │ │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                       DATABASE LAYER                           │ │
│  │                                                                │ │
│  │  PostgreSQL (RLS)  │  Redis (Sessions)  │  S3 (Assets)        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema Additions

### tenant_agents table
```sql
CREATE TABLE tenant_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Agent configuration
    name VARCHAR(255) NOT NULL DEFAULT 'Restaurant Assistant',
    system_prompt TEXT,
    model_preference VARCHAR(100) DEFAULT 'local', -- local, anthropic, openai
    
    -- Channel configuration
    telegram_bot_token_encrypted BYTEA,
    telegram_bot_username VARCHAR(255),
    whatsapp_phone_id_encrypted BYTEA,
    
    -- Limits
    daily_message_limit INTEGER DEFAULT 100,
    monthly_token_limit INTEGER DEFAULT 100000,
    
    -- Status
    status VARCHAR(50) DEFAULT 'inactive', -- inactive, active, paused
    last_active_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- RLS Policy
ALTER TABLE tenant_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_agents_isolation ON tenant_agents
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### agent_conversations table
```sql
CREATE TABLE agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES tenant_agents(id) ON DELETE CASCADE,
    
    -- Conversation context
    channel VARCHAR(50) NOT NULL, -- telegram, whatsapp
    external_chat_id VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    
    -- State
    context JSONB DEFAULT '{}',
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(agent_id, channel, external_chat_id)
);
```

## Agent Capabilities

### Tier 1: Basic (Free Plan)
- Respond to FAQs (opening hours, location, menu)
- Forward complex queries to staff
- 100 messages/day

### Tier 2: Professional
- Handle reservations
- Process simple orders
- Review responses
- 1,000 messages/day

### Tier 3: Enterprise
- Full order management
- Loyalty program integration
- Multi-language support
- Custom training data
- Unlimited messages

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
1. Add `tenant_agents` table with RLS
2. Create `AgentService` for CRUD operations
3. Integrate with existing AI orchestrator
4. Add agent configuration UI

### Phase 2: Channels (Week 3-4)
1. Telegram bot per tenant (webhook routing)
2. WhatsApp Business API integration
3. Message routing to correct tenant agent
4. Conversation context management

### Phase 3: Intelligence (Week 5-6)
1. Restaurant-specific prompt templates
2. Menu knowledge injection
3. Reservation slot checking
4. Order creation flow

### Phase 4: Self-Healing (Week 7-8)
1. Maintenance agent for tenant agents
2. Health monitoring
3. Automatic failover to cloud AI
4. Usage analytics

## API Endpoints

```
POST   /api/v1/tenant/agent              - Configure agent
GET    /api/v1/tenant/agent              - Get agent config
PUT    /api/v1/tenant/agent              - Update agent
POST   /api/v1/tenant/agent/start        - Activate agent
POST   /api/v1/tenant/agent/stop         - Deactivate agent
GET    /api/v1/tenant/agent/stats        - Usage statistics
GET    /api/v1/tenant/agent/conversations - List conversations
```

## Webhook Routes

```
POST   /webhooks/telegram/:tenantId      - Telegram updates
POST   /webhooks/whatsapp/:tenantId      - WhatsApp updates
```

## Cost Optimization

1. **Local LLM First**: Route to LM Studio/Ollama for simple queries
2. **Smart Routing**: Use task complexity to choose model
3. **Caching**: Cache common responses (hours, location)
4. **Batching**: Batch similar requests where possible

## Security

1. **Credential Encryption**: AES-256-GCM for API tokens
2. **Tenant Isolation**: RLS on all agent data
3. **Rate Limiting**: Per-tenant and per-conversation
4. **Audit Logging**: All agent actions logged

## Monitoring

- Messages processed per tenant
- AI provider usage breakdown
- Response latency percentiles
- Error rates by provider
- Cost per tenant
