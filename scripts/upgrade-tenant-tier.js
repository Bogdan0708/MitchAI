#!/usr/bin/env node
/**
 * Upgrade a tenant to a different pricing tier
 * 
 * Usage: 
 *   DATABASE_URL=... node scripts/upgrade-tenant-tier.js <tenant-slug-or-id> <tier-name>
 * 
 * Example:
 *   DATABASE_URL=... node scripts/upgrade-tenant-tier.js mitch-from-transylvania enterprise
 */

const { Pool } = require('pg');

async function main() {
  const [,, tenantIdentifier, tierName = 'enterprise'] = process.argv;
  
  if (!tenantIdentifier) {
    console.error('Usage: node upgrade-tenant-tier.js <tenant-slug-or-id> [tier-name]');
    console.error('Tiers: starter, professional, enterprise');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com') 
      ? { rejectUnauthorized: false } 
      : false
  });

  const client = await pool.connect();
  
  try {
    // Get tier ID
    const { rows: tiers } = await client.query(
      `SELECT id, name, display_name, features FROM pricing_tiers WHERE name = $1`,
      [tierName]
    );
    
    if (tiers.length === 0) {
      console.error(`Tier "${tierName}" not found`);
      const { rows: allTiers } = await client.query('SELECT name FROM pricing_tiers');
      console.error('Available tiers:', allTiers.map(t => t.name).join(', '));
      process.exit(1);
    }
    
    const tier = tiers[0];
    console.log(`Upgrading to: ${tier.display_name}`);
    console.log('Features:', JSON.stringify(tier.features, null, 2));

    // Update tenant
    const { rows: updated } = await client.query(`
      UPDATE tenants 
      SET tier_id = $1, status = 'active', updated_at = NOW()
      WHERE slug = $2 OR id::text = $2
      RETURNING id, name, slug
    `, [tier.id, tenantIdentifier]);
    
    if (updated.length === 0) {
      console.error(`Tenant "${tenantIdentifier}" not found`);
      process.exit(1);
    }

    console.log('\n✅ Tenant upgraded successfully!');
    console.log('Tenant:', updated[0].name);
    console.log('Slug:', updated[0].slug);
    console.log('New Tier:', tier.display_name);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
