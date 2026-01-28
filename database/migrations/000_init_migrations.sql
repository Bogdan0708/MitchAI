-- Migration tracking table
-- This migration must be run first to enable migration tracking

CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    checksum VARCHAR(64),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_time_ms INTEGER
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);

-- Insert this migration as completed
INSERT INTO schema_migrations (filename, checksum)
VALUES ('000_init_migrations.sql', 'init')
ON CONFLICT (filename) DO NOTHING;
