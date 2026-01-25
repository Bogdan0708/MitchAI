/**
 * Review Response Service
 *
 * Generates AI-powered responses to customer reviews using
 * templates, tone customization, and contextual awareness.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { AggregatedReview, ReviewAggregatorService } from './review-aggregator.service';

// Types
export interface ResponseTemplate {
  id: string;
  tenantId: string;
  name: string;
  category: 'positive' | 'negative' | 'neutral' | 'complaint_food' | 'complaint_service' | 'apology' | 'thank_you';
  templateText: string;
  variables: TemplateVariable[];
  tone: 'professional' | 'friendly' | 'apologetic' | 'enthusiastic';
  language: string;
  useCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  required: boolean;
  defaultValue?: string;
}

export interface CreateTemplateDTO {
  name: string;
  category: ResponseTemplate['category'];
  templateText: string;
  variables?: TemplateVariable[];
  tone?: ResponseTemplate['tone'];
  language?: string;
}

export interface UpdateTemplateDTO {
  name?: string;
  category?: ResponseTemplate['category'];
  templateText?: string;
  variables?: TemplateVariable[];
  tone?: ResponseTemplate['tone'];
  language?: string;
  isActive?: boolean;
}

export interface GenerateResponseParams {
  reviewId: string;
  templateId?: string;
  tone?: ResponseTemplate['tone'];
  includePromotion?: boolean;
  promotionText?: string;
  managerName?: string;
  customInstructions?: string;
}

export interface GeneratedResponse {
  text: string;
  templateUsed?: string;
  tone: ResponseTemplate['tone'];
  aiGenerated: boolean;
  suggestedTweaks?: string[];
}

// Default response templates
const DEFAULT_TEMPLATES: Omit<ResponseTemplate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'useCount'>[] = [
  {
    name: 'Positive Review - Thank You',
    category: 'positive',
    templateText: `Thank you so much for your wonderful review, {{customer_name}}! We're thrilled to hear you enjoyed {{highlight}}. Your kind words mean a lot to our team, and we can't wait to welcome you back soon!

Best regards,
{{manager_name}}`,
    variables: [
      { name: 'customer_name', required: false, defaultValue: 'valued guest' },
      { name: 'highlight', required: false, defaultValue: 'your experience with us' },
      { name: 'manager_name', required: false, defaultValue: 'The Management Team' },
    ],
    tone: 'enthusiastic',
    language: 'en',
    isActive: true,
  },
  {
    name: 'Negative Review - Apology',
    category: 'negative',
    templateText: `Dear {{customer_name}},

Thank you for taking the time to share your feedback. We sincerely apologize that your experience did not meet your expectations. {{specific_issue_acknowledgment}}

We take all feedback seriously and have shared your concerns with our team. We would love the opportunity to make things right. Please contact us at {{contact_info}} so we can personally address your concerns.

Sincerely,
{{manager_name}}`,
    variables: [
      { name: 'customer_name', required: false, defaultValue: 'valued guest' },
      { name: 'specific_issue_acknowledgment', required: false, defaultValue: 'We understand how disappointing this must have been.' },
      { name: 'contact_info', required: false, defaultValue: 'our management team' },
      { name: 'manager_name', required: false, defaultValue: 'The Management Team' },
    ],
    tone: 'apologetic',
    language: 'en',
    isActive: true,
  },
  {
    name: 'Food Complaint Response',
    category: 'complaint_food',
    templateText: `Dear {{customer_name}},

Thank you for bringing this to our attention. We're genuinely sorry to hear about your experience with {{food_item}}. Food quality is our top priority, and this clearly fell short of our standards.

We've immediately shared your feedback with our kitchen team to investigate and prevent this from happening again. We would like to offer {{compensation}} as a gesture of our commitment to making this right.

Please don't hesitate to reach out to us directly at {{contact_info}}.

With apologies,
{{manager_name}}`,
    variables: [
      { name: 'customer_name', required: false, defaultValue: 'valued guest' },
      { name: 'food_item', required: false, defaultValue: 'your meal' },
      { name: 'compensation', required: false, defaultValue: 'a complimentary meal on your next visit' },
      { name: 'contact_info', required: false, defaultValue: 'our team' },
      { name: 'manager_name', required: false, defaultValue: 'The Management Team' },
    ],
    tone: 'apologetic',
    language: 'en',
    isActive: true,
  },
  {
    name: 'Service Complaint Response',
    category: 'complaint_service',
    templateText: `Dear {{customer_name}},

I'm truly sorry to hear about the service issues you experienced during your visit. This is not the standard we hold ourselves to, and I apologize for any frustration this caused.

We've addressed this feedback directly with our team to ensure every guest receives the attentive, friendly service they deserve. We'd be honored if you'd give us another chance to show you the experience we're known for.

Please reach out to us at {{contact_info}} - we'd love to personally welcome you back.

Sincerely,
{{manager_name}}`,
    variables: [
      { name: 'customer_name', required: false, defaultValue: 'valued guest' },
      { name: 'contact_info', required: false, defaultValue: 'our team' },
      { name: 'manager_name', required: false, defaultValue: 'The Management Team' },
    ],
    tone: 'apologetic',
    language: 'en',
    isActive: true,
  },
  {
    name: 'Neutral Review Response',
    category: 'neutral',
    templateText: `Hi {{customer_name}},

Thank you for dining with us and sharing your feedback. We're glad to hear {{positive_aspect}}, and we appreciate your honest observations about {{improvement_area}}.

We're always working to improve, and feedback like yours helps us do just that. We hope to welcome you back soon and exceed your expectations.

Best regards,
{{manager_name}}`,
    variables: [
      { name: 'customer_name', required: false, defaultValue: 'there' },
      { name: 'positive_aspect', required: false, defaultValue: 'you enjoyed your visit' },
      { name: 'improvement_area', required: false, defaultValue: 'areas where we can do better' },
      { name: 'manager_name', required: false, defaultValue: 'The Management Team' },
    ],
    tone: 'professional',
    language: 'en',
    isActive: true,
  },
];

export class ReviewResponseService {
  private reviewAggregator: ReviewAggregatorService;

  constructor(private pool: Pool) {
    this.reviewAggregator = new ReviewAggregatorService(pool);
  }

  /**
   * Get response templates
   */
  public async getTemplates(
    tenantId: string,
    category?: ResponseTemplate['category']
  ): Promise<ResponseTemplate[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let query = `
        SELECT id, tenant_id as "tenantId", name, category, template_text as "templateText",
               variables, tone, language, use_count as "useCount", is_active as "isActive",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM review_response_templates
        WHERE tenant_id = $1 AND deleted_at IS NULL`;

      const params: unknown[] = [tenantId];

      if (category) {
        query += ' AND category = $2';
        params.push(category);
      }

      query += ' ORDER BY use_count DESC, name';

      const result = await client.query(query, params);
      return result.rows;
    });
  }

  /**
   * Get a specific template
   */
  public async getTemplateById(
    tenantId: string,
    templateId: string
  ): Promise<ResponseTemplate | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", name, category, template_text as "templateText",
                variables, tone, language, use_count as "useCount", is_active as "isActive",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM review_response_templates
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, templateId]
      );
      return result.rows[0] || null;
    });
  }

  /**
   * Create a response template
   */
  public async createTemplate(
    tenantId: string,
    data: CreateTemplateDTO
  ): Promise<ResponseTemplate> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO review_response_templates
         (tenant_id, name, category, template_text, variables, tone, language)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, tenant_id as "tenantId", name, category, template_text as "templateText",
                   variables, tone, language, use_count as "useCount", is_active as "isActive",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [
          tenantId,
          data.name,
          data.category,
          data.templateText,
          JSON.stringify(data.variables || []),
          data.tone || 'professional',
          data.language || 'en',
        ]
      );

      logger.info('Response template created', {
        tenantId,
        templateId: result.rows[0].id,
        category: data.category,
      });

      return result.rows[0];
    });
  }

  /**
   * Update a response template
   */
  public async updateTemplate(
    tenantId: string,
    templateId: string,
    data: UpdateTemplateDTO
  ): Promise<ResponseTemplate | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        name: 'name',
        category: 'category',
        templateText: 'template_text',
        tone: 'tone',
        language: 'language',
        isActive: 'is_active',
      };

      for (const [key, column] of Object.entries(fieldMap)) {
        if (data[key as keyof UpdateTemplateDTO] !== undefined) {
          setClauses.push(`${column} = $${paramIndex++}`);
          values.push(data[key as keyof UpdateTemplateDTO]);
        }
      }

      if (data.variables !== undefined) {
        setClauses.push(`variables = $${paramIndex++}`);
        values.push(JSON.stringify(data.variables));
      }

      if (setClauses.length === 0) {
        return this.getTemplateById(tenantId, templateId);
      }

      setClauses.push('updated_at = NOW()');
      values.push(tenantId, templateId);

      const result = await client.query(
        `UPDATE review_response_templates
         SET ${setClauses.join(', ')}
         WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1} AND deleted_at IS NULL
         RETURNING id, tenant_id as "tenantId", name, category, template_text as "templateText",
                   variables, tone, language, use_count as "useCount", is_active as "isActive",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        values
      );

      return result.rows[0] || null;
    });
  }

  /**
   * Delete a response template (soft delete)
   */
  public async deleteTemplate(tenantId: string, templateId: string): Promise<boolean> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE review_response_templates
         SET deleted_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, templateId]
      );
      return (result.rowCount || 0) > 0;
    });
  }

  /**
   * Initialize default templates for a tenant
   */
  public async initializeDefaultTemplates(tenantId: string): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Check if templates already exist
      const existing = await client.query(
        `SELECT COUNT(*) as count FROM review_response_templates WHERE tenant_id = $1`,
        [tenantId]
      );

      if (parseInt(existing.rows[0].count, 10) > 0) {
        return; // Templates already initialized
      }

      // Insert default templates
      for (const template of DEFAULT_TEMPLATES) {
        await client.query(
          `INSERT INTO review_response_templates
           (tenant_id, name, category, template_text, variables, tone, language, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            tenantId,
            template.name,
            template.category,
            template.templateText,
            JSON.stringify(template.variables),
            template.tone,
            template.language,
            template.isActive,
          ]
        );
      }

      logger.info('Default response templates initialized', { tenantId });
    });
  }

  /**
   * Generate a response for a review
   */
  public async generateResponse(
    tenantId: string,
    params: GenerateResponseParams
  ): Promise<GeneratedResponse> {
    const review = await this.reviewAggregator.getReviewById(tenantId, params.reviewId);

    if (!review) {
      throw new Error(`Review not found: ${params.reviewId}`);
    }

    // Determine response category based on review sentiment
    let category: ResponseTemplate['category'] = 'neutral';
    if (review.sentimentLabel === 'positive') {
      category = 'positive';
    } else if (review.sentimentLabel === 'negative') {
      // Check for specific complaint types
      if (review.topics?.some((t) => ['food quality', 'food'].includes(t.toLowerCase()))) {
        category = 'complaint_food';
      } else if (review.topics?.some((t) => ['service'].includes(t.toLowerCase()))) {
        category = 'complaint_service';
      } else {
        category = 'negative';
      }
    }

    // Get template (specified or best match for category)
    let template: ResponseTemplate | null = null;

    if (params.templateId) {
      template = await this.getTemplateById(tenantId, params.templateId);
    }

    if (!template) {
      const templates = await this.getTemplates(tenantId, category);
      template = templates.find((t) => t.isActive) || null;
    }

    let responseText: string;
    let aiGenerated = false;

    if (template) {
      // Use template with variable substitution
      responseText = this.applyTemplate(template, review, params);

      // Increment use count
      await runInTenantContext(this.pool, tenantId, async (client) => {
        await client.query(
          `UPDATE review_response_templates SET use_count = use_count + 1, updated_at = NOW() WHERE id = $1`,
          [template!.id]
        );
      });
    } else {
      // Generate AI response (in production, this would call AI provider)
      responseText = this.generateAIResponse(review, params);
      aiGenerated = true;
    }

    // Add promotion if requested
    if (params.includePromotion && params.promotionText) {
      responseText += `\n\n${params.promotionText}`;
    }

    // Save suggested response
    await this.reviewAggregator.saveAiSuggestedResponse(tenantId, params.reviewId, responseText);

    const suggestedTweaks = this.suggestTweaks(review, responseText);

    return {
      text: responseText,
      templateUsed: template?.name,
      tone: params.tone || template?.tone || 'professional',
      aiGenerated,
      suggestedTweaks,
    };
  }

  /**
   * Apply template with variable substitution
   */
  private applyTemplate(
    template: ResponseTemplate,
    review: AggregatedReview,
    params: GenerateResponseParams
  ): string {
    let text = template.templateText;

    // Build variable values
    const variableValues: Record<string, string> = {
      customer_name: review.reviewerName || 'valued guest',
      manager_name: params.managerName || 'The Management Team',
    };

    // Extract highlight from positive aspects
    if (review.sentimentAspects) {
      const positiveAspect = review.sentimentAspects.find((a) => a.sentiment > 0.3);
      if (positiveAspect) {
        variableValues.highlight = `your experience with our ${positiveAspect.aspect.replace('_', ' ')}`;
        variableValues.positive_aspect = `you appreciated our ${positiveAspect.aspect.replace('_', ' ')}`;
      }
    }

    // Extract food item from review if mentioned
    if (review.keywords) {
      const foodKeywords = ['chicken', 'steak', 'fish', 'pasta', 'pizza', 'burger', 'salad', 'dessert'];
      const mentionedFood = review.keywords.find((k) => foodKeywords.some((f) => k.toLowerCase().includes(f)));
      if (mentionedFood) {
        variableValues.food_item = mentionedFood;
      }
    }

    // Extract improvement area for neutral/negative reviews
    if (review.sentimentAspects) {
      const negativeAspect = review.sentimentAspects.find((a) => a.sentiment < -0.3);
      if (negativeAspect) {
        variableValues.improvement_area = negativeAspect.aspect.replace('_', ' ');
        variableValues.specific_issue_acknowledgment = `We understand your concerns about our ${negativeAspect.aspect.replace('_', ' ')}.`;
      }
    }

    // Apply template variables
    for (const variable of template.variables) {
      const value = variableValues[variable.name] || variable.defaultValue || '';
      text = text.replace(new RegExp(`{{${variable.name}}}`, 'g'), value);
    }

    return text;
  }

  /**
   * Generate AI response when no template matches
   * In production, this would call the AI provider system
   */
  private generateAIResponse(
    review: AggregatedReview,
    params: GenerateResponseParams
  ): string {
    // Placeholder for AI generation
    // Would call AIRouter.route('review_response', {...}) in production

    const customerName = review.reviewerName || 'valued guest';
    const managerName = params.managerName || 'The Management Team';

    if (review.sentimentLabel === 'positive') {
      return `Thank you so much for your wonderful review, ${customerName}! We're delighted to hear you had a great experience with us. Your kind words motivate our team to continue delivering the best service possible. We look forward to welcoming you back soon!\n\nWarm regards,\n${managerName}`;
    } else if (review.sentimentLabel === 'negative') {
      return `Dear ${customerName},\n\nThank you for taking the time to share your feedback with us. We're truly sorry to hear that your experience didn't meet your expectations. Your feedback is invaluable, and we take it very seriously.\n\nWe would love the opportunity to make things right. Please reach out to us directly so we can address your concerns personally.\n\nSincerely,\n${managerName}`;
    } else {
      return `Hi ${customerName},\n\nThank you for visiting us and sharing your thoughts. We appreciate your honest feedback and are always looking for ways to improve. We hope to see you again soon and provide you with an even better experience.\n\nBest regards,\n${managerName}`;
    }
  }

  /**
   * Suggest tweaks to improve the response
   */
  private suggestTweaks(review: AggregatedReview, responseText: string): string[] {
    const tweaks: string[] = [];

    // Check if response acknowledges specific issues
    if (review.complianceFlags && review.complianceFlags.length > 0) {
      if (!responseText.toLowerCase().includes('investigate') && !responseText.toLowerCase().includes('look into')) {
        tweaks.push('Consider mentioning that you will investigate the specific issue raised');
      }
    }

    // Check if response is appropriate length
    if (responseText.length < 100) {
      tweaks.push('Response might be too brief - consider adding more personalization');
    }
    if (responseText.length > 800) {
      tweaks.push('Response might be too long - consider being more concise');
    }

    // Check for personalization
    if (!review.reviewerName && responseText.includes(review.reviewerName || '')) {
      tweaks.push('Response uses generic greeting - consider using reviewer name if available');
    }

    // Check for call to action
    if (!responseText.toLowerCase().includes('contact') && !responseText.toLowerCase().includes('reach out') && !responseText.toLowerCase().includes('visit')) {
      tweaks.push('Consider adding a call-to-action (invite to return, contact info, etc.)');
    }

    return tweaks;
  }

  /**
   * Submit response to a review
   */
  public async submitResponse(
    tenantId: string,
    reviewId: string,
    userId: string,
    responseText: string,
    aiResponseUsed: boolean
  ): Promise<AggregatedReview | null> {
    // In production, this would also publish the response to the platform
    // via the platform's API (Google Business Profile, TripAdvisor, etc.)

    const review = await this.reviewAggregator.saveResponse(
      tenantId,
      reviewId,
      userId,
      responseText,
      aiResponseUsed
    );

    if (review) {
      logger.info('Review response submitted', {
        tenantId,
        reviewId,
        userId,
        aiResponseUsed,
        platform: review.platform,
      });
    }

    return review;
  }
}
