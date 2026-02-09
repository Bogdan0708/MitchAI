/**
 * AI ROUTES
 *
 * API endpoints for AI orchestration services
 * Handles review responses, menu descriptions, content generation, etc.
 */

import { Router } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { validate } from '../middleware/validate.middleware';
import { apiResponse } from '../lib/api-response';
import { getHospitalityAI } from '../services/ai';
import { AIRateLimiter } from '../middleware/rateLimit.middleware';

// Import validators (we'll create these)
import {
  generateReviewResponseSchema,
  generateMenuDescriptionSchema,
  generateContentSchema,
  analyzeSentimentSchema,
  translateSchema,
  chatSchema,
} from '../validators/ai-orchestrator.validator';

export function createAIRouter(pool: Pool, redis?: Redis): Router {
  const router = Router();
  const hospitalityAI = getHospitalityAI();
  
  // AI-specific rate limiting (if Redis available)
  const aiRateLimiter = redis ? new AIRateLimiter(redis) : null;

  // ============================================================================
  // HEALTH & STATUS
  // ============================================================================

  /**
   * GET /ai/health
   * Check AI service health and available providers
   */
  router.get('/health', async (_req, res) => {
    try {
      const health = await hospitalityAI.healthCheck();
      return apiResponse.success(res, health);
    } catch (error) {
      console.error('AI health check error:', error);
      return apiResponse.serverError(res, 'AI health check failed');
    }
  });

  /**
   * GET /ai/models
   * List available AI models, optionally filtered by task type
   */
  router.get('/models', async (req, res) => {
    try {
      const taskType = req.query.task as string | undefined;
      const models = hospitalityAI.getAvailableModels(taskType as any);
      
      return apiResponse.success(res, {
        count: models.length,
        models: models.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          supportedTasks: m.supportedTasks,
          contextWindow: m.contextWindow,
        })),
      });
    } catch (error) {
      console.error('List models error:', error);
      return apiResponse.serverError(res, 'Failed to list models');
    }
  });

  // ============================================================================
  // REVIEW RESPONSES
  // ============================================================================

  /**
   * POST /ai/review-response
   * Generate a professional response to a customer review
   */
  router.post('/review-response', 
    ...(aiRateLimiter ? [aiRateLimiter.standard] : []),
    validate(generateReviewResponseSchema), 
    async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { review, business_context, wallet_address, preferred_provider } = req.body;

      // Get business info from tenant if not provided
      let businessContext = business_context;
      if (!businessContext) {
        const tenantResult = await pool.query(
          'SELECT name, business_type FROM tenants WHERE id = $1',
          [tenantId]
        );
        if (tenantResult.rows[0]) {
          businessContext = {
            name: tenantResult.rows[0].name,
            type: tenantResult.rows[0].business_type || 'restaurant',
          };
        }
      }

      const response = await hospitalityAI.generateReviewResponse({
        tenantId,
        walletAddress: wallet_address,
        review: {
          platform: review.platform,
          rating: review.rating,
          text: review.text,
          customerName: review.customer_name,
          date: review.date,
        },
        businessContext: {
          name: businessContext?.name || 'Our Business',
          type: businessContext?.type || 'restaurant',
          tone: businessContext?.tone,
          language: businessContext?.language,
        },
        preferredProvider: preferred_provider,
      });

      if (!response.success) {
        return apiResponse.badRequest(res, response.error || 'Failed to generate response');
      }

      // Log usage for analytics
      await logAIUsage(pool, tenantId, 'review_response', response);

      return apiResponse.success(res, {
        response: response.content,
        provider: response.provider,
        model: response.model,
        credits_used: response.creditsUsed,
        latency_ms: response.latencyMs,
      });
    } catch (error) {
      console.error('Generate review response error:', error);
      return apiResponse.serverError(res, 'Failed to generate review response');
    }
  });

  // ============================================================================
  // MENU DESCRIPTIONS
  // ============================================================================

  /**
   * POST /ai/menu-description
   * Generate an appetizing menu item description
   */
  router.post('/menu-description', 
    ...(aiRateLimiter ? [aiRateLimiter.heavy] : []),
    validate(generateMenuDescriptionSchema), 
    async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { item, style, language, max_length, wallet_address } = req.body;

      const response = await hospitalityAI.generateMenuDescription({
        tenantId,
        walletAddress: wallet_address,
        item: {
          name: item.name,
          category: item.category,
          ingredients: item.ingredients,
          allergens: item.allergens,
          price: item.price,
          isVegetarian: item.is_vegetarian,
          isVegan: item.is_vegan,
          isGlutenFree: item.is_gluten_free,
        },
        style: style || 'descriptive',
        language,
        maxLength: max_length,
      });

      if (!response.success) {
        return apiResponse.badRequest(res, response.error || 'Failed to generate description');
      }

      await logAIUsage(pool, tenantId, 'menu_description', response);

      return apiResponse.success(res, {
        description: response.content,
        provider: response.provider,
        model: response.model,
        credits_used: response.creditsUsed,
        latency_ms: response.latencyMs,
      });
    } catch (error) {
      console.error('Generate menu description error:', error);
      return apiResponse.serverError(res, 'Failed to generate menu description');
    }
  });

  /**
   * POST /ai/menu-description/batch
   * Generate descriptions for multiple menu items
   */
  router.post('/menu-description/batch', 
    ...(aiRateLimiter ? [aiRateLimiter.batch] : []),
    async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { items, style, language, wallet_address } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return apiResponse.badRequest(res, 'Items array is required');
      }

      if (items.length > 20) {
        return apiResponse.badRequest(res, 'Maximum 20 items per batch');
      }

      const results = await Promise.all(
        items.map(async (item: any) => {
          const response = await hospitalityAI.generateMenuDescription({
            tenantId,
            walletAddress: wallet_address,
            item: {
              name: item.name,
              category: item.category,
              ingredients: item.ingredients,
              allergens: item.allergens,
              price: item.price,
              isVegetarian: item.is_vegetarian,
              isVegan: item.is_vegan,
              isGlutenFree: item.is_gluten_free,
            },
            style: style || 'descriptive',
            language,
          });

          return {
            id: item.id,
            item_name: item.name,
            success: response.success,
            description: response.content,
            error: response.error,
          };
        })
      );

      const successful = results.filter(r => r.success).length;
      await logAIUsage(pool, tenantId, 'menu_description_batch', { count: successful });

      return apiResponse.success(res, {
        total: items.length,
        successful,
        failed: items.length - successful,
        results,
      });
    } catch (error) {
      console.error('Batch menu description error:', error);
      return apiResponse.serverError(res, 'Failed to generate menu descriptions');
    }
  });

  // ============================================================================
  // CONTENT GENERATION
  // ============================================================================

  /**
   * POST /ai/content
   * Generate marketing content (social posts, emails, promos)
   */
  router.post('/content', 
    ...(aiRateLimiter ? [aiRateLimiter.heavy] : []),
    validate(generateContentSchema), 
    async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { type, topic, context, tone, platform, language, max_length, wallet_address } = req.body;

      const response = await hospitalityAI.generateContent({
        tenantId,
        walletAddress: wallet_address,
        type,
        topic,
        context,
        tone,
        platform,
        language,
        maxLength: max_length,
      });

      if (!response.success) {
        return apiResponse.badRequest(res, response.error || 'Failed to generate content');
      }

      await logAIUsage(pool, tenantId, 'content_generation', response);

      return apiResponse.success(res, {
        content: response.content,
        type,
        platform,
        provider: response.provider,
        model: response.model,
        credits_used: response.creditsUsed,
        latency_ms: response.latencyMs,
      });
    } catch (error) {
      console.error('Generate content error:', error);
      return apiResponse.serverError(res, 'Failed to generate content');
    }
  });

  // ============================================================================
  // SENTIMENT ANALYSIS
  // ============================================================================

  /**
   * POST /ai/sentiment
   * Analyze sentiment of customer feedback
   */
  router.post('/sentiment', 
    ...(aiRateLimiter ? [aiRateLimiter.standard] : []),
    validate(analyzeSentimentSchema), 
    async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { texts, wallet_address } = req.body;

      if (texts.length > 50) {
        return apiResponse.badRequest(res, 'Maximum 50 texts per request');
      }

      const result = await hospitalityAI.analyzeSentiment({
        tenantId,
        walletAddress: wallet_address,
        texts,
      });

      if (!result.success) {
        return apiResponse.badRequest(res, result.error || 'Failed to analyze sentiment');
      }

      await logAIUsage(pool, tenantId, 'sentiment_analysis', { count: texts.length });

      return apiResponse.success(res, {
        results: result.results,
        summary: summarizeSentiment(result.results || []),
      });
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return apiResponse.serverError(res, 'Failed to analyze sentiment');
    }
  });

  // ============================================================================
  // TRANSLATION
  // ============================================================================

  /**
   * POST /ai/translate
   * Translate content with hospitality context
   */
  router.post('/translate', 
    ...(aiRateLimiter ? [aiRateLimiter.standard] : []),
    validate(translateSchema), 
    async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { text, target_language, source_language, context, wallet_address } = req.body;

      const response = await hospitalityAI.translate({
        tenantId,
        walletAddress: wallet_address,
        text,
        targetLanguage: target_language,
        sourceLanguage: source_language,
        context,
      });

      if (!response.success) {
        return apiResponse.badRequest(res, response.error || 'Failed to translate');
      }

      await logAIUsage(pool, tenantId, 'translation', response);

      return apiResponse.success(res, {
        original: text,
        translated: response.content,
        target_language,
        source_language: source_language || 'auto-detected',
        provider: response.provider,
        model: response.model,
        credits_used: response.creditsUsed,
        latency_ms: response.latencyMs,
      });
    } catch (error) {
      console.error('Translation error:', error);
      return apiResponse.serverError(res, 'Failed to translate');
    }
  });

  // ============================================================================
  // CHAT / ASSISTANT
  // ============================================================================

  /**
   * POST /ai/chat
   * General hospitality assistant chat
   */
  router.post('/chat', 
    ...(aiRateLimiter ? [aiRateLimiter.heavy] : []),
    validate(chatSchema), 
    async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { messages, business_context, wallet_address, preferred_provider } = req.body;

      const response = await hospitalityAI.chat(
        tenantId,
        messages,
        {
          walletAddress: wallet_address,
          businessContext: business_context,
          preferredProvider: preferred_provider,
        }
      );

      if (!response.success) {
        return apiResponse.badRequest(res, response.error || 'Chat failed');
      }

      await logAIUsage(pool, tenantId, 'chat', response);

      return apiResponse.success(res, {
        response: response.content,
        provider: response.provider,
        model: response.model,
        usage: response.usage,
        credits_used: response.creditsUsed,
        latency_ms: response.latencyMs,
      });
    } catch (error) {
      console.error('Chat error:', error);
      return apiResponse.serverError(res, 'Chat failed');
    }
  });

  // ============================================================================
  // USAGE & ANALYTICS
  // ============================================================================

  /**
   * GET /ai/usage
   * Get AI usage statistics for the tenant
   */
  router.get('/usage', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const period = (req.query.period as string) || '30d';

      const usage = await getAIUsageStats(pool, tenantId, period);
      return apiResponse.success(res, usage);
    } catch (error) {
      console.error('Get AI usage error:', error);
      return apiResponse.serverError(res, 'Failed to get AI usage');
    }
  });

  return router;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
}

function summarizeSentiment(results: SentimentResult[]) {
  if (results.length === 0) {
    return { positive: 0, neutral: 0, negative: 0, average_score: 0 };
  }

  const counts = results.reduce(
    (acc, r) => {
      acc[r.sentiment]++;
      acc.total_score += r.score;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0, total_score: 0 }
  );

  return {
    positive: counts.positive,
    neutral: counts.neutral,
    negative: counts.negative,
    average_score: Number((counts.total_score / results.length).toFixed(3)),
  };
}

async function logAIUsage(
  pool: Pool,
  tenantId: string,
  taskType: string,
  response: any
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO ai_usage_logs (tenant_id, task_type, provider, model, credits_used, latency_ms, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        tenantId,
        taskType,
        response.provider || 'unknown',
        response.model || 'unknown',
        response.creditsUsed || response.count || 0,
        response.latencyMs || 0,
      ]
    );
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log AI usage:', error);
  }
}

async function getAIUsageStats(
  pool: Pool,
  tenantId: string,
  period: string
): Promise<any> {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  
  try {
    const result = await pool.query(
      `SELECT 
        task_type,
        provider,
        COUNT(*) as requests,
        SUM(credits_used) as total_credits,
        AVG(latency_ms)::integer as avg_latency_ms,
        DATE(created_at) as date
       FROM ai_usage_logs
       WHERE tenant_id = $1 
         AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY task_type, provider, DATE(created_at)
       ORDER BY date DESC, requests DESC`,
      [tenantId]
    );

    // Aggregate totals
    const totals = result.rows.reduce(
      (acc, row) => {
        acc.total_requests += parseInt(row.requests);
        acc.total_credits += parseInt(row.total_credits || '0');
        return acc;
      },
      { total_requests: 0, total_credits: 0 }
    );

    return {
      period,
      totals,
      by_task: groupBy(result.rows, 'task_type'),
      by_provider: groupBy(result.rows, 'provider'),
      daily: result.rows,
    };
  } catch (error) {
    // Table might not exist yet
    return {
      period,
      totals: { total_requests: 0, total_credits: 0 },
      by_task: {},
      by_provider: {},
      daily: [],
    };
  }
}

function groupBy(arr: any[], key: string): Record<string, any> {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) {
      acc[k] = { requests: 0, credits: 0 };
    }
    acc[k].requests += parseInt(item.requests);
    acc[k].credits += parseInt(item.total_credits || '0');
    return acc;
  }, {});
}
