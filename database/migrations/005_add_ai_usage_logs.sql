-- Migration: 005_add_ai_usage_logs
-- Description: Add AI usage tracking table
-- Date: 2025-01-28

-- ============================================================================
-- AI USAGE LOGS TABLE
-- Tracks all AI service usage for analytics and billing
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Request details
    task_type VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    
    -- Usage metrics
    credits_used INTEGER DEFAULT 0,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms INTEGER,
    
    -- Request context
    wallet_address VARCHAR(64),
    request_id VARCHAR(100),
    
    -- Success/failure
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_ai_usage_logs_tenant ON ai_usage_logs(tenant_id);
CREATE INDEX idx_ai_usage_logs_task_type ON ai_usage_logs(task_type);
CREATE INDEX idx_ai_usage_logs_provider ON ai_usage_logs(provider);
CREATE INDEX idx_ai_usage_logs_created ON ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_tenant_created ON ai_usage_logs(tenant_id, created_at DESC);

-- Composite index for common analytics queries
CREATE INDEX idx_ai_usage_logs_analytics ON ai_usage_logs(tenant_id, task_type, provider, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_logs_tenant_isolation ON ai_usage_logs
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Daily AI usage summary view
CREATE OR REPLACE VIEW ai_usage_daily_summary AS
SELECT 
    tenant_id,
    DATE(created_at) as usage_date,
    task_type,
    provider,
    COUNT(*) as request_count,
    SUM(credits_used) as total_credits,
    SUM(total_tokens) as total_tokens,
    AVG(latency_ms)::integer as avg_latency_ms,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    COUNT(*) FILTER (WHERE success = false) as failed_requests
FROM ai_usage_logs
GROUP BY tenant_id, DATE(created_at), task_type, provider;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get usage summary for a tenant
CREATE OR REPLACE FUNCTION get_ai_usage_summary(
    p_tenant_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    task_type VARCHAR(50),
    provider VARCHAR(50),
    request_count BIGINT,
    total_credits BIGINT,
    avg_latency_ms INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.task_type,
        l.provider,
        COUNT(*)::BIGINT as request_count,
        COALESCE(SUM(l.credits_used), 0)::BIGINT as total_credits,
        COALESCE(AVG(l.latency_ms), 0)::INTEGER as avg_latency_ms
    FROM ai_usage_logs l
    WHERE l.tenant_id = p_tenant_id
      AND l.created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY l.task_type, l.provider
    ORDER BY request_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_usage_logs IS 'Tracks all AI service usage for analytics and billing';
COMMENT ON COLUMN ai_usage_logs.task_type IS 'Type of AI task: chat, review_response, menu_description, etc.';
COMMENT ON COLUMN ai_usage_logs.provider IS 'AI provider: openai, anthropic, google, local';
COMMENT ON COLUMN ai_usage_logs.credits_used IS 'MTC credits consumed for this request';
