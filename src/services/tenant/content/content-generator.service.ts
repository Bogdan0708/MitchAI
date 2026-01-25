/**
 * Content Generator Service
 *
 * Provides AI-powered content generation including captions,
 * scripts, hashtag suggestions, and content ideas.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { PlatformCaption } from './content-calendar.service';

// Types
export interface ContentIdea {
  id: string;
  tenantId: string;
  source: 'ai_generated' | 'trending' | 'user_submitted' | 'competitor';
  title: string;
  description: string | null;
  contentType: 'video' | 'image' | 'carousel' | 'story' | 'reel' | null;
  suggestedPlatforms: string[] | null;
  trendingScore: number | null;
  referenceUrls: string[] | null;
  aiScript: string | null;
  tags: string[] | null;
  status: 'new' | 'approved' | 'rejected' | 'used';
  usedInContentId: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface IdeaGenerationParams {
  menuItemId?: string;
  theme?: string;
  platform?: string;
  contentType?: 'video' | 'image' | 'carousel' | 'story' | 'reel';
  seasonalEvent?: string;
  count?: number;
}

export interface CaptionParams {
  contentType: 'video' | 'image' | 'carousel' | 'story' | 'reel';
  platform: string;
  topic: string;
  tone?: 'professional' | 'casual' | 'playful' | 'informative';
  includeCallToAction?: boolean;
  maxLength?: number;
  menuItemName?: string;
  menuItemDescription?: string;
}

export interface ScriptParams {
  duration: number; // seconds
  style: 'tutorial' | 'behind_scenes' | 'showcase' | 'story' | 'trending';
  topic: string;
  menuItemName?: string;
  keyPoints?: string[];
  callToAction?: string;
}

export interface GeneratedScript {
  scenes: ScriptScene[];
  totalDuration: number;
  hook: string;
  callToAction: string;
  suggestedMusic: string[];
  props: string[];
}

export interface ScriptScene {
  sceneNumber: number;
  duration: number;
  visualDescription: string;
  dialogue: string | null;
  textOverlay: string | null;
  transition: string;
}

export interface HashtagSuggestion {
  hashtag: string;
  category: 'branded' | 'industry' | 'trending' | 'niche' | 'location';
  popularity: 'low' | 'medium' | 'high';
  relevance: number; // 0-1
}

export interface OptimalPostingTime {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  score: number; // engagement score
  reason: string;
}

// Platform-specific character limits
const PLATFORM_LIMITS: Record<string, { caption: number; hashtags: number }> = {
  tiktok: { caption: 2200, hashtags: 30 },
  instagram: { caption: 2200, hashtags: 30 },
  facebook: { caption: 63206, hashtags: 30 },
  twitter: { caption: 280, hashtags: 10 },
  youtube: { caption: 5000, hashtags: 15 },
};

// Hospitality-specific hashtag pools
const HASHTAG_POOLS: Record<string, string[]> = {
  industry: [
    'foodie', 'restaurant', 'foodlover', 'foodporn', 'instafood',
    'yummy', 'delicious', 'tasty', 'foodstagram', 'foodphotography',
    'chef', 'cooking', 'homemade', 'foodblogger', 'foodgasm',
  ],
  trending: [
    'fyp', 'foryou', 'foryoupage', 'viral', 'trending',
    'explorepage', 'explore', 'reels', 'reelsinstagram', 'tiktokfood',
  ],
  niche: [
    'streetfood', 'finedining', 'brunch', 'dinner', 'lunch',
    'breakfast', 'cocktails', 'wine', 'beer', 'coffee',
    'vegan', 'vegetarian', 'glutenfree', 'healthy', 'organic',
  ],
};

export class ContentGeneratorService {
  constructor(private pool: Pool) {}

  /**
   * Generate content ideas
   */
  public async generateIdeas(
    tenantId: string,
    params: IdeaGenerationParams
  ): Promise<ContentIdea[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const count = params.count || 5;
      const ideas: ContentIdea[] = [];

      // Get tenant info for context
      const tenantResult = await client.query(
        `SELECT name, settings FROM tenants WHERE id = $1`,
        [tenantId]
      );
      const tenant = tenantResult.rows[0];

      // Get menu item if specified
      let menuItem = null;
      if (params.menuItemId) {
        const menuResult = await client.query(
          `SELECT name, description, price FROM menu_items WHERE id = $1`,
          [params.menuItemId]
        );
        menuItem = menuResult.rows[0];
      }

      // Generate ideas based on parameters
      const generatedIdeas = this.generateIdeaTemplates(
        tenant?.name || 'Restaurant',
        menuItem,
        params,
        count
      );

      // Store ideas in database
      for (const idea of generatedIdeas) {
        const result = await client.query(
          `INSERT INTO content_ideas
           (tenant_id, source, title, description, content_type, suggested_platforms,
            trending_score, ai_script, tags, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, tenant_id as "tenantId", source, title, description,
                     content_type as "contentType", suggested_platforms as "suggestedPlatforms",
                     trending_score as "trendingScore", reference_urls as "referenceUrls",
                     ai_script as "aiScript", tags, status,
                     used_in_content_id as "usedInContentId",
                     created_at as "createdAt", expires_at as "expiresAt"`,
          [
            tenantId,
            'ai_generated',
            idea.title,
            idea.description,
            idea.contentType,
            JSON.stringify(idea.platforms),
            idea.score,
            idea.script || null,
            JSON.stringify(idea.tags),
            idea.expiresAt || null,
          ]
        );
        ideas.push(result.rows[0]);
      }

      logger.info('Content ideas generated', {
        tenantId,
        count: ideas.length,
        params,
      });

      return ideas;
    });
  }

  /**
   * Generate idea templates (would use AI in production)
   */
  private generateIdeaTemplates(
    restaurantName: string,
    menuItem: any,
    params: IdeaGenerationParams,
    count: number
  ): Array<{
    title: string;
    description: string;
    contentType: string;
    platforms: string[];
    score: number;
    script?: string;
    tags: string[];
    expiresAt?: Date;
  }> {
    const ideas: Array<{
      title: string;
      description: string;
      contentType: string;
      platforms: string[];
      score: number;
      script?: string;
      tags: string[];
      expiresAt?: Date;
    }> = [];

    // Template idea generators
    const ideaGenerators = [
      // Behind the scenes
      () => ({
        title: 'Behind the Scenes: Kitchen Prep',
        description: `Show the preparation process for ${menuItem?.name || 'your signature dish'}. Capture the chopping, seasoning, and plating in quick cuts.`,
        contentType: 'video',
        platforms: ['tiktok', 'instagram'],
        score: 0.85,
        tags: ['behindthescenes', 'kitchen', 'cheflife', 'cooking'],
      }),
      // Menu showcase
      () => ({
        title: `Featured: ${menuItem?.name || 'Weekly Special'}`,
        description: `Beautiful close-up shots of ${menuItem?.name || 'your featured dish'} with steam, garnish details, and the first bite.`,
        contentType: 'reel',
        platforms: ['instagram', 'facebook'],
        score: 0.8,
        tags: ['foodporn', 'foodie', 'delicious', restaurantName.toLowerCase().replace(/\s+/g, '')],
      }),
      // Customer experience
      () => ({
        title: 'Customer Reactions',
        description: 'Capture genuine customer reactions to their first bite. Get permission and film their expressions.',
        contentType: 'video',
        platforms: ['tiktok', 'instagram'],
        score: 0.9,
        tags: ['reaction', 'foodreaction', 'musteat', 'foodlover'],
      }),
      // Recipe teaser
      () => ({
        title: 'Secret Ingredient Reveal',
        description: `Tease the secret ingredient that makes ${menuItem?.name || 'your dish'} special without giving away the full recipe.`,
        contentType: 'reel',
        platforms: ['tiktok', 'instagram'],
        score: 0.75,
        tags: ['secretrecipe', 'cooking', 'chef', 'foodsecrets'],
      }),
      // Atmosphere
      () => ({
        title: 'Ambiance Tour',
        description: `A smooth walking tour through ${restaurantName} showing the decor, seating, and vibe.`,
        contentType: 'video',
        platforms: ['instagram', 'tiktok'],
        score: 0.7,
        tags: ['restaurant', 'ambiance', 'datenight', 'wheretoeat'],
      }),
      // Staff spotlight
      () => ({
        title: 'Meet Our Chef',
        description: 'Quick introduction to your head chef or key team member with a fun fact.',
        contentType: 'video',
        platforms: ['instagram', 'facebook'],
        score: 0.65,
        tags: ['chef', 'team', 'meettheteam', 'cheflife'],
      }),
      // Process video
      () => ({
        title: 'How It\'s Made',
        description: `Step-by-step process of making ${menuItem?.name || 'your signature dish'} in satisfying ASMR style.`,
        contentType: 'video',
        platforms: ['tiktok', 'youtube'],
        score: 0.88,
        tags: ['howto', 'asmr', 'cooking', 'satisfying'],
      }),
      // Trending format
      () => ({
        title: 'POV: You\'re at Our Restaurant',
        description: 'First-person POV video from entering to getting served, trending format.',
        contentType: 'reel',
        platforms: ['tiktok', 'instagram'],
        score: 0.92,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        tags: ['pov', 'trending', 'fyp', 'foodie'],
      }),
    ];

    // Apply filters and generate ideas
    for (let i = 0; i < Math.min(count, ideaGenerators.length); i++) {
      const idea = ideaGenerators[i]();

      // Filter by content type if specified
      if (params.contentType && idea.contentType !== params.contentType) {
        continue;
      }

      // Filter by platform if specified
      if (params.platform && !idea.platforms.includes(params.platform)) {
        continue;
      }

      ideas.push(idea);
    }

    // Add theme-specific ideas
    if (params.theme) {
      ideas.push({
        title: `${params.theme} Special`,
        description: `Content themed around ${params.theme} featuring your menu and atmosphere.`,
        contentType: 'carousel',
        platforms: ['instagram', 'facebook'],
        score: 0.7,
        tags: [params.theme.toLowerCase().replace(/\s+/g, ''), 'special', 'event'],
      });
    }

    // Add seasonal event ideas
    if (params.seasonalEvent) {
      ideas.push({
        title: `${params.seasonalEvent} Menu Preview`,
        description: `Showcase your ${params.seasonalEvent} specials and decorations.`,
        contentType: 'carousel',
        platforms: ['instagram', 'facebook'],
        score: 0.85,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        tags: [params.seasonalEvent.toLowerCase().replace(/\s+/g, ''), 'seasonal', 'menu'],
      });
    }

    return ideas.slice(0, count);
  }

  /**
   * Generate caption for content
   */
  public async generateCaption(
    tenantId: string,
    params: CaptionParams
  ): Promise<PlatformCaption> {
    const limit = PLATFORM_LIMITS[params.platform] || { caption: 2200, hashtags: 30 };
    const maxLength = params.maxLength || limit.caption;

    // In production, this would call AI provider
    const caption = this.generateCaptionText(params);
    const hashtags = await this.suggestHashtags(tenantId, params.topic, params.platform);

    // Truncate caption if needed (leaving room for hashtags)
    const hashtagText = hashtags.slice(0, 10).map((h) => h.hashtag).join(' ');
    const maxCaptionLength = maxLength - hashtagText.length - 10; // buffer

    let finalCaption = caption;
    if (finalCaption.length > maxCaptionLength) {
      finalCaption = finalCaption.substring(0, maxCaptionLength - 3) + '...';
    }

    return {
      platform: params.platform,
      caption: finalCaption,
      hashtags: hashtags.slice(0, limit.hashtags).map((h) => h.hashtag),
    };
  }

  /**
   * Generate caption text (would use AI in production)
   */
  private generateCaptionText(params: CaptionParams): string {
    const toneEmojis: Record<string, string[]> = {
      professional: ['✨', '🍽️'],
      casual: ['😋', '🤤', '❤️'],
      playful: ['🎉', '🔥', '💯', '😍'],
      informative: ['📍', '⏰', '💡'],
    };

    const emojis = toneEmojis[params.tone || 'casual'];
    const emoji1 = emojis[0];
    const emoji2 = emojis[1] || emojis[0];

    const templates: Record<string, string[]> = {
      professional: [
        `Experience culinary excellence with our ${params.menuItemName || params.topic}. ${emoji1}`,
        `Crafted with precision and passion - our ${params.menuItemName || params.topic}. ${emoji1}`,
        `Elevate your dining experience. ${emoji1} ${params.menuItemDescription || ''}`,
      ],
      casual: [
        `Who else is craving ${params.menuItemName || params.topic}? ${emoji1}${emoji2}`,
        `That ${params.menuItemName || params.topic} hit different ${emoji1}`,
        `POV: You just ordered the best ${params.topic} in town ${emoji1}`,
      ],
      playful: [
        `You + ${params.menuItemName || params.topic} = ${emoji1}${emoji2}`,
        `Warning: This ${params.menuItemName || params.topic} may cause serious cravings ${emoji1}`,
        `Name a better duo than us and our ${params.topic}... we'll wait ${emoji1}`,
      ],
      informative: [
        `${emoji1} Our ${params.menuItemName || params.topic}: ${params.menuItemDescription || 'Made fresh daily'}`,
        `Everything you need to know about our ${params.topic} ${emoji1}`,
        `Fun fact: Our ${params.menuItemName || params.topic} ${emoji1}`,
      ],
    };

    const tone = params.tone || 'casual';
    const options = templates[tone];
    const caption = options[Math.floor(Math.random() * options.length)];

    // Add call to action if requested
    let finalCaption = caption;
    if (params.includeCallToAction) {
      const ctas = [
        '\n\nTag someone who needs to try this!',
        '\n\n🔗 Link in bio to order',
        '\n\nDrop a 🔥 if you want to try this!',
        '\n\nSave this for your next visit!',
      ];
      finalCaption += ctas[Math.floor(Math.random() * ctas.length)];
    }

    return finalCaption;
  }

  /**
   * Generate video script
   */
  public async generateScript(
    _tenantId: string,
    params: ScriptParams
  ): Promise<GeneratedScript> {
    // Calculate scene count based on duration
    const avgSceneDuration = 5; // seconds
    const sceneCount = Math.max(3, Math.ceil(params.duration / avgSceneDuration));

    const scenes = this.generateScriptScenes(params, sceneCount);

    const hooks: Record<string, string[]> = {
      tutorial: [
        'Want to know the secret to perfect [dish]?',
        'I\'m about to show you something incredible...',
        'You\'ve been making [dish] wrong your whole life.',
      ],
      behind_scenes: [
        'Ever wonder what happens in our kitchen?',
        'Take a peek behind the scenes...',
        'This is how the magic happens.',
      ],
      showcase: [
        'Meet our newest creation...',
        'This might be the best [dish] you\'ll ever see.',
        'Wait for the close-up...',
      ],
      story: [
        'Let me tell you a story...',
        'This dish has a special meaning to us.',
        'Here\'s why we created this...',
      ],
      trending: [
        'When you finally try that viral [dish]...',
        'POV: You\'re about to experience something amazing.',
        'Watch until the end...',
      ],
    };

    const ctas: Record<string, string[]> = {
      tutorial: [
        'Try this at home and tag us!',
        'Save this for later!',
        'Which tip was most helpful? Comment below!',
      ],
      behind_scenes: [
        'Want to see more? Follow us!',
        'Come visit and see it live!',
        'Book your table - link in bio!',
      ],
      showcase: [
        'Available now - link in bio to order!',
        'Tag someone who needs to try this!',
        'Come taste it yourself!',
      ],
      story: [
        'What\'s your food story? Share below!',
        'Follow for more stories!',
        'This is why we do what we do.',
      ],
      trending: [
        'Don\'t miss out - link in bio!',
        'Have you tried this yet?',
        'Drop a 🔥 if this made you hungry!',
      ],
    };

    const style = params.style;
    const hook = hooks[style][Math.floor(Math.random() * hooks[style].length)]
      .replace('[dish]', params.menuItemName || params.topic);
    const callToAction = params.callToAction ||
      ctas[style][Math.floor(Math.random() * ctas[style].length)];

    return {
      scenes,
      totalDuration: params.duration,
      hook,
      callToAction,
      suggestedMusic: this.suggestMusic(style),
      props: this.suggestProps(params),
    };
  }

  /**
   * Generate script scenes
   */
  private generateScriptScenes(params: ScriptParams, sceneCount: number): ScriptScene[] {
    const scenes: ScriptScene[] = [];
    const secondsPerScene = Math.floor(params.duration / sceneCount);

    // Scene templates by style
    const sceneTemplates: Record<string, Array<Partial<ScriptScene>>> = {
      tutorial: [
        { visualDescription: 'Close-up of ingredients laid out', textOverlay: 'What you\'ll need' },
        { visualDescription: 'Hands preparing ingredients', textOverlay: 'Step 1: Prep' },
        { visualDescription: 'Cooking action shot', textOverlay: 'The secret step' },
        { visualDescription: 'Plating the dish', textOverlay: 'Almost there...' },
        { visualDescription: 'Final reveal with steam/garnish', textOverlay: 'Perfect!' },
      ],
      behind_scenes: [
        { visualDescription: 'Wide shot of kitchen', textOverlay: 'Welcome to our kitchen' },
        { visualDescription: 'Chef at work', dialogue: 'This is where the magic happens' },
        { visualDescription: 'Cooking process', textOverlay: null },
        { visualDescription: 'Team collaboration', dialogue: 'Teamwork makes the dream work' },
        { visualDescription: 'Finished dish going out', textOverlay: 'Ready for you!' },
      ],
      showcase: [
        { visualDescription: 'Dramatic reveal shot', textOverlay: params.menuItemName || 'Introducing...' },
        { visualDescription: 'Rotating beauty shot', textOverlay: null },
        { visualDescription: 'Close-up texture/details', textOverlay: null },
        { visualDescription: 'Fork/bite shot', textOverlay: 'Taste test' },
        { visualDescription: 'Reaction shot or plate clearing', textOverlay: '10/10' },
      ],
      story: [
        { visualDescription: 'Old photo or memory', dialogue: 'It all started with...' },
        { visualDescription: 'Present day kitchen', dialogue: 'Now we continue the tradition' },
        { visualDescription: 'Cooking the dish', textOverlay: 'Made with love' },
        { visualDescription: 'Family/team moment', dialogue: null },
        { visualDescription: 'Customer enjoying dish', textOverlay: 'Sharing the love' },
      ],
      trending: [
        { visualDescription: 'Attention-grabbing hook shot', textOverlay: 'Wait for it...' },
        { visualDescription: 'Quick cuts of process', textOverlay: null },
        { visualDescription: 'Satisfying moment', textOverlay: '😍' },
        { visualDescription: 'Reaction or result', textOverlay: 'OMG' },
        { visualDescription: 'Call to action shot', textOverlay: 'Link in bio!' },
      ],
    };

    const templates = sceneTemplates[params.style] || sceneTemplates.showcase;
    const transitions = ['cut', 'dissolve', 'swipe', 'zoom', 'fade'];

    for (let i = 0; i < sceneCount; i++) {
      const templateIndex = Math.min(i, templates.length - 1);
      const template = templates[templateIndex];

      scenes.push({
        sceneNumber: i + 1,
        duration: secondsPerScene,
        visualDescription: template.visualDescription || `Scene ${i + 1}`,
        dialogue: template.dialogue || null,
        textOverlay: template.textOverlay !== undefined ? template.textOverlay : null,
        transition: i < sceneCount - 1 ? transitions[Math.floor(Math.random() * transitions.length)] : 'none',
      });
    }

    return scenes;
  }

  /**
   * Suggest music for video
   */
  private suggestMusic(style: string): string[] {
    const musicSuggestions: Record<string, string[]> = {
      tutorial: ['Upbeat acoustic', 'Chill electronic', 'Lo-fi beats'],
      behind_scenes: ['Indie rock', 'Documentary style', 'Ambient'],
      showcase: ['Dramatic orchestral', 'Trending sound', 'Luxury vibes'],
      story: ['Emotional piano', 'Acoustic guitar', 'Nostalgic'],
      trending: ['Current viral sound', 'Bass-heavy', 'Remix of popular song'],
    };
    return musicSuggestions[style] || ['Trending sound', 'Upbeat', 'Chill'];
  }

  /**
   * Suggest props for video
   */
  private suggestProps(params: ScriptParams): string[] {
    const baseProps = ['Good lighting', 'Clean background', 'Garnishes'];

    if (params.style === 'tutorial') {
      return [...baseProps, 'Measuring cups', 'Clear containers for ingredients', 'Cutting board'];
    }
    if (params.style === 'showcase') {
      return [...baseProps, 'Steam effect', 'Napkin/placement', 'Utensils', 'Drink pairing'];
    }
    return baseProps;
  }

  /**
   * Suggest hashtags for content
   */
  public async suggestHashtags(
    tenantId: string,
    topic: string,
    _platform: string
  ): Promise<HashtagSuggestion[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Get tenant's branded hashtag if exists
      const tenantResult = await client.query(
        `SELECT name, settings FROM tenants WHERE id = $1`,
        [tenantId]
      );
      const tenant = tenantResult.rows[0];
      const suggestions: HashtagSuggestion[] = [];

      // Add branded hashtag
      if (tenant?.name) {
        const brandedTag = '#' + tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        suggestions.push({
          hashtag: brandedTag,
          category: 'branded',
          popularity: 'low',
          relevance: 1.0,
        });
      }

      // Add industry hashtags
      for (const tag of HASHTAG_POOLS.industry.slice(0, 8)) {
        suggestions.push({
          hashtag: '#' + tag,
          category: 'industry',
          popularity: 'high',
          relevance: 0.8,
        });
      }

      // Add trending hashtags
      for (const tag of HASHTAG_POOLS.trending.slice(0, 5)) {
        suggestions.push({
          hashtag: '#' + tag,
          category: 'trending',
          popularity: 'high',
          relevance: 0.7,
        });
      }

      // Add niche hashtags based on topic
      const topicLower = topic.toLowerCase();
      for (const tag of HASHTAG_POOLS.niche) {
        if (topicLower.includes(tag) || tag.includes(topicLower.split(' ')[0])) {
          suggestions.push({
            hashtag: '#' + tag,
            category: 'niche',
            popularity: 'medium',
            relevance: 0.9,
          });
        }
      }

      // Add topic-based hashtag
      const topicTag = '#' + topic.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!suggestions.find((s) => s.hashtag === topicTag)) {
        suggestions.push({
          hashtag: topicTag,
          category: 'niche',
          popularity: 'medium',
          relevance: 1.0,
        });
      }

      // Sort by relevance
      return suggestions.sort((a, b) => b.relevance - a.relevance);
    });
  }

  /**
   * Get optimal posting times
   */
  public async getOptimalPostingTimes(
    tenantId: string,
    platform: string
  ): Promise<OptimalPostingTime[]> {
    return runInTenantContext(this.pool, tenantId, async (_client) => {
      // In production, this would analyze historical performance data
      // For now, return industry best practices

      const platformTimes: Record<string, OptimalPostingTime[]> = {
        tiktok: [
          { dayOfWeek: 2, hour: 9, score: 0.95, reason: 'Tuesday morning - high scroll time' },
          { dayOfWeek: 4, hour: 12, score: 0.92, reason: 'Thursday lunch break' },
          { dayOfWeek: 5, hour: 17, score: 0.90, reason: 'Friday evening - weekend planning' },
          { dayOfWeek: 6, hour: 11, score: 0.88, reason: 'Saturday brunch time' },
        ],
        instagram: [
          { dayOfWeek: 3, hour: 11, score: 0.93, reason: 'Wednesday mid-morning' },
          { dayOfWeek: 5, hour: 10, score: 0.91, reason: 'Friday morning engagement' },
          { dayOfWeek: 0, hour: 10, score: 0.89, reason: 'Sunday brunch inspiration' },
          { dayOfWeek: 1, hour: 14, score: 0.85, reason: 'Monday afternoon' },
        ],
        facebook: [
          { dayOfWeek: 3, hour: 13, score: 0.90, reason: 'Wednesday lunch time' },
          { dayOfWeek: 4, hour: 9, score: 0.88, reason: 'Thursday morning' },
          { dayOfWeek: 5, hour: 13, score: 0.86, reason: 'Friday lunch' },
        ],
      };

      return platformTimes[platform] || platformTimes.instagram;
    });
  }

  /**
   * Get content ideas
   */
  public async getIdeas(
    tenantId: string,
    status?: ContentIdea['status'],
    limit?: number
  ): Promise<ContentIdea[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let query = `
        SELECT id, tenant_id as "tenantId", source, title, description,
               content_type as "contentType", suggested_platforms as "suggestedPlatforms",
               trending_score as "trendingScore", reference_urls as "referenceUrls",
               ai_script as "aiScript", tags, status,
               used_in_content_id as "usedInContentId",
               created_at as "createdAt", expires_at as "expiresAt"
        FROM content_ideas
        WHERE tenant_id = $1
          AND (expires_at IS NULL OR expires_at > NOW())`;

      const params: unknown[] = [tenantId];

      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }

      query += ' ORDER BY trending_score DESC NULLS LAST, created_at DESC';

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const result = await client.query(query, params);
      return result.rows;
    });
  }

  /**
   * Update idea status
   */
  public async updateIdeaStatus(
    tenantId: string,
    ideaId: string,
    status: ContentIdea['status'],
    usedInContentId?: string
  ): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      await client.query(
        `UPDATE content_ideas
         SET status = $3, used_in_content_id = $4
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, ideaId, status, usedInContentId || null]
      );
    });
  }
}
