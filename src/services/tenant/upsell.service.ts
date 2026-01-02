/**
 * UPSELL SERVICE
 *
 * Smart recommendation engine for upselling:
 * - Purchase history analysis
 * - Time-based suggestions (breakfast/lunch/dinner)
 * - Weather-based recommendations
 * - Complementary item suggestions
 * - Popular items by location
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { AIRouter, AIMessage } from './ai';

export interface RecommendationContext {
  tenantId: string;
  locationId?: string;
  customerId?: string;
  currentOrderItems?: string[]; // Menu item IDs in current order
  timeOfDay?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'default';
  weather?: {
    condition: 'hot' | 'cold' | 'rainy' | 'normal';
    temperature?: number;
  };
}

export interface Recommendation {
  menuItemId: string;
  menuItemName: string;
  price: number;
  reason: string;
  confidence: number; // 0-1
  category: string;
  imageUrl?: string;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  context: {
    timeOfDay: string;
    customerSegment?: string;
    weatherAdjusted: boolean;
  };
}

export class UpsellService {
  private pool: Pool;
  private redis: Redis;
  private aiRouter: AIRouter;
  private cacheTTL = 300; // 5 minutes

  constructor(pool: Pool, redis: Redis, aiRouter: AIRouter) {
    this.pool = pool;
    this.redis = redis;
    this.aiRouter = aiRouter;
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(
    context: RecommendationContext,
    limit: number = 5,
    includeReasons: boolean = true
  ): Promise<RecommendationResult> {
    const timeOfDay = context.timeOfDay || this.determineTimeOfDay();
    const recommendations: Recommendation[] = [];

    // 1. Get popular items for this time slot
    const popularItems = await this.getPopularItemsByTime(
      context.tenantId,
      context.locationId,
      timeOfDay
    );

    // 2. If customer ID provided, get personalized suggestions
    let customerPreferences: string[] = [];
    if (context.customerId) {
      customerPreferences = await this.getCustomerPreferences(
        context.tenantId,
        context.customerId
      );
    }

    // 3. Get complementary items if current order exists
    let complementaryItems: Recommendation[] = [];
    if (context.currentOrderItems?.length) {
      complementaryItems = await this.getComplementaryItems(
        context.tenantId,
        context.currentOrderItems
      );
    }

    // 4. Combine and score recommendations
    const combinedItems = this.combineAndScore(
      popularItems,
      complementaryItems,
      customerPreferences,
      timeOfDay,
      context.weather
    );

    // 5. If includeReasons, generate AI explanations
    if (includeReasons && combinedItems.length > 0) {
      const itemsWithReasons = await this.generateReasons(
        context.tenantId,
        combinedItems.slice(0, limit),
        timeOfDay,
        context.customerId ? 'returning' : 'new'
      );
      recommendations.push(...itemsWithReasons);
    } else {
      recommendations.push(...combinedItems.slice(0, limit));
    }

    return {
      recommendations,
      context: {
        timeOfDay,
        customerSegment: context.customerId ? 'returning' : 'new',
        weatherAdjusted: !!context.weather
      }
    };
  }

  /**
   * Get popular items by time of day
   */
  private async getPopularItemsByTime(
    tenantId: string,
    locationId: string | undefined,
    timeOfDay: string
  ): Promise<Recommendation[]> {
    // Check cache first
    const cacheKey = `upsell:popular:${tenantId}:${locationId || 'all'}:${timeOfDay}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Time ranges for each period
    const timeRanges: Record<string, { start: number; end: number }> = {
      breakfast: { start: 6, end: 11 },
      lunch: { start: 11, end: 15 },
      dinner: { start: 17, end: 22 },
      snack: { start: 15, end: 17 },
      default: { start: 0, end: 24 }
    };

    const range = timeRanges[timeOfDay] || timeRanges.default;

    const query = `
      SELECT
        mi.id as menu_item_id,
        mi.name as menu_item_name,
        mi.price,
        mc.name as category,
        mi.image_url,
        COUNT(oi.id) as order_count
      FROM menu_items mi
      LEFT JOIN order_items oi ON oi.menu_item_id = mi.id
      LEFT JOIN orders o ON oi.order_id = o.id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.tenant_id = $1
        AND mi.is_available = true
        ${locationId ? 'AND mi.location_id = $2' : ''}
        AND (o.id IS NULL OR (
          EXTRACT(HOUR FROM o.created_at) >= $${locationId ? 3 : 2}
          AND EXTRACT(HOUR FROM o.created_at) < $${locationId ? 4 : 3}
        ))
      GROUP BY mi.id, mi.name, mi.price, mc.name, mi.image_url
      ORDER BY order_count DESC
      LIMIT 20
    `;

    const params = locationId
      ? [tenantId, locationId, range.start, range.end]
      : [tenantId, range.start, range.end];

    const result = await this.pool.query(query, params);

    const recommendations: Recommendation[] = result.rows.map((row, index) => ({
      menuItemId: row.menu_item_id,
      menuItemName: row.menu_item_name,
      price: parseFloat(row.price),
      category: row.category || 'Uncategorized',
      imageUrl: row.image_url,
      reason: '',
      confidence: Math.max(0.5, 1 - index * 0.05) // Decreasing confidence by rank
    }));

    // Cache results
    await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(recommendations));

    return recommendations;
  }

  /**
   * Get customer's preferences based on order history
   */
  private async getCustomerPreferences(
    tenantId: string,
    customerId: string
  ): Promise<string[]> {
    const query = `
      SELECT DISTINCT mc.name as category
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE o.tenant_id = $1 AND o.customer_id = $2
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `;

    const result = await this.pool.query(query, [tenantId, customerId]);
    return result.rows.map(row => row.category).filter(Boolean);
  }

  /**
   * Get complementary items based on current order
   */
  private async getComplementaryItems(
    tenantId: string,
    currentItemIds: string[]
  ): Promise<Recommendation[]> {
    if (!currentItemIds.length) return [];

    // Find items frequently ordered together
    const query = `
      WITH current_order_categories AS (
        SELECT DISTINCT mc.id as category_id, mc.name as category_name
        FROM menu_items mi
        JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE mi.id = ANY($2)
      )
      SELECT DISTINCT
        mi.id as menu_item_id,
        mi.name as menu_item_name,
        mi.price,
        mc.name as category,
        mi.image_url,
        COUNT(oi2.id) as coorder_count
      FROM menu_items mi
      JOIN menu_categories mc ON mi.category_id = mc.id
      JOIN order_items oi ON oi.menu_item_id = mi.id
      JOIN orders o ON oi.order_id = o.id
      JOIN order_items oi2 ON oi2.order_id = o.id AND oi2.menu_item_id = ANY($2)
      WHERE mi.tenant_id = $1
        AND mi.is_available = true
        AND mi.id != ALL($2)
        AND mc.id NOT IN (SELECT category_id FROM current_order_categories)
      GROUP BY mi.id, mi.name, mi.price, mc.name, mi.image_url
      ORDER BY coorder_count DESC
      LIMIT 10
    `;

    const result = await this.pool.query(query, [tenantId, currentItemIds]);

    return result.rows.map((row, index) => ({
      menuItemId: row.menu_item_id,
      menuItemName: row.menu_item_name,
      price: parseFloat(row.price),
      category: row.category,
      imageUrl: row.image_url,
      reason: 'Frequently ordered together',
      confidence: Math.max(0.6, 0.9 - index * 0.05)
    }));
  }

  /**
   * Combine and score recommendations from different sources
   */
  private combineAndScore(
    popularItems: Recommendation[],
    complementaryItems: Recommendation[],
    customerPreferences: string[],
    _timeOfDay: string,
    weather?: { condition: string; temperature?: number }
  ): Recommendation[] {
    const scoreMap = new Map<string, Recommendation>();

    // Add popular items with base score
    for (const item of popularItems) {
      const score = item.confidence;
      scoreMap.set(item.menuItemId, { ...item, confidence: score });
    }

    // Boost complementary items
    for (const item of complementaryItems) {
      const existing = scoreMap.get(item.menuItemId);
      if (existing) {
        existing.confidence = Math.min(1, existing.confidence + 0.2);
        existing.reason = item.reason || existing.reason;
      } else {
        scoreMap.set(item.menuItemId, item);
      }
    }

    // Boost items matching customer preferences
    for (const [, item] of scoreMap) {
      if (customerPreferences.includes(item.category)) {
        item.confidence = Math.min(1, item.confidence + 0.15);
      }
    }

    // Weather adjustments
    if (weather) {
      for (const [, item] of scoreMap) {
        const category = item.category.toLowerCase();
        if (weather.condition === 'hot' && (category.includes('cold') || category.includes('drink') || category.includes('ice'))) {
          item.confidence = Math.min(1, item.confidence + 0.1);
        }
        if (weather.condition === 'cold' && (category.includes('soup') || category.includes('hot') || category.includes('warm'))) {
          item.confidence = Math.min(1, item.confidence + 0.1);
        }
      }
    }

    // Sort by confidence and return
    return Array.from(scoreMap.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate AI-powered reasons for recommendations
   */
  private async generateReasons(
    tenantId: string,
    items: Recommendation[],
    timeOfDay: string,
    customerType: string
  ): Promise<Recommendation[]> {
    if (!items.length) return items;

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a helpful restaurant recommendation assistant. Generate short, compelling reasons (max 15 words each) for menu recommendations. Be conversational and appetizing.`
      },
      {
        role: 'user',
        content: `Generate recommendation reasons for these items during ${timeOfDay} for a ${customerType} customer:

${items.map((item, i) => `${i + 1}. ${item.menuItemName} (${item.category}) - $${item.price}`).join('\n')}

Return JSON array: [{"index": 1, "reason": "..."}]`
      }
    ];

    try {
      const response = await this.aiRouter.complete({
        messages,
        tenantId,
        requestType: 'upsell',
        maxTokens: 300,
        temperature: 0.7
      });

      // Parse AI response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const reasons = JSON.parse(jsonMatch[0]) as { index: number; reason: string }[];
        for (const r of reasons) {
          if (r.index > 0 && r.index <= items.length) {
            items[r.index - 1].reason = r.reason;
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate AI reasons:', error);
      // Fall back to generic reasons
      for (const item of items) {
        if (!item.reason) {
          item.reason = `Popular ${timeOfDay} choice`;
        }
      }
    }

    return items;
  }

  /**
   * Determine current time of day
   */
  private determineTimeOfDay(): 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'default' {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 17) return 'snack';
    if (hour >= 17 && hour < 22) return 'dinner';
    return 'default';
  }

  /**
   * Get weather-based recommendation boost categories
   */
  async getWeatherAdjustments(
    _lat: number,
    _lon: number
  ): Promise<{ condition: 'hot' | 'cold' | 'rainy' | 'normal'; temperature: number } | null> {
    // Note: In production, integrate with a weather API like OpenWeatherMap
    // For now, return null (no weather data)
    return null;
  }
}
