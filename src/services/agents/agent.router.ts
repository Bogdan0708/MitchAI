/**
 * Agent Router
 * REST API endpoints for tenant AI agent management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AgentService } from './agent.service';
import { ChatService } from './chat.service';
import { CreateAgentInput, UpdateAgentInput, ConfigureChannelInput, ChatRequest } from './types';
import { logger } from '../logger.service';

// Use Express Request with tenant context added by TenantMiddleware
interface AuthenticatedRequest extends Request {
  tenant?: {
    tenantId: string;
    userId: string;
    userEmail: string;
    userRole: string;
    tier: {
      name: string;
      maxApiCalls: number;
      rateLimitPerMinute: number;
      features: Record<string, boolean>;
    };
  };
}

export function createAgentRouter(agentService: AgentService, chatService: ChatService): Router {
  const router = Router();

  // Middleware to ensure tenant context
  const requireTenant = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.tenant?.tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }
    next();
  };

  // Middleware to require admin role
  const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.tenant?.userRole !== 'admin' && req.tenant?.userRole !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  /**
   * GET /api/v1/tenant/agent
   * Get current tenant's agent configuration
   */
  router.get('/', requireTenant, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = await agentService.getAgent(req.tenant!.tenantId);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not configured' });
      }

      res.json({ agent });
    } catch (error) {
      logger.error('Failed to get agent', { error, tenantId: req.tenant?.tenantId });
      res.status(500).json({ error: 'Failed to get agent' });
    }
  });

  /**
   * POST /api/v1/tenant/agent
   * Create agent for tenant
   */
  router.post('/', requireTenant, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const input: CreateAgentInput = {
        name: req.body.name,
        avatar_url: req.body.avatar_url,
        system_prompt: req.body.system_prompt,
        model_preference: req.body.model_preference,
        temperature: req.body.temperature,
        max_tokens: req.body.max_tokens,
        capabilities: req.body.capabilities,
        custom_knowledge: req.body.custom_knowledge,
        menu_context_enabled: req.body.menu_context_enabled,
      };

      const agent = await agentService.createAgent(req.tenant!.tenantId, input);
      res.status(201).json({ agent });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create agent', { error, tenantId: req.tenant?.tenantId });
      
      if (message.includes('already exists')) {
        return res.status(409).json({ error: message });
      }
      
      res.status(500).json({ error: 'Failed to create agent' });
    }
  });

  /**
   * PUT /api/v1/tenant/agent
   * Update agent configuration
   */
  router.put('/', requireTenant, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const input: UpdateAgentInput = {
        name: req.body.name,
        avatar_url: req.body.avatar_url,
        system_prompt: req.body.system_prompt,
        model_preference: req.body.model_preference,
        temperature: req.body.temperature,
        max_tokens: req.body.max_tokens,
        capabilities: req.body.capabilities,
        custom_knowledge: req.body.custom_knowledge,
        menu_context_enabled: req.body.menu_context_enabled,
      };

      // Remove undefined values
      Object.keys(input).forEach((key) => {
        if (input[key as keyof UpdateAgentInput] === undefined) {
          delete input[key as keyof UpdateAgentInput];
        }
      });

      const agent = await agentService.updateAgent(req.tenant!.tenantId, input);
      res.json({ agent });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update agent', { error, tenantId: req.tenant?.tenantId });
      
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.status(500).json({ error: 'Failed to update agent' });
    }
  });

  /**
   * POST /api/v1/tenant/agent/channel
   * Configure channel credentials
   */
  router.post('/channel', requireTenant, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const input: ConfigureChannelInput = {
        channel: req.body.channel,
        telegram_bot_token: req.body.telegram_bot_token,
        telegram_bot_username: req.body.telegram_bot_username,
        whatsapp_phone_id: req.body.whatsapp_phone_id,
        whatsapp_access_token: req.body.whatsapp_access_token,
      };

      if (!input.channel || !['telegram', 'whatsapp'].includes(input.channel)) {
        return res.status(400).json({ error: 'Invalid channel. Use "telegram" or "whatsapp"' });
      }

      await agentService.configureChannel(req.tenant!.tenantId, input);
      res.json({ success: true, message: `${input.channel} configured successfully` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to configure channel', { error, tenantId: req.tenant?.tenantId });
      
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.status(500).json({ error: 'Failed to configure channel' });
    }
  });

  /**
   * POST /api/v1/tenant/agent/start
   * Activate agent
   */
  router.post('/start', requireTenant, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = await agentService.activateAgent(req.tenant!.tenantId);
      res.json({ agent, message: 'Agent activated successfully' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to activate agent', { error, tenantId: req.tenant?.tenantId });
      
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.status(500).json({ error: 'Failed to activate agent' });
    }
  });

  /**
   * POST /api/v1/tenant/agent/stop
   * Deactivate agent
   */
  router.post('/stop', requireTenant, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = await agentService.deactivateAgent(req.tenant!.tenantId);
      res.json({ agent, message: 'Agent deactivated successfully' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to deactivate agent', { error, tenantId: req.tenant?.tenantId });
      
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.status(500).json({ error: 'Failed to deactivate agent' });
    }
  });

  /**
   * GET /api/v1/tenant/agent/stats
   * Get agent usage statistics
   */
  router.get('/stats', requireTenant, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await agentService.getStats(req.tenant!.tenantId);
      res.json({ stats });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get agent stats', { error, tenantId: req.tenant?.tenantId });
      
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.status(500).json({ error: 'Failed to get agent stats' });
    }
  });

  /**
   * GET /api/v1/tenant/agent/conversations
   * List conversations
   */
  router.get('/conversations', requireTenant, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const options = {
        status: req.query.status as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const conversations = await agentService.getConversations(req.tenant!.tenantId, options);
      res.json({ conversations });
    } catch (error) {
      logger.error('Failed to get conversations', { error, tenantId: req.tenant?.tenantId });
      res.status(500).json({ error: 'Failed to get conversations' });
    }
  });

  /**
   * GET /api/v1/tenant/agent/conversations/:id/messages
   * Get messages for a conversation
   */
  router.get('/conversations/:id/messages', requireTenant, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const messages = await agentService.getMessages(req.tenant!.tenantId, req.params.id, limit);
      res.json({ messages });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get messages', { error, tenantId: req.tenant?.tenantId });
      
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      res.status(500).json({ error: 'Failed to get messages' });
    }
  });

  /**
   * POST /api/v1/tenant/agent/chat
   * Send a message and get AI response
   */
  router.post('/chat', requireTenant, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const chatRequest: ChatRequest = {
        message: req.body.message,
        channel: req.body.channel || 'web',
        external_chat_id: req.body.external_chat_id || req.body.sessionId || `web-${Date.now()}`,
        conversation_id: req.body.conversation_id || req.body.sessionId,
        customer_name: req.body.customer_name,
        external_message_id: req.body.external_message_id,
      };

      if (!chatRequest.message?.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const response = await chatService.processMessage(req.tenant!.tenantId, chatRequest);
      res.json({
        data: {
          response: response.message,
          conversation_id: response.conversation_id,
          tokens_used: response.tokens_used,
          model_used: response.model_used,
          latency_ms: response.latency_ms,
          escalated: response.escalated,
          escalation_reason: response.escalation_reason,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Chat error', { error, tenantId: req.tenant?.tenantId });
      
      if (message.includes('not configured')) {
        return res.status(404).json({ error: 'Agent not configured' });
      }
      if (message.includes('not active')) {
        return res.status(503).json({ error: 'Agent is not active' });
      }
      if (message.includes('limit')) {
        return res.status(429).json({ error: 'Message or token limit reached' });
      }
      
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  return router;
}
