/**
 * AI Orchestration Bridge
 * 
 * Central hub for routing AI requests to appropriate providers
 * based on task type, credits, and tenant configuration.
 * 
 * Integrates with:
 * - MTC Client (credit deduction)
 * - Multiple AI providers (OpenAI, Anthropic, Google, Local, Ollama)
 * - Response caching (Redis)
 * - Tenant feature flags
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Redis from 'ioredis';
import crypto from 'crypto';
import { getMTCClient } from '../blockchain/mtc-client';
import { AIService, getServicePricing } from '../blockchain/types';
import { buildOptimizedMessages, estimateTokens } from './prompt-templates';
import { AIAnalytics } from './analytics';

// ============================================================================
// CACHING CONFIGURATION
// ============================================================================

const CACHE_CONFIG = {
  enabled: process.env.AI_CACHE_ENABLED !== 'false', // Default: enabled
  ttlSeconds: {
    sentiment: 3600,        // 1 hour - sentiment rarely changes
    summary: 1800,          // 30 min
    translation: 86400,     // 24 hours - translations are deterministic
    menu_description: 3600, // 1 hour
    review_response: 1800,  // 30 min - personalized, shorter cache
    chat: 0,                // No cache - conversational
    content: 1800,          // 30 min
    code: 0,                // No cache - context-dependent
    image: 0,               // No cache
    voice: 0,               // No cache
  } as Record<AITaskType, number>,
  maxCacheSize: 10000,      // Max cached items
  keyPrefix: 'ai:cache:',
};

// ============================================================================
// TOKEN LIMITS - Prevent runaway costs
// ============================================================================

const TOKEN_LIMITS: Record<AITaskType, { maxInput: number; maxOutput: number }> = {
  sentiment: { maxInput: 2000, maxOutput: 500 },    // JSON with scores/keywords per text
  summary: { maxInput: 4000, maxOutput: 300 },      // Condensed output
  translation: { maxInput: 2000, maxOutput: 2500 }, // Might expand slightly
  menu_description: { maxInput: 300, maxOutput: 150 }, // Short, punchy descriptions
  review_response: { maxInput: 1000, maxOutput: 300 }, // Professional responses
  chat: { maxInput: 4000, maxOutput: 1000 },        // Conversational
  content: { maxInput: 2000, maxOutput: 500 },      // Marketing copy
  code: { maxInput: 8000, maxOutput: 2000 },        // Code can be longer
  image: { maxInput: 500, maxOutput: 100 },         // Prompts only
  voice: { maxInput: 1000, maxOutput: 50 },         // TTS config
};

// ============================================================================
// TYPES
// ============================================================================

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'local' | 'ollama' | 'abacus' | 'remote';

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
  useOptimizedPrompts?: boolean; // Use task-specific optimized templates
  templateInput?: Record<string, any>; // Input for optimized templates
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
  // Local LM Studio Models (GPU-accelerated)
  {
    id: 'lmstudio-gpt-oss-20b',
    name: 'GPT-OSS 20B (Fast)',
    provider: 'local',
    service: 'local-llm',
    contextWindow: 32000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportedTasks: ['chat', 'review_response', 'menu_description', 'translation', 'sentiment', 'summary', 'content'],
    isDefault: true,
  },
  {
    id: 'lmstudio-gpt-oss-120b',
    name: 'GPT-OSS 120B (Quality)',
    provider: 'local',
    service: 'local-llm',
    contextWindow: 32000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportedTasks: ['content', 'code', 'chat'],
  },
  {
    id: 'lmstudio-phi-4',
    name: 'Phi-4 (Ultra Fast)',
    provider: 'local',
    service: 'local-llm',
    contextWindow: 16000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportedTasks: ['sentiment', 'summary', 'chat'],
  },
  {
    id: 'lmstudio-qwen-coder',
    name: 'Qwen3 Coder 30B',
    provider: 'local',
    service: 'local-llm',
    contextWindow: 32000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportedTasks: ['code'],
  },
  // Ollama Models (CPU fallback)
  {
    id: 'ollama-qwen3-8b',
    name: 'Qwen3 8B (Ollama)',
    provider: 'ollama',
    service: 'local-llm',
    contextWindow: 32000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportedTasks: ['chat', 'review_response', 'menu_description', 'translation', 'sentiment', 'summary'],
  },
  {
    id: 'ollama-deepseek-r1',
    name: 'DeepSeek R1 8B (Reasoning)',
    provider: 'ollama',
    service: 'local-llm',
    contextWindow: 32000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportedTasks: ['chat', 'code', 'content'],
  },
];

// LM Studio model ID mapping (internal ID → actual model name in LM Studio)
// JIT loading enabled: models load on-demand, unload after 60min idle
const LMSTUDIO_MODEL_MAP: Record<string, string> = {
  // Fast & efficient (1-2s response)
  'lmstudio-gpt-oss-20b': 'openai/gpt-oss-20b',      // Primary workhorse
  'lmstudio-phi-4': 'phi-4',                          // Fast, small
  
  // Quality models (slower JIT load, better output)
  'lmstudio-gpt-oss-120b': 'openai/gpt-oss-120b',    // Premium quality
  'lmstudio-qwen-coder': 'qwen/qwen3-coder-30b',     // Code specialist
  'lmstudio-qwq-32b': 'qwen/qwq-32b',                // Reasoning/thinking
  'lmstudio-llama-70b': 'meta/llama-3.3-70b',        // Large general
  
  // Specialized
  'lmstudio-devstral': 'mistralai/devstral-small-2-2512', // Dev tasks
};

// Ollama model ID mapping (CPU fallback)
const OLLAMA_MODEL_MAP: Record<string, string> = {
  'ollama-qwen3-8b': 'qwen3:8b',
  'ollama-deepseek-r1': 'deepseek-r1:8b',
};

// Task to recommended model mapping - LOCAL FIRST for cost optimization
// Strategy: gpt-oss-20b for light tasks (fast, low VRAM)
//           gpt-oss-120b for heavy tasks (quality, high VRAM)
// Fallback: Cloud APIs (fast) - NO Ollama (CPU is too slow)
const TASK_MODEL_PREFERENCES: Record<AITaskType, string[]> = {
  // =========================================================================
  // LIGHT TASKS → gpt-oss-20b (fast, ~3s warm, low VRAM)
  // Fallback: Gemini Flash (cheap, fast cloud)
  // =========================================================================
  sentiment: ['lmstudio-gpt-oss-20b', 'gemini-2.0-flash', 'gpt-4o-mini'],
  summary: ['lmstudio-gpt-oss-20b', 'gemini-2.0-flash', 'gpt-4o-mini'],
  translation: ['lmstudio-gpt-oss-20b', 'gemini-2.0-flash', 'gpt-4o-mini'],
  
  // =========================================================================
  // HEAVY TASKS → gpt-oss-120b (quality, ~5-7s warm, high VRAM)
  // Fallback: 20b → Cloud (GPT-4o-mini or Claude)
  // =========================================================================
  chat: ['lmstudio-gpt-oss-120b', 'lmstudio-gpt-oss-20b', 'gpt-4o-mini'],
  review_response: ['lmstudio-gpt-oss-120b', 'lmstudio-gpt-oss-20b', 'gpt-4o-mini'],
  menu_description: ['lmstudio-gpt-oss-120b', 'lmstudio-gpt-oss-20b', 'gpt-4o-mini'],
  content: ['lmstudio-gpt-oss-120b', 'lmstudio-gpt-oss-20b', 'claude-sonnet-4-5'],
  code: ['lmstudio-gpt-oss-120b', 'lmstudio-qwen-coder', 'claude-sonnet-4-5'],
  
  // =========================================================================
  // SPECIAL TASKS (need external APIs)
  // =========================================================================
  image: ['gpt-4o'], // Needs DALL-E
  voice: ['gpt-4o'], // Needs TTS
};

// ============================================================================
// AI ORCHESTRATOR CLASS
// ============================================================================

export class AIOrchestrator {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private redis: Redis | null = null;
  private localBaseUrl: string;
  private ollamaBaseUrl: string;
  private models: Map<string, ModelConfig>;
  private providerConfigs: Map<AIProvider, ProviderConfig>;
  private cacheStats = { hits: 0, misses: 0 };
  private analytics: AIAnalytics;

  constructor(redis?: Redis) {
    this.redis = redis || null;
    this.analytics = new AIAnalytics(undefined, redis || undefined);
    this.localBaseUrl = process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1';
    this.ollamaBaseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.models = new Map(DEFAULT_MODELS.map(m => [m.id, m]));
    this.providerConfigs = new Map();
    
    this.initializeProviders();
    
    if (this.redis && CACHE_CONFIG.enabled) {
      console.log('[AI Orchestrator] Response caching enabled');
    }
    console.log('[AI Orchestrator] Usage analytics enabled');
  }
  
  // --------------------------------------------------------------------------
  // CACHING
  // --------------------------------------------------------------------------
  
  /**
   * Generate cache key from request
   */
  private generateCacheKey(request: AIRequest): string {
    const content = request.messages.map(m => m.content).join('|');
    const hash = crypto.createHash('md5')
      .update(`${request.taskType}:${content}`)
      .digest('hex');
    return `${CACHE_CONFIG.keyPrefix}${request.taskType}:${hash}`;
  }
  
  /**
   * Get cached response
   */
  private async getCachedResponse(request: AIRequest): Promise<AIResponse | null> {
    if (!this.redis || !CACHE_CONFIG.enabled) return null;
    
    const ttl = CACHE_CONFIG.ttlSeconds[request.taskType];
    if (ttl === 0) return null; // Task not cacheable
    
    try {
      const key = this.generateCacheKey(request);
      const cached = await this.redis.get(key);
      if (cached) {
        this.cacheStats.hits++;
        const response = JSON.parse(cached) as AIResponse;
        response.cached = true;
        console.log(`[AI Cache] HIT for ${request.taskType} (${this.cacheStats.hits} hits)`);
        return response;
      }
      this.cacheStats.misses++;
    } catch (error) {
      console.error('[AI Cache] Get error:', error);
    }
    return null;
  }
  
  /**
   * Cache response
   */
  private async cacheResponse(request: AIRequest, response: AIResponse): Promise<void> {
    if (!this.redis || !CACHE_CONFIG.enabled || !response.success) return;
    
    const ttl = CACHE_CONFIG.ttlSeconds[request.taskType];
    if (ttl === 0) return; // Task not cacheable
    
    try {
      const key = this.generateCacheKey(request);
      await this.redis.setex(key, ttl, JSON.stringify(response));
      console.log(`[AI Cache] Stored ${request.taskType} response (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('[AI Cache] Set error:', error);
    }
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { hits: number; misses: number; hitRate: string } {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(1) + '%' : '0%';
    return { ...this.cacheStats, hitRate };
  }
  
  // --------------------------------------------------------------------------
  // TOKEN LIMITS
  // --------------------------------------------------------------------------
  
  /**
   * Apply token limits to request based on task type
   * Returns the effective maxTokens to use
   */
  private applyTokenLimits(request: AIRequest): number {
    const limits = TOKEN_LIMITS[request.taskType];
    const requestedMax = request.options?.maxTokens || 2048;
    
    // Use the smaller of requested and limit
    const effectiveMax = Math.min(requestedMax, limits.maxOutput);
    
    // Log if we're limiting
    if (requestedMax > limits.maxOutput) {
      console.log(`[AI Orchestrator] Token limit applied: ${requestedMax} → ${effectiveMax} for ${request.taskType}`);
    }
    
    return effectiveMax;
  }
  
  /**
   * Truncate input if it exceeds limit
   */
  private truncateInput(request: AIRequest): AIRequest {
    const limits = TOKEN_LIMITS[request.taskType];
    const maxInputChars = limits.maxInput * 4; // Rough estimate: 1 token ≈ 4 chars
    
    const truncatedMessages = request.messages.map(msg => {
      if (msg.content.length > maxInputChars) {
        console.log(`[AI Orchestrator] Input truncated: ${msg.content.length} → ${maxInputChars} chars`);
        return {
          ...msg,
          content: msg.content.substring(0, maxInputChars) + '...[truncated]'
        };
      }
      return msg;
    });
    
    return { ...request, messages: truncatedMessages };
  }
  
  /**
   * Apply optimized prompt templates if enabled
   */
  private applyOptimizedPrompts(request: AIRequest): AIRequest {
    if (!request.options?.useOptimizedPrompts || !request.options?.templateInput) {
      return request;
    }
    
    const optimizedMessages = buildOptimizedMessages(
      request.taskType,
      request.options.templateInput
    );
    
    const originalTokens = estimateTokens(request.messages.map(m => m.content).join(' '));
    const optimizedTokens = estimateTokens(optimizedMessages.map(m => m.content).join(' '));
    
    if (optimizedTokens < originalTokens) {
      console.log(`[AI Orchestrator] Prompt optimized: ${originalTokens} → ${optimizedTokens} tokens (${Math.round((1 - optimizedTokens/originalTokens) * 100)}% savings)`);
    }
    
    return {
      ...request,
      messages: optimizedMessages,
    };
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

    // Local LLM Studio (GPU-accelerated, primary local provider)
    const enableLocalAI = process.env.ENABLE_LOCAL_AI === 'true';
    this.providerConfigs.set('local', {
      provider: 'local',
      enabled: enableLocalAI,
      baseUrl: this.localBaseUrl,
      models: DEFAULT_MODELS.filter(m => m.provider === 'local'),
    });
    if (enableLocalAI) {
      console.log(`[AI Orchestrator] LM Studio configured: ${this.localBaseUrl}`);
    } else {
      console.log('[AI Orchestrator] LM Studio disabled (ENABLE_LOCAL_AI=false)');
    }

    // Ollama (CPU fallback when LM Studio unavailable)
    this.providerConfigs.set('ollama', {
      provider: 'ollama',
      enabled: enableLocalAI,
      baseUrl: this.ollamaBaseUrl,
      models: DEFAULT_MODELS.filter(m => m.provider === 'ollama'),
    });
    if (enableLocalAI) {
      console.log(`[AI Orchestrator] Ollama configured: ${this.ollamaBaseUrl}`);
    }

    // Remote AI Service (GCP) - cloud fallback when local unavailable
    if (process.env.AI_SERVICE_URL) {
      this.providerConfigs.set('remote', {
        provider: 'remote',
        enabled: true,
        baseUrl: process.env.AI_SERVICE_URL,
        models: [
          {
            id: 'remote-gpt-4o-mini',
            name: 'Remote GPT-4o Mini',
            provider: 'remote',
            service: 'gpt4o-mini',
            contextWindow: 128000,
            costPer1kInput: 0.00015,
            costPer1kOutput: 0.0006,
            supportedTasks: ['chat', 'review_response', 'menu_description', 'translation', 'sentiment', 'content', 'summary'],
            isDefault: true,
          },
        ],
      });
      // Also add remote models to the models map for selection
      const remoteModels = this.providerConfigs.get('remote')?.models || [];
      for (const model of remoteModels) {
        this.models.set(model.id, model);
      }
      console.log(`[AI Orchestrator] Remote AI service configured: ${process.env.AI_SERVICE_URL}`);
    }

    console.log('[AI Orchestrator] Initialized with providers:', 
      Array.from(this.providerConfigs.keys()).filter(p => this.providerConfigs.get(p)?.enabled)
    );
  }

  // --------------------------------------------------------------------------
  // MAIN ORCHESTRATION
  // --------------------------------------------------------------------------

  /**
   * Check if an error is retryable (should fallback to another provider)
   */
  private isRetryableError(error: string): boolean {
    const retryablePatterns = [
      'credit balance',
      'insufficient credits',
      'quota exceeded',
      'rate limit',
      'capacity',
      'overloaded',
      'temporarily unavailable',
      '429',
      '503',
      '529',
      'econnrefused',
      'fetch failed',
      'connection refused',
      'network error',
      'timeout',
    ];
    const lowerError = error.toLowerCase();
    return retryablePatterns.some(pattern => lowerError.includes(pattern));
  }

  /**
   * Get fallback models for a task, excluding already tried providers
   */
  private getFallbackModels(taskType: AITaskType, excludeProviders: Set<AIProvider>): ModelConfig[] {
    return Array.from(this.models.values())
      .filter(m => m.supportedTasks.includes(taskType))
      .filter(m => this.isProviderAvailable(m.provider))
      .filter(m => !excludeProviders.has(m.provider))
      .sort((a, b) => {
        // Prefer Local > Ollama > Remote > Cloud (cost optimization)
        const priority: Record<AIProvider, number> = { 
          local: 0,    // LM Studio (GPU, fastest, free)
          ollama: 1,   // Ollama (CPU fallback, free)
          remote: 2,   // GCP AI Service (cloud, uses credits)
          openai: 3,   // OpenAI direct
          anthropic: 4,// Claude direct
          google: 5,   // Gemini direct
          abacus: 6 
        };
        return (priority[a.provider] || 99) - (priority[b.provider] || 99);
      });
  }

  /**
   * Process an AI request through the orchestration layer
   * Automatically falls back to other providers on retryable errors
   */
  async process(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const triedProviders = new Set<AIProvider>();
    let lastError: string | undefined;

    try {
      // 0. Check cache first (huge cost savings!)
      const cachedResponse = await this.getCachedResponse(request);
      if (cachedResponse) {
        return {
          ...cachedResponse,
          latencyMs: Date.now() - startTime,
        };
      }
      
      // 0.5. Apply optimized prompts (if enabled)
      let processedRequest = this.applyOptimizedPrompts(request);
      
      // 0.6. Apply token limits (cost control)
      processedRequest = this.truncateInput(processedRequest);
      const effectiveMaxTokens = this.applyTokenLimits(processedRequest);
      processedRequest.options = {
        ...processedRequest.options,
        maxTokens: effectiveMaxTokens,
      };
      
      // 1. Select model based on task and preferences
      let model = this.selectModel(processedRequest.taskType, processedRequest.options);
      
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
      if (processedRequest.walletAddress && processedRequest.options?.useCredits !== false) {
        const creditResult = await this.deductCredits(processedRequest.walletAddress, model.service);
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

      // 3. Try primary provider, then fallbacks if needed
      while (model) {
        triedProviders.add(model.provider);
        console.log(`[AI Orchestrator] Trying ${model.provider}/${model.id}...`);
        
        const response = await this.routeToProvider(model, processedRequest);

        if (response.success) {
          const finalResponse = {
            ...response,
            creditsUsed,
            latencyMs: Date.now() - startTime,
          };
          // Cache successful response for future requests
          await this.cacheResponse(processedRequest, finalResponse);
          // Record usage analytics
          await this.analytics.recordUsage(processedRequest.tenantId, processedRequest.taskType, finalResponse);
          return finalResponse;
        }

        // Check if we should try a fallback
        lastError = response.error;
        if (this.isRetryableError(response.error || '')) {
          console.log(`[AI Orchestrator] ${model.provider} failed with retryable error: ${response.error}`);
          console.log(`[AI Orchestrator] Looking for fallback provider...`);
          
          const fallbacks = this.getFallbackModels(processedRequest.taskType, triedProviders);
          if (fallbacks.length > 0) {
            model = fallbacks[0];
            console.log(`[AI Orchestrator] Falling back to ${model.provider}/${model.id}`);
            continue;
          }
        }

        // Non-retryable error or no fallbacks available
        return {
          ...response,
          creditsUsed,
          latencyMs: Date.now() - startTime,
        };
      }

      // All providers exhausted
      return {
        success: false,
        provider: 'local',
        model: 'none',
        error: lastError || 'All providers failed',
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
      case 'ollama':
        return this.callOllama(model, request);
      case 'remote':
        return this.callRemote(model, request);
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
  // LOCAL PROVIDER (LM STUDIO - GPU Accelerated)
  // --------------------------------------------------------------------------

  private async callLocal(model: ModelConfig, request: AIRequest): Promise<AIResponse> {
    interface LocalLLMResponse {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }

    try {
      // Map internal model ID to actual LM Studio model name
      const actualModelId = LMSTUDIO_MODEL_MAP[model.id] || 'openai/gpt-oss-20b';
      
      // JIT loading: first request may take 30-60s to load model into VRAM
      // Subsequent requests are fast (~1-2s)
      const JIT_TIMEOUT_MS = 90000; // 90s for model loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), JIT_TIMEOUT_MS);
      
      console.log(`[LM Studio] Requesting ${actualModelId} (JIT timeout: ${JIT_TIMEOUT_MS/1000}s)...`);
      
      const response = await fetch(`${this.localBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: actualModelId,
          messages: request.messages,
          max_tokens: request.options?.maxTokens || 2048,
          temperature: request.options?.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`LM Studio returned ${response.status}`);
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
      console.error('[LM Studio] Error:', error);
      return {
        success: false,
        provider: 'local',
        model: model.id,
        error: error instanceof Error ? error.message : 'LM Studio request failed',
        latencyMs: 0,
      };
    }
  }

  // --------------------------------------------------------------------------
  // OLLAMA PROVIDER (CPU Fallback)
  // --------------------------------------------------------------------------

  private async callOllama(model: ModelConfig, request: AIRequest): Promise<AIResponse> {
    interface OllamaResponse {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    }

    try {
      // Map internal model ID to actual Ollama model name
      const actualModelId = OLLAMA_MODEL_MAP[model.id] || 'qwen3:8b';
      
      // Ollama also supports on-demand loading (slower on CPU)
      const OLLAMA_TIMEOUT_MS = 120000; // 120s for CPU inference
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
      
      console.log(`[Ollama] Requesting ${actualModelId} (timeout: ${OLLAMA_TIMEOUT_MS/1000}s)...`);
      
      const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: actualModelId,
          messages: request.messages,
          stream: false,
          options: {
            num_predict: request.options?.maxTokens || 2048,
            temperature: request.options?.temperature ?? 0.7,
          },
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }

      const data = await response.json() as OllamaResponse;

      return {
        success: true,
        content: data.message?.content || '',
        provider: 'ollama',
        model: model.id,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        latencyMs: 0,
      };
    } catch (error) {
      console.error('[Ollama] Error:', error);
      return {
        success: false,
        provider: 'ollama',
        model: model.id,
        error: error instanceof Error ? error.message : 'Ollama request failed',
        latencyMs: 0,
      };
    }
  }

  // --------------------------------------------------------------------------
  // REMOTE AI SERVICE PROVIDER (GCP)
  // --------------------------------------------------------------------------

  private async callRemote(model: ModelConfig, request: AIRequest): Promise<AIResponse> {
    const serviceUrl = process.env.AI_SERVICE_URL;
    if (!serviceUrl) {
      return {
        success: false,
        provider: 'remote',
        model: model.id,
        error: 'AI_SERVICE_URL not configured',
        latencyMs: 0,
      };
    }

    interface RemoteAIResponse {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      provider?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${serviceUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: request.messages,
          max_tokens: request.options?.maxTokens || 2048,
          temperature: request.options?.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`Remote AI service returned ${response.status}`);
      }

      const data = await response.json() as RemoteAIResponse;
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        content: data.choices?.[0]?.message?.content || '',
        provider: 'remote',
        model: data.model || model.id,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        latencyMs,
      };
    } catch (error) {
      console.error('[Remote AI] Error:', error);
      return {
        success: false,
        provider: 'remote',
        model: model.id,
        error: error instanceof Error ? error.message : 'Remote AI request failed',
        latencyMs: Date.now() - startTime,
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
      ollama: this.providerConfigs.get('ollama')?.enabled || false,
      remote: this.providerConfigs.get('remote')?.enabled || false,
      abacus: false, // Reserved for future AbacusAI integration
    };
  }

  /**
   * Get usage analytics
   */
  getUsageStats() {
    return {
      cache: this.getCacheStats(),
      session: this.analytics.getSessionStats(),
      savings: this.analytics.getCostSavingsReport(),
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
