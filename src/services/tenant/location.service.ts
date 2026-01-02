
import { Pool } from 'pg';

export class LocationService {
  constructor(private pool: Pool) {}

  public async getLocationsByTenantId(tenantId: string) {
    const result = await this.pool.query(
      `SELECT * FROM locations
      WHERE tenant_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  public async createLocation(tenantId: string, data: any) {
    const {
      name,
      slug,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      phone,
      email,
      operatingHours
    } = data;

    const result = await this.pool.query(
      `INSERT INTO locations (
        tenant_id, name, slug, address_line1, address_line2,
        city, state, postal_code, country, phone, email, operating_hours
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        tenantId,
        name,
        slug,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        phone,
        email,
        operatingHours
      ]
    );
    return result.rows[0];
  }
}
