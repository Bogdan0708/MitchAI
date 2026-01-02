
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
    const result = await this.pool.query(
      `UPDATE tenants
      SET name = COALESCE($1, name),
          contact_email = COALESCE($2, contact_email),
          contact_phone = COALESCE($3, contact_phone),
          timezone = COALESCE($4, timezone),
          locale = COALESCE($5, locale),
          settings = COALESCE($6, settings)
      WHERE id = $7
      RETURNING *`,
      [name, contactEmail, contactPhone, timezone, locale, settings, tenantId]
    );
    return result.rows[0];
  }
}
