-- Migration: Add Two-Factor Authentication columns to tenant_users
-- Date: 2026-02-09

-- Add 2FA columns to tenant_users table
ALTER TABLE tenant_users 
ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64),
ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS backup_codes JSONB,
ADD COLUMN IF NOT EXISTS pending_totp_secret VARCHAR(64),
ADD COLUMN IF NOT EXISTS pending_backup_codes JSONB;

-- Add comment for documentation
COMMENT ON COLUMN tenant_users.totp_secret IS 'Base32-encoded TOTP secret for 2FA';
COMMENT ON COLUMN tenant_users.totp_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN tenant_users.totp_enabled_at IS 'When 2FA was enabled';
COMMENT ON COLUMN tenant_users.backup_codes IS 'JSON array of hashed backup codes';
COMMENT ON COLUMN tenant_users.pending_totp_secret IS 'Temporary secret during 2FA setup';
COMMENT ON COLUMN tenant_users.pending_backup_codes IS 'Temporary backup codes during 2FA setup';

-- Create index for checking 2FA status
CREATE INDEX IF NOT EXISTS idx_tenant_users_totp_enabled 
ON tenant_users(tenant_id, totp_enabled) 
WHERE totp_enabled = true;
