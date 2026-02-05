/**
 * Webhook Router
 * Handle incoming messages from Telegram and WhatsApp
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import { ChatService } from './chat.service';
import { AgentService } from './agent.service';
import { logger } from '../logger.service';
import { ChatRequest } from './types';

export function createWebhookRouter(
  pool: Pool,
  agentService: AgentService,
  chatService: ChatService
): Router {
  const router = Router();

  /**
   * POST /webhooks/telegram/:tenantId
   * Handle incoming Telegram messages
   */
  router.post('/telegram/:tenantId', async (req: Request, res: Response) => {
    const { tenantId } = req.params;

    try {
      // Verify webhook secret (optional but recommended)
      const webhookSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (webhookSecret) {
        const credentials = await agentService.getChannelCredentials(tenantId, 'telegram');
        if (webhookSecret !== credentials.webhook_secret) {
          logger.warn('Invalid Telegram webhook secret', { tenantId });
          return res.status(401).json({ error: 'Invalid secret' });
        }
      }

      // Parse Telegram update
      const update = req.body;
      
      // Handle message
      if (update.message?.text) {
        const message = update.message;
        
        const chatRequest: ChatRequest = {
          channel: 'telegram',
          external_chat_id: String(message.chat.id),
          customer_name: [message.from.first_name, message.from.last_name]
            .filter(Boolean)
            .join(' ') || message.from.username,
          message: message.text,
          external_message_id: String(message.message_id),
        };

        // Process message asynchronously
        processMessageAsync(tenantId, chatRequest, chatService, 'telegram', agentService);
      }

      // Telegram expects 200 OK quickly
      res.status(200).json({ ok: true });
    } catch (error) {
      logger.error('Telegram webhook error', { error, tenantId });
      res.status(200).json({ ok: true }); // Always return 200 to prevent retries
    }
  });

  /**
   * GET /webhooks/telegram/:tenantId
   * Telegram webhook verification (for setWebhook)
   */
  router.get('/telegram/:tenantId', (req: Request, res: Response) => {
    res.status(200).send('OK');
  });

  /**
   * POST /webhooks/whatsapp/:tenantId
   * Handle incoming WhatsApp messages (Cloud API)
   */
  router.post('/whatsapp/:tenantId', async (req: Request, res: Response) => {
    const { tenantId } = req.params;

    try {
      // Verify webhook signature
      const signature = req.headers['x-hub-signature-256'] as string;
      if (signature) {
        const isValid = await verifyWhatsAppSignature(
          tenantId,
          agentService,
          req.body,
          signature
        );
        if (!isValid) {
          logger.warn('Invalid WhatsApp webhook signature', { tenantId });
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Parse WhatsApp webhook payload
      const { entry } = req.body;
      
      for (const e of entry || []) {
        for (const change of e.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;
            
            for (const message of value.messages || []) {
              if (message.type === 'text') {
                const contact = value.contacts?.[0];
                
                const chatRequest: ChatRequest = {
                  channel: 'whatsapp',
                  external_chat_id: message.from,
                  customer_name: contact?.profile?.name,
                  message: message.text.body,
                  external_message_id: message.id,
                };

                // Process message asynchronously
                processMessageAsync(tenantId, chatRequest, chatService, 'whatsapp', agentService);
              }
            }
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('WhatsApp webhook error', { error, tenantId });
      res.status(200).json({ success: true }); // Always return 200
    }
  });

  /**
   * GET /webhooks/whatsapp/:tenantId
   * WhatsApp webhook verification
   */
  router.get('/whatsapp/:tenantId', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // In production, verify token against stored value
    if (mode === 'subscribe') {
      // Accept verification (in production, verify token)
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  });

  return router;
}

/**
 * Process message asynchronously and send response
 */
async function processMessageAsync(
  tenantId: string,
  request: ChatRequest,
  chatService: ChatService,
  channel: 'telegram' | 'whatsapp',
  agentService: AgentService
): Promise<void> {
  try {
    const response = await chatService.processMessage(tenantId, request);

    // Send response back to channel
    if (channel === 'telegram') {
      await sendTelegramResponse(tenantId, agentService, request.external_chat_id, response.message);
    } else if (channel === 'whatsapp') {
      await sendWhatsAppResponse(tenantId, agentService, request.external_chat_id, response.message);
    }

    if (response.escalated) {
      logger.info('Conversation escalated', {
        tenantId,
        conversationId: response.conversation_id,
        reason: response.escalation_reason,
      });
      // TODO: Notify staff about escalation
    }
  } catch (error) {
    logger.error('Failed to process message', { error, tenantId, channel });
    
    // Send error message to user
    const errorMessage = "I'm sorry, I'm having trouble processing your message right now. Please try again later or contact the restaurant directly.";
    
    try {
      if (channel === 'telegram') {
        await sendTelegramResponse(tenantId, agentService, request.external_chat_id, errorMessage);
      } else if (channel === 'whatsapp') {
        await sendWhatsAppResponse(tenantId, agentService, request.external_chat_id, errorMessage);
      }
    } catch (sendError) {
      logger.error('Failed to send error message', { sendError, tenantId });
    }
  }
}

/**
 * Send Telegram message
 */
async function sendTelegramResponse(
  tenantId: string,
  agentService: AgentService,
  chatId: string,
  text: string
): Promise<void> {
  const credentials = await agentService.getChannelCredentials(tenantId, 'telegram');
  
  const response = await fetch(
    `https://api.telegram.org/bot${credentials.bot_token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }
}

/**
 * Send WhatsApp message
 */
async function sendWhatsAppResponse(
  tenantId: string,
  agentService: AgentService,
  to: string,
  text: string
): Promise<void> {
  const credentials = await agentService.getChannelCredentials(tenantId, 'whatsapp');
  
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${credentials.phone_id}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }
}

/**
 * Verify WhatsApp webhook signature
 */
async function verifyWhatsAppSignature(
  tenantId: string,
  agentService: AgentService,
  payload: unknown,
  signature: string
): Promise<boolean> {
  try {
    const credentials = await agentService.getChannelCredentials(tenantId, 'whatsapp');
    const appSecret = credentials.access_token; // In production, use actual app secret
    
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch {
    return false;
  }
}
