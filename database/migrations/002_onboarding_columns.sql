-- Migration: Add onboarding columns
-- Date: 2024-12-13

-- Add onboarding columns to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) DEFAULT 'restaurant';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_step VARCHAR(50) DEFAULT 'business';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Update existing tenants to use email as contact_email
UPDATE tenants SET contact_email = email WHERE contact_email IS NULL;

-- Add additional columns to locations table for onboarding
ALTER TABLE locations ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(500);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- Create unique constraint for tenant + slug on locations if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'locations_tenant_slug_unique'
    ) THEN
        ALTER TABLE locations ADD CONSTRAINT locations_tenant_slug_unique UNIQUE (tenant_id, slug);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- Copy address to address_line1 if not set
UPDATE locations SET address_line1 = address WHERE address_line1 IS NULL AND address IS NOT NULL;

-- Generate slug from name for existing locations without slug
UPDATE locations
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-z0-9]+', '-', 'gi'))
WHERE slug IS NULL;
