/**
 * REVIEW AI SERVICE
 *
 * AI-powered review management:
 * - Sentiment analysis
 * - Automated response generation
 * - Review aggregation and insights
 * - Trend detection
 */

import { Pool } from 'pg';
import { AIRouter, AIMessage, SYSTEM_PROMPTS } from './ai';

export interface Review {
  id: string;
  tenantId: string;
  locationId: string;
  source: 'google' | 'yelp' | 'tripadvisor' | 'facebook' | 'internal';
  rating: number;
  reviewerName?: string;
  reviewText: string;
  reviewDate: Date;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  keyTopics?: string[];
  aiResponse?: string;
  aiResponseGeneratedAt?: Date;
  respondedAt?: Date;
  externalId?: string;
}

export interface SentimentAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number; // -1 to 1
  keyTopics: string[];
  emotionalTone: string;
  urgency: 'low' | 'medium' | 'high';
  suggestedPriority: number; // 1-5
}

export interface ReviewResponse {
  response: string;
  tone: string;
  includesApology: boolean;
  includesOffer: boolean;
  suggestedFollowUp?: string;
}

export interface ReviewInsights {
  period: string;
  totalReviews: number;
  averageRating: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topPositiveTopics: string[];
  topNegativeTopics: string[];
  trendingIssues: string[];
  responseRate: number;
  averageResponseTime: number;
}

export class ReviewAIService {
  private pool: Pool;
  private aiRouter: AIRouter;

  constructor(pool: Pool, aiRouter: AIRouter) {
    this.pool = pool;
    this.aiRouter = aiRouter;
  }

  /**
   * Analyze sentiment of a review
   */
  async analyzeSentiment(
    tenantId: string,
    reviewText: string,
    rating: number
  ): Promise<SentimentAnalysis> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a sentiment analysis expert for restaurant reviews. Analyze reviews to extract:
- Overall sentiment (positive/neutral/negative)
- Sentiment score (-1 to 1)
- Key topics mentioned (food quality, service, ambiance, price, cleanliness, etc.)
- Emotional tone (satisfied, disappointed, angry, grateful, etc.)
- Urgency level for response (low/medium/high)

Consider the star rating context: this review has ${rating}/5 stars.`
      },
      {
        role: 'user',
        content: `Analyze this review and return JSON:

"${reviewText}"

Return: {"sentiment": "positive|neutral|negative", "score": number, "keyTopics": [], "emotionalTone": "", "urgency": "low|medium|high", "suggestedPriority": 1-5}`
      }
    ];

    try {
      const response = await this.aiRouter.complete({
        messages,
        tenantId,
        requestType: 'review_sentiment',
        maxTokens: 200,
        temperature: 0.3
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          sentiment: analysis.sentiment || this.getSentimentFromRating(rating),
          score: analysis.score ?? (rating - 3) / 2,
          keyTopics: analysis.keyTopics || [],
          emotionalTone: analysis.emotionalTone || 'neutral',
          urgency: analysis.urgency || (rating <= 2 ? 'high' : 'low'),
          suggestedPriority: analysis.suggestedPriority || (6 - rating)
        };
      }
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
    }

    // Fallback to rating-based sentiment
    return {
      sentiment: this.getSentimentFromRating(rating),
      score: (rating - 3) / 2,
      keyTopics: [],
      emotionalTone: rating >= 4 ? 'satisfied' : rating <= 2 ? 'disappointed' : 'neutral',
      urgency: rating <= 2 ? 'high' : 'low',
      suggestedPriority: 6 - rating
    };
  }

  /**
   * Generate AI response to a review
   */
  async generateResponse(
    tenantId: string,
    review: Review,
    options: {
      tone?: 'professional' | 'friendly' | 'apologetic' | 'thankful';
      maxLength?: number;
      includeOffer?: boolean;
      customInstructions?: string;
    } = {}
  ): Promise<ReviewResponse> {
    const {
      tone = review.rating >= 4 ? 'thankful' : review.rating <= 2 ? 'apologetic' : 'professional',
      maxLength = 200,
      includeOffer = review.rating <= 2,
      customInstructions
    } = options;

    // Get business context
    const tenantInfo = await this.getTenantContext(tenantId);

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPTS.reviewResponse}

Business: ${tenantInfo.businessName}
Tone: ${tone}
${includeOffer ? 'Include a gesture of goodwill (discount, free item, etc.) for negative reviews.' : ''}
${customInstructions ? `Additional instructions: ${customInstructions}` : ''}

Keep response under ${maxLength} characters. Be genuine and address specific points from the review.`
      },
      {
        role: 'user',
        content: `Generate a response to this ${review.rating}-star review from ${review.reviewerName || 'a customer'}:

"${review.reviewText}"

${review.keyTopics?.length ? `Key topics: ${review.keyTopics.join(', ')}` : ''}`
      }
    ];

    const response = await this.aiRouter.complete({
      messages,
      tenantId,
      requestType: 'review_response',
      maxTokens: Math.ceil(maxLength / 3),
      temperature: 0.7
    });

    const responseText = response.content.trim();

    return {
      response: responseText,
      tone,
      includesApology: responseText.toLowerCase().includes('sorry') ||
                       responseText.toLowerCase().includes('apologize'),
      includesOffer: responseText.toLowerCase().includes('discount') ||
                     responseText.toLowerCase().includes('complimentary') ||
                     responseText.toLowerCase().includes('free'),
      suggestedFollowUp: review.rating <= 2
        ? 'Consider following up with the customer directly'
        : undefined
    };
  }

  /**
   * Save review with AI analysis
   */
  async saveReview(
    review: Omit<Review, 'id' | 'sentiment' | 'sentimentScore' | 'keyTopics'>
  ): Promise<Review> {
    // Analyze sentiment
    const analysis = await this.analyzeSentiment(
      review.tenantId,
      review.reviewText,
      review.rating
    );

    const query = `
      INSERT INTO reviews (
        tenant_id, location_id, source, rating, reviewer_name,
        review_text, review_date, sentiment, sentiment_score,
        key_topics, external_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      review.tenantId,
      review.locationId,
      review.source,
      review.rating,
      review.reviewerName,
      review.reviewText,
      review.reviewDate || new Date(),
      analysis.sentiment,
      analysis.score,
      JSON.stringify(analysis.keyTopics),
      review.externalId
    ]);

    return this.mapRowToReview(result.rows[0]);
  }

  /**
   * Get review by ID
   */
  async getReview(tenantId: string, reviewId: string): Promise<Review | null> {
    const result = await this.pool.query(
      'SELECT * FROM reviews WHERE id = $1 AND tenant_id = $2',
      [reviewId, tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToReview(result.rows[0]);
  }

  /**
   * Save AI-generated response
   */
  async saveAIResponse(
    tenantId: string,
    reviewId: string,
    response: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE reviews
       SET ai_response = $1, ai_response_generated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [response, reviewId, tenantId]
    );
  }

  /**
   * Get review insights for a time period
   */
  async getInsights(
    tenantId: string,
    locationId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ReviewInsights> {
    const params: (string | Date)[] = [tenantId];
    let paramIndex = 2;

    let locationFilter = '';
    if (locationId) {
      locationFilter = `AND location_id = $${paramIndex}`;
      params.push(locationId);
      paramIndex++;
    }

    let dateFilter = '';
    if (startDate) {
      dateFilter += ` AND review_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      dateFilter += ` AND review_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT
        COUNT(*) as total_reviews,
        AVG(rating) as avg_rating,
        COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_count,
        COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral_count,
        COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_count,
        COUNT(*) FILTER (WHERE ai_response IS NOT NULL) as responded_count,
        AVG(EXTRACT(EPOCH FROM (responded_at - created_at))) FILTER (WHERE responded_at IS NOT NULL) as avg_response_time
      FROM reviews
      WHERE tenant_id = $1 ${locationFilter} ${dateFilter}
    `;

    const result = await this.pool.query(query, params);
    const stats = result.rows[0];

    // Get top topics
    const topicsQuery = `
      SELECT key_topics, sentiment
      FROM reviews
      WHERE tenant_id = $1 ${locationFilter} ${dateFilter}
        AND key_topics IS NOT NULL
    `;

    const topicsResult = await this.pool.query(topicsQuery, params.slice(0, paramIndex - 1));

    const positiveTopics: Map<string, number> = new Map();
    const negativeTopics: Map<string, number> = new Map();

    for (const row of topicsResult.rows) {
      const topics = typeof row.key_topics === 'string'
        ? JSON.parse(row.key_topics)
        : row.key_topics;

      const targetMap = row.sentiment === 'negative' ? negativeTopics : positiveTopics;
      for (const topic of topics || []) {
        targetMap.set(topic, (targetMap.get(topic) || 0) + 1);
      }
    }

    const sortByCount = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic);

    return {
      period: `${startDate?.toISOString().split('T')[0] || 'all'} to ${endDate?.toISOString().split('T')[0] || 'now'}`,
      totalReviews: parseInt(stats.total_reviews) || 0,
      averageRating: parseFloat(stats.avg_rating) || 0,
      sentimentBreakdown: {
        positive: parseInt(stats.positive_count) || 0,
        neutral: parseInt(stats.neutral_count) || 0,
        negative: parseInt(stats.negative_count) || 0
      },
      topPositiveTopics: sortByCount(positiveTopics),
      topNegativeTopics: sortByCount(negativeTopics),
      trendingIssues: sortByCount(negativeTopics).slice(0, 3),
      responseRate: stats.total_reviews > 0
        ? (parseInt(stats.responded_count) / parseInt(stats.total_reviews)) * 100
        : 0,
      averageResponseTime: parseFloat(stats.avg_response_time) || 0
    };
  }

  /**
   * Get tenant business context for personalized responses
   */
  private async getTenantContext(tenantId: string): Promise<{ businessName: string }> {
    const result = await this.pool.query(
      'SELECT business_name FROM tenants WHERE id = $1',
      [tenantId]
    );

    return {
      businessName: result.rows[0]?.business_name || 'Our Restaurant'
    };
  }

  /**
   * Helper: Get sentiment from rating
   */
  private getSentimentFromRating(rating: number): 'positive' | 'neutral' | 'negative' {
    if (rating >= 4) return 'positive';
    if (rating <= 2) return 'negative';
    return 'neutral';
  }

  /**
   * Helper: Map database row to Review object
   */
  private mapRowToReview(row: Record<string, unknown>): Review {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      locationId: row.location_id as string,
      source: row.source as Review['source'],
      rating: row.rating as number,
      reviewerName: row.reviewer_name as string | undefined,
      reviewText: row.review_text as string,
      reviewDate: new Date(row.review_date as string),
      sentiment: row.sentiment as Review['sentiment'],
      sentimentScore: row.sentiment_score as number | undefined,
      keyTopics: typeof row.key_topics === 'string'
        ? JSON.parse(row.key_topics)
        : row.key_topics as string[] | undefined,
      aiResponse: row.ai_response as string | undefined,
      aiResponseGeneratedAt: row.ai_response_generated_at
        ? new Date(row.ai_response_generated_at as string)
        : undefined,
      respondedAt: row.responded_at
        ? new Date(row.responded_at as string)
        : undefined,
      externalId: row.external_id as string | undefined
    };
  }
}
