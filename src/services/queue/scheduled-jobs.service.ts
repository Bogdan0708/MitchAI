/**
 * Scheduled Jobs Service
 *
 * Sets up recurring jobs using BullMQ repeat patterns.
 * Replaces the old interval-based background jobs.
 */

import { addRecurringJob, BaseJobData } from './queue.service';
import { logger } from '../logger.service';

// System tenant ID for global jobs
const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Scheduled Jobs Configuration
 */
const SCHEDULED_JOBS = [
  {
    jobType: 'system.api.usage.sync' as const,
    cronPattern: '*/1 * * * *', // Every minute
    description: 'Sync API usage from Redis to database',
  },
  {
    jobType: 'system.cleanup.expired' as const,
    cronPattern: '0 3 * * *', // Daily at 3 AM
    description: 'Clean up expired data and records',
  },
  {
    jobType: 'system.ai.budget.reset' as const,
    cronPattern: '0 0 1 * *', // First day of month at midnight
    description: 'Reset monthly AI usage budgets',
  },
  {
    jobType: 'system.ai.budget.check' as const,
    cronPattern: '0 */6 * * *', // Every 6 hours
    description: 'Check AI budget thresholds and send warnings',
  },
];

class ScheduledJobsService {
  private isInitialized = false;

  /**
   * Initialize all scheduled jobs
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Scheduled jobs service already initialized');
      return;
    }

    try {
      for (const job of SCHEDULED_JOBS) {
        await addRecurringJob<BaseJobData>(
          job.jobType,
          {
            tenantId: SYSTEM_TENANT_ID,
            metadata: { scheduled: true, description: job.description },
          },
          job.cronPattern,
          {
            jobId: `scheduled-${job.jobType}`,
          }
        );

        logger.info(`Scheduled job registered`, {
          jobType: job.jobType,
          cronPattern: job.cronPattern,
          description: job.description,
        });
      }

      this.isInitialized = true;
      logger.info('Scheduled jobs service initialized', {
        jobCount: SCHEDULED_JOBS.length,
      });
    } catch (error) {
      logger.error('Failed to initialize scheduled jobs', { error });
      throw error;
    }
  }

  /**
   * Schedule a compliance check reminder for a specific tenant
   */
  public async scheduleComplianceReminder(
    tenantId: string,
    locationId: string,
    checkType: string,
    scheduledAt: Date
  ): Promise<void> {
    const delayMs = scheduledAt.getTime() - Date.now();

    if (delayMs <= 0) {
      logger.warn('Cannot schedule reminder in the past', {
        tenantId,
        checkType,
        scheduledAt,
      });
      return;
    }

    const { addDelayedJob } = await import('./queue.service');
    await addDelayedJob(
      'compliance.check.reminder',
      {
        tenantId,
        locationId,
        checkType,
        scheduledAt: scheduledAt.toISOString(),
      },
      delayMs,
      {
        jobId: `reminder-${tenantId}-${checkType}-${scheduledAt.getTime()}`,
      }
    );

    logger.info('Compliance reminder scheduled', {
      tenantId,
      checkType,
      scheduledAt,
    });
  }

  /**
   * Schedule training expiration alerts
   */
  public async scheduleTrainingExpirationAlert(
    tenantId: string,
    userId: string,
    courseName: string,
    expiryDate: Date,
    daysBeforeWarning: number = 30
  ): Promise<void> {
    const warningDate = new Date(expiryDate);
    warningDate.setDate(warningDate.getDate() - daysBeforeWarning);

    const delayMs = warningDate.getTime() - Date.now();

    if (delayMs <= 0) {
      // Already past warning date, send immediately
      const { addJob } = await import('./queue.service');
      await addJob('compliance.training.expiring', {
        tenantId,
        metadata: { userId, courseName, expiryDate: expiryDate.toISOString() },
      });
      return;
    }

    const { addDelayedJob } = await import('./queue.service');
    await addDelayedJob(
      'compliance.training.expiring',
      {
        tenantId,
        metadata: { userId, courseName, expiryDate: expiryDate.toISOString() },
      },
      delayMs,
      {
        jobId: `training-expiry-${tenantId}-${userId}-${expiryDate.getTime()}`,
      }
    );

    logger.info('Training expiration alert scheduled', {
      tenantId,
      userId,
      courseName,
      warningDate,
    });
  }

  /**
   * Schedule content publishing
   */
  public async scheduleContentPublish(
    tenantId: string,
    contentId: string,
    platforms: string[],
    publishAt: Date
  ): Promise<void> {
    const delayMs = publishAt.getTime() - Date.now();

    if (delayMs <= 0) {
      // Publish immediately
      const { addJob } = await import('./queue.service');
      await addJob('content.publish', {
        tenantId,
        contentId,
        platforms,
      });
      return;
    }

    const { addDelayedJob } = await import('./queue.service');
    await addDelayedJob(
      'content.publish',
      {
        tenantId,
        contentId,
        platforms,
        scheduledAt: publishAt.toISOString(),
      },
      delayMs,
      {
        jobId: `content-publish-${contentId}-${publishAt.getTime()}`,
      }
    );

    logger.info('Content publish scheduled', {
      tenantId,
      contentId,
      platforms,
      publishAt,
    });
  }

  /**
   * Schedule review sync for a tenant
   */
  public async scheduleReviewSync(
    tenantId: string,
    platform: string,
    locationId?: string
  ): Promise<void> {
    const { addJob } = await import('./queue.service');

    await addJob('review.sync', {
      tenantId,
      platform,
      locationId,
    });

    logger.info('Review sync job queued', {
      tenantId,
      platform,
      locationId,
    });
  }

  /**
   * Get list of scheduled jobs
   */
  public getScheduledJobs(): typeof SCHEDULED_JOBS {
    return SCHEDULED_JOBS;
  }
}

// Export singleton instance
export const scheduledJobsService = new ScheduledJobsService();
