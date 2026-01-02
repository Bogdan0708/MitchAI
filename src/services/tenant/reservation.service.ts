
import { Pool } from 'pg';

export class ReservationService {
  constructor(private pool: Pool) {}

  public async getReservationsByTenantId(tenantId: string, queryParams: any) {
    const { date, status } = queryParams;

    let query = `
      SELECT r.*, l.name as location_name, t.table_number
      FROM reservations r
      LEFT JOIN locations l ON r.location_id = l.id
      LEFT JOIN tables t ON r.table_id = t.id
      WHERE r.tenant_id = $1
    `;

    const params: any[] = [tenantId];

    if (date) {
      query += ` AND r.reservation_date = $${params.length + 1}`;
      params.push(date);
    }

    if (status) {
      query += ` AND r.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY r.reservation_date DESC, r.reservation_time DESC`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  public async createReservation(tenantId: string, data: any) {
    const {
      locationId,
      customerName,
      customerEmail,
      customerPhone,
      partySize,
      reservationDate,
      reservationTime,
      specialRequests
    } = data;

    const result = await this.pool.query(
      `INSERT INTO reservations (
        tenant_id, location_id, customer_name, customer_email,
        customer_phone, party_size, reservation_date, reservation_time,
        special_requests
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tenantId,
        locationId,
        customerName,
        customerEmail,
        customerPhone,
        partySize,
        reservationDate,
        reservationTime,
        specialRequests
      ]
    );
    return result.rows[0];
  }
}
