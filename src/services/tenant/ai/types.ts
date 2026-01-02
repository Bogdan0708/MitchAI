/**
 * AI Provider Types and Interfaces
 *
 * Unified types for multi-provider AI integration
 */

export type AIProvider = 'openai' | 'claude' | 'perplexity' | 'lm_studio' | 'ollama';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  tenantId?: string;
  requestType?: string; // For usage tracking: 'chat', 'menu_ai', 'review_response', etc.
}

export interface AICompletionResponse {
  content: string;
  provider: AIProvider;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  responseTimeMs: number;
  finishReason: 'stop' | 'length' | 'error' | 'content_filter';
  metadata?: Record<string, unknown>;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  rateLimit: number;
  monthlyBudgetUsd?: number;
  enabled: boolean;
  priority: number; // Lower = higher priority for fallback
}

export interface AIProviderStatus {
  provider: AIProvider;
  available: boolean;
  latencyMs?: number;
  lastError?: string;
  lastChecked: Date;
}

export interface AIUsageRecord {
  tenantId: string;
  provider: AIProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  requestType: string;
}

// Provider-specific model configurations
export const PROVIDER_MODELS = {
  openai: {
    default: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    costPer1kTokens: {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
    }
  },
  claude: {
    default: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    costPer1kTokens: {
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
      'claude-3-5-haiku-20241022': { input: 0.001, output: 0.005 },
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 }
    }
  },
  perplexity: {
    default: 'llama-3.1-sonar-small-128k-online',
    models: ['llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-huge-128k-online'],
    costPer1kTokens: {
      'llama-3.1-sonar-small-128k-online': { input: 0.0002, output: 0.0002 },
      'llama-3.1-sonar-large-128k-online': { input: 0.001, output: 0.001 },
      'llama-3.1-sonar-huge-128k-online': { input: 0.005, output: 0.005 }
    }
  },
  lm_studio: {
    default: 'local-model',
    models: ['local-model'], // Dynamic based on what's loaded
    costPer1kTokens: {
      'local-model': { input: 0, output: 0 } // Free (local)
    }
  },
  ollama: {
    default: 'llama3.2',
    models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'gemma2'],
    costPer1kTokens: {
      'llama3.2': { input: 0, output: 0 },
      'llama3.1': { input: 0, output: 0 },
      'mistral': { input: 0, output: 0 },
      'codellama': { input: 0, output: 0 },
      'gemma2': { input: 0, output: 0 }
    }
  }
} as const;

// System prompts for different use cases
export const SYSTEM_PROMPTS = {
  chatbot: `You are a friendly and helpful AI assistant for a restaurant/hospitality business.
Your role is to:
- Answer questions about the menu, opening hours, and services
- Help customers make reservations
- Provide recommendations based on preferences
- Handle complaints professionally and empathetically
- Upsell when appropriate but not pushy

Always be polite, concise, and helpful. If you don't know something, say so and offer to connect the customer with a human staff member.`,

  menuAi: `You are an expert culinary writer and menu designer.
Your role is to:
- Write appetizing, descriptive menu item descriptions
- Highlight key ingredients and cooking methods
- Appeal to the target audience
- Keep descriptions concise (2-3 sentences max)
- Include relevant dietary information when provided

Write in a style that matches the restaurant's brand voice.`,

  reviewResponse: `You are a professional hospitality manager responding to customer reviews.
Your role is to:
- Thank customers for their feedback
- Address specific points they mentioned
- Apologize sincerely for any negative experiences
- Highlight positives without being defensive
- Invite them to return
- Keep responses professional and warm

For negative reviews, show empathy and offer to make things right.
For positive reviews, express genuine gratitude and reinforce what they enjoyed.`,

  upselling: `You are a knowledgeable restaurant staff member making recommendations.
Your role is to:
- Suggest complementary items based on what the customer ordered
- Highlight popular items and specials
- Be helpful, not pushy
- Consider dietary preferences if mentioned
- Keep suggestions relevant and appetizing

Limit to 2-3 suggestions maximum.`,

  translation: `You are a professional translator specializing in hospitality and culinary content.
Your role is to:
- Translate menu items and descriptions accurately
- Preserve the appetizing nature of the original
- Adapt cultural references appropriately
- Maintain the same tone and style
- Keep formatting consistent

Provide natural-sounding translations that feel native to the target language.`
};
