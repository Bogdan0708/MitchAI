/**
 * Content Calendar Service
 *
 * Manages content scheduling, calendar entries, and campaigns
 * for social media content planning.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { addJob, addDelayedJob } from '../../queue';

// Types
export interface ContentEntry {
  id: string;
  tenantId: string;
  locationId: string | null;
  title: string;
  description: string | null;
  contentType: 'video' | 'image' | 'carousel' | 'story' | 'reel';
  platforms: string[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt: Date | null;
  publishedAt: Date | null;
  caption: string | null;
  hashtags: string[] | null;
  mediaUrls: MediaAsset[] | null;
  aiGeneratedCaptions: PlatformCaption[] | null;
  trendingSounds: TrendingSound[] | null;
  menuItemId: string | null;
  campaignId: string | null;
  performanceMetrics: PerformanceMetrics | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvalRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaAsset {
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface PlatformCaption {
  platform: string;
  caption: string;
  hashtags: string[];
}

export interface TrendingSound {
  platform: string;
  soundId: string;
  soundName: string;
}

export interface PerformanceMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  engagement?: number;
  reach?: number;
  impressions?: number;
}

export interface ContentCampaign {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  goals: CampaignGoals | null;
  theme: string | null;
  brandGuidelines: BrandGuidelines | null;
  hashtagStrategy: string[] | null;
  status: 'draft' | 'active' | 'paused' | 'completed';
  performanceSummary: PerformanceMetrics | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignGoals {
  targetViews?: number;
  targetEngagement?: number;
  targetFollowers?: number;
  targetPosts?: number;
}

export interface BrandGuidelines {
  colors?: string[];
  fonts?: string[];
  tone?: string;
  doNot?: string[];
}

export interface CreateContentDTO {
  locationId?: string;
  title: string;
  description?: string;
  contentType: ContentEntry['contentType'];
  platforms: string[];
  caption?: string;
  hashtags?: string[];
  mediaUrls?: MediaAsset[];
  menuItemId?: string;
  campaignId?: string;
  approvalRequired?: boolean;
}

export interface UpdateContentDTO {
  title?: string;
  description?: string;
  contentType?: ContentEntry['contentType'];
  platforms?: string[];
  caption?: string;
  hashtags?: string[];
  mediaUrls?: MediaAsset[];
  aiGeneratedCaptions?: PlatformCaption[];
  trendingSounds?: TrendingSound[];
  menuItemId?: string;
  campaignId?: string;
  approvalRequired?: boolean;
}

export interface ContentFilters {
  locationId?: string;
  status?: ContentEntry['status'];
  contentType?: ContentEntry['contentType'];
  platform?: string;
  campaignId?: string;
  startDate?: Date;
  endDate?: Date;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCampaignDTO {
  name: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  goals?: CampaignGoals;
  theme?: string;
  brandGuidelines?: BrandGuidelines;
  hashtagStrategy?: string[];
}

export interface UpdateCampaignDTO {
  name?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  goals?: CampaignGoals;
  theme?: string;
  brandGuidelines?: BrandGuidelines;
  hashtagStrategy?: string[];
  status?: ContentCampaign['status'];
}

export class ContentCalendarService {
  constructor(private pool: Pool) {}

  /**
   * Get content entries with filters
   */
  public async getContent(
    tenantId: string,
    filters: ContentFilters
  ): Promise<{ content: ContentEntry[]; total: number }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let whereClause = 'WHERE c.tenant_id = $1 AND c.deleted_at IS NULL';
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (filters.locationId) {
        whereClause += ` AND c.location_id = $${paramIndex++}`;
        params.push(filters.locationId);
      }
      if (filters.status) {
        whereClause += ` AND c.status = $${paramIndex++}`;
        params.push(filters.status);
      }
      if (filters.contentType) {
        whereClause += ` AND c.content_type = $${paramIndex++}`;
        params.push(filters.contentType);
      }
      if (filters.platform) {
        whereClause += ` AND c.platforms ? $${paramIndex++}`;
        params.push(filters.platform);
      }
      if (filters.campaignId) {
        whereClause += ` AND c.campaign_id = $${paramIndex++}`;
        params.push(filters.campaignId);
      }
      if (filters.startDate) {
        whereClause += ` AND COALESCE(c.scheduled_at, c.created_at) >= $${paramIndex++}`;
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClause += ` AND COALESCE(c.scheduled_at, c.created_at) <= $${paramIndex++}`;
        params.push(filters.endDate);
      }
      if (filters.createdBy) {
        whereClause += ` AND c.created_by = $${paramIndex++}`;
        params.push(filters.createdBy);
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM content_calendar c ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const result = await client.query(
        `SELECT c.id, c.tenant_id as "tenantId", c.location_id as "locationId",
                c.title, c.description, c.content_type as "contentType",
                c.platforms, c.status, c.scheduled_at as "scheduledAt",
                c.published_at as "publishedAt", c.caption, c.hashtags,
                c.media_urls as "mediaUrls", c.ai_generated_captions as "aiGeneratedCaptions",
                c.trending_sounds as "trendingSounds", c.menu_item_id as "menuItemId",
                c.campaign_id as "campaignId", c.performance_metrics as "performanceMetrics",
                c.created_by as "createdBy", c.approved_by as "approvedBy",
                c.approval_required as "approvalRequired",
                c.created_at as "createdAt", c.updated_at as "updatedAt",
                l.name as location_name,
                camp.name as campaign_name,
                tu.name as creator_name
         FROM content_calendar c
         LEFT JOIN locations l ON c.location_id = l.id
         LEFT JOIN content_campaigns camp ON c.campaign_id = camp.id
         LEFT JOIN tenant_users tu ON c.created_by = tu.id
         ${whereClause}
         ORDER BY COALESCE(c.scheduled_at, c.created_at) DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return { content: result.rows, total };
    });
  }

  /**
   * Get calendar view (grouped by date)
   */
  public async getCalendarView(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    locationId?: string
  ): Promise<Record<string, ContentEntry[]>> {
    const filters: ContentFilters = { startDate, endDate, locationId };
    const { content } = await this.getContent(tenantId, filters);

    const calendar: Record<string, ContentEntry[]> = {};

    for (const entry of content) {
      const date = (entry.scheduledAt || entry.createdAt).toISOString().split('T')[0];
      if (!calendar[date]) {
        calendar[date] = [];
      }
      calendar[date].push(entry);
    }

    return calendar;
  }

  /**
   * Get a specific content entry
   */
  public async getContentById(
    tenantId: string,
    contentId: string
  ): Promise<ContentEntry | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                title, description, content_type as "contentType",
                platforms, status, scheduled_at as "scheduledAt",
                published_at as "publishedAt", caption, hashtags,
                media_urls as "mediaUrls", ai_generated_captions as "aiGeneratedCaptions",
                trending_sounds as "trendingSounds", menu_item_id as "menuItemId",
                campaign_id as "campaignId", performance_metrics as "performanceMetrics",
                created_by as "createdBy", approved_by as "approvedBy",
                approval_required as "approvalRequired",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM content_calendar
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, contentId]
      );
      return result.rows[0] || null;
    });
  }

  /**
   * Create a content entry
   */
  public async createContent(
    tenantId: string,
    userId: string,
    data: CreateContentDTO
  ): Promise<ContentEntry> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO content_calendar
         (tenant_id, location_id, title, description, content_type, platforms,
          caption, hashtags, media_urls, menu_item_id, campaign_id,
          approval_required, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   title, description, content_type as "contentType",
                   platforms, status, scheduled_at as "scheduledAt",
                   published_at as "publishedAt", caption, hashtags,
                   media_urls as "mediaUrls", ai_generated_captions as "aiGeneratedCaptions",
                   trending_sounds as "trendingSounds", menu_item_id as "menuItemId",
                   campaign_id as "campaignId", performance_metrics as "performanceMetrics",
                   created_by as "createdBy", approved_by as "approvedBy",
                   approval_required as "approvalRequired",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [
          tenantId,
          data.locationId || null,
          data.title,
          data.description || null,
          data.contentType,
          JSON.stringify(data.platforms),
          data.caption || null,
          JSON.stringify(data.hashtags || []),
          JSON.stringify(data.mediaUrls || []),
          data.menuItemId || null,
          data.campaignId || null,
          data.approvalRequired || false,
          userId,
        ]
      );

      logger.info('Content created', {
        tenantId,
        contentId: result.rows[0].id,
        contentType: data.contentType,
        platforms: data.platforms,
      });

      return result.rows[0];
    });
  }

  /**
   * Update a content entry
   */
  public async updateContent(
    tenantId: string,
    contentId: string,
    data: UpdateContentDTO
  ): Promise<ContentEntry | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        title: 'title',
        description: 'description',
        contentType: 'content_type',
        caption: 'caption',
        menuItemId: 'menu_item_id',
        campaignId: 'campaign_id',
        approvalRequired: 'approval_required',
      };

      for (const [key, column] of Object.entries(fieldMap)) {
        if (data[key as keyof UpdateContentDTO] !== undefined) {
          setClauses.push(`${column} = $${paramIndex++}`);
          values.push(data[key as keyof UpdateContentDTO]);
        }
      }

      // Handle JSON fields
      if (data.platforms !== undefined) {
        setClauses.push(`platforms = $${paramIndex++}`);
        values.push(JSON.stringify(data.platforms));
      }
      if (data.hashtags !== undefined) {
        setClauses.push(`hashtags = $${paramIndex++}`);
        values.push(JSON.stringify(data.hashtags));
      }
      if (data.mediaUrls !== undefined) {
        setClauses.push(`media_urls = $${paramIndex++}`);
        values.push(JSON.stringify(data.mediaUrls));
      }
      if (data.aiGeneratedCaptions !== undefined) {
        setClauses.push(`ai_generated_captions = $${paramIndex++}`);
        values.push(JSON.stringify(data.aiGeneratedCaptions));
      }
      if (data.trendingSounds !== undefined) {
        setClauses.push(`trending_sounds = $${paramIndex++}`);
        values.push(JSON.stringify(data.trendingSounds));
      }

      if (setClauses.length === 0) {
        return this.getContentById(tenantId, contentId);
      }

      setClauses.push('updated_at = NOW()');
      values.push(tenantId, contentId);

      const result = await client.query(
        `UPDATE content_calendar
         SET ${setClauses.join(', ')}
         WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1} AND deleted_at IS NULL
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   title, description, content_type as "contentType",
                   platforms, status, scheduled_at as "scheduledAt",
                   published_at as "publishedAt", caption, hashtags,
                   media_urls as "mediaUrls", ai_generated_captions as "aiGeneratedCaptions",
                   trending_sounds as "trendingSounds", menu_item_id as "menuItemId",
                   campaign_id as "campaignId", performance_metrics as "performanceMetrics",
                   created_by as "createdBy", approved_by as "approvedBy",
                   approval_required as "approvalRequired",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        values
      );

      return result.rows[0] || null;
    });
  }

  /**
   * Delete a content entry (soft delete)
   */
  public async deleteContent(tenantId: string, contentId: string): Promise<boolean> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE content_calendar
         SET deleted_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, contentId]
      );
      return (result.rowCount || 0) > 0;
    });
  }

  /**
   * Schedule content for publishing
   */
  public async scheduleContent(
    tenantId: string,
    contentId: string,
    scheduledAt: Date
  ): Promise<ContentEntry | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Verify content exists and is in draft status
      const existing = await this.getContentById(tenantId, contentId);
      if (!existing) {
        throw new Error(`Content not found: ${contentId}`);
      }
      if (existing.status !== 'draft') {
        throw new Error(`Content cannot be scheduled: current status is ${existing.status}`);
      }
      if (existing.approvalRequired && !existing.approvedBy) {
        throw new Error('Content requires approval before scheduling');
      }

      const result = await client.query(
        `UPDATE content_calendar
         SET status = 'scheduled', scheduled_at = $3, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   title, description, content_type as "contentType",
                   platforms, status, scheduled_at as "scheduledAt",
                   published_at as "publishedAt", caption, hashtags,
                   media_urls as "mediaUrls", ai_generated_captions as "aiGeneratedCaptions",
                   trending_sounds as "trendingSounds", menu_item_id as "menuItemId",
                   campaign_id as "campaignId", performance_metrics as "performanceMetrics",
                   created_by as "createdBy", approved_by as "approvedBy",
                   approval_required as "approvalRequired",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [tenantId, contentId, scheduledAt]
      );

      if (result.rows[0]) {
        // Queue the publish job
        const delayMs = scheduledAt.getTime() - Date.now();
        if (delayMs > 0) {
          await addDelayedJob('content.publish', {
            tenantId,
            contentId,
          }, delayMs);

          logger.info('Content scheduled', {
            tenantId,
            contentId,
            scheduledAt,
            delayMs,
          });
        }
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Approve content
   */
  public async approveContent(
    tenantId: string,
    contentId: string,
    userId: string
  ): Promise<ContentEntry | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE content_calendar
         SET approved_by = $3, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   title, description, content_type as "contentType",
                   platforms, status, scheduled_at as "scheduledAt",
                   published_at as "publishedAt", caption, hashtags,
                   media_urls as "mediaUrls", ai_generated_captions as "aiGeneratedCaptions",
                   trending_sounds as "trendingSounds", menu_item_id as "menuItemId",
                   campaign_id as "campaignId", performance_metrics as "performanceMetrics",
                   created_by as "createdBy", approved_by as "approvedBy",
                   approval_required as "approvalRequired",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [tenantId, contentId, userId]
      );

      if (result.rows[0]) {
        logger.info('Content approved', { tenantId, contentId, approvedBy: userId });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Mark content as published
   */
  public async markPublished(
    tenantId: string,
    contentId: string,
    platformResults?: Record<string, { success: boolean; postId?: string; error?: string }>
  ): Promise<ContentEntry | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE content_calendar
         SET status = 'published', published_at = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   title, description, content_type as "contentType",
                   platforms, status, scheduled_at as "scheduledAt",
                   published_at as "publishedAt", caption, hashtags,
                   media_urls as "mediaUrls", ai_generated_captions as "aiGeneratedCaptions",
                   trending_sounds as "trendingSounds", menu_item_id as "menuItemId",
                   campaign_id as "campaignId", performance_metrics as "performanceMetrics",
                   created_by as "createdBy", approved_by as "approvedBy",
                   approval_required as "approvalRequired",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [tenantId, contentId]
      );

      if (result.rows[0]) {
        logger.info('Content marked as published', {
          tenantId,
          contentId,
          platformResults,
        });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Mark content as failed
   */
  public async markFailed(
    tenantId: string,
    contentId: string,
    error: string
  ): Promise<ContentEntry | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE content_calendar
         SET status = 'failed', updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   title, description, content_type as "contentType",
                   platforms, status, scheduled_at as "scheduledAt",
                   published_at as "publishedAt", caption, hashtags,
                   media_urls as "mediaUrls", ai_generated_captions as "aiGeneratedCaptions",
                   trending_sounds as "trendingSounds", menu_item_id as "menuItemId",
                   campaign_id as "campaignId", performance_metrics as "performanceMetrics",
                   created_by as "createdBy", approved_by as "approvedBy",
                   approval_required as "approvalRequired",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [tenantId, contentId]
      );

      if (result.rows[0]) {
        logger.error('Content publish failed', { tenantId, contentId, error });

        // Create alert
        await addJob('intelligence.alert.create', {
          tenantId,
          alertType: 'content_publish_failed',
          severity: 'high',
          title: 'Content failed to publish',
          message: error,
          sourceType: 'content',
          sourceId: contentId,
        });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Update performance metrics
   */
  public async updateMetrics(
    tenantId: string,
    contentId: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      await client.query(
        `UPDATE content_calendar
         SET performance_metrics = $3, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, contentId, JSON.stringify(metrics)]
      );
    });
  }

  // Campaign methods

  /**
   * Get campaigns
   */
  public async getCampaigns(
    tenantId: string,
    status?: ContentCampaign['status']
  ): Promise<ContentCampaign[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let query = `
        SELECT id, tenant_id as "tenantId", name, description,
               start_date as "startDate", end_date as "endDate",
               goals, theme, brand_guidelines as "brandGuidelines",
               hashtag_strategy as "hashtagStrategy", status,
               performance_summary as "performanceSummary",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM content_campaigns
        WHERE tenant_id = $1 AND deleted_at IS NULL`;

      const params: unknown[] = [tenantId];

      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }

      query += ' ORDER BY start_date DESC';

      const result = await client.query(query, params);
      return result.rows;
    });
  }

  /**
   * Get a specific campaign
   */
  public async getCampaignById(
    tenantId: string,
    campaignId: string
  ): Promise<ContentCampaign | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", name, description,
                start_date as "startDate", end_date as "endDate",
                goals, theme, brand_guidelines as "brandGuidelines",
                hashtag_strategy as "hashtagStrategy", status,
                performance_summary as "performanceSummary",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM content_campaigns
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, campaignId]
      );
      return result.rows[0] || null;
    });
  }

  /**
   * Create a campaign
   */
  public async createCampaign(
    tenantId: string,
    data: CreateCampaignDTO
  ): Promise<ContentCampaign> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO content_campaigns
         (tenant_id, name, description, start_date, end_date, goals, theme,
          brand_guidelines, hashtag_strategy)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, tenant_id as "tenantId", name, description,
                   start_date as "startDate", end_date as "endDate",
                   goals, theme, brand_guidelines as "brandGuidelines",
                   hashtag_strategy as "hashtagStrategy", status,
                   performance_summary as "performanceSummary",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [
          tenantId,
          data.name,
          data.description || null,
          data.startDate,
          data.endDate || null,
          JSON.stringify(data.goals || {}),
          data.theme || null,
          JSON.stringify(data.brandGuidelines || {}),
          JSON.stringify(data.hashtagStrategy || []),
        ]
      );

      logger.info('Campaign created', {
        tenantId,
        campaignId: result.rows[0].id,
        name: data.name,
      });

      return result.rows[0];
    });
  }

  /**
   * Update a campaign
   */
  public async updateCampaign(
    tenantId: string,
    campaignId: string,
    data: UpdateCampaignDTO
  ): Promise<ContentCampaign | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        startDate: 'start_date',
        endDate: 'end_date',
        theme: 'theme',
        status: 'status',
      };

      for (const [key, column] of Object.entries(fieldMap)) {
        if (data[key as keyof UpdateCampaignDTO] !== undefined) {
          setClauses.push(`${column} = $${paramIndex++}`);
          values.push(data[key as keyof UpdateCampaignDTO]);
        }
      }

      // Handle JSON fields
      if (data.goals !== undefined) {
        setClauses.push(`goals = $${paramIndex++}`);
        values.push(JSON.stringify(data.goals));
      }
      if (data.brandGuidelines !== undefined) {
        setClauses.push(`brand_guidelines = $${paramIndex++}`);
        values.push(JSON.stringify(data.brandGuidelines));
      }
      if (data.hashtagStrategy !== undefined) {
        setClauses.push(`hashtag_strategy = $${paramIndex++}`);
        values.push(JSON.stringify(data.hashtagStrategy));
      }

      if (setClauses.length === 0) {
        return this.getCampaignById(tenantId, campaignId);
      }

      setClauses.push('updated_at = NOW()');
      values.push(tenantId, campaignId);

      const result = await client.query(
        `UPDATE content_campaigns
         SET ${setClauses.join(', ')}
         WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1} AND deleted_at IS NULL
         RETURNING id, tenant_id as "tenantId", name, description,
                   start_date as "startDate", end_date as "endDate",
                   goals, theme, brand_guidelines as "brandGuidelines",
                   hashtag_strategy as "hashtagStrategy", status,
                   performance_summary as "performanceSummary",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        values
      );

      return result.rows[0] || null;
    });
  }

  /**
   * Delete a campaign (soft delete)
   */
  public async deleteCampaign(tenantId: string, campaignId: string): Promise<boolean> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE content_campaigns
         SET deleted_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, campaignId]
      );
      return (result.rowCount || 0) > 0;
    });
  }

  /**
   * Get campaign performance
   */
  public async getCampaignPerformance(
    tenantId: string,
    campaignId: string
  ): Promise<{
    totalPosts: number;
    publishedPosts: number;
    totalViews: number;
    totalEngagement: number;
    averageEngagementRate: number;
    topPerformingPost: ContentEntry | null;
  }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT
           COUNT(*) as total_posts,
           COUNT(*) FILTER (WHERE status = 'published') as published_posts,
           SUM((performance_metrics->>'views')::int) as total_views,
           SUM(
             COALESCE((performance_metrics->>'likes')::int, 0) +
             COALESCE((performance_metrics->>'comments')::int, 0) +
             COALESCE((performance_metrics->>'shares')::int, 0)
           ) as total_engagement
         FROM content_calendar
         WHERE tenant_id = $1 AND campaign_id = $2 AND deleted_at IS NULL`,
        [tenantId, campaignId]
      );

      // Get top performing post
      const topPostResult = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                title, description, content_type as "contentType",
                platforms, status, scheduled_at as "scheduledAt",
                published_at as "publishedAt", caption, hashtags,
                media_urls as "mediaUrls", performance_metrics as "performanceMetrics",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM content_calendar
         WHERE tenant_id = $1 AND campaign_id = $2 AND status = 'published'
           AND deleted_at IS NULL
         ORDER BY (performance_metrics->>'views')::int DESC NULLS LAST
         LIMIT 1`,
        [tenantId, campaignId]
      );

      const stats = result.rows[0];
      const totalViews = parseInt(stats.total_views, 10) || 0;
      const totalEngagement = parseInt(stats.total_engagement, 10) || 0;

      return {
        totalPosts: parseInt(stats.total_posts, 10),
        publishedPosts: parseInt(stats.published_posts, 10),
        totalViews,
        totalEngagement,
        averageEngagementRate: totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0,
        topPerformingPost: topPostResult.rows[0] || null,
      };
    });
  }
}
