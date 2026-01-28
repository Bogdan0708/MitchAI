/**
 * Trending Service
 *
 * Discovers trending content, sounds, and hashtags across
 * social media platforms for content inspiration.
 */

import { Pool } from 'pg';
import { logger } from '../../logger.service';

// Types
export interface TrendingItem {
  id: string;
  platform: string;
  type: 'sound' | 'hashtag' | 'challenge' | 'template' | 'effect';
  name: string;
  description: string | null;
  usageCount: number | null;
  growthRate: number | null; // percentage growth
  exampleUrls: string[] | null;
  relevanceScore: number; // 0-1, how relevant to hospitality
  isHospitalityRelevant: boolean;
  discoveredAt: Date;
  expiresAt: Date | null;
}

export interface TrendingSound {
  id: string;
  platform: 'tiktok' | 'instagram';
  soundId: string;
  soundName: string;
  artistName: string | null;
  duration: number | null;
  usageCount: number | null;
  isOriginal: boolean;
  previewUrl: string | null;
  relevanceScore: number;
}

export interface TrendingHashtag {
  hashtag: string;
  platform: string;
  postCount: number;
  viewCount: number | null;
  growthRate: number;
  relatedHashtags: string[];
  isHospitalityRelevant: boolean;
}

export interface TrendingChallenge {
  id: string;
  name: string;
  platform: string;
  description: string;
  participantCount: number;
  exampleUrls: string[];
  suggestedAdaptation: string; // How to adapt for hospitality
  difficulty: 'easy' | 'medium' | 'hard';
  requiredProps: string[];
}

export interface TrendFilters {
  platform?: string;
  type?: TrendingItem['type'];
  hospitalityOnly?: boolean;
  minRelevance?: number;
  limit?: number;
}

// Hospitality-relevant keywords for filtering
const HOSPITALITY_KEYWORDS = [
  'food', 'restaurant', 'cooking', 'chef', 'recipe', 'kitchen',
  'meal', 'dinner', 'lunch', 'breakfast', 'brunch', 'drink',
  'cocktail', 'coffee', 'dessert', 'baking', 'foodie', 'eating',
  'taste', 'delicious', 'yummy', 'asmr', 'satisfying', 'mukbang',
];

// Simulated trending data (would come from platform APIs in production)
const SIMULATED_TRENDS: Record<string, TrendingItem[]> = {
  tiktok: [
    {
      id: 'tt_sound_1',
      platform: 'tiktok',
      type: 'sound',
      name: 'Original Sound - Cooking ASMR',
      description: 'Satisfying cooking sounds compilation',
      usageCount: 2500000,
      growthRate: 45,
      exampleUrls: ['https://tiktok.com/@example/video/1'],
      relevanceScore: 0.95,
      isHospitalityRelevant: true,
      discoveredAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'tt_challenge_1',
      platform: 'tiktok',
      type: 'challenge',
      name: 'Rate My Plate',
      description: 'Show off your best dish and ask viewers to rate it',
      usageCount: 1800000,
      growthRate: 62,
      exampleUrls: ['https://tiktok.com/@example/video/2'],
      relevanceScore: 0.92,
      isHospitalityRelevant: true,
      discoveredAt: new Date(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'tt_template_1',
      platform: 'tiktok',
      type: 'template',
      name: 'POV: You Work Here',
      description: 'First-person perspective of a workday',
      usageCount: 5000000,
      growthRate: 28,
      exampleUrls: ['https://tiktok.com/@example/video/3'],
      relevanceScore: 0.75,
      isHospitalityRelevant: true,
      discoveredAt: new Date(),
      expiresAt: null,
    },
    {
      id: 'tt_effect_1',
      platform: 'tiktok',
      type: 'effect',
      name: 'Food Close-Up Zoom',
      description: 'Dramatic zoom effect perfect for food reveals',
      usageCount: 890000,
      growthRate: 55,
      exampleUrls: ['https://tiktok.com/@example/video/4'],
      relevanceScore: 0.88,
      isHospitalityRelevant: true,
      discoveredAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    },
  ],
  instagram: [
    {
      id: 'ig_hashtag_1',
      platform: 'instagram',
      type: 'hashtag',
      name: '#foodporn',
      description: 'Beautiful food photography',
      usageCount: 280000000,
      growthRate: 5,
      exampleUrls: null,
      relevanceScore: 0.98,
      isHospitalityRelevant: true,
      discoveredAt: new Date(),
      expiresAt: null,
    },
    {
      id: 'ig_template_1',
      platform: 'instagram',
      type: 'template',
      name: 'Recipe Carousel',
      description: 'Step-by-step recipe in carousel format',
      usageCount: 1200000,
      growthRate: 18,
      exampleUrls: ['https://instagram.com/p/example'],
      relevanceScore: 0.90,
      isHospitalityRelevant: true,
      discoveredAt: new Date(),
      expiresAt: null,
    },
  ],
};

export class TrendingService {
  // Pool stored for future DB queries when platform APIs are integrated
  constructor(private pool: Pool) {}

  /**
   * Get trending items
   */
  public async getTrending(
    tenantId: string,
    filters: TrendFilters = {}
  ): Promise<TrendingItem[]> {
    // In production, this would fetch from platform APIs and/or a cache
    let trends: TrendingItem[] = [];

    // Collect trends from requested platforms
    if (filters.platform) {
      trends = SIMULATED_TRENDS[filters.platform] || [];
    } else {
      trends = Object.values(SIMULATED_TRENDS).flat();
    }

    // Apply filters
    if (filters.type) {
      trends = trends.filter((t) => t.type === filters.type);
    }

    if (filters.hospitalityOnly) {
      trends = trends.filter((t) => t.isHospitalityRelevant);
    }

    if (filters.minRelevance !== undefined) {
      trends = trends.filter((t) => t.relevanceScore >= filters.minRelevance!);
    }

    // Sort by relevance and growth rate
    trends.sort((a, b) => {
      const scoreA = (a.relevanceScore * 0.6) + ((a.growthRate || 0) / 100 * 0.4);
      const scoreB = (b.relevanceScore * 0.6) + ((b.growthRate || 0) / 100 * 0.4);
      return scoreB - scoreA;
    });

    // Apply limit
    if (filters.limit) {
      trends = trends.slice(0, filters.limit);
    }

    logger.info('Trending items fetched', {
      tenantId,
      filters,
      count: trends.length,
    });

    return trends;
  }

  /**
   * Get trending sounds
   */
  public async getTrendingSounds(
    _tenantId: string,
    platform?: 'tiktok' | 'instagram'
  ): Promise<TrendingSound[]> {

    // Simulated trending sounds (would come from platform APIs)
    const simulatedSounds: TrendingSound[] = [
      {
        id: 'sound_1',
        platform: 'tiktok',
        soundId: 'tiktok_sound_12345',
        soundName: 'Cooking ASMR Compilation',
        artistName: 'SoundEffects',
        duration: 30,
        usageCount: 2500000,
        isOriginal: true,
        previewUrl: null,
        relevanceScore: 0.95,
      },
      {
        id: 'sound_2',
        platform: 'tiktok',
        soundId: 'tiktok_sound_67890',
        soundName: 'Upbeat Kitchen Vibes',
        artistName: 'ChefBeats',
        duration: 15,
        usageCount: 1800000,
        isOriginal: false,
        previewUrl: null,
        relevanceScore: 0.88,
      },
      {
        id: 'sound_3',
        platform: 'instagram',
        soundId: 'ig_sound_11111',
        soundName: 'Restaurant Ambiance',
        artistName: null,
        duration: 60,
        usageCount: 500000,
        isOriginal: true,
        previewUrl: null,
        relevanceScore: 0.82,
      },
    ];

    if (platform) {
      return simulatedSounds.filter((s) => s.platform === platform);
    }

    return simulatedSounds;
  }

  /**
   * Get trending hashtags
   */
  public async getTrendingHashtags(
    _tenantId: string,
    platform?: string,
    hospitalityOnly: boolean = true
  ): Promise<TrendingHashtag[]> {
    const hashtags: TrendingHashtag[] = [
      {
        hashtag: '#foodie',
        platform: 'all',
        postCount: 250000000,
        viewCount: null,
        growthRate: 8,
        relatedHashtags: ['#food', '#foodporn', '#instafood'],
        isHospitalityRelevant: true,
      },
      {
        hashtag: '#restaurantlife',
        platform: 'all',
        postCount: 15000000,
        viewCount: null,
        growthRate: 12,
        relatedHashtags: ['#chef', '#kitchen', '#hospitality'],
        isHospitalityRelevant: true,
      },
      {
        hashtag: '#cheftok',
        platform: 'tiktok',
        postCount: 8000000,
        viewCount: 45000000000,
        growthRate: 35,
        relatedHashtags: ['#cooking', '#recipe', '#foodtiktok'],
        isHospitalityRelevant: true,
      },
      {
        hashtag: '#fyp',
        platform: 'tiktok',
        postCount: 1000000000,
        viewCount: null,
        growthRate: 5,
        relatedHashtags: ['#foryou', '#foryoupage', '#viral'],
        isHospitalityRelevant: false,
      },
      {
        hashtag: '#brunch',
        platform: 'instagram',
        postCount: 48000000,
        viewCount: null,
        growthRate: 15,
        relatedHashtags: ['#brunchtime', '#weekendbrunch', '#brunchgoals'],
        isHospitalityRelevant: true,
      },
    ];

    let filtered = hashtags;

    if (platform && platform !== 'all') {
      filtered = filtered.filter((h) => h.platform === platform || h.platform === 'all');
    }

    if (hospitalityOnly) {
      filtered = filtered.filter((h) => h.isHospitalityRelevant);
    }

    // Sort by growth rate
    filtered.sort((a, b) => b.growthRate - a.growthRate);

    return filtered;
  }

  /**
   * Get trending challenges
   */
  public async getTrendingChallenges(
    _tenantId: string,
    platform?: string
  ): Promise<TrendingChallenge[]> {
    const challenges: TrendingChallenge[] = [
      {
        id: 'challenge_1',
        name: 'Rate My Plate',
        platform: 'tiktok',
        description: 'Show your signature dish and ask viewers to rate it 1-10',
        participantCount: 1800000,
        exampleUrls: ['https://tiktok.com/@example/video/1'],
        suggestedAdaptation: 'Feature your best-selling dish with a dramatic reveal',
        difficulty: 'easy',
        requiredProps: ['Signature dish', 'Good lighting'],
      },
      {
        id: 'challenge_2',
        name: 'Kitchen Fails',
        platform: 'tiktok',
        description: 'Share funny kitchen fails that turned out okay',
        participantCount: 3200000,
        exampleUrls: ['https://tiktok.com/@example/video/2'],
        suggestedAdaptation: 'Show a saved dish or funny behind-the-scenes moment',
        difficulty: 'easy',
        requiredProps: ['Behind-the-scenes footage'],
      },
      {
        id: 'challenge_3',
        name: 'Secret Menu Reveal',
        platform: 'tiktok',
        description: 'Reveal hidden or off-menu items',
        participantCount: 950000,
        exampleUrls: ['https://tiktok.com/@example/video/3'],
        suggestedAdaptation: 'Create a special off-menu item or reveal staff favorites',
        difficulty: 'medium',
        requiredProps: ['Special dish', 'Menu board (optional)'],
      },
      {
        id: 'challenge_4',
        name: 'Ingredient Roulette',
        platform: 'instagram',
        description: 'Pick random ingredients and create a dish',
        participantCount: 450000,
        exampleUrls: ['https://instagram.com/reel/example'],
        suggestedAdaptation: 'Let followers suggest ingredients for a special',
        difficulty: 'hard',
        requiredProps: ['Various ingredients', 'Cooking equipment'],
      },
    ];

    if (platform) {
      return challenges.filter((c) => c.platform === platform);
    }

    return challenges;
  }

  /**
   * Check if content is relevant to hospitality
   */
  public isHospitalityRelevant(text: string): boolean {
    const lowerText = text.toLowerCase();
    return HOSPITALITY_KEYWORDS.some((keyword) => lowerText.includes(keyword));
  }

  /**
   * Get content ideas based on trends
   */
  public async getTrendBasedIdeas(
    tenantId: string,
    platform: string,
    count: number = 5
  ): Promise<Array<{
    trendId: string;
    trendName: string;
    ideaTitle: string;
    ideaDescription: string;
    difficulty: 'easy' | 'medium' | 'hard';
    estimatedTime: string;
  }>> {
    const trends = await this.getTrending(tenantId, {
      platform,
      hospitalityOnly: true,
      limit: count,
    });

    return trends.map((trend) => ({
      trendId: trend.id,
      trendName: trend.name,
      ideaTitle: this.generateIdeaTitleFromTrend(trend),
      ideaDescription: this.generateIdeaDescriptionFromTrend(trend),
      difficulty: this.estimateDifficulty(trend),
      estimatedTime: this.estimateTime(trend),
    }));
  }

  private generateIdeaTitleFromTrend(trend: TrendingItem): string {
    switch (trend.type) {
      case 'sound':
        return `${trend.name} - Food Edition`;
      case 'challenge':
        return `Join the ${trend.name} Challenge`;
      case 'template':
        return `Our Take on "${trend.name}"`;
      case 'effect':
        return `Showcase with ${trend.name}`;
      default:
        return `Trending: ${trend.name}`;
    }
  }

  private generateIdeaDescriptionFromTrend(trend: TrendingItem): string {
    const baseDesc = trend.description || trend.name;

    switch (trend.type) {
      case 'sound':
        return `Create a cooking/food video using the trending sound "${trend.name}". Focus on satisfying visuals that match the audio.`;
      case 'challenge':
        return `Participate in the ${trend.name} challenge by adapting it to showcase your restaurant's personality and dishes.`;
      case 'template':
        return `Use the "${trend.name}" template format to create engaging content about your restaurant experience.`;
      case 'effect':
        return `Apply the ${trend.name} effect to create eye-catching food content that stands out on the platform.`;
      default:
        return baseDesc;
    }
  }

  private estimateDifficulty(trend: TrendingItem): 'easy' | 'medium' | 'hard' {
    switch (trend.type) {
      case 'hashtag':
        return 'easy';
      case 'sound':
        return 'easy';
      case 'template':
        return 'medium';
      case 'effect':
        return 'medium';
      case 'challenge':
        return 'medium';
      default:
        return 'medium';
    }
  }

  private estimateTime(trend: TrendingItem): string {
    switch (trend.type) {
      case 'hashtag':
        return '5-10 minutes';
      case 'sound':
        return '15-30 minutes';
      case 'template':
        return '30-60 minutes';
      case 'effect':
        return '20-40 minutes';
      case 'challenge':
        return '30-60 minutes';
      default:
        return '30 minutes';
    }
  }

  /**
   * Sync trending data from platforms
   * Called periodically by scheduled job
   */
  public async syncTrendingData(): Promise<void> {
    // In production, this would:
    // 1. Call TikTok Creative Center API for trending sounds/effects
    // 2. Call Instagram/Facebook Graph API for trending hashtags
    // 3. Scrape or use third-party services for challenge data
    // 4. Store results in database with expiration

    logger.info('Trending data sync would happen here');
  }
}
