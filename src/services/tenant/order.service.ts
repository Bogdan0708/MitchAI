
import { Pool } from 'pg';

export class OrderService {
  constructor(private pool: Pool) {}

  public async getOrdersByTenantId(tenantId: string, queryParams: any) {
    const { status, limit = 50, offset = 0 } = queryParams;

    let query = `
      SELECT o.*, l.name as location_name
      FROM orders o
      LEFT JOIN locations l ON o.location_id = l.id
      WHERE o.tenant_id = $1
    `;

    const params: any[] = [tenantId];

    if (status) {
      query += ` AND o.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  public async createOrder(tenantId: string, data: any) {
    const {
      locationId,
      orderNumber,
      orderType,
      customerName,
      customerEmail,
      customerPhone,
      items,
      subtotal,
      taxAmount,
      tipAmount,
      discountAmount
    } = data;

    const totalAmount = subtotal + taxAmount + tipAmount - discountAmount;

    // Start transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (
          tenant_id, location_id, order_number, order_type,
          customer_name, customer_email, customer_phone,
          subtotal, tax_amount, tip_amount, discount_amount, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          tenantId,
          locationId,
          orderNumber,
          orderType,
          customerName,
          customerEmail,
          customerPhone,
          subtotal,
          taxAmount,
          tipAmount,
          discountAmount,
          totalAmount
        ]
      );

      const order = orderResult.rows[0];

      // Create order items
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (
            tenant_id, order_id, menu_item_id, item_name,
            quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            tenantId,
            order.id,
            item.menuItemId,
            item.itemName,
            item.quantity,
            item.unitPrice,
            item.totalPrice
          ]
        );
      }

      await client.query('COMMIT');

      return order;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
