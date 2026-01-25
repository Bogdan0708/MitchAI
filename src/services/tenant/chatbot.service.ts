/**
 * Chatbot Service
 *
 * AI-powered guest communication for hospitality businesses
 * Features:
 * - Multi-channel support (web, WhatsApp, voice)
 * - Context-aware responses using menu and business data
 * - Conversation history management
 * - Sentiment analysis
 * - Reservation and order handling
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AIRouter, AIMessage, AIProvider, SYSTEM_PROMPTS } from './ai';
import { runInTenantContext } from '../../lib/db-context';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  sessionId: string;
  tenantId: string;
  channel: 'web' | 'whatsapp' | 'voice' | 'sms';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  language: string;
  status: 'active' | 'closed' | 'escalated';
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  tenantId: string;
  sessionId: string;
  message: string;
  channel?: 'web' | 'whatsapp' | 'voice' | 'sms';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  language?: string;
  preferredProvider?: AIProvider;
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  provider: AIProvider;
  responseTimeMs: number;
  suggestedActions?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export class ChatbotService {
  private aiRouter: AIRouter;
  private pool: Pool;
  private redis: Redis;
  private conversationTTL = 24 * 60 * 60; // 24 hours in Redis

  constructor(aiRouter: AIRouter, pool: Pool, redis: Redis) {
    this.aiRouter = aiRouter;
    this.pool = pool;
    this.redis = redis;
  }

  /**
   * Process an incoming chat message
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    // Get or create conversation
    const conversation = await this.getOrCreateConversation(request);

    // Build context with business data
    const context = await this.buildContext(request.tenantId);

    // Get conversation history
    const history = await this.getConversationHistory(conversation.id, request.tenantId);

    // Build messages for AI
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(context, request.language || 'en')
      },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      })),
      {
        role: 'user',
        content: request.message
      }
    ];

    // Get AI response
    const aiResponse = await this.aiRouter.complete(
      {
        messages,
        tenantId: request.tenantId,
        requestType: 'chat',
        maxTokens: 500,
        temperature: 0.7
      },
      request.preferredProvider
    );

    // Save messages
    await this.saveMessage(conversation.id, request.tenantId, 'user', request.message);
    await this.saveMessage(
      conversation.id,
      request.tenantId,
      'assistant',
      aiResponse.content,
      aiResponse.provider,
      aiResponse.model,
      aiResponse.usage.totalTokens,
      aiResponse.responseTimeMs
    );

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(request.message);

    // Detect suggested actions
    const suggestedActions = this.detectSuggestedActions(aiResponse.content);

    // Update conversation sentiment
    await this.updateConversationSentiment(conversation.id, request.tenantId, sentiment);

    return {
      conversationId: conversation.id,
      message: aiResponse.content,
      provider: aiResponse.provider,
      responseTimeMs: Date.now() - startTime,
      suggestedActions,
      sentiment
    };
  }

  /**
   * Stream a chat response
   */
  async streamChat(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    const conversation = await this.getOrCreateConversation(request);
    const context = await this.buildContext(request.tenantId);
    const history = await this.getConversationHistory(conversation.id, request.tenantId);

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(context, request.language || 'en')
      },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      })),
      {
        role: 'user',
        content: request.message
      }
    ];

    // Save user message first
    await this.saveMessage(conversation.id, request.tenantId, 'user', request.message);

    // Stream AI response
    const aiResponse = await this.aiRouter.stream(
      {
        messages,
        tenantId: request.tenantId,
        requestType: 'chat',
        maxTokens: 500,
        temperature: 0.7
      },
      onChunk,
      request.preferredProvider
    );

    // Save assistant response
    await this.saveMessage(
      conversation.id,
      request.tenantId,
      'assistant',
      aiResponse.content,
      aiResponse.provider,
      aiResponse.model,
      aiResponse.usage.totalTokens,
      aiResponse.responseTimeMs
    );

    const sentiment = this.analyzeSentiment(request.message);
    const suggestedActions = this.detectSuggestedActions(aiResponse.content);

    return {
      conversationId: conversation.id,
      message: aiResponse.content,
      provider: aiResponse.provider,
      responseTimeMs: Date.now() - startTime,
      suggestedActions,
      sentiment
    };
  }

  /**
   * Get or create a conversation
   */
  private async getOrCreateConversation(request: ChatRequest): Promise<Conversation> {
    // Try to get from Redis first (fast path)
    const cacheKey = `conversation:${request.tenantId}:${request.sessionId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Try to get from database
    const result = await runInTenantContext(this.pool, request.tenantId, async (client) => {
      return client.query(
        `SELECT * FROM chat_conversations
         WHERE tenant_id = $1 AND session_id = $2 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [request.tenantId, request.sessionId]
      );
    });

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const conversation: Conversation = {
        id: row.id,
        sessionId: row.session_id,
        tenantId: row.tenant_id,
        channel: row.channel,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        language: row.language,
        status: row.status,
        messages: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      // Cache in Redis
      await this.redis.setex(cacheKey, this.conversationTTL, JSON.stringify(conversation));
      return conversation;
    }

    // Create new conversation
    const id = uuidv4();
    await runInTenantContext(this.pool, request.tenantId, async (client) => {
      return client.query(
        `INSERT INTO chat_conversations
         (id, tenant_id, session_id, channel, customer_name, customer_email, customer_phone, language, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')`,
        [
          id,
          request.tenantId,
          request.sessionId,
          request.channel || 'web',
          request.customerName,
          request.customerEmail,
          request.customerPhone,
          request.language || 'en'
        ]
      );
    });

    const conversation: Conversation = {
      id,
      sessionId: request.sessionId,
      tenantId: request.tenantId,
      channel: request.channel || 'web',
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      customerPhone: request.customerPhone,
      language: request.language || 'en',
      status: 'active',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.redis.setex(cacheKey, this.conversationTTL, JSON.stringify(conversation));
    return conversation;
  }

  /**
   * Get conversation history
   */
  private async getConversationHistory(conversationId: string, tenantId: string): Promise<ChatMessage[]> {
    const result = await runInTenantContext(this.pool, tenantId, async (client) => {
      return client.query(
        `SELECT id, role, content, created_at, metadata
         FROM chat_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC
         LIMIT 20`, // Limit to recent messages for context window
        [conversationId]
      );
    });

    return result.rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.created_at,
      metadata: row.metadata
    }));
  }

  /**
   * Save a message to the database
   */
  private async saveMessage(
    conversationId: string,
    tenantId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    aiProvider?: string,
    aiModel?: string,
    tokensUsed?: number,
    responseTimeMs?: number
  ): Promise<void> {
    await runInTenantContext(this.pool, tenantId, async (client) => {
      await client.query(
        `INSERT INTO chat_messages
         (id, tenant_id, conversation_id, role, content, ai_provider, ai_model, tokens_used, response_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidv4(),
          tenantId,
          conversationId,
          role,
          content,
          aiProvider,
          aiModel,
          tokensUsed,
          responseTimeMs
        ]
      );

      // Update conversation timestamp
      await client.query(
        `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`,
        [conversationId]
      );
    });
  }

  /**
   * Build context with business data
   */
  private async buildContext(tenantId: string): Promise<{
    businessName: string;
    menuItems: Array<{ name: string; description: string; price: number }>;
    locations: Array<{ name: string; address: string }>;
    openingHours?: string;
  }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Get tenant info
      const tenantResult = await client.query(
        `SELECT name, settings FROM tenants WHERE id = $1`,
        [tenantId]
      );

      const tenant = tenantResult.rows[0];

      // Get menu items
      const menuResult = await client.query(
        `SELECT name, description, price FROM menu_items
         WHERE tenant_id = $1 AND is_available = true
         LIMIT 50`,
        [tenantId]
      );

      // Get locations
      const locationResult = await client.query(
        `SELECT name, address, city FROM locations
         WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
      );

      return {
        businessName: tenant?.name || 'Restaurant',
        menuItems: menuResult.rows.map((r) => ({
          name: r.name,
          description: r.description || '',
          price: parseFloat(r.price)
        })),
        locations: locationResult.rows.map((r) => ({
          name: r.name,
          address: `${r.address}, ${r.city}`
        })),
        openingHours: tenant?.settings?.openingHours
      };
    });
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(
    context: {
      businessName: string;
      menuItems: Array<{ name: string; description: string; price: number }>;
      locations: Array<{ name: string; address: string }>;
      openingHours?: string;
    },
    language: string
  ): string {
    const menuText = context.menuItems
      .slice(0, 20) // Limit to prevent token overflow
      .map((m) => `- ${m.name}: ${m.description} (${m.price.toFixed(2)})`)
      .join('\n');

    const locationText = context.locations
      .map((l) => `- ${l.name}: ${l.address}`)
      .join('\n');

    let prompt = SYSTEM_PROMPTS.chatbot;

    prompt += `\n\n## Business Information
Business Name: ${context.businessName}

## Menu Highlights
${menuText || 'Menu information not available'}

## Locations
${locationText || 'Location information not available'}
`;

    if (context.openingHours) {
      prompt += `\n## Opening Hours\n${context.openingHours}`;
    }

    if (language !== 'en') {
      prompt += `\n\n## Language
Please respond in ${this.getLanguageName(language)}. The customer prefers communication in this language.`;
    }

    return prompt;
  }

  /**
   * Analyze sentiment of a message
   */
  private analyzeSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    const lowerMessage = message.toLowerCase();

    const positiveWords = [
      'great',
      'excellent',
      'amazing',
      'love',
      'fantastic',
      'wonderful',
      'thank',
      'perfect',
      'delicious',
      'best'
    ];
    const negativeWords = [
      'bad',
      'terrible',
      'awful',
      'hate',
      'worst',
      'disappointed',
      'angry',
      'upset',
      'complaint',
      'poor',
      'cold',
      'wrong'
    ];

    const positiveCount = positiveWords.filter((w) => lowerMessage.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lowerMessage.includes(w)).length;

    if (negativeCount > positiveCount) return 'negative';
    if (positiveCount > negativeCount) return 'positive';
    return 'neutral';
  }

  /**
   * Detect suggested actions from response
   */
  private detectSuggestedActions(response: string): string[] {
    const actions: string[] = [];
    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('reservation') || lowerResponse.includes('book')) {
      actions.push('make_reservation');
    }
    if (lowerResponse.includes('menu') || lowerResponse.includes('order')) {
      actions.push('view_menu');
    }
    if (lowerResponse.includes('location') || lowerResponse.includes('address')) {
      actions.push('get_directions');
    }
    if (lowerResponse.includes('contact') || lowerResponse.includes('call')) {
      actions.push('contact_staff');
    }

    return actions;
  }

  /**
   * Update conversation sentiment score
   */
  private async updateConversationSentiment(
    conversationId: string,
    tenantId: string,
    sentiment: 'positive' | 'neutral' | 'negative'
  ): Promise<void> {
    const sentimentScore = sentiment === 'positive' ? 0.5 : sentiment === 'negative' ? -0.5 : 0;

    await runInTenantContext(this.pool, tenantId, async (client) => {
      return client.query(
        `UPDATE chat_conversations
         SET sentiment_score = COALESCE(sentiment_score, 0) * 0.7 + $1 * 0.3
         WHERE id = $2`,
        [sentimentScore, conversationId]
      );
    });
  }

  /**
   * Close a conversation
   */
  async closeConversation(conversationId: string, tenantId: string, resolvedByAi: boolean = true): Promise<void> {
    await runInTenantContext(this.pool, tenantId, async (client) => {
      await client.query(
        `UPDATE chat_conversations
         SET status = 'closed', resolved_by_ai = $1, updated_at = NOW()
         WHERE id = $2`,
        [resolvedByAi, conversationId]
      );

      // Remove from Redis cache
      const result = await client.query(
        `SELECT tenant_id, session_id FROM chat_conversations WHERE id = $1`,
        [conversationId]
      );

      if (result.rows.length > 0) {
        const { tenant_id, session_id } = result.rows[0];
        await this.redis.del(`conversation:${tenant_id}:${session_id}`);
      }
    });
  }

  /**
   * Escalate conversation to human
   */
  async escalateToHuman(conversationId: string, tenantId: string): Promise<void> {
    await runInTenantContext(this.pool, tenantId, async (client) => {
      return client.query(
        `UPDATE chat_conversations
         SET status = 'escalated', escalated_to_human = true, updated_at = NOW()
         WHERE id = $1`,
        [conversationId]
      );
    });
  }

  /**
   * Get language name from code
   */
  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      ar: 'Arabic'
    };
    return languages[code] || 'English';
  }

  /**
   * Get conversation statistics for a tenant
   */
  async getConversationStats(tenantId: string, days: number = 30): Promise<{
    totalConversations: number;
    resolvedByAi: number;
    escalatedToHuman: number;
    averageResponseTime: number;
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN resolved_by_ai THEN 1 ELSE 0 END) as resolved_ai,
          SUM(CASE WHEN escalated_to_human THEN 1 ELSE 0 END) as escalated,
          AVG(CASE WHEN sentiment_score > 0.2 THEN 1 WHEN sentiment_score < -0.2 THEN -1 ELSE 0 END) as avg_sentiment
         FROM chat_conversations
         WHERE tenant_id = $1 AND created_at >= $2`,
        [tenantId, startDate]
      );

      const messageResult = await client.query(
        `SELECT AVG(response_time_ms) as avg_response
         FROM chat_messages
         WHERE tenant_id = $1 AND role = 'assistant' AND created_at >= $2`,
        [tenantId, startDate]
      );

      const row = result.rows[0];

      return {
        totalConversations: parseInt(row.total) || 0,
        resolvedByAi: parseInt(row.resolved_ai) || 0,
        escalatedToHuman: parseInt(row.escalated) || 0,
        averageResponseTime: parseFloat(messageResult.rows[0]?.avg_response) || 0,
        sentimentBreakdown: {
          positive: 0, // Would need more detailed query
          neutral: 0,
          negative: 0
        }
      };
    });
  }
}
