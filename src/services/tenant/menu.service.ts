
import { Pool } from 'pg';
import { runInTenantContext } from '../../lib/db-context';

export class MenuService {
  constructor(private pool: Pool) {}

  public async getCategories(tenantId: string) {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM menu_categories
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY display_order`,
        [tenantId]
      );
      return result.rows;
    });
  }

  public async createCategory(tenantId: string, data: { name: string; description?: string; displayOrder?: number }) {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO menu_categories (tenant_id, name, description, display_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [tenantId, data.name, data.description || null, data.displayOrder || 0]
      );
      return result.rows[0];
    });
  }

  public async getMenuItemsByTenantId(tenantId: string) {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT mi.*, mc.name as category_name
        FROM menu_items mi
        LEFT JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE mi.tenant_id = $1 AND mi.deleted_at IS NULL
        ORDER BY mc.display_order, mi.name`,
        [tenantId]
      );
      return result.rows;
    });
  }

  public async createMenuItem(tenantId: string, data: any) {
    // Support both camelCase and snake_case field names
    const categoryId = data.category_id || data.categoryId;
    const name = data.name;
    const description = data.description;
    const price = data.price;
    const sku = data.sku;
    const isAvailable = data.is_available ?? data.isAvailable ?? true;
    const stockQuantity = data.stock_quantity || data.stockQuantity;
    const calories = data.calories;
    const allergens = data.allergens || [];
    const imageUrl = data.image_url || data.imageUrl;

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
