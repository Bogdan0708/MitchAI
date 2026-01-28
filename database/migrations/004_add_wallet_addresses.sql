-- Migration: 004_add_wallet_addresses
-- Description: Add wallet_addresses table for blockchain integration
-- Date: 2025-01-28

-- ============================================================================
-- WALLET ADDRESSES TABLE
-- Links MTC blockchain wallets to tenants and customers
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Wallet details
    address VARCHAR(64) NOT NULL,  -- Cosmos bech32 address (mitch1...)
    wallet_type VARCHAR(20) NOT NULL CHECK (wallet_type IN ('custodial', 'connected')),
    label VARCHAR(100),            -- Optional friendly name
    
    -- Verification
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_signature TEXT,   -- Signature proving ownership (connected wallets)
    
    -- Chain data cache (denormalized for performance)
    cached_balance_umtc BIGINT DEFAULT 0,
    cached_loyalty_points BIGINT DEFAULT 0,
    cached_loyalty_tier VARCHAR(20) DEFAULT 'bronze',
    cached_ai_credits INTEGER DEFAULT 0,
    cache_updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    is_primary BOOLEAN DEFAULT false,  -- Primary wallet for this customer
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT unique_address_per_tenant UNIQUE (tenant_id, address),
    CONSTRAINT valid_cosmos_address CHECK (address ~ '^mitch1[a-z0-9]{38,}$')
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_wallet_addresses_tenant ON wallet_addresses(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_addresses_customer ON wallet_addresses(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_addresses_address ON wallet_addresses(address) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_addresses_type ON wallet_addresses(wallet_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_addresses_primary ON wallet_addresses(customer_id, is_primary) WHERE is_primary = true AND deleted_at IS NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE wallet_addresses ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY wallet_addresses_tenant_isolation ON wallet_addresses
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- WALLET TRANSACTIONS TABLE
-- Records all blockchain transactions for audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallet_addresses(id) ON DELETE CASCADE,
    
    -- Transaction details
    tx_hash VARCHAR(64) NOT NULL,
    tx_type VARCHAR(50) NOT NULL,  -- earn_points, redeem_points, purchase_credits, use_credits, transfer
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    
    -- Amounts
    amount_umtc BIGINT,
    points_delta BIGINT,
    credits_delta INTEGER,
    
    -- Context
    related_order_id UUID,
    related_service VARCHAR(50),   -- For AI credit usage
    
    -- Chain data
    block_height BIGINT,
    gas_used BIGINT,
    raw_log TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT unique_tx_hash UNIQUE (tx_hash)
);

-- ============================================================================
-- INDEXES FOR TRANSACTIONS
-- ============================================================================

CREATE INDEX idx_wallet_transactions_tenant ON wallet_transactions(tenant_id);
CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_hash ON wallet_transactions(tx_hash);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(tx_type);
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX idx_wallet_transactions_created ON wallet_transactions(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY FOR TRANSACTIONS
-- ============================================================================

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_transactions_tenant_isolation ON wallet_transactions
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_wallet_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wallet_addresses_updated_at
    BEFORE UPDATE ON wallet_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_addresses_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get primary wallet for a customer
CREATE OR REPLACE FUNCTION get_primary_wallet(p_customer_id UUID)
RETURNS TABLE (
    id UUID,
    address VARCHAR(64),
    wallet_type VARCHAR(20),
    cached_balance_umtc BIGINT,
    cached_loyalty_points BIGINT,
    cached_loyalty_tier VARCHAR(20),
    cached_ai_credits INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wa.id,
        wa.address,
        wa.wallet_type,
        wa.cached_balance_umtc,
        wa.cached_loyalty_points,
        wa.cached_loyalty_tier,
        wa.cached_ai_credits
    FROM wallet_addresses wa
    WHERE wa.customer_id = p_customer_id
      AND wa.is_primary = true
      AND wa.deleted_at IS NULL
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Set primary wallet (ensures only one primary per customer)
CREATE OR REPLACE FUNCTION set_primary_wallet(p_wallet_id UUID, p_customer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Remove primary from other wallets
    UPDATE wallet_addresses
    SET is_primary = false
    WHERE customer_id = p_customer_id
      AND id != p_wallet_id
      AND deleted_at IS NULL;
    
    -- Set this wallet as primary
    UPDATE wallet_addresses
    SET is_primary = true
    WHERE id = p_wallet_id
      AND customer_id = p_customer_id
      AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE wallet_addresses IS 'Links MTC blockchain wallets to tenants and customers';
COMMENT ON TABLE wallet_transactions IS 'Audit trail of all blockchain transactions';
COMMENT ON COLUMN wallet_addresses.cached_balance_umtc IS 'Cached balance in micro-MTC (uMTC), updated periodically';
COMMENT ON COLUMN wallet_addresses.wallet_type IS 'custodial = managed by platform, connected = user-owned external wallet';
