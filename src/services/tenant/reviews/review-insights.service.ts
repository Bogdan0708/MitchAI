/**
 * Review Insights Service
 *
 * Provides analytics, reporting, and AI-generated insights
 * for review data across all platforms.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';

// Types
export interface ReviewInsights {
  id: string;
  tenantId: string;
  locationId: string | null;
  periodStart: Date;
  periodEnd: Date;
  periodType: 'daily' | 'weekly' | 'monthly';
  totalReviews: number;
  averageRating: number | null;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  ratingDistribution: Record<string, number>;
  platformBreakdown: Record<string, number>;
  topPositiveTopics: TopicInsight[];
  topNegativeTopics: TopicInsight[];
  responseRate: number;
  avgResponseTimeHours: number | null;
  aiSummary: string | null;
  recommendations: Recommendation[];
  createdAt: Date;
}

export interface TopicInsight {
  topic: string;
  count: number;
  avgSentiment: number;
  percentageOfReviews: number;
  trend: 'up' | 'down' | 'stable';
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  action: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
}

export interface DashboardStats {
  totalReviews: number;
  averageRating: number;
  ratingTrend: number; // Change from previous period
  responseRate: number;
  responseRateTrend: number;
  unreviewedCount: number;
  negativeReviewsToday: number;
  topPlatform: string;
  sentimentScore: number;
  sentimentTrend: number;
}

export interface LocationComparison {
  locationId: string;
  locationName: string;
  totalReviews: number;
  averageRating: number;
  sentimentScore: number;
  responseRate: number;
  topIssue: string | null;
  rank: number;
}

export interface PlatformStats {
  platform: string;
  totalReviews: number;
  averageRating: number;
  responseRate: number;
  lastSyncAt: Date | null;
  syncStatus: string;
}

export class ReviewInsightsService {
  constructor(private pool: Pool) {}

  /**
   * Get dashboard statistics
   */
  public async getDashboardStats(
    tenantId: string,
    locationId?: string,
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<DashboardStats> {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const locationFilter = locationId ? 'AND location_id = $2' : '';
      const params = locationId ? [tenantId, locationId] : [tenantId];

      // Current period stats
      const currentResult = await client.query(
        `SELECT
           COUNT(*) as total_reviews,
           AVG(rating) as avg_rating,
           AVG(sentiment_score) as avg_sentiment,
           COUNT(*) FILTER (WHERE is_responded = true) as responded_count,
           COUNT(*) FILTER (WHERE status = 'new') as unreviewed_count,
           COUNT(*) FILTER (WHERE sentiment_label = 'negative' AND review_date::date = CURRENT_DATE) as negative_today,
           MODE() WITHIN GROUP (ORDER BY platform) as top_platform
         FROM aggregated_reviews
         WHERE tenant_id = $1 ${locationFilter}
           AND review_date >= NOW() - INTERVAL '${periodDays} days'`,
        params
      );

      // Previous period stats for trends
      const previousResult = await client.query(
        `SELECT
           AVG(rating) as avg_rating,
           AVG(sentiment_score) as avg_sentiment,
           COUNT(*) FILTER (WHERE is_responded = true)::float / NULLIF(COUNT(*), 0) as response_rate
         FROM aggregated_reviews
         WHERE tenant_id = $1 ${locationFilter}
           AND review_date >= NOW() - INTERVAL '${periodDays * 2} days'
           AND review_date < NOW() - INTERVAL '${periodDays} days'`,
        params
      );

      const current = currentResult.rows[0];
      const previous = previousResult.rows[0];

      const totalReviews = parseInt(current.total_reviews, 10);
      const respondedCount = parseInt(current.responded_count, 10);
      const responseRate = totalReviews > 0 ? (respondedCount / totalReviews) * 100 : 0;

      const currentRating = parseFloat(current.avg_rating) || 0;
      const previousRating = parseFloat(previous.avg_rating) || currentRating;
      const ratingTrend = currentRating - previousRating;

      const currentSentiment = parseFloat(current.avg_sentiment) || 0;
      const previousSentiment = parseFloat(previous.avg_sentiment) || currentSentiment;
      const sentimentTrend = currentSentiment - previousSentiment;

      const previousResponseRate = (parseFloat(previous.response_rate) || 0) * 100;
      const responseRateTrend = responseRate - previousResponseRate;

      return {
        totalReviews,
        averageRating: currentRating,
        ratingTrend,
        responseRate,
        responseRateTrend,
        unreviewedCount: parseInt(current.unreviewed_count, 10),
        negativeReviewsToday: parseInt(current.negative_today, 10),
        topPlatform: current.top_platform || 'none',
        sentimentScore: currentSentiment,
        sentimentTrend,
      };
    });
  }

  /**
   * Get or generate period insights
   */
  public async getPeriodInsights(
    tenantId: string,
    periodType: 'daily' | 'weekly' | 'monthly',
    periodStart: Date,
    periodEnd: Date,
    locationId?: string
  ): Promise<ReviewInsights | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Check for cached insights
      const cached = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                period_start as "periodStart", period_end as "periodEnd",
                period_type as "periodType", total_reviews as "totalReviews",
                average_rating as "averageRating", sentiment_breakdown as "sentimentBreakdown",
                rating_distribution as "ratingDistribution", platform_breakdown as "platformBreakdown",
                top_positive_topics as "topPositiveTopics", top_negative_topics as "topNegativeTopics",
                response_rate as "responseRate", avg_response_time_hours as "avgResponseTimeHours",
                ai_summary as "aiSummary", recommendations, created_at as "createdAt"
         FROM review_insights
         WHERE tenant_id = $1 AND period_type = $2
           AND period_start = $3 AND period_end = $4
           ${locationId ? 'AND location_id = $5' : 'AND location_id IS NULL'}`,
        locationId
          ? [tenantId, periodType, periodStart, periodEnd, locationId]
          : [tenantId, periodType, periodStart, periodEnd]
      );

      if (cached.rows[0]) {
        return cached.rows[0];
      }

      // Generate new insights
      return this.generatePeriodInsights(tenantId, periodType, periodStart, periodEnd, locationId);
    });
  }

  /**
   * Generate period insights
   */
  public async generatePeriodInsights(
    tenantId: string,
    periodType: 'daily' | 'weekly' | 'monthly',
    periodStart: Date,
    periodEnd: Date,
    locationId?: string
  ): Promise<ReviewInsights> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const locationFilter = locationId ? 'AND location_id = $4' : '';
      const baseParams = [tenantId, periodStart, periodEnd];
      const params = locationId ? [...baseParams, locationId] : baseParams;

      // Basic stats
      const statsResult = await client.query(
        `SELECT
           COUNT(*) as total_reviews,
           AVG(rating) as avg_rating,
           COUNT(*) FILTER (WHERE sentiment_label = 'positive') as positive_count,
           COUNT(*) FILTER (WHERE sentiment_label = 'neutral') as neutral_count,
           COUNT(*) FILTER (WHERE sentiment_label = 'negative') as negative_count,
           COUNT(*) FILTER (WHERE sentiment_label = 'mixed') as mixed_count,
           COUNT(*) FILTER (WHERE is_responded = true)::float / NULLIF(COUNT(*), 0) * 100 as response_rate,
           AVG(EXTRACT(EPOCH FROM (response_date - review_date)) / 3600)
             FILTER (WHERE response_date IS NOT NULL) as avg_response_hours
         FROM aggregated_reviews
         WHERE tenant_id = $1 AND review_date BETWEEN $2 AND $3 ${locationFilter}`,
        params
      );

      // Rating distribution
      const ratingResult = await client.query(
        `SELECT rating::text, COUNT(*) as count
         FROM aggregated_reviews
         WHERE tenant_id = $1 AND review_date BETWEEN $2 AND $3 ${locationFilter}
           AND rating IS NOT NULL
         GROUP BY rating
         ORDER BY rating`,
        params
      );

      // Platform breakdown
      const platformResult = await client.query(
        `SELECT platform, COUNT(*) as count
         FROM aggregated_reviews
         WHERE tenant_id = $1 AND review_date BETWEEN $2 AND $3 ${locationFilter}
         GROUP BY platform
         ORDER BY count DESC`,
        params
      );

      // Top positive topics
      const positiveTopicsResult = await client.query(
        `SELECT topic, COUNT(*) as count, AVG(r.sentiment_score) as avg_sentiment
         FROM aggregated_reviews r,
              LATERAL jsonb_array_elements_text(r.topics) as topic
         WHERE r.tenant_id = $1 AND r.review_date BETWEEN $2 AND $3 ${locationFilter}
           AND r.sentiment_score > 0.3
           AND r.topics IS NOT NULL
         GROUP BY topic
         ORDER BY count DESC
         LIMIT 5`,
        params
      );

      // Top negative topics
      const negativeTopicsResult = await client.query(
        `SELECT topic, COUNT(*) as count, AVG(r.sentiment_score) as avg_sentiment
         FROM aggregated_reviews r,
              LATERAL jsonb_array_elements_text(r.topics) as topic
         WHERE r.tenant_id = $1 AND r.review_date BETWEEN $2 AND $3 ${locationFilter}
           AND r.sentiment_score < -0.3
           AND r.topics IS NOT NULL
         GROUP BY topic
         ORDER BY count DESC
         LIMIT 5`,
        params
      );

      const stats = statsResult.rows[0];
      const totalReviews = parseInt(stats.total_reviews, 10);

      const sentimentBreakdown = {
        positive: parseInt(stats.positive_count, 10),
        neutral: parseInt(stats.neutral_count, 10),
        negative: parseInt(stats.negative_count, 10),
        mixed: parseInt(stats.mixed_count, 10),
      };

      const ratingDistribution: Record<string, number> = {};
      for (const row of ratingResult.rows) {
        ratingDistribution[row.rating] = parseInt(row.count, 10);
      }

      const platformBreakdown: Record<string, number> = {};
      for (const row of platformResult.rows) {
        platformBreakdown[row.platform] = parseInt(row.count, 10);
      }

      const topPositiveTopics: TopicInsight[] = positiveTopicsResult.rows.map((row) => ({
        topic: row.topic,
        count: parseInt(row.count, 10),
        avgSentiment: parseFloat(row.avg_sentiment) || 0,
        percentageOfReviews: totalReviews > 0 ? (parseInt(row.count, 10) / totalReviews) * 100 : 0,
        trend: 'stable' as const, // Would calculate from historical data
      }));

      const topNegativeTopics: TopicInsight[] = negativeTopicsResult.rows.map((row) => ({
        topic: row.topic,
        count: parseInt(row.count, 10),
        avgSentiment: parseFloat(row.avg_sentiment) || 0,
        percentageOfReviews: totalReviews > 0 ? (parseInt(row.count, 10) / totalReviews) * 100 : 0,
        trend: 'stable' as const,
      }));

      // Generate recommendations based on data
      const recommendations = this.generateRecommendations(
        sentimentBreakdown,
        topNegativeTopics,
        parseFloat(stats.response_rate) || 0
      );

      // Generate AI summary (placeholder - would use AI in production)
      const aiSummary = this.generateSummary(
        totalReviews,
        parseFloat(stats.avg_rating) || 0,
        sentimentBreakdown,
        topPositiveTopics,
        topNegativeTopics
      );

      // Store insights
      const insertResult = await client.query(
        `INSERT INTO review_insights
         (tenant_id, location_id, period_start, period_end, period_type,
          total_reviews, average_rating, sentiment_breakdown, rating_distribution,
          platform_breakdown, top_positive_topics, top_negative_topics,
          response_rate, avg_response_time_hours, ai_summary, recommendations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (tenant_id, location_id, period_start, period_end, period_type)
         DO UPDATE SET
           total_reviews = EXCLUDED.total_reviews,
           average_rating = EXCLUDED.average_rating,
           sentiment_breakdown = EXCLUDED.sentiment_breakdown,
           rating_distribution = EXCLUDED.rating_distribution,
           platform_breakdown = EXCLUDED.platform_breakdown,
           top_positive_topics = EXCLUDED.top_positive_topics,
           top_negative_topics = EXCLUDED.top_negative_topics,
           response_rate = EXCLUDED.response_rate,
           avg_response_time_hours = EXCLUDED.avg_response_time_hours,
           ai_summary = EXCLUDED.ai_summary,
           recommendations = EXCLUDED.recommendations,
           created_at = NOW()
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   period_start as "periodStart", period_end as "periodEnd",
                   period_type as "periodType", total_reviews as "totalReviews",
                   average_rating as "averageRating", sentiment_breakdown as "sentimentBreakdown",
                   rating_distribution as "ratingDistribution", platform_breakdown as "platformBreakdown",
                   top_positive_topics as "topPositiveTopics", top_negative_topics as "topNegativeTopics",
                   response_rate as "responseRate", avg_response_time_hours as "avgResponseTimeHours",
                   ai_summary as "aiSummary", recommendations, created_at as "createdAt"`,
        [
          tenantId,
          locationId || null,
          periodStart,
          periodEnd,
          periodType,
          totalReviews,
          parseFloat(stats.avg_rating) || null,
          JSON.stringify(sentimentBreakdown),
          JSON.stringify(ratingDistribution),
          JSON.stringify(platformBreakdown),
          JSON.stringify(topPositiveTopics),
          JSON.stringify(topNegativeTopics),
          parseFloat(stats.response_rate) || 0,
          parseFloat(stats.avg_response_hours) || null,
          aiSummary,
          JSON.stringify(recommendations),
        ]
      );

      logger.info('Period insights generated', {
        tenantId,
        locationId,
        periodType,
        totalReviews,
      });

      return insertResult.rows[0];
    });
  }

  /**
   * Compare locations
   */
  public async compareLocations(
    tenantId: string,
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<LocationComparison[]> {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT
           r.location_id,
           l.name as location_name,
           COUNT(*) as total_reviews,
           AVG(r.rating) as avg_rating,
           AVG(r.sentiment_score) as avg_sentiment,
           COUNT(*) FILTER (WHERE r.is_responded = true)::float / NULLIF(COUNT(*), 0) * 100 as response_rate,
           MODE() WITHIN GROUP (ORDER BY topic) as top_issue
         FROM aggregated_reviews r
         JOIN locations l ON r.location_id = l.id
         LEFT JOIN LATERAL jsonb_array_elements_text(r.topics) as topic ON r.sentiment_score < 0
         WHERE r.tenant_id = $1
           AND r.review_date >= NOW() - INTERVAL '${periodDays} days'
           AND r.location_id IS NOT NULL
         GROUP BY r.location_id, l.name
         ORDER BY avg_rating DESC NULLS LAST`,
        [tenantId]
      );

      return result.rows.map((row, index) => ({
        locationId: row.location_id,
        locationName: row.location_name,
        totalReviews: parseInt(row.total_reviews, 10),
        averageRating: parseFloat(row.avg_rating) || 0,
        sentimentScore: parseFloat(row.avg_sentiment) || 0,
        responseRate: parseFloat(row.response_rate) || 0,
        topIssue: row.top_issue,
        rank: index + 1,
      }));
    });
  }

  /**
   * Get platform statistics
   */
  public async getPlatformStats(
    tenantId: string,
    locationId?: string
  ): Promise<PlatformStats[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const locationFilter = locationId ? 'AND r.location_id = $2' : '';
      const params = locationId ? [tenantId, locationId] : [tenantId];

      const result = await client.query(
        `SELECT
           r.platform,
           COUNT(*) as total_reviews,
           AVG(r.rating) as avg_rating,
           COUNT(*) FILTER (WHERE r.is_responded = true)::float / NULLIF(COUNT(*), 0) * 100 as response_rate,
           rpc.last_sync_at,
           rpc.sync_status
         FROM aggregated_reviews r
         LEFT JOIN review_platform_credentials rpc ON
           rpc.tenant_id = r.tenant_id
           AND rpc.platform = r.platform
           ${locationId ? 'AND (rpc.location_id = $2 OR rpc.location_id IS NULL)' : ''}
           AND rpc.deleted_at IS NULL
         WHERE r.tenant_id = $1 ${locationFilter}
         GROUP BY r.platform, rpc.last_sync_at, rpc.sync_status
         ORDER BY total_reviews DESC`,
        params
      );

      return result.rows.map((row) => ({
        platform: row.platform,
        totalReviews: parseInt(row.total_reviews, 10),
        averageRating: parseFloat(row.avg_rating) || 0,
        responseRate: parseFloat(row.response_rate) || 0,
        lastSyncAt: row.last_sync_at,
        syncStatus: row.sync_status || 'not_connected',
      }));
    });
  }

  /**
   * Get review volume trend
   */
  public async getReviewVolumeTrend(
    tenantId: string,
    period: 'week' | 'month' | 'quarter' = 'month',
    locationId?: string
  ): Promise<Array<{ date: Date; count: number; platform: string }>> {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const groupBy = period === 'week' ? 'day' : period === 'month' ? 'day' : 'week';

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const locationFilter = locationId ? 'AND location_id = $2' : '';
      const params = locationId ? [tenantId, locationId] : [tenantId];

      const result = await client.query(
        `SELECT
           DATE_TRUNC('${groupBy}', review_date) as date,
           platform,
           COUNT(*) as count
         FROM aggregated_reviews
         WHERE tenant_id = $1 ${locationFilter}
           AND review_date >= NOW() - INTERVAL '${periodDays} days'
         GROUP BY DATE_TRUNC('${groupBy}', review_date), platform
         ORDER BY date, platform`,
        params
      );

      return result.rows.map((row) => ({
        date: row.date,
        count: parseInt(row.count, 10),
        platform: row.platform,
      }));
    });
  }

  /**
   * Generate recommendations based on data
   */
  private generateRecommendations(
    sentimentBreakdown: { positive: number; neutral: number; negative: number; mixed: number },
    negativeTopics: TopicInsight[],
    responseRate: number
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const totalReviews = sentimentBreakdown.positive + sentimentBreakdown.neutral +
                         sentimentBreakdown.negative + sentimentBreakdown.mixed;

    if (totalReviews === 0) {
      return recommendations;
    }

    // Check response rate
    if (responseRate < 50) {
      recommendations.push({
        priority: 'high',
        category: 'engagement',
        action: 'Increase review response rate to at least 80%',
        rationale: `Current response rate is ${responseRate.toFixed(0)}%. Responding to reviews improves customer loyalty and SEO.`,
        effort: 'low',
      });
    }

    // Check negative sentiment ratio
    const negativeRatio = sentimentBreakdown.negative / totalReviews;
    if (negativeRatio > 0.2) {
      recommendations.push({
        priority: 'high',
        category: 'quality',
        action: 'Address root causes of negative reviews',
        rationale: `${(negativeRatio * 100).toFixed(0)}% of reviews are negative. Focus on the most mentioned issues.`,
        effort: 'high',
      });
    }

    // Address top negative topics
    for (const topic of negativeTopics.slice(0, 2)) {
      if (topic.count >= 3) {
        recommendations.push({
          priority: topic.avgSentiment < -0.5 ? 'high' : 'medium',
          category: topic.topic,
          action: `Improve ${topic.topic.replace('_', ' ')} based on customer feedback`,
          rationale: `${topic.count} negative mentions of ${topic.topic.replace('_', ' ')} in this period.`,
          effort: 'medium',
        });
      }
    }

    // Encourage positive reviews if ratio is low
    const positiveRatio = sentimentBreakdown.positive / totalReviews;
    if (positiveRatio < 0.5) {
      recommendations.push({
        priority: 'medium',
        category: 'marketing',
        action: 'Implement review request program for satisfied customers',
        rationale: 'Encourage happy customers to leave reviews to balance sentiment ratio.',
        effort: 'low',
      });
    }

    return recommendations;
  }

  /**
   * Generate summary text
   */
  private generateSummary(
    totalReviews: number,
    avgRating: number,
    sentimentBreakdown: { positive: number; neutral: number; negative: number; mixed: number },
    positiveTopics: TopicInsight[],
    negativeTopics: TopicInsight[]
  ): string {
    if (totalReviews === 0) {
      return 'No reviews received during this period.';
    }

    const parts: string[] = [];

    // Overview
    parts.push(`Received ${totalReviews} reviews with an average rating of ${avgRating.toFixed(1)} stars.`);

    // Sentiment summary
    const totalSentiment = sentimentBreakdown.positive + sentimentBreakdown.neutral +
                          sentimentBreakdown.negative + sentimentBreakdown.mixed;
    if (totalSentiment > 0) {
      const positivePercent = ((sentimentBreakdown.positive / totalSentiment) * 100).toFixed(0);
      const negativePercent = ((sentimentBreakdown.negative / totalSentiment) * 100).toFixed(0);
      parts.push(`${positivePercent}% of reviews were positive, while ${negativePercent}% were negative.`);
    }

    // Positive highlights
    if (positiveTopics.length > 0) {
      const topPositive = positiveTopics.slice(0, 2).map((t) => t.topic.replace('_', ' ')).join(' and ');
      parts.push(`Customers praised ${topPositive}.`);
    }

    // Areas for improvement
    if (negativeTopics.length > 0) {
      const topNegative = negativeTopics.slice(0, 2).map((t) => t.topic.replace('_', ' ')).join(' and ');
      parts.push(`Areas for improvement include ${topNegative}.`);
    }

    return parts.join(' ');
  }

  /**
   * Export reviews
   */
  public async exportReviews(
    tenantId: string,
    format: 'csv' | 'json',
    filters?: {
      startDate?: Date;
      endDate?: Date;
      platform?: string;
      locationId?: string;
    }
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let whereClause = 'WHERE tenant_id = $1';
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (filters?.startDate) {
        whereClause += ` AND review_date >= $${paramIndex++}`;
        params.push(filters.startDate);
      }
      if (filters?.endDate) {
        whereClause += ` AND review_date <= $${paramIndex++}`;
        params.push(filters.endDate);
      }
      if (filters?.platform) {
        whereClause += ` AND platform = $${paramIndex++}`;
        params.push(filters.platform);
      }
      if (filters?.locationId) {
        whereClause += ` AND location_id = $${paramIndex++}`;
        params.push(filters.locationId);
      }

      const result = await client.query(
        `SELECT id, platform, reviewer_name, rating, review_text, review_date,
                sentiment_score, sentiment_label, is_responded, response_text, response_date
         FROM aggregated_reviews
         ${whereClause}
         ORDER BY review_date DESC`,
        params
      );

      const timestamp = new Date().toISOString().split('T')[0];

      if (format === 'json') {
        return {
          data: JSON.stringify(result.rows, null, 2),
          filename: `reviews-export-${timestamp}.json`,
          mimeType: 'application/json',
        };
      }

      // CSV format
      const headers = [
        'ID', 'Platform', 'Reviewer', 'Rating', 'Review Text', 'Review Date',
        'Sentiment Score', 'Sentiment Label', 'Responded', 'Response Text', 'Response Date',
      ];

      const csvRows = [headers.join(',')];

      for (const row of result.rows) {
        const csvRow = [
          row.id,
          row.platform,
          `"${(row.reviewer_name || '').replace(/"/g, '""')}"`,
          row.rating || '',
          `"${(row.review_text || '').replace(/"/g, '""')}"`,
          row.review_date?.toISOString() || '',
          row.sentiment_score || '',
          row.sentiment_label || '',
          row.is_responded ? 'Yes' : 'No',
          `"${(row.response_text || '').replace(/"/g, '""')}"`,
          row.response_date?.toISOString() || '',
        ];
        csvRows.push(csvRow.join(','));
      }

      return {
        data: csvRows.join('\n'),
        filename: `reviews-export-${timestamp}.csv`,
        mimeType: 'text/csv',
      };
    });
  }
}
