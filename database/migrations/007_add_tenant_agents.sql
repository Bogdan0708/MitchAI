-- Migration: 007_add_tenant_agents
-- Description: Multi-agent architecture - per-tenant AI agents
-- Date: 2026-02-05

-- ============================================================================
-- TENANT AGENTS TABLE
-- Each tenant can have one AI agent for customer support
-- ============================================================================

CREATE TABLE tenant_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Agent identity
    name VARCHAR(255) NOT NULL DEFAULT 'Restaurant Assistant',
    avatar_url VARCHAR(500),
    
    -- AI configuration
    system_prompt TEXT,
    model_preference VARCHAR(100) DEFAULT 'local', -- local, anthropic, openai
    temperature DECIMAL(2,1) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1024,
    
    -- Channel credentials (AES-256-GCM encrypted)
    telegram_bot_token_encrypted TEXT,
    telegram_bot_username VARCHAR(255),
    telegram_webhook_secret VARCHAR(64),
    whatsapp_phone_id_encrypted TEXT,
    whatsapp_access_token_encrypted TEXT,
    
    -- Capabilities
    capabilities JSONB DEFAULT '{
        "can_view_menu": true,
        "can_view_hours": true,
        "can_handle_reservations": false,
        "can_process_orders": false,
        "can_access_loyalty": false,
        "languages": ["en"]
    }',
    
    -- Knowledge base
    custom_knowledge JSONB DEFAULT '{}', -- FAQs, policies, etc.
    menu_context_enabled BOOLEAN DEFAULT true,
    
    -- Limits (based on tier)
    daily_message_limit INTEGER DEFAULT 100,
    monthly_token_limit INTEGER DEFAULT 100000,
    
    -- Usage tracking
    messages_today INTEGER DEFAULT 0,
    tokens_this_month INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'inactive', -- inactive, active, paused, error
    error_message TEXT,
    last_active_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- ============================================================================
-- AGENT CONVERSATIONS TABLE
-- Track ongoing conversations with customers
-- ============================================================================

CREATE TABLE agent_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES tenant_agents(id) ON DELETE CASCADE,
    
    -- Conversation identity
    channel VARCHAR(50) NOT NULL, -- telegram, whatsapp, webchat
    external_chat_id VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Context
    context JSONB DEFAULT '{}', -- conversation state, intent tracking
    summary TEXT, -- AI-generated conversation summary
    
    -- Stats
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    last_customer_message_at TIMESTAMPTZ,
    last_agent_message_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, resolved, escalated, archived
    escalated_to_human BOOLEAN DEFAULT false,
    escalation_reason TEXT,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(agent_id, channel, external_chat_id)
);

-- ============================================================================
-- AGENT MESSAGES TABLE
-- Store conversation history for context
-- ============================================================================

CREATE TABLE agent_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
    
    -- Message content
    role VARCHAR(20) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    
    -- Metadata
    tokens_used INTEGER DEFAULT 0,
    model_used VARCHAR(100),
    latency_ms INTEGER,
    
    -- External references
    external_message_id VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient message retrieval
CREATE INDEX idx_agent_messages_conversation ON agent_messages(conversation_id, created_at DESC);

-- ============================================================================
-- AGENT ANALYTICS TABLE
-- Daily aggregated stats per agent
-- ============================================================================

CREATE TABLE agent_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES tenant_agents(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Volume
    total_messages INTEGER DEFAULT 0,
    total_conversations INTEGER DEFAULT 0,
    new_conversations INTEGER DEFAULT 0,
    resolved_conversations INTEGER DEFAULT 0,
    escalated_conversations INTEGER DEFAULT 0,
    
    -- Costs
    tokens_used INTEGER DEFAULT 0,
    local_llm_tokens INTEGER DEFAULT 0,
    cloud_tokens INTEGER DEFAULT 0,
    estimated_cost_usd DECIMAL(10,4) DEFAULT 0,
    
    -- Performance
    avg_response_time_ms INTEGER,
    avg_messages_per_conversation DECIMAL(5,2),
    
    -- Satisfaction (if collected)
    positive_feedback INTEGER DEFAULT 0,
    negative_feedback INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(agent_id, date)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_analytics ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tenant_agents_isolation ON tenant_agents
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY agent_conversations_isolation ON agent_conversations
    FOR ALL USING (
        agent_id IN (
            SELECT id FROM tenant_agents 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

CREATE POLICY agent_messages_isolation ON agent_messages
    FOR ALL USING (
        conversation_id IN (
            SELECT ac.id FROM agent_conversations ac
            JOIN tenant_agents ta ON ac.agent_id = ta.id
            WHERE ta.tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

CREATE POLICY agent_analytics_isolation ON agent_analytics
    FOR ALL USING (
        agent_id IN (
            SELECT id FROM tenant_agents 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to reset daily counters
CREATE OR REPLACE FUNCTION reset_agent_daily_counters()
RETURNS void AS $$
BEGIN
    UPDATE tenant_agents
    SET messages_today = 0,
        last_reset_date = CURRENT_DATE
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if agent has capacity
CREATE OR REPLACE FUNCTION agent_has_capacity(p_agent_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_agent tenant_agents%ROWTYPE;
BEGIN
    SELECT * INTO v_agent FROM tenant_agents WHERE id = p_agent_id;
    
    IF v_agent IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Reset counters if new day
    IF v_agent.last_reset_date < CURRENT_DATE THEN
        UPDATE tenant_agents 
        SET messages_today = 0, last_reset_date = CURRENT_DATE
        WHERE id = p_agent_id;
        v_agent.messages_today := 0;
    END IF;
    
    RETURN v_agent.status = 'active' 
        AND v_agent.messages_today < v_agent.daily_message_limit
        AND v_agent.tokens_this_month < v_agent.monthly_token_limit;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_agent_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_agents_updated
    BEFORE UPDATE ON tenant_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_timestamp();

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_tenant_agents_tenant ON tenant_agents(tenant_id);
CREATE INDEX idx_tenant_agents_status ON tenant_agents(status);
CREATE INDEX idx_agent_conversations_agent ON agent_conversations(agent_id);
CREATE INDEX idx_agent_conversations_status ON agent_conversations(status);
CREATE INDEX idx_agent_analytics_date ON agent_analytics(agent_id, date DESC);
