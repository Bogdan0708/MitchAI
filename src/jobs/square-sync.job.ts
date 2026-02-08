/**
 * Square Sync Job
 * 
 * Syncs orders from Square POS to the database.
 * Designed to be triggered by cron or manually.
 */

import { Pool } from 'pg';
import { createSquareService, SquareConfig } from '../services/integrations/square.service';

export interface SquareSyncResult {
  success: boolean;
  tenantId: string;
  ordersImported: number;
  ordersSkipped: number;
  errors: string[];
  syncedAt: Date;
}

export async function syncSquareOrders(
  pool: Pool,
  tenantId: string,
  daysBack: number = 1
): Promise<SquareSyncResult> {
  const result: SquareSyncResult = {
    success: false,
    tenantId,
    ordersImported: 0,
    ordersSkipped: 0,
    errors: [],
    syncedAt: new Date(),
  };

  try {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const applicationId = process.env.SQUARE_APP_ID;

    if (!accessToken || !applicationId) {
      result.errors.push('Square credentials not configured');
      return result;
    }

    const config: SquareConfig = {
      accessToken,
      applicationId,
      environment: 'production',
    };

    const service = createSquareService(config);

    // Get orders from last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const endDate = new Date();

    const orders = await service.getOrders(startDate, endDate);
    console.log(`[SquareSync] Fetched ${orders.length} orders for tenant ${tenantId}`);

    // Get location
    const locationResult = await pool.query(
      `SELECT id FROM locations WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );

    if (locationResult.rows.length === 0) {
      result.errors.push('No location found for tenant');
      return result;
    }
    const locationId = locationResult.rows[0].id;

    // Import orders
    for (const order of orders) {
      try {
        // Check if exists
        const existing = await pool.query(
          `SELECT o.id, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
           FROM orders o WHERE o.tenant_id = $1 AND o.notes LIKE $2`,
          [tenantId, `%square_id:${order.id}%`]
        );

        if (existing.rows.length > 0) {
          if (existing.rows[0].item_count > 0) {
            result.ordersSkipped++;
            continue;
          }
          // Delete malformed order
          await pool.query(`DELETE FROM orders WHERE id = $1`, [existing.rows[0].id]);
        }

        // Transaction for order + items
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const orderNumber = `SQ-${order.id.substring(0, 8).toUpperCase()}`;
          const subtotal = (order.totalMoney - (order.taxMoney || 0)) / 100;
          const taxAmount = (order.taxMoney || 0) / 100;
          const totalAmount = order.totalMoney / 100;

          const orderResult = await client.query(`
            INSERT INTO orders (
              tenant_id, location_id, order_number, order_type, status,
              subtotal, tax_amount, total_amount, payment_status, payment_method,
              notes, source, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
          `, [
            tenantId, locationId, orderNumber, 'takeaway', 'completed',
            subtotal, taxAmount, totalAmount, 'paid', 'square',
            `Imported from Square | square_id:${order.id}`, 'square', order.createdAt
          ]);

          const orderId = orderResult.rows[0].id;

          for (const item of order.lineItems) {
            await client.query(`
              INSERT INTO order_items (tenant_id, order_id, name, quantity, unit_price, total_price, notes)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              tenantId, orderId, item.name, item.quantity,
              (item.basePriceMoney || item.totalMoney) / 100,
              item.totalMoney / 100, item.variationName || null
            ]);
          }

          await client.query('COMMIT');
          result.ordersImported++;
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      } catch (err: any) {
        result.errors.push(`Order ${order.id}: ${err.message}`);
      }
    }

    result.success = true;
    console.log(`[SquareSync] Complete: ${result.ordersImported} imported, ${result.ordersSkipped} skipped`);
  } catch (err: any) {
    result.errors.push(err.message);
    console.error('[SquareSync] Failed:', err.message);
  }

  return result;
}
