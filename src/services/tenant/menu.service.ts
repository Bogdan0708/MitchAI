
import { Pool } from 'pg';
import { runInTenantContext } from '../../lib/db-context';

export class MenuService {
  constructor(private pool: Pool) {}

  public async getMenuItemsByTenantId(tenantId: string) {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT mi.*, mc.name as category_name
        FROM menu_items mi
        LEFT JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE mi.tenant_id = $1 AND mi.deleted_at IS NULL
        ORDER BY mc.sort_order, mi.sort_order`,
        [tenantId]
      );
      return result.rows;
    });
  }

  public async createMenuItem(tenantId: string, data: any) {
    const {
      categoryId,
      name,
      description,
      price,
      sku,
      isAvailable,
      stockQuantity,
      calories,
      allergens,
      imageUrl
    } = data;

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO menu_items (
          tenant_id, category_id, name, description, price,
          sku, is_available, stock_quantity, calories, allergens, image_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          tenantId,
          categoryId,
          name,
          description,
          price,
          sku,
          isAvailable,
          stockQuantity,
          calories,
          allergens,
          imageUrl
        ]
      );
      return result.rows[0];
    });
  }
}
