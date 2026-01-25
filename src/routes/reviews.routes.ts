/**
 * REVIEWS ROUTES
 *
 * API endpoints for review management (Guest Whisperer)
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { validate } from '../middleware/validate.middleware';
import { apiResponse } from '../lib/api-response';
import {
  ReviewAggregatorService,
  ReviewAnalysisService,
  ReviewResponseService,
  ReviewInsightsService,
} from '../services/tenant/reviews';
import {
  connectPlatformSchema,
  syncPlatformSchema,
  listReviewsSchema,
  getReviewSchema,
  updateReviewStatusSchema,
  bulkUpdateStatusSchema,
  respondToReviewSchema,
  analyzeReviewSchema,
  generateResponseSchema,
  batchAnalyzeSchema,
  createTemplateSchema,
  updateTemplateSchema,
  getInsightsSchema,
  getTopicsSchema,
  getSentimentTrendSchema,
  compareLocationsSchema,
  generateInsightsSchema,
  exportReviewsSchema,
} from '../validators/reviews.validator';

export function createReviewsRouter(pool: Pool): Router {
  const router = Router();

  const aggregatorService = new ReviewAggregatorService(pool);
  const analysisService = new ReviewAnalysisService(pool);
  const responseService = new ReviewResponseService(pool);
  const insightsService = new ReviewInsightsService(pool);

  // ============================================================================
  // PLATFORM CONNECTIONS
  // ============================================================================

  // List connected platforms
  router.get('/platforms', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;

      const platforms = await aggregatorService.getConnectedPlatforms(tenantId, locationId);
      return apiResponse.success(res, platforms);
    } catch (error) {
      console.error('List platforms error:', error);
      return apiResponse.serverError(res, 'Failed to list platforms');
    }
  });

  // Connect platform
  router.post('/platforms/connect', validate(connectPlatformSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { location_id, platform, credentials } = req.body;

      const connection = await aggregatorService.connectPlatform(
        tenantId,
        location_id || null,
        platform,
        credentials
      );
      return apiResponse.created(res, connection);
    } catch (error) {
      console.error('Connect platform error:', error);
      return apiResponse.serverError(res, 'Failed to connect platform');
    }
  });

  // Disconnect platform
  router.delete('/platforms/:platform', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const platform = req.params.platform;
      const locationId = req.query.location_id as string | undefined;

      await aggregatorService.disconnectPlatform(tenantId, platform, locationId);
      return apiResponse.success(res, { message: 'Platform disconnected' });
    } catch (error) {
      console.error('Disconnect platform error:', error);
      return apiResponse.serverError(res, 'Failed to disconnect platform');
    }
  });

  // Sync reviews from platform
  router.post('/platforms/:platform/sync', validate(syncPlatformSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const platform = req.params.platform;

      const result = await aggregatorService.syncReviews(tenantId, platform);
      return apiResponse.success(res, result);
    } catch (error) {
      console.error('Sync platform error:', error);
      return apiResponse.serverError(res, 'Failed to sync platform');
    }
  });

  // ============================================================================
  // RESPONSE TEMPLATES (must come before /:id routes)
  // ============================================================================

  // List templates
  router.get('/templates', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const category = req.query.category as 'positive' | 'negative' | 'neutral' | 'complaint_food' | 'complaint_service' | 'apology' | 'thank_you' | undefined;

      const templates = await responseService.getTemplates(tenantId, category);
      return apiResponse.success(res, templates);
    } catch (error) {
      console.error('List templates error:', error);
      return apiResponse.serverError(res, 'Failed to list templates');
    }
  });

  // Create template
  router.post('/templates', validate(createTemplateSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const template = await responseService.createTemplate(tenantId, req.body);
      return apiResponse.created(res, template);
    } catch (error) {
      console.error('Create template error:', error);
      return apiResponse.serverError(res, 'Failed to create template');
    }
  });

  // Update template
  router.patch('/templates/:id', validate(updateTemplateSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const template = await responseService.updateTemplate(
        tenantId,
        req.params.id,
        req.body
      );

      if (!template) {
        return apiResponse.notFound(res, 'Template not found');
      }

      return apiResponse.success(res, template);
    } catch (error) {
      console.error('Update template error:', error);
      return apiResponse.serverError(res, 'Failed to update template');
    }
  });

  // Delete template
  router.delete('/templates/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const deleted = await responseService.deleteTemplate(tenantId, req.params.id);

      if (!deleted) {
        return apiResponse.notFound(res, 'Template not found');
      }

      return apiResponse.success(res, { message: 'Template deleted' });
    } catch (error) {
      console.error('Delete template error:', error);
      return apiResponse.serverError(res, 'Failed to delete template');
    }
  });

  // ============================================================================
  // INSIGHTS & ANALYTICS (must come before /:id routes)
  // ============================================================================

  // Get insights summary
  router.get('/insights/summary', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;
      const periodParam = (req.query.period as string) || 'weekly';

      // Map frontend period names to service period format
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        daily: 'week',
        weekly: 'week',
        monthly: 'month',
      };
      const servicePeriod = periodMap[periodParam] || 'month';

      const stats = await insightsService.getDashboardStats(tenantId, locationId, servicePeriod);
      return apiResponse.success(res, stats);
    } catch (error) {
      console.error('Get insights summary error:', error);
      return apiResponse.serverError(res, 'Failed to get insights summary');
    }
  });

  // Get insights
  router.get('/insights', validate(getInsightsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;
      const periodParam = (req.query.period as string) || '30d';

      // Map period string to service period format
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'quarter',
        week: 'week',
        month: 'month',
        quarter: 'quarter',
      };
      const servicePeriod = periodMap[periodParam] || 'month';

      const insights = await insightsService.getDashboardStats(tenantId, locationId, servicePeriod);
      return apiResponse.success(res, insights);
    } catch (error) {
      console.error('Get insights error:', error);
      return apiResponse.serverError(res, 'Failed to get insights');
    }
  });

  // Get topic trends
  router.get('/insights/topics', validate(getTopicsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;
      const periodParam = req.query.period as string | undefined;
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week', 'week': 'week',
        '30d': 'month', 'month': 'month',
        '90d': 'quarter', 'quarter': 'quarter',
      };
      const period = periodParam ? periodMap[periodParam] || 'month' : 'month';
      // Note: limit parameter not used in current service implementation

      const topics = await analysisService.getTopicTrends(tenantId, period, locationId);
      return apiResponse.success(res, topics);
    } catch (error) {
      console.error('Get topics error:', error);
      return apiResponse.serverError(res, 'Failed to get topics');
    }
  });

  // Get sentiment trend
  router.get('/insights/sentiment', validate(getSentimentTrendSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;
      const periodParam = req.query.period as string | undefined;
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week', 'week': 'week',
        '30d': 'month', 'month': 'month',
        '90d': 'quarter', 'quarter': 'quarter',
      };
      const period = periodParam ? periodMap[periodParam] || 'month' : 'month';

      const trend = await analysisService.getSentimentTrends(tenantId, period, locationId);
      return apiResponse.success(res, trend);
    } catch (error) {
      console.error('Get sentiment trend error:', error);
      return apiResponse.serverError(res, 'Failed to get sentiment trend');
    }
  });

  // Compare locations
  router.get('/insights/comparison', validate(compareLocationsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      // locationIds param not used in current service implementation
      // const locationIds = req.query.location_ids as string[] | undefined;
      const periodParam = req.query.period as string | undefined;
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week', 'week': 'week',
        '30d': 'month', 'month': 'month',
        '90d': 'quarter', 'quarter': 'quarter',
      };
      const period = periodParam ? periodMap[periodParam] || 'month' : 'month';

      const comparison = await insightsService.compareLocations(tenantId, period);
      return apiResponse.success(res, comparison);
    } catch (error) {
      console.error('Compare locations error:', error);
      return apiResponse.serverError(res, 'Failed to compare locations');
    }
  });

  // Generate insights
  router.post('/insights/generate', validate(generateInsightsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.body.location_id as string | undefined;
      const periodType = (req.body.period_type || 'daily') as 'daily' | 'weekly' | 'monthly';

      const insights = await insightsService.generatePeriodInsights(
        tenantId,
        periodType,
        new Date(req.body.start_date),
        new Date(req.body.end_date),
        locationId
      );

      return apiResponse.success(res, insights);
    } catch (error) {
      console.error('Generate insights error:', error);
      return apiResponse.serverError(res, 'Failed to generate insights');
    }
  });

  // Get dashboard stats
  router.get('/dashboard', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;

      const stats = await insightsService.getDashboardStats(tenantId, locationId);
      return apiResponse.success(res, stats);
    } catch (error) {
      console.error('Get dashboard error:', error);
      return apiResponse.serverError(res, 'Failed to get dashboard');
    }
  });

  // Export reviews
  router.post('/export', validate(exportReviewsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const exportUrl = await insightsService.exportReviews(tenantId, req.body);
      return apiResponse.success(res, { url: exportUrl });
    } catch (error) {
      console.error('Export reviews error:', error);
      return apiResponse.serverError(res, 'Failed to export reviews');
    }
  });

  // Bulk operations (must come before /:id routes)
  router.post('/bulk/status', validate(bulkUpdateStatusSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const count = await aggregatorService.bulkUpdateStatus(
        tenantId,
        req.body.review_ids,
        req.body.status
      );

      return apiResponse.success(res, { updated: count });
    } catch (error) {
      console.error('Bulk update status error:', error);
      return apiResponse.serverError(res, 'Failed to bulk update status');
    }
  });

  // AI batch operations (must come before /:id routes)
  router.post('/ai/batch-analyze', validate(batchAnalyzeSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      // Get all reviews
      const reviews = await Promise.all(
        req.body.review_ids.map((id: string) => aggregatorService.getReviewById(tenantId, id))
      );

      const validReviewIds = req.body.review_ids.filter(
        (_id: string, i: number) => reviews[i] !== null
      ) as string[];

      if (validReviewIds.length === 0) {
        return apiResponse.badRequest(res, 'No valid reviews found');
      }

      const results = await analysisService.batchAnalyze(tenantId, validReviewIds);
      return apiResponse.success(res, results);
    } catch (error) {
      console.error('Batch analyze error:', error);
      return apiResponse.serverError(res, 'Failed to batch analyze reviews');
    }
  });

  // ============================================================================
  // REVIEWS
  // ============================================================================

  // List reviews (also handles /reviews path for /api/v1/review-management/reviews)
  router.get('/reviews', validate(listReviewsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const filters = {
        locationId: req.query.location_id as string | undefined,
        platform: req.query.platform as string | undefined,
        sentimentLabel: req.query.sentiment as 'positive' | 'neutral' | 'negative' | 'mixed' | undefined,
        status: req.query.status as 'new' | 'in_progress' | 'responded' | 'flagged' | 'archived' | undefined,
        isResponded: req.query.is_responded === 'true' ? true :
                     req.query.is_responded === 'false' ? false : undefined,
        ratingMin: req.query.rating_min ? parseFloat(req.query.rating_min as string) : undefined,
        ratingMax: req.query.rating_max ? parseFloat(req.query.rating_max as string) : undefined,
        hasComplianceFlags: req.query.has_compliance_flags === 'true',
        startDate: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        endDate: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
        search: req.query.search as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      const result = await aggregatorService.getReviews(tenantId, filters);
      return apiResponse.success(res, result);
    } catch (error) {
      console.error('List reviews error:', error);
      return apiResponse.serverError(res, 'Failed to list reviews');
    }
  });

  // Get review by ID (MUST come after all named routes)
  router.get('/:id', validate(getReviewSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const review = await aggregatorService.getReviewById(tenantId, req.params.id);

      if (!review) {
        return apiResponse.notFound(res, 'Review not found');
      }

      return apiResponse.success(res, review);
    } catch (error) {
      console.error('Get review error:', error);
      return apiResponse.serverError(res, 'Failed to get review');
    }
  });

  // Update review status
  router.patch('/:id/status', validate(updateReviewStatusSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const updateCount = await aggregatorService.bulkUpdateStatus(
        tenantId,
        [req.params.id],
        req.body.status
      );
      const review = updateCount > 0
        ? await aggregatorService.getReviewById(tenantId, req.params.id)
        : null;

      if (!review) {
        return apiResponse.notFound(res, 'Review not found');
      }

      return apiResponse.success(res, review);
    } catch (error) {
      console.error('Update review status error:', error);
      return apiResponse.serverError(res, 'Failed to update review status');
    }
  });

  // Respond to review
  router.post('/:id/respond', validate(respondToReviewSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const userId = req.tenant!.userId;

      const review = await responseService.submitResponse(
        tenantId,
        req.params.id,
        userId,
        req.body.response_text,
        false // aiResponseUsed
      );

      if (!review) {
        return apiResponse.notFound(res, 'Review not found');
      }

      return apiResponse.success(res, review);
    } catch (error) {
      console.error('Respond to review error:', error);
      return apiResponse.serverError(res, 'Failed to respond to review');
    }
  });

  // ============================================================================
  // AI FEATURES
  // ============================================================================

  // Analyze single review
  router.post('/:id/ai/analyze', validate(analyzeReviewSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const review = await aggregatorService.getReviewById(tenantId, req.params.id);

      if (!review) {
        return apiResponse.notFound(res, 'Review not found');
      }

      const analysis = await analysisService.analyzeReview(tenantId, req.params.id);
      return apiResponse.success(res, analysis);
    } catch (error) {
      console.error('Analyze review error:', error);
      return apiResponse.serverError(res, 'Failed to analyze review');
    }
  });

  // Generate AI response
  router.post('/:id/ai/generate-response', validate(generateResponseSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const review = await aggregatorService.getReviewById(tenantId, req.params.id);

      if (!review) {
        return apiResponse.notFound(res, 'Review not found');
      }

      const response = await responseService.generateResponse(tenantId, {
        reviewId: req.params.id,
        templateId: req.body.template_id,
        tone: req.body.tone,
        includePromotion: req.body.include_offer,
        promotionText: req.body.custom_instructions,
      });

      return apiResponse.success(res, response);
    } catch (error) {
      console.error('Generate response error:', error);
      return apiResponse.serverError(res, 'Failed to generate response');
    }
  });

  return router;
}
