/**
 * ADMIN ROUTES
 * 
 * Protected administrative endpoints for system management.
 * Requires ADMIN_SECRET header for authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// Admin authentication middleware
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const adminSecret = process.env.ADMIN_SECRET || 'mitch-admin-2026';
  const providedSecret = req.headers['x-admin-secret'];
  
  if (providedSecret !== adminSecret) {
    return res.status(403).json({ error: 'Unauthorized - Invalid admin secret' });
  }
  next();
}

export function createAdminRouter(pool: Pool): Router {
  const router = Router();
  
  // Apply admin auth to all routes
  router.use(adminAuth);

  /**
   * POST /admin/tenant/create
   * Create a new tenant with admin user
   */
  router.post('/tenant/create', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { 
        name, 
        slug, 
        email, 
        tier = 'enterprise',
        settings = {},
        admin 
      } = req.body;

      if (!name || !slug || !email) {
        return res.status(400).json({ error: 'name, slug, and email are required' });
      }

      if (!admin?.email || !admin?.password) {
        return res.status(400).json({ error: 'admin.email and admin.password are required' });
      }

      await client.query('BEGIN');

      // Get tier ID
      const tierResult = await client.query(
        `SELECT id FROM pricing_tiers WHERE name = $1`,
        [tier]
      );
      const tierId = tierResult.rows[0]?.id || 3;

      // Create tenant
      const tenantResult = await client.query(`
        INSERT INTO tenants (name, slug, email, tier_id, status, settings)
        VALUES ($1, $2, $3, $4, 'active', $5)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          tier_id = EXCLUDED.tier_id,
          status = 'active',
          settings = EXCLUDED.settings,
          updated_at = NOW()
        RETURNING id, name, slug
      `, [name, slug, email, tierId, JSON.stringify(settings)]);

      const tenant = tenantResult.rows[0];

      // Hash password and create admin user
      const passwordHash = await bcrypt.hash(admin.password, 12);
      await client.query(`
        INSERT INTO tenant_users (tenant_id, email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (tenant_id, email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          role = EXCLUDED.role,
          is_active = true
      `, [tenant.id, admin.email, passwordHash, admin.firstName || 'Admin', admin.lastName || '', admin.role || 'owner']);

      // Create default location if provided
      if (req.body.location) {
        await client.query(`
          INSERT INTO locations (tenant_id, name, address, city, country, is_active)
          VALUES ($1, $2, $3, $4, $5, true)
          ON CONFLICT DO NOTHING
        `, [tenant.id, req.body.location.name || name, req.body.location.address, req.body.location.city, req.body.location.country || 'GB']);
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug
        },
        admin: {
          email: admin.email
        }
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('[Admin] Tenant creation failed:', error.message);
      return res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  /**
   * POST /admin/tenant/upgrade
   * Upgrade a tenant to a different tier
   */
  router.post('/tenant/upgrade', async (req: Request, res: Response) => {
    try {
      const { tenantId, tenantSlug, tier } = req.body;
      const identifier = tenantId || tenantSlug;
      
      if (!identifier) {
        return res.status(400).json({ error: 'tenantId or tenantSlug required' });
      }
      
      if (!tier) {
        return res.status(400).json({ error: 'tier required (starter, professional, enterprise)' });
      }

      // Get tier ID
      const tierResult = await pool.query(
        `SELECT id, name, display_name, features FROM pricing_tiers WHERE name = $1`,
        [tier]
      );
      
      if (tierResult.rows.length === 0) {
        return res.status(400).json({ 
          error: `Invalid tier: ${tier}`,
          validTiers: ['starter', 'professional', 'enterprise']
        });
      }
      
      const tierData = tierResult.rows[0];

      // Update tenant
      const updateResult = await pool.query(`
        UPDATE tenants 
        SET tier_id = $1, status = 'active', updated_at = NOW()
        WHERE slug = $2 OR id::text = $2
        RETURNING id, name, slug, tier_id
      `, [tierData.id, identifier]);
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: `Tenant not found: ${identifier}` });
      }

      const tenant = updateResult.rows[0];
      
      return res.json({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug
        },
        tier: {
          name: tierData.name,
          displayName: tierData.display_name,
          features: tierData.features
        }
      });
    } catch (error: any) {
      console.error('[Admin] Tenant upgrade failed:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /admin/tenants
   * List all tenants with their tiers
   */
  router.get('/tenants', async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT 
          t.id, t.name, t.slug, t.email, t.status,
          pt.name as tier_name, pt.display_name as tier_display_name,
          t.created_at
        FROM tenants t
        JOIN pricing_tiers pt ON t.tier_id = pt.id
        WHERE t.deleted_at IS NULL
        ORDER BY t.created_at DESC
      `);
      
      return res.json({
        count: result.rows.length,
        tenants: result.rows
      });
    } catch (error: any) {
      console.error('[Admin] List tenants failed:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /admin/square/sync
   * Manually trigger Square order sync for a tenant
   */
  router.post('/square/sync', async (req: Request, res: Response) => {
    try {
      const { tenantId, daysBack = 1 } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId required' });
      }

      const { syncSquareOrders } = await import('../jobs/square-sync.job');
      const result = await syncSquareOrders(pool, tenantId, daysBack);

      return res.json(result);
    } catch (error: any) {
      console.error('[Admin] Square sync failed:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /admin/square/sync-all
   * Sync Square orders for all tenants with Square integration
   * Used by cron jobs / scheduled tasks
   */
  router.post('/square/sync-all', async (_req: Request, res: Response) => {
    try {
      // Get all active tenants
      const tenantsResult = await pool.query(`
        SELECT id, name FROM tenants WHERE status = 'active' AND deleted_at IS NULL
      `);

      const { syncSquareOrders } = await import('../jobs/square-sync.job');
      const results = [];

      for (const tenant of tenantsResult.rows) {
        const result = await syncSquareOrders(pool, tenant.id, 1);
        results.push({
          ...result,
          tenantName: tenant.name,
        });
      }

      const totalImported = results.reduce((sum, r) => sum + r.ordersImported, 0);
      const totalSkipped = results.reduce((sum, r) => sum + r.ordersSkipped, 0);

      console.log(`[SquareSync] All tenants: ${totalImported} imported, ${totalSkipped} skipped`);

      return res.json({
        success: true,
        tenantsProcessed: results.length,
        totalOrdersImported: totalImported,
        totalOrdersSkipped: totalSkipped,
        results,
      });
    } catch (error: any) {
      console.error('[Admin] Square sync-all failed:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
