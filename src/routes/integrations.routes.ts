/**
 * INTEGRATIONS ROUTES
 * 
 * API endpoints for third-party integrations (Square, Google Business, etc.)
 */

import { Router, Request, Response } from 'express';
import { pool } from '../lib/db-context';
import { createSquareService, SquareConfig } from '../services/integrations/square.service';

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

export default router;
