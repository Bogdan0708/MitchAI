/**
 * VOICE AI SERVICE
 *
 * Voice-powered interactions for restaurants:
 * - Speech-to-text transcription (Whisper API)
 * - Text-to-speech responses
 * - Phone call handling (Twilio)
 * - WhatsApp voice message processing
 * - Voice-based ordering flow
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { AIRouter, AIMessage } from './ai';
import { ChatbotService } from './chatbot.service';

export interface VoiceTranscription {
  text: string;
  language: string;
  confidence: number;
  duration: number;
}

export interface VoiceSynthesis {
  audioUrl: string;
  audioBase64?: string;
  format: 'mp3' | 'wav' | 'ogg';
  duration: number;
}

export interface VoiceSession {
  id: string;
  tenantId: string;
  channel: 'phone' | 'whatsapp' | 'web';
  callerId?: string;
  status: 'active' | 'completed' | 'failed';
  startedAt: Date;
  endedAt?: Date;
  transcripts: VoiceTranscript[];
}

export interface VoiceTranscript {
  timestamp: Date;
  speaker: 'customer' | 'assistant';
  text: string;
  audioUrl?: string;
}

export interface VoiceOrderItem {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  specialInstructions?: string;
}

export interface VoiceOrderResult {
  success: boolean;
  orderId?: string;
  items: VoiceOrderItem[];
  totalAmount: number;
  confirmationMessage: string;
}

export class VoiceAIService {
  private pool: Pool;
  private redis: Redis;
  private aiRouter: AIRouter;
  private chatbotService: ChatbotService;
  private openaiApiKey: string;

  constructor(
    pool: Pool,
    redis: Redis,
    aiRouter: AIRouter,
    chatbotService: ChatbotService
  ) {
    this.pool = pool;
    this.redis = redis;
    this.aiRouter = aiRouter;
    this.chatbotService = chatbotService;
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
  }

  /**
   * Transcribe audio using Whisper API
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    options: {
      language?: string;
      format?: 'mp3' | 'wav' | 'webm' | 'ogg';
    } = {}
  ): Promise<VoiceTranscription> {
    const { language, format = 'webm' } = options;

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: `audio/${format}` });
    formData.append('file', blob, `audio.${format}`);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    if (language) {
      formData.append('language', language);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const result = await response.json() as {
      text: string;
      language: string;
      duration: number;
      segments?: { no_speech_prob: number }[];
    };

    // Calculate average confidence from segments
    const avgConfidence = result.segments?.length
      ? 1 - (result.segments.reduce((sum, s) => sum + s.no_speech_prob, 0) / result.segments.length)
      : 0.9;

    return {
      text: result.text,
      language: result.language,
      confidence: avgConfidence,
      duration: result.duration,
    };
  }

  /**
   * Synthesize speech from text using OpenAI TTS
   */
  async synthesizeSpeech(
    text: string,
    options: {
      voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
      speed?: number;
      format?: 'mp3' | 'opus' | 'aac' | 'flac';
    } = {}
  ): Promise<VoiceSynthesis> {
    const { voice = 'nova', speed = 1.0, format = 'mp3' } = options;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        speed,
        response_format: format,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS API error: ${error}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // Estimate duration based on text length and speed
    const estimatedDuration = (text.length / 15) / speed;

    return {
      audioUrl: `data:audio/${format};base64,${audioBase64}`,
      audioBase64,
      format: format as 'mp3' | 'wav' | 'ogg',
      duration: estimatedDuration,
    };
  }

  /**
   * Handle incoming voice message (WhatsApp, phone, web)
   */
  async handleVoiceMessage(
    tenantId: string,
    sessionId: string,
    audioBuffer: Buffer,
    channel: 'phone' | 'whatsapp' | 'web'
  ): Promise<{
    transcription: VoiceTranscription;
    response: string;
    audioResponse?: VoiceSynthesis;
  }> {
    // Transcribe the audio
    const transcription = await this.transcribeAudio(audioBuffer);

    // Process through chatbot - map phone channel to voice
    const chatChannel = channel === 'phone' ? 'voice' : channel;
    const chatResponse = await this.chatbotService.chat({
      tenantId,
      sessionId,
      message: transcription.text,
      channel: chatChannel,
      language: transcription.language,
    });

    // Synthesize response audio for phone/voice channels
    let audioResponse: VoiceSynthesis | undefined;
    if (channel === 'phone' || channel === 'whatsapp') {
      audioResponse = await this.synthesizeSpeech(chatResponse.message);
    }

    // Store transcript
    await this.storeTranscript(tenantId, sessionId, {
      customerText: transcription.text,
      assistantText: chatResponse.message,
      channel,
    });

    return {
      transcription,
      response: chatResponse.message,
      audioResponse,
    };
  }

  /**
   * Process voice order intent
   */
  async processVoiceOrder(
    tenantId: string,
    sessionId: string,
    transcribedText: string
  ): Promise<VoiceOrderResult> {
    // Get menu items for context
    const menuResult = await this.pool.query(
      `SELECT id, name, price, description
       FROM menu_items
       WHERE tenant_id = $1 AND is_available = true`,
      [tenantId]
    );

    const menuItems = menuResult.rows;
    const menuContext = menuItems
      .map(item => `- ${item.name}: $${item.price}`)
      .join('\n');

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a voice ordering assistant. Extract order items from customer speech.
Available menu items:
${menuContext}

Return JSON: {"items": [{"name": "item name", "quantity": number, "instructions": "special instructions"}], "confirmed": boolean}
If the order is unclear, set confirmed to false and ask clarifying questions.`,
      },
      {
        role: 'user',
        content: transcribedText,
      },
    ];

    const response = await this.aiRouter.complete({
      messages,
      tenantId,
      requestType: 'voice_order',
      maxTokens: 300,
      temperature: 0.3,
    });

    // Parse order from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        items: [],
        totalAmount: 0,
        confirmationMessage: "I couldn't understand your order. Could you please repeat it?",
      };
    }

    const orderData = JSON.parse(jsonMatch[0]) as {
      items: { name: string; quantity: number; instructions?: string }[];
      confirmed: boolean;
    };

    // Match items to menu
    const orderItems: VoiceOrderItem[] = [];
    let totalAmount = 0;

    for (const item of orderData.items) {
      const menuItem = menuItems.find(
        mi => mi.name.toLowerCase().includes(item.name.toLowerCase())
      );
      if (menuItem) {
        orderItems.push({
          menuItemId: menuItem.id,
          menuItemName: menuItem.name,
          quantity: item.quantity,
          specialInstructions: item.instructions,
        });
        totalAmount += menuItem.price * item.quantity;
      }
    }

    if (!orderData.confirmed || orderItems.length === 0) {
      const itemsList = orderItems
        .map(i => `${i.quantity}x ${i.menuItemName}`)
        .join(', ');

      return {
        success: false,
        items: orderItems,
        totalAmount,
        confirmationMessage: orderItems.length > 0
          ? `I have ${itemsList} for a total of $${totalAmount.toFixed(2)}. Would you like to confirm this order?`
          : "I couldn't find those items on our menu. Could you please try again?",
      };
    }

    // Create the order
    const orderId = await this.createVoiceOrder(tenantId, sessionId, orderItems, totalAmount);

    return {
      success: true,
      orderId,
      items: orderItems,
      totalAmount,
      confirmationMessage: `Your order has been placed! Order number ${orderId.slice(-6).toUpperCase()}. Total: $${totalAmount.toFixed(2)}. Thank you!`,
    };
  }

  /**
   * Create order from voice
   */
  private async createVoiceOrder(
    tenantId: string,
    sessionId: string,
    items: VoiceOrderItem[],
    totalAmount: number
  ): Promise<string> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (tenant_id, status, total_amount, order_type, notes)
         VALUES ($1, 'pending', $2, 'voice', $3)
         RETURNING id`,
        [tenantId, totalAmount, `Voice order from session ${sessionId}`]
      );

      const orderId = orderResult.rows[0].id;

      // Create order items
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes)
           VALUES ($1, $2, $3, (SELECT price FROM menu_items WHERE id = $2), $4)`,
          [orderId, item.menuItemId, item.quantity, item.specialInstructions]
        );
      }

      await client.query('COMMIT');
      return orderId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store voice transcript
   */
  private async storeTranscript(
    tenantId: string,
    sessionId: string,
    data: {
      customerText: string;
      assistantText: string;
      channel: string;
    }
  ): Promise<void> {
    const key = `voice:transcript:${tenantId}:${sessionId}`;
    const transcript = {
      timestamp: new Date().toISOString(),
      customer: data.customerText,
      assistant: data.assistantText,
      channel: data.channel,
    };

    await this.redis.rpush(key, JSON.stringify(transcript));
    await this.redis.expire(key, 86400 * 7); // Keep for 7 days
  }

  /**
   * Generate Twilio TwiML for phone calls
   */
  generateTwiML(
    message: string,
    options: {
      voice?: string;
      gather?: boolean;
      actionUrl?: string;
    } = {}
  ): string {
    const { voice = 'Polly.Joanna', gather = true, actionUrl } = options;

    let twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';

    if (gather && actionUrl) {
      twiml += `  <Gather input="speech" action="${actionUrl}" speechTimeout="auto" language="en-US">\n`;
      twiml += `    <Say voice="${voice}">${this.escapeXml(message)}</Say>\n`;
      twiml += '  </Gather>\n';
    } else {
      twiml += `  <Say voice="${voice}">${this.escapeXml(message)}</Say>\n`;
    }

    twiml += '</Response>';
    return twiml;
  }

  /**
   * Handle Twilio webhook for incoming calls
   */
  async handleTwilioWebhook(
    tenantId: string,
    callSid: string,
    speechResult?: string
  ): Promise<string> {
    const greeting = "Welcome to our restaurant! How can I help you today? You can place an order, make a reservation, or ask about our menu.";

    if (!speechResult) {
      // Initial greeting
      return this.generateTwiML(greeting, {
        gather: true,
        actionUrl: `/api/v1/voice/twilio?tenantId=${tenantId}`,
      });
    }

    // Process the speech
    const response = await this.chatbotService.chat({
      tenantId,
      sessionId: `call:${callSid}`,
      message: speechResult,
      channel: 'voice',
    });

    return this.generateTwiML(response.message, {
      gather: true,
      actionUrl: `/api/v1/voice/twilio?tenantId=${tenantId}`,
    });
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get voice session history
   */
  async getSessionHistory(
    tenantId: string,
    sessionId: string
  ): Promise<VoiceTranscript[]> {
    const key = `voice:transcript:${tenantId}:${sessionId}`;
    const transcripts = await this.redis.lrange(key, 0, -1);

    return transcripts.map(t => {
      const data = JSON.parse(t);
      return {
        timestamp: new Date(data.timestamp),
        speaker: 'customer',
        text: data.customer,
      };
    });
  }
}
