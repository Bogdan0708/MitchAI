#!/usr/bin/env node
/**
 * Create Mitch From Transylvania tenant with enterprise access
 * 
 * Required environment variables:
 *   DATABASE_URL     - PostgreSQL connection string
 *   ADMIN_EMAIL      - Admin user email (default: bogdan@mitchfromtransylvania.com)
 *   ADMIN_PASSWORD   - Admin user password (REQUIRED - no default for security)
 *   ADMIN_FIRST_NAME - Admin first name (default: Bogdan)
 *   ADMIN_LAST_NAME  - Admin last name (default: Godja)
 * 
 * Usage:
 *   DATABASE_URL=... ADMIN_PASSWORD=... node scripts/create-mitch-tenant.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Validate required env vars
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

if (!process.env.ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD environment variable is required');
  console.error('   Usage: DATABASE_URL=... ADMIN_PASSWORD=... node scripts/create-mitch-tenant.js');
  process.exit(1);
}

const TENANT_DATA = {
  name: 'Mitch From Transylvania',
  slug: 'mitch-transylvania',
  email: process.env.ADMIN_EMAIL || 'bogdan@mitchfromtransylvania.com',
  settings: {
    brand_voice: 'gothic, witty, Dracula-themed',
    cuisine: 'Romanian street food',
    tagline: 'Authentic Romanian Street Food | Grill | Gothic Vibes'
  }
};

const ADMIN_USER = {
  email: process.env.ADMIN_EMAIL || 'bogdan@mitchfromtransylvania.com',
  password: process.env.ADMIN_PASSWORD,
  firstName: process.env.ADMIN_FIRST_NAME || 'Bogdan',
  lastName: process.env.ADMIN_LAST_NAME || 'Godja',
  role: 'owner'
};

async function main() {
  console.log('Connecting to database...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com') 
      ? { rejectUnauthorized: false } 
      : false
  });

  const client = await pool.connect();
  
  try {
    console.log('Connected. Creating tenant...');
    
    await client.query('BEGIN');

    // Get enterprise tier
    const { rows: tiers } = await client.query(
      `SELECT id FROM pricing_tiers WHERE name = 'enterprise' LIMIT 1`
    );
    const tierId = tiers[0]?.id || 3;
    console.log('Using tier ID:', tierId);

    // Upsert tenant
    const { rows: tenants } = await client.query(`
      INSERT INTO tenants (name, slug, email, tier_id, status, settings)
      VALUES ($1, $2, $3, $4, 'active', $5)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        tier_id = EXCLUDED.tier_id,
        status = 'active',
        settings = EXCLUDED.settings,
        updated_at = NOW()
      RETURNING id
    `, [TENANT_DATA.name, TENANT_DATA.slug, TENANT_DATA.email, tierId, JSON.stringify(TENANT_DATA.settings)]);
    
    const tenantId = tenants[0].id;
    console.log('Tenant ID:', tenantId);

    // Hash password
    const passwordHash = await bcrypt.hash(ADMIN_USER.password, 12);

    // Upsert admin user
    await client.query(`
      INSERT INTO tenant_users (tenant_id, email, password_hash, first_name, last_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        is_active = true
    `, [tenantId, ADMIN_USER.email, passwordHash, ADMIN_USER.firstName, ADMIN_USER.lastName, ADMIN_USER.role]);
    console.log('Admin user created/updated');

    // Create location if not exists
    await client.query(`
      INSERT INTO locations (tenant_id, name, address, city, country, is_active)
      VALUES ($1, 'Mitch From Transylvania', '82A Commercial Street', 'London', 'GB', true)
      ON CONFLICT DO NOTHING
    `, [tenantId]);
    console.log('Location created');

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('✅ TENANT CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log('Tenant ID:', tenantId);
    console.log('Name:', TENANT_DATA.name);
    console.log('Slug:', TENANT_DATA.slug);
    console.log('Tier: Enterprise (full access)');
    console.log('');
    console.log('Login Email:', ADMIN_USER.email);
    console.log('========================================');
    
    // Output just the tenant ID for piping
    console.log('\nTENANT_ID=' + tenantId);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
