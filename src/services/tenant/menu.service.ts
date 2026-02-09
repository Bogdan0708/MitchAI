
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

  public async updateMenuItem(tenantId: string, itemId: string, data: any) {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Build dynamic update query based on provided fields
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const fieldMappings: Record<string, string> = {
        name: 'name',
        description: 'description',
        price: 'price',
        categoryId: 'category_id',
        category_id: 'category_id',
        sku: 'sku',
        isAvailable: 'is_available',
        is_available: 'is_available',
        stockQuantity: 'stock_quantity',
        stock_quantity: 'stock_quantity',
        calories: 'calories',
        allergens: 'allergens',
        imageUrl: 'image_url',
        image_url: 'image_url',
        aiDescription: 'ai_description',
        ai_description: 'ai_description',
      };

      for (const [key, dbColumn] of Object.entries(fieldMappings)) {
        if (data[key] !== undefined) {
          updates.push(`${dbColumn} = $${paramIndex}`);
          values.push(data[key]);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        // No fields to update, just return the existing item
        const result = await client.query(
          'SELECT * FROM menu_items WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
          [itemId, tenantId]
        );
        return result.rows[0];
      }

      updates.push('updated_at = NOW()');
      values.push(itemId, tenantId);

      const result = await client.query(
        `UPDATE menu_items 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} AND deleted_at IS NULL
         RETURNING *`,
        values
      );
      return result.rows[0];
    });
  }

  public async deleteMenuItem(tenantId: string, itemId: string) {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE menu_items 
         SET deleted_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [itemId, tenantId]
      );
      return result.rows.length > 0;
    });
  }
}
