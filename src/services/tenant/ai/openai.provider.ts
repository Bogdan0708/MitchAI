/**
 * OpenAI Provider
 *
 * Integration with OpenAI GPT models (GPT-4o, GPT-4o-mini, etc.)
 */

import OpenAI from 'openai';
import { BaseAIProvider } from './base.provider';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig
} from './types';

export class OpenAIProvider extends BaseAIProvider {
  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config);

    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl
    });
  }

  get name(): AIProvider {
    return 'openai';
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const model = this.getModel(request);
    const temperature = this.getTemperature(request);
    const maxTokens = this.getMaxTokens(request);

    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        return await this.withRetry(async () => {
          return await this.client.chat.completions.create({
            model,
            messages: request.messages.map((m) => ({
              role: m.role,
              content: m.content
            })),
            max_tokens: maxTokens,
            temperature,
            top_p: request.topP
          });
        });
      });

      const choice = result.choices[0];
      const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        content: choice.message?.content || '',
        provider: this.name,
        model,
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
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content
        })),
        max_tokens: maxTokens,
        temperature,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk(content);
        }

        // Update token counts from final chunk
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }

      // Estimate tokens if not provided
      if (!inputTokens) {
        inputTokens = this.estimateTokens(request.messages.map((m) => m.content).join(' '));
      }
      if (!outputTokens) {
        outputTokens = this.estimateTokens(fullContent);
      }

      const latencyMs = Date.now() - startTime;
      this.lastLatency = latencyMs;

      return {
        content: fullContent,
        provider: this.name,
        model,
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
        await this.client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5
        });
      });

      this.isAvailable = true;
      this.lastLatency = latencyMs;
      return true;
    } catch (error) {
      this.markUnavailable((error as Error).message);
      return false;
    }
  }

  private mapFinishReason(
    reason: string | null
  ): 'stop' | 'length' | 'error' | 'content_filter' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }
}
