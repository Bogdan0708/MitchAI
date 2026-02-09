const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Applying 2FA migration...');
    
    await pool.query(`
      ALTER TABLE tenant_users 
      ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64),
      ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS backup_codes JSONB,
      ADD COLUMN IF NOT EXISTS pending_totp_secret VARCHAR(64),
      ADD COLUMN IF NOT EXISTS pending_backup_codes JSONB
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_users_totp_enabled 
      ON tenant_users(tenant_id, totp_enabled) 
      WHERE totp_enabled = true
    `);
    
    console.log('✅ 2FA migration applied successfully');
    
    // Verify columns exist
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'tenant_users' 
      AND (column_name LIKE '%totp%' OR column_name LIKE '%backup%')
    `);
    console.log('Columns added:', result.rows.map(r => r.column_name).join(', '));
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
