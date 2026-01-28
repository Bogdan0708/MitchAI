-- ============================================================================
-- TENANT EMAIL INTEGRATION
-- ============================================================================
-- Adds tables for Gmail/email account connections and email tracking
-- Part of the Email Integration feature ported from G-mail_Automation
--
-- Tables:
--   tenant_email_accounts  - Connected email accounts per tenant
--   tracked_emails         - Synced inbound emails with priority scores
--   email_drafts           - AI-generated draft replies
--   email_notification_log - Notification history
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TENANT EMAIL ACCOUNTS
-- Stores OAuth tokens and account settings for connected Gmail/Outlook accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Account info
    email VARCHAR(255) NOT NULL,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('gmail', 'outlook', 'other')),
    display_name VARCHAR(255),
    
    -- OAuth tokens (encrypted)
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    token_expiry TIMESTAMPTZ NOT NULL,
    
    -- Sync settings
    enabled BOOLEAN NOT NULL DEFAULT true,
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20) CHECK (last_sync_status IN ('success', 'error', 'pending')),
    last_sync_error TEXT,
    
    -- Stats
    emails_synced INTEGER NOT NULL DEFAULT 0,
    drafts_generated INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, email)
);

-- Index for tenant lookups
CREATE INDEX idx_email_accounts_tenant ON tenant_email_accounts(tenant_id);
CREATE INDEX idx_email_accounts_enabled ON tenant_email_accounts(tenant_id) WHERE enabled = true;

-- ----------------------------------------------------------------------------
-- TRACKED EMAILS
-- Stores synced inbound emails with priority scores and processing status
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracked_emails (
    id VARCHAR(100) NOT NULL,  -- Gmail/provider message ID
    account_id UUID NOT NULL REFERENCES tenant_email_accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    thread_id VARCHAR(100),
    
    -- Headers
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    to_addresses JSONB NOT NULL DEFAULT '[]',
    cc_addresses JSONB DEFAULT '[]',
    subject TEXT,
    
    -- Content
    snippet TEXT,
    body_text TEXT,
    body_html TEXT,
    
    -- Status flags
    is_unread BOOLEAN NOT NULL DEFAULT true,
    is_important BOOLEAN NOT NULL DEFAULT false,
    is_starred BOOLEAN NOT NULL DEFAULT false,
    labels JSONB DEFAULT '[]',
    
    -- AI Processing
    priority_score DECIMAL(3,2) CHECK (priority_score >= 0 AND priority_score <= 1),
    priority_factors JSONB,
    priority_recommendation VARCHAR(20) CHECK (priority_recommendation IN ('urgent', 'important', 'normal', 'low')),
    
    -- Draft tracking
    has_draft BOOLEAN NOT NULL DEFAULT false,
    draft_id UUID REFERENCES email_drafts(id),
    
    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id, account_id)
);

-- Indexes for common queries
CREATE INDEX idx_tracked_emails_tenant ON tracked_emails(tenant_id);
CREATE INDEX idx_tracked_emails_account ON tracked_emails(account_id);
CREATE INDEX idx_tracked_emails_received ON tracked_emails(received_at DESC);
CREATE INDEX idx_tracked_emails_priority ON tracked_emails(priority_score DESC NULLS LAST);
CREATE INDEX idx_tracked_emails_unread ON tracked_emails(account_id) WHERE is_unread = true;
CREATE INDEX idx_tracked_emails_thread ON tracked_emails(thread_id);

-- ----------------------------------------------------------------------------
-- EMAIL DRAFTS
-- AI-generated reply drafts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id VARCHAR(100) NOT NULL,
    account_id UUID NOT NULL REFERENCES tenant_email_accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Draft content
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    
    -- AI metadata
    generated_by VARCHAR(100),  -- Model name
    tone VARCHAR(20) CHECK (tone IN ('professional', 'friendly', 'formal', 'concise', 'detailed')),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'generated' 
        CHECK (status IN ('generated', 'edited', 'sent', 'discarded')),
    sent_at TIMESTAMPTZ,
    gmail_draft_id VARCHAR(100),  -- Gmail's draft ID after saving
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_drafts_tenant ON email_drafts(tenant_id);
CREATE INDEX idx_email_drafts_email ON email_drafts(email_id, account_id);
CREATE INDEX idx_email_drafts_status ON email_drafts(status);

-- ----------------------------------------------------------------------------
-- EMAIL NOTIFICATION LOG
-- Tracks notifications sent for high-priority emails
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id VARCHAR(100) NOT NULL,
    account_id UUID NOT NULL REFERENCES tenant_email_accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Notification details
    channel VARCHAR(50) NOT NULL,  -- 'telegram', 'webhook', 'push', etc.
    priority_score DECIMAL(3,2),
    notification_data JSONB,
    
    -- Status
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered BOOLEAN DEFAULT false,
    error TEXT
);

-- Index for deduplication checks
CREATE INDEX idx_email_notifications_dedup ON email_notification_log(email_id, account_id, channel);
CREATE INDEX idx_email_notifications_tenant ON email_notification_log(tenant_id);

-- ----------------------------------------------------------------------------
-- EMAIL SCORING CONTEXT
-- Per-tenant settings for priority scoring
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_scoring_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Known senders (high priority)
    known_senders JSONB NOT NULL DEFAULT '[]',  -- Array of email addresses
    important_domains JSONB NOT NULL DEFAULT '[]',  -- Array of domains
    urgent_keywords JSONB NOT NULL DEFAULT '[]',  -- Custom urgent keywords
    
    -- Business context
    business_type VARCHAR(50),  -- 'restaurant', 'hotel', etc.
    business_hours JSONB,  -- { timezone, openTime, closeTime, daysOpen }
    
    -- Notification settings
    priority_threshold DECIMAL(3,2) DEFAULT 0.5,
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- RLS POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE tenant_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_scoring_contexts ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tenant_email_accounts_tenant_isolation ON tenant_email_accounts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tracked_emails_tenant_isolation ON tracked_emails
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY email_drafts_tenant_isolation ON email_drafts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY email_notification_log_tenant_isolation ON email_notification_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY email_scoring_contexts_tenant_isolation ON email_scoring_contexts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ----------------------------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- ----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at_tenant_email_accounts
    BEFORE UPDATE ON tenant_email_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_tracked_emails
    BEFORE UPDATE ON tracked_emails
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_email_drafts
    BEFORE UPDATE ON email_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_email_scoring_contexts
    BEFORE UPDATE ON email_scoring_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Get connected email accounts for a tenant
CREATE OR REPLACE FUNCTION get_tenant_email_accounts(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    email VARCHAR(255),
    provider VARCHAR(20),
    display_name VARCHAR(255),
    enabled BOOLEAN,
    sync_enabled BOOLEAN,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20),
    emails_synced INTEGER,
    drafts_generated INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tea.id,
        tea.email,
        tea.provider,
        tea.display_name,
        tea.enabled,
        tea.sync_enabled,
        tea.last_sync_at,
        tea.last_sync_status,
        tea.emails_synced,
        tea.drafts_generated
    FROM tenant_email_accounts tea
    WHERE tea.tenant_id = p_tenant_id
    ORDER BY tea.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get high priority emails for a tenant
CREATE OR REPLACE FUNCTION get_priority_emails(
    p_tenant_id UUID,
    p_min_priority DECIMAL DEFAULT 0.5,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id VARCHAR(100),
    account_id UUID,
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    subject TEXT,
    snippet TEXT,
    priority_score DECIMAL(3,2),
    priority_recommendation VARCHAR(20),
    is_unread BOOLEAN,
    has_draft BOOLEAN,
    received_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.id,
        te.account_id,
        te.from_email,
        te.from_name,
        te.subject,
        te.snippet,
        te.priority_score,
        te.priority_recommendation,
        te.is_unread,
        te.has_draft,
        te.received_at
    FROM tracked_emails te
    WHERE te.tenant_id = p_tenant_id
        AND te.priority_score >= p_min_priority
    ORDER BY te.priority_score DESC, te.received_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Email sync stats for a tenant
CREATE OR REPLACE FUNCTION get_email_sync_stats(p_tenant_id UUID)
RETURNS TABLE (
    total_accounts INTEGER,
    enabled_accounts INTEGER,
    total_emails_synced BIGINT,
    total_drafts_generated BIGINT,
    last_sync TIMESTAMPTZ,
    emails_today INTEGER,
    high_priority_unread INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_accounts,
        COUNT(*) FILTER (WHERE tea.enabled)::INTEGER as enabled_accounts,
        COALESCE(SUM(tea.emails_synced), 0)::BIGINT as total_emails_synced,
        COALESCE(SUM(tea.drafts_generated), 0)::BIGINT as total_drafts_generated,
        MAX(tea.last_sync_at) as last_sync,
        (
            SELECT COUNT(*)::INTEGER 
            FROM tracked_emails te 
            WHERE te.tenant_id = p_tenant_id 
            AND te.received_at >= CURRENT_DATE
        ) as emails_today,
        (
            SELECT COUNT(*)::INTEGER 
            FROM tracked_emails te 
            WHERE te.tenant_id = p_tenant_id 
            AND te.is_unread = true 
            AND te.priority_score >= 0.6
        ) as high_priority_unread
    FROM tenant_email_accounts tea
    WHERE tea.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- COMMENTS
-- ----------------------------------------------------------------------------
COMMENT ON TABLE tenant_email_accounts IS 'Connected Gmail/email accounts per tenant with OAuth tokens';
COMMENT ON TABLE tracked_emails IS 'Synced inbound emails with AI priority scores';
COMMENT ON TABLE email_drafts IS 'AI-generated reply drafts';
COMMENT ON TABLE email_notification_log IS 'Notification history for high-priority emails';
COMMENT ON TABLE email_scoring_contexts IS 'Per-tenant settings for email priority scoring';
