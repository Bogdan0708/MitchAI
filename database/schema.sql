-- Mitch Hospitality SaaS - Multi-Tenant Database Schema
-- PostgreSQL with Row-Level Security (RLS)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Pricing Tiers
CREATE TABLE pricing_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    max_locations INTEGER NOT NULL DEFAULT 1,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_menu_items INTEGER NOT NULL DEFAULT 100,
    max_api_calls_monthly INTEGER NOT NULL DEFAULT 10000,
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
    features JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pricing_tiers (name, display_name, price_monthly, max_locations, max_users, max_menu_items, max_api_calls_monthly, rate_limit_per_minute, features) VALUES
('starter', 'Starter', 49.00, 1, 5, 100, 10000, 100, '{"menu_ai": true, "social_media": false, "voice_ai": false, "blockchain": false}'),
('professional', 'Professional', 149.00, 5, 20, 500, 50000, 500, '{"menu_ai": true, "social_media": true, "voice_ai": false, "blockchain": true}'),
('enterprise', 'Enterprise', 499.00, -1, -1, -1, 500000, 2000, '{"menu_ai": true, "social_media": true, "voice_ai": true, "blockchain": true}')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_monthly = EXCLUDED.price_monthly,
  max_locations = EXCLUDED.max_locations,
  max_users = EXCLUDED.max_users,
  max_menu_items = EXCLUDED.max_menu_items,
  max_api_calls_monthly = EXCLUDED.max_api_calls_monthly,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  features = EXCLUDED.features;

-- Tenants (Restaurants)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    tier_id INTEGER NOT NULL REFERENCES pricing_tiers(id) DEFAULT 1,
    stripe_customer_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'trial',
    api_calls_this_month INTEGER NOT NULL DEFAULT 0,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant Users
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'staff',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, email)
);

-- Locations
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'United Kingdom',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Menu Items
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    ai_description TEXT,
    image_url VARCHAR(500),
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- AI Usage Tracking
CREATE TABLE ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
    request_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Loyalty Accounts
CREATE TABLE loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_email VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(42),
    points_balance INTEGER NOT NULL DEFAULT 0,
    tier VARCHAR(20) NOT NULL DEFAULT 'bronze',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, customer_email)
);

-- Enable RLS
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (with soft-delete filtering where applicable)
CREATE POLICY tenant_isolation_users ON tenant_users FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);
CREATE POLICY tenant_isolation_locations ON locations FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);
CREATE POLICY tenant_isolation_menu ON menu_items FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);
CREATE POLICY tenant_isolation_ai ON ai_usage FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation_loyalty ON loyalty_accounts FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

-- ============================================================================
-- ADDITIONAL TABLES (Phase 1 Completion)
-- ============================================================================

-- Menu Categories
CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255),
    phone VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    preferences JSONB NOT NULL DEFAULT '{}',
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
    last_order_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Tables (for reservations)
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    table_number VARCHAR(20) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    qr_code_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    table_id UUID REFERENCES tables(id),
    order_number VARCHAR(50) NOT NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'dine_in', -- dine_in, takeaway, delivery
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, preparing, ready, completed, cancelled
    customer_name VARCHAR(200),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid, refunded
    payment_method VARCHAR(50),
    stripe_payment_intent_id VARCHAR(100),
    notes TEXT,
    ai_upsell_suggestions JSONB,
    source VARCHAR(50) DEFAULT 'pos', -- pos, qr_code, website, whatsapp, voice
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id),
    name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    modifiers JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reservations
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    table_id UUID REFERENCES tables(id),
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    party_size INTEGER NOT NULL DEFAULT 2,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, seated, completed, cancelled, no_show
    notes TEXT,
    special_requests TEXT,
    ai_reminder_sent BOOLEAN NOT NULL DEFAULT false,
    source VARCHAR(50) DEFAULT 'website', -- website, phone, walk_in, ai_chatbot
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Conversations (for AI chatbot)
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    session_id VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'web', -- web, whatsapp, voice, sms
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, closed, escalated
    customer_name VARCHAR(200),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    sentiment_score DECIMAL(3,2), -- -1.00 to 1.00
    resolved_by_ai BOOLEAN NOT NULL DEFAULT false,
    escalated_to_human BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    ai_provider VARCHAR(50), -- openai, claude, perplexity, lm_studio, ollama
    ai_model VARCHAR(100),
    tokens_used INTEGER,
    response_time_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Provider Configuration (per tenant)
CREATE TABLE ai_provider_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- openai, claude, perplexity, lm_studio, ollama
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 1, -- lower = higher priority for fallback
    api_key_encrypted VARCHAR(500), -- encrypted API key (null for local providers)
    base_url VARCHAR(500), -- custom endpoint (for LM Studio, Ollama)
    default_model VARCHAR(100),
    max_tokens INTEGER DEFAULT 4096,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    rate_limit_per_minute INTEGER DEFAULT 60,
    monthly_budget_usd DECIMAL(10,2),
    current_month_spend_usd DECIMAL(10,2) DEFAULT 0,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, provider)
);

-- Reviews (for AI response generation)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id),
    platform VARCHAR(50) NOT NULL, -- google, tripadvisor, yelp, facebook
    external_review_id VARCHAR(200),
    reviewer_name VARCHAR(200),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_date TIMESTAMPTZ,
    response_text TEXT,
    response_generated_by VARCHAR(50), -- ai, human
    response_ai_provider VARCHAR(50),
    response_date TIMESTAMPTZ,
    sentiment VARCHAR(20), -- positive, neutral, negative
    sentiment_score DECIMAL(3,2),
    keywords JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES tenant_users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data Exports (GDPR compliance)
CREATE TABLE data_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES tenant_users(id),
    export_type VARCHAR(50) NOT NULL, -- full, customers, orders, menu
    format VARCHAR(20) NOT NULL DEFAULT 'json', -- json, csv
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    file_url VARCHAR(500),
    file_size_bytes BIGINT,
    expires_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Subscription History
CREATE TABLE subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- created, upgraded, downgraded, cancelled, renewed
    from_tier_id INTEGER REFERENCES pricing_tiers(id),
    to_tier_id INTEGER REFERENCES pricing_tiers(id),
    stripe_subscription_id VARCHAR(100),
    stripe_invoice_id VARCHAR(100),
    amount_usd DECIMAL(10,2),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for new tables (with soft-delete filtering where applicable)
-- Tables WITH soft-delete support
CREATE POLICY tenant_isolation_categories ON menu_categories FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);
CREATE POLICY tenant_isolation_customers ON customers FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);
CREATE POLICY tenant_isolation_tables ON tables FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);
CREATE POLICY tenant_isolation_ai_config ON ai_provider_config FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

-- Tables WITHOUT soft-delete (audit/history/transactional data - keep all records visible)
CREATE POLICY tenant_isolation_orders ON orders FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation_order_items ON order_items FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation_reservations ON reservations FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation_conversations ON chat_conversations FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation_messages ON chat_messages FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation_reviews ON reviews FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation_audit ON audit_logs FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation_exports ON data_exports FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation_subscriptions ON subscription_history FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Add missing columns to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/London';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en-GB';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add category_id to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES menu_categories(id);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sku VARCHAR(50);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS calories INTEGER;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS allergens JSONB DEFAULT '[]';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add login tracking to tenant_users
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(tenant_id, reservation_date, status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session ON chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_date ON ai_usage(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action ON audit_logs(tenant_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_tenant_platform ON reviews(tenant_id, platform, created_at);

-- Soft-delete partial indexes (optimized for queries filtering out deleted records)
CREATE INDEX IF NOT EXISTS idx_tenant_users_active ON tenant_users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON menu_categories(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_active ON tables(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_active ON loyalty_accounts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_provider_config_active ON ai_provider_config(tenant_id) WHERE deleted_at IS NULL;
