-- Migration: Add Compliance, Reviews, and Content Modules
-- Description: Creates tables for Food Safety & Compliance, Review Management (Guest Whisperer),
--              Content Planner (TikTok/Social), and Cross-Module Intelligence features.
--
-- This migration adds 20+ new tables with proper RLS policies, indexes, and soft-delete support.

BEGIN;

-- ============================================================================
-- SECTION 1: FOOD SAFETY & COMPLIANCE MODULE
-- ============================================================================

-- Compliance check templates (configurable per location)
CREATE TABLE compliance_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('temperature', 'cleaning', 'receiving', 'allergen', 'pest_control', 'opening', 'closing', 'custom')),
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'on_demand')),
    time_windows JSONB DEFAULT '[]'::jsonb,
    checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    regulatory_reference VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Equipment registry (fridges, freezers, probes)
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(50) NOT NULL CHECK (equipment_type IN ('fridge', 'freezer', 'hot_holding', 'probe', 'dishwasher', 'oven', 'grill', 'other')),
    serial_number VARCHAR(255),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    temp_lower_limit DECIMAL(5,2),
    temp_upper_limit DECIMAL(5,2),
    calibration_due_date DATE,
    last_service_date DATE,
    next_service_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
    iot_device_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Individual compliance check records
CREATE TABLE compliance_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES compliance_templates(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'corrective_action')),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    responses JSONB NOT NULL DEFAULT '[]'::jsonb,
    score DECIMAL(5,2),
    signature_url TEXT,
    gps_location JSONB,
    device_info JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Temperature monitoring logs (high-frequency, no soft-delete)
CREATE TABLE temperature_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    user_id UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    reading_celsius DECIMAL(5,2) NOT NULL,
    reading_type VARCHAR(30) NOT NULL CHECK (reading_type IN ('fridge', 'freezer', 'hot_holding', 'cooking', 'delivery', 'ambient', 'probe')),
    item_name VARCHAR(255),
    is_within_limits BOOLEAN NOT NULL,
    lower_limit DECIMAL(5,2),
    upper_limit DECIMAL(5,2),
    corrective_action_taken TEXT,
    photo_url TEXT,
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'iot_sensor', 'bluetooth_probe')),
    sensor_id VARCHAR(100),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Corrective actions tracking
CREATE TABLE corrective_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    compliance_check_id UUID REFERENCES compliance_checks(id) ON DELETE SET NULL,
    temperature_log_id UUID REFERENCES temperature_logs(id) ON DELETE SET NULL,
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('temperature_breach', 'check_failed', 'audit_finding', 'customer_complaint', 'staff_issue', 'equipment_failure', 'other')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    root_cause TEXT,
    action_taken TEXT,
    preventive_measures TEXT,
    assigned_to UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'verified')),
    due_date DATE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    verification_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Supplier management for traceability
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address JSONB,
    certifications JSONB DEFAULT '[]'::jsonb,
    approved_products JSONB DEFAULT '[]'::jsonb,
    risk_rating VARCHAR(20) DEFAULT 'medium' CHECK (risk_rating IN ('low', 'medium', 'high')),
    last_audit_date DATE,
    next_audit_due DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Delivery/receiving logs for traceability
CREATE TABLE delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
    delivery_date DATE NOT NULL,
    invoice_number VARCHAR(255),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    temperature_acceptable BOOLEAN,
    packaging_acceptable BOOLEAN,
    quality_acceptable BOOLEAN,
    issues_noted TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    signature_url TEXT,
    accepted BOOLEAN NOT NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Allergen matrix
CREATE TABLE allergen_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    celery BOOLEAN DEFAULT false,
    gluten BOOLEAN DEFAULT false,
    crustaceans BOOLEAN DEFAULT false,
    eggs BOOLEAN DEFAULT false,
    fish BOOLEAN DEFAULT false,
    lupin BOOLEAN DEFAULT false,
    milk BOOLEAN DEFAULT false,
    molluscs BOOLEAN DEFAULT false,
    mustard BOOLEAN DEFAULT false,
    nuts BOOLEAN DEFAULT false,
    peanuts BOOLEAN DEFAULT false,
    sesame BOOLEAN DEFAULT false,
    soya BOOLEAN DEFAULT false,
    sulphites BOOLEAN DEFAULT false,
    may_contain JSONB DEFAULT '[]'::jsonb,
    dietary_info JSONB DEFAULT '{}'::jsonb,
    last_verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, menu_item_id)
);

-- Staff training records
CREATE TABLE training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
    course_name VARCHAR(255) NOT NULL,
    course_type VARCHAR(50) NOT NULL CHECK (course_type IN ('food_hygiene', 'allergen', 'haccp', 'fire_safety', 'first_aid', 'health_safety', 'manual_handling', 'other')),
    provider VARCHAR(255),
    certificate_number VARCHAR(255),
    completion_date DATE NOT NULL,
    expiry_date DATE,
    certificate_url TEXT,
    score DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid', 'expiring_soon', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- SECTION 2: REVIEW MANAGEMENT MODULE (Guest Whisperer)
-- ============================================================================

-- Aggregated reviews from all platforms
CREATE TABLE aggregated_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('google', 'tripadvisor', 'yelp', 'facebook', 'internal', 'opentable', 'deliveroo', 'ubereats', 'justeat')),
    platform_review_id VARCHAR(255),
    reviewer_name VARCHAR(255),
    reviewer_avatar_url TEXT,
    rating DECIMAL(2,1) CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_date TIMESTAMPTZ NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    sentiment_label VARCHAR(20) CHECK (sentiment_label IN ('positive', 'neutral', 'negative', 'mixed')),
    sentiment_aspects JSONB DEFAULT '[]'::jsonb,
    topics JSONB DEFAULT '[]'::jsonb,
    keywords JSONB DEFAULT '[]'::jsonb,
    is_responded BOOLEAN DEFAULT false,
    response_text TEXT,
    response_date TIMESTAMPTZ,
    response_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    ai_suggested_response TEXT,
    ai_response_used BOOLEAN,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'responded', 'flagged', 'archived')),
    compliance_flags JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, platform, platform_review_id)
);

-- Platform API credentials (encrypted)
CREATE TABLE review_platform_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    credentials_encrypted BYTEA,
    encryption_key_id VARCHAR(100),
    place_id VARCHAR(255),
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(20) DEFAULT 'active' CHECK (sync_status IN ('active', 'paused', 'error', 'disconnected')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, location_id, platform)
);

-- Review response templates
CREATE TABLE review_response_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('positive', 'negative', 'neutral', 'complaint_food', 'complaint_service', 'complaint_wait', 'thank_you', 'apology')),
    template_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    tone VARCHAR(30) DEFAULT 'professional' CHECK (tone IN ('professional', 'friendly', 'apologetic', 'enthusiastic', 'formal')),
    language VARCHAR(10) DEFAULT 'en',
    use_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Review insights/analytics cache
CREATE TABLE review_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    total_reviews INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    sentiment_breakdown JSONB DEFAULT '{}'::jsonb,
    rating_distribution JSONB DEFAULT '{}'::jsonb,
    platform_breakdown JSONB DEFAULT '{}'::jsonb,
    top_positive_topics JSONB DEFAULT '[]'::jsonb,
    top_negative_topics JSONB DEFAULT '[]'::jsonb,
    response_rate DECIMAL(5,2),
    avg_response_time_hours DECIMAL(6,2),
    ai_summary TEXT,
    recommendations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, location_id, period_start, period_end, period_type)
);

-- ============================================================================
-- SECTION 3: CONTENT PLANNER MODULE (TikTok/Social)
-- ============================================================================

-- Content campaigns/themes (create before content_calendar for FK)
CREATE TABLE content_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    goals JSONB DEFAULT '{}'::jsonb,
    theme VARCHAR(100),
    brand_guidelines JSONB DEFAULT '{}'::jsonb,
    hashtag_strategy JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    performance_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Content calendar entries
CREATE TABLE content_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('video', 'image', 'carousel', 'story', 'reel', 'live', 'text')),
    platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed', 'archived')),
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    caption TEXT,
    hashtags JSONB DEFAULT '[]'::jsonb,
    media_urls JSONB DEFAULT '[]'::jsonb,
    ai_generated_captions JSONB DEFAULT '[]'::jsonb,
    trending_sounds JSONB DEFAULT '[]'::jsonb,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES content_campaigns(id) ON DELETE SET NULL,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    approval_required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Social media account connections
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'facebook', 'twitter', 'youtube', 'linkedin')),
    account_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255),
    account_handle VARCHAR(255),
    access_token_encrypted BYTEA,
    refresh_token_encrypted BYTEA,
    encryption_key_id VARCHAR(100),
    token_expires_at TIMESTAMPTZ,
    follower_count INTEGER,
    profile_url TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, platform, account_id)
);

-- Content ideas/suggestions
CREATE TABLE content_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL CHECK (source IN ('ai_generated', 'trending', 'user_submitted', 'competitor', 'seasonal', 'event')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50),
    suggested_platforms JSONB DEFAULT '[]'::jsonb,
    trending_score DECIMAL(5,2),
    reference_urls JSONB DEFAULT '[]'::jsonb,
    ai_script TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'approved', 'rejected', 'used')),
    used_in_content_id UUID REFERENCES content_calendar(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 4: CROSS-MODULE INTELLIGENCE
-- ============================================================================

-- Unified business alerts
CREATE TABLE business_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    source_type VARCHAR(50),
    source_id UUID,
    action_url TEXT,
    ai_recommendation TEXT,
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Cross-module insights (AI-generated)
CREATE TABLE business_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    insight_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    data_points JSONB DEFAULT '{}'::jsonb,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    impact_score VARCHAR(20) CHECK (impact_score IN ('low', 'medium', 'high')),
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    valid_until TIMESTAMPTZ,
    is_actionable BOOLEAN DEFAULT true,
    actioned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Workflow automation rules
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 5: EVENT SOURCING & AUDIT
-- ============================================================================

-- Domain events for all modules
CREATE TABLE domain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_version INTEGER DEFAULT 1,
    payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    actor_id UUID,
    source VARCHAR(50) NOT NULL CHECK (source IN ('api', 'webhook', 'automation', 'sync', 'system', 'migration')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Append-only audit ledger for legal compliance (HACCP)
CREATE TABLE compliance_audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'correction', 'verification')),
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL,
    changes JSONB NOT NULL,
    reason TEXT,
    actor_id UUID NOT NULL,
    actor_ip INET,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- SECTION 6: AI GOVERNANCE
-- ============================================================================

-- AI prompt templates registry
CREATE TABLE ai_prompt_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL UNIQUE,
    prompt_template TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    variables JSONB DEFAULT '[]'::jsonb,
    output_schema JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- AI decisions log for governance
CREATE TABLE ai_decisions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    prompt_registry_id UUID REFERENCES ai_prompt_registry(id) ON DELETE SET NULL,
    provider VARCHAR(30) NOT NULL,
    model VARCHAR(50) NOT NULL,
    input_hash VARCHAR(64),
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    cost_usd DECIMAL(10,6),
    response_cached BOOLEAN DEFAULT false,
    confidence_score DECIMAL(3,2),
    human_approved BOOLEAN,
    approved_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- AI cost budgets per tenant
CREATE TABLE ai_cost_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    monthly_budget_usd DECIMAL(10,2) NOT NULL,
    current_month_usage_usd DECIMAL(10,2) DEFAULT 0,
    budget_alert_threshold DECIMAL(3,2) DEFAULT 0.8,
    budget_exceeded_action VARCHAR(20) DEFAULT 'warn' CHECK (budget_exceeded_action IN ('warn', 'throttle', 'block')),
    reset_day INTEGER DEFAULT 1 CHECK (reset_day >= 1 AND reset_day <= 28),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- SECTION 7: FEATURE FLAGS
-- ============================================================================

-- Feature flags table
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    allowed_tiers JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Per-tenant feature flag overrides
CREATE TABLE tenant_feature_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL,
    expires_at TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, feature_flag_id)
);

-- ============================================================================
-- SECTION 8: ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Compliance Module (with soft-delete where applicable)
ALTER TABLE compliance_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrective_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergen_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;

-- Review Module
ALTER TABLE aggregated_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_insights ENABLE ROW LEVEL SECURITY;

-- Content Module
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;

-- Intelligence Module
ALTER TABLE business_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- Event Sourcing & Audit
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_ledger ENABLE ROW LEVEL SECURITY;

-- AI Governance
ALTER TABLE ai_decisions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_budgets ENABLE ROW LEVEL SECURITY;

-- Feature Flags (tenant overrides only)
ALTER TABLE tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 9: CREATE RLS POLICIES
-- ============================================================================

-- Tables WITH soft-delete support
CREATE POLICY tenant_isolation_compliance_templates ON compliance_templates
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_equipment ON equipment
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_suppliers ON suppliers
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_review_credentials ON review_platform_credentials
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_review_templates ON review_response_templates
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_content_calendar ON content_calendar
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_content_campaigns ON content_campaigns
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_social_accounts ON social_accounts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_automation_rules ON automation_rules
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

-- Tables WITHOUT soft-delete (audit/transactional data)
CREATE POLICY tenant_isolation_compliance_checks ON compliance_checks
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_temperature_logs ON temperature_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_corrective_actions ON corrective_actions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delivery_logs ON delivery_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_allergen_matrix ON allergen_matrix
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_training_records ON training_records
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_aggregated_reviews ON aggregated_reviews
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_review_insights ON review_insights
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_content_ideas ON content_ideas
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_business_alerts ON business_alerts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_business_intelligence ON business_intelligence
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_domain_events ON domain_events
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_compliance_audit_ledger ON compliance_audit_ledger
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_ai_decisions_log ON ai_decisions_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_ai_cost_budgets ON ai_cost_budgets
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_tenant_feature_overrides ON tenant_feature_overrides
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- SECTION 10: CREATE INDEXES
-- ============================================================================

-- Compliance Module
CREATE INDEX idx_compliance_templates_tenant_active ON compliance_templates(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_templates_category ON compliance_templates(tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_equipment_tenant_location ON equipment(tenant_id, location_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_equipment_type ON equipment(tenant_id, equipment_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_checks_tenant_location ON compliance_checks(tenant_id, location_id);
CREATE INDEX idx_compliance_checks_scheduled ON compliance_checks(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_compliance_checks_status ON compliance_checks(tenant_id, status, created_at DESC);
CREATE INDEX idx_temperature_logs_tenant_date ON temperature_logs(tenant_id, recorded_at DESC);
CREATE INDEX idx_temperature_logs_equipment ON temperature_logs(equipment_id, recorded_at DESC);
CREATE INDEX idx_temperature_logs_breaches ON temperature_logs(tenant_id, location_id, recorded_at DESC) WHERE is_within_limits = false;
CREATE INDEX idx_corrective_actions_open ON corrective_actions(tenant_id, status) WHERE status NOT IN ('resolved', 'verified');
CREATE INDEX idx_corrective_actions_assigned ON corrective_actions(assigned_to, status) WHERE status NOT IN ('resolved', 'verified');
CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_delivery_logs_tenant_date ON delivery_logs(tenant_id, delivery_date DESC);
CREATE INDEX idx_allergen_matrix_menu_item ON allergen_matrix(menu_item_id);
CREATE INDEX idx_training_records_user ON training_records(user_id, expiry_date);
CREATE INDEX idx_training_expiring ON training_records(expiry_date) WHERE status != 'expired';

-- Review Module (using idx_agg_reviews_ prefix to avoid conflict with existing reviews table indexes)
CREATE INDEX idx_agg_reviews_tenant_platform ON aggregated_reviews(tenant_id, platform, review_date DESC);
CREATE INDEX idx_agg_reviews_sentiment ON aggregated_reviews(tenant_id, sentiment_label) WHERE status = 'new';
CREATE INDEX idx_agg_reviews_unresponded ON aggregated_reviews(tenant_id, location_id, created_at DESC) WHERE is_responded = false;
CREATE INDEX idx_agg_reviews_platform_id ON aggregated_reviews(platform, platform_review_id);
CREATE INDEX idx_agg_reviews_status ON aggregated_reviews(tenant_id, status, priority DESC);
CREATE INDEX idx_review_insights_period ON review_insights(tenant_id, period_type, period_start DESC);
CREATE INDEX idx_review_templates_category ON review_response_templates(tenant_id, category) WHERE deleted_at IS NULL;

-- Content Module
CREATE INDEX idx_content_calendar_scheduled ON content_calendar(tenant_id, scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_content_calendar_status ON content_calendar(tenant_id, status, created_at DESC);
CREATE INDEX idx_content_calendar_campaign ON content_calendar(campaign_id, scheduled_at);
CREATE INDEX idx_content_campaigns_status ON content_campaigns(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_ideas_trending ON content_ideas(tenant_id, trending_score DESC) WHERE status = 'new';
CREATE INDEX idx_social_accounts_platform ON social_accounts(tenant_id, platform) WHERE deleted_at IS NULL;

-- Intelligence Module
CREATE INDEX idx_alerts_unread ON business_alerts(tenant_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_alerts_severity ON business_alerts(tenant_id, severity) WHERE is_resolved = false;
CREATE INDEX idx_alerts_source ON business_alerts(source_type, source_id);
CREATE INDEX idx_intelligence_valid ON business_intelligence(tenant_id, valid_until) WHERE is_actionable = true;
CREATE INDEX idx_intelligence_type ON business_intelligence(tenant_id, insight_type, created_at DESC);
CREATE INDEX idx_automation_rules_active ON automation_rules(tenant_id, trigger_type) WHERE is_active = true AND deleted_at IS NULL;

-- Event Sourcing
CREATE INDEX idx_events_tenant_type ON domain_events(tenant_id, event_type, created_at DESC);
CREATE INDEX idx_events_entity ON domain_events(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_ledger_entity ON compliance_audit_ledger(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_ledger_tenant ON compliance_audit_ledger(tenant_id, created_at DESC);

-- AI Governance
CREATE INDEX idx_ai_decisions_tenant ON ai_decisions_log(tenant_id, created_at DESC);
CREATE INDEX idx_ai_decisions_task ON ai_decisions_log(task_type, created_at DESC);
CREATE INDEX idx_ai_decisions_cache ON ai_decisions_log(input_hash) WHERE response_cached = true;

-- Feature Flags
CREATE INDEX idx_feature_overrides_tenant ON tenant_feature_overrides(tenant_id);

-- ============================================================================
-- SECTION 11: PREVENT AUDIT LEDGER MODIFICATIONS (Trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit ledger records cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_ledger_immutable
    BEFORE UPDATE OR DELETE ON compliance_audit_ledger
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ============================================================================
-- SECTION 12: INSERT DEFAULT FEATURE FLAGS
-- ============================================================================

INSERT INTO feature_flags (name, description, is_enabled, allowed_tiers) VALUES
('compliance_module', 'Food Safety & Compliance tracking features', false, '["starter", "professional", "enterprise"]'),
('review_management', 'Multi-platform review aggregation and AI responses', false, '["professional", "enterprise"]'),
('content_planner', 'Social media content calendar and AI generation', false, '["professional", "enterprise"]'),
('iot_temperature', 'IoT sensor integration for temperature monitoring', false, '["enterprise"]'),
('ai_insights', 'Cross-module AI-powered business intelligence', false, '["professional", "enterprise"]'),
('automation_workflows', 'Custom automation rules and workflows', false, '["enterprise"]')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SECTION 13: INSERT DEFAULT AI PROMPT TEMPLATES
-- ============================================================================

INSERT INTO ai_prompt_registry (task_type, prompt_template, variables, output_schema) VALUES
('sentiment_analysis', 'Analyze the sentiment of the following review and extract key topics:\n\nReview: {{review_text}}\n\nProvide:\n1. Overall sentiment score (-1 to 1)\n2. Sentiment label (positive/neutral/negative/mixed)\n3. Key aspects mentioned with individual sentiment\n4. Main topics discussed', '["review_text"]', '{"sentiment_score": "number", "sentiment_label": "string", "aspects": "array", "topics": "array"}'),
('review_response', 'Generate a professional response to the following customer review:\n\nReview: {{review_text}}\nRating: {{rating}}/5\nRestaurant: {{restaurant_name}}\nTone: {{tone}}\n\nThe response should:\n- Acknowledge the customer feedback\n- Address specific points mentioned\n- Be {{tone}} in tone\n- Be concise (2-3 sentences)\n- Include a call to action if appropriate', '["review_text", "rating", "restaurant_name", "tone"]', '{"response": "string"}'),
('caption_generation', 'Generate engaging social media captions for the following content:\n\nContent type: {{content_type}}\nPlatform: {{platform}}\nDescription: {{description}}\nBrand voice: {{brand_voice}}\n\nProvide 3 caption variations with relevant hashtags.', '["content_type", "platform", "description", "brand_voice"]', '{"captions": "array"}'),
('haccp_analysis', 'Analyze the following food safety situation and provide HACCP-compliant recommendations:\n\nSituation: {{situation}}\nEquipment: {{equipment}}\nTemperature readings: {{readings}}\n\nProvide:\n1. Risk assessment\n2. Immediate actions required\n3. Preventive measures\n4. Documentation requirements', '["situation", "equipment", "readings"]', '{"risk_level": "string", "immediate_actions": "array", "preventive_measures": "array", "documentation": "array"}'),
('incident_report', 'Generate a compliance incident report based on:\n\nIncident type: {{incident_type}}\nDescription: {{description}}\nSeverity: {{severity}}\n\nThe report should include executive summary, timeline, root cause analysis, and corrective action recommendations.', '["incident_type", "description", "severity"]', '{"summary": "string", "timeline": "array", "root_cause": "string", "corrective_actions": "array"}')
ON CONFLICT (task_type) DO UPDATE SET
    prompt_template = EXCLUDED.prompt_template,
    variables = EXCLUDED.variables,
    output_schema = EXCLUDED.output_schema,
    updated_at = NOW();

COMMIT;

-- ============================================================================
-- Rollback script (run manually if needed):
-- ============================================================================
--
-- BEGIN;
--
-- DROP TABLE IF EXISTS tenant_feature_overrides CASCADE;
-- DROP TABLE IF EXISTS feature_flags CASCADE;
-- DROP TABLE IF EXISTS ai_cost_budgets CASCADE;
-- DROP TABLE IF EXISTS ai_decisions_log CASCADE;
-- DROP TABLE IF EXISTS ai_prompt_registry CASCADE;
-- DROP TABLE IF EXISTS compliance_audit_ledger CASCADE;
-- DROP TABLE IF EXISTS domain_events CASCADE;
-- DROP TABLE IF EXISTS automation_rules CASCADE;
-- DROP TABLE IF EXISTS business_intelligence CASCADE;
-- DROP TABLE IF EXISTS business_alerts CASCADE;
-- DROP TABLE IF EXISTS content_ideas CASCADE;
-- DROP TABLE IF EXISTS content_calendar CASCADE;
-- DROP TABLE IF EXISTS social_accounts CASCADE;
-- DROP TABLE IF EXISTS content_campaigns CASCADE;
-- DROP TABLE IF EXISTS review_insights CASCADE;
-- DROP TABLE IF EXISTS review_response_templates CASCADE;
-- DROP TABLE IF EXISTS review_platform_credentials CASCADE;
-- DROP TABLE IF EXISTS aggregated_reviews CASCADE;
-- DROP TABLE IF EXISTS training_records CASCADE;
-- DROP TABLE IF EXISTS allergen_matrix CASCADE;
-- DROP TABLE IF EXISTS delivery_logs CASCADE;
-- DROP TABLE IF EXISTS suppliers CASCADE;
-- DROP TABLE IF EXISTS corrective_actions CASCADE;
-- DROP TABLE IF EXISTS temperature_logs CASCADE;
-- DROP TABLE IF EXISTS compliance_checks CASCADE;
-- DROP TABLE IF EXISTS equipment CASCADE;
-- DROP TABLE IF EXISTS compliance_templates CASCADE;
-- DROP FUNCTION IF EXISTS prevent_audit_modification CASCADE;
--
-- COMMIT;
