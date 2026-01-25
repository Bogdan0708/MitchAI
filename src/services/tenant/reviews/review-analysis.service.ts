/**
 * Review Analysis Service
 *
 * Provides AI-powered sentiment analysis, topic extraction, and
 * compliance detection for reviews.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { addJob } from '../../queue';
import { AggregatedReview, ReviewAggregatorService } from './review-aggregator.service';

// Types
export interface SentimentAnalysis {
  score: number; // -1.0 to 1.0
  label: 'positive' | 'neutral' | 'negative' | 'mixed';
  confidence: number;
  aspects: AspectSentiment[];
}

export interface AspectSentiment {
  aspect: string;
  sentiment: number;
  mentions: string[];
}

export interface TopicExtraction {
  topics: string[];
  keywords: string[];
  categories: string[];
}

export interface ComplianceFlag {
  type: 'food_safety' | 'hygiene' | 'allergen' | 'health_code' | 'staff_conduct' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
  keywords: string[];
}

export interface AnalysisResult {
  reviewId: string;
  sentiment: SentimentAnalysis;
  topics: TopicExtraction;
  complianceFlags: ComplianceFlag[];
  priority: AggregatedReview['priority'];
  language: string;
  processedAt: Date;
}

export interface TopicTrend {
  topic: string;
  count: number;
  averageSentiment: number;
  trend: 'up' | 'down' | 'stable';
  previousCount?: number;
}

export interface SentimentTrend {
  date: Date;
  averageSentiment: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalReviews: number;
}

export interface CorrelationResult {
  reviewId: string;
  reviewDate: Date;
  complianceIssue: string;
  relatedIncidentId?: string;
  relatedIncidentType?: string;
  correlationScore: number;
}

// Compliance detection patterns
const COMPLIANCE_PATTERNS: Array<{
  type: ComplianceFlag['type'];
  patterns: RegExp[];
  severity: ComplianceFlag['severity'];
}> = [
  {
    type: 'food_safety',
    patterns: [
      /food.?poison/i,
      /got\s+sick/i,
      /ill\s+after/i,
      /stomach\s+(ache|bug|pain)/i,
      /vomit/i,
      /diarrhea/i,
      /undercooked/i,
      /raw\s+(chicken|meat|fish)/i,
    ],
    severity: 'high',
  },
  {
    type: 'hygiene',
    patterns: [
      /dirty/i,
      /unclean/i,
      /filthy/i,
      /cockroach/i,
      /roach/i,
      /bug\s+in/i,
      /insect/i,
      /mouse|mice|rat/i,
      /hair\s+in/i,
    ],
    severity: 'high',
  },
  {
    type: 'allergen',
    patterns: [
      /allerg(y|ic)\s+reaction/i,
      /didn't\s+mention\s+allerg/i,
      /contains\s+(nuts|peanuts|gluten)/i,
      /cross.?contaminat/i,
      /anaphyla/i,
    ],
    severity: 'high',
  },
  {
    type: 'health_code',
    patterns: [
      /health\s+inspector/i,
      /health\s+violation/i,
      /expired\s+(food|product)/i,
      /temperature/i,
      /cold\s+food/i,
      /lukewarm/i,
    ],
    severity: 'medium',
  },
  {
    type: 'staff_conduct',
    patterns: [
      /rude\s+(waiter|staff|server)/i,
      /no\s+gloves/i,
      /touched\s+food/i,
      /cough(ed|ing)\s+(on|near)/i,
      /sneez(ed|ing)/i,
    ],
    severity: 'medium',
  },
];

// Hospitality-specific aspect categories
export const ASPECT_CATEGORIES = [
  'food_quality',
  'service',
  'atmosphere',
  'cleanliness',
  'value',
  'speed',
  'menu_variety',
  'portion_size',
  'presentation',
  'location',
];

export class ReviewAnalysisService {
  private reviewAggregator: ReviewAggregatorService;

  constructor(private pool: Pool) {
    this.reviewAggregator = new ReviewAggregatorService(pool);
  }

  /**
   * Analyze a single review
   */
  public async analyzeReview(
    tenantId: string,
    reviewId: string
  ): Promise<AnalysisResult> {
    const review = await this.reviewAggregator.getReviewById(tenantId, reviewId);

    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    if (!review.reviewText) {
      throw new Error(`Review has no text to analyze: ${reviewId}`);
    }

    // Perform analysis
    const sentiment = this.analyzeSentiment(review.reviewText, review.rating);
    const topics = this.extractTopics(review.reviewText);
    const complianceFlags = this.detectComplianceIssues(review.reviewText);
    const priority = this.determinePriority(sentiment, complianceFlags, review.rating);
    const language = this.detectLanguage(review.reviewText);

    const result: AnalysisResult = {
      reviewId,
      sentiment,
      topics,
      complianceFlags,
      priority,
      language,
      processedAt: new Date(),
    };

    // Update the review with analysis results
    await this.reviewAggregator.updateReviewAnalysis(tenantId, reviewId, {
      sentimentScore: sentiment.score,
      sentimentLabel: sentiment.label,
      sentimentAspects: sentiment.aspects,
      topics: topics.topics,
      keywords: topics.keywords,
      complianceFlags: complianceFlags.map((f) => ({
        type: f.type,
        description: f.description,
      })),
      priority,
    });

    // If compliance issues detected, create alerts
    if (complianceFlags.length > 0) {
      for (const flag of complianceFlags) {
        if (flag.severity === 'high') {
          await addJob('intelligence.alert.create', {
            tenantId,
            alertType: 'review_compliance_flag',
            severity: 'critical',
            title: `Compliance concern in review: ${flag.type}`,
            message: flag.description,
            sourceType: 'review',
            sourceId: reviewId,
          });
        }
      }
    }

    // If negative sentiment, create alert
    if (sentiment.label === 'negative' && sentiment.score < -0.5) {
      await addJob('intelligence.alert.create', {
        tenantId,
        alertType: 'negative_review',
        severity: 'high',
        title: 'Negative review received',
        message: `Review with sentiment score ${sentiment.score.toFixed(2)} requires attention`,
        sourceType: 'review',
        sourceId: reviewId,
      });
    }

    logger.info('Review analyzed', {
      tenantId,
      reviewId,
      sentimentLabel: sentiment.label,
      complianceFlagsCount: complianceFlags.length,
    });

    return result;
  }

  /**
   * Batch analyze multiple reviews
   */
  public async batchAnalyze(
    tenantId: string,
    reviewIds: string[]
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    for (const reviewId of reviewIds) {
      try {
        const result = await this.analyzeReview(tenantId, reviewId);
        results.push(result);
      } catch (error) {
        logger.error('Failed to analyze review', {
          tenantId,
          reviewId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Analyze sentiment of text
   * In production, this would call an AI provider
   */
  private analyzeSentiment(text: string, rating?: number | null): SentimentAnalysis {
    // Simple rule-based sentiment as fallback
    // In production, this would use AI providers

    const positiveWords = [
      'excellent', 'amazing', 'wonderful', 'fantastic', 'great', 'love',
      'delicious', 'perfect', 'best', 'friendly', 'outstanding', 'superb',
    ];
    const negativeWords = [
      'terrible', 'awful', 'horrible', 'bad', 'worst', 'hate', 'disgusting',
      'poor', 'rude', 'slow', 'cold', 'disappointing', 'never again',
    ];

    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (lowerText.includes(word)) positiveCount++;
    }
    for (const word of negativeWords) {
      if (lowerText.includes(word)) negativeCount++;
    }

    // Calculate base score from text
    let score = 0;
    if (positiveCount + negativeCount > 0) {
      score = (positiveCount - negativeCount) / (positiveCount + negativeCount);
    }

    // Adjust based on rating if available
    if (rating !== null && rating !== undefined) {
      const ratingScore = (rating - 3) / 2; // Maps 1-5 to -1 to 1
      score = (score + ratingScore) / 2; // Average of text and rating sentiment
    }

    // Determine label
    let label: SentimentAnalysis['label'];
    if (score > 0.3) label = 'positive';
    else if (score < -0.3) label = 'negative';
    else if (positiveCount > 0 && negativeCount > 0) label = 'mixed';
    else label = 'neutral';

    // Extract aspect sentiments
    const aspects = this.extractAspectSentiments(text);

    return {
      score,
      label,
      confidence: 0.7, // Would be calculated by AI model
      aspects,
    };
  }

  /**
   * Extract aspect-based sentiments
   */
  private extractAspectSentiments(text: string): AspectSentiment[] {
    const aspects: AspectSentiment[] = [];
    const lowerText = text.toLowerCase();

    const aspectKeywords: Record<string, string[]> = {
      food_quality: ['food', 'dish', 'meal', 'taste', 'flavor', 'menu'],
      service: ['service', 'staff', 'waiter', 'waitress', 'server', 'host'],
      atmosphere: ['atmosphere', 'ambiance', 'decor', 'music', 'vibe', 'setting'],
      cleanliness: ['clean', 'dirty', 'hygiene', 'sanitary', 'tidy'],
      value: ['price', 'value', 'worth', 'expensive', 'cheap', 'affordable'],
      speed: ['wait', 'quick', 'slow', 'fast', 'time', 'minutes'],
    };

    for (const [aspect, keywords] of Object.entries(aspectKeywords)) {
      const mentions: string[] = [];
      let found = false;

      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          found = true;
          // Extract sentence containing the keyword
          const sentences = text.split(/[.!?]+/);
          for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(keyword)) {
              mentions.push(sentence.trim());
            }
          }
        }
      }

      if (found) {
        // Simple sentiment for this aspect
        const aspectText = mentions.join(' ');
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love'];
        const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'hate'];

        let sentiment = 0;
        for (const word of positiveWords) {
          if (aspectText.toLowerCase().includes(word)) sentiment += 0.3;
        }
        for (const word of negativeWords) {
          if (aspectText.toLowerCase().includes(word)) sentiment -= 0.3;
        }

        aspects.push({
          aspect,
          sentiment: Math.max(-1, Math.min(1, sentiment)),
          mentions: mentions.slice(0, 3), // Limit to 3 mentions
        });
      }
    }

    return aspects;
  }

  /**
   * Extract topics and keywords from text
   */
  private extractTopics(text: string): TopicExtraction {
    const lowerText = text.toLowerCase();
    const topics: string[] = [];
    const keywords: string[] = [];

    // Topic detection based on keywords
    const topicPatterns: Record<string, string[]> = {
      'food quality': ['food', 'dish', 'taste', 'flavor', 'delicious', 'bland'],
      'service': ['service', 'staff', 'waiter', 'waitress', 'friendly', 'rude'],
      'ambiance': ['atmosphere', 'ambiance', 'decor', 'music', 'noise'],
      'value': ['price', 'value', 'expensive', 'cheap', 'worth'],
      'speed': ['wait', 'slow', 'quick', 'fast', 'time'],
      'cleanliness': ['clean', 'dirty', 'hygiene'],
      'reservation': ['reservation', 'booking', 'table', 'wait list'],
      'menu': ['menu', 'options', 'variety', 'vegetarian', 'vegan'],
    };

    for (const [topic, patterns] of Object.entries(topicPatterns)) {
      for (const pattern of patterns) {
        if (lowerText.includes(pattern)) {
          if (!topics.includes(topic)) {
            topics.push(topic);
          }
          if (!keywords.includes(pattern)) {
            keywords.push(pattern);
          }
        }
      }
    }

    // Categorize the review
    const categories: string[] = [];
    if (topics.some((t) => ['food quality', 'menu'].includes(t))) {
      categories.push('food');
    }
    if (topics.some((t) => ['service', 'speed'].includes(t))) {
      categories.push('operations');
    }
    if (topics.some((t) => ['ambiance', 'cleanliness'].includes(t))) {
      categories.push('environment');
    }
    if (topics.includes('value')) {
      categories.push('pricing');
    }

    return { topics, keywords, categories };
  }

  /**
   * Detect compliance-related issues in review text
   */
  private detectComplianceIssues(text: string): ComplianceFlag[] {
    const flags: ComplianceFlag[] = [];

    for (const { type, patterns, severity } of COMPLIANCE_PATTERNS) {
      const matchedKeywords: string[] = [];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          matchedKeywords.push(match[0]);
        }
      }

      if (matchedKeywords.length > 0) {
        flags.push({
          type,
          description: `Review mentions potential ${type.replace('_', ' ')} issue: "${matchedKeywords.join('", "')}"`,
          severity,
          keywords: matchedKeywords,
        });
      }
    }

    return flags;
  }

  /**
   * Determine review priority based on analysis
   */
  private determinePriority(
    sentiment: SentimentAnalysis,
    complianceFlags: ComplianceFlag[],
    rating?: number | null
  ): AggregatedReview['priority'] {
    // Critical compliance issues = urgent
    if (complianceFlags.some((f) => f.severity === 'high')) {
      return 'urgent';
    }

    // Very negative sentiment or 1-star = high
    if (sentiment.score < -0.6 || rating === 1) {
      return 'high';
    }

    // Medium compliance issues or moderately negative = normal
    if (complianceFlags.some((f) => f.severity === 'medium') || sentiment.label === 'negative') {
      return 'normal';
    }

    // Everything else = low
    return 'low';
  }

  /**
   * Simple language detection
   */
  private detectLanguage(text: string): string {
    // Very basic detection - would use proper library in production
    const spanishWords = ['el', 'la', 'los', 'las', 'muy', 'bueno', 'malo'];
    const frenchWords = ['le', 'la', 'les', 'très', 'bon', 'mauvais'];
    const germanWords = ['der', 'die', 'das', 'sehr', 'gut', 'schlecht'];

    const words = text.toLowerCase().split(/\s+/);

    let spanish = 0, french = 0, german = 0;
    for (const word of words) {
      if (spanishWords.includes(word)) spanish++;
      if (frenchWords.includes(word)) french++;
      if (germanWords.includes(word)) german++;
    }

    if (spanish > 3) return 'es';
    if (french > 3) return 'fr';
    if (german > 3) return 'de';
    return 'en';
  }

  /**
   * Get topic trends over time
   */
  public async getTopicTrends(
    tenantId: string,
    period: 'week' | 'month' | 'quarter' = 'month',
    locationId?: string
  ): Promise<TopicTrend[]> {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const previousPeriodDays = periodDays * 2;

    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Current period topic counts
      const currentResult = await client.query(
        `SELECT topic, COUNT(*) as count, AVG(sentiment_score) as avg_sentiment
         FROM aggregated_reviews,
              LATERAL jsonb_array_elements_text(topics) as topic
         WHERE tenant_id = $1
           ${locationId ? 'AND location_id = $2' : ''}
           AND review_date >= NOW() - INTERVAL '${periodDays} days'
           AND topics IS NOT NULL
         GROUP BY topic
         ORDER BY count DESC
         LIMIT 20`,
        locationId ? [tenantId, locationId] : [tenantId]
      );

      // Previous period topic counts for trend calculation
      const previousResult = await client.query(
        `SELECT topic, COUNT(*) as count
         FROM aggregated_reviews,
              LATERAL jsonb_array_elements_text(topics) as topic
         WHERE tenant_id = $1
           ${locationId ? 'AND location_id = $2' : ''}
           AND review_date >= NOW() - INTERVAL '${previousPeriodDays} days'
           AND review_date < NOW() - INTERVAL '${periodDays} days'
           AND topics IS NOT NULL
         GROUP BY topic`,
        locationId ? [tenantId, locationId] : [tenantId]
      );

      const previousCounts = new Map(
        previousResult.rows.map((r) => [r.topic, parseInt(r.count, 10)])
      );

      return currentResult.rows.map((row) => {
        const currentCount = parseInt(row.count, 10);
        const previousCount = previousCounts.get(row.topic) || 0;

        let trend: TopicTrend['trend'] = 'stable';
        if (previousCount > 0) {
          const change = (currentCount - previousCount) / previousCount;
          if (change > 0.2) trend = 'up';
          else if (change < -0.2) trend = 'down';
        } else if (currentCount > 0) {
          trend = 'up';
        }

        return {
          topic: row.topic,
          count: currentCount,
          averageSentiment: parseFloat(row.avg_sentiment) || 0,
          trend,
          previousCount,
        };
      });
    });
  }

  /**
   * Get sentiment trends over time
   */
  public async getSentimentTrends(
    tenantId: string,
    period: 'week' | 'month' | 'quarter' = 'month',
    locationId?: string
  ): Promise<SentimentTrend[]> {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const groupBy = period === 'week' ? 'day' : period === 'month' ? 'day' : 'week';

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT
           DATE_TRUNC('${groupBy}', review_date) as date,
           AVG(sentiment_score) as avg_sentiment,
           COUNT(*) FILTER (WHERE sentiment_label = 'positive') as positive_count,
           COUNT(*) FILTER (WHERE sentiment_label = 'neutral') as neutral_count,
           COUNT(*) FILTER (WHERE sentiment_label = 'negative') as negative_count,
           COUNT(*) as total_reviews
         FROM aggregated_reviews
         WHERE tenant_id = $1
           ${locationId ? 'AND location_id = $2' : ''}
           AND review_date >= NOW() - INTERVAL '${periodDays} days'
           AND sentiment_score IS NOT NULL
         GROUP BY DATE_TRUNC('${groupBy}', review_date)
         ORDER BY date`,
        locationId ? [tenantId, locationId] : [tenantId]
      );

      return result.rows.map((row) => ({
        date: row.date,
        averageSentiment: parseFloat(row.avg_sentiment) || 0,
        positiveCount: parseInt(row.positive_count, 10),
        neutralCount: parseInt(row.neutral_count, 10),
        negativeCount: parseInt(row.negative_count, 10),
        totalReviews: parseInt(row.total_reviews, 10),
      }));
    });
  }

  /**
   * Correlate reviews with compliance incidents
   */
  public async correlateWithIncidents(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CorrelationResult[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Find reviews with compliance flags that match timeframes of corrective actions
      const result = await client.query(
        `SELECT
           r.id as review_id,
           r.review_date,
           cf->>'type' as compliance_issue,
           ca.id as incident_id,
           ca.incident_type
         FROM aggregated_reviews r,
              LATERAL jsonb_array_elements(r.compliance_flags) as cf
         LEFT JOIN corrective_actions ca ON
           ca.tenant_id = r.tenant_id
           AND ca.location_id = r.location_id
           AND ca.created_at BETWEEN r.review_date - INTERVAL '7 days' AND r.review_date + INTERVAL '7 days'
         WHERE r.tenant_id = $1
           AND r.review_date BETWEEN $2 AND $3
           AND r.compliance_flags IS NOT NULL
           AND jsonb_array_length(r.compliance_flags) > 0
         ORDER BY r.review_date DESC`,
        [tenantId, startDate, endDate]
      );

      return result.rows.map((row) => ({
        reviewId: row.review_id,
        reviewDate: row.review_date,
        complianceIssue: row.compliance_issue,
        relatedIncidentId: row.incident_id,
        relatedIncidentType: row.incident_type,
        correlationScore: row.incident_id ? 0.8 : 0.3, // Higher if matched with incident
      }));
    });
  }
}
