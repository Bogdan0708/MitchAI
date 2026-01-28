-- Migration: Add soft-delete support to RLS policies
-- Description: Adds deleted_at columns to appropriate tables and updates RLS policies
--              to filter out soft-deleted records at the database level.
--
-- This ensures that soft-deleted records are never accidentally exposed to tenants.

BEGIN;

-- ============================================================================
-- Step 1: Add deleted_at columns to tables that support soft-delete
-- ============================================================================

-- Note: tenants table already has deleted_at column

ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE loyalty_accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================================
-- Step 2: Drop existing RLS policies
-- ============================================================================

-- Original tables
DROP POLICY IF EXISTS tenant_isolation_users ON tenant_users;
DROP POLICY IF EXISTS tenant_isolation_locations ON locations;
DROP POLICY IF EXISTS tenant_isolation_menu ON menu_items;
DROP POLICY IF EXISTS tenant_isolation_ai ON ai_usage;
DROP POLICY IF EXISTS tenant_isolation_loyalty ON loyalty_accounts;

-- Phase 1 tables
DROP POLICY IF EXISTS tenant_isolation_categories ON menu_categories;
DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
DROP POLICY IF EXISTS tenant_isolation_tables ON tables;
DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
DROP POLICY IF EXISTS tenant_isolation_order_items ON order_items;
DROP POLICY IF EXISTS tenant_isolation_reservations ON reservations;
DROP POLICY IF EXISTS tenant_isolation_conversations ON chat_conversations;
DROP POLICY IF EXISTS tenant_isolation_messages ON chat_messages;
DROP POLICY IF EXISTS tenant_isolation_ai_config ON ai_provider_config;
DROP POLICY IF EXISTS tenant_isolation_reviews ON reviews;
DROP POLICY IF EXISTS tenant_isolation_audit ON audit_logs;
DROP POLICY IF EXISTS tenant_isolation_exports ON data_exports;
DROP POLICY IF EXISTS tenant_isolation_subscriptions ON subscription_history;

-- ============================================================================
-- Step 3: Create new RLS policies with soft-delete filtering
-- ============================================================================

-- Tables WITH soft-delete support (deleted_at IS NULL filter)
CREATE POLICY tenant_isolation_users ON tenant_users
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_locations ON locations
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_menu ON menu_items
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_categories ON menu_categories
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_customers ON customers
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_tables ON tables
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_loyalty ON loyalty_accounts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_ai_config ON ai_provider_config
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

-- Tables WITHOUT soft-delete (audit/history/transactional data - keep all records)
CREATE POLICY tenant_isolation_ai ON ai_usage
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_orders ON orders
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_order_items ON order_items
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_reservations ON reservations
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_conversations ON chat_conversations
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_messages ON chat_messages
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_reviews ON reviews
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_audit ON audit_logs
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_exports ON data_exports
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_subscriptions ON subscription_history
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Step 4: Add indexes for soft-delete queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_users_deleted ON tenant_users(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_locations_deleted ON locations(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_deleted ON menu_items(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_categories_deleted ON menu_categories(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_deleted ON tables(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_deleted ON loyalty_accounts(tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_provider_config_deleted ON ai_provider_config(tenant_id, deleted_at) WHERE deleted_at IS NULL;

COMMIT;

-- ============================================================================
-- Rollback script (run manually if needed):
-- ============================================================================
--
-- BEGIN;
--
-- -- Remove soft-delete columns
-- ALTER TABLE tenant_users DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE locations DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE menu_items DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE menu_categories DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE customers DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE tables DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE loyalty_accounts DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE ai_provider_config DROP COLUMN IF EXISTS deleted_at;
--
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_tenant_users_deleted;
-- DROP INDEX IF EXISTS idx_locations_deleted;
-- DROP INDEX IF EXISTS idx_menu_items_deleted;
-- DROP INDEX IF EXISTS idx_menu_categories_deleted;
-- DROP INDEX IF EXISTS idx_customers_deleted;
-- DROP INDEX IF EXISTS idx_tables_deleted;
-- DROP INDEX IF EXISTS idx_loyalty_accounts_deleted;
-- DROP INDEX IF EXISTS idx_ai_provider_config_deleted;
--
-- -- Recreate original policies (without soft-delete filter)
-- DROP POLICY IF EXISTS tenant_isolation_users ON tenant_users;
-- DROP POLICY IF EXISTS tenant_isolation_locations ON locations;
-- -- ... (repeat for all policies)
--
-- CREATE POLICY tenant_isolation_users ON tenant_users FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
-- CREATE POLICY tenant_isolation_locations ON locations FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
-- -- ... (repeat for all policies)
--
-- COMMIT;
