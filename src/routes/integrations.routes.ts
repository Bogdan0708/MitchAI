/**
 * INTEGRATIONS ROUTES
 * 
 * API endpoints for third-party integrations (Square, Google Business, etc.)
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { createSquareService, SquareConfig } from '../services/integrations/square.service';

export function createIntegrationsRouter(pool: Pool): Router {
  const router = Router();

// ============================================================================
// SQUARE INTEGRATION
// ============================================================================

/**
 * GET /integrations/square/status
 * Check Square connection status
 */
router.get('/square/status', async (req: Request, res: Response) => {
  try {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const applicationId = process.env.SQUARE_APP_ID;

    if (!accessToken || !applicationId) {
      return res.status(200).json({
        connected: false,
        message: 'Square credentials not configured',
      });
    }

    const config: SquareConfig = {
      accessToken,
      applicationId,
      environment: 'production',
    };

    const service = createSquareService(config);
    const merchant = await service.getMerchant();
    const locations = await service.getLocations();

    return res.json({
      connected: true,
      merchant: {
        id: merchant.id,
        name: merchant.businessName,
        currency: merchant.currency,
      },
      locations: locations.map(l => ({
        id: l.id,
        name: l.name,
        address: l.address,
      })),
    });
  } catch (error: any) {
    console.error('[Square] Status check failed:', error.message);
    return res.status(200).json({
      connected: false,
      error: error.message,
    });
  }
});

/**
 * GET /integrations/square/catalog
 * Get menu items from Square (preview before sync)
 */
router.get('/square/catalog', async (req: Request, res: Response) => {
  try {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const applicationId = process.env.SQUARE_APP_ID;

    if (!accessToken || !applicationId) {
      return res.status(400).json({ error: 'Square credentials not configured' });
    }

    const config: SquareConfig = {
      accessToken,
      applicationId,
      environment: 'production',
    };

    const service = createSquareService(config);
    const { items, categories } = await service.getCatalog();

    return res.json({
      itemCount: items.length,
      categoryCount: categories.length,
      categories: categories.map(c => c.name),
      items: items.map(item => ({
        name: item.name,
        price: (item.price / 100).toFixed(2),
        currency: item.currency,
        category: item.categoryName,
        available: item.isAvailable,
      })),
    });
  } catch (error: any) {
    console.error('[Square] Catalog fetch failed:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /integrations/square/sync
 * Sync Square catalog to database
 */
router.post('/square/sync', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const applicationId = process.env.SQUARE_APP_ID;

    if (!accessToken || !applicationId) {
      return res.status(400).json({ error: 'Square credentials not configured' });
    }

    const config: SquareConfig = {
      accessToken,
      applicationId,
      environment: 'production',
    };

    const service = createSquareService(config);
    const result = await service.syncToDatabase(pool, tenantId);

    return res.json({
      success: result.success,
      itemsSynced: result.itemsSynced,
      categoriesSynced: result.categoriesSynced,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('[Square] Sync failed:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /integrations/square/orders
 * Get recent orders from Square
 */
router.get('/square/orders', async (req: Request, res: Response) => {
  try {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const applicationId = process.env.SQUARE_APP_ID;

    if (!accessToken || !applicationId) {
      return res.status(400).json({ error: 'Square credentials not configured' });
    }

    const config: SquareConfig = {
      accessToken,
      applicationId,
      environment: 'production',
    };

    // Default to last 7 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const service = createSquareService(config);
    const orders = await service.getOrders(startDate);

    return res.json({
      orderCount: orders.length,
      orders: orders.map(order => ({
        id: order.id,
        createdAt: order.createdAt,
        total: (order.totalMoney / 100).toFixed(2),
        currency: order.currency,
        state: order.state,
        items: order.lineItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          total: (item.totalMoney / 100).toFixed(2),
        })),
      })),
    });
  } catch (error: any) {
    console.error('[Square] Orders fetch failed:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /integrations/square/orders/import
 * Import historical orders from Square into the database
 */
router.post('/square/orders/import', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required (ISO format)' });
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const applicationId = process.env.SQUARE_APP_ID;

    if (!accessToken || !applicationId) {
      return res.status(400).json({ error: 'Square credentials not configured' });
    }

    const config: SquareConfig = {
      accessToken,
      applicationId,
      environment: 'production',
    };

    const service = createSquareService(config);
    
    // Fetch orders from Square
    const orders = await service.getOrders(new Date(startDate), new Date(endDate));
    console.log(`[Square] Fetched ${orders.length} orders from ${startDate} to ${endDate}`);

    // Get location for tenant
    const locationResult = await pool.query(
      `SELECT id FROM locations WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    
    if (locationResult.rows.length === 0) {
      return res.status(400).json({ error: 'No location found for tenant' });
    }
    const locationId = locationResult.rows[0].id;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const order of orders) {
      try {
        // Check if order already exists (by Square ID stored in notes)
        const existing = await pool.query(
          `SELECT id FROM orders WHERE tenant_id = $1 AND notes LIKE $2`,
          [tenantId, `%square_id:${order.id}%`]
        );

        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        // Generate order number
        const orderNumber = `SQ-${order.id.substring(0, 8).toUpperCase()}`;
        
        // Calculate totals (amounts are in pence)
        const subtotal = (order.totalMoney - (order.taxMoney || 0)) / 100;
        const taxAmount = (order.taxMoney || 0) / 100;
        const totalAmount = order.totalMoney / 100;

        // Insert order
        const orderResult = await pool.query(`
          INSERT INTO orders (
            tenant_id, location_id, order_number, order_type, status,
            subtotal, tax_amount, total_amount, payment_status, payment_method,
            notes, source, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `, [
          tenantId,
          locationId,
          orderNumber,
          'takeaway', // Default for Square orders
          'completed',
          subtotal,
          taxAmount,
          totalAmount,
          'paid',
          'square',
          `Imported from Square | square_id:${order.id}`,
          'square',
          order.createdAt
        ]);

        const orderId = orderResult.rows[0].id;

        // Insert order items
        for (const item of order.lineItems) {
          await pool.query(`
            INSERT INTO order_items (
              tenant_id, order_id, name, quantity, unit_price, total_price, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            tenantId,
            orderId,
            item.name,
            item.quantity,
            (item.basePriceMoney || item.totalMoney) / 100,
            item.totalMoney / 100,
            item.variationName || null
          ]);
        }

        imported++;
      } catch (err: any) {
        errors.push(`Order ${order.id}: ${err.message}`);
      }
    }

    console.log(`[Square] Import complete: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);

    return res.json({
      success: true,
      totalFetched: orders.length,
      imported,
      skipped,
      errors: errors.slice(0, 10), // Limit error output
    });
  } catch (error: any) {
    console.error('[Square] Orders import failed:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

  return router;
}
