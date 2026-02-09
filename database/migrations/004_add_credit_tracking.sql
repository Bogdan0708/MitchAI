-- Migration: Add AI Credit Tracking
-- Date: 2026-02-09

-- Create credit usage table
CREATE TABLE IF NOT EXISTS ai_credit_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    credits INTEGER NOT NULL DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_credit_usage_tenant_month 
ON ai_credit_usage (tenant_id, DATE_TRUNC('month', created_at));

CREATE INDEX IF NOT EXISTS idx_credit_usage_created 
ON ai_credit_usage (created_at DESC);

-- Add credits columns to pricing_tiers
ALTER TABLE pricing_tiers 
ADD COLUMN IF NOT EXISTS monthly_credits INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS overage_rate DECIMAL(10,4) DEFAULT 0.02;

-- Update existing tiers with credit limits
UPDATE pricing_tiers SET monthly_credits = 500, overage_rate = 0.02 WHERE name = 'starter';
UPDATE pricing_tiers SET monthly_credits = 2000, overage_rate = 0.015 WHERE name = 'professional';
UPDATE pricing_tiers SET monthly_credits = 10000, overage_rate = 0.01 WHERE name = 'enterprise';

-- Add comments
COMMENT ON TABLE ai_credit_usage IS 'Tracks AI credit usage per tenant';
COMMENT ON COLUMN ai_credit_usage.task_type IS 'Type of AI task (chat, review_response, etc.)';
COMMENT ON COLUMN ai_credit_usage.credits IS 'Number of credits consumed';
COMMENT ON COLUMN pricing_tiers.monthly_credits IS 'Included AI credits per month';
COMMENT ON COLUMN pricing_tiers.overage_rate IS 'Cost per credit over the limit (GBP)';
