/**
 * Base AI Provider Abstract Class
 *
 * All AI providers must extend this class
 */

import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig,
  AIProviderStatus,
  PROVIDER_MODELS
} from './types';

export abstract class BaseAIProvider {
  protected config: AIProviderConfig;
  protected lastError?: string;
  protected lastLatency?: number;
  protected isAvailable: boolean = true;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Get the provider name
   */
  abstract get name(): AIProvider;

  /**
   * Send a completion request to the provider
   */
  abstract complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Stream a completion (if supported)
   */
  abstract stream(
    request: AICompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<AICompletionResponse>;

  /**
   * Check if the provider is available/healthy
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get provider status
   */
  getStatus(): AIProviderStatus {
    return {
      provider: this.name,
      available: this.isAvailable && this.config.enabled,
      latencyMs: this.lastLatency,
      lastError: this.lastError,
      lastChecked: new Date()
    };
  }

  /**
   * Get the model to use (request override or default)
   */
  protected getModel(request: AICompletionRequest): string {
    return request.model || this.config.defaultModel;
  }

  /**
   * Get temperature (request override or default)
   */
  protected getTemperature(request: AICompletionRequest): number {
    return request.temperature ?? this.config.temperature;
  }

  /**
   * Get max tokens (request override or default)
   */
  protected getMaxTokens(request: AICompletionRequest): number {
    return request.maxTokens ?? this.config.maxTokens;
  }

  /**
   * Calculate cost based on usage
   */
  calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    const providerModels = PROVIDER_MODELS[this.name];
    if (!providerModels?.costPer1kTokens) {
      return 0;
    }

    const costs = providerModels.costPer1kTokens as Record<string, { input: number; output: number }>;
    const modelCosts = costs[model];

    if (!modelCosts) {
      return 0; // Unknown model, assume free
    }

    const inputCost = (inputTokens / 1000) * modelCosts.input;
    const outputCost = (outputTokens / 1000) * modelCosts.output;

    return inputCost + outputCost;
  }

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get provider priority (for fallback ordering)
   */
  getPriority(): number {
    return this.config.priority;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Mark provider as unavailable (for circuit breaker pattern)
   */
  markUnavailable(error: string): void {
    this.isAvailable = false;
    this.lastError = error;

    // Auto-recover after 60 seconds
    setTimeout(() => {
      this.isAvailable = true;
    }, 60000);
  }

  /**
   * Format messages for the provider's expected format
   * Override in subclasses if needed
   */
  protected formatMessages(request: AICompletionRequest): AICompletionRequest['messages'] {
    return request.messages;
  }

  /**
   * Handle rate limiting with exponential backoff
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error
        const isRateLimit =
          error instanceof Error &&
          (error.message.includes('rate limit') ||
            error.message.includes('429') ||
            error.message.includes('too many requests'));

        if (isRateLimit && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Measure response time for a request
   */
  protected async measureLatency<T>(operation: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
    const startTime = Date.now();
    const result = await operation();
    const latencyMs = Date.now() - startTime;

    this.lastLatency = latencyMs;
    return { result, latencyMs };
  }
}
