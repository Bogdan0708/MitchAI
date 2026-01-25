/**
 * Insights Service
 *
 * Cross-module AI-powered business intelligence.
 * Correlates data across compliance, reviews, and content
 * to generate actionable insights.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { addJob } from '../../queue';

// Types
export interface BusinessInsight {
  id: string;
  tenantId: string;
  locationId: string | null;
  insightType: InsightType;
  title: string;
  description: string;
  dataPoints: DataPoint[];
  confidenceScore: number;
  impactScore: ImpactLevel;
  recommendedActions: RecommendedAction[];
  validUntil: Date | null;
  isActionable: boolean;
  actioned: boolean;
  createdAt: Date;
}

export type InsightType =
  | 'review_compliance_correlation'
  | 'content_performance_predictor'
  | 'operational_recommendation'
  | 'competitive_insight'
  | 'trend_opportunity'
  | 'risk_alert'
  | 'revenue_opportunity';

export type ImpactLevel = 'low' | 'medium' | 'high';

export interface DataPoint {
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'stable';
  source: string;
}

export interface RecommendedAction {
  action: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
}

export interface InsightFilters {
  insightType?: InsightType;
  impactScore?: ImpactLevel;
  isActionable?: boolean;
  actioned?: boolean;
  locationId?: string;
  limit?: number;
  offset?: number;
}

export interface CorrelationResult {
  source: string;
  target: string;
  correlationType: string;
  strength: number; // -1 to 1
  description: string;
  dataPoints: DataPoint[];
}

export interface CrossModuleMetrics {
  compliance: {
    score: number;
    checksCompleted: number;
    breaches: number;
    trend: 'up' | 'down' | 'stable';
  };
  reviews: {
    averageRating: number;
    sentimentScore: number;
    responseRate: number;
    trend: 'up' | 'down' | 'stable';
  };
  content: {
    postsThisMonth: number;
    avgEngagement: number;
    topPlatform: string;
    trend: 'up' | 'down' | 'stable';
  };
}

export class InsightsService {
  constructor(private pool: Pool) {}

  /**
   * Get insights with filters
   */
  public async getInsights(
    tenantId: string,
    filters: InsightFilters = {}
  ): Promise<{ insights: BusinessInsight[]; total: number }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const conditions: string[] = ['tenant_id = $1'];
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      // Only show non-expired insights
      conditions.push(`(valid_until IS NULL OR valid_until > NOW())`);

      if (filters.insightType) {
        conditions.push(`insight_type = $${paramIndex++}`);
        params.push(filters.insightType);
      }

      if (filters.impactScore) {
        conditions.push(`impact_score = $${paramIndex++}`);
        params.push(filters.impactScore);
      }

      if (filters.isActionable !== undefined) {
        conditions.push(`is_actionable = $${paramIndex++}`);
        params.push(filters.isActionable);
      }

      if (filters.actioned !== undefined) {
        conditions.push(`actioned = $${paramIndex++}`);
        params.push(filters.actioned);
      }

      if (filters.locationId) {
        conditions.push(`location_id = $${paramIndex++}`);
        params.push(filters.locationId);
      }

      const whereClause = conditions.join(' AND ');

      const countResult = await client.query(
        `SELECT COUNT(*) FROM business_intelligence WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const limit = filters.limit || 20;
      const offset = filters.offset || 0;

      const result = await client.query(
        `SELECT * FROM business_intelligence
         WHERE ${whereClause}
         ORDER BY
           CASE impact_score
             WHEN 'high' THEN 1
             WHEN 'medium' THEN 2
             ELSE 3
           END,
           confidence_score DESC,
           created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
      );

      return {
        insights: result.rows.map(this.mapRowToInsight),
        total,
      };
    });
  }

  /**
   * Get recommendations (actionable insights)
   */
  public async getRecommendations(
    tenantId: string,
    limit: number = 10
  ): Promise<BusinessInsight[]> {
    const result = await this.getInsights(tenantId, {
      isActionable: true,
      actioned: false,
      limit,
    });
    return result.insights;
  }

  /**
   * Get insight by ID
   */
  public async getInsightById(
    tenantId: string,
    insightId: string
  ): Promise<BusinessInsight | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM business_intelligence WHERE id = $1 AND tenant_id = $2`,
        [insightId, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToInsight(result.rows[0]) : null;
    });
  }

  /**
   * Mark insight as actioned
   */
  public async markActioned(
    tenantId: string,
    insightId: string
  ): Promise<BusinessInsight | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE business_intelligence
         SET actioned = true
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [insightId, tenantId]
      );

      return result.rows.length > 0 ? this.mapRowToInsight(result.rows[0]) : null;
    });
  }

  /**
   * Generate new insights from cross-module data
   */
  public async generateInsights(tenantId: string): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = [];

    // Generate different types of insights
    const correlationInsights = await this.generateCorrelationInsights(tenantId);
    const operationalInsights = await this.generateOperationalInsights(tenantId);
    const trendInsights = await this.generateTrendInsights(tenantId);

    insights.push(...correlationInsights, ...operationalInsights, ...trendInsights);

    logger.info('Generated business insights', {
      tenantId,
      insightCount: insights.length,
    });

    return insights;
  }

  /**
   * Generate insights correlating reviews with compliance
   */
  private async generateCorrelationInsights(tenantId: string): Promise<BusinessInsight[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const insights: BusinessInsight[] = [];

      // Check for correlation between compliance issues and negative reviews
      const correlationResult = await client.query(
        `WITH compliance_issues AS (
           SELECT location_id, COUNT(*) as issues
           FROM compliance_checks
           WHERE tenant_id = $1
             AND status = 'failed'
             AND completed_at > NOW() - INTERVAL '30 days'
           GROUP BY location_id
         ),
         negative_reviews AS (
           SELECT location_id, COUNT(*) as reviews, AVG(rating) as avg_rating
           FROM aggregated_reviews
           WHERE tenant_id = $1
             AND sentiment_label = 'negative'
             AND review_date > NOW() - INTERVAL '30 days'
           GROUP BY location_id
         )
         SELECT
           ci.location_id,
           ci.issues,
           nr.reviews,
           nr.avg_rating,
           l.name as location_name
         FROM compliance_issues ci
         JOIN negative_reviews nr ON ci.location_id = nr.location_id
         JOIN locations l ON ci.location_id = l.id
         WHERE ci.issues > 2 AND nr.reviews > 3`,
        [tenantId]
      );

      for (const row of correlationResult.rows) {
        const insight = await this.createInsight(tenantId, {
          locationId: row.location_id,
          insightType: 'review_compliance_correlation',
          title: `Compliance-Review Correlation at ${row.location_name}`,
          description: `There's a potential correlation between compliance issues (${row.issues} failures) and negative reviews (${row.reviews} negative, avg rating ${parseFloat(row.avg_rating).toFixed(1)}) at ${row.location_name}. Addressing compliance issues may improve customer satisfaction.`,
          dataPoints: [
            { label: 'Compliance Failures', value: row.issues, source: 'compliance_checks' },
            { label: 'Negative Reviews', value: row.reviews, source: 'reviews' },
            { label: 'Average Rating', value: parseFloat(row.avg_rating).toFixed(1), source: 'reviews' },
          ],
          confidenceScore: 0.75,
          impactScore: 'high',
          recommendedActions: [
            {
              action: 'Review and address recent compliance failures',
              priority: 'high',
              effort: 'medium',
              expectedImpact: 'Potential 0.5+ star rating improvement',
            },
            {
              action: 'Analyze negative review themes for specific issues',
              priority: 'medium',
              effort: 'low',
              expectedImpact: 'Identify root causes',
            },
          ],
          validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });

        insights.push(insight);
      }

      return insights;
    });
  }

  /**
   * Generate operational insights
   */
  private async generateOperationalInsights(tenantId: string): Promise<BusinessInsight[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const insights: BusinessInsight[] = [];

      // Check review response rate
      const responseResult = await client.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE is_responded = true) as responded,
           AVG(EXTRACT(EPOCH FROM (response_date - review_date)) / 3600)
             FILTER (WHERE is_responded = true) as avg_response_hours
         FROM aggregated_reviews
         WHERE tenant_id = $1
           AND review_date > NOW() - INTERVAL '30 days'`,
        [tenantId]
      );

      const response = responseResult.rows[0];
      const responseRate = response.total > 0
        ? (response.responded / response.total) * 100
        : 0;

      if (responseRate < 50 && response.total > 5) {
        const insight = await this.createInsight(tenantId, {
          insightType: 'operational_recommendation',
          title: 'Low Review Response Rate',
          description: `Only ${responseRate.toFixed(0)}% of reviews received responses in the last 30 days. Research shows responding to reviews can improve ratings by up to 0.3 stars.`,
          dataPoints: [
            { label: 'Response Rate', value: `${responseRate.toFixed(0)}%`, source: 'reviews' },
            { label: 'Total Reviews', value: response.total, source: 'reviews' },
            { label: 'Avg Response Time', value: response.avg_response_hours ? `${parseFloat(response.avg_response_hours).toFixed(1)} hours` : 'N/A', source: 'reviews' },
          ],
          confidenceScore: 0.9,
          impactScore: 'medium',
          recommendedActions: [
            {
              action: 'Set up AI-assisted review responses',
              priority: 'high',
              effort: 'low',
              expectedImpact: 'Improve response rate to 90%+',
            },
            {
              action: 'Respond to negative reviews within 24 hours',
              priority: 'urgent',
              effort: 'medium',
              expectedImpact: 'Mitigate reputation damage',
            },
          ],
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        insights.push(insight);
      }

      // Check content posting consistency
      const contentResult = await client.query(
        `SELECT
           COUNT(*) as total_posts,
           COUNT(DISTINCT DATE(published_at)) as posting_days
         FROM content_calendar
         WHERE tenant_id = $1
           AND status = 'published'
           AND published_at > NOW() - INTERVAL '30 days'`,
        [tenantId]
      );

      const content = contentResult.rows[0];
      const postsPerWeek = (content.total_posts / 4.3).toFixed(1);

      if (content.total_posts < 8) {
        const insight = await this.createInsight(tenantId, {
          insightType: 'operational_recommendation',
          title: 'Increase Social Media Posting Frequency',
          description: `Only ${content.total_posts} posts published in the last 30 days (${postsPerWeek}/week). Industry benchmarks suggest 3-5 posts per week for optimal engagement.`,
          dataPoints: [
            { label: 'Posts This Month', value: content.total_posts, source: 'content_calendar' },
            { label: 'Posts Per Week', value: postsPerWeek, source: 'content_calendar' },
            { label: 'Active Posting Days', value: content.posting_days, source: 'content_calendar' },
          ],
          confidenceScore: 0.85,
          impactScore: 'medium',
          recommendedActions: [
            {
              action: 'Use AI content generator for quick post ideas',
              priority: 'medium',
              effort: 'low',
              expectedImpact: 'Save 2-3 hours per week on content creation',
            },
            {
              action: 'Schedule posts for optimal times using calendar',
              priority: 'medium',
              effort: 'low',
              expectedImpact: 'Ensure consistent posting schedule',
            },
          ],
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        insights.push(insight);
      }

      return insights;
    });
  }

  /**
   * Generate trend-based insights
   */
  private async generateTrendInsights(tenantId: string): Promise<BusinessInsight[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const insights: BusinessInsight[] = [];

      // Compare this month vs last month ratings
      const ratingTrendResult = await client.query(
        `WITH this_month AS (
           SELECT AVG(rating) as avg_rating, COUNT(*) as count
           FROM aggregated_reviews
           WHERE tenant_id = $1
             AND review_date > DATE_TRUNC('month', NOW())
         ),
         last_month AS (
           SELECT AVG(rating) as avg_rating, COUNT(*) as count
           FROM aggregated_reviews
           WHERE tenant_id = $1
             AND review_date > DATE_TRUNC('month', NOW() - INTERVAL '1 month')
             AND review_date < DATE_TRUNC('month', NOW())
         )
         SELECT
           tm.avg_rating as this_rating,
           tm.count as this_count,
           lm.avg_rating as last_rating,
           lm.count as last_count
         FROM this_month tm, last_month lm`,
        [tenantId]
      );

      const trend = ratingTrendResult.rows[0];

      if (trend.this_rating && trend.last_rating && trend.this_count > 3 && trend.last_count > 3) {
        const ratingChange = parseFloat(trend.this_rating) - parseFloat(trend.last_rating);

        if (Math.abs(ratingChange) >= 0.3) {
          const isPositive = ratingChange > 0;
          const insight = await this.createInsight(tenantId, {
            insightType: isPositive ? 'revenue_opportunity' : 'risk_alert',
            title: isPositive
              ? 'Rating Improvement Detected'
              : 'Rating Decline Detected',
            description: isPositive
              ? `Average rating improved by ${ratingChange.toFixed(2)} stars compared to last month. Keep up the good work!`
              : `Average rating dropped by ${Math.abs(ratingChange).toFixed(2)} stars compared to last month. Investigate recent negative reviews.`,
            dataPoints: [
              { label: 'Current Rating', value: parseFloat(trend.this_rating).toFixed(2), trend: isPositive ? 'up' : 'down', source: 'reviews' },
              { label: 'Last Month Rating', value: parseFloat(trend.last_rating).toFixed(2), source: 'reviews' },
              { label: 'Change', value: `${ratingChange > 0 ? '+' : ''}${ratingChange.toFixed(2)}`, source: 'reviews' },
            ],
            confidenceScore: 0.88,
            impactScore: isPositive ? 'medium' : 'high',
            recommendedActions: isPositive
              ? [
                  {
                    action: 'Identify what improved and standardize it',
                    priority: 'medium',
                    effort: 'low',
                    expectedImpact: 'Sustain improvements',
                  },
                ]
              : [
                  {
                    action: 'Review recent negative feedback themes',
                    priority: 'urgent',
                    effort: 'low',
                    expectedImpact: 'Identify issues quickly',
                  },
                  {
                    action: 'Check compliance records for recent issues',
                    priority: 'high',
                    effort: 'low',
                    expectedImpact: 'Find operational problems',
                  },
                ],
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });

          insights.push(insight);
        }
      }

      return insights;
    });
  }

  /**
   * Get correlations between modules
   */
  public async getCorrelations(tenantId: string): Promise<CorrelationResult[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const correlations: CorrelationResult[] = [];

      // Compliance score vs review rating correlation
      const complianceReviewResult = await client.query(
        `WITH monthly_data AS (
           SELECT
             DATE_TRUNC('week', cc.completed_at) as week,
             AVG(CASE WHEN cc.status = 'passed' THEN 1 ELSE 0 END) * 100 as compliance_rate,
             AVG(ar.rating) as avg_rating
           FROM compliance_checks cc
           JOIN aggregated_reviews ar ON
             ar.location_id = cc.location_id
             AND DATE_TRUNC('week', ar.review_date) = DATE_TRUNC('week', cc.completed_at)
           WHERE cc.tenant_id = $1
             AND cc.completed_at > NOW() - INTERVAL '90 days'
           GROUP BY DATE_TRUNC('week', cc.completed_at)
           HAVING COUNT(*) > 5
         )
         SELECT
           CORR(compliance_rate, avg_rating) as correlation,
           AVG(compliance_rate) as avg_compliance,
           AVG(avg_rating) as avg_rating
         FROM monthly_data`,
        [tenantId]
      );

      if (complianceReviewResult.rows[0].correlation) {
        const corr = parseFloat(complianceReviewResult.rows[0].correlation);
        correlations.push({
          source: 'compliance',
          target: 'reviews',
          correlationType: 'compliance_to_rating',
          strength: corr,
          description: corr > 0.5
            ? 'Strong positive correlation between compliance and reviews'
            : corr > 0.2
            ? 'Moderate correlation between compliance and reviews'
            : 'Weak correlation between compliance and reviews',
          dataPoints: [
            { label: 'Correlation', value: corr.toFixed(2), source: 'analysis' },
            { label: 'Avg Compliance Rate', value: `${parseFloat(complianceReviewResult.rows[0].avg_compliance).toFixed(0)}%`, source: 'compliance' },
            { label: 'Avg Rating', value: parseFloat(complianceReviewResult.rows[0].avg_rating).toFixed(2), source: 'reviews' },
          ],
        });
      }

      return correlations;
    });
  }

  /**
   * Get cross-module metrics summary
   */
  public async getCrossModuleMetrics(tenantId: string): Promise<CrossModuleMetrics> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Compliance metrics
      const complianceResult = await client.query(
        `SELECT
           AVG(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) * 100 as score,
           COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed,
           COUNT(*) FILTER (WHERE status = 'failed') as breaches
         FROM compliance_checks
         WHERE tenant_id = $1
           AND scheduled_at > NOW() - INTERVAL '30 days'`,
        [tenantId]
      );

      // Review metrics
      const reviewResult = await client.query(
        `SELECT
           AVG(rating) as avg_rating,
           AVG(sentiment_score) as sentiment,
           AVG(CASE WHEN is_responded THEN 1 ELSE 0 END) * 100 as response_rate
         FROM aggregated_reviews
         WHERE tenant_id = $1
           AND review_date > NOW() - INTERVAL '30 days'`,
        [tenantId]
      );

      // Content metrics
      const contentResult = await client.query(
        `SELECT
           COUNT(*) as posts,
           AVG((performance_metrics->>'engagement_rate')::numeric) as avg_engagement
         FROM content_calendar
         WHERE tenant_id = $1
           AND status = 'published'
           AND published_at > NOW() - INTERVAL '30 days'`,
        [tenantId]
      );

      // Top platform
      const platformResult = await client.query(
        `SELECT platforms->0 as platform, COUNT(*) as count
         FROM content_calendar
         WHERE tenant_id = $1
           AND status = 'published'
           AND published_at > NOW() - INTERVAL '30 days'
         GROUP BY platforms->0
         ORDER BY count DESC
         LIMIT 1`,
        [tenantId]
      );

      const comp = complianceResult.rows[0];
      const rev = reviewResult.rows[0];
      const cont = contentResult.rows[0];
      const topPlatform = platformResult.rows[0]?.platform || 'none';

      return {
        compliance: {
          score: comp.score ? parseFloat(comp.score) : 0,
          checksCompleted: parseInt(comp.completed, 10) || 0,
          breaches: parseInt(comp.breaches, 10) || 0,
          trend: 'stable', // Would calculate based on historical data
        },
        reviews: {
          averageRating: rev.avg_rating ? parseFloat(rev.avg_rating) : 0,
          sentimentScore: rev.sentiment ? parseFloat(rev.sentiment) : 0,
          responseRate: rev.response_rate ? parseFloat(rev.response_rate) : 0,
          trend: 'stable',
        },
        content: {
          postsThisMonth: parseInt(cont.posts, 10) || 0,
          avgEngagement: cont.avg_engagement ? parseFloat(cont.avg_engagement) : 0,
          topPlatform: (topPlatform as string).replace(/"/g, '') || 'none',
          trend: 'stable',
        },
      };
    });
  }

  /**
   * Create and save an insight
   */
  private async createInsight(
    tenantId: string,
    data: {
      locationId?: string;
      insightType: InsightType;
      title: string;
      description: string;
      dataPoints: DataPoint[];
      confidenceScore: number;
      impactScore: ImpactLevel;
      recommendedActions: RecommendedAction[];
      validUntil?: Date;
    }
  ): Promise<BusinessInsight> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO business_intelligence (
           tenant_id, location_id, insight_type, title, description,
           data_points, confidence_score, impact_score,
           recommended_actions, valid_until
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          tenantId,
          data.locationId || null,
          data.insightType,
          data.title,
          data.description,
          JSON.stringify(data.dataPoints),
          data.confidenceScore,
          data.impactScore,
          JSON.stringify(data.recommendedActions),
          data.validUntil || null,
        ]
      );

      return this.mapRowToInsight(result.rows[0]);
    });
  }

  /**
   * Schedule insight generation job
   */
  public async scheduleInsightGeneration(tenantId: string): Promise<void> {
    await addJob('intelligence.generate', { tenantId });
  }

  private mapRowToInsight(row: Record<string, unknown>): BusinessInsight {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      locationId: row.location_id as string | null,
      insightType: row.insight_type as InsightType,
      title: row.title as string,
      description: row.description as string,
      dataPoints: (row.data_points as DataPoint[]) || [],
      confidenceScore: parseFloat(row.confidence_score as string) || 0,
      impactScore: row.impact_score as ImpactLevel,
      recommendedActions: (row.recommended_actions as RecommendedAction[]) || [],
      validUntil: row.valid_until ? new Date(row.valid_until as string) : null,
      isActionable: row.is_actionable as boolean,
      actioned: row.actioned as boolean,
      createdAt: new Date(row.created_at as string),
    };
  }
}
