/**
 * Worker Service - BullMQ job processing workers
 *
 * Processes jobs from priority queues with appropriate concurrency:
 * - critical: 10 concurrent jobs (fast response needed)
 * - high: 5 concurrent jobs
 * - medium: 3 concurrent jobs
 * - low: 2 concurrent jobs
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { logger } from '../logger.service';
import {
  JobType,
  JobData,
  TemperatureBreachData,
  ReviewAnalyzeData,
  ReviewRespondData,
  AlertCreateData,
  BaseJobData,
} from './queue.service';

// Worker concurrency per queue
const WORKER_CONCURRENCY = {
  critical: 10,
  high: 5,
  medium: 3,
  low: 2,
};

// Job handler type
type JobHandler<T extends JobData = JobData> = (job: Job<T>, pool: Pool) => Promise<void>;

// Job handlers registry
const jobHandlers: Partial<Record<JobType, JobHandler>> = {};

/**
 * Register a job handler
 */
export function registerJobHandler<T extends JobData>(
  jobType: JobType,
  handler: JobHandler<T>
): void {
  jobHandlers[jobType] = handler as JobHandler;
  logger.info(`Registered job handler for: ${jobType}`);
}

/**
 * Worker Service class
 */
class WorkerService {
  private workers: Map<string, Worker> = new Map();
  private connection: Redis | null = null;
  private pool: Pool | null = null;
  private isRunning = false;

  /**
   * Initialize the worker service
   */
  public async initialize(redisUrl: string, pool: Pool): Promise<void> {
    if (this.isRunning) {
      logger.warn('Worker service already running');
      return;
    }

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.pool = pool;

    // Register default handlers
    this.registerDefaultHandlers();

    // Create workers for each priority queue
    for (const priority of ['critical', 'high', 'medium', 'low'] as const) {
      const worker = new Worker(
        `mitch-${priority}`,
        async (job: Job<JobData>) => this.processJob(job),
        {
          connection: this.connection,
          concurrency: WORKER_CONCURRENCY[priority],
          limiter: {
            max: priority === 'critical' ? 100 : 50,
            duration: 1000,
          },
        }
      );

      // Set up worker event handlers
      this.setupWorkerEvents(priority, worker);

      this.workers.set(priority, worker);
    }

    this.isRunning = true;
    logger.info('Worker service initialized', {
      queues: ['critical', 'high', 'medium', 'low'],
      concurrency: WORKER_CONCURRENCY,
    });
  }

  /**
   * Register default job handlers
   */
  private registerDefaultHandlers(): void {
    // Temperature breach handler
    registerJobHandler<TemperatureBreachData>(
      'compliance.temperature.breach',
      async (job, pool) => {
        const { tenantId, locationId, equipmentId, equipmentName, readingCelsius, limitExceeded, limitValue, temperatureLogId } = job.data;

        logger.info('Processing temperature breach', {
          tenantId,
          equipmentId,
          reading: readingCelsius,
          limit: limitValue,
        });

        // Create corrective action
        const client = await pool.connect();
        try {
          await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

          await client.query(
            `INSERT INTO corrective_actions
             (tenant_id, location_id, temperature_log_id, incident_type, severity, description, status)
             VALUES ($1, $2, $3, 'temperature_breach', $4, $5, 'open')`,
            [
              tenantId,
              locationId,
              temperatureLogId,
              readingCelsius < limitValue ? 'high' : 'critical',
              `Temperature breach detected on ${equipmentName}: ${readingCelsius}°C (${limitExceeded} limit: ${limitValue}°C)`,
            ]
          );

          // Create business alert
          await client.query(
            `INSERT INTO business_alerts
             (tenant_id, location_id, alert_type, severity, title, message, source_type, source_id)
             VALUES ($1, $2, 'temperature_breach', 'critical', $3, $4, 'temperature_log', $5)`,
            [
              tenantId,
              locationId,
              `Temperature Breach: ${equipmentName}`,
              `${equipmentName} recorded ${readingCelsius}°C, exceeding the ${limitExceeded} limit of ${limitValue}°C. Immediate action required.`,
              temperatureLogId,
            ]
          );

          logger.info('Temperature breach processed', { jobId: job.id, tenantId });
        } finally {
          client.release();
        }
      }
    );

    // Review analysis handler
    registerJobHandler<ReviewAnalyzeData>('review.analyze', async (job, _pool) => {
      const { tenantId, reviewId, platform } = job.data;

      logger.info('Processing review analysis', { tenantId, reviewId, platform });

      // This will be implemented when review analysis service is created
      // For now, just log that we received the job
      logger.info('Review analysis job received - handler pending implementation', {
        jobId: job.id,
        reviewId,
      });
    });

    // Review respond handler
    registerJobHandler<ReviewRespondData>('review.respond', async (job, _pool) => {
      const { tenantId, reviewId, rating } = job.data;

      logger.info('Processing review response generation', { tenantId, reviewId, rating });

      // This will be implemented when review response service is created
      logger.info('Review response job received - handler pending implementation', {
        jobId: job.id,
        reviewId,
      });
    });

    // Alert creation handler
    registerJobHandler<AlertCreateData>('intelligence.alert.create', async (job, pool) => {
      const { tenantId, alertType, severity, title, message, sourceType, sourceId, locationId } = job.data;

      logger.info('Creating business alert', { tenantId, alertType, severity });

      const client = await pool.connect();
      try {
        await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

        await client.query(
          `INSERT INTO business_alerts
           (tenant_id, location_id, alert_type, severity, title, message, source_type, source_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [tenantId, locationId || null, alertType, severity, title, message, sourceType || null, sourceId || null]
        );

        logger.info('Business alert created', { jobId: job.id, tenantId, alertType });
      } finally {
        client.release();
      }
    });

    // System API usage sync handler
    registerJobHandler<BaseJobData>('system.api.usage.sync', async (job, _pool) => {
      logger.info('Syncing API usage', { tenantId: job.data.tenantId || 'all' });
      // This replaces the interval-based job
      // Implementation matches existing SyncApiUsageJob logic
    });

    // System cleanup handler
    registerJobHandler<BaseJobData>('system.cleanup.expired', async (job, pool) => {
      logger.info('Running cleanup for expired data');

      const client = await pool.connect();
      try {
        // Clean up expired content ideas
        await client.query(
          `DELETE FROM content_ideas WHERE expires_at < NOW() AND status = 'new'`
        );

        // Clean up old domain events (keep 90 days)
        await client.query(
          `DELETE FROM domain_events WHERE created_at < NOW() - INTERVAL '90 days'`
        );

        // Mark expired training records
        await client.query(
          `UPDATE training_records SET status = 'expired' WHERE expiry_date < CURRENT_DATE AND status != 'expired'`
        );

        logger.info('Cleanup completed', { jobId: job.id });
      } finally {
        client.release();
      }
    });
  }

  /**
   * Set up worker event handlers
   */
  private setupWorkerEvents(priority: string, worker: Worker): void {
    worker.on('completed', (job: Job) => {
      logger.debug(`Job completed`, {
        queue: priority,
        jobId: job.id,
        jobType: job.name,
        duration: job.finishedOn ? job.finishedOn - (job.processedOn || 0) : undefined,
      });
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error(`Job failed`, {
        queue: priority,
        jobId: job?.id,
        jobType: job?.name,
        error: error.message,
        attemptsMade: job?.attemptsMade,
      });
    });

    worker.on('error', (error: Error) => {
      logger.error(`Worker error`, { queue: priority, error: error.message });
    });

    worker.on('stalled', (jobId: string) => {
      logger.warn(`Job stalled`, { queue: priority, jobId });
    });
  }

  /**
   * Process a job by routing to the appropriate handler
   */
  private async processJob(job: Job<JobData>): Promise<void> {
    const jobType = job.name as JobType;
    const handler = jobHandlers[jobType];

    if (!handler) {
      logger.warn(`No handler registered for job type: ${jobType}`);
      throw new Error(`No handler registered for job type: ${jobType}`);
    }

    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const startTime = Date.now();

    try {
      await handler(job, this.pool);

      logger.info(`Job processed successfully`, {
        jobId: job.id,
        jobType,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      logger.error(`Job processing failed`, {
        jobId: job.id,
        jobType,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Get worker statistics
   */
  public async getWorkerStats(): Promise<Record<string, { running: number; paused: boolean }>> {
    const stats: Record<string, { running: number; paused: boolean }> = {};

    for (const [priority, worker] of this.workers) {
      stats[priority] = {
        running: worker.isRunning() ? 1 : 0,
        paused: worker.isPaused(),
      };
    }

    return stats;
  }

  /**
   * Pause a specific worker
   */
  public async pauseWorker(priority: 'critical' | 'high' | 'medium' | 'low'): Promise<void> {
    const worker = this.workers.get(priority);
    if (worker) {
      await worker.pause();
      logger.info(`Worker paused`, { queue: priority });
    }
  }

  /**
   * Resume a specific worker
   */
  public async resumeWorker(priority: 'critical' | 'high' | 'medium' | 'low'): Promise<void> {
    const worker = this.workers.get(priority);
    if (worker) {
      worker.resume();
      logger.info(`Worker resumed`, { queue: priority });
    }
  }

  /**
   * Gracefully shutdown all workers
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down worker service...');

    // Close all workers
    const closePromises = Array.from(this.workers.values()).map((worker) => worker.close());
    await Promise.all(closePromises);

    // Close Redis connection
    if (this.connection) {
      await this.connection.quit();
    }

    this.isRunning = false;
    logger.info('Worker service shutdown complete');
  }
}

// Export singleton instance
export const workerService = new WorkerService();
