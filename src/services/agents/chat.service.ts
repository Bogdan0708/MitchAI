/**
 * Chat Service
 * Handles incoming messages and generates AI responses
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { runInTenantContext } from '../../lib/db-context';
import { logger } from '../logger.service';
import { AgentService } from './agent.service';
import {
  ChatRequest,
  ChatResponse,
  AgentMessage,
  TenantAgent,
  AgentConversation,
} from './types';

// Import AI orchestrator
import { getAIOrchestrator, AITaskType } from '../ai/orchestrator';

interface AIResponse {
  content: string;
  tokensUsed: number;
  model: string;
  latencyMs: number;
}

export class ChatService {
  constructor(
    private pool: Pool,
    private agentService: AgentService
  ) {}

  /**
   * Process an incoming chat message and generate response
   */
  async processMessage(tenantId: string, request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Get agent configuration
      const agent = await this.agentService.getAgent(tenantId);
      if (!agent) {
        throw new Error('Agent not configured');
      }

      if (agent.status !== 'active') {
        throw new Error('Agent is not active');
      }

      // Check capacity
      const hasCapacity = await this.agentService.hasCapacity(tenantId);
      if (!hasCapacity) {
        throw new Error('Agent has reached message or token limit');
      }

      // Get or create conversation
      const conversation = await this.getOrCreateConversation(
        client,
        agent.id,
        request
      );

      // Store user message
      await this.storeMessage(client, conversation.id, {
        role: 'user',
        content: request.message,
        external_message_id: request.external_message_id,
      });

      // Get conversation history for context
      const history = await this.getConversationHistory(client, conversation.id, 10);

      // Build context
      const context = await this.buildContext(tenantId, agent, history);

      // Generate AI response
      const aiResponse = await this.generateResponse(agent, context, request.message);

      // Check for escalation triggers
      const escalation = this.checkEscalation(request.message, aiResponse.content);

      // Store assistant message
      await this.storeMessage(client, conversation.id, {
        role: 'assistant',
        content: aiResponse.content,
        tokens_used: aiResponse.tokensUsed,
        model_used: aiResponse.model,
        latency_ms: aiResponse.latencyMs,
      });

      // Update conversation
      await client.query(
        `UPDATE agent_conversations 
         SET message_count = message_count + 2,
             last_message_at = NOW(),
             last_customer_message_at = NOW(),
             last_agent_message_at = NOW(),
             escalated_to_human = $2,
             escalation_reason = $3,
             status = $4
         WHERE id = $1`,
        [
          conversation.id,
          escalation.escalated,
          escalation.reason,
          escalation.escalated ? 'escalated' : 'active',
        ]
      );

      // Record usage
      await this.agentService.recordUsage(tenantId, aiResponse.tokensUsed);

      // Update analytics
      await this.updateAnalytics(client, agent.id, aiResponse.tokensUsed, aiResponse.model);

      const latencyMs = Date.now() - startTime;

      return {
        conversation_id: conversation.id,
        message: aiResponse.content,
        tokens_used: aiResponse.tokensUsed,
        model_used: aiResponse.model,
        latency_ms: latencyMs,
        escalated: escalation.escalated,
        escalation_reason: escalation.reason,
      };
    });
  }

  /**
   * Get or create a conversation
   */
  private async getOrCreateConversation(
    client: import('pg').PoolClient,
    agentId: string,
    request: ChatRequest
  ): Promise<AgentConversation> {
    // Check for existing conversation
    if (request.conversation_id) {
      const result = await client.query(
        `SELECT * FROM agent_conversations WHERE id = $1 AND agent_id = $2`,
        [request.conversation_id, agentId]
      );
      if (result.rows.length > 0) {
        return this.mapConversation(result.rows[0]);
      }
    }

    // Look for existing conversation by external chat id
    const existing = await client.query(
      `SELECT * FROM agent_conversations 
       WHERE agent_id = $1 AND channel = $2 AND external_chat_id = $3
       AND status = 'active'`,
      [agentId, request.channel, request.external_chat_id]
    );

    if (existing.rows.length > 0) {
      return this.mapConversation(existing.rows[0]);
    }

    // Create new conversation
    const result = await client.query(
      `INSERT INTO agent_conversations 
       (agent_id, channel, external_chat_id, customer_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [agentId, request.channel, request.external_chat_id, request.customer_name]
    );

    logger.info('New conversation started', {
      conversationId: result.rows[0].id,
      channel: request.channel,
    });

    return this.mapConversation(result.rows[0]);
  }

  /**
   * Store a message in the database
   */
  private async storeMessage(
    client: import('pg').PoolClient,
    conversationId: string,
    message: Partial<AgentMessage>
  ): Promise<void> {
    await client.query(
      `INSERT INTO agent_messages 
       (conversation_id, role, content, tokens_used, model_used, latency_ms, external_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        conversationId,
        message.role,
        message.content,
        message.tokens_used || 0,
        message.model_used,
        message.latency_ms,
        message.external_message_id,
      ]
    );
  }

  /**
   * Get conversation history
   */
  private async getConversationHistory(
    client: import('pg').PoolClient,
    conversationId: string,
    limit: number
  ): Promise<AgentMessage[]> {
    const result = await client.query(
      `SELECT * FROM agent_messages 
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [conversationId, limit]
    );

    return result.rows.reverse().map(this.mapMessage);
  }

  /**
   * Build context for AI response
   */
  private async buildContext(
    tenantId: string,
    agent: TenantAgent,
    history: AgentMessage[]
  ): Promise<string> {
    const parts: string[] = [];

    // System prompt
    parts.push(agent.system_prompt || '');

    // Custom knowledge
    if (agent.custom_knowledge) {
      if (agent.custom_knowledge.faqs?.length) {
        parts.push('\n## Frequently Asked Questions');
        for (const faq of agent.custom_knowledge.faqs) {
          parts.push(`Q: ${faq.question}\nA: ${faq.answer}`);
        }
      }

      if (agent.custom_knowledge.policies) {
        parts.push('\n## Restaurant Policies');
        for (const [key, value] of Object.entries(agent.custom_knowledge.policies)) {
          parts.push(`${key}: ${value}`);
        }
      }

      if (agent.custom_knowledge.custom_instructions) {
        parts.push('\n## Additional Instructions');
        parts.push(agent.custom_knowledge.custom_instructions);
      }
    }

    // Menu context (if enabled)
    if (agent.menu_context_enabled) {
      const menuContext = await this.getMenuContext(tenantId);
      if (menuContext) {
        parts.push('\n## Menu Information');
        parts.push(menuContext);
      }
    }

    // Conversation history
    if (history.length > 0) {
      parts.push('\n## Recent Conversation');
      for (const msg of history.slice(-6)) {
        const role = msg.role === 'user' ? 'Customer' : 'Assistant';
        parts.push(`${role}: ${msg.content}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Get menu context for the agent
   */
  private async getMenuContext(tenantId: string): Promise<string | null> {
    try {
      return runInTenantContext(this.pool, tenantId, async (client) => {
        const result = await client.query(
          `SELECT name, description, price, ai_description 
           FROM menu_items 
           WHERE is_available = true AND deleted_at IS NULL
           ORDER BY name
           LIMIT 20`
        );

        if (result.rows.length === 0) {
          return null;
        }

        const items = result.rows.map((item) => {
          const desc = item.ai_description || item.description || '';
          return `- ${item.name} (£${item.price}): ${desc}`.trim();
        });

        return items.join('\n');
      });
    } catch {
      logger.warn('Failed to get menu context', { tenantId });
      return null;
    }
  }

  /**
   * Generate AI response using the orchestrator
   */
  private async generateResponse(
    agent: TenantAgent,
    context: string,
    userMessage: string
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const orchestrator = getAIOrchestrator();
      
      // Map agent model preference to orchestrator options
      const preferredProvider = agent.model_preference === 'local' 
        ? 'local' as const
        : agent.model_preference === 'anthropic' 
          ? 'anthropic' as const
          : agent.model_preference === 'openai'
            ? 'openai' as const
            : undefined;

      const response = await orchestrator.process({
        tenantId: agent.tenant_id,
        taskType: 'chat' as AITaskType,
        messages: [
          { role: 'system', content: context },
          { role: 'user', content: userMessage },
        ],
        options: {
          preferredProvider,
          maxTokens: agent.max_tokens,
          temperature: agent.temperature,
        },
      });

      if (!response.success || !response.content) {
        logger.warn('AI orchestrator failed, using fallback response', { 
          error: response.error,
          tenantId: agent.tenant_id,
        });
        // Fallback to simple response if AI fails
        return this.fallbackResponse(userMessage, agent, startTime);
      }

      return {
        content: response.content,
        tokensUsed: response.usage?.totalTokens || 0,
        model: response.model,
        latencyMs: response.latencyMs,
      };
    } catch (error) {
      logger.error('AI orchestrator error', { error, tenantId: agent.tenant_id });
      return this.fallbackResponse(userMessage, agent, startTime);
    }
  }

  /**
   * Fallback response when AI is unavailable
   */
  private fallbackResponse(
    userMessage: string,
    agent: TenantAgent,
    startTime: number
  ): AIResponse {
    const lowerMessage = userMessage.toLowerCase();
    let content: string;

    if (lowerMessage.includes('menu') || lowerMessage.includes('food')) {
      content = "I'd be happy to help you with our menu! We have a variety of delicious options. Is there anything specific you're looking for, like starters, mains, or desserts?";
    } else if (lowerMessage.includes('hours') || lowerMessage.includes('open')) {
      content = "We're open Monday to Saturday from 12pm to 10pm, and Sunday from 12pm to 8pm. Is there anything else I can help you with?";
    } else if (lowerMessage.includes('book') || lowerMessage.includes('reservation')) {
      content = agent.capabilities.can_handle_reservations
        ? "I can help you make a reservation! How many people will be dining, and what date and time would you prefer?"
        : "I'd love to help with reservations, but I'll need to connect you with our staff for that. Would you like me to pass your request along?";
    } else {
      content = "Thank you for your message! How can I assist you today? I can help with menu information, opening hours, and general questions about our restaurant.";
    }

    return {
      content,
      tokensUsed: 0,
      model: 'fallback',
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Check if message should be escalated to human
   */
  private checkEscalation(
    userMessage: string,
    response: string
  ): { escalated: boolean; reason?: string } {
    const lowerMessage = userMessage.toLowerCase();

    // Escalation triggers
    const escalationKeywords = [
      'speak to human',
      'talk to someone',
      'manager',
      'complaint',
      'refund',
      'allergic reaction',
      'food poisoning',
      'emergency',
    ];

    for (const keyword of escalationKeywords) {
      if (lowerMessage.includes(keyword)) {
        return {
          escalated: true,
          reason: `Customer mentioned: "${keyword}"`,
        };
      }
    }

    return { escalated: false };
  }

  /**
   * Update daily analytics
   */
  private async updateAnalytics(
    client: import('pg').PoolClient,
    agentId: string,
    tokensUsed: number,
    model: string
  ): Promise<void> {
    const isLocal = model === 'local' || model === 'local-llm';

    await client.query(
      `INSERT INTO agent_analytics (agent_id, date, total_messages, tokens_used, local_llm_tokens, cloud_tokens)
       VALUES ($1, CURRENT_DATE, 1, $2, $3, $4)
       ON CONFLICT (agent_id, date) 
       DO UPDATE SET 
         total_messages = agent_analytics.total_messages + 1,
         tokens_used = agent_analytics.tokens_used + $2,
         local_llm_tokens = agent_analytics.local_llm_tokens + $3,
         cloud_tokens = agent_analytics.cloud_tokens + $4`,
      [agentId, tokensUsed, isLocal ? tokensUsed : 0, isLocal ? 0 : tokensUsed]
    );
  }

  // Helper methods
  private mapConversation(row: Record<string, unknown>): AgentConversation {
    return {
      id: row.id as string,
      agent_id: row.agent_id as string,
      channel: row.channel as AgentConversation['channel'],
      external_chat_id: row.external_chat_id as string,
      customer_name: row.customer_name as string | undefined,
      customer_phone: row.customer_phone as string | undefined,
      context: row.context as Record<string, unknown>,
      summary: row.summary as string | undefined,
      message_count: row.message_count as number,
      last_message_at: row.last_message_at ? new Date(row.last_message_at as string) : undefined,
      status: row.status as AgentConversation['status'],
      escalated_to_human: row.escalated_to_human as boolean,
      escalation_reason: row.escalation_reason as string | undefined,
      created_at: new Date(row.created_at as string),
    };
  }

  private mapMessage(row: Record<string, unknown>): AgentMessage {
    return {
      id: row.id as string,
      conversation_id: row.conversation_id as string,
      role: row.role as AgentMessage['role'],
      content: row.content as string,
      tokens_used: row.tokens_used as number,
      model_used: row.model_used as string | undefined,
      latency_ms: row.latency_ms as number | undefined,
      external_message_id: row.external_message_id as string | undefined,
      created_at: new Date(row.created_at as string),
    };
  }
}
