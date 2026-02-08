/**
 * ADMIN ROUTES
 * 
 * Protected administrative endpoints for system management.
 * Requires ADMIN_SECRET header for authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

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

  return router;
}
