import { z } from 'zod';

// ============================================
// SOCIAL ACCOUNTS
// ============================================

export const connectAccountSchema = z.object({
  body: z.object({
    platform: z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube']),
    location_id: z.string().uuid().optional(),
    account_id: z.string(),
    account_name: z.string().optional(),
    account_handle: z.string().optional(),
    access_token: z.string(),
    refresh_token: z.string().optional(),
    token_expires_at: z.string().datetime().optional(),
  }),
});

export const disconnectAccountSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const getAccountStatsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// ============================================
// CONTENT CALENDAR
// ============================================

export const listContentSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
    content_type: z.enum(['video', 'image', 'carousel', 'story', 'reel']).optional(),
    platform: z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube']).optional(),
    campaign_id: z.string().uuid().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

export const getCalendarViewSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  }),
});

export const createContentSchema = z.object({
  body: z.object({
    location_id: z.string().uuid().optional(),
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    content_type: z.enum(['video', 'image', 'carousel', 'story', 'reel']),
    platforms: z.array(z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube'])).min(1),
    caption: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    media_urls: z.array(z.object({
      url: z.string().url(),
      type: z.enum(['image', 'video']),
      thumbnail_url: z.string().url().optional(),
    })).optional(),
    menu_item_id: z.string().uuid().optional(),
    campaign_id: z.string().uuid().optional(),
    scheduled_at: z.string().datetime().optional(),
    approval_required: z.boolean().optional(),
  }),
});

export const updateContentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    content_type: z.enum(['video', 'image', 'carousel', 'story', 'reel']).optional(),
    platforms: z.array(z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube'])).optional(),
    caption: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    media_urls: z.array(z.object({
      url: z.string().url(),
      type: z.enum(['image', 'video']),
      thumbnail_url: z.string().url().optional(),
    })).optional(),
    menu_item_id: z.string().uuid().nullable().optional(),
    campaign_id: z.string().uuid().nullable().optional(),
    scheduled_at: z.string().datetime().nullable().optional(),
  }),
});

export const scheduleContentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    scheduled_at: z.string().datetime(),
  }),
});

export const approveContentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const publishContentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// ============================================
// MEDIA
// ============================================

export const uploadMediaSchema = z.object({
  body: z.object({
    filename: z.string(),
    content_type: z.string(),
    size: z.number().int().max(100 * 1024 * 1024), // 100MB max
  }),
});

export const listMediaSchema = z.object({
  query: z.object({
    type: z.enum(['image', 'video']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

// ============================================
// CAMPAIGNS
// ============================================

export const listCampaignsSchema = z.object({
  query: z.object({
    status: z.enum(['active', 'completed', 'draft']).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

export const createCampaignSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Campaign name is required'),
    description: z.string().optional(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime().optional(),
    goals: z.object({
      target_views: z.number().int().optional(),
      target_engagement: z.number().optional(),
      target_followers: z.number().int().optional(),
    }).optional(),
    theme: z.string().optional(),
    brand_guidelines: z.object({
      colors: z.array(z.string()).optional(),
      fonts: z.array(z.string()).optional(),
      tone: z.string().optional(),
    }).optional(),
    hashtag_strategy: z.array(z.string()).optional(),
  }),
});

export const updateCampaignSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().nullable().optional(),
    goals: z.object({
      target_views: z.number().int().optional(),
      target_engagement: z.number().optional(),
      target_followers: z.number().int().optional(),
    }).optional(),
    theme: z.string().optional(),
    brand_guidelines: z.object({
      colors: z.array(z.string()).optional(),
      fonts: z.array(z.string()).optional(),
      tone: z.string().optional(),
    }).optional(),
    hashtag_strategy: z.array(z.string()).optional(),
    status: z.enum(['active', 'completed', 'draft']).optional(),
  }),
});

export const getCampaignPerformanceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// ============================================
// AI FEATURES
// ============================================

export const generateIdeasSchema = z.object({
  body: z.object({
    platform: z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube']).optional(),
    content_type: z.enum(['video', 'image', 'carousel', 'story', 'reel']).optional(),
    menu_item_id: z.string().uuid().optional(),
    theme: z.string().optional(),
    count: z.number().int().min(1).max(10).optional(),
  }),
});

export const generateCaptionSchema = z.object({
  body: z.object({
    content_id: z.string().uuid().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    platform: z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube']),
    tone: z.enum(['professional', 'casual', 'humorous', 'inspirational']).optional(),
    include_cta: z.boolean().optional(),
    cta_type: z.enum(['visit', 'order', 'follow', 'share', 'comment']).optional(),
  }),
});

export const generateScriptSchema = z.object({
  body: z.object({
    topic: z.string().min(1, 'Topic is required'),
    duration_seconds: z.number().int().min(5).max(180).optional(),
    style: z.enum(['tutorial', 'behind_scenes', 'story', 'promotional', 'educational']).optional(),
    tone: z.enum(['professional', 'casual', 'humorous', 'inspirational']).optional(),
    include_hook: z.boolean().optional(),
    include_cta: z.boolean().optional(),
  }),
});

export const suggestHashtagsSchema = z.object({
  body: z.object({
    content_id: z.string().uuid().optional(),
    caption: z.string().optional(),
    platform: z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube']).optional(),
    count: z.number().int().min(5).max(30).optional(),
  }),
});

export const getBestTimesSchema = z.object({
  query: z.object({
    platform: z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube']),
    days_ahead: z.coerce.number().int().min(1).max(14).optional(),
  }),
});

export const getTrendingSchema = z.object({
  query: z.object({
    platform: z.enum(['tiktok', 'instagram']).optional(),
    type: z.enum(['sound', 'hashtag', 'challenge', 'template', 'effect']).optional(),
    hospitality_only: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

// ============================================
// ANALYTICS
// ============================================

export const getAnalyticsSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    platform: z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube']).optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
  }),
});

export const getTopPerformingSchema = z.object({
  query: z.object({
    platform: z.enum(['tiktok', 'instagram', 'facebook', 'twitter', 'youtube']).optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
    metric: z.enum(['views', 'likes', 'comments', 'shares', 'engagement']).optional(),
    limit: z.coerce.number().int().min(1).max(20).optional(),
  }),
});
