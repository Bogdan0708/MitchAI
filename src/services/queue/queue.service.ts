/**
 * Queue Service - BullMQ-based job queue infrastructure
 *
 * Provides priority-based job queues for async processing:
 * - critical: Alerts, temperature breaches, security events
 * - high: Review responses, compliance checks, notifications
 * - medium: Content scheduling, platform sync, analytics
 * - low: Reports, batch operations, data cleanup
 */

import { Queue, QueueEvents, Job, JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../logger.service';

// Job type definitions
export type JobType =
  // Compliance Module
  | 'compliance.check.reminder'
  | 'compliance.check.overdue'
  | 'compliance.temperature.breach'
  | 'compliance.training.expiring'
  | 'compliance.audit.generate'
  // Review Module
  | 'review.sync'
  | 'review.analyze'
  | 'review.respond'
  | 'review.insights.generate'
  | 'review.alert.negative'
  | 'review.generateResponse'
  // Content Module
  | 'content.publish'
  | 'content.ideas.generate'
  | 'content.analytics.sync'
  | 'content.media.process'
  | 'content.sync.account'
  // Intelligence Module
  | 'intelligence.insights.generate'
  | 'intelligence.alert.create'
  | 'intelligence.correlation.analyze'
  | 'intelligence.generate'
  // Alert Module
  | 'alert.notify'
  | 'alert.create'
  // Automation Module
  | 'automation.email'
  | 'automation.sms'
  | 'automation.slack'
  | 'automation.push'
  | 'automation.task'
  | 'automation.escalate'
  | 'automation.webhook'
  // System Jobs
  | 'system.api.usage.sync'
  | 'system.cleanup.expired'
  | 'system.ai.budget.reset'
  | 'system.ai.budget.check';

// Job priority mapping
const JOB_PRIORITY_MAP: Record<JobType, 'critical' | 'high' | 'medium' | 'low'> = {
  // Critical - immediate attention required
  'compliance.temperature.breach': 'critical',
  'intelligence.alert.create': 'critical',
  'review.alert.negative': 'critical',
  'alert.create': 'critical',

  // High - important business operations
  'compliance.check.reminder': 'high',
  'compliance.check.overdue': 'high',
  'review.analyze': 'high',
  'review.respond': 'high',
  'review.generateResponse': 'high',
  'content.publish': 'high',
  'alert.notify': 'high',
  'automation.escalate': 'high',

  // Medium - regular operations
  'compliance.training.expiring': 'medium',
  'compliance.audit.generate': 'medium',
  'review.sync': 'medium',
  'review.insights.generate': 'medium',
  'content.ideas.generate': 'medium',
  'content.analytics.sync': 'medium',
  'content.media.process': 'medium',
  'intelligence.insights.generate': 'medium',
  'intelligence.correlation.analyze': 'medium',
  'intelligence.generate': 'medium',
  'automation.email': 'medium',
  'automation.sms': 'medium',
  'automation.slack': 'medium',
  'automation.push': 'medium',
  'automation.task': 'medium',
  'automation.webhook': 'medium',
  'system.api.usage.sync': 'medium',
  'system.ai.budget.check': 'medium',

  // Low - background tasks
  'system.cleanup.expired': 'low',
  'system.ai.budget.reset': 'low',
  'content.sync.account': 'low',
};

// Queue configuration
const QUEUE_CONFIG = {
  critical: {
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential' as const, delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  },
  high: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 2000 },
      removeOnComplete: { age: 86400 }, // 24 hours
      removeOnFail: { age: 604800 }, // 7 days
    },
  },
  medium: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
      removeOnComplete: { age: 43200 }, // 12 hours
      removeOnFail: { age: 259200 }, // 3 days
    },
  },
  low: {
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed' as const, delay: 10000 },
      removeOnComplete: { age: 3600 }, // 1 hour
      removeOnFail: { age: 86400 }, // 1 day
    },
  },
};

// Job data types
export interface BaseJobData {
  tenantId: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ComplianceCheckReminderData extends BaseJobData {
  locationId: string;
  checkType: string;
  scheduledAt: string;
}

export interface TemperatureBreachData extends BaseJobData {
  locationId: string;
  equipmentId: string;
  equipmentName: string;
  readingCelsius: number;
  limitExceeded: 'upper' | 'lower';
  limitValue: number;
  temperatureLogId: string;
}

export interface ReviewSyncData extends BaseJobData {
  platform: string;
  locationId?: string;
}

export interface ReviewAnalyzeData extends BaseJobData {
  reviewId: string;
  reviewText: string;
  platform: string;
}

export interface ReviewRespondData extends BaseJobData {
  reviewId: string;
  reviewText: string;
  rating: number;
  restaurantName: string;
  tone?: string;
}

export interface ContentPublishData extends BaseJobData {
  contentId: string;
  platforms: string[];
  scheduledAt?: string;
}

export interface AlertCreateData extends BaseJobData {
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  sourceType?: string;
  sourceId?: string;
  locationId?: string;
}

export interface InsightsGenerateData extends BaseJobData {
  insightType: string;
  dateRange?: { start: string; end: string };
  locationId?: string;
}

export interface WebhookJobData extends BaseJobData {
  url: string;
  method: string;
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
}

export interface AutomationJobData extends BaseJobData {
  actionType?: string;
  ruleId?: string;
  originalEvent?: unknown;
  escalateToRole?: string;
  delayMinutes?: number;
  message?: string;
  to?: string;
  from?: string;
  channel?: string;
  taskData?: Record<string, unknown>;
  reviewId?: string;
  tone?: string;
}

export interface AlertNotifyData extends BaseJobData {
  alertId: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface ContentSyncData extends BaseJobData {
  accountId: string;
}

// Union type for all job data
export type JobData =
  | ComplianceCheckReminderData
  | TemperatureBreachData
  | ReviewSyncData
  | ReviewAnalyzeData
  | ReviewRespondData
  | ContentPublishData
  | AlertCreateData
  | InsightsGenerateData
  | WebhookJobData
  | AutomationJobData
  | AlertNotifyData
  | ContentSyncData
  | BaseJobData;

class QueueService {
  private queues: Map<string, Queue> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private connection: Redis | null = null;
  private isInitialized = false;

  /**
   * Initialize the queue service with Redis connection
   */
  public async initialize(redisUrl: string): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Queue service already initialized');
      return;
    }

    try {
      this.connection = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
      });

      // Create priority queues
      for (const priority of ['critical', 'high', 'medium', 'low'] as const) {
        const queue = new Queue(`mitch-${priority}`, {
          connection: this.connection,
          defaultJobOptions: QUEUE_CONFIG[priority].defaultJobOptions,
        });

        const events = new QueueEvents(`mitch-${priority}`, {
          connection: this.connection,
        });

        this.queues.set(priority, queue);
        this.queueEvents.set(priority, events);

        // Set up event listeners
        this.setupEventListeners(priority, events);
      }

      this.isInitialized = true;
      logger.info('Queue service initialized successfully', {
        queues: ['critical', 'high', 'medium', 'low'],
      });
    } catch (error) {
      logger.error('Failed to initialize queue service', { error });
      throw error;
    }
  }

  /**
   * Set up event listeners for queue monitoring
   */
  private setupEventListeners(priority: string, events: QueueEvents): void {
    events.on('completed', ({ jobId }) => {
      logger.debug(`Job completed`, { queue: priority, jobId });
    });

    events.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job failed`, { queue: priority, jobId, failedReason });
    });

    events.on('stalled', ({ jobId }) => {
      logger.warn(`Job stalled`, { queue: priority, jobId });
    });
  }

  /**
   * Add a job to the appropriate queue based on job type
   */
  public async addJob<T extends JobData>(
    jobType: JobType,
    data: T,
    options?: Partial<JobsOptions>
  ): Promise<Job<T>> {
    if (!this.isInitialized) {
      throw new Error('Queue service not initialized');
    }

    const priority = JOB_PRIORITY_MAP[jobType];
    const queue = this.queues.get(priority);

    if (!queue) {
      throw new Error(`Queue not found for priority: ${priority}`);
    }

    // Generate idempotency key if not provided
    const jobId = options?.jobId || this.generateJobId(jobType, data);

    const job = await queue.add(jobType, data, {
      jobId,
      ...options,
    });

    logger.info(`Job added to queue`, {
      queue: priority,
      jobType,
      jobId: job.id,
      tenantId: data.tenantId,
    });

    return job as Job<T>;
  }

  /**
   * Add a job with delay
   */
  public async addDelayedJob<T extends JobData>(
    jobType: JobType,
    data: T,
    delayMs: number,
    options?: Partial<JobsOptions>
  ): Promise<Job<T>> {
    return this.addJob(jobType, data, {
      ...options,
      delay: delayMs,
    });
  }

  /**
   * Add a recurring job (cron-based)
   */
  public async addRecurringJob<T extends JobData>(
    jobType: JobType,
    data: T,
    cronPattern: string,
    options?: Partial<JobsOptions>
  ): Promise<Job<T>> {
    return this.addJob(jobType, data, {
      ...options,
      repeat: {
        pattern: cronPattern,
      },
    });
  }

  /**
   * Generate a unique job ID for idempotency
   */
  private generateJobId(jobType: JobType, data: JobData): string {
    const timestamp = Date.now();
    const hash = this.simpleHash(JSON.stringify(data));
    return `${jobType}-${data.tenantId}-${hash}-${timestamp}`;
  }

  /**
   * Simple hash function for job deduplication
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get a specific queue
   */
  public getQueue(priority: 'critical' | 'high' | 'medium' | 'low'): Queue | undefined {
    return this.queues.get(priority);
  }

  /**
   * Get all queues
   */
  public getAllQueues(): Map<string, Queue> {
    return this.queues;
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(): Promise<Record<string, { waiting: number; active: number; completed: number; failed: number }>> {
    const stats: Record<string, { waiting: number; active: number; completed: number; failed: number }> = {};

    for (const [priority, queue] of this.queues) {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);

      stats[priority] = { waiting, active, completed, failed };
    }

    return stats;
  }

  /**
   * Pause a specific queue
   */
  public async pauseQueue(priority: 'critical' | 'high' | 'medium' | 'low'): Promise<void> {
    const queue = this.queues.get(priority);
    if (queue) {
      await queue.pause();
      logger.info(`Queue paused`, { queue: priority });
    }
  }

  /**
   * Resume a specific queue
   */
  public async resumeQueue(priority: 'critical' | 'high' | 'medium' | 'low'): Promise<void> {
    const queue = this.queues.get(priority);
    if (queue) {
      await queue.resume();
      logger.info(`Queue resumed`, { queue: priority });
    }
  }

  /**
   * Clean up old jobs
   */
  public async cleanOldJobs(gracePeriodMs: number = 86400000): Promise<void> {
    for (const [priority, queue] of this.queues) {
      await queue.clean(gracePeriodMs, 1000, 'completed');
      await queue.clean(gracePeriodMs * 7, 1000, 'failed');
      logger.info(`Cleaned old jobs from queue`, { queue: priority });
    }
  }

  /**
   * Gracefully shutdown the queue service
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down queue service...');

    // Close all queue events
    for (const [, events] of this.queueEvents) {
      await events.close();
    }

    // Close all queues
    for (const [, queue] of this.queues) {
      await queue.close();
    }

    // Close Redis connection
    if (this.connection) {
      await this.connection.quit();
    }

    this.isInitialized = false;
    logger.info('Queue service shutdown complete');
  }
}

// Export singleton instance
export const queueService = new QueueService();

// Export convenience functions
export const addJob = queueService.addJob.bind(queueService);
export const addDelayedJob = queueService.addDelayedJob.bind(queueService);
export const addRecurringJob = queueService.addRecurringJob.bind(queueService);
