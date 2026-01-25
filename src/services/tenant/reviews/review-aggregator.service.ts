/**
 * Review Aggregator Service
 *
 * Manages multi-platform review aggregation, syncing reviews from
 * Google Business Profile, TripAdvisor, Yelp, and other platforms.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { encrypt, decrypt } from '../../encryption';
import { addJob } from '../../queue';

// Types
export interface AggregatedReview {
  id: string;
  tenantId: string;
  locationId: string | null;
  platform: 'google' | 'tripadvisor' | 'yelp' | 'facebook' | 'internal';
  platformReviewId: string | null;
  reviewerName: string | null;
  reviewerAvatarUrl: string | null;
  rating: number | null;
  reviewText: string | null;
  reviewDate: Date;
  language: string;
  sentimentScore: number | null;
  sentimentLabel: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
  sentimentAspects: Array<{ aspect: string; sentiment: number }> | null;
  topics: string[] | null;
  keywords: string[] | null;
  isResponded: boolean;
  responseText: string | null;
  responseDate: Date | null;
  responseBy: string | null;
  aiSuggestedResponse: string | null;
  aiResponseUsed: boolean | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'new' | 'in_progress' | 'responded' | 'flagged' | 'archived';
  complianceFlags: Array<{ type: string; description: string }> | null;
  photos: string[] | null;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformCredentials {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  placeId?: string;
  accountId?: string;
  [key: string]: string | undefined;
}

export interface PlatformConnection {
  id: string;
  tenantId: string;
  locationId: string | null;
  platform: string;
  placeId: string | null;
  lastSyncAt: Date | null;
  syncStatus: 'active' | 'error' | 'paused';
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncResult {
  platform: string;
  newReviews: number;
  updatedReviews: number;
  errors: string[];
  syncedAt: Date;
}

export interface ReviewFilters {
  locationId?: string;
  platform?: string;
  status?: AggregatedReview['status'];
  sentimentLabel?: AggregatedReview['sentimentLabel'];
  priority?: AggregatedReview['priority'];
  isResponded?: boolean;
  minRating?: number;
  maxRating?: number;
  startDate?: Date;
  endDate?: Date;
  searchText?: string;
  limit?: number;
  offset?: number;
}

export interface ExportParams {
  format: 'csv' | 'json' | 'xlsx';
  filters?: ReviewFilters;
  includeResponses?: boolean;
  includeSentiment?: boolean;
}

export class ReviewAggregatorService {
  constructor(private pool: Pool) {}

  /**
   * Connect a review platform
   */
  public async connectPlatform(
    tenantId: string,
    locationId: string | null,
    platform: string,
    credentials: PlatformCredentials
  ): Promise<PlatformConnection> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Encrypt sensitive credentials
      const encryptedCredentials: Record<string, string> = {};
      for (const [key, value] of Object.entries(credentials)) {
        if (value && ['apiKey', 'accessToken', 'refreshToken'].includes(key)) {
          encryptedCredentials[key] = await encrypt(value);
        } else if (value) {
          encryptedCredentials[key] = value;
        }
      }

      const result = await client.query(
        `INSERT INTO review_platform_credentials
         (tenant_id, location_id, platform, credentials, place_id, sync_status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (tenant_id, location_id, platform)
         DO UPDATE SET
           credentials = $4,
           place_id = $5,
           sync_status = 'active',
           error_message = NULL,
           updated_at = NOW()
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   platform, place_id as "placeId", last_sync_at as "lastSyncAt",
                   sync_status as "syncStatus", error_message as "errorMessage",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [tenantId, locationId, platform, JSON.stringify(encryptedCredentials), credentials.placeId || null]
      );

      logger.info('Platform connected', { tenantId, platform, locationId });

      // Queue initial sync
      await addJob('review.sync', {
        tenantId,
        platform,
        locationId,
        connectionId: result.rows[0].id,
      });

      return result.rows[0];
    });
  }

  /**
   * Disconnect a review platform
   */
  public async disconnectPlatform(
    tenantId: string,
    platform: string,
    locationId?: string
  ): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      await client.query(
        `UPDATE review_platform_credentials
         SET deleted_at = NOW(), sync_status = 'paused'
         WHERE tenant_id = $1 AND platform = $2
         ${locationId ? 'AND location_id = $3' : 'AND location_id IS NULL'}`,
        locationId ? [tenantId, platform, locationId] : [tenantId, platform]
      );

      logger.info('Platform disconnected', { tenantId, platform, locationId });
    });
  }

  /**
   * Get connected platforms
   */
  public async getConnectedPlatforms(
    tenantId: string,
    locationId?: string
  ): Promise<PlatformConnection[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let query = `
        SELECT id, tenant_id as "tenantId", location_id as "locationId",
               platform, place_id as "placeId", last_sync_at as "lastSyncAt",
               sync_status as "syncStatus", error_message as "errorMessage",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM review_platform_credentials
        WHERE tenant_id = $1 AND deleted_at IS NULL`;

      const params: unknown[] = [tenantId];

      if (locationId) {
        query += ' AND (location_id = $2 OR location_id IS NULL)';
        params.push(locationId);
      }

      query += ' ORDER BY platform';

      const result = await client.query(query, params);
      return result.rows;
    });
  }

  /**
   * Sync reviews from a platform (called by queue worker)
   */
  public async syncReviews(
    tenantId: string,
    platform?: string,
    locationId?: string
  ): Promise<SyncResult[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Get platforms to sync
      let query = `
        SELECT id, platform, credentials, place_id, location_id
        FROM review_platform_credentials
        WHERE tenant_id = $1 AND sync_status = 'active' AND deleted_at IS NULL`;

      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (platform) {
        query += ` AND platform = $${paramIndex++}`;
        params.push(platform);
      }
      if (locationId) {
        query += ` AND (location_id = $${paramIndex++} OR location_id IS NULL)`;
        params.push(locationId);
      }

      const platformsResult = await client.query(query, params);
      const results: SyncResult[] = [];

      for (const platformConfig of platformsResult.rows) {
        try {
          const syncResult = await this.syncPlatformReviews(
            client,
            tenantId,
            platformConfig
          );
          results.push(syncResult);

          // Update last sync time
          await client.query(
            `UPDATE review_platform_credentials
             SET last_sync_at = NOW(), sync_status = 'active', error_message = NULL
             WHERE id = $1`,
            [platformConfig.id]
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          await client.query(
            `UPDATE review_platform_credentials
             SET sync_status = 'error', error_message = $2
             WHERE id = $1`,
            [platformConfig.id, errorMessage]
          );

          results.push({
            platform: platformConfig.platform,
            newReviews: 0,
            updatedReviews: 0,
            errors: [errorMessage],
            syncedAt: new Date(),
          });

          logger.error('Review sync failed', {
            tenantId,
            platform: platformConfig.platform,
            error: errorMessage,
          });
        }
      }

      return results;
    });
  }

  /**
   * Sync reviews from a specific platform configuration
   */
  private async syncPlatformReviews(
    _client: unknown,
    _tenantId: string,
    platformConfig: { platform: string; credentials: unknown; place_id?: string; location_id?: string }
  ): Promise<SyncResult> {
    const { platform, credentials, place_id } = platformConfig;

    // Decrypt credentials
    const decryptedCredentials: Record<string, string> = {};
    const credentialsObj = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;

    for (const [key, value] of Object.entries(credentialsObj)) {
      if (value && typeof value === 'string' && ['apiKey', 'accessToken', 'refreshToken'].includes(key)) {
        try {
          decryptedCredentials[key] = await decrypt(value);
        } catch {
          decryptedCredentials[key] = value;
        }
      } else if (value) {
        decryptedCredentials[key] = value as string;
      }
    }

    // Platform-specific sync logic
    // In production, this would call the actual platform APIs
    // For now, we'll implement the structure that queues analysis jobs

    let newReviews = 0;
    let updatedReviews = 0;
    const errors: string[] = [];

    // This is a placeholder for actual platform API integration
    // Each platform would have its own adapter/implementation
    switch (platform) {
      case 'google':
        // Would call Google Business Profile API
        logger.info('Google sync would happen here', { placeId: place_id });
        break;
      case 'tripadvisor':
        // Would call TripAdvisor Content API
        logger.info('TripAdvisor sync would happen here', { placeId: place_id });
        break;
      case 'yelp':
        // Would call Yelp Fusion API
        logger.info('Yelp sync would happen here', { placeId: place_id });
        break;
      case 'facebook':
        // Would call Facebook Graph API
        logger.info('Facebook sync would happen here', { placeId: place_id });
        break;
      default:
        errors.push(`Unknown platform: ${platform}`);
    }

    return {
      platform,
      newReviews,
      updatedReviews,
      errors,
      syncedAt: new Date(),
    };
  }

  /**
   * Import a review manually
   */
  public async importReview(
    tenantId: string,
    data: {
      locationId?: string;
      platform: AggregatedReview['platform'];
      platformReviewId?: string;
      reviewerName?: string;
      rating?: number;
      reviewText?: string;
      reviewDate: Date;
    }
  ): Promise<AggregatedReview> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO aggregated_reviews
         (tenant_id, location_id, platform, platform_review_id, reviewer_name,
          rating, review_text, review_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   platform, platform_review_id as "platformReviewId",
                   reviewer_name as "reviewerName", reviewer_avatar_url as "reviewerAvatarUrl",
                   rating, review_text as "reviewText", review_date as "reviewDate",
                   language, sentiment_score as "sentimentScore",
                   sentiment_label as "sentimentLabel", sentiment_aspects as "sentimentAspects",
                   topics, keywords, is_responded as "isResponded",
                   response_text as "responseText", response_date as "responseDate",
                   response_by as "responseBy", ai_suggested_response as "aiSuggestedResponse",
                   ai_response_used as "aiResponseUsed", priority, status,
                   compliance_flags as "complianceFlags", photos, helpful_count as "helpfulCount",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [
          tenantId,
          data.locationId || null,
          data.platform,
          data.platformReviewId || null,
          data.reviewerName || null,
          data.rating || null,
          data.reviewText || null,
          data.reviewDate,
        ]
      );

      const review = result.rows[0];

      // Queue for analysis if there's review text
      if (data.reviewText) {
        await addJob('review.analyze', {
          tenantId,
          reviewId: review.id,
        });
      }

      logger.info('Review imported', {
        tenantId,
        reviewId: review.id,
        platform: data.platform,
      });

      return review;
    });
  }

  /**
   * Get reviews with filters
   */
  public async getReviews(
    tenantId: string,
    filters: ReviewFilters
  ): Promise<{ reviews: AggregatedReview[]; total: number }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let whereClause = 'WHERE r.tenant_id = $1';
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (filters.locationId) {
        whereClause += ` AND r.location_id = $${paramIndex++}`;
        params.push(filters.locationId);
      }
      if (filters.platform) {
        whereClause += ` AND r.platform = $${paramIndex++}`;
        params.push(filters.platform);
      }
      if (filters.status) {
        whereClause += ` AND r.status = $${paramIndex++}`;
        params.push(filters.status);
      }
      if (filters.sentimentLabel) {
        whereClause += ` AND r.sentiment_label = $${paramIndex++}`;
        params.push(filters.sentimentLabel);
      }
      if (filters.priority) {
        whereClause += ` AND r.priority = $${paramIndex++}`;
        params.push(filters.priority);
      }
      if (filters.isResponded !== undefined) {
        whereClause += ` AND r.is_responded = $${paramIndex++}`;
        params.push(filters.isResponded);
      }
      if (filters.minRating !== undefined) {
        whereClause += ` AND r.rating >= $${paramIndex++}`;
        params.push(filters.minRating);
      }
      if (filters.maxRating !== undefined) {
        whereClause += ` AND r.rating <= $${paramIndex++}`;
        params.push(filters.maxRating);
      }
      if (filters.startDate) {
        whereClause += ` AND r.review_date >= $${paramIndex++}`;
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClause += ` AND r.review_date <= $${paramIndex++}`;
        params.push(filters.endDate);
      }
      if (filters.searchText) {
        whereClause += ` AND (r.review_text ILIKE $${paramIndex} OR r.reviewer_name ILIKE $${paramIndex})`;
        params.push(`%${filters.searchText}%`);
        paramIndex++;
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM aggregated_reviews r ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const result = await client.query(
        `SELECT r.id, r.tenant_id as "tenantId", r.location_id as "locationId",
                r.platform, r.platform_review_id as "platformReviewId",
                r.reviewer_name as "reviewerName", r.reviewer_avatar_url as "reviewerAvatarUrl",
                r.rating, r.review_text as "reviewText", r.review_date as "reviewDate",
                r.language, r.sentiment_score as "sentimentScore",
                r.sentiment_label as "sentimentLabel", r.sentiment_aspects as "sentimentAspects",
                r.topics, r.keywords, r.is_responded as "isResponded",
                r.response_text as "responseText", r.response_date as "responseDate",
                r.response_by as "responseBy", r.ai_suggested_response as "aiSuggestedResponse",
                r.ai_response_used as "aiResponseUsed", r.priority, r.status,
                r.compliance_flags as "complianceFlags", r.photos,
                r.helpful_count as "helpfulCount",
                r.created_at as "createdAt", r.updated_at as "updatedAt",
                l.name as location_name
         FROM aggregated_reviews r
         LEFT JOIN locations l ON r.location_id = l.id
         ${whereClause}
         ORDER BY
           CASE r.priority
             WHEN 'urgent' THEN 1
             WHEN 'high' THEN 2
             WHEN 'normal' THEN 3
             ELSE 4
           END,
           r.review_date DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return { reviews: result.rows, total };
    });
  }

  /**
   * Get a specific review
   */
  public async getReviewById(
    tenantId: string,
    reviewId: string
  ): Promise<AggregatedReview | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                platform, platform_review_id as "platformReviewId",
                reviewer_name as "reviewerName", reviewer_avatar_url as "reviewerAvatarUrl",
                rating, review_text as "reviewText", review_date as "reviewDate",
                language, sentiment_score as "sentimentScore",
                sentiment_label as "sentimentLabel", sentiment_aspects as "sentimentAspects",
                topics, keywords, is_responded as "isResponded",
                response_text as "responseText", response_date as "responseDate",
                response_by as "responseBy", ai_suggested_response as "aiSuggestedResponse",
                ai_response_used as "aiResponseUsed", priority, status,
                compliance_flags as "complianceFlags", photos, helpful_count as "helpfulCount",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM aggregated_reviews
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, reviewId]
      );
      return result.rows[0] || null;
    });
  }

  /**
   * Update review status
   */
  public async updateReviewStatus(
    tenantId: string,
    reviewId: string,
    status: AggregatedReview['status']
  ): Promise<AggregatedReview | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE aggregated_reviews
         SET status = $3, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   platform, platform_review_id as "platformReviewId",
                   reviewer_name as "reviewerName", reviewer_avatar_url as "reviewerAvatarUrl",
                   rating, review_text as "reviewText", review_date as "reviewDate",
                   language, sentiment_score as "sentimentScore",
                   sentiment_label as "sentimentLabel", sentiment_aspects as "sentimentAspects",
                   topics, keywords, is_responded as "isResponded",
                   response_text as "responseText", response_date as "responseDate",
                   response_by as "responseBy", ai_suggested_response as "aiSuggestedResponse",
                   ai_response_used as "aiResponseUsed", priority, status,
                   compliance_flags as "complianceFlags", photos, helpful_count as "helpfulCount",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [tenantId, reviewId, status]
      );
      return result.rows[0] || null;
    });
  }

  /**
   * Bulk update review status
   */
  public async bulkUpdateStatus(
    tenantId: string,
    reviewIds: string[],
    status: AggregatedReview['status']
  ): Promise<number> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE aggregated_reviews
         SET status = $3, updated_at = NOW()
         WHERE tenant_id = $1 AND id = ANY($2)`,
        [tenantId, reviewIds, status]
      );
      return result.rowCount || 0;
    });
  }

  /**
   * Save response to a review
   */
  public async saveResponse(
    tenantId: string,
    reviewId: string,
    userId: string,
    responseText: string,
    aiResponseUsed: boolean
  ): Promise<AggregatedReview | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE aggregated_reviews
         SET response_text = $3, response_date = NOW(), response_by = $4,
             ai_response_used = $5, is_responded = true, status = 'responded',
             updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   platform, platform_review_id as "platformReviewId",
                   reviewer_name as "reviewerName", reviewer_avatar_url as "reviewerAvatarUrl",
                   rating, review_text as "reviewText", review_date as "reviewDate",
                   language, sentiment_score as "sentimentScore",
                   sentiment_label as "sentimentLabel", sentiment_aspects as "sentimentAspects",
                   topics, keywords, is_responded as "isResponded",
                   response_text as "responseText", response_date as "responseDate",
                   response_by as "responseBy", ai_suggested_response as "aiSuggestedResponse",
                   ai_response_used as "aiResponseUsed", priority, status,
                   compliance_flags as "complianceFlags", photos, helpful_count as "helpfulCount",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [tenantId, reviewId, responseText, userId, aiResponseUsed]
      );

      if (result.rows[0]) {
        logger.info('Review response saved', { tenantId, reviewId, userId });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Update review with analysis results
   */
  public async updateReviewAnalysis(
    tenantId: string,
    reviewId: string,
    analysis: {
      sentimentScore: number;
      sentimentLabel: AggregatedReview['sentimentLabel'];
      sentimentAspects?: Array<{ aspect: string; sentiment: number }>;
      topics?: string[];
      keywords?: string[];
      complianceFlags?: Array<{ type: string; description: string }>;
      priority?: AggregatedReview['priority'];
    }
  ): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      await client.query(
        `UPDATE aggregated_reviews
         SET sentiment_score = $3, sentiment_label = $4, sentiment_aspects = $5,
             topics = $6, keywords = $7, compliance_flags = $8, priority = COALESCE($9, priority),
             updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2`,
        [
          tenantId,
          reviewId,
          analysis.sentimentScore,
          analysis.sentimentLabel,
          JSON.stringify(analysis.sentimentAspects || []),
          JSON.stringify(analysis.topics || []),
          JSON.stringify(analysis.keywords || []),
          JSON.stringify(analysis.complianceFlags || []),
          analysis.priority || null,
        ]
      );
    });
  }

  /**
   * Save AI suggested response
   */
  public async saveAiSuggestedResponse(
    tenantId: string,
    reviewId: string,
    suggestedResponse: string
  ): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      await client.query(
        `UPDATE aggregated_reviews
         SET ai_suggested_response = $3, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, reviewId, suggestedResponse]
      );
    });
  }
}
