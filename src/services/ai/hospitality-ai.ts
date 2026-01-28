/**
 * Hospitality AI Service
 * 
 * High-level AI functions tailored for hospitality use cases.
 * Wraps the orchestrator with domain-specific prompts and logic.
 */

import { getAIOrchestrator, AIResponse, AITaskType, AIProvider } from './orchestrator';

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewResponseRequest {
  tenantId: string;
  walletAddress?: string;
  review: {
    platform: string;        // google, tripadvisor, etc.
    rating: number;          // 1-5
    text: string;
    customerName?: string;
    date?: string;
  };
  businessContext: {
    name: string;
    type: string;            // restaurant, hotel, bar
    tone?: 'professional' | 'friendly' | 'casual';
    language?: string;
  };
  preferredProvider?: AIProvider;
}

export interface MenuDescriptionRequest {
  tenantId: string;
  walletAddress?: string;
  item: {
    name: string;
    category?: string;
    ingredients?: string[];
    allergens?: string[];
    price?: number;
    isVegetarian?: boolean;
    isVegan?: boolean;
    isGlutenFree?: boolean;
  };
  style: 'elegant' | 'casual' | 'fun' | 'descriptive';
  language?: string;
  maxLength?: number;
}

export interface ContentGenerationRequest {
  tenantId: string;
  walletAddress?: string;
  type: 'social_post' | 'email' | 'promo' | 'announcement';
  topic: string;
  context?: string;
  tone?: 'professional' | 'friendly' | 'exciting' | 'informative';
  platform?: string;  // instagram, facebook, email, etc.
  language?: string;
  maxLength?: number;
}

export interface SentimentAnalysisRequest {
  tenantId: string;
  walletAddress?: string;
  texts: string[];
}

export interface SentimentResult {
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;  // -1 to 1
  keywords: string[];
}

export interface TranslationRequest {
  tenantId: string;
  walletAddress?: string;
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  context?: string;  // hospitality, menu, formal, casual
}

// ============================================================================
// HOSPITALITY AI SERVICE
// ============================================================================

export class HospitalityAI {
  private orchestrator = getAIOrchestrator();

  // --------------------------------------------------------------------------
  // REVIEW RESPONSES
  // --------------------------------------------------------------------------

  /**
   * Generate a professional response to a customer review
   */
  async generateReviewResponse(request: ReviewResponseRequest): Promise<AIResponse> {
    const { review, businessContext } = request;
    
    const systemPrompt = `You are a hospitality professional responding to customer reviews for ${businessContext.name}, a ${businessContext.type}.

Guidelines:
- Tone: ${businessContext.tone || 'professional'}
- Language: ${businessContext.language || 'English'}
- Always thank the customer for their feedback
- Address specific points mentioned in the review
- For negative reviews: acknowledge concerns, apologize if appropriate, offer to make it right
- For positive reviews: express genuine gratitude, highlight what they enjoyed
- Keep responses concise but warm (2-3 paragraphs max)
- Never be defensive or argumentative
- Include the customer's name if provided
- End with an invitation to return`;

    const userPrompt = `Please write a response to this ${review.rating}-star review on ${review.platform}:

${review.customerName ? `Customer: ${review.customerName}` : ''}
${review.date ? `Date: ${review.date}` : ''}
Rating: ${'⭐'.repeat(review.rating)}

"${review.text}"`;

    return this.orchestrator.process({
      tenantId: request.tenantId,
      walletAddress: request.walletAddress,
      taskType: 'review_response',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      options: {
        preferredProvider: request.preferredProvider,
        maxTokens: 500,
        temperature: 0.7,
      },
    });
  }

  // --------------------------------------------------------------------------
  // MENU DESCRIPTIONS
  // --------------------------------------------------------------------------

  /**
   * Generate an appetizing menu item description
   */
  async generateMenuDescription(request: MenuDescriptionRequest): Promise<AIResponse> {
    const { item, style, language = 'English' } = request;

    const styleGuides: Record<string, string> = {
      elegant: 'sophisticated, refined, evocative of fine dining',
      casual: 'approachable, friendly, inviting',
      fun: 'playful, energetic, memorable with personality',
      descriptive: 'detailed, informative, focusing on flavors and textures',
    };

    const systemPrompt = `You are a culinary copywriter creating menu descriptions.

Style: ${styleGuides[style] || styleGuides.descriptive}
Language: ${language}

Guidelines:
- Make it appetizing and evocative
- Mention key ingredients naturally
- Highlight dietary attributes (vegetarian, vegan, GF) subtly if applicable
- Keep it concise (${request.maxLength || 50}-${(request.maxLength || 50) + 30} words)
- Avoid clichés like "mouthwatering" or "delicious"
- Focus on textures, preparation methods, and flavor profiles`;

    const dietaryInfo = [
      item.isVegetarian && 'Vegetarian',
      item.isVegan && 'Vegan',
      item.isGlutenFree && 'Gluten-Free',
    ].filter(Boolean).join(', ');

    const userPrompt = `Write a menu description for:

Dish: ${item.name}
${item.category ? `Category: ${item.category}` : ''}
${item.ingredients?.length ? `Key Ingredients: ${item.ingredients.join(', ')}` : ''}
${item.allergens?.length ? `Contains: ${item.allergens.join(', ')}` : ''}
${dietaryInfo ? `Dietary: ${dietaryInfo}` : ''}
${item.price ? `Price: £${item.price.toFixed(2)}` : ''}`;

    return this.orchestrator.process({
      tenantId: request.tenantId,
      walletAddress: request.walletAddress,
      taskType: 'menu_description',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      options: {
        maxTokens: 200,
        temperature: 0.8,
      },
    });
  }

  // --------------------------------------------------------------------------
  // CONTENT GENERATION
  // --------------------------------------------------------------------------

  /**
   * Generate marketing content (social posts, emails, promos)
   */
  async generateContent(request: ContentGenerationRequest): Promise<AIResponse> {
    const { type, topic, tone = 'friendly', platform, language = 'English' } = request;

    const typeGuides: Record<string, string> = {
      social_post: 'engaging social media post with appropriate hashtags',
      email: 'professional email with clear subject line suggestion',
      promo: 'promotional content highlighting value and urgency',
      announcement: 'informative announcement with clear messaging',
    };

    const platformGuides: Record<string, string> = {
      instagram: 'visual-focused, use emojis, max 2200 chars, suggest hashtags',
      facebook: 'conversational, can be longer, encourage engagement',
      twitter: 'concise, punchy, max 280 chars',
      email: 'professional, include subject line, clear CTA',
      whatsapp: 'brief, personal, direct',
    };

    const systemPrompt = `You are a hospitality marketing specialist creating ${typeGuides[type] || 'marketing content'}.

Tone: ${tone}
Language: ${language}
${platform ? `Platform: ${platformGuides[platform] || platform}` : ''}

Guidelines:
- Be authentic and on-brand
- Include a clear call-to-action
- ${type === 'social_post' ? 'Include relevant hashtags' : ''}
- ${type === 'email' ? 'Start with a compelling subject line' : ''}
- Keep within appropriate length for the format
- Make it memorable and shareable`;

    const userPrompt = `Create ${type.replace('_', ' ')} about:

Topic: ${topic}
${request.context ? `Context: ${request.context}` : ''}
${request.maxLength ? `Max length: ${request.maxLength} characters` : ''}`;

    return this.orchestrator.process({
      tenantId: request.tenantId,
      walletAddress: request.walletAddress,
      taskType: 'content',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      options: {
        maxTokens: 500,
        temperature: 0.8,
      },
    });
  }

  // --------------------------------------------------------------------------
  // SENTIMENT ANALYSIS
  // --------------------------------------------------------------------------

  /**
   * Analyze sentiment of customer feedback
   */
  async analyzeSentiment(request: SentimentAnalysisRequest): Promise<{
    success: boolean;
    results?: SentimentResult[];
    error?: string;
  }> {
    const systemPrompt = `You are a sentiment analysis expert for hospitality businesses.

Analyze each text and return a JSON array with:
- sentiment: "positive", "neutral", or "negative"
- score: number from -1 (very negative) to 1 (very positive)
- keywords: array of key phrases that influenced the sentiment

Return ONLY valid JSON, no markdown or explanation.`;

    const userPrompt = `Analyze sentiment for these texts:

${request.texts.map((t, i) => `${i + 1}. "${t}"`).join('\n\n')}

Return as JSON array matching the order.`;

    const response = await this.orchestrator.process({
      tenantId: request.tenantId,
      walletAddress: request.walletAddress,
      taskType: 'sentiment',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      options: {
        maxTokens: 1000,
        temperature: 0.3,
      },
    });

    if (!response.success || !response.content) {
      return { success: false, error: response.error };
    }

    try {
      // Parse JSON response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const results: SentimentResult[] = request.texts.map((text, i) => ({
        text,
        sentiment: parsed[i]?.sentiment || 'neutral',
        score: parsed[i]?.score || 0,
        keywords: parsed[i]?.keywords || [],
      }));

      return { success: true, results };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to parse sentiment response: ${error}` 
      };
    }
  }

  // --------------------------------------------------------------------------
  // TRANSLATION
  // --------------------------------------------------------------------------

  /**
   * Translate content with hospitality context
   */
  async translate(request: TranslationRequest): Promise<AIResponse> {
    const systemPrompt = `You are a professional translator specializing in hospitality content.

Target Language: ${request.targetLanguage}
${request.sourceLanguage ? `Source Language: ${request.sourceLanguage}` : 'Detect source language automatically'}
${request.context ? `Context: ${request.context}` : ''}

Guidelines:
- Maintain the tone and style of the original
- Use appropriate hospitality terminology
- Adapt cultural references where necessary
- Preserve formatting (line breaks, punctuation)
- Return ONLY the translation, no explanations`;

    return this.orchestrator.process({
      tenantId: request.tenantId,
      walletAddress: request.walletAddress,
      taskType: 'translation',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Translate:\n\n${request.text}` },
      ],
      options: {
        maxTokens: 2000,
        temperature: 0.3,
      },
    });
  }

  // --------------------------------------------------------------------------
  // GENERAL CHAT
  // --------------------------------------------------------------------------

  /**
   * General hospitality assistant chat
   */
  async chat(
    tenantId: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    options?: {
      walletAddress?: string;
      businessContext?: string;
      preferredProvider?: AIProvider;
    }
  ): Promise<AIResponse> {
    const systemPrompt = `You are a helpful AI assistant for a hospitality business.
${options?.businessContext ? `Business context: ${options.businessContext}` : ''}

You can help with:
- Answering customer questions
- Providing recommendations
- Handling inquiries about services, hours, and policies
- General hospitality-related assistance

Be friendly, professional, and helpful.`;

    return this.orchestrator.process({
      tenantId,
      walletAddress: options?.walletAddress,
      taskType: 'chat',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      options: {
        preferredProvider: options?.preferredProvider,
        maxTokens: 1000,
        temperature: 0.7,
      },
    });
  }

  // --------------------------------------------------------------------------
  // UTILITY
  // --------------------------------------------------------------------------

  /**
   * Get orchestrator health status
   */
  async healthCheck() {
    return this.orchestrator.healthCheck();
  }

  /**
   * Get available models for a task
   */
  getAvailableModels(taskType?: AITaskType) {
    return this.orchestrator.getAvailableModels(taskType);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let hospitalityAIInstance: HospitalityAI | null = null;

export function getHospitalityAI(): HospitalityAI {
  if (!hospitalityAIInstance) {
    hospitalityAIInstance = new HospitalityAI();
  }
  return hospitalityAIInstance;
}

export default HospitalityAI;
