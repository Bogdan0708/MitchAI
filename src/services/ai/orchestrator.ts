/**
 * AI Orchestration Bridge
 * 
 * Central hub for routing AI requests to appropriate providers
 * based on task type, credits, and tenant configuration.
 * 
 * Integrates with:
 * - MTC Client (credit deduction)
 * - Multiple AI providers (OpenAI, Anthropic, Google, Local)
 * - Tenant feature flags
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getMTCClient } from '../blockchain/mtc-client';
import { AIService, getServicePricing } from '../blockchain/types';

// ============================================================================
// TYPES
// ============================================================================

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'local' | 'abacus';

export type AITaskType = 
  | 'chat'              // General conversation
  | 'review_response'   // Respond to customer reviews
  | 'menu_description'  // Generate menu item descriptions
  | 'translation'       // Translate content
  | 'sentiment'         // Analyze sentiment
  | 'content'           // Generate marketing content
  | 'summary'           // Summarize documents
  | 'code'              // Code generation/assistance
  | 'image'             // Image generation
  | 'voice';            // Voice/TTS

export interface AIRequest {
  tenantId: string;
  walletAddress?: string;  // For credit deduction
  taskType: AITaskType;
  messages: AIMessage[];
  options?: AIRequestOptions;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  preferredProvider?: AIProvider;
  preferredModel?: string;
  maxTokens?: number;
  temperature?: number;
  streaming?: boolean;
  useCredits?: boolean;  // Default true if wallet provided
}

export interface AIResponse {
  success: boolean;
  content?: string;
  provider: AIProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  creditsUsed?: number;
  cached?: boolean;
  error?: string;
  latencyMs: number;
}

export interface ProviderConfig {
  provider: AIProvider;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  models: ModelConfig[];
  rateLimitRpm?: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  service: AIService;
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  supportedTasks: AITaskType[];
  isDefault?: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_MODELS: ModelConfig[] = [
  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    service: 'gpt4o',
    contextWindow: 128000,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    supportedTasks: ['chat', 'review_response', 'menu_description', 'translation', 'content', 'summary', 'code'],
    isDefault: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    service: 'gpt4o-mini',
    contextWindow: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    supportedTasks: ['chat', 'review_response', 'menu_description', 'translation', 'sentiment', 'summary'],
  },
  // Anthropic
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    service: 'claude-sonnet',
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    supportedTasks: ['chat', 'review_response', 'menu_description', 'translation', 'content', 'summary', 'code'],
  },
  {
    id: 'claude-haiku-3-5',
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    service: 'claude-haiku',
    contextWindow: 200000,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
    supportedTasks: ['chat', 'sentiment', 'translation', 'summary'],
  },
  // Google
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    service: 'gemini-flash',
    contextWindow: 1000000,
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
    supportedTasks: ['chat', 'review_response', 'menu_description', 'translation', 'sentiment', 'summary'],
  },
  // Local (LM Studio / Ollama)
  {
    id: 'local-llm',
    name: 'Local LLM',
    provider: 'local',
    service: 'local-llm',
    contextWindow: 32000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportedTasks: ['chat', 'review_response', 'menu_description', 'translation', 'sentiment', 'summary'],
  },
];

// Task to recommended model mapping
const TASK_MODEL_PREFERENCES: Record<AITaskType, string[]> = {
  chat: ['gpt-4o', 'claude-sonnet-4-5', 'local-llm'],
  review_response: ['claude-sonnet-4-5', 'gpt-4o', 'gpt-4o-mini'],
  menu_description: ['gpt-4o', 'claude-sonnet-4-5', 'local-llm'],
  translation: ['gpt-4o-mini', 'claude-haiku-3-5', 'gemini-2.0-flash'],
  sentiment: ['claude-haiku-3-5', 'gpt-4o-mini', 'gemini-2.0-flash'],
  content: ['claude-sonnet-4-5', 'gpt-4o'],
  summary: ['gemini-2.0-flash', 'gpt-4o-mini', 'claude-haiku-3-5'],
  code: ['claude-sonnet-4-5', 'gpt-4o'],
  image: ['gpt-4o'], // Placeholder - needs DALL-E/Flux integration
  voice: ['gpt-4o'], // Placeholder - needs TTS integration
};

// ============================================================================
// AI ORCHESTRATOR CLASS
// ============================================================================

export class AIOrchestrator {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private localBaseUrl: string;
  private models: Map<string, ModelConfig>;
  private providerConfigs: Map<AIProvider, ProviderConfig>;

  constructor() {
    this.localBaseUrl = process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1';
    this.models = new Map(DEFAULT_MODELS.map(m => [m.id, m]));
    this.providerConfigs = new Map();
    
    this.initializeProviders();
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------

  private initializeProviders(): void {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.providerConfigs.set('openai', {
        provider: 'openai',
        enabled: true,
        models: DEFAULT_MODELS.filter(m => m.provider === 'openai'),
      });
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      this.providerConfigs.set('anthropic', {
        provider: 'anthropic',
        enabled: true,
        models: DEFAULT_MODELS.filter(m => m.provider === 'anthropic'),
      });
    }

    // Google (placeholder - needs Vertex AI setup)
    if (process.env.GOOGLE_AI_API_KEY) {
      this.providerConfigs.set('google', {
        provider: 'google',
        enabled: true,
        models: DEFAULT_MODELS.filter(m => m.provider === 'google'),
      });
    }

    // Local LLM (always available as fallback)
    this.providerConfigs.set('local', {
      provider: 'local',
      enabled: true,
      baseUrl: this.localBaseUrl,
      models: DEFAULT_MODELS.filter(m => m.provider === 'local'),
    });

    console.log('[AI Orchestrator] Initialized with providers:', 
      Array.from(this.providerConfigs.keys()).filter(p => this.providerConfigs.get(p)?.enabled)
    );
  }

  // --------------------------------------------------------------------------
  // MAIN ORCHESTRATION
  // --------------------------------------------------------------------------

  /**
   * Process an AI request through the orchestration layer
   */
  async process(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // 1. Select model based on task and preferences
      const model = this.selectModel(request.taskType, request.options);
      
      if (!model) {
        return {
          success: false,
          provider: 'local',
          model: 'none',
          error: 'No suitable model available for this task',
          latencyMs: Date.now() - startTime,
        };
      }

      // 2. Check and deduct credits if wallet provided
      let creditsUsed = 0;
      if (request.walletAddress && request.options?.useCredits !== false) {
        const creditResult = await this.deductCredits(request.walletAddress, model.service);
        if (!creditResult.success) {
          return {
            success: false,
            provider: model.provider,
            model: model.id,
            error: creditResult.error,
            latencyMs: Date.now() - startTime,
          };
        }
        creditsUsed = creditResult.creditsUsed;
      }

      // 3. Route to appropriate provider
      const response = await this.routeToProvider(model, request);

      return {
        ...response,
        creditsUsed,
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      console.error('[AI Orchestrator] Error:', error);
      return {
        success: false,
        provider: 'local',
        model: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // --------------------------------------------------------------------------
  // MODEL SELECTION
  // --------------------------------------------------------------------------

  /**
   * Select the best model for a task
   */
  private selectModel(taskType: AITaskType, options?: AIRequestOptions): ModelConfig | null {
    // If specific model requested, use it
    if (options?.preferredModel) {
      const model = this.models.get(options.preferredModel);
      if (model && this.isProviderAvailable(model.provider)) {
        return model;
      }
    }

    // If specific provider requested, find best model from that provider
    if (options?.preferredProvider) {
      const providerModels = Array.from(this.models.values())
        .filter(m => m.provider === options.preferredProvider)
        .filter(m => m.supportedTasks.includes(taskType))
        .filter(m => this.isProviderAvailable(m.provider));
      
      if (providerModels.length > 0) {
        return providerModels[0];
      }
    }

    // Use task preferences to find best available model
    const preferences = TASK_MODEL_PREFERENCES[taskType] || [];
    
    for (const modelId of preferences) {
      const model = this.models.get(modelId);
      if (model && this.isProviderAvailable(model.provider)) {
        return model;
      }
    }

    // Fallback to any available model that supports the task
    const fallback = Array.from(this.models.values())
      .filter(m => m.supportedTasks.includes(taskType))
      .filter(m => this.isProviderAvailable(m.provider))[0];

    return fallback || null;
  }

  private isProviderAvailable(provider: AIProvider): boolean {
    const config = this.providerConfigs.get(provider);
    return config?.enabled === true;
  }

  // --------------------------------------------------------------------------
  // CREDIT MANAGEMENT
  // --------------------------------------------------------------------------

  private async deductCredits(
    walletAddress: string, 
    service: AIService
  ): Promise<{ success: boolean; creditsUsed: number; error?: string }> {
    try {
      const mtcClient = getMTCClient();
      const result = await mtcClient.useCredits({
        address: walletAddress,
        service,
      });

      if (!result.success) {
        return { success: false, creditsUsed: 0, error: result.error };
      }

      const pricing = getServicePricing(service);
      return { 
        success: true, 
        creditsUsed: pricing?.creditsPerCall || 0 
      };
    } catch (error) {
      console.error('[AI Orchestrator] Credit deduction failed:', error);
      // Allow request to proceed without credits (graceful degradation)
      return { success: true, creditsUsed: 0 };
    }
  }

  // --------------------------------------------------------------------------
  // PROVIDER ROUTING
  // --------------------------------------------------------------------------

  private async routeToProvider(model: ModelConfig, request: AIRequest): Promise<AIResponse> {
    switch (model.provider) {
      case 'openai':
        return this.callOpenAI(model, request);
      case 'anthropic':
        return this.callAnthropic(model, request);
      case 'google':
        return this.callGoogle(model, request);
      case 'local':
        return this.callLocal(model, request);
      default:
        throw new Error(`Unsupported provider: ${model.provider}`);
    }
  }

  // --------------------------------------------------------------------------
  // OPENAI PROVIDER
  // --------------------------------------------------------------------------

  private async callOpenAI(model: ModelConfig, request: AIRequest): Promise<AIResponse> {
    if (!this.openai) {
      return {
        success: false,
        provider: 'openai',
        model: model.id,
        error: 'OpenAI client not initialized',
        latencyMs: 0,
      };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: model.id,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: request.options?.maxTokens || 2048,
        temperature: request.options?.temperature ?? 0.7,
      });

      return {
        success: true,
        content: response.choices[0]?.message?.content || '',
        provider: 'openai',
        model: model.id,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        latencyMs: 0,
      };
    } catch (error) {
      console.error('[OpenAI] Error:', error);
      return {
        success: false,
        provider: 'openai',
        model: model.id,
        error: error instanceof Error ? error.message : 'OpenAI request failed',
        latencyMs: 0,
      };
    }
  }

  // --------------------------------------------------------------------------
  // ANTHROPIC PROVIDER
  // --------------------------------------------------------------------------

  private async callAnthropic(model: ModelConfig, request: AIRequest): Promise<AIResponse> {
    if (!this.anthropic) {
      return {
        success: false,
        provider: 'anthropic',
        model: model.id,
        error: 'Anthropic client not initialized',
        latencyMs: 0,
      };
    }

    try {
      // Extract system message
      const systemMessage = request.messages.find(m => m.role === 'system')?.content;
      const messages = request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const response = await this.anthropic.messages.create({
        model: model.id,
        max_tokens: request.options?.maxTokens || 2048,
        system: systemMessage,
        messages,
      });

      const textContent = response.content.find(c => c.type === 'text');

      return {
        success: true,
        content: textContent?.type === 'text' ? textContent.text : '',
        provider: 'anthropic',
        model: model.id,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        latencyMs: 0,
      };
    } catch (error) {
      console.error('[Anthropic] Error:', error);
      return {
        success: false,
        provider: 'anthropic',
        model: model.id,
        error: error instanceof Error ? error.message : 'Anthropic request failed',
        latencyMs: 0,
      };
    }
  }

  // --------------------------------------------------------------------------
  // GOOGLE PROVIDER (PLACEHOLDER)
  // --------------------------------------------------------------------------

  private async callGoogle(_model: ModelConfig, request: AIRequest): Promise<AIResponse> {
    // TODO: Implement Vertex AI / Gemini API
    console.log('[Google] Provider not yet implemented, falling back to local');
    return this.callLocal(
      this.models.get('local-llm')!,
      request
    );
  }

  // --------------------------------------------------------------------------
  // LOCAL PROVIDER (LM STUDIO / OLLAMA)
  // --------------------------------------------------------------------------

  private async callLocal(model: ModelConfig, request: AIRequest): Promise<AIResponse> {
    interface LocalLLMResponse {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }

    try {
      const response = await fetch(`${this.localBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.LOCAL_MODEL_ID || 'default',
          messages: request.messages,
          max_tokens: request.options?.maxTokens || 2048,
          temperature: request.options?.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`Local LLM returned ${response.status}`);
      }

      const data = await response.json() as LocalLLMResponse;

      return {
        success: true,
        content: data.choices?.[0]?.message?.content || '',
        provider: 'local',
        model: model.id,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        latencyMs: 0,
      };
    } catch (error) {
      console.error('[Local LLM] Error:', error);
      return {
        success: false,
        provider: 'local',
        model: model.id,
        error: error instanceof Error ? error.message : 'Local LLM request failed',
        latencyMs: 0,
      };
    }
  }

  // --------------------------------------------------------------------------
  // UTILITY METHODS
  // --------------------------------------------------------------------------

  /**
   * Get available models for a task type
   */
  getAvailableModels(taskType?: AITaskType): ModelConfig[] {
    let models = Array.from(this.models.values())
      .filter(m => this.isProviderAvailable(m.provider));

    if (taskType) {
      models = models.filter(m => m.supportedTasks.includes(taskType));
    }

    return models;
  }

  /**
   * Get provider status
   */
  getProviderStatus(): Record<AIProvider, boolean> {
    return {
      openai: this.providerConfigs.get('openai')?.enabled || false,
      anthropic: this.providerConfigs.get('anthropic')?.enabled || false,
      google: this.providerConfigs.get('google')?.enabled || false,
      local: this.providerConfigs.get('local')?.enabled || false,
      abacus: false, // Reserved for future AbacusAI integration
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; providers: Record<AIProvider, boolean> }> {
    const status = this.getProviderStatus();
    const healthy = Object.values(status).some(v => v);
    return { healthy, providers: status };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let orchestratorInstance: AIOrchestrator | null = null;

export function getAIOrchestrator(): AIOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AIOrchestrator();
  }
  return orchestratorInstance;
}

export function resetAIOrchestrator(): void {
  orchestratorInstance = null;
}

export default AIOrchestrator;
