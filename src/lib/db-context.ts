import { Pool, PoolClient } from 'pg';

/**
 * Executes a callback with a database client configured for a specific tenant.
 * Uses a transaction to ensure RLS settings are applied and rolled back correctly.
 * 
 * @param pool The PostgreSQL connection pool
 * @param tenantId The ID of the tenant to assume identity for
 * @param callback A function that receives the configured client
 */
export async function runInTenantContext<T>(
  pool: Pool, 
  tenantId: string, 
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Set the tenant ID for RLS
    // 'true' as third param means "is_local" - affects only current transaction
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
