/**
 * Agent Service
 * CRUD operations for tenant AI agents with encryption
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, decrypt } from '../encryption';
import { runInTenantContext } from '../../lib/db-context';
import { logger } from '../logger.service';
import {
  TenantAgent,
  CreateAgentInput,
  UpdateAgentInput,
  ConfigureChannelInput,
  AgentConversation,
  AgentMessage,
  AgentStats,
  AgentAnalytics,
  AgentCapabilities,
  ChatRequest,
  ChatResponse,
} from './types';

const DEFAULT_CAPABILITIES: AgentCapabilities = {
  can_view_menu: true,
  can_view_hours: true,
  can_handle_reservations: false,
  can_process_orders: false,
  can_access_loyalty: false,
  languages: ['en'],
};

const DEFAULT_SYSTEM_PROMPT = `You are a helpful restaurant assistant. You can help customers with:
- Menu information and recommendations
- Opening hours and location
- General questions about the restaurant

Always be friendly, professional, and helpful. If you cannot help with something, politely explain why and offer to connect them with staff.`;

export class AgentService {
  constructor(private pool: Pool) {}

  /**
   * Get or create agent for a tenant
   */
  async getAgent(tenantId: string): Promise<TenantAgent | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM tenant_agents WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapAgent(result.rows[0]);
    });
  }

  /**
   * Create a new agent for a tenant
   */
  async createAgent(tenantId: string, input: CreateAgentInput = {}): Promise<TenantAgent> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Check if agent already exists
      const existing = await client.query(
        `SELECT id FROM tenant_agents WHERE tenant_id = $1`,
        [tenantId]
      );

      if (existing.rows.length > 0) {
        throw new Error('Agent already exists for this tenant');
      }

      const capabilities = {
        ...DEFAULT_CAPABILITIES,
        ...input.capabilities,
      };

      const result = await client.query(
        `INSERT INTO tenant_agents (
          tenant_id, name, avatar_url, system_prompt, model_preference,
          temperature, max_tokens, capabilities, custom_knowledge, menu_context_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          tenantId,
          input.name || 'Restaurant Assistant',
          input.avatar_url || null,
          input.system_prompt || DEFAULT_SYSTEM_PROMPT,
          input.model_preference || 'local',
          input.temperature ?? 0.7,
          input.max_tokens ?? 1024,
          JSON.stringify(capabilities),
          JSON.stringify(input.custom_knowledge || {}),
          input.menu_context_enabled ?? true,
        ]
      );

      logger.info('Agent created', { tenantId, agentId: result.rows[0].id });
      return this.mapAgent(result.rows[0]);
    });
  }

  /**
   * Update agent configuration
   */
  async updateAgent(tenantId: string, input: UpdateAgentInput): Promise<TenantAgent> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramCount = 1;

      if (input.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(input.name);
      }
      if (input.avatar_url !== undefined) {
        updates.push(`avatar_url = $${paramCount++}`);
        values.push(input.avatar_url);
      }
      if (input.system_prompt !== undefined) {
        updates.push(`system_prompt = $${paramCount++}`);
        values.push(input.system_prompt);
      }
      if (input.model_preference !== undefined) {
        updates.push(`model_preference = $${paramCount++}`);
        values.push(input.model_preference);
      }
      if (input.temperature !== undefined) {
        updates.push(`temperature = $${paramCount++}`);
        values.push(input.temperature);
      }
      if (input.max_tokens !== undefined) {
        updates.push(`max_tokens = $${paramCount++}`);
        values.push(input.max_tokens);
      }
      if (input.capabilities !== undefined) {
        updates.push(`capabilities = capabilities || $${paramCount++}::jsonb`);
        values.push(JSON.stringify(input.capabilities));
      }
      if (input.custom_knowledge !== undefined) {
        updates.push(`custom_knowledge = $${paramCount++}`);
        values.push(JSON.stringify(input.custom_knowledge));
      }
      if (input.menu_context_enabled !== undefined) {
        updates.push(`menu_context_enabled = $${paramCount++}`);
        values.push(input.menu_context_enabled);
      }
      if (input.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(input.status);
        if (input.status === 'active') {
          updates.push(`error_message = NULL`);
        }
      }

      if (updates.length === 0) {
        throw new Error('No updates provided');
      }

      values.push(tenantId);

      const result = await client.query(
        `UPDATE tenant_agents SET ${updates.join(', ')} 
         WHERE tenant_id = $${paramCount} 
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Agent not found');
      }

      logger.info('Agent updated', { tenantId, updates: Object.keys(input) });
      return this.mapAgent(result.rows[0]);
    });
  }

  /**
   * Configure channel credentials (encrypted)
   */
  async configureChannel(tenantId: string, input: ConfigureChannelInput): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramCount = 1;

      if (input.channel === 'telegram') {
        if (input.telegram_bot_token) {
          const encrypted = await encrypt(input.telegram_bot_token);
          updates.push(`telegram_bot_token_encrypted = $${paramCount++}`);
          values.push(encrypted);
          
          // Generate webhook secret
          const webhookSecret = uuidv4().replace(/-/g, '');
          updates.push(`telegram_webhook_secret = $${paramCount++}`);
          values.push(webhookSecret);
        }
        if (input.telegram_bot_username) {
          updates.push(`telegram_bot_username = $${paramCount++}`);
          values.push(input.telegram_bot_username);
        }
      } else if (input.channel === 'whatsapp') {
        if (input.whatsapp_phone_id) {
          const encrypted = await encrypt(input.whatsapp_phone_id);
          updates.push(`whatsapp_phone_id_encrypted = $${paramCount++}`);
          values.push(encrypted);
        }
        if (input.whatsapp_access_token) {
          const encrypted = await encrypt(input.whatsapp_access_token);
          updates.push(`whatsapp_access_token_encrypted = $${paramCount++}`);
          values.push(encrypted);
        }
      }

      if (updates.length === 0) {
        throw new Error('No channel configuration provided');
      }

      values.push(tenantId);

      const result = await client.query(
        `UPDATE tenant_agents SET ${updates.join(', ')} 
         WHERE tenant_id = $${paramCount}`,
        values
      );

      if (result.rowCount === 0) {
        throw new Error('Agent not found');
      }

      logger.info('Channel configured', { tenantId, channel: input.channel });
    });
  }

  /**
   * Get decrypted channel credentials (for internal use only)
   */
  async getChannelCredentials(
    tenantId: string,
    channel: 'telegram' | 'whatsapp'
  ): Promise<Record<string, string>> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT telegram_bot_token_encrypted, telegram_webhook_secret,
                whatsapp_phone_id_encrypted, whatsapp_access_token_encrypted
         FROM tenant_agents WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length === 0) {
        throw new Error('Agent not found');
      }

      const row = result.rows[0];

      if (channel === 'telegram') {
        if (!row.telegram_bot_token_encrypted) {
          throw new Error('Telegram not configured');
        }
        const credentials: Record<string, string> = {
          bot_token: await decrypt(row.telegram_bot_token_encrypted),
        };
        if (row.telegram_webhook_secret) {
          credentials.webhook_secret = row.telegram_webhook_secret;
        }
        return credentials;
      } else {
        if (!row.whatsapp_phone_id_encrypted) {
          throw new Error('WhatsApp not configured');
        }
        return {
          phone_id: await decrypt(row.whatsapp_phone_id_encrypted),
          access_token: await decrypt(row.whatsapp_access_token_encrypted),
        };
      }
    });
  }

  /**
   * Activate agent
   */
  async activateAgent(tenantId: string): Promise<TenantAgent> {
    return this.updateAgent(tenantId, { status: 'active' });
  }

  /**
   * Deactivate agent
   */
  async deactivateAgent(tenantId: string): Promise<TenantAgent> {
    return this.updateAgent(tenantId, { status: 'inactive' });
  }

  /**
   * Get agent statistics
   */
  async getStats(tenantId: string): Promise<AgentStats> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const agentResult = await client.query(
        `SELECT id, messages_today, daily_message_limit, 
                tokens_this_month, monthly_token_limit
         FROM tenant_agents WHERE tenant_id = $1`,
        [tenantId]
      );

      if (agentResult.rows.length === 0) {
        throw new Error('Agent not found');
      }

      const agent = agentResult.rows[0];

      const conversationResult = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'active') as active,
           COUNT(*) as total
         FROM agent_conversations WHERE agent_id = $1`,
        [agent.id]
      );

      const stats = conversationResult.rows[0];

      // Get average response time from today's analytics
      const analyticsResult = await client.query(
        `SELECT avg_response_time_ms 
         FROM agent_analytics 
         WHERE agent_id = $1 AND date = CURRENT_DATE`,
        [agent.id]
      );

      return {
        messages_today: agent.messages_today,
        messages_limit: agent.daily_message_limit,
        tokens_this_month: agent.tokens_this_month,
        tokens_limit: agent.monthly_token_limit,
        active_conversations: parseInt(stats.active) || 0,
        total_conversations: parseInt(stats.total) || 0,
        avg_response_time_ms: analyticsResult.rows[0]?.avg_response_time_ms,
      };
    });
  }

  /**
   * Get conversation history
   */
  async getConversations(
    tenantId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<AgentConversation[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const conditions: string[] = ['ta.tenant_id = $1'];
      const values: unknown[] = [tenantId];
      let paramCount = 2;

      if (options.status) {
        conditions.push(`ac.status = $${paramCount++}`);
        values.push(options.status);
      }

      const result = await client.query(
        `SELECT ac.* FROM agent_conversations ac
         JOIN tenant_agents ta ON ac.agent_id = ta.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY ac.last_message_at DESC NULLS LAST
         LIMIT $${paramCount++} OFFSET $${paramCount}`,
        [...values, options.limit || 50, options.offset || 0]
      );

      return result.rows.map(this.mapConversation);
    });
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    tenantId: string,
    conversationId: string,
    limit = 50
  ): Promise<AgentMessage[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Verify conversation belongs to tenant
      const verify = await client.query(
        `SELECT ac.id FROM agent_conversations ac
         JOIN tenant_agents ta ON ac.agent_id = ta.id
         WHERE ac.id = $1 AND ta.tenant_id = $2`,
        [conversationId, tenantId]
      );

      if (verify.rows.length === 0) {
        throw new Error('Conversation not found');
      }

      const result = await client.query(
        `SELECT * FROM agent_messages 
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [conversationId, limit]
      );

      return result.rows.reverse().map(this.mapMessage);
    });
  }

  /**
   * Check if agent has capacity for more messages
   */
  async hasCapacity(tenantId: string): Promise<boolean> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT agent_has_capacity(id) as has_capacity 
         FROM tenant_agents WHERE tenant_id = $1`,
        [tenantId]
      );

      return result.rows[0]?.has_capacity ?? false;
    });
  }

  /**
   * Increment usage counters
   */
  async recordUsage(
    tenantId: string,
    tokensUsed: number
  ): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      await client.query(
        `UPDATE tenant_agents 
         SET messages_today = messages_today + 1,
             tokens_this_month = tokens_this_month + $1,
             last_active_at = NOW()
         WHERE tenant_id = $2`,
        [tokensUsed, tenantId]
      );
    });
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private mapAgent(row: Record<string, unknown>): TenantAgent {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      name: row.name as string,
      avatar_url: row.avatar_url as string | undefined,
      system_prompt: row.system_prompt as string | undefined,
      model_preference: row.model_preference as TenantAgent['model_preference'],
      temperature: parseFloat(row.temperature as string) || 0.7,
      max_tokens: row.max_tokens as number,
      capabilities: row.capabilities as AgentCapabilities,
      custom_knowledge: row.custom_knowledge as TenantAgent['custom_knowledge'],
      menu_context_enabled: row.menu_context_enabled as boolean,
      daily_message_limit: row.daily_message_limit as number,
      monthly_token_limit: row.monthly_token_limit as number,
      messages_today: row.messages_today as number,
      tokens_this_month: row.tokens_this_month as number,
      status: row.status as TenantAgent['status'],
      error_message: row.error_message as string | undefined,
      last_active_at: row.last_active_at ? new Date(row.last_active_at as string) : undefined,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
      telegram_bot_username: row.telegram_bot_username as string | undefined,
      has_telegram: !!row.telegram_bot_token_encrypted,
      has_whatsapp: !!row.whatsapp_phone_id_encrypted,
    };
  }

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
