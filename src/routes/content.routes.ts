/**
 * CONTENT ROUTES
 *
 * API endpoints for content planning and social media management
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { validate } from '../middleware/validate.middleware';
import { apiResponse } from '../lib/api-response';
import {
  ContentCalendarService,
  ContentGeneratorService,
  SocialPublisherService,
  TrendingService,
} from '../services/tenant/content';
import {
  connectAccountSchema,
  disconnectAccountSchema,
  getAccountStatsSchema,
  listContentSchema,
  getCalendarViewSchema,
  createContentSchema,
  updateContentSchema,
  scheduleContentSchema,
  approveContentSchema,
  publishContentSchema,
  // uploadMediaSchema,
  // listMediaSchema,
  listCampaignsSchema,
  createCampaignSchema,
  updateCampaignSchema,
  getCampaignPerformanceSchema,
  generateIdeasSchema,
  generateCaptionSchema,
  generateScriptSchema,
  suggestHashtagsSchema,
  getBestTimesSchema,
  getTrendingSchema,
  getAnalyticsSchema,
  getTopPerformingSchema,
} from '../validators/content.validator';

export function createContentRouter(pool: Pool): Router {
  const router = Router();

  const calendarService = new ContentCalendarService(pool);
  const generatorService = new ContentGeneratorService(pool);
  const publisherService = new SocialPublisherService(pool);
  const trendingService = new TrendingService(pool);

  // ============================================================================
  // SOCIAL ACCOUNTS
  // ============================================================================

  // List connected accounts
  router.get('/accounts', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;

      const accounts = await publisherService.getAccounts(tenantId, locationId);
      return apiResponse.success(res, accounts);
    } catch (error) {
      console.error('List accounts error:', error);
      return apiResponse.serverError(res, 'Failed to list accounts');
    }
  });

  // Connect account
  router.post('/accounts/connect', validate(connectAccountSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const account = await publisherService.connectAccount(tenantId, req.body);
      return apiResponse.created(res, account);
    } catch (error) {
      console.error('Connect account error:', error);
      return apiResponse.serverError(res, 'Failed to connect account');
    }
  });

  // Disconnect account
  router.delete('/accounts/:id', validate(disconnectAccountSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      await publisherService.disconnectAccount(tenantId, req.params.id);
      return apiResponse.success(res, { message: 'Account disconnected' });
    } catch (error) {
      console.error('Disconnect account error:', error);
      return apiResponse.serverError(res, 'Failed to disconnect account');
    }
  });

  // Get account stats
  router.get('/accounts/:id/stats', validate(getAccountStatsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const stats = await publisherService.getAccountStats(tenantId, req.params.id);

      if (!stats) {
        return apiResponse.notFound(res, 'Account not found');
      }

      return apiResponse.success(res, stats);
    } catch (error) {
      console.error('Get account stats error:', error);
      return apiResponse.serverError(res, 'Failed to get account stats');
    }
  });

  // ============================================================================
  // CONTENT CALENDAR
  // ============================================================================

  // Get calendar view
  router.get('/calendar', validate(getCalendarViewSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;
      const startDate = new Date(req.query.start_date as string);
      const endDate = new Date(req.query.end_date as string);

      const calendar = await calendarService.getCalendarView(
        tenantId,
        startDate,
        endDate,
        locationId
      );

      return apiResponse.success(res, calendar);
    } catch (error) {
      console.error('Get calendar error:', error);
      return apiResponse.serverError(res, 'Failed to get calendar');
    }
  });

  // ============================================================================
  // CAMPAIGNS (must come before /:id routes to avoid being caught by param)
  // ============================================================================

  // List campaigns
  router.get('/campaigns', validate(listCampaignsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const status = req.query.status as 'draft' | 'active' | 'completed' | 'paused' | undefined;

      const campaigns = await calendarService.getCampaigns(tenantId, status);
      return apiResponse.success(res, campaigns);
    } catch (error) {
      console.error('List campaigns error:', error);
      return apiResponse.serverError(res, 'Failed to list campaigns');
    }
  });

  // Create campaign
  router.post('/campaigns', validate(createCampaignSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const campaign = await calendarService.createCampaign(tenantId, req.body);
      return apiResponse.created(res, campaign);
    } catch (error) {
      console.error('Create campaign error:', error);
      return apiResponse.serverError(res, 'Failed to create campaign');
    }
  });

  // Update campaign
  router.patch('/campaigns/:id', validate(updateCampaignSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const campaign = await calendarService.updateCampaign(
        tenantId,
        req.params.id,
        req.body
      );

      if (!campaign) {
        return apiResponse.notFound(res, 'Campaign not found');
      }

      return apiResponse.success(res, campaign);
    } catch (error) {
      console.error('Update campaign error:', error);
      return apiResponse.serverError(res, 'Failed to update campaign');
    }
  });

  // Get campaign performance
  router.get('/campaigns/:id/performance', validate(getCampaignPerformanceSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const performance = await calendarService.getCampaignPerformance(
        tenantId,
        req.params.id
      );

      if (!performance) {
        return apiResponse.notFound(res, 'Campaign not found');
      }

      return apiResponse.success(res, performance);
    } catch (error) {
      console.error('Get campaign performance error:', error);
      return apiResponse.serverError(res, 'Failed to get campaign performance');
    }
  });

  // ============================================================================
  // ANALYTICS (must come before /:id routes to avoid being caught by param)
  // ============================================================================

  // Get content analytics
  router.get('/analytics', validate(getAnalyticsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;
      // platform and period would be used for more advanced analytics
      // const platform = req.query.platform as string | undefined;
      // const period = (req.query.period as string) || '30d';

      // Simplified analytics - would expand based on platform APIs
      const result = await calendarService.getContent(tenantId, {
        locationId,
        status: 'published',
      });

      return apiResponse.success(res, {
        totalPosts: result.total,
        // Additional analytics would be added here
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      return apiResponse.serverError(res, 'Failed to get analytics');
    }
  });

  // Get top performing content
  router.get('/analytics/top-performing', validate(getTopPerformingSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      // These params would be used for more advanced filtering
      // const platform = req.query.platform as string | undefined;
      // const period = (req.query.period as string) || '30d';
      // const metric = (req.query.metric as string) || 'engagement';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      // Would query based on performance_metrics stored in content_calendar
      const result = await calendarService.getContent(tenantId, {
        status: 'published',
        limit,
      });

      return apiResponse.success(res, result.content);
    } catch (error) {
      console.error('Get top performing error:', error);
      return apiResponse.serverError(res, 'Failed to get top performing content');
    }
  });

  // ============================================================================
  // CONTENT ITEMS
  // ============================================================================

  // List content
  router.get('/', validate(listContentSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const filters = {
        locationId: req.query.location_id as string | undefined,
        status: req.query.status as 'draft' | 'scheduled' | 'published' | 'failed' | undefined,
        contentType: req.query.content_type as 'video' | 'image' | 'carousel' | 'story' | 'reel' | undefined,
        platform: req.query.platform as string | undefined,
        campaignId: req.query.campaign_id as string | undefined,
        startDate: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        endDate: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      const result = await calendarService.getContent(tenantId, filters);
      return apiResponse.success(res, result);
    } catch (error) {
      console.error('List content error:', error);
      return apiResponse.serverError(res, 'Failed to list content');
    }
  });

  // Create content
  router.post('/', validate(createContentSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const userId = req.tenant!.userId;

      const content = await calendarService.createContent(tenantId, userId, req.body);
      return apiResponse.created(res, content);
    } catch (error) {
      console.error('Create content error:', error);
      return apiResponse.serverError(res, 'Failed to create content');
    }
  });

  // Get content by ID (MUST come after all named routes like /campaigns, /analytics)
  router.get('/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const content = await calendarService.getContentById(tenantId, req.params.id);

      if (!content) {
        return apiResponse.notFound(res, 'Content not found');
      }

      return apiResponse.success(res, content);
    } catch (error) {
      console.error('Get content error:', error);
      return apiResponse.serverError(res, 'Failed to get content');
    }
  });

  // Update content
  router.patch('/:id', validate(updateContentSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const content = await calendarService.updateContent(
        tenantId,
        req.params.id,
        req.body
      );

      if (!content) {
        return apiResponse.notFound(res, 'Content not found');
      }

      return apiResponse.success(res, content);
    } catch (error) {
      console.error('Update content error:', error);
      return apiResponse.serverError(res, 'Failed to update content');
    }
  });

  // Delete content
  router.delete('/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const deleted = await calendarService.deleteContent(tenantId, req.params.id);

      if (!deleted) {
        return apiResponse.notFound(res, 'Content not found');
      }

      return apiResponse.success(res, { message: 'Content deleted' });
    } catch (error) {
      console.error('Delete content error:', error);
      return apiResponse.serverError(res, 'Failed to delete content');
    }
  });

  // Schedule content
  router.post('/:id/schedule', validate(scheduleContentSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const content = await calendarService.scheduleContent(
        tenantId,
        req.params.id,
        new Date(req.body.scheduled_at)
      );

      if (!content) {
        return apiResponse.notFound(res, 'Content not found');
      }

      return apiResponse.success(res, content);
    } catch (error) {
      console.error('Schedule content error:', error);
      return apiResponse.serverError(res, 'Failed to schedule content');
    }
  });

  // Approve content
  router.post('/:id/approve', validate(approveContentSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const userId = req.tenant!.userId;

      const content = await calendarService.approveContent(tenantId, req.params.id, userId);

      if (!content) {
        return apiResponse.notFound(res, 'Content not found');
      }

      return apiResponse.success(res, content);
    } catch (error) {
      console.error('Approve content error:', error);
      return apiResponse.serverError(res, 'Failed to approve content');
    }
  });

  // Publish content immediately
  router.post('/:id/publish', validate(publishContentSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const content = await calendarService.getContentById(tenantId, req.params.id);

      if (!content) {
        return apiResponse.notFound(res, 'Content not found');
      }

      const results = await publisherService.publishContent(tenantId, content.id);
      return apiResponse.success(res, results);
    } catch (error) {
      console.error('Publish content error:', error);
      return apiResponse.serverError(res, 'Failed to publish content');
    }
  });

  // ============================================================================
  // AI FEATURES
  // ============================================================================

  // Generate content ideas
  router.post('/ai/ideas', validate(generateIdeasSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const ideas = await generatorService.generateIdeas(tenantId, req.body);
      return apiResponse.success(res, ideas);
    } catch (error) {
      console.error('Generate ideas error:', error);
      return apiResponse.serverError(res, 'Failed to generate ideas');
    }
  });

  // Generate caption
  router.post('/ai/caption', validate(generateCaptionSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const caption = await generatorService.generateCaption(tenantId, req.body);
      return apiResponse.success(res, caption);
    } catch (error) {
      console.error('Generate caption error:', error);
      return apiResponse.serverError(res, 'Failed to generate caption');
    }
  });

  // Generate script
  router.post('/ai/script', validate(generateScriptSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const script = await generatorService.generateScript(tenantId, req.body);
      return apiResponse.success(res, script);
    } catch (error) {
      console.error('Generate script error:', error);
      return apiResponse.serverError(res, 'Failed to generate script');
    }
  });

  // Suggest hashtags
  router.post('/ai/hashtags', validate(suggestHashtagsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const { topic, platform } = req.body;
      const hashtags = await generatorService.suggestHashtags(tenantId, topic, platform);
      return apiResponse.success(res, hashtags);
    } catch (error) {
      console.error('Suggest hashtags error:', error);
      return apiResponse.serverError(res, 'Failed to suggest hashtags');
    }
  });

  // Get optimal posting times
  router.get('/ai/best-times', validate(getBestTimesSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const platform = req.query.platform as string;
      // daysAhead param is accepted but not used in current implementation
      // const daysAhead = req.query.days_ahead
      //   ? parseInt(req.query.days_ahead as string, 10)
      //   : 7;

      const times = await generatorService.getOptimalPostingTimes(
        tenantId,
        platform
      );

      return apiResponse.success(res, times);
    } catch (error) {
      console.error('Get best times error:', error);
      return apiResponse.serverError(res, 'Failed to get best times');
    }
  });

  // Get trending content
  router.get('/ai/trending', validate(getTrendingSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const filters = {
        platform: req.query.platform as string | undefined,
        type: req.query.type as 'sound' | 'hashtag' | 'challenge' | 'template' | 'effect' | undefined,
        hospitalityOnly: req.query.hospitality_only !== 'false',
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      };

      const trending = await trendingService.getTrending(tenantId, filters);
      return apiResponse.success(res, trending);
    } catch (error) {
      console.error('Get trending error:', error);
      return apiResponse.serverError(res, 'Failed to get trending');
    }
  });

  // Get trending sounds
  router.get('/ai/trending/sounds', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const platform = req.query.platform as 'tiktok' | 'instagram' | undefined;

      const sounds = await trendingService.getTrendingSounds(tenantId, platform);
      return apiResponse.success(res, sounds);
    } catch (error) {
      console.error('Get trending sounds error:', error);
      return apiResponse.serverError(res, 'Failed to get trending sounds');
    }
  });

  // Get trending hashtags
  router.get('/ai/trending/hashtags', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const platform = req.query.platform as string | undefined;
      const hospitalityOnly = req.query.hospitality_only !== 'false';

      const hashtags = await trendingService.getTrendingHashtags(
        tenantId,
        platform,
        hospitalityOnly
      );

      return apiResponse.success(res, hashtags);
    } catch (error) {
      console.error('Get trending hashtags error:', error);
      return apiResponse.serverError(res, 'Failed to get trending hashtags');
    }
  });

  // Get trending challenges
  router.get('/ai/trending/challenges', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const platform = req.query.platform as string | undefined;

      const challenges = await trendingService.getTrendingChallenges(tenantId, platform);
      return apiResponse.success(res, challenges);
    } catch (error) {
      console.error('Get trending challenges error:', error);
      return apiResponse.serverError(res, 'Failed to get trending challenges');
    }
  });

  return router;
}
