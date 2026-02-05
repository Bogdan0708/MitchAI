/**
 * AI Router
 *
 * Intelligent routing between multiple AI providers with:
 * - Priority-based provider selection
 * - Automatic fallback on failure
 * - Usage tracking and cost management
 * - Health monitoring
 * - Circuit breaker pattern
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { BaseAIProvider } from './base.provider';
import { OpenAIProvider } from './openai.provider';
import { ClaudeProvider } from './claude.provider';
import { PerplexityProvider } from './perplexity.provider';
import { GeminiProvider } from './gemini.provider';
import { LMStudioProvider } from './lmstudio.provider';
import { OllamaProvider } from './ollama.provider';
import { RemoteAIProvider } from './remote.provider';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig,
  AIProviderStatus,
  AIUsageRecord,
  AITaskType,
  AIParallelResult,
  AIConsensusResult,
  PROVIDER_MODELS,
  TASK_PROVIDER_MAP
} from './types';

export interface AIRouterConfig {
  providers: Partial<Record<AIProvider, AIProviderConfig>>;
  defaultProvider?: AIProvider;
  enableFallback?: boolean;
  maxRetries?: number;
  trackUsage?: boolean;
  localFirst?: boolean; // Prefer local providers (LM Studio, Ollama) when available
}

export class AIRouter {
  private providers: Map<AIProvider, BaseAIProvider> = new Map();
  private config: AIRouterConfig;
  private pool?: Pool;

  constructor(config: AIRouterConfig, pool?: Pool, _redis?: Redis) {
    this.config = {
      enableFallback: true,
      maxRetries: 3,
      trackUsage: true,
      localFirst: false,
      ...config
    };
    this.pool = pool;
    // Note: redis parameter reserved for future caching implementation

    this.initializeProviders();
  }

  /**
   * Initialize all configured providers
   */
  private initializeProviders(): void {
    const providerConfigs = this.config.providers;

    if (providerConfigs.openai?.enabled !== false) {
      this.providers.set(
        'openai',
        new OpenAIProvider({
          provider: 'openai',
          enabled: true,
          priority: 2,
          defaultModel: PROVIDER_MODELS.openai.default,
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 60,
          ...providerConfigs.openai
        })
      );
    }

    if (providerConfigs.claude?.enabled !== false) {
      this.providers.set(
        'claude',
        new ClaudeProvider({
          provider: 'claude',
          enabled: true,
          priority: 2,
          defaultModel: PROVIDER_MODELS.claude.default,
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 60,
          ...providerConfigs.claude
        })
      );
    }

    if (providerConfigs.perplexity?.enabled !== false) {
      this.providers.set(
        'perplexity',
        new PerplexityProvider({
          provider: 'perplexity',
          enabled: true,
          priority: 3,
          defaultModel: PROVIDER_MODELS.perplexity.default,
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 60,
          ...providerConfigs.perplexity
        })
      );
    }

    if (providerConfigs.gemini?.enabled !== false) {
      this.providers.set(
        'gemini',
        new GeminiProvider({
          provider: 'gemini',
          enabled: true,
          priority: 2,
          defaultModel: PROVIDER_MODELS.gemini.default,
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 60,
          ...providerConfigs.gemini
        })
      );
    }

    if (providerConfigs.lm_studio?.enabled !== false) {
      this.providers.set(
        'lm_studio',
        new LMStudioProvider({
          provider: 'lm_studio',
          enabled: true,
          priority: this.config.localFirst ? 1 : 4,
          defaultModel: 'local-model',
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 1000, // Local has no real rate limit
          ...providerConfigs.lm_studio
        })
      );
    }

    if (providerConfigs.ollama?.enabled !== false) {
      this.providers.set(
        'ollama',
        new OllamaProvider({
          provider: 'ollama',
          enabled: true,
          priority: this.config.localFirst ? 1 : 4,
          defaultModel: PROVIDER_MODELS.ollama.default,
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 1000, // Local has no real rate limit
          ...providerConfigs.ollama
        })
      );
    }

    // Remote AI Service (GCP) - highest priority when configured
    if (process.env.AI_SERVICE_URL) {
      this.providers.set(
        'remote',
        new RemoteAIProvider({
          provider: 'remote',
          enabled: true,
          priority: 0, // Highest priority - use remote service first
          defaultModel: 'gpt-4o-mini',
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 1000,
          ...providerConfigs.remote
        })
      );
      console.log(`[AIRouter] Remote AI service configured: ${process.env.AI_SERVICE_URL}`);
    }

    console.log(
      `AIRouter initialized with providers: ${Array.from(this.providers.keys()).join(', ')}`
    );
  }

  /**
   * Get providers sorted by priority
   */
  private getSortedProviders(): BaseAIProvider[] {
    return Array.from(this.providers.values())
      .filter((p) => p.isEnabled() && p.getStatus().available)
      .sort((a, b) => a.getPriority() - b.getPriority());
  }

  /**
   * Complete a request, using fallback providers if needed
   */
  async complete(
    request: AICompletionRequest,
    preferredProvider?: AIProvider
  ): Promise<AICompletionResponse> {
    const providers = this.getSortedProviders();

    // If a specific provider is preferred and available, try it first
    if (preferredProvider) {
      const preferred = this.providers.get(preferredProvider);
      if (preferred?.isEnabled() && preferred.getStatus().available) {
        const reordered = [preferred, ...providers.filter((p) => p.name !== preferredProvider)];
        return this.tryProviders(reordered, request);
      }
    }

    return this.tryProviders(providers, request);
  }

  /**
   * Try providers in order until one succeeds
   */
  private async tryProviders(
    providers: BaseAIProvider[],
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    if (providers.length === 0) {
      throw new Error('No AI providers available');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        const response = await provider.complete(request);

        // Track usage if enabled
        if (this.config.trackUsage && request.tenantId) {
          await this.trackUsage({
            tenantId: request.tenantId,
            provider: provider.name,
            model: response.model,
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            costUsd: provider.calculateCost(
              response.usage.inputTokens,
              response.usage.outputTokens,
              response.model
            ),
            requestType: request.requestType || 'general'
          });
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`Provider ${provider.name} failed:`, error);

        if (!this.config.enableFallback) {
          throw error;
        }
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Stream a completion with fallback support
   */
  async stream(
    request: AICompletionRequest,
    onChunk: (chunk: string) => void,
    preferredProvider?: AIProvider
  ): Promise<AICompletionResponse> {
    const providers = this.getSortedProviders();

    // If a specific provider is preferred and available, try it first
    if (preferredProvider) {
      const preferred = this.providers.get(preferredProvider);
      if (preferred?.isEnabled() && preferred.getStatus().available) {
        const reordered = [preferred, ...providers.filter((p) => p.name !== preferredProvider)];
        return this.tryProvidersStream(reordered, request, onChunk);
      }
    }

    return this.tryProvidersStream(providers, request, onChunk);
  }

  /**
   * Try providers for streaming until one succeeds
   */
  private async tryProvidersStream(
    providers: BaseAIProvider[],
    request: AICompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<AICompletionResponse> {
    if (providers.length === 0) {
      throw new Error('No AI providers available');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        const response = await provider.stream(request, onChunk);

        // Track usage if enabled
        if (this.config.trackUsage && request.tenantId) {
          await this.trackUsage({
            tenantId: request.tenantId,
            provider: provider.name,
            model: response.model,
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            costUsd: provider.calculateCost(
              response.usage.inputTokens,
              response.usage.outputTokens,
              response.model
            ),
            requestType: request.requestType || 'general'
          });
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`Provider ${provider.name} stream failed:`, error);

        if (!this.config.enableFallback) {
          throw error;
        }
      }
    }

    throw new Error(`All providers failed for streaming. Last error: ${lastError?.message}`);
  }

  /**
   * Track AI usage in database
   */
  private async trackUsage(usage: AIUsageRecord): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.query(
        `INSERT INTO ai_usage (tenant_id, provider, model, input_tokens, output_tokens, cost_usd, request_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          usage.tenantId,
          usage.provider,
          usage.model,
          usage.inputTokens,
          usage.outputTokens,
          usage.costUsd,
          usage.requestType
        ]
      );
    } catch (error) {
      console.error('Failed to track AI usage:', error);
    }
  }

  /**
   * Get status of all providers
   */
  getAllStatus(): AIProviderStatus[] {
    return Array.from(this.providers.values()).map((p) => p.getStatus());
  }

  /**
   * Get a specific provider
   */
  getProvider(name: AIProvider): BaseAIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Run health checks on all providers
   */
  async healthCheckAll(): Promise<Record<AIProvider, boolean>> {
    const results: Record<string, boolean> = {};

    const checks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      results[name] = await provider.healthCheck();
    });

    await Promise.all(checks);
    return results as Record<AIProvider, boolean>;
  }

  /**
   * Get orchestrator-level statistics
   * Returns provider availability and configuration info
   */
  getOrchestratorStats(): {
    providers: { name: string; available: boolean; latencyMs?: number }[];
    localFirst: boolean;
    defaultProvider: string;
  } {
    const providerStats = Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      available: provider.getStatus().available,
      latencyMs: provider.getStatus().latencyMs,
    }));
    
    return {
      providers: providerStats,
      localFirst: this.config.localFirst || false,
      defaultProvider: this.config.defaultProvider || 'openai',
    };
  }

  /**
   * Get the best available provider
   */
  getBestProvider(): BaseAIProvider | null {
    const sorted = this.getSortedProviders();
    return sorted[0] || null;
  }

  /**
   * Get usage statistics for a tenant
   */
  async getTenantUsageStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalTokens: number;
    totalCostUsd: number;
    byProvider: Record<string, { tokens: number; cost: number }>;
    byRequestType: Record<string, { tokens: number; cost: number }>;
  }> {
    if (!this.pool) {
      return {
        totalTokens: 0,
        totalCostUsd: 0,
        byProvider: {},
        byRequestType: {}
      };
    }

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
    const end = endDate || new Date();

    const result = await this.pool.query(
      `SELECT
        provider,
        request_type,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(cost_usd) as total_cost
       FROM ai_usage
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY provider, request_type`,
      [tenantId, start, end]
    );

    const stats = {
      totalTokens: 0,
      totalCostUsd: 0,
      byProvider: {} as Record<string, { tokens: number; cost: number }>,
      byRequestType: {} as Record<string, { tokens: number; cost: number }>
    };

    for (const row of result.rows) {
      const tokens = parseInt(row.total_tokens) || 0;
      const cost = parseFloat(row.total_cost) || 0;

      stats.totalTokens += tokens;
      stats.totalCostUsd += cost;

      if (!stats.byProvider[row.provider]) {
        stats.byProvider[row.provider] = { tokens: 0, cost: 0 };
      }
      stats.byProvider[row.provider].tokens += tokens;
      stats.byProvider[row.provider].cost += cost;

      if (!stats.byRequestType[row.request_type]) {
        stats.byRequestType[row.request_type] = { tokens: 0, cost: 0 };
      }
      stats.byRequestType[row.request_type].tokens += tokens;
      stats.byRequestType[row.request_type].cost += cost;
    }

    return stats;
  }

  /**
   * Smart provider selection based on request type
   *
   * Uses TASK_PROVIDER_MAP for intelligent routing:
   * - Compliance tasks prefer Claude for complex reasoning
   * - Review tasks prefer OpenAI for fast structured output
   * - Content tasks prefer Claude for creative writing
   * - Research tasks prefer Perplexity for web search capability
   * - Cost-sensitive tasks prefer local providers (Ollama, LM Studio)
   */
  selectProviderForTask(taskType: AITaskType | string): AIProvider {
    // Get preferred providers from the task map, fallback to 'general' for unknown tasks
    const preferredProviders = TASK_PROVIDER_MAP[taskType as AITaskType] || TASK_PROVIDER_MAP.general;

    // Try each preferred provider in order, return first available
    for (const provider of preferredProviders) {
      const providerInstance = this.providers.get(provider);
      if (providerInstance?.isEnabled() && providerInstance.getStatus().available) {
        return provider;
      }
    }

    // Ultimate fallback to default provider
    return this.config.defaultProvider || 'openai';
  }

  /**
   * Complete a request with automatic provider selection based on task type
   */
  async completeForTask(
    request: AICompletionRequest,
    taskType: AITaskType
  ): Promise<AICompletionResponse> {
    const provider = this.selectProviderForTask(taskType);
    return this.complete({ ...request, requestType: taskType }, provider);
  }

  /**
   * Stream a request with automatic provider selection based on task type
   */
  async streamForTask(
    request: AICompletionRequest,
    taskType: AITaskType,
    onChunk: (chunk: string) => void
  ): Promise<AICompletionResponse> {
    const provider = this.selectProviderForTask(taskType);
    return this.stream({ ...request, requestType: taskType }, onChunk, provider);
  }

  /**
   * Enable/disable a provider dynamically
   */
  setProviderEnabled(provider: AIProvider, enabled: boolean): void {
    const p = this.providers.get(provider);
    if (p) {
      p.updateConfig({ enabled });
    }
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(provider: AIProvider, config: Partial<AIProviderConfig>): void {
    const p = this.providers.get(provider);
    if (p) {
      p.updateConfig(config);
    }
  }

  // ============================================================================
  // PARALLEL EXECUTION METHODS
  // ============================================================================

  /**
   * Execute request on multiple providers in parallel
   * Returns all responses for consensus/comparison
   * 
   * @param request - The completion request
   * @param providers - Specific providers to use (optional, defaults to top 3 available)
   * @returns All responses plus consensus analysis
   * 
   * @example
   * const result = await router.parallel(
   *   { messages: [{ role: 'user', content: 'Should we raise prices?' }] },
   *   ['openai', 'claude', 'gemini']
   * );
   * console.log(result.consensus.score); // 0-1 agreement score
   */
  async parallel(
    request: AICompletionRequest,
    providers?: AIProvider[]
  ): Promise<AIParallelResult> {
    const startTime = Date.now();

    // Get providers to use
    const targetProviders = providers
      ? providers
          .map((p) => this.providers.get(p))
          .filter((p): p is BaseAIProvider => p !== undefined && p.isEnabled() && p.getStatus().available)
      : this.getSortedProviders().slice(0, 3); // Default: top 3 available

    if (targetProviders.length === 0) {
      throw new Error('No providers available for parallel execution');
    }

    console.log(
      `Parallel AI: Executing on ${targetProviders.length} providers: ${targetProviders.map((p) => p.name).join(', ')}`
    );

    // Execute in parallel
    const results = await Promise.allSettled(
      targetProviders.map((provider) => provider.complete(request))
    );

    // Collect successful responses and errors
    const responses: AICompletionResponse[] = [];
    const errors: Array<{ provider: AIProvider; error: string }> = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        responses.push(result.value);
      } else {
        errors.push({
          provider: targetProviders[i].name,
          error: result.reason?.message || 'Unknown error'
        });
        console.error(`Parallel AI: ${targetProviders[i].name} failed:`, result.reason);
      }
    });

    if (responses.length === 0) {
      throw new Error(`All providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join(', ')}`);
    }

    // Calculate consensus
    const consensus = this.calculateConsensus(responses);

    // Track usage for all successful responses
    if (this.config.trackUsage && request.tenantId) {
      for (const response of responses) {
        const provider = this.providers.get(response.provider);
        if (provider) {
          await this.trackUsage({
            tenantId: request.tenantId,
            provider: response.provider,
            model: response.model,
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            costUsd: provider.calculateCost(
              response.usage.inputTokens,
              response.usage.outputTokens,
              response.model
            ),
            requestType: request.requestType || 'parallel'
          });
        }
      }
    }

    const totalTokens = responses.reduce((sum, r) => sum + r.usage.totalTokens, 0);
    const totalCost = responses.reduce((sum, r) => {
      const provider = this.providers.get(r.provider);
      return sum + (provider?.calculateCost(r.usage.inputTokens, r.usage.outputTokens, r.model) || 0);
    }, 0);

    return {
      responses,
      errors,
      consensus,
      metadata: {
        providersQueried: targetProviders.map((p) => p.name),
        successCount: responses.length,
        failureCount: errors.length,
        totalTokens,
        totalCostUsd: totalCost,
        totalTimeMs: Date.now() - startTime
      }
    };
  }

  /**
   * Promise.any polyfill for ES compatibility
   * Returns the first fulfilled promise, or rejects if all reject
   */
  private promiseAny<T>(promises: Promise<T>[]): Promise<T> {
    return new Promise((resolve, reject) => {
      const rejections: Error[] = [];
      let pending = promises.length;

      if (pending === 0) {
        reject(new Error('All promises were rejected (no promises provided)'));
        return;
      }

      promises.forEach((promise, index) => {
        Promise.resolve(promise)
          .then(resolve)
          .catch((error) => {
            rejections[index] = error;
            pending--;
            if (pending === 0) {
              const messages = rejections.map((e, i) => `[${i}]: ${e?.message || 'Unknown'}`).join('; ');
              reject(new Error(`All promises were rejected: ${messages}`));
            }
          });
      });
    });
  }

  /**
   * Calculate consensus between multiple AI responses using Jaccard similarity
   */
  private calculateConsensus(responses: AICompletionResponse[]): AIConsensusResult {
    if (responses.length === 1) {
      return {
        score: 1,
        level: 'high',
        themes: [],
        bestResponse: responses[0],
        recommendation: responses[0].content
      };
    }

    // Extract significant words from each response (4+ chars, lowercased)
    const wordSets = responses.map(
      (r) => new Set((r.content.toLowerCase().match(/\b[a-z]{4,}\b/g) || []))
    );

    // Calculate Jaccard similarity between all pairs
    let totalSimilarity = 0;
    let pairs = 0;

    for (let i = 0; i < wordSets.length; i++) {
      for (let j = i + 1; j < wordSets.length; j++) {
        const setA = wordSets[i];
        const setB = wordSets[j];
        const intersection = Array.from(setA).filter((w) => setB.has(w));
        const union = new Set(Array.from(setA).concat(Array.from(setB)));
        if (union.size > 0) {
          totalSimilarity += intersection.length / union.size;
        }
        pairs++;
      }
    }

    const score = pairs > 0 ? totalSimilarity / pairs : 0;

    // Determine consensus level
    let level: 'high' | 'moderate' | 'low';
    if (score >= 0.7) {
      level = 'high';
    } else if (score >= 0.4) {
      level = 'moderate';
    } else {
      level = 'low';
    }

    // Find common themes (words appearing in majority of responses)
    const wordCounts = new Map<string, number>();
    wordSets.forEach((set) => {
      set.forEach((word) => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      });
    });

    const threshold = Math.ceil(responses.length / 2);
    const themes = Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 15);

    // Best response = longest detailed response (usually most comprehensive)
    const bestResponse = responses.reduce((a, b) => (a.content.length > b.content.length ? a : b));

    // Generate synthesized recommendation for high consensus
    let recommendation = bestResponse.content;
    if (level === 'low') {
      recommendation = `⚠️ Low consensus (${Math.round(score * 100)}%). Review all responses:\n\n` +
        responses.map((r) => `**${r.provider}**: ${r.content.slice(0, 200)}...`).join('\n\n');
    }

    return {
      score,
      level,
      themes,
      bestResponse,
      recommendation
    };
  }

  /**
   * Parallel execution with automatic task-based provider selection
   * Picks the best providers for the task type
   */
  async parallelForTask(
    request: AICompletionRequest,
    taskType: AITaskType,
    count: number = 3
  ): Promise<AIParallelResult> {
    // Get preferred providers for this task type
    const preferredProviders = TASK_PROVIDER_MAP[taskType] || TASK_PROVIDER_MAP.general;
    
    // Take top N available providers
    const availableProviders = preferredProviders
      .filter((p) => {
        const provider = this.providers.get(p);
        return provider?.isEnabled() && provider.getStatus().available;
      })
      .slice(0, count);

    return this.parallel({ ...request, requestType: taskType }, availableProviders);
  }

  /**
   * Race multiple providers - return first successful response
   * Useful when you want speed over consensus
   */
  async race(
    request: AICompletionRequest,
    providers?: AIProvider[]
  ): Promise<AICompletionResponse> {
    const targetProviders = providers
      ? providers
          .map((p) => this.providers.get(p))
          .filter((p): p is BaseAIProvider => p !== undefined && p.isEnabled() && p.getStatus().available)
      : this.getSortedProviders().slice(0, 3);

    if (targetProviders.length === 0) {
      throw new Error('No providers available for race');
    }

    // Race all providers - first success wins
    // Using custom implementation for ES compatibility (Promise.any is ES2021)
    const response = await this.promiseAny(
      targetProviders.map((provider) => provider.complete(request))
    );

    // Track usage
    if (this.config.trackUsage && request.tenantId) {
      const provider = this.providers.get(response.provider);
      if (provider) {
        await this.trackUsage({
          tenantId: request.tenantId,
          provider: response.provider,
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          costUsd: provider.calculateCost(
            response.usage.inputTokens,
            response.usage.outputTokens,
            response.model
          ),
          requestType: request.requestType || 'race'
        });
      }
    }

    return response;
  }
}

/**
 * Create a default AIRouter with environment-based configuration
 */
export function createDefaultRouter(pool?: Pool, redis?: Redis): AIRouter {
  return new AIRouter(
    {
      providers: {
        openai: {
          provider: 'openai',
          enabled: !!process.env.OPENAI_API_KEY,
          apiKey: process.env.OPENAI_API_KEY,
          defaultModel: 'gpt-4o-mini',
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 60,
          priority: 2
        },
        claude: {
          provider: 'claude',
          enabled: !!process.env.ANTHROPIC_API_KEY,
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 60,
          priority: 2
        },
        perplexity: {
          provider: 'perplexity',
          enabled: !!process.env.PERPLEXITY_API_KEY,
          apiKey: process.env.PERPLEXITY_API_KEY,
          defaultModel: 'sonar',
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 60,
          priority: 3
        },
        gemini: {
          provider: 'gemini',
          enabled: !!process.env.GOOGLE_AI_KEY,
          apiKey: process.env.GOOGLE_AI_KEY,
          defaultModel: 'gemini-1.5-flash',
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 60,
          priority: 2
        },
        lm_studio: {
          provider: 'lm_studio',
          enabled: !!process.env.LM_STUDIO_URL || process.env.ENABLE_LOCAL_AI === 'true',
          baseUrl: process.env.LM_STUDIO_URL || 'http://localhost:1234/v1',
          defaultModel: 'local-model',
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 1000,
          priority: process.env.LOCAL_AI_FIRST === 'true' ? 1 : 4
        },
        ollama: {
          provider: 'ollama',
          enabled: !!process.env.OLLAMA_URL || process.env.ENABLE_LOCAL_AI === 'true',
          baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
          defaultModel: 'llama3.1:8b',
          maxTokens: 4096,
          temperature: 0.7,
          rateLimit: 1000,
          priority: process.env.LOCAL_AI_FIRST === 'true' ? 1 : 4
        }
      },
      defaultProvider: (process.env.DEFAULT_AI_PROVIDER as AIProvider) || 'openai',
      enableFallback: process.env.AI_ENABLE_FALLBACK !== 'false',
      localFirst: process.env.LOCAL_AI_FIRST === 'true',
      trackUsage: true
    },
    pool,
    redis
  );
}
