
import { Pool } from 'pg';

export class TenantService {
  constructor(private pool: Pool) {}

  public async getTenantById(tenantId: string) {
    const result = await this.pool.query(
      `SELECT
        t.*,
        pt.name as tier_name,
        pt.price_monthly,
        pt.features,
        COUNT(DISTINCT l.id) as location_count,
        COUNT(DISTINCT tu.id) as user_count
      FROM tenants t
      LEFT JOIN pricing_tiers pt ON t.tier_id = pt.id
      LEFT JOIN locations l ON t.id = l.tenant_id AND l.deleted_at IS NULL
      LEFT JOIN tenant_users tu ON t.id = tu.tenant_id AND tu.deleted_at IS NULL
      WHERE t.id = $1
      GROUP BY t.id, pt.id, pt.name, pt.price_monthly, pt.features`,
      [tenantId]
    );
    return result.rows[0];
  }

  public async updateTenant(tenantId: string, data: any) {
    const { name, contactEmail, contactPhone, timezone, locale, settings } = data;
    const mergedSettings = {
      ...(contactPhone ? { contactPhone } : {}),
      ...(timezone ? { timezone } : {}),
      ...(locale ? { locale } : {}),
      ...settings
    };
    const result = await this.pool.query(
      `UPDATE tenants
      SET name = COALESCE($1, name),
          email = COALESCE($2, email),
          settings = settings || $3::jsonb
      WHERE id = $4
      RETURNING *`,
      [name, contactEmail, JSON.stringify(mergedSettings), tenantId]
    );
    return result.rows[0];
  }
}
