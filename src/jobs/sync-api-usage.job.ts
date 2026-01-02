import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { logger } from '../services/logger.service';

export class SyncApiUsageJob {
  private SYNC_INTERVAL_SECONDS = 60; // Sync every minute

  constructor(private pool: Pool, private redis: Redis) {}

  public start() {
    logger.info(`Starting API usage synchronization job, running every ${this.SYNC_INTERVAL_SECONDS} seconds.`);
    setInterval(() => this.syncUsage(), this.SYNC_INTERVAL_SECONDS * 1000);
  }

  private async syncUsage() {
    logger.debug('Running API usage synchronization...');
    let client;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');

      const apiCallKeys = await this.redis.keys('tenant:api_calls:*');
      if (apiCallKeys.length === 0) {
        logger.debug('No API usage data in Redis to sync.');
        await client.query('COMMIT');
        return;
      }

      for (const key of apiCallKeys) {
        const tenantId = key.split(':')[2];
        const monthlyCountStr = await this.redis.hget(key, 'monthly_count');
        const monthlyCount = parseInt(monthlyCountStr || '0', 10);

        if (monthlyCount > 0) {
          await client.query(
            `UPDATE tenants
             SET api_calls_this_month = api_calls_this_month + $1
             WHERE id = $2`,
            [monthlyCount, tenantId]
          );
          await this.redis.hset(key, 'monthly_count', '0'); // Reset Redis counter after syncing
          logger.debug(`Synced ${monthlyCount} API calls for tenant ${tenantId}`);
        }
      }

      await client.query('COMMIT');
      logger.info('API usage synchronization completed successfully.');
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      logger.error('Error during API usage synchronization', {
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack
        }
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
}
