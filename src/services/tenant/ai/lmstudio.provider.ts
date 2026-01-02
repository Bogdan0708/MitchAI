/**
 * LM Studio Provider
 *
 * Integration with LM Studio local server (OpenAI-compatible API)
 * Zero cost, runs locally, great for development and cost-sensitive operations
 */

import { BaseAIProvider } from './base.provider';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig
} from './types';

interface LMStudioResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface LMStudioModel {
  id: string;
  object: string;
  owned_by: string;
}

export class LMStudioProvider extends BaseAIProvider {
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    super(config);

    // Default LM Studio server URL
    this.baseUrl = config.baseUrl || process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
  }

  get name(): AIProvider {
    return 'lm_studio';
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const model = this.getModel(request);
    const temperature = this.getTemperature(request);
    const maxTokens = this.getMaxTokens(request);

    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: request.messages.map((m) => ({
              role: m.role,
              content: m.content
            })),
            max_tokens: maxTokens,
            temperature,
            top_p: request.topP,
            stream: false
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`LM Studio error: ${response.status} - ${error}`);
        }

        return (await response.json()) as LMStudioResponse;
      });

      const choice = result.choices[0];
      const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        content: choice.message.content,
        provider: this.name,
        model: result.model || model,
        usage: {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        },
        responseTimeMs: latencyMs,
        finishReason: this.mapFinishReason(choice.finish_reason)
      };
    } catch (error) {
      this.markUnavailable((error as Error).message);
      throw error;
    }
  }

  async stream(
    request: AICompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<AICompletionResponse> {
    const model = this.getModel(request);
    const temperature = this.getTemperature(request);
    const maxTokens = this.getMaxTokens(request);
    const startTime = Date.now();

    let fullContent = '';
    let actualModel = model;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: maxTokens,
          temperature,
          stream: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LM Studio error: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                onChunk(content);
              }
              if (parsed.model) {
                actualModel = parsed.model;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      this.lastLatency = latencyMs;

      // Estimate tokens for local model (they're free anyway)
      const inputTokens = this.estimateTokens(
        request.messages.map((m) => m.content).join(' ')
      );
      const outputTokens = this.estimateTokens(fullContent);

      return {
        content: fullContent,
        provider: this.name,
        model: actualModel,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens
        },
        responseTimeMs: latencyMs,
        finishReason: 'stop'
      };
    } catch (error) {
      this.markUnavailable((error as Error).message);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { latencyMs } = await this.measureLatency(async () => {
        const response = await fetch(`${this.baseUrl}/models`, {
          method: 'GET'
        });

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }
      });

      this.isAvailable = true;
      this.lastLatency = latencyMs;
      return true;
    } catch (error) {
      this.markUnavailable((error as Error).message);
      return false;
    }
  }

  /**
   * Get list of available models loaded in LM Studio
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { data: LMStudioModel[] };
      return data.data.map((m) => m.id);
    } catch {
      return [];
    }
  }

  /**
   * Check if a specific model is loaded
   */
  async isModelLoaded(modelId: string): Promise<boolean> {
    const models = await this.getAvailableModels();
    return models.some((m) => m.includes(modelId));
  }

  private mapFinishReason(
    reason: string
  ): 'stop' | 'length' | 'error' | 'content_filter' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      default:
        return 'stop';
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
