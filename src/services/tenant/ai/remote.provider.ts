/**
 * Remote AI Provider
 * 
 * Calls the GCP-hosted AI service for completions.
 * This enables the hybrid AWS+GCP architecture.
 */

import { BaseAIProvider } from './base.provider';
import {
  AIProvider,
  AIProviderConfig,
  AICompletionRequest,
  AICompletionResponse
} from './types';

export class RemoteAIProvider extends BaseAIProvider {
  private serviceUrl: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.serviceUrl = process.env.AI_SERVICE_URL || '';
    
    if (!this.serviceUrl) {
      console.warn('[RemoteAI] AI_SERVICE_URL not configured');
      this.isAvailable = false;
    }
  }

  get name(): AIProvider {
    return 'remote';
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.serviceUrl) {
      throw new Error('AI_SERVICE_URL not configured');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.serviceUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: request.messages,
          provider: request.model?.includes('claude') ? 'claude' : 
                   request.model?.includes('gemini') ? 'gemini' :
                   request.model?.includes('sonar') ? 'perplexity' : 'openai',
          model: request.model || this.config.defaultModel,
          max_tokens: request.maxTokens || this.config.maxTokens,
          temperature: request.temperature || this.config.temperature,
          tenant_id: request.tenantId,
          task_type: request.requestType
        })
      });

      if (!response.ok) {
        const error = await response.text();
        this.lastError = `Remote AI service error: ${response.status} - ${error}`;
        throw new Error(this.lastError);
      }

      const data = await response.json() as {
        choices: Array<{ message?: { content?: string }; finish_reason?: string }>;
        model: string;
        provider: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const responseTimeMs = Date.now() - startTime;
      this.lastLatency = responseTimeMs;
      this.isAvailable = true;
      this.lastError = undefined;

      return {
        content: data.choices[0]?.message?.content || '',
        model: data.model,
        provider: 'remote',
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        },
        responseTimeMs,
        finishReason: (data.choices[0]?.finish_reason as 'stop' | 'length') || 'stop'
      };
    } catch (error) {
      this.isAvailable = false;
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  async stream(
    request: AICompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<AICompletionResponse> {
    // Remote service doesn't support streaming yet, fall back to complete
    const response = await this.complete(request);
    onChunk(response.content);
    return response;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.serviceUrl) {
      this.isAvailable = false;
      return false;
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      this.lastLatency = Date.now() - startTime;

      if (!response.ok) {
        this.isAvailable = false;
        this.lastError = `Health check failed: ${response.status}`;
        return false;
      }

      const data = await response.json() as { status?: string };
      this.isAvailable = data.status === 'healthy';
      this.lastError = undefined;
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      this.lastLatency = Date.now() - startTime;
      this.lastError = error instanceof Error ? error.message : 'Health check failed';
      return false;
    }
  }
}
