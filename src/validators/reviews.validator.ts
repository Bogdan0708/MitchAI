import { z } from 'zod';

// ============================================
// PLATFORM CONNECTIONS
// ============================================

export const connectPlatformSchema = z.object({
  body: z.object({
    platform: z.enum(['google', 'tripadvisor', 'yelp', 'facebook']),
    location_id: z.string().uuid().optional(),
    credentials: z.object({
      api_key: z.string().optional(),
      access_token: z.string().optional(),
      refresh_token: z.string().optional(),
      client_id: z.string().optional(),
      client_secret: z.string().optional(),
    }),
    place_id: z.string().optional(),
  }),
});

export const syncPlatformSchema = z.object({
  params: z.object({
    platform: z.enum(['google', 'tripadvisor', 'yelp', 'facebook']),
  }),
});

// ============================================
// REVIEWS
// ============================================

export const listReviewsSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    platform: z.enum(['google', 'tripadvisor', 'yelp', 'facebook', 'internal']).optional(),
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).optional(),
    status: z.enum(['new', 'in_progress', 'responded', 'flagged', 'archived']).optional(),
    is_responded: z.coerce.boolean().optional(),
    rating_min: z.coerce.number().min(1).max(5).optional(),
    rating_max: z.coerce.number().min(1).max(5).optional(),
    has_compliance_flags: z.coerce.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

export const getReviewSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const updateReviewStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['new', 'in_progress', 'responded', 'flagged', 'archived']),
  }),
});

export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    review_ids: z.array(z.string().uuid()).min(1).max(100),
    status: z.enum(['new', 'in_progress', 'responded', 'flagged', 'archived']),
  }),
});

export const respondToReviewSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    response_text: z.string().min(1, 'Response text is required'),
  }),
});

// ============================================
// AI FEATURES
// ============================================

export const analyzeReviewSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const generateResponseSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    template_id: z.string().uuid().optional(),
    tone: z.enum(['professional', 'friendly', 'apologetic', 'enthusiastic']).optional(),
    include_offer: z.boolean().optional(),
    custom_instructions: z.string().optional(),
  }),
});

export const batchAnalyzeSchema = z.object({
  body: z.object({
    review_ids: z.array(z.string().uuid()).min(1).max(50),
  }),
});

// ============================================
// RESPONSE TEMPLATES
// ============================================

export const createTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Template name is required'),
    category: z.enum(['positive', 'negative', 'neutral', 'complaint_food', 'complaint_service']),
    template_text: z.string().min(1, 'Template text is required'),
    variables: z.array(z.object({
      name: z.string(),
      required: z.boolean().optional(),
      default_value: z.string().optional(),
    })).optional(),
    tone: z.enum(['professional', 'friendly', 'apologetic', 'enthusiastic']).optional(),
    language: z.string().length(2).optional(),
  }),
});

export const updateTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().optional(),
    category: z.enum(['positive', 'negative', 'neutral', 'complaint_food', 'complaint_service']).optional(),
    template_text: z.string().optional(),
    variables: z.array(z.object({
      name: z.string(),
      required: z.boolean().optional(),
      default_value: z.string().optional(),
    })).optional(),
    tone: z.enum(['professional', 'friendly', 'apologetic', 'enthusiastic']).optional(),
    language: z.string().length(2).optional(),
    is_active: z.boolean().optional(),
  }),
});

// ============================================
// INSIGHTS & ANALYTICS
// ============================================

export const getInsightsSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
    period_type: z.enum(['daily', 'weekly', 'monthly']).optional(),
  }),
});

export const getTopicsSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

export const getSentimentTrendSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
    granularity: z.enum(['day', 'week', 'month']).optional(),
  }),
});

export const compareLocationsSchema = z.object({
  query: z.object({
    location_ids: z.string().transform((val) => val.split(',')).optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
  }),
});

export const generateInsightsSchema = z.object({
  body: z.object({
    location_id: z.string().uuid().optional(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  }),
});

// ============================================
// EXPORT
// ============================================

export const exportReviewsSchema = z.object({
  body: z.object({
    location_id: z.string().uuid().optional(),
    platform: z.enum(['google', 'tripadvisor', 'yelp', 'facebook', 'internal']).optional(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    include_responses: z.boolean().optional(),
    include_analysis: z.boolean().optional(),
    format: z.enum(['csv', 'json', 'xlsx']).optional(),
  }),
});
